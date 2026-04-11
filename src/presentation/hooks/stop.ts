#!/usr/bin/env node
/**
 * Stop hook entry point.
 *
 * If a flow is active and incomplete, blocks the stop (exit 2).
 * Otherwise exits 0.
 */

import { withHookErrorRecovery } from './hook-error-handler.js';
import { runStopHook } from './stop-hook-main.js';

withHookErrorRecovery('Stop', process.cwd(), runStopHook).catch(() => {
  process.exitCode = 0;
});
