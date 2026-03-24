/**
 * colorizeStatusLine — ANSI color post-processor for renderStatusLine() output.
 *
 * Pure string transform. Wraps the status line with ANSI escape codes
 * for terminal readability. Keeps renderStatusLine() domain-pure.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

export function colorizeStatusLine(line: string): string {
  let result = line;

  // [PL] tag: cyan + bold
  result = result.replace('[PL]', `${CYAN}${BOLD}[PL]${RESET}`);

  // Gate results (Unicode symbols)
  result = result.replace(/:✓/g, `:${GREEN}✓${RESET}`);
  result = result.replace(/:✗/g, `:${RED}✗${RESET}`);
  result = result.replace(/:○/g, `:${YELLOW}○${RESET}`);

  // Terminal status
  result = result.replace('Status: completed', `${GREEN}Status: completed${RESET}`);
  result = result.replace('Status: failed', `${RED}Status: failed${RESET}`);
  result = result.replace('Status: cancelled', `${YELLOW}Status: cancelled${RESET}`);

  return result;
}
