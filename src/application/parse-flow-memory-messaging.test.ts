/**
 * Parser unit tests for remember, send, receive, and memory: section.
 *
 * beads: prompt-language-7g58, prompt-language-n6gr
 */

import { describe, it, expect } from 'vitest';
import { parseFlow, parseMemoryKeys } from './parse-flow.js';

// ---------------------------------------------------------------------------
// remember node parsing
// ---------------------------------------------------------------------------

describe('parseFlow — remember node', () => {
  it('parses remember with double-quoted text', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  remember "User prefers TypeScript"\n');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0];
    expect(node?.kind).toBe('remember');
    if (node?.kind === 'remember') {
      expect(node.text).toBe('User prefers TypeScript');
      expect(node.key).toBeUndefined();
    }
  });

  it('parses remember with single-quoted text', () => {
    const spec = parseFlow("Goal: test\n\nflow:\n  remember 'Hello world'\n");
    const node = spec.nodes[0];
    expect(node?.kind).toBe('remember');
    if (node?.kind === 'remember') {
      expect(node.text).toBe('Hello world');
    }
  });

  it('parses remember key-value with double quotes', () => {
    const spec = parseFlow(
      'Goal: test\n\nflow:\n  remember key = "lang_pref" value = "TypeScript"\n',
    );
    const node = spec.nodes[0];
    expect(node?.kind).toBe('remember');
    if (node?.kind === 'remember') {
      expect(node.key).toBe('lang_pref');
      expect(node.value).toBe('TypeScript');
      expect(node.text).toBeUndefined();
    }
  });

  it('parses bare remember (no content) without crashing — emits warning', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  remember\n');
    expect(spec.warnings.some((w) => w.includes('no content'))).toBe(true);
  });

  it('falls back to bare unquoted text for lenient parsing', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  remember unquoted text here\n');
    const node = spec.nodes[0];
    expect(node?.kind).toBe('remember');
    if (node?.kind === 'remember') {
      expect(node.text).toBe('unquoted text here');
    }
  });
});

// ---------------------------------------------------------------------------
// send node parsing
// ---------------------------------------------------------------------------

describe('parseFlow — send node', () => {
  it('parses send to named child with double quotes', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  send "fix-lint" "Focus on imports"\n');
    const node = spec.nodes[0];
    expect(node?.kind).toBe('send');
    if (node?.kind === 'send') {
      expect(node.target).toBe('fix-lint');
      expect(node.message).toBe('Focus on imports');
    }
  });

  it('parses send to parent with keyword', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  send parent "Done with 3 fixes"\n');
    const node = spec.nodes[0];
    expect(node?.kind).toBe('send');
    if (node?.kind === 'send') {
      expect(node.target).toBe('parent');
      expect(node.message).toBe('Done with 3 fixes');
    }
  });

  it('parses send with single-quoted target and message', () => {
    const spec = parseFlow("Goal: test\n\nflow:\n  send 'child-a' 'hello'\n");
    const node = spec.nodes[0];
    expect(node?.kind).toBe('send');
    if (node?.kind === 'send') {
      expect(node.target).toBe('child-a');
      expect(node.message).toBe('hello');
    }
  });

  it('emits a warning and falls back to prompt for invalid send syntax', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  send missing-quotes\n');
    expect(spec.warnings.some((w) => w.includes('Invalid send syntax'))).toBe(true);
    // Falls back to prompt node
    expect(spec.nodes[0]?.kind).toBe('prompt');
  });
});

// ---------------------------------------------------------------------------
// receive node parsing
// ---------------------------------------------------------------------------

describe('parseFlow — receive node', () => {
  it('parses bare receive varname', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  receive msg\n');
    const node = spec.nodes[0];
    expect(node?.kind).toBe('receive');
    if (node?.kind === 'receive') {
      expect(node.variableName).toBe('msg');
      expect(node.from).toBeUndefined();
    }
  });

  it('parses receive varname from double-quoted source', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  receive result from "fix-lint"\n');
    const node = spec.nodes[0];
    expect(node?.kind).toBe('receive');
    if (node?.kind === 'receive') {
      expect(node.variableName).toBe('result');
      expect(node.from).toBe('fix-lint');
    }
  });

  it('parses receive varname from parent keyword', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  receive context from parent\n');
    const node = spec.nodes[0];
    expect(node?.kind).toBe('receive');
    if (node?.kind === 'receive') {
      expect(node.variableName).toBe('context');
      expect(node.from).toBe('parent');
    }
  });

  it('parses receive varname from single-quoted source', () => {
    const spec = parseFlow("Goal: test\n\nflow:\n  receive data from 'child-b'\n");
    const node = spec.nodes[0];
    expect(node?.kind).toBe('receive');
    if (node?.kind === 'receive') {
      expect(node.from).toBe('child-b');
    }
  });

  it('emits warning and falls back for invalid receive syntax', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  receive\n');
    expect(spec.warnings.some((w) => w.includes('Invalid receive syntax'))).toBe(true);
    expect(spec.nodes[0]?.kind).toBe('prompt');
  });
});

// ---------------------------------------------------------------------------
// parseMemoryKeys — memory: section
// ---------------------------------------------------------------------------

describe('parseMemoryKeys', () => {
  it('returns empty array when no memory: section', () => {
    const keys = parseMemoryKeys('Goal: test\n\nflow:\n  prompt: hello\n');
    expect(keys).toEqual([]);
  });

  it('parses a single memory key', () => {
    const keys = parseMemoryKeys(
      'Goal: test\n\nmemory:\n  user_pref_lang\n\nflow:\n  prompt: hi\n',
    );
    expect(keys).toEqual(['user_pref_lang']);
  });

  it('parses multiple memory keys', () => {
    const keys = parseMemoryKeys(
      'Goal: test\n\nmemory:\n  lang_pref\n  project_context\n  team_name\n\nflow:\n  prompt: hi\n',
    );
    expect(keys).toEqual(['lang_pref', 'project_context', 'team_name']);
  });

  it('ignores blank lines between keys', () => {
    const keys = parseMemoryKeys('Goal: test\n\nmemory:\n  key_one\n\n  key_two\n\nflow:\n  ok\n');
    expect(keys).toEqual(['key_one', 'key_two']);
  });

  it('ignores keys that are not valid identifiers', () => {
    const keys = parseMemoryKeys(
      'Goal: test\n\nmemory:\n  valid_key\n  has-hyphen\n\nflow:\n  ok\n',
    );
    // has-hyphen fails /^\w+$/ test
    expect(keys).toEqual(['valid_key']);
  });

  it('stops at the flow: section header', () => {
    const keys = parseMemoryKeys('Goal: test\n\nmemory:\n  key_a\nflow:\n  prompt: hi\n');
    expect(keys).toEqual(['key_a']);
  });
});

// ---------------------------------------------------------------------------
// parseFlow propagates memoryKeys to FlowSpec
// ---------------------------------------------------------------------------

describe('parseFlow — memoryKeys in FlowSpec', () => {
  it('sets memoryKeys on spec when memory: section is present', () => {
    const spec = parseFlow(
      'Goal: test\n\nmemory:\n  lang_pref\n  style_guide\n\nflow:\n  prompt: hi\n',
    );
    expect(spec.memoryKeys).toEqual(['lang_pref', 'style_guide']);
  });

  it('leaves memoryKeys undefined when no memory: section', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  prompt: hi\n');
    expect(spec.memoryKeys).toBeUndefined();
  });
});
