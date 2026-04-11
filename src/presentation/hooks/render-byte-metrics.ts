const ENABLE_RENDER_BYTE_METRICS_ENV = 'PROMPT_LANGUAGE_RENDER_BYTE_METRICS';

export interface RenderByteMetricInput {
  readonly hook: 'session-start' | 'pre-compact' | 'post-tool-use';
  readonly channel: 'additionalContext' | 'stderr';
  readonly stableParts: readonly string[];
  readonly dynamicParts: readonly string[];
}

export function isRenderByteMetricsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ENABLE_RENDER_BYTE_METRICS_ENV] === '1';
}

export function formatRenderByteMetrics(input: RenderByteMetricInput): string {
  const stableBytes = sumUtf8Bytes(input.stableParts);
  const dynamicBytes = sumUtf8Bytes(input.dynamicParts);
  const totalBytes = stableBytes + dynamicBytes;

  return (
    `[prompt-language] render-bytes ` +
    `hook=${input.hook} ` +
    `channel=${input.channel} ` +
    `stable_bytes=${stableBytes} ` +
    `dynamic_bytes=${dynamicBytes} ` +
    `total_bytes=${totalBytes}`
  );
}

function sumUtf8Bytes(parts: readonly string[]): number {
  let total = 0;
  for (const part of parts) {
    total += Buffer.byteLength(part, 'utf8');
  }
  return total;
}

export { ENABLE_RENDER_BYTE_METRICS_ENV };
