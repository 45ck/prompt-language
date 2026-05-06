import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import type { PromptTurnProviderTelemetry } from '../../application/ports/prompt-turn-runner.js';

const CLAUDE_TELEMETRY_HOME_ENV = 'PROMPT_LANGUAGE_CLAUDE_TELEMETRY_HOME';
const CLAUDE_TELEMETRY_ENABLED_ENV = 'PROMPT_LANGUAGE_CLAUDE_TELEMETRY';
const MAX_JSONL_FILES = 200;
const ATTRIBUTION_WINDOW_MS = 120_000;

interface ClaudeTelemetryOptions {
  readonly cwd: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly homeDir?: string | undefined;
}

interface ClaudeUsageCandidate {
  readonly timestampMs: number;
  readonly model?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly requestId?: string | undefined;
  readonly inputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  readonly cacheReadInputTokens?: number | undefined;
  readonly cacheCreationInputTokens?: number | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function sameCwd(left: string, right: string): boolean {
  const normalize = (value: string): string => resolve(value).replace(/\\/g, '/').toLowerCase();
  return normalize(left) === normalize(right);
}

function readBooleanEnv(name: string): boolean | undefined {
  const value = process.env[name]?.trim().toLowerCase();
  if (value == null || value === '') return undefined;
  if (value === '1' || value === 'true' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'off') return false;
  return undefined;
}

function telemetryEnabled(): boolean {
  return readBooleanEnv(CLAUDE_TELEMETRY_ENABLED_ENV) ?? true;
}

async function listClaudeJsonlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [root];

  while (pending.length > 0 && files.length < MAX_JSONL_FILES) {
    const current = pending.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(path);
        if (files.length >= MAX_JSONL_FILES) break;
      }
    }
  }

  return files;
}

function parseClaudeUsageLine(
  line: string,
  options: ClaudeTelemetryOptions,
): ClaudeUsageCandidate | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  if (parsed['type'] !== 'assistant') return undefined;

  const cwd = readString(parsed['cwd']);
  if (cwd === undefined || !sameCwd(cwd, options.cwd)) return undefined;

  const timestamp = readString(parsed['timestamp']);
  const timestampMs = timestamp === undefined ? Number.NaN : Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return undefined;
  if (timestampMs < options.startedAt - ATTRIBUTION_WINDOW_MS) return undefined;
  if (timestampMs > options.endedAt + ATTRIBUTION_WINDOW_MS) return undefined;

  const message = isRecord(parsed['message']) ? parsed['message'] : undefined;
  const usage = isRecord(message?.['usage']) ? message['usage'] : undefined;
  if (usage === undefined) return undefined;

  return {
    timestampMs,
    model: readString(message?.['model']),
    sessionId: readString(parsed['sessionId']),
    requestId: readString(parsed['requestId']),
    inputTokens: readNonNegativeNumber(usage['input_tokens']),
    outputTokens: readNonNegativeNumber(usage['output_tokens']),
    cacheReadInputTokens: readNonNegativeNumber(usage['cache_read_input_tokens']),
    cacheCreationInputTokens: readNonNegativeNumber(usage['cache_creation_input_tokens']),
  };
}

function summarizeClaudeCandidates(
  candidates: readonly ClaudeUsageCandidate[],
): PromptTurnProviderTelemetry | undefined {
  if (candidates.length === 0) return undefined;

  const sorted = [...candidates].sort((a, b) => a.timestampMs - b.timestampMs);
  const latest = sorted[sorted.length - 1]!;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadInputTokens = 0;
  let cacheCreationInputTokens = 0;
  let sawInput = false;
  let sawOutput = false;
  let sawCacheRead = false;
  let sawCacheCreation = false;

  for (const candidate of sorted) {
    if (candidate.inputTokens !== undefined) {
      sawInput = true;
      inputTokens += candidate.inputTokens;
    }
    if (candidate.outputTokens !== undefined) {
      sawOutput = true;
      outputTokens += candidate.outputTokens;
    }
    if (candidate.cacheReadInputTokens !== undefined) {
      sawCacheRead = true;
      cacheReadInputTokens += candidate.cacheReadInputTokens;
    }
    if (candidate.cacheCreationInputTokens !== undefined) {
      sawCacheCreation = true;
      cacheCreationInputTokens += candidate.cacheCreationInputTokens;
    }
  }

  return {
    provider: 'claude',
    actualModel: latest.model,
    tokenUsage: {
      ...(sawInput ? { inputTokens } : {}),
      ...(sawOutput ? { outputTokens } : {}),
      ...(sawInput || sawOutput ? { totalTokens: inputTokens + outputTokens } : {}),
      ...(sawCacheRead ? { cacheReadInputTokens } : {}),
      ...(sawCacheCreation ? { cacheCreationInputTokens } : {}),
    },
    estimatedCostUsd: null,
    metadata: {
      attributionConfidence: candidates.length === 1 ? 'medium' : 'low',
      candidateCount: candidates.length,
      ...(latest.sessionId !== undefined ? { sessionId: latest.sessionId } : {}),
      ...(latest.requestId !== undefined ? { requestId: latest.requestId } : {}),
    },
  };
}

export async function readClaudeProviderTelemetry(
  options: ClaudeTelemetryOptions,
): Promise<PromptTurnProviderTelemetry | undefined> {
  if (!telemetryEnabled()) return undefined;

  const home = options.homeDir ?? process.env[CLAUDE_TELEMETRY_HOME_ENV] ?? homedir();
  const projectsRoot = join(home, '.claude', 'projects');
  const files = await listClaudeJsonlFiles(projectsRoot);
  const candidates: ClaudeUsageCandidate[] = [];

  for (const file of files) {
    try {
      const fileStat = await stat(file);
      if (fileStat.mtimeMs < options.startedAt - ATTRIBUTION_WINDOW_MS) continue;
      const text = await readFile(file, 'utf8');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const candidate = parseClaudeUsageLine(trimmed, options);
        if (candidate !== undefined) candidates.push(candidate);
      }
    } catch {
      continue;
    }
  }

  return summarizeClaudeCandidates(candidates);
}
