import { existsSync } from 'node:fs';
import { delimiter, extname, join } from 'node:path';
import type { RunnerName } from '../../application/execution-preflight.js';

const RUNNER_BINARIES: Readonly<Record<RunnerName, string>> = {
  claude: 'claude',
  codex: 'codex',
  opencode: 'opencode',
  ollama: 'ollama',
  aider: 'python',
};

function candidateNames(binary: string, env: NodeJS.ProcessEnv): readonly string[] {
  const extensions = env['PATHEXT']?.split(';').filter((value) => value.length > 0) ?? [];
  if (extname(binary) || (process.platform !== 'win32' && extensions.length === 0)) {
    return [binary];
  }

  const platformExtensions = extensions.length > 0 ? extensions : ['.EXE', '.CMD', '.BAT', '.COM'];
  return [binary, ...platformExtensions.map((extension) => `${binary}${extension}`)];
}

export function probeRunnerBinary(
  runner: RunnerName,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const pathValue = env['PATH'];
  if (!pathValue) {
    return false;
  }

  const names = candidateNames(RUNNER_BINARIES[runner], env);
  return pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .some((entry) => names.some((name) => existsSync(join(entry, name))));
}
