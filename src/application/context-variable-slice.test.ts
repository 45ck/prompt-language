import { describe, expect, it } from 'vitest';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createForeachNode,
  createPromptNode,
  createRunNode,
  createTryNode,
} from '../domain/flow-node.js';
import { createSessionState } from '../domain/session-state.js';
import { createInjectionContextState } from './context-variable-slice.js';

describe('createInjectionContextState', () => {
  it('keeps prompt interpolation dependencies and mandatory runtime fields', () => {
    const spec = createFlowSpec('slice prompt', [
      createPromptNode(
        'p1',
        'Use ${repo:-default} with ${items[0]} and ${analysis.severity} before ${missing:-fallback}',
      ),
    ]);
    const state = {
      ...createSessionState('slice-prompt', spec),
      variables: {
        repo: 'auth',
        items: '["first","second"]',
        'analysis.severity': 'high',
        secret: 'ignore me',
        last_exit_code: 1,
      },
    };

    const sliced = createInjectionContextState(state);

    expect(sliced.variables).toEqual({
      repo: 'auth',
      items: '["first","second"]',
      'analysis.severity': 'high',
      last_exit_code: 1,
    });
  });

  it('keeps run command dependencies for current node and ancestor loop context', () => {
    const spec = createFlowSpec('slice run', [
      createForeachNode('fe1', 'file', '${files}', [
        createRunNode('r1', 'cat ${file} ${paths[0]} ${repo:-fallback}'),
      ]),
    ]);
    const state = {
      ...createSessionState('slice-run', spec),
      currentNodePath: [0, 0],
      variables: {
        files: '["a.ts","b.ts"]',
        file: 'a.ts',
        paths: '["src/index.ts"]',
        repo: 'auth',
        secret: 'ignore me',
        command_failed: true,
      },
    };

    const sliced = createInjectionContextState(state);

    expect(sliced.variables).toEqual({
      files: '["a.ts","b.ts"]',
      file: 'a.ts',
      paths: '["src/index.ts"]',
      repo: 'auth',
      command_failed: true,
    });
  });

  it('keeps catch condition variables needed by the current path', () => {
    const spec = createFlowSpec('slice catch', [
      createTryNode('t1', [createRunNode('r1', 'do work')], 'retryable_error', [
        createPromptNode('p1', 'Handle retry'),
      ]),
    ]);
    const state = {
      ...createSessionState('slice-catch', spec),
      currentNodePath: [0, 1],
      variables: {
        retryable_error: true,
        secret: 'ignore me',
      },
    };

    const sliced = createInjectionContextState(state);

    expect(sliced.variables).toEqual({
      retryable_error: true,
    });
  });

  it('falls back to the full variable set when interpolation is malformed', () => {
    const spec = createFlowSpec('slice fallback', [
      createPromptNode('p1', 'Inspect ${${dynamic}} before continuing'),
    ]);
    const state = {
      ...createSessionState('slice-fallback', spec),
      variables: {
        dynamic: 'repo',
        repo: 'auth',
        secret: 'keep visible on fallback',
      },
    };

    const sliced = createInjectionContextState(state);

    expect(sliced.variables).toEqual(state.variables);
  });
});
