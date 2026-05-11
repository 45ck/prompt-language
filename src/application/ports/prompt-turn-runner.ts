export interface PromptTurnInput {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string | undefined;
  readonly scopePrompt?: string | undefined;
}

export interface PromptTurnTokenUsageTelemetry {
  readonly inputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  readonly totalTokens?: number | undefined;
  readonly cacheReadInputTokens?: number | undefined;
  readonly cacheCreationInputTokens?: number | undefined;
  readonly reasoningOutputTokens?: number | undefined;
}

export interface PromptTurnDurationTelemetry {
  readonly totalMs?: number | undefined;
  readonly firstTokenMs?: number | undefined;
  readonly loadMs?: number | undefined;
  readonly promptEvalMs?: number | undefined;
  readonly evalMs?: number | undefined;
}

export interface PromptTurnProviderTelemetry {
  readonly provider: string;
  readonly requestedModel?: string | undefined;
  readonly actualModel?: string | undefined;
  readonly status?: 'ok' | 'error' | 'timeout' | 'blocked' | undefined;
  readonly exitCode?: number | undefined;
  readonly tokenUsage?: PromptTurnTokenUsageTelemetry | undefined;
  readonly duration?: PromptTurnDurationTelemetry | undefined;
  readonly retryCount?: number | undefined;
  readonly estimatedCostUsd?: number | null | undefined;
  readonly metadata?: Record<string, string | number | boolean | null> | undefined;
}

export interface PromptTurnResult {
  readonly exitCode: number;
  readonly assistantText?: string | undefined;
  readonly madeProgress?: boolean | undefined;
  readonly providerTelemetry?: PromptTurnProviderTelemetry | undefined;
}

export interface PromptTurnRunnerCapabilities {
  readonly externalProcess: boolean;
  readonly terminate: boolean;
  readonly cwdOverride: boolean;
  readonly modelPassThrough: boolean;
  readonly stateDirPolling: boolean;
  readonly inProcessExecution: boolean;
}

export interface PromptTurnRunner {
  readonly capabilities?: PromptTurnRunnerCapabilities | undefined;
  run(input: PromptTurnInput): Promise<PromptTurnResult>;
}
