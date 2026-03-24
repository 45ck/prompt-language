#!/usr/bin/env node
/**
 * PostToolUse hook entry point.
 *
 * After Bash/Write/Edit tool calls, reads session state and writes
 * colorized flow visualization to stderr as a persistent visual reminder
 * of the active flow step.
 *
 * Also scans tool output for capture tags and writes extracted values
 * to the capture vars directory for tag-based variable capture.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow, renderStateHash } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { formatError } from '../../domain/format-error.js';
import { CAPTURE_VARS_DIR } from '../../domain/capture-prompt.js';
import { extractAllCaptureTags } from '../../infrastructure/adapters/tag-capture-reader.js';
import { readStdin } from './read-stdin.js';
import type { SessionState } from '../../domain/session-state.js';

/** Scan text for capture tags and write extracted values to var files. */
async function scanAndSaveCapturedVars(
  text: string,
  basePath: string,
  nonce?: string,
): Promise<void> {
  const matches = extractAllCaptureTags(text, nonce);
  if (matches.length === 0) return;

  const varsDir = join(basePath, CAPTURE_VARS_DIR);
  await mkdir(varsDir, { recursive: true });

  for (const { varName, value } of matches) {
    await writeFile(join(varsDir, varName), value, 'utf-8');
  }
}

// H-PERF-006: Read-only tools that don't need flow re-rendering
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch']);

// H-PERF-001: Track last rendered hash to skip unchanged renders
let lastRenderHash: string | undefined;

// H-INT-012: Tools that trigger fast gate pre-check
const WRITE_TOOLS = new Set(['Write', 'Edit']);

/**
 * H-INT-012: Evaluate fast gates (file_exists, diff_nonempty) after Write/Edit.
 * These are cheap filesystem checks that give early progress feedback.
 */
function evaluateFastGates(state: SessionState): void {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return;

  const results: string[] = [];
  for (const gate of gates) {
    if (gate.predicate.startsWith('file_exists ')) {
      const path = gate.predicate.slice('file_exists '.length).trim();
      const passed = existsSync(path);
      results.push(`Gate progress: ${gate.predicate} [${passed ? 'PASS' : 'FAIL'}]`);
    } else if (gate.predicate === 'diff_nonempty') {
      try {
        execSync('git diff --quiet', { stdio: 'pipe' });
        // Exit 0 means no diff — inverted predicate: diff_nonempty FAILS
        results.push(`Gate progress: diff_nonempty [FAIL]`);
      } catch {
        // Exit non-zero means there is a diff — diff_nonempty PASSES
        results.push(`Gate progress: diff_nonempty [PASS]`);
      }
    }
  }

  if (results.length > 0) {
    process.stderr.write(results.join('\n') + '\n');
  }
}

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  const stdinData = await readStdin();

  // Parse stdin JSON once
  let toolName: string | undefined;
  let toolOutput: string | undefined;
  if (stdinData) {
    try {
      const parsed: unknown = JSON.parse(stdinData);
      if (parsed && typeof parsed === 'object') {
        if ('tool_name' in parsed) {
          toolName = (parsed as { tool_name: string }).tool_name;
        }
        if ('tool_output' in parsed) {
          const output = (parsed as { tool_output: unknown }).tool_output;
          if (typeof output === 'string') {
            toolOutput = output;
          }
        }
      }
    } catch {
      // stdin might not be valid JSON — that's fine
    }
  }

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status === 'active') {
    // H-PERF-006: Skip render for read-only tools
    // H-PERF-001: Skip render if state hash unchanged since last render
    if (!toolName || !READ_ONLY_TOOLS.has(toolName)) {
      const hash = renderStateHash(state);
      if (hash !== lastRenderHash) {
        lastRenderHash = hash;
        const rendered = renderFlow(state);
        process.stderr.write(`\n${colorizeFlow(rendered)}\n`);
      }
    }

    // Scan tool output for capture tags
    if (toolOutput) {
      try {
        await scanAndSaveCapturedVars(toolOutput, process.cwd(), state.captureNonce);
      } catch (captureErr: unknown) {
        process.stderr.write(`[prompt-language] capture write error: ${formatError(captureErr)}\n`);
      }
    }

    // H-INT-012: Fast gate pre-check after Write/Edit tools
    if (toolName && WRITE_TOOLS.has(toolName)) {
      try {
        evaluateFastGates(state);
      } catch {
        // Fast gate check is best-effort — don't fail the hook
      }
    }
  }

  process.exitCode = 0;
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
