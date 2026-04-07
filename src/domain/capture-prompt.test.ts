import { describe, it, expect } from 'vitest';
import {
  buildCapturePrompt,
  buildCaptureRetryPrompt,
  captureFilePath,
  CAPTURE_TAG,
  CAPTURE_TAG_BASE,
  captureTagName,
  DEFAULT_MAX_CAPTURE_RETRIES,
  extractCaptureTag,
} from './capture-prompt.js';

describe('captureFilePath', () => {
  it('returns path under .prompt-language/vars/', () => {
    expect(captureFilePath('tasks')).toBe('.prompt-language/vars/tasks');
  });
});

describe('CAPTURE_TAG', () => {
  it('is prompt-language-capture', () => {
    expect(CAPTURE_TAG).toBe('prompt-language-capture');
  });
});

describe('buildCapturePrompt', () => {
  it('includes the original prompt text', () => {
    const result = buildCapturePrompt('List the bugs', 'tasks');
    expect(result).toContain('List the bugs');
  });

  it('includes the capture file path', () => {
    const result = buildCapturePrompt('List the bugs', 'tasks');
    expect(result).toContain('.prompt-language/vars/tasks');
  });

  it('instructs one item per line for lists', () => {
    const result = buildCapturePrompt('List colors', 'colors');
    expect(result).toContain('one item per line');
  });

  it('mentions Write tool', () => {
    const result = buildCapturePrompt('Summarize', 'summary');
    expect(result).toContain('Write tool');
  });

  it('includes character limit', () => {
    const result = buildCapturePrompt('Do work', 'out');
    expect(result).toContain('2000 characters');
  });

  it('instructs file-write-only capture (no XML tags)', () => {
    const result = buildCapturePrompt('Do work', 'out');
    expect(result).not.toContain('Wrap your answer in tags');
    expect(result).toContain('save your answer to');
  });
});

describe('buildCaptureRetryPrompt', () => {
  it('includes the capture file path', () => {
    const result = buildCaptureRetryPrompt('tasks');
    expect(result).toContain('.prompt-language/vars/tasks');
  });

  it('instructs file-write-only retry (no XML tags)', () => {
    const result = buildCaptureRetryPrompt('tasks');
    expect(result).not.toContain(`<${CAPTURE_TAG} name="tasks">`);
    expect(result).toContain('Write tool');
  });

  it('mentions capture was not found', () => {
    const result = buildCaptureRetryPrompt('out');
    expect(result).toContain('not found');
  });
});

describe('captureTagName', () => {
  it('builds nonce-specific tag name', () => {
    expect(captureTagName('abcd1234')).toBe('prompt-language-capture-abcd1234');
  });
});

describe('CAPTURE_TAG_BASE', () => {
  it('equals prompt-language-capture', () => {
    expect(CAPTURE_TAG_BASE).toBe('prompt-language-capture');
  });
});

describe('buildCapturePrompt with nonce', () => {
  it('does not embed nonce in output (nonce no longer used in prompt)', () => {
    const result = buildCapturePrompt('Do work', 'out', 'abc12345');
    expect(result).not.toContain('abc12345');
    expect(result).toContain('.prompt-language/vars/out');
  });

  it('includes file path without nonce', () => {
    const result = buildCapturePrompt('Do work', 'out');
    expect(result).toContain('.prompt-language/vars/out');
  });
});

describe('buildCaptureRetryPrompt with nonce', () => {
  it('does not embed nonce in output (nonce no longer used in prompt)', () => {
    const result = buildCaptureRetryPrompt('tasks', 'abc12345');
    expect(result).not.toContain('abc12345');
    expect(result).toContain('.prompt-language/vars/tasks');
  });

  it('includes file path without nonce', () => {
    const result = buildCaptureRetryPrompt('tasks');
    expect(result).toContain('.prompt-language/vars/tasks');
  });
});

describe('DEFAULT_MAX_CAPTURE_RETRIES', () => {
  it('equals 3', () => {
    expect(DEFAULT_MAX_CAPTURE_RETRIES).toBe(3);
  });
});

describe('extractCaptureTag', () => {
  it('extracts value from nonce-tagged text', () => {
    const text =
      'Some text <prompt-language-capture-abc123 name="tasks">my value</prompt-language-capture-abc123> more text';
    expect(extractCaptureTag(text, 'tasks', 'abc123')).toBe('my value');
  });

  it('extracts value from base-tagged text without nonce', () => {
    const text = '<prompt-language-capture name="result">hello world</prompt-language-capture>';
    expect(extractCaptureTag(text, 'result')).toBe('hello world');
  });

  it('returns null when tag is not found', () => {
    expect(extractCaptureTag('no tags here', 'tasks', 'abc')).toBeNull();
  });

  it('returns null when variable name does not match', () => {
    const text = '<prompt-language-capture-abc name="other">value</prompt-language-capture-abc>';
    expect(extractCaptureTag(text, 'tasks', 'abc')).toBeNull();
  });

  it('returns null for empty tag content', () => {
    const text = '<prompt-language-capture-abc name="tasks">   </prompt-language-capture-abc>';
    expect(extractCaptureTag(text, 'tasks', 'abc')).toBeNull();
  });

  it('trims whitespace from extracted value', () => {
    const text =
      '<prompt-language-capture-abc name="tasks">  trimmed  </prompt-language-capture-abc>';
    expect(extractCaptureTag(text, 'tasks', 'abc')).toBe('trimmed');
  });

  it('handles multiline content', () => {
    const text =
      '<prompt-language-capture-abc name="list">line1\nline2\nline3</prompt-language-capture-abc>';
    expect(extractCaptureTag(text, 'list', 'abc')).toBe('line1\nline2\nline3');
  });
});
