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
import { join } from 'node:path';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { formatError } from '../../domain/format-error.js';
import { CAPTURE_TAG } from '../../domain/capture-prompt.js';
import { readStdin } from './read-stdin.js';

const VARS_DIR = '.prompt-language/vars';
const SAFE_VAR_NAME = /^\w+$/;

/** Scan text for capture tags and write extracted values to var files. */
async function scanAndSaveCapturedVars(text: string, basePath: string): Promise<void> {
  const tagPattern = new RegExp(
    `<${CAPTURE_TAG} name="([^"]+)">([\\s\\S]*?)</${CAPTURE_TAG}>`,
    'g',
  );

  const matches: { varName: string; value: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(text)) !== null) {
    const varName = match[1]!;
    if (!SAFE_VAR_NAME.test(varName)) continue; // D1: reject path-traversal names
    const value = match[2]!.trim();
    if (value) {
      matches.push({ varName, value });
    }
  }

  if (matches.length === 0) return;

  const varsDir = join(basePath, VARS_DIR);
  await mkdir(varsDir, { recursive: true });

  for (const { varName, value } of matches) {
    await writeFile(join(varsDir, varName), value, 'utf-8');
  }
}

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  const stdinData = await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status === 'active') {
    const rendered = renderFlow(state);
    process.stderr.write(`\n${colorizeFlow(rendered)}\n`);

    // Scan tool output for capture tags
    if (stdinData) {
      try {
        const parsed: unknown = JSON.parse(stdinData);
        if (parsed && typeof parsed === 'object' && 'tool_output' in parsed) {
          const output = (parsed as { tool_output: string }).tool_output;
          if (typeof output === 'string') {
            try {
              await scanAndSaveCapturedVars(output, process.cwd());
            } catch (captureErr: unknown) {
              process.stderr.write(
                `[prompt-language] capture write error: ${formatError(captureErr)}\n`,
              );
            }
          }
        }
      } catch {
        // stdin might not be JSON or might not have tool_output — that's fine
      }
    }
  }

  process.exitCode = 0;
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
