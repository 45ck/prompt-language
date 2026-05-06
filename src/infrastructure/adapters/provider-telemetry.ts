import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const PROVIDER_TELEMETRY_PATH = '.prompt-language/provider-telemetry.jsonl';

export interface TokenUsageTelemetry {
  readonly inputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  readonly totalTokens?: number | undefined;
}

export interface DurationTelemetry {
  readonly totalMs?: number | undefined;
  readonly loadMs?: number | undefined;
  readonly promptEvalMs?: number | undefined;
  readonly evalMs?: number | undefined;
}

export interface ProviderTelemetryRecord {
  readonly timestamp: string;
  readonly provider: string;
  readonly requestedModel?: string | undefined;
  readonly actualModel?: string | undefined;
  readonly tokenUsage?: TokenUsageTelemetry | undefined;
  readonly duration?: DurationTelemetry | undefined;
  readonly retryCount?: number | undefined;
  readonly estimatedCostUsd?: number | null | undefined;
}

export interface ProviderTelemetrySummary {
  readonly records: number;
  readonly providers: readonly string[];
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly estimatedCostUsd: number | null;
  readonly retryCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function nanosToMs(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value / 1_000_000;
}

function cleanUndefined<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function normalizeOllamaTelemetry(payload: unknown): {
  readonly tokenUsage?: TokenUsageTelemetry | undefined;
  readonly duration?: DurationTelemetry | undefined;
} {
  if (!isRecord(payload)) return {};

  const inputTokens = readNonNegativeNumber(payload['prompt_eval_count']);
  const outputTokens = readNonNegativeNumber(payload['eval_count']);
  const tokenUsage = cleanUndefined({
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens === undefined && outputTokens === undefined
        ? undefined
        : (inputTokens ?? 0) + (outputTokens ?? 0),
  });

  const duration = cleanUndefined({
    totalMs: nanosToMs(readNonNegativeNumber(payload['total_duration'])),
    loadMs: nanosToMs(readNonNegativeNumber(payload['load_duration'])),
    promptEvalMs: nanosToMs(readNonNegativeNumber(payload['prompt_eval_duration'])),
    evalMs: nanosToMs(readNonNegativeNumber(payload['eval_duration'])),
  });

  return {
    ...(Object.keys(tokenUsage).length > 0 ? { tokenUsage } : {}),
    ...(Object.keys(duration).length > 0 ? { duration } : {}),
  };
}

export async function appendProviderTelemetry(
  cwd: string,
  record: ProviderTelemetryRecord,
): Promise<void> {
  const path = join(cwd, PROVIDER_TELEMETRY_PATH);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

export function parseProviderTelemetryJsonl(text: string): ProviderTelemetryRecord[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed: unknown = JSON.parse(line);
        return isRecord(parsed) && typeof parsed['provider'] === 'string'
          ? (parsed as unknown as ProviderTelemetryRecord)
          : null;
      } catch {
        return null;
      }
    })
    .filter((record): record is ProviderTelemetryRecord => record !== null);
}

export async function readProviderTelemetry(cwd: string): Promise<ProviderTelemetryRecord[]> {
  try {
    return parseProviderTelemetryJsonl(await readFile(join(cwd, PROVIDER_TELEMETRY_PATH), 'utf8'));
  } catch {
    return [];
  }
}

export function summarizeProviderTelemetry(
  records: readonly ProviderTelemetryRecord[],
): ProviderTelemetrySummary {
  const providers = [...new Set(records.map((record) => record.provider))].sort();
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let sawTokens = false;
  let estimatedCostUsd = 0;
  let sawCost = false;
  let retryCount = 0;

  for (const record of records) {
    const usage = record.tokenUsage;
    if (usage?.inputTokens !== undefined) {
      sawTokens = true;
      inputTokens += usage.inputTokens;
    }
    if (usage?.outputTokens !== undefined) {
      sawTokens = true;
      outputTokens += usage.outputTokens;
    }
    if (usage?.totalTokens !== undefined) {
      sawTokens = true;
      totalTokens += usage.totalTokens;
    }
    if (record.estimatedCostUsd !== undefined && record.estimatedCostUsd !== null) {
      sawCost = true;
      estimatedCostUsd += record.estimatedCostUsd;
    }
    retryCount += record.retryCount ?? 0;
  }

  return {
    records: records.length,
    providers,
    inputTokens: sawTokens ? inputTokens : null,
    outputTokens: sawTokens ? outputTokens : null,
    totalTokens: sawTokens ? totalTokens : null,
    estimatedCostUsd: sawCost ? estimatedCostUsd : null,
    retryCount,
  };
}
