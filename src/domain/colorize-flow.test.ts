import { describe, it, expect } from 'vitest';
import { colorizeFlow } from './colorize-flow.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

describe('colorizeFlow', () => {
  it('applies bold to header line', () => {
    const input = '[prompt-language] Flow: test | Status: active';
    const output = colorizeFlow(input);
    expect(output).toBe(`${BOLD}${input}${RESET}`);
  });

  it('applies green to current node line', () => {
    const input = '> run: npm test  <-- current';
    const output = colorizeFlow(input);
    expect(output).toBe(`${GREEN}${input}${RESET}`);
  });

  it('applies yellow to ancestor scope lines', () => {
    const input = '> while not tests_pass max 4 [2/4]';
    const output = colorizeFlow(input);
    expect(output).toBe(`${YELLOW}${input}${RESET}`);
  });

  it('applies green to [pass] gate marker', () => {
    const input = '  tests_pass  [pass]';
    const output = colorizeFlow(input);
    expect(output).toContain(`${GREEN}[pass]${RESET}`);
    expect(output).toContain('tests_pass');
  });

  it('applies red to [fail] gate marker', () => {
    const input = '  lint_pass  [fail]';
    const output = colorizeFlow(input);
    expect(output).toContain(`${RED}[fail]${RESET}`);
    expect(output).toContain('lint_pass');
  });

  it('applies yellow to [pending] gate marker', () => {
    const input = '  tests_pass  [pending]';
    const output = colorizeFlow(input);
    expect(output).toContain(`${YELLOW}[pending]${RESET}`);
  });

  it('leaves plain lines unmodified', () => {
    const input = '  prompt: do work';
    expect(colorizeFlow(input)).toBe(input);
  });

  it('processes multiline input', () => {
    const input = [
      '[prompt-language] Flow: test | Status: active',
      '',
      '> while not done max 3',
      '>   run: npm test  <-- current',
      '  end',
      '',
      'done when:',
      '  tests_pass  [pending]',
    ].join('\n');

    const output = colorizeFlow(input);
    const lines = output.split('\n');

    expect(lines[0]!.startsWith(BOLD)).toBe(true);
    expect(lines[2]!.startsWith(YELLOW)).toBe(true);
    expect(lines[3]!.startsWith(GREEN)).toBe(true);
    expect(lines[4]).toBe('  end');
    expect(lines[7]).toContain(`${YELLOW}[pending]${RESET}`);
  });

  it('prioritizes current marker over ancestor prefix', () => {
    // A line that is both an ancestor ("> ") and current ("<-- current")
    // should get green (current takes priority)
    const input = '> prompt: do work  <-- current';
    const output = colorizeFlow(input);
    expect(output.startsWith(GREEN)).toBe(true);
    expect(output.startsWith(YELLOW)).toBe(false);
  });
});
