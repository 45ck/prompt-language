import { isAbsolute, join } from 'node:path';

function isWindowsAbsolutePath(path: string): boolean {
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\');
}

export function resolveStateRoot(basePath: string, stateDir = '.prompt-language'): string {
  return isAbsolute(stateDir) || isWindowsAbsolutePath(stateDir)
    ? stateDir
    : join(basePath, stateDir);
}
