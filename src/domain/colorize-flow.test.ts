import { describe, it, expect } from 'vitest';
import { colorizeFlow } from './colorize-flow.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const GREEN_BOLD = '\x1b[32;1m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const CYAN_BOLD = '\x1b[36;1m';

describe('colorizeFlow — header', () => {
  it('shortens [prompt-language] to [PL] with cyan bold', () => {
    const input = '[prompt-language] Flow: test | Status: active';
    const output = colorizeFlow(input);
    expect(output).toContain(`${CYAN_BOLD}[PL]${RESET}`);
    expect(output).not.toContain('[prompt-language]');
  });

  it('applies bold to rest of header line', () => {
    const input = '[prompt-language] Flow: test | Status: active';
    const output = colorizeFlow(input);
    expect(output).toContain(`${BOLD} Flow: test | Status: active${RESET}`);
  });
});

describe('colorizeFlow — symbol replacements', () => {
  it('replaces # and - in progress bar with Unicode blocks', () => {
    const input = '> while not done max 4 [###--] 2/4';
    const output = colorizeFlow(input);
    expect(output).toContain('[███░░]');
    expect(output).not.toContain('[###--]');
  });

  it('replaces <-- current with ◄ current', () => {
    const input = '> run: npm test  <-- current';
    const output = colorizeFlow(input);
    expect(output).toContain('◄ current');
    expect(output).not.toContain('<-- current');
  });

  it('replaces [pass] with ✓ pass', () => {
    const input = '  tests_pass  [pass]';
    const output = colorizeFlow(input);
    expect(output).toContain('✓ pass');
  });

  it('replaces [fail] with ✗ fail', () => {
    const input = '  lint_pass  [fail]';
    const output = colorizeFlow(input);
    expect(output).toContain('✗ fail');
  });

  it('replaces [fail — ...] with ✗ fail — ...', () => {
    const input = '  tests_pass  [fail — exit 1: "npm test"]';
    const output = colorizeFlow(input);
    expect(output).toContain('✗ fail —');
  });

  it('replaces [pending] with ○ pending', () => {
    const input = '  tests_pass  [pending]';
    const output = colorizeFlow(input);
    expect(output).toContain('○ pending');
  });
});

describe('colorizeFlow — flow line colors', () => {
  it('applies green bold to current node line', () => {
    const input = '> run: npm test  <-- current';
    const output = colorizeFlow(input);
    expect(output).toContain(GREEN_BOLD);
  });

  it('applies yellow to ancestor scope lines', () => {
    const input = '> while not tests_pass max 4';
    const output = colorizeFlow(input);
    expect(output).toContain(YELLOW);
  });

  it('applies dim to completed nodes', () => {
    const input = '~ prompt: already done';
    const output = colorizeFlow(input);
    expect(output).toContain(DIM);
  });

  it('leaves future nodes uncolored', () => {
    const input = '  prompt: not yet';
    const output = colorizeFlow(input);
    expect(output).toBe(input);
  });

  it('prioritizes current marker over ancestor prefix', () => {
    const input = '> prompt: do work  <-- current';
    const output = colorizeFlow(input);
    expect(output).toContain(GREEN_BOLD);
    // Should not have yellow wrapping the whole line
    expect(output.startsWith(YELLOW)).toBe(false);
  });
});

describe('colorizeFlow — gate colors', () => {
  it('applies green to ✓ pass', () => {
    const input = '[prompt-language] Flow: t | Status: active\n\ndone when:\n  tests_pass  [pass]';
    const output = colorizeFlow(input);
    expect(output).toContain(`${GREEN}✓ pass${RESET}`);
  });

  it('applies red to ✗ fail', () => {
    const input = '[prompt-language] Flow: t | Status: active\n\ndone when:\n  lint_pass  [fail]';
    const output = colorizeFlow(input);
    expect(output).toContain(`${RED}✗ fail${RESET}`);
  });

  it('applies yellow to ○ pending', () => {
    const input =
      '[prompt-language] Flow: t | Status: active\n\ndone when:\n  tests_pass  [pending]';
    const output = colorizeFlow(input);
    expect(output).toContain(`${YELLOW}○ pending${RESET}`);
  });
});

describe('colorizeFlow — variable colors', () => {
  it('applies cyan to variable values', () => {
    const input = '[prompt-language] Flow: t | Status: active\n\nVariables:\n  last_exit_code = 1';
    const output = colorizeFlow(input);
    expect(output).toContain(`${CYAN}1${RESET}`);
  });

  it('returns var line unchanged when it has no equals sign', () => {
    const input = '[prompt-language] Flow: t | Status: active\n\nVariables:\n  (no variables)';
    const output = colorizeFlow(input);
    expect(output).toContain('  (no variables)');
    // Should NOT contain cyan since the regex for "key = value" does not match
    expect(output).not.toContain(`${CYAN}(no variables)${RESET}`);
  });
});

describe('colorizeFlow — gate fallback markers', () => {
  it('returns gate line unchanged when no status marker present', () => {
    // Gate line with no pass/fail/pending marker at all
    const input =
      '[prompt-language] Flow: t | Status: active\n\ndone when:\n  tests_pass  (evaluating)';
    const output = colorizeFlow(input);
    // Should not have any color codes on the gate line itself (no marker to colorize)
    const gateLineOut = output.split('\n').find((l) => l.includes('tests_pass'));
    expect(gateLineOut).toBe('  tests_pass  (evaluating)');
  });
});

describe('colorizeFlow — warning colors', () => {
  it('applies yellow to warning lines', () => {
    const input = '[prompt-language] Flow: t | Status: active\n\nWarnings:\n  [!] Missing end';
    const output = colorizeFlow(input);
    expect(output).toContain(`${YELLOW}  [!] Missing end${RESET}`);
  });
});

describe('colorizeFlow — tree connectors', () => {
  it('adds tree connectors to nested flow lines', () => {
    const input = [
      '[prompt-language] Flow: test | Status: active',
      '',
      '> while not done max 3',
      '>   prompt: first',
      '>   run: npm test  <-- current',
      '  end',
    ].join('\n');

    const output = colorizeFlow(input);
    // Nested lines should have tree characters
    expect(output).toContain('├');
    expect(output).toContain('└');
  });

  it('uses └─ for last child at each level', () => {
    const input = [
      '[prompt-language] Flow: test | Status: active',
      '',
      '> while not done max 3',
      '>   prompt: only child',
      '  end',
    ].join('\n');

    const output = colorizeFlow(input);
    // 'prompt' is not the last sibling (end follows at same level)
    // 'end' is the last sibling
    expect(output).toContain('└');
  });

  it('uses └─ for the last nested node when no sibling follows', () => {
    const input = [
      '[prompt-language] Flow: test | Status: active',
      '',
      '> if condition',
      '>   prompt: last nested node',
      '  end',
    ].join('\n');

    const output = colorizeFlow(input);
    // The nested prompt should use └ (last child connector) since no sibling follows
    expect(output).toContain('└');
  });

  it('does not add tree connectors to top-level nodes', () => {
    const input = [
      '[prompt-language] Flow: test | Status: active',
      '',
      '> prompt: do work  <-- current',
    ].join('\n');

    const output = colorizeFlow(input);
    expect(output).not.toContain('├');
    expect(output).not.toContain('└');
    expect(output).not.toContain('│');
  });
});

describe('colorizeFlow — full multiline', () => {
  it('processes complete flow output', () => {
    const input = [
      '[prompt-language] Flow: fix tests | Status: active',
      '',
      '> while not tests_pass max 4 [###--] 2/4',
      '>   prompt: inspect failures',
      '>   run: npm test  <-- current',
      '>   if command_failed',
      '>     prompt: fix errors',
      '>   end',
      '  end',
      '',
      'done when:',
      '  tests_pass  [fail — exit 1: "npm test": 3 tests failed]',
      '',
      'Variables:',
      '  last_exit_code = 1',
    ].join('\n');

    const output = colorizeFlow(input);
    const lines = output.split('\n');

    // Header: [PL] with cyan bold
    expect(lines[0]).toContain(`${CYAN_BOLD}[PL]${RESET}`);

    // Progress bar: Unicode blocks
    expect(output).toContain('███░░');

    // Current marker: ◄
    expect(output).toContain('◄ current');

    // Gate: ✗ fail with red
    expect(output).toContain(`${RED}✗ fail`);

    // Variables: cyan values
    expect(output).toContain(`${CYAN}1${RESET}`);
  });
});
