import { describe, expect, it } from 'vitest';
import { join, parse } from 'node:path';

import { resolveStateRoot } from './resolve-state-root.js';

describe('resolveStateRoot', () => {
  it('joins relative state directories onto the base path', () => {
    const basePath = join(parse(process.cwd()).root, 'workspace');
    expect(resolveStateRoot(basePath, '.prompt-language')).toBe(join(basePath, '.prompt-language'));
  });

  it('preserves absolute state directories', () => {
    const basePath = join(parse(process.cwd()).root, 'workspace');
    const absoluteStateDir = join(parse(process.cwd()).root, 'custom-state');
    expect(resolveStateRoot(basePath, absoluteStateDir)).toBe(absoluteStateDir);
  });
});
