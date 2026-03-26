/**
 * Hook error handling utilities.
 *
 * Classifies errors as transient (EBUSY, EAGAIN, etc.) vs permanent and
 * provides a retry wrapper for hook operations. All errors are logged to
 * stderr with full stack traces; permanent errors are also written to the
 * audit trail when possible.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { formatError } from '../../domain/format-error.js';

/** Node.js error codes that indicate a transient, retryable condition. */
const TRANSIENT_CODES = new Set(['EBUSY', 'EAGAIN', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);

export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== undefined && TRANSIENT_CODES.has(code)) return true;
  }
  return false;
}

/**
 * Wrap a hook operation with error classification and retry.
 *
 * Use for hooks that are safe to retry (read-only / idempotent operations).
 * DO NOT use for user-prompt-submit — it has side effects on flow state.
 *
 * - Transient errors (EBUSY, EAGAIN, etc.): retried once after 100ms.
 * - Permanent errors: logged to stderr + audit trail, no retry.
 * - Always exits 0 (hooks must never crash the parent process).
 */
export async function withHookErrorRecovery(
  hookName: string,
  cwd: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (firstError: unknown) {
    if (isTransientError(firstError)) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      try {
        await fn();
        return;
      } catch (retryError: unknown) {
        await logHookError(hookName, cwd, retryError, true);
      }
    } else {
      await logHookError(hookName, cwd, firstError, false);
    }
  }
}

/**
 * Log a hook error to stderr and best-effort append to audit.jsonl.
 * Use in catch handlers where retry is not appropriate.
 */
export async function logHookError(
  hookName: string,
  cwd: string,
  error: unknown,
  wasRetried = false,
): Promise<void> {
  const suffix = wasRetried ? ' (after retry)' : '';
  process.stderr.write(`[prompt-language] ${hookName} error${suffix}: ${formatError(error)}\n`);

  // Best-effort: persist to audit log so there's a durable trace
  try {
    const auditDir = join(cwd, '.prompt-language');
    await mkdir(auditDir, { recursive: true });
    const entry = JSON.stringify({
      type: 'hook_error',
      hook: hookName,
      error: String(error instanceof Error ? error.message : error),
      wasRetried,
      timestamp: new Date().toISOString(),
    });
    await appendFile(join(auditDir, 'audit.jsonl'), entry + '\n', 'utf-8');
  } catch {
    // Audit write failure is not actionable — stderr is the last resort
  }
}
