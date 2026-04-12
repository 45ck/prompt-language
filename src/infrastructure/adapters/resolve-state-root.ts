import { isAbsolute, join } from 'node:path';

export function resolveStateRoot(basePath: string, stateDir = '.prompt-language'): string {
  return isAbsolute(stateDir) ? stateDir : join(basePath, stateDir);
}
