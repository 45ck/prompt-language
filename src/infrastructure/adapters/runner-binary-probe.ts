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
  if (process.platform !== 'win32' || extname(binary)) {
    return [binary];
  }

  const extensions = env['PATHEXT']?.split(';').filter((value) => value.length > 0) ?? [
    '.EXE',
    '.CMD',
    '.BAT',
    '.COM',
  ];
  return [binary, ...extensions.map((extension) => `${binary}${extension}`)];
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
