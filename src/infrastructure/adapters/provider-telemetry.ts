import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type {
  PromptTurnDurationTelemetry,
  PromptTurnProviderTelemetry,
  PromptTurnTokenUsageTelemetry,
} from '../../application/ports/prompt-turn-runner.js';

export const PROVIDER_TELEMETRY_PATH = '.prompt-language/provider-telemetry.jsonl';

export type TokenUsageTelemetry = PromptTurnTokenUsageTelemetry;

export type DurationTelemetry = PromptTurnDurationTelemetry;

export interface ProviderTelemetryRecord extends PromptTurnProviderTelemetry {
  readonly timestamp: string;
}

export interface ProviderTelemetrySummary {
  readonly records: number;
  readonly providers: readonly string[];
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
  readonly reasoningOutputTokens: number | null;
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

function readNestedRecord(
  record: Record<string, unknown>,
  path: readonly string[],
): Record<string, unknown> | undefined {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return isRecord(current) ? current : undefined;
}

function readCodexEvent(record: Record<string, unknown>): Record<string, unknown> | undefined {
  if (record['type'] === 'event_msg' && isRecord(record['msg'])) return record['msg'];
  if (record['event'] === 'event_msg' && isRecord(record['msg'])) return record['msg'];
  if (typeof record['type'] === 'string') return record;
  return undefined;
}

function normalizeCodexUsage(usage: Record<string, unknown> | undefined): TokenUsageTelemetry {
  if (usage === undefined) return {};
  const inputTokens = readNonNegativeNumber(usage['input_tokens']);
  const outputTokens = readNonNegativeNumber(usage['output_tokens']);
  return cleanUndefined({
    inputTokens,
    outputTokens,
    totalTokens:
      readNonNegativeNumber(usage['total_tokens']) ??
      (inputTokens === undefined && outputTokens === undefined
        ? undefined
        : (inputTokens ?? 0) + (outputTokens ?? 0)),
    cacheReadInputTokens: readNonNegativeNumber(usage['cached_input_tokens']),
    reasoningOutputTokens: readNonNegativeNumber(usage['reasoning_output_tokens']),
  });
}

export function normalizeCodexTelemetryFromJsonl(text: string): {
  readonly tokenUsage?: TokenUsageTelemetry | undefined;
  readonly duration?: DurationTelemetry | undefined;
  readonly metadata?: Record<string, string | number | boolean | null> | undefined;
} {
  let tokenUsage: TokenUsageTelemetry = {};
  let duration: DurationTelemetry = {};
  let sawTokenEvent = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const event = readCodexEvent(parsed);
    if (event === undefined) continue;

    if (event['type'] === 'turn.completed') {
      const usage = isRecord(event['usage']) ? event['usage'] : undefined;
      tokenUsage = normalizeCodexUsage(usage);
      sawTokenEvent = Object.keys(tokenUsage).length > 0;
    }

    if (event['type'] === 'token_count') {
      const lastUsage = readNestedRecord(event, ['payload', 'info', 'last_token_usage']);
      const totalUsage = readNestedRecord(event, ['payload', 'info', 'total_token_usage']);
      tokenUsage = normalizeCodexUsage(lastUsage ?? totalUsage);
      sawTokenEvent = Object.keys(tokenUsage).length > 0;
    }

    if (event['type'] === 'task_complete') {
      const payload = isRecord(event['payload']) ? event['payload'] : undefined;
      if (payload !== undefined) {
        duration = cleanUndefined({
          ...duration,
          totalMs: readNonNegativeNumber(payload['duration_ms']),
          firstTokenMs: readNonNegativeNumber(payload['time_to_first_token_ms']),
        });
      }
    }
  }

  return {
    ...(sawTokenEvent ? { tokenUsage } : {}),
    ...(Object.keys(duration).length > 0 ? { duration } : {}),
  };
}

export function normalizeClaudeJsonTelemetry(payload: unknown): {
  readonly actualModel?: string | undefined;
  readonly tokenUsage?: TokenUsageTelemetry | undefined;
  readonly duration?: DurationTelemetry | undefined;
  readonly estimatedCostUsd?: number | null | undefined;
  readonly metadata?: Record<string, string | number | boolean | null> | undefined;
} {
  if (!isRecord(payload)) return {};
  const usage = isRecord(payload['usage'])
    ? payload['usage']
    : readNestedRecord(payload, ['message', 'usage']);
  const inputTokens = readNonNegativeNumber(usage?.['input_tokens']);
  const outputTokens = readNonNegativeNumber(usage?.['output_tokens']);
  const tokenUsage = cleanUndefined({
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens === undefined && outputTokens === undefined
        ? undefined
        : (inputTokens ?? 0) + (outputTokens ?? 0),
    cacheReadInputTokens: readNonNegativeNumber(usage?.['cache_read_input_tokens']),
    cacheCreationInputTokens: readNonNegativeNumber(usage?.['cache_creation_input_tokens']),
  });
  const duration = cleanUndefined({
    totalMs: readNonNegativeNumber(payload['duration_ms']),
  });
  const sessionId = typeof payload['session_id'] === 'string' ? payload['session_id'] : undefined;
  const requestId = typeof payload['request_id'] === 'string' ? payload['request_id'] : undefined;
  const model =
    typeof payload['model'] === 'string'
      ? payload['model']
      : isRecord(payload['message']) && typeof payload['message']['model'] === 'string'
        ? payload['message']['model']
        : undefined;
  const estimatedCostUsd = readNonNegativeNumber(payload['total_cost_usd']);

  return {
    ...(model !== undefined ? { actualModel: model } : {}),
    ...(Object.keys(tokenUsage).length > 0 ? { tokenUsage } : {}),
    ...(Object.keys(duration).length > 0 ? { duration } : {}),
    estimatedCostUsd: estimatedCostUsd ?? null,
    ...(sessionId !== undefined || requestId !== undefined
      ? {
          metadata: {
            ...(sessionId !== undefined ? { sessionId } : {}),
            ...(requestId !== undefined ? { requestId } : {}),
          },
        }
      : {}),
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

export async function appendProviderTelemetryBestEffort(
  cwd: string,
  record: ProviderTelemetryRecord,
): Promise<void> {
  try {
    await appendProviderTelemetry(cwd, record);
  } catch {
    // Telemetry is evidence, not control flow. Provider turns must not fail
    // because the sidecar artifact could not be written.
  }
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
  let cacheReadInputTokens = 0;
  let sawCacheReadInputTokens = false;
  let cacheCreationInputTokens = 0;
  let sawCacheCreationInputTokens = false;
  let reasoningOutputTokens = 0;
  let sawReasoningOutputTokens = false;
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
    if (usage?.cacheReadInputTokens !== undefined) {
      sawCacheReadInputTokens = true;
      cacheReadInputTokens += usage.cacheReadInputTokens;
    }
    if (usage?.cacheCreationInputTokens !== undefined) {
      sawCacheCreationInputTokens = true;
      cacheCreationInputTokens += usage.cacheCreationInputTokens;
    }
    if (usage?.reasoningOutputTokens !== undefined) {
      sawReasoningOutputTokens = true;
      reasoningOutputTokens += usage.reasoningOutputTokens;
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
    cacheReadInputTokens: sawCacheReadInputTokens ? cacheReadInputTokens : null,
    cacheCreationInputTokens: sawCacheCreationInputTokens ? cacheCreationInputTokens : null,
    reasoningOutputTokens: sawReasoningOutputTokens ? reasoningOutputTokens : null,
    estimatedCostUsd: sawCost ? estimatedCostUsd : null,
    retryCount,
  };
}
