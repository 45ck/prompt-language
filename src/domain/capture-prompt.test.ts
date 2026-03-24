import { describe, it, expect } from 'vitest';
import {
  buildCapturePrompt,
  buildCaptureRetryPrompt,
  captureFilePath,
  CAPTURE_TAG,
  CAPTURE_TAG_BASE,
  captureTagName,
  DEFAULT_MAX_CAPTURE_RETRIES,
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

  it('includes capture tag instructions', () => {
    const result = buildCapturePrompt('List colors', 'colors');
    expect(result).toContain(`<${CAPTURE_TAG} name="colors">`);
    expect(result).toContain(`</${CAPTURE_TAG}>`);
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

  it('instructs both tag and file capture', () => {
    const result = buildCapturePrompt('Do work', 'out');
    expect(result).toContain('Wrap your answer in tags');
    expect(result).toContain('Also save your answer');
  });
});

describe('buildCaptureRetryPrompt', () => {
  it('includes the capture file path', () => {
    const result = buildCaptureRetryPrompt('tasks');
    expect(result).toContain('.prompt-language/vars/tasks');
  });

  it('includes capture tag instructions', () => {
    const result = buildCaptureRetryPrompt('tasks');
    expect(result).toContain(`<${CAPTURE_TAG} name="tasks">`);
    expect(result).toContain(`</${CAPTURE_TAG}>`);
  });

  it('mentions capture was not detected', () => {
    const result = buildCaptureRetryPrompt('out');
    expect(result).toContain('not detected');
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
  it('uses nonce-specific tag when nonce is provided', () => {
    const result = buildCapturePrompt('Do work', 'out', 'abc12345');
    expect(result).toContain('<prompt-language-capture-abc12345 name="out">');
    expect(result).toContain('</prompt-language-capture-abc12345>');
  });

  it('falls back to base tag when no nonce', () => {
    const result = buildCapturePrompt('Do work', 'out');
    expect(result).toContain(`<${CAPTURE_TAG_BASE} name="out">`);
    expect(result).toContain(`</${CAPTURE_TAG_BASE}>`);
  });
});

describe('buildCaptureRetryPrompt with nonce', () => {
  it('uses nonce-specific tag when nonce is provided', () => {
    const result = buildCaptureRetryPrompt('tasks', 'abc12345');
    expect(result).toContain('<prompt-language-capture-abc12345 name="tasks">');
    expect(result).toContain('</prompt-language-capture-abc12345>');
  });

  it('falls back to base tag when no nonce', () => {
    const result = buildCaptureRetryPrompt('tasks');
    expect(result).toContain(`<${CAPTURE_TAG_BASE} name="tasks">`);
    expect(result).toContain(`</${CAPTURE_TAG_BASE}>`);
  });
});

describe('DEFAULT_MAX_CAPTURE_RETRIES', () => {
  it('equals 3', () => {
    expect(DEFAULT_MAX_CAPTURE_RETRIES).toBe(3);
  });
});
