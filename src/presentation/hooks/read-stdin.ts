/**
 * Read all of stdin as a string.
 */
const DEFAULT_STDIN_IDLE_TIMEOUT_MS = 1_000;

export function readStdin(options?: { idleTimeoutMs?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_STDIN_IDLE_TIMEOUT_MS;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf-8'));
    };

    const scheduleTimeout = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(finish, idleTimeoutMs);
    };

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      scheduleTimeout();
    };

    const onEnd = () => finish();

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);

    // Fail open when the host never closes stdin.
    scheduleTimeout();
  });
}
