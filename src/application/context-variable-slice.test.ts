import { describe, expect, it } from 'vitest';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createForeachNode,
  createPromptNode,
  createRunNode,
  createTryNode,
  createLetNode,
  createRetryNode,
  createSpawnNode,
  createReviewNode,
  createRememberNode,
  createSendNode,
  createSwarmNode,
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

  it('returns state unchanged when currentNodePath is empty', () => {
    const spec = createFlowSpec('noop', [createPromptNode('p1', 'hi')]);
    const state = { ...createSessionState('s1', spec), currentNodePath: [] as number[] };
    const sliced = createInjectionContextState(state);
    expect(sliced).toBe(state);
  });

  it('keeps appended variable for let += and its source interpolation', () => {
    const letNode = createLetNode(
      'l1',
      'items',
      { type: 'literal', value: 'next-${seed}' },
      true,
    );
    const spec = createFlowSpec('slice let-append', [letNode]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { items: '["prev"]', seed: 's', noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['items']).toBe('["prev"]');
    expect(sliced.variables['seed']).toBe('s');
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('keeps interpolation deps from let source variants (run, prompt_json, memory, empty_list)', () => {
    const runLet = createLetNode('l1', 'out', { type: 'run', command: 'echo ${topic}' });
    const jsonLet = createLetNode('l2', 'parsed', {
      type: 'prompt_json',
      text: 'ask ${topic}',
      schema: 'shape ${schema_name}',
    });
    const memLet = createLetNode('l3', 'm', { type: 'memory', key: 'k' });
    const emptyLet = createLetNode('l4', 'list', { type: 'empty_list' });
    const spec = createFlowSpec('slice let variants', [runLet, jsonLet, memLet, emptyLet]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [1],
      variables: { topic: 't', schema_name: 'Foo', noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['topic']).toBe('t');
    expect(sliced.variables['schema_name']).toBe('Foo');
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('retry node preserves command_failed when present', () => {
    const spec = createFlowSpec('slice retry', [
      createRetryNode('r1', [createPromptNode('p1', 'fix')], 3),
    ]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: { command_failed: true, noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['command_failed']).toBe(true);
  });

  it('spawn with a condition collects its condition variables', () => {
    const spawn = createSpawnNode('sp1', 'worker', [], undefined, undefined, undefined, 'ready');
    const spec = createFlowSpec('slice spawn', [spawn]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { ready: true, noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['ready']).toBe(true);
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('spawn without a condition keeps only mandatory variables', () => {
    const spawn = createSpawnNode('sp1', 'worker', []);
    const spec = createFlowSpec('slice spawn-no-cond', [spawn]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { last_exit_code: 0, noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['last_exit_code']).toBe(0);
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('review node keeps interpolation deps in criteria and groundedBy', () => {
    const review = createReviewNode('rv1', [], 1, 'Check ${topic}', '${context}');
    const spec = createFlowSpec('slice review', [review]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { topic: 't', context: 'c', noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['topic']).toBe('t');
    expect(sliced.variables['context']).toBe('c');
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('remember node keeps text/key/value interpolation deps', () => {
    const remember = createRememberNode('rm1', 'Note ${topic}', '${key}', '${value}');
    const spec = createFlowSpec('slice remember', [remember]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { topic: 't', key: 'k', value: 'v', noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['topic']).toBe('t');
    expect(sliced.variables['key']).toBe('k');
    expect(sliced.variables['value']).toBe('v');
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('send node keeps target and message interpolation deps', () => {
    const send = createSendNode('s1', '${target}', 'hello ${name}');
    const spec = createFlowSpec('slice send', [send]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { target: 'parent', name: 'Ada', noise: 'drop' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['target']).toBe('parent');
    expect(sliced.variables['name']).toBe('Ada');
    expect(sliced.variables['noise']).toBeUndefined();
  });

  it('swarm node forces the full variable set as a safety fallback', () => {
    const swarm = createSwarmNode('sw1', 'team', [], []);
    const spec = createFlowSpec('slice swarm', [swarm]);
    const state = {
      ...createSessionState('s1', spec),
      variables: { secret: 'visible-on-fallback', anything: 'else' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables).toEqual(state.variables);
  });

  it('always-included prefixes (_review_result., _runtime_diagnostic.) are kept', () => {
    const spec = createFlowSpec('slice prefix', [createPromptNode('p1', 'static text')]);
    const state = {
      ...createSessionState('s1', spec),
      variables: {
        '_review_result.reviewer': 'alice',
        '_runtime_diagnostic.kind': 'warn',
        'other.thing': 'drop',
      },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['_review_result.reviewer']).toBe('alice');
    expect(sliced.variables['_runtime_diagnostic.kind']).toBe('warn');
    expect(sliced.variables['other.thing']).toBeUndefined();
  });

  it('skips condition keywords when collecting bare-identifier vars', () => {
    // Expression uses keywords (and/or/not) — none should be treated as required.
    const spec = createFlowSpec('slice keywords', [
      createPromptNode('p1', 'static'),
      createTryNode('t1', [], 'a and not b or true', []),
    ]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [1],
      variables: { a: 1, b: 2, noise: 'drop', and: 'should-skip-as-keyword' },
    };
    const sliced = createInjectionContextState(state);
    expect(sliced.variables['a']).toBe(1);
    expect(sliced.variables['b']).toBe(2);
    expect(sliced.variables['and']).toBeUndefined();
    expect(sliced.variables['noise']).toBeUndefined();
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
