#!/usr/bin/env node
/**
 * SubagentStop hook entry point.
 *
 * Mirrors Stop behavior for Claude subagents so child sessions keep the same
 * stop blocking and terminal cleanup semantics as top-level runs.
 */

import { withHookErrorRecovery } from './hook-error-handler.js';
import { runStopHook } from './stop-hook-main.js';

withHookErrorRecovery('SubagentStop', process.cwd(), runStopHook).catch(() => {
  process.exitCode = 0;
});
