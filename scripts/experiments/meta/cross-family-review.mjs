#!/usr/bin/env node
/**
 * cross-family-review.mjs — Cross-family reviewer for meta-factory experiments.
 *
 * Validates that the factory family differs from the reviewer family,
 * spawns a review session, and returns a structured verdict.
 *
 * Usage:
 *   node scripts/experiments/meta/cross-family-review.mjs \
 *     --bundle <bundle-dir> \
 *     --reviewer-family <family> \
 *     --reviewer-model <model> \
 *     [--reviewer-bin <binary>] \
 *     [--json]
 *
 * Node-stdlib only. No new dependencies.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

/**
 * Known model families. Maps family name → list of model name patterns.
 * Family is determined by training organization, not API provider.
 */
const FAMILIES = {
  anthropic: ['claude', 'haiku', 'sonnet', 'opus'],
  openai: ['gpt', 'o1', 'o3', 'o4', 'codex', 'davinci'],
  google: ['gemini', 'palm', 'bard'],
  'open-weight': ['qwen', 'deepseek', 'llama', 'mistral', 'phi', 'command-r'],
};

/**
 * Infer family from a model name string.
 * @param {string} model
 * @returns {string | null}
 */
export function inferFamily(model) {
  const lower = model.toLowerCase();
  for (const [family, patterns] of Object.entries(FAMILIES)) {
    if (patterns.some((p) => lower.includes(p))) return family;
  }
  return null;
}

/**
 * Validate that factory and reviewer families differ.
 * @param {string} factoryFamily
 * @param {string} reviewerFamily
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFamilySeparation(factoryFamily, reviewerFamily) {
  if (!factoryFamily || !reviewerFamily) {
    return { valid: false, error: 'Both factoryFamily and reviewerFamily must be specified' };
  }
  if (factoryFamily === reviewerFamily) {
    return {
      valid: false,
      error: `Family separation violated: factory=${factoryFamily}, reviewer=${reviewerFamily}. Cross-family review requires different families.`,
    };
  }
  return { valid: true };
}

/**
 * Build the review prompt for the cross-family reviewer.
 * @param {{ bundleDir: string, flowFile?: string }} opts
 * @returns {Promise<string>}
 */
async function buildReviewPrompt({ flowFile }) {
  const parts = [
    'You are a code reviewer evaluating the output of an automated code generation system.',
    'Your review must be honest and thorough. You are NOT affiliated with the system that produced this code.',
    '',
    '## Review Criteria',
    '',
    '1. **Correctness**: Does the code compile? Does it run without errors?',
    '2. **Spec conformance**: Does it implement what was specified?',
    '3. **Security**: Are there obvious vulnerabilities (injection, hardcoded secrets, etc.)?',
    '4. **Completeness**: Are all expected files present?',
    '5. **Quality**: Is the code well-structured, readable, and maintainable?',
    '',
    '## Instructions',
    '',
    'Examine the workspace files in this directory.',
    'Run any test commands you find (npm test, pytest, etc.).',
    'Report your verdict as either APPROVE or VETO with specific reasons.',
    '',
    'Output your verdict in this exact format on the last line:',
    'VERDICT: APPROVE',
    'or',
    'VERDICT: VETO reason1; reason2; reason3',
  ];

  if (flowFile && existsSync(flowFile)) {
    const flow = await readFile(flowFile, 'utf8');
    parts.push('', '## Flow specification that was executed:', '', '```', flow, '```');
  }

  return parts.join('\n');
}

/**
 * Parse the reviewer's output for a verdict.
 * @param {string} output
 * @returns {{ verdict: 'approve' | 'veto' | 'unknown', reasons: string[] }}
 */
export function parseVerdict(output) {
  const lines = output.split('\n').reverse();
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^VERDICT:\s*APPROVE/i.test(trimmed)) {
      return { verdict: 'approve', reasons: [] };
    }
    const vetoMatch = /^VERDICT:\s*VETO\s+(.+)/i.exec(trimmed);
    if (vetoMatch) {
      return {
        verdict: 'veto',
        reasons: vetoMatch[1]
          .split(';')
          .map((r) => r.trim())
          .filter(Boolean),
      };
    }
  }
  return { verdict: 'unknown', reasons: ['No VERDICT line found in reviewer output'] };
}

/**
 * Run the cross-family review.
 *
 * @param {{
 *   bundleDir: string,
 *   reviewerFamily: string,
 *   reviewerModel: string,
 *   reviewerBin?: string,
 *   factoryFamily?: string,
 *   flowFile?: string,
 * }} opts
 * @returns {Promise<{
 *   reviewerFamily: string,
 *   reviewerModel: string,
 *   factoryFamily: string,
 *   verdict: 'approve' | 'veto' | 'unknown' | 'error',
 *   reasons: string[],
 *   timestamp: string,
 *   reviewDurationSec: number,
 *   familySeparationValid: boolean,
 * }>}
 */
export async function runCrossFamilyReview({
  bundleDir,
  reviewerFamily,
  reviewerModel,
  reviewerBin = 'claude',
  factoryFamily,
  flowFile,
}) {
  const start = Date.now();

  // Try to read factory family from the report if not provided
  if (!factoryFamily) {
    const reportPath = join(bundleDir, 'report.json');
    if (existsSync(reportPath)) {
      try {
        const report = JSON.parse(await readFile(reportPath, 'utf8'));
        factoryFamily = report.factoryFamily ?? inferFamily(report.model ?? 'claude') ?? 'unknown';
      } catch {
        factoryFamily = 'unknown';
      }
    } else {
      factoryFamily = 'unknown';
    }
  }

  // Validate family separation
  const separation = validateFamilySeparation(factoryFamily, reviewerFamily);
  if (!separation.valid) {
    return {
      reviewerFamily,
      reviewerModel,
      factoryFamily,
      verdict: 'error',
      reasons: [separation.error],
      timestamp: new Date().toISOString(),
      reviewDurationSec: (Date.now() - start) / 1000,
      familySeparationValid: false,
    };
  }

  // Build and run the review
  const prompt = await buildReviewPrompt({ flowFile });
  let output = '';
  let reviewError = null;

  try {
    output = await spawnReviewer({
      bin: reviewerBin,
      model: reviewerModel,
      prompt,
      cwd: bundleDir,
      timeoutMs: 120_000,
    });
  } catch (err) {
    reviewError = err.message;
  }

  const duration = (Date.now() - start) / 1000;

  if (reviewError) {
    return {
      reviewerFamily,
      reviewerModel,
      factoryFamily,
      verdict: 'error',
      reasons: [`Review process failed: ${reviewError}`],
      timestamp: new Date().toISOString(),
      reviewDurationSec: duration,
      familySeparationValid: true,
    };
  }

  const { verdict, reasons } = parseVerdict(output);

  const result = {
    reviewerFamily,
    reviewerModel,
    factoryFamily,
    verdict,
    reasons,
    timestamp: new Date().toISOString(),
    reviewDurationSec: duration,
    familySeparationValid: true,
  };

  // Write result to bundle
  const outPath = join(bundleDir, 'cross-family-review.json');
  await writeFile(outPath, JSON.stringify(result, null, 2));

  return result;
}

/**
 * Spawn a reviewer process and capture output.
 * @param {{ bin: string, model: string, prompt: string, cwd: string, timeoutMs: number }} opts
 * @returns {Promise<string>}
 */
function spawnReviewer({ bin, model, prompt, cwd, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    // Use claude -p or codex equivalent
    const args = ['-p', '--model', model, prompt];
    const child = spawn(bin, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Reviewer timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Reviewer exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      resolvePromise(stdout);
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// CLI entrypoint
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  const flags = {};
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i].startsWith('--')) {
      const key = process.argv[i].slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = 'true';
      }
    }
  }

  if (!flags.bundle || !flags['reviewer-family'] || !flags['reviewer-model']) {
    console.error(
      'Usage: cross-family-review.mjs --bundle <dir> --reviewer-family <family> --reviewer-model <model> [--reviewer-bin <bin>] [--json]',
    );
    process.exit(2);
  }

  const result = await runCrossFamilyReview({
    bundleDir: resolve(flags.bundle),
    reviewerFamily: flags['reviewer-family'],
    reviewerModel: flags['reviewer-model'],
    reviewerBin: flags['reviewer-bin'] ?? 'claude',
    factoryFamily: flags['factory-family'],
    flowFile: flags['flow'],
  });

  if (flags.json === 'true') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log(`Cross-family review: ${result.verdict}`);
    if (result.reasons.length > 0) {
      for (const r of result.reasons) console.log(`  - ${r}`);
    }
    console.log(`Families: factory=${result.factoryFamily}, reviewer=${result.reviewerFamily}`);
    console.log(`Duration: ${result.reviewDurationSec.toFixed(1)}s`);
  }

  process.exit(result.verdict === 'error' ? 1 : 0);
}
