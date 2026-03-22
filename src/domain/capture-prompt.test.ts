import { describe, it, expect } from 'vitest';
import {
  buildCapturePrompt,
  buildCaptureRetryPrompt,
  captureFilePath,
  CAPTURE_TAG,
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

describe('DEFAULT_MAX_CAPTURE_RETRIES', () => {
  it('equals 3', () => {
    expect(DEFAULT_MAX_CAPTURE_RETRIES).toBe(3);
  });
});
