/**
 * Unit tests for RememberNode, SendNode, ReceiveNode factories.
 *
 * beads: prompt-language-7g58, prompt-language-n6gr
 */

import { describe, it, expect } from 'vitest';
import { createRememberNode, createSendNode, createReceiveNode } from './flow-node.js';

describe('createRememberNode', () => {
  it('creates a free-form text memory node', () => {
    const node = createRememberNode('r1', 'User prefers TypeScript');
    expect(node).toEqual({
      kind: 'remember',
      id: 'r1',
      text: 'User prefers TypeScript',
    });
  });

  it('creates a key-value memory node', () => {
    const node = createRememberNode('r2', undefined, 'lang_pref', 'TypeScript');
    expect(node).toEqual({
      kind: 'remember',
      id: 'r2',
      key: 'lang_pref',
      value: 'TypeScript',
    });
  });

  it('creates a minimal remember node with no fields', () => {
    const node = createRememberNode('r3');
    expect(node).toEqual({ kind: 'remember', id: 'r3' });
  });

  it('omits undefined optional fields', () => {
    const node = createRememberNode('r4', 'some text');
    expect('key' in node).toBe(false);
    expect('value' in node).toBe(false);
  });

  it('preserves all three fields when all are provided', () => {
    const node = createRememberNode('r5', 'text', 'key', 'value');
    expect(node.text).toBe('text');
    expect(node.key).toBe('key');
    expect(node.value).toBe('value');
  });
});

describe('createSendNode', () => {
  it('creates a send-to-child node', () => {
    const node = createSendNode('s1', 'fix-lint', 'Focus on imports');
    expect(node).toEqual({
      kind: 'send',
      id: 's1',
      target: 'fix-lint',
      message: 'Focus on imports',
    });
  });

  it('creates a send-to-parent node', () => {
    const node = createSendNode('s2', 'parent', 'Fixed 3 errors');
    expect(node).toEqual({
      kind: 'send',
      id: 's2',
      target: 'parent',
      message: 'Fixed 3 errors',
    });
  });

  it('preserves ${var} placeholders in message (interpolation is runtime, not parse-time)', () => {
    const node = createSendNode('s3', 'child', 'Result: ${result}');
    expect(node.message).toBe('Result: ${result}');
  });

  it('allows empty message', () => {
    const node = createSendNode('s4', 'parent', '');
    expect(node.message).toBe('');
  });
});

describe('createReceiveNode', () => {
  it('creates a bare receive node with no from', () => {
    const node = createReceiveNode('rec1', 'msg');
    expect(node).toEqual({ kind: 'receive', id: 'rec1', variableName: 'msg' });
  });

  it('creates a receive node with a named source', () => {
    const node = createReceiveNode('rec2', 'result', 'fix-lint');
    expect(node).toEqual({
      kind: 'receive',
      id: 'rec2',
      variableName: 'result',
      from: 'fix-lint',
    });
  });

  it('creates a receive node with parent source', () => {
    const node = createReceiveNode('rec3', 'msg', 'parent');
    expect(node.from).toBe('parent');
  });

  it('creates a receive node with a timeout', () => {
    const node = createReceiveNode('rec4', 'msg', undefined, 30);
    expect(node.timeoutSeconds).toBe(30);
    expect('from' in node).toBe(false);
  });

  it('creates a receive node with both from and timeout', () => {
    const node = createReceiveNode('rec5', 'msg', 'child-a', 60);
    expect(node.from).toBe('child-a');
    expect(node.timeoutSeconds).toBe(60);
  });

  it('omits undefined optional fields', () => {
    const node = createReceiveNode('rec6', 'msg');
    expect('from' in node).toBe(false);
    expect('timeoutSeconds' in node).toBe(false);
  });
});
