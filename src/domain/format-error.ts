/**
 * formatError — Safely extract a human-readable error message with stack trace.
 *
 * Handles Error instances (with stack), strings, and arbitrary throwables.
 */

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}
