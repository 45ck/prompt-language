import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

import {
  createManagedCodexHooksConfig,
  disableManagedCodexHooks,
  enableManagedCodexHooks,
  inspectCodexHooksConfig,
  type CodexHooksConfigSnapshot,
  type CodexHooksMutation,
} from './codex-hooks-config.js';

export type CodexHooksConfigFileOutcome = CodexHooksMutation['outcome'] | 'created' | 'missing';

export interface CodexHooksConfigFileMutation {
  readonly outcome: CodexHooksConfigFileOutcome;
  readonly changed: boolean;
  readonly raw: string | null;
  readonly snapshot: CodexHooksConfigSnapshot;
}

const ABSENT_SNAPSHOT: CodexHooksConfigSnapshot = {
  ownership: 'absent',
  enabled: false,
};

export async function inspectCodexHooksConfigFile(
  configPath: string,
): Promise<CodexHooksConfigSnapshot> {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return inspectCodexHooksConfig(raw);
  } catch (error: unknown) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    return ABSENT_SNAPSHOT;
  }
}

export async function enableManagedCodexHooksFile(
  configPath: string,
): Promise<CodexHooksConfigFileMutation> {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const result = enableManagedCodexHooks(raw);

    if (result.outcome === 'updated') {
      await fs.writeFile(configPath, result.raw, 'utf8');
    }

    return toFileMutation(result, result.outcome === 'updated');
  } catch (error: unknown) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  const raw = createManagedCodexHooksConfig();
  await fs.mkdir(dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, raw, 'utf8');
  return {
    outcome: 'created',
    changed: true,
    raw,
    snapshot: inspectCodexHooksConfig(raw),
  };
}

export async function disableManagedCodexHooksFile(
  configPath: string,
): Promise<CodexHooksConfigFileMutation> {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const result = disableManagedCodexHooks(raw);

    if (result.outcome === 'removed') {
      await fs.writeFile(configPath, result.raw, 'utf8');
    }

    return toFileMutation(result, result.outcome === 'removed');
  } catch (error: unknown) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    return {
      outcome: 'missing',
      changed: false,
      raw: null,
      snapshot: ABSENT_SNAPSHOT,
    };
  }
}

function toFileMutation(
  result: CodexHooksMutation,
  changed: boolean,
): CodexHooksConfigFileMutation {
  return {
    outcome: result.outcome,
    changed,
    raw: result.raw,
    snapshot: result.snapshot,
  };
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
