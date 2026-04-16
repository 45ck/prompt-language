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

export const FAMILY_TABLE_VERSION = '1.0.0';

const UNKNOWN_FAMILY = 'unknown';
const LEGACY_FAMILY_HINTS = new Set(['open-weight']);

const FAMILY_RULES = Object.freeze([
  { id: 'anthropic', patterns: [/\bclaude\b/, /\bhaiku\b/, /\bsonnet\b/, /\bopus\b/] },
  {
    id: 'openai',
    patterns: [
      /\bgpt(?:[-.][a-z0-9]+)*\b/,
      /\bcodex\b/,
      /\bdavinci\b/,
      /\bchatgpt\b/,
      /(?:^|[/:_\s-])o(?:1|3|4(?:-mini)?)(?:$|[/:._\s-])/,
    ],
  },
  { id: 'google', patterns: [/\bgemini\b/, /\bpalm\b/, /\bbard\b/] },
  {
    id: 'meta-llama',
    patterns: [/\bmeta-llama\b/, /\bcodellama\b/, /\bcode-llama\b/, /\bllama(?:[-._]?\d|\b)/],
  },
  { id: 'qwen', patterns: [/\bqwen(?:[-._]?\d|\b)/] },
  { id: 'deepseek', patterns: [/\bdeepseek\b/] },
  { id: 'mistral', patterns: [/\bmistral\b/, /\bmixtral\b/, /\bcodestral\b/] },
  { id: 'gemma', patterns: [/\bgemma(?:[-._]?\d|\b)/] },
  { id: 'xai', patterns: [/\bgrok(?:[-._]?\d|\b)/, /\bxai\b/] },
]);

export const KNOWN_FAMILIES = Object.freeze(FAMILY_RULES.map((rule) => rule.id));

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function strictFamilyId(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (KNOWN_FAMILIES.includes(normalized)) return normalized;
  if (normalized === UNKNOWN_FAMILY) return UNKNOWN_FAMILY;
  return UNKNOWN_FAMILY;
}

function familyHint(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (LEGACY_FAMILY_HINTS.has(normalized)) return null;
  return strictFamilyId(normalized);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Infer family from a model name string.
 * @param {string} model
 * @returns {string}
 */
export function inferFamily(model) {
  const normalized = normalizeText(model);
  if (!normalized) return UNKNOWN_FAMILY;

  const explicitFamily = strictFamilyId(normalized);
  if (explicitFamily && explicitFamily !== UNKNOWN_FAMILY) return explicitFamily;

  for (const { id, patterns } of FAMILY_RULES) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return id;
    }
  }
  return UNKNOWN_FAMILY;
}

function resolveRoleFamily({ role, declaredFamily, model }) {
  const declaredHint = familyHint(declaredFamily);
  const inferredFamily = inferFamily(model);
  const modelLabel = typeof model === 'string' && model.trim() ? model.trim() : null;

  if (declaredFamily && declaredHint === UNKNOWN_FAMILY) {
    return {
      family: UNKNOWN_FAMILY,
      inferredFamily,
      error: `Unknown ${role} family '${declaredFamily}'. Classify the ${role} model before cross-family review.`,
    };
  }

  if (
    declaredHint &&
    declaredHint !== UNKNOWN_FAMILY &&
    inferredFamily !== UNKNOWN_FAMILY &&
    declaredHint !== inferredFamily
  ) {
    return {
      family: UNKNOWN_FAMILY,
      inferredFamily,
      error: `${role} family mismatch: declared ${declaredHint}, inferred ${inferredFamily} from model '${modelLabel}'.`,
    };
  }

  const resolvedFamily =
    declaredHint && declaredHint !== UNKNOWN_FAMILY ? declaredHint : inferredFamily;

  if (!resolvedFamily || resolvedFamily === UNKNOWN_FAMILY) {
    return {
      family: UNKNOWN_FAMILY,
      inferredFamily,
      error: `Missing or unknown ${role} family. Provide a classified ${role} family or a recognizable ${role} model.`,
    };
  }

  return {
    family: resolvedFamily,
    inferredFamily,
    error: null,
  };
}

/**
 * Validate that factory and reviewer families are both known and differ.
 * @param {string} factoryFamily
 * @param {string} reviewerFamily
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFamilySeparation(factoryFamily, reviewerFamily) {
  const normalizedFactory = strictFamilyId(factoryFamily);
  const normalizedReviewer = strictFamilyId(reviewerFamily);

  if (!normalizedFactory || !normalizedReviewer) {
    return { valid: false, error: 'Both factoryFamily and reviewerFamily must be specified.' };
  }
  if (normalizedFactory === UNKNOWN_FAMILY || normalizedReviewer === UNKNOWN_FAMILY) {
    return {
      valid: false,
      error: `Cross-family review requires known families. factory=${normalizedFactory}, reviewer=${normalizedReviewer}.`,
    };
  }
  if (normalizedFactory === normalizedReviewer) {
    return {
      valid: false,
      error: `Family separation violated: factory=${normalizedFactory}, reviewer=${normalizedReviewer}. Cross-family review requires different families.`,
    };
  }
  return { valid: true };
}

async function readFactoryMetadata(bundleDir) {
  const reportPath = join(bundleDir, 'report.json');
  if (!existsSync(reportPath)) {
    return { model: null, modelVersion: null, family: null, source: 'missing-report' };
  }

  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    return {
      model: firstString(
        report?.factory?.model,
        report?.factoryModel,
        report?.model,
        report?.live?.factoryModel,
      ),
      modelVersion: firstString(
        report?.factory?.modelVersion,
        report?.factoryModelVersion,
        report?.modelVersion,
      ),
      family: firstString(
        report?.factory?.family,
        report?.factoryFamily,
        report?.live?.factoryFamily,
      ),
      source: 'report.json',
    };
  } catch {
    return { model: null, modelVersion: null, family: null, source: 'invalid-report' };
  }
}

async function resolveParticipants({ bundleDir, reviewerFamily, reviewerModel, factoryFamily }) {
  const factoryMeta = await readFactoryMetadata(bundleDir);
  const resolvedFactory = resolveRoleFamily({
    role: 'factory',
    declaredFamily: factoryFamily ?? factoryMeta.family,
    model: factoryMeta.model,
  });
  const resolvedReviewer = resolveRoleFamily({
    role: 'reviewer',
    declaredFamily: reviewerFamily,
    model: reviewerModel,
  });

  return {
    factory: {
      family: resolvedFactory.family,
      inferredFamily: resolvedFactory.inferredFamily,
      familySource: factoryFamily ? 'explicit' : factoryMeta.source,
      familyError: resolvedFactory.error,
      model: factoryMeta.model,
      modelVersion: factoryMeta.modelVersion,
    },
    reviewer: {
      family: resolvedReviewer.family,
      inferredFamily: resolvedReviewer.inferredFamily,
      familySource: reviewerFamily ? 'explicit' : 'inferred',
      familyError: resolvedReviewer.error,
      model: reviewerModel,
      modelVersion: null,
    },
  };
}

/**
 * Build the review prompt for the cross-family reviewer.
 * @param {{ flowFile?: string }} opts
 * @returns {Promise<string>}
 */
async function buildReviewPrompt({ flowFile }) {
  const parts = [
    'You are a code reviewer evaluating the output of an automated code generation system.',
    'Your review must be honest and thorough. You are not affiliated with the system that produced this code.',
    '',
    '## Review Criteria',
    '',
    '1. Correctness: Does the code compile and run without obvious errors?',
    '2. Spec conformance: Does it implement what was specified?',
    '3. Security: Are there obvious vulnerabilities (injection, hardcoded secrets, etc.)?',
    '4. Completeness: Are all expected files present?',
    '5. Quality: Is the code well-structured, readable, and maintainable?',
    '',
    '## Instructions',
    '',
    'Examine the workspace files in this directory.',
    'Run any test commands you find (npm test, pytest, etc.).',
    'Prefer returning a single JSON object with:',
    '{ "schemaVersion": "1.0.0", "verdict": "pass|partial|fail", "rationale": "...", "risks": [], "reviewerModel": "...", "reviewerFamily": "..." }',
    'Legacy fallback is accepted only if the last line is:',
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
 * @returns {{
 *   verdict: 'approve' | 'partial' | 'veto' | 'unknown',
 *   reviewVerdict: 'pass' | 'partial' | 'fail' | 'unknown',
 *   reasons: string[],
 *   format: 'json' | 'legacy' | 'none',
 * }}
 */
export function parseVerdict(output) {
  const trimmed = typeof output === 'string' ? output.trim() : '';
  if (!trimmed) {
    return {
      verdict: 'unknown',
      reviewVerdict: 'unknown',
      reasons: ['No reviewer output captured'],
      format: 'none',
    };
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const reviewVerdict = normalizeText(parsed?.verdict);
      if (reviewVerdict === 'pass') {
        return { verdict: 'approve', reviewVerdict: 'pass', reasons: [], format: 'json' };
      }
      if (reviewVerdict === 'partial') {
        return {
          verdict: 'partial',
          reviewVerdict: 'partial',
          reasons: Array.isArray(parsed?.risks)
            ? parsed.risks
                .map((risk) => (typeof risk?.summary === 'string' ? risk.summary.trim() : ''))
                .filter(Boolean)
            : [],
          format: 'json',
        };
      }
      if (reviewVerdict === 'fail') {
        const reasons = Array.isArray(parsed?.risks)
          ? parsed.risks
              .map((risk) => (typeof risk?.summary === 'string' ? risk.summary.trim() : ''))
              .filter(Boolean)
          : [];
        if (
          reasons.length === 0 &&
          typeof parsed?.rationale === 'string' &&
          parsed.rationale.trim()
        ) {
          reasons.push(parsed.rationale.trim());
        }
        return {
          verdict: 'veto',
          reviewVerdict: 'fail',
          reasons,
          format: 'json',
        };
      }
    } catch {
      /* fall through to legacy parsing */
    }
  }

  const lines = trimmed.split('\n').reverse();
  for (const line of lines) {
    const candidate = line.trim();
    if (/^VERDICT:\s*APPROVE$/i.test(candidate)) {
      return { verdict: 'approve', reviewVerdict: 'pass', reasons: [], format: 'legacy' };
    }
    if (/^VERDICT:\s*PARTIAL(?:\s+(.+))?$/i.test(candidate)) {
      const match = /^VERDICT:\s*PARTIAL(?:\s+(.+))?$/i.exec(candidate);
      const reasons = (match?.[1] ?? '')
        .split(';')
        .map((reason) => reason.trim())
        .filter(Boolean);
      return {
        verdict: 'partial',
        reviewVerdict: 'partial',
        reasons,
        format: 'legacy',
      };
    }
    const vetoMatch = /^VERDICT:\s*VETO(?:\s+(.+))?$/i.exec(candidate);
    if (vetoMatch) {
      return {
        verdict: 'veto',
        reviewVerdict: 'fail',
        reasons: (vetoMatch[1] ?? '')
          .split(';')
          .map((reason) => reason.trim())
          .filter(Boolean),
        format: 'legacy',
      };
    }
  }

  return {
    verdict: 'unknown',
    reviewVerdict: 'unknown',
    reasons: ['No reviewer verdict found in output'],
    format: 'none',
  };
}

async function persistResult(bundleDir, result) {
  const outPath = join(bundleDir, 'cross-family-review.json');
  await writeFile(outPath, JSON.stringify(result, null, 2));
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
 *   spawnReview?: (opts: { bin: string, model: string, prompt: string, cwd: string, timeoutMs: number }) => Promise<string>,
 * }} opts
 * @returns {Promise<{
 *   reviewerFamily: string,
 *   reviewerModel: string,
 *   factoryFamily: string,
 *   verdict: 'approve' | 'partial' | 'veto' | 'unknown' | 'error',
 *   reviewVerdict: 'pass' | 'partial' | 'fail' | 'unknown' | 'error',
 *   reasons: string[],
 *   timestamp: string,
 *   reviewDurationSec: number,
 *   familySeparationValid: boolean,
 *   rulePassed: boolean,
 *   familyTableVersion: string,
 *   reviewer: { family: string, inferredFamily: string, familySource: string, familyError: string | null, model: string, modelVersion: string | null },
 *   factory: { family: string, inferredFamily: string, familySource: string, familyError: string | null, model: string | null, modelVersion: string | null },
 *   reviewFormat?: 'json' | 'legacy' | 'none',
 * }>}
 */
export async function runCrossFamilyReview({
  bundleDir,
  reviewerFamily,
  reviewerModel,
  reviewerBin = 'claude',
  factoryFamily,
  flowFile,
  spawnReview = spawnReviewer,
}) {
  const start = Date.now();
  const participants = await resolveParticipants({
    bundleDir,
    reviewerFamily,
    reviewerModel,
    factoryFamily,
  });
  const timestamp = new Date().toISOString();

  const familyErrors = [participants.factory.familyError, participants.reviewer.familyError].filter(
    Boolean,
  );
  const separation = validateFamilySeparation(
    participants.factory.family,
    participants.reviewer.family,
  );

  if (familyErrors.length > 0 || !separation.valid) {
    const result = {
      reviewerFamily: participants.reviewer.family,
      reviewerModel,
      factoryFamily: participants.factory.family,
      verdict: 'error',
      reviewVerdict: 'error',
      reasons: [...familyErrors, ...(separation.error ? [separation.error] : [])],
      timestamp,
      reviewDurationSec: (Date.now() - start) / 1000,
      familySeparationValid: false,
      rulePassed: false,
      familyTableVersion: FAMILY_TABLE_VERSION,
      reviewer: participants.reviewer,
      factory: participants.factory,
    };
    await persistResult(bundleDir, result);
    return result;
  }

  const prompt = await buildReviewPrompt({ flowFile });
  let output = '';
  let reviewError = null;

  try {
    output = await spawnReview({
      bin: reviewerBin,
      model: reviewerModel,
      prompt,
      cwd: bundleDir,
      timeoutMs: 120_000,
    });
  } catch (err) {
    reviewError = err instanceof Error ? err.message : String(err);
  }

  const duration = (Date.now() - start) / 1000;

  if (reviewError) {
    const result = {
      reviewerFamily: participants.reviewer.family,
      reviewerModel,
      factoryFamily: participants.factory.family,
      verdict: 'error',
      reviewVerdict: 'error',
      reasons: [`Review process failed: ${reviewError}`],
      timestamp,
      reviewDurationSec: duration,
      familySeparationValid: true,
      rulePassed: true,
      familyTableVersion: FAMILY_TABLE_VERSION,
      reviewer: participants.reviewer,
      factory: participants.factory,
    };
    await persistResult(bundleDir, result);
    return result;
  }

  const parsed = parseVerdict(output);
  const result = {
    reviewerFamily: participants.reviewer.family,
    reviewerModel,
    factoryFamily: participants.factory.family,
    verdict: parsed.verdict,
    reviewVerdict: parsed.reviewVerdict,
    reasons: parsed.reasons,
    timestamp,
    reviewDurationSec: duration,
    familySeparationValid: true,
    rulePassed: true,
    familyTableVersion: FAMILY_TABLE_VERSION,
    reviewFormat: parsed.format,
    reviewer: participants.reviewer,
    factory: participants.factory,
  };

  await persistResult(bundleDir, result);
  return result;
}

/**
 * Spawn a reviewer process and capture output.
 * @param {{ bin: string, model: string, prompt: string, cwd: string, timeoutMs: number }} opts
 * @returns {Promise<string>}
 */
function spawnReviewer({ bin, model, prompt, cwd, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    const args = ['-p', '--model', model, prompt];
    const child = spawn(bin, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

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
    flowFile: flags.flow,
  });

  if (flags.json === 'true') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log(`Cross-family review: ${result.verdict}`);
    console.log(`Rule passed: ${result.rulePassed ? 'yes' : 'no'}`);
    if (result.reasons.length > 0) {
      for (const reason of result.reasons) console.log(`  - ${reason}`);
    }
    console.log(`Families: factory=${result.factoryFamily}, reviewer=${result.reviewerFamily}`);
    console.log(`Duration: ${result.reviewDurationSec.toFixed(1)}s`);
  }

  process.exit(result.verdict === 'error' ? 1 : 0);
}
