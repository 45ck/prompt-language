export interface PromptTurnInput {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string | undefined;
}

export interface PromptTurnResult {
  readonly exitCode: number;
  readonly assistantText?: string | undefined;
  readonly madeProgress?: boolean | undefined;
}

export interface PromptTurnRunner {
  run(input: PromptTurnInput): Promise<PromptTurnResult>;
}
