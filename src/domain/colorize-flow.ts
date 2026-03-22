/**
 * colorizeFlow — ANSI color post-processor for renderFlow() output.
 *
 * Pure string transform. Wraps rendered flow text with ANSI escape codes
 * for better terminal readability. Keeps renderFlow() domain-pure.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

export function colorizeFlow(rendered: string): string {
  return rendered
    .split('\n')
    .map((line) => colorizeLine(line))
    .join('\n');
}

function colorizeLine(line: string): string {
  // Header line: bold
  if (line.startsWith('[prompt-language]')) {
    return `${BOLD}${line}${RESET}`;
  }

  // Current node marker: green
  if (line.includes('<-- current')) {
    return `${GREEN}${line}${RESET}`;
  }

  // Ancestor scope: yellow (lines starting with "> ")
  if (line.startsWith('> ')) {
    return `${YELLOW}${line}${RESET}`;
  }

  // Gate results
  if (line.includes('[pass]')) {
    return line.replace('[pass]', `${GREEN}[pass]${RESET}`);
  }
  if (line.includes('[fail]')) {
    return line.replace('[fail]', `${RED}[fail]${RESET}`);
  }
  if (line.includes('[pending]')) {
    return line.replace('[pending]', `${YELLOW}[pending]${RESET}`);
  }

  return line;
}
