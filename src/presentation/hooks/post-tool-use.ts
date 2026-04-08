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
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import { readStdin } from './read-stdin.js';
import type { SessionState } from '../../domain/session-state.js';

// H-PERF-006: Read-only tools that don't need flow re-rendering
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch']);

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
  if (stdinData) {
    try {
      const parsed: unknown = JSON.parse(stdinData);
      if (parsed && typeof parsed === 'object') {
        if ('tool_name' in parsed) {
          toolName = (parsed as { tool_name: string }).tool_name;
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
