import { describe, expect, it } from 'vitest';

import { colorizeStatusLine } from './colorize-status-line.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

describe('colorizeStatusLine', () => {
  it('colorizes [PL] tag with cyan bold', () => {
    const result = colorizeStatusLine('[PL] My goal | prompt: Fix it');
    expect(result).toContain(`${CYAN}${BOLD}[PL]${RESET}`);
  });

  it('colorizes :✓ in green', () => {
    const result = colorizeStatusLine('[PL] Goal | tests_pass:✓');
    expect(result).toContain(`:${GREEN}✓${RESET}`);
  });

  it('colorizes :✗ in red', () => {
    const result = colorizeStatusLine('[PL] Goal | tests_pass:✗');
    expect(result).toContain(`:${RED}✗${RESET}`);
  });

  it('colorizes :○ in yellow', () => {
    const result = colorizeStatusLine('[PL] Goal | tests_pass:○');
    expect(result).toContain(`:${YELLOW}○${RESET}`);
  });

  it('colorizes multiple gates', () => {
    const result = colorizeStatusLine('[PL] Goal | tests_pass:✗ lint_pass:✓');
    expect(result).toContain(`:${RED}✗${RESET}`);
    expect(result).toContain(`:${GREEN}✓${RESET}`);
  });

  it('colorizes Status: completed in green', () => {
    const result = colorizeStatusLine('[PL] Goal | Status: completed');
    expect(result).toContain(`${GREEN}Status: completed${RESET}`);
  });

  it('colorizes Status: failed in red', () => {
    const result = colorizeStatusLine('[PL] Goal | Status: failed');
    expect(result).toContain(`${RED}Status: failed${RESET}`);
  });

  it('colorizes Status: cancelled in yellow', () => {
    const result = colorizeStatusLine('[PL] Goal | Status: cancelled');
    expect(result).toContain(`${YELLOW}Status: cancelled${RESET}`);
  });

  it('passes through text without markers unchanged', () => {
    const plain = 'no special markers here';
    expect(colorizeStatusLine(plain)).toBe(plain);
  });

  it('handles completed status with gates', () => {
    const result = colorizeStatusLine('[PL] Goal | Status: completed | tests_pass:✓');
    expect(result).toContain(`${CYAN}${BOLD}[PL]${RESET}`);
    expect(result).toContain(`${GREEN}Status: completed${RESET}`);
    expect(result).toContain(`:${GREEN}✓${RESET}`);
  });
});
