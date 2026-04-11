#!/usr/bin/env node
/**
 * PostToolUse hook entry point.
 *
 * After Bash/Write/Edit tool calls, reads session state and writes
 * colorized flow visualization to stderr as a persistent visual reminder
 * of the active flow step.
 *
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { extractAllCaptureTags } from '../../infrastructure/adapters/tag-capture-reader.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { renderStatusLine } from '../../domain/render-status-line.js';
import { colorizeStatusLine } from '../../domain/colorize-status-line.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import { readStdin } from './read-stdin.js';
import type { SessionState } from '../../domain/session-state.js';

// H-PERF-006: Read-only tools that don't need flow re-rendering
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch']);

// H-INT-012: Tools that trigger fast gate pre-check
const WRITE_TOOLS = new Set(['Write', 'Edit']);
const VARS_DIR = '.prompt-language/vars';
const RESPONSE_TEXT_KEY = 'response_text';

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

function collectTaggedText(
  value: unknown,
  toolOutputTexts: string[],
  responseTexts: string[],
  currentKey?: string,
): void {
  if (typeof value === 'string') {
    if (currentKey === RESPONSE_TEXT_KEY) {
      responseTexts.push(value);
      return;
    }
    toolOutputTexts.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTaggedText(entry, toolOutputTexts, responseTexts, currentKey);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectTaggedText(nested, toolOutputTexts, responseTexts, key);
    }
  }
}

function collectStderrText(value: unknown, stderrTexts: string[], currentKey?: string): void {
  if (typeof value === 'string') {
    if (currentKey === 'stderr' && value.trim() !== '') {
      stderrTexts.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStderrText(entry, stderrTexts, currentKey);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectStderrText(nested, stderrTexts, key);
    }
  }
}

function notifyStderrProgress(state: SessionState, hookPayload: unknown): void {
  const stderrTexts: string[] = [];
  collectStderrText(hookPayload, stderrTexts);
  if (stderrTexts.length === 0) return;

  const statusLine = colorizeStatusLine(renderStatusLine(state));
  process.stderr.write(`${statusLine}\n`);
}

async function persistCapturedValues(state: SessionState, hookPayload: unknown): Promise<void> {
  const toolOutputTexts: string[] = [];
  const responseTexts: string[] = [];
  collectTaggedText(hookPayload, toolOutputTexts, responseTexts);

  const capturesByVar = new Map<string, string>();
  for (const text of toolOutputTexts) {
    for (const capture of extractAllCaptureTags(text, state.captureNonce)) {
      if (!capturesByVar.has(capture.varName)) {
        capturesByVar.set(capture.varName, capture.value);
      }
    }
  }

  for (const text of responseTexts) {
    for (const capture of extractAllCaptureTags(text, state.captureNonce)) {
      if (!capturesByVar.has(capture.varName)) {
        capturesByVar.set(capture.varName, capture.value);
      }
    }
  }

  if (capturesByVar.size === 0) return;

  const varsDir = join(process.cwd(), VARS_DIR);
  await mkdir(varsDir, { recursive: true });

  for (const [varName, value] of capturesByVar) {
    const capturePath = join(varsDir, varName);
    if (existsSync(capturePath)) continue;
    await writeFile(capturePath, value, 'utf-8');
  }
}

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  const stdinData = await readStdin();

  // Parse stdin JSON once
  let toolName: string | undefined;
  let parsedHookPayload: unknown;
  if (stdinData) {
    try {
      parsedHookPayload = JSON.parse(stdinData);
      if (parsedHookPayload && typeof parsedHookPayload === 'object') {
        if ('tool_name' in parsedHookPayload) {
          toolName = (parsedHookPayload as { tool_name: string }).tool_name;
        }
      }
    } catch {
      // stdin might not be valid JSON — that's fine
    }
  }

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status === 'active') {
    if (parsedHookPayload !== undefined) {
      await persistCapturedValues(state, parsedHookPayload);
      notifyStderrProgress(state, parsedHookPayload);
    }

    // H-PERF-006: Skip render for read-only tools
    // D09-fix: Removed dead lastRenderHash (each hook is a fresh process)
    if (!toolName || !READ_ONLY_TOOLS.has(toolName)) {
      const rendered = renderFlow(state);
      process.stderr.write(`\n${colorizeFlow(rendered)}\n`);
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

withHookErrorRecovery('PostToolUse', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
