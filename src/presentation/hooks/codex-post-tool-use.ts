#!/usr/bin/env node
/**
 * Codex PostToolUse hook entry point.
 *
 * Codex currently emits Bash-only tool hooks, so this hook mirrors the
 * Claude flow-render behavior for command execution events.
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { renderStatusLine } from '../../domain/render-status-line.js';
import { colorizeStatusLine } from '../../domain/colorize-status-line.js';
import { resolveFileExistsPredicatePath } from '../../application/evaluate-completion.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import { readStdin } from './read-stdin.js';
import type { SessionState } from '../../domain/session-state.js';

const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch']);
const WRITE_TOOLS = new Set(['Write', 'Edit']);

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

function evaluateFastGates(state: SessionState): void {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return;

  const results: string[] = [];
  for (const gate of gates) {
    const path = resolveFileExistsPredicatePath(gate.predicate);
    if (path) {
      const passed = existsSync(path);
      results.push(`Gate progress: ${gate.predicate} [${passed ? 'PASS' : 'FAIL'}]`);
    } else if (gate.predicate === 'diff_nonempty') {
      try {
        execSync('git diff --quiet', { stdio: 'pipe' });
        results.push('Gate progress: diff_nonempty [FAIL]');
      } catch {
        results.push('Gate progress: diff_nonempty [PASS]');
      }
    }
  }

  if (results.length > 0) {
    process.stderr.write(results.join('\n') + '\n');
  }
}

async function main(): Promise<void> {
  const stdinData = await readStdin();

  let toolName: string | undefined;
  if (stdinData) {
    try {
      const parsed: unknown = JSON.parse(stdinData);
      if (parsed && typeof parsed === 'object' && 'tool_name' in parsed) {
        toolName = (parsed as { tool_name: string }).tool_name;
      }
    } catch {
      // stdin might not be valid JSON — that's fine
    }
  }

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status === 'active') {
    if (stdinData) {
      try {
        notifyStderrProgress(state, JSON.parse(stdinData) as unknown);
      } catch {
        // stdin might not be valid JSON — that's fine
      }
    }

    if (!toolName || !READ_ONLY_TOOLS.has(toolName)) {
      const rendered = renderFlow(state);
      process.stderr.write(`\n${colorizeFlow(rendered)}\n`);
    }

    if (toolName && WRITE_TOOLS.has(toolName)) {
      try {
        evaluateFastGates(state);
      } catch {
        // best effort only
      }
    }
  }

  process.exitCode = 0;
}

withHookErrorRecovery('Codex PostToolUse', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
