/**
 * colorizeFlow — ANSI color post-processor for renderFlow() output.
 *
 * Multi-pass transformer: parse → symbols → tree connectors → ANSI colors.
 * Pure string transform. Keeps renderFlow() domain-pure and LLM-readable.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const GREEN_BOLD = '\x1b[32;1m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const CYAN_BOLD = '\x1b[36;1m';

type Section =
  | 'header'
  | 'flow'
  | 'gate-header'
  | 'gate'
  | 'var-header'
  | 'var'
  | 'warn-header'
  | 'warn'
  | 'empty';

interface ParsedLine {
  text: string;
  section: Section;
  indent: number;
  isCurrent: boolean;
  isAncestor: boolean;
  isCompleted: boolean;
}

// ── Pass 1: Parse lines into structured format ──

function parseLines(lines: string[]): ParsedLine[] {
  let currentSection: Section = 'flow';
  return lines.map((line) => {
    const base: ParsedLine = {
      text: line,
      section: 'flow',
      indent: 0,
      isCurrent: false,
      isAncestor: false,
      isCompleted: false,
    };

    if (line.startsWith('[prompt-language]')) {
      currentSection = 'header';
      return { ...base, section: 'header' as const };
    }

    if (line.trim() === '') {
      return { ...base, section: 'empty' as const };
    }

    if (/^\s*done when:\s*$/.test(line)) {
      currentSection = 'gate';
      return { ...base, section: 'gate-header' as const };
    }

    if (currentSection === 'gate' && /^\s{2}/.test(line)) {
      return { ...base, section: 'gate' as const };
    }

    if (line === 'Variables:') {
      currentSection = 'var';
      return { ...base, section: 'var-header' as const };
    }

    if (currentSection === 'var' && /^\s{2}/.test(line)) {
      return { ...base, section: 'var' as const };
    }

    if (line === 'Warnings:') {
      currentSection = 'warn';
      return { ...base, section: 'warn-header' as const };
    }

    if (currentSection === 'warn') {
      return { ...base, section: 'warn' as const };
    }

    // Flow line — parse prefix and indent
    currentSection = 'flow';
    const prefixMatch = /^(> |~ | {2})(.*)$/.exec(line);
    const prefix = prefixMatch?.[1] ?? '';
    const rest = prefixMatch?.[2] ?? line;
    const indentMatch = /^( *)/.exec(rest);
    const indentLen = indentMatch?.[1]?.length ?? 0;
    const indent = Math.floor(indentLen / 2);
    const isCurrent = line.includes('<-- current');
    const isAncestor = prefix === '> ' && !isCurrent;
    const isCompleted = prefix === '~ ';

    return {
      text: line,
      section: 'flow' as const,
      indent,
      isCurrent,
      isAncestor,
      isCompleted,
    };
  });
}

// ── Pass 2: Symbol replacements ──

function replaceSymbols(line: string): string {
  // Progress bar: [###--] → [███░░]
  line = line.replace(
    /\[(#+)(-+)\]/g,
    (_m, filled: string, empty: string) =>
      `[${'█'.repeat(filled.length)}${'░'.repeat(empty.length)}]`,
  );

  // Current marker
  line = line.replace(/\s*<-- current$/, '  ◄ current');

  // Gate markers
  line = line.replace(/\[pass\]/g, '✓ pass');
  line = line.replace(/\[fail —/g, '✗ fail —');
  line = line.replace(/\[fail\]/g, '✗ fail');
  line = line.replace(/\[pending\]/g, '○ pending');

  return line;
}

// ── Pass 3: Tree connectors ──

function hasSiblingAfter(
  parsed: ParsedLine[],
  flowIndices: number[],
  fi: number,
  atIndent: number,
): boolean {
  for (let j = fi + 1; j < flowIndices.length; j++) {
    const other = parsed[flowIndices[j]!]!;
    if (other.indent < atIndent) return false;
    if (other.indent === atIndent) return true;
  }
  return false;
}

function buildTreePrefix(
  parsed: ParsedLine[],
  flowIndices: number[],
  fi: number,
  indent: number,
): string {
  if (indent === 0) return '';

  let prefix = '';
  for (let level = 0; level < indent - 1; level++) {
    prefix += hasSiblingAfter(parsed, flowIndices, fi, level + 1) ? '│ ' : '  ';
  }
  // At the direct parent level
  prefix += hasSiblingAfter(parsed, flowIndices, fi, indent) ? '├─' : '└─';
  return prefix;
}

function addTreeConnectors(parsed: ParsedLine[]): ParsedLine[] {
  const flowIndices: number[] = [];
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i]!.section === 'flow') flowIndices.push(i);
  }
  if (flowIndices.length === 0) return parsed;

  const result = [...parsed];
  for (let fi = 0; fi < flowIndices.length; fi++) {
    const idx = flowIndices[fi]!;
    const line = parsed[idx]!;
    if (line.indent === 0) continue;

    const treePrefix = buildTreePrefix(parsed, flowIndices, fi, line.indent);
    // Strip the original prefix (2 chars) and indentation (2*indent chars),
    // then rebuild with prefix + tree connector + content
    const prefixStr = line.text.slice(0, 2);
    const content = line.text.slice(2 + line.indent * 2);
    result[idx] = {
      ...line,
      text: `${prefixStr}${treePrefix}${content}`,
    };
  }
  return result;
}

// ── Pass 4: Apply ANSI colors ──

function applyColors(line: ParsedLine): string {
  const { text, section } = line;

  switch (section) {
    case 'header':
      return `${CYAN_BOLD}[PL]${RESET}${BOLD}${text.replace('[prompt-language]', '')}${RESET}`;

    case 'empty':
      return text;

    case 'gate-header':
      return text;

    case 'gate': {
      let colored = text;
      if (colored.includes('✓ pass')) {
        colored = colored.replace(/✓ pass/, `${GREEN}✓ pass${RESET}`);
      } else if (colored.includes('✗ fail')) {
        colored = colored.replace(/✗ fail/, `${RED}✗ fail${RESET}`);
      } else if (colored.includes('○ pending')) {
        colored = colored.replace(/○ pending/, `${YELLOW}○ pending${RESET}`);
      }
      // Fallback for raw markers (before symbol replacement)
      if (colored.includes('[pass]')) {
        colored = colored.replace('[pass]', `${GREEN}[pass]${RESET}`);
      }
      if (colored.includes('[fail]')) {
        colored = colored.replace('[fail]', `${RED}[fail]${RESET}`);
      }
      if (colored.includes('[pending]')) {
        colored = colored.replace('[pending]', `${YELLOW}[pending]${RESET}`);
      }
      return colored;
    }

    case 'var-header':
      return text;

    case 'var': {
      // Colorize variable values: "  key = value" → "  key = <cyan>value</cyan>"
      const varMatch = /^(\s+\S+\s+=\s+)(.+)$/.exec(text);
      if (varMatch?.[1] && varMatch[2]) {
        return `${varMatch[1]}${CYAN}${varMatch[2]}${RESET}`;
      }
      return text;
    }

    case 'warn-header':
      return text;

    case 'warn':
      return `${YELLOW}${text}${RESET}`;

    case 'flow':
      return colorizeFlowLine(line);
  }
}

function colorizeFlowLine(line: ParsedLine): string {
  let text = line.text;

  // Dim tree connectors throughout the line
  text = text.replace(/[│├└─]/g, (ch) => `${DIM}${ch}${RESET}`);

  if (line.isCurrent) {
    // Current node: green + bold for the whole line
    return `${GREEN_BOLD}${text}${RESET}`;
  }

  if (line.isCompleted) {
    // Completed/past node: dim
    return `${DIM}${text}${RESET}`;
  }

  if (line.isAncestor) {
    // Ancestor scope: yellow
    return `${YELLOW}${text}${RESET}`;
  }

  return text;
}

// ── Main entry point ──

export function colorizeFlow(rendered: string): string {
  const lines = rendered.split('\n');
  const parsed = parseLines(lines);
  const withTree = addTreeConnectors(parsed);
  // Apply symbols then colors
  return withTree
    .map((line) => ({ ...line, text: replaceSymbols(line.text) }))
    .map(applyColors)
    .join('\n');
}
