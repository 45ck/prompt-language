/**
 * renderTelemetry — Pure render telemetry model and byte composition metrics.
 *
 * Provides machine-readable measurement of rendered flow output, including
 * stable vs dynamic byte analysis and per-section byte composition.
 */

/** Telemetry snapshot for a single render pass. */
export interface RenderTelemetry {
  readonly promptBytes: number;
  readonly stableBytes: number;
  readonly dynamicBytes: number;
  readonly variableCount: number;
  readonly variableBytes: number;
  readonly commandOutputBytes: number;
  readonly gateCount: number;
  readonly turnCount: number;
  readonly hookTimingMs?: Readonly<Record<string, number>>;
  readonly fallbackCount: number;
  readonly recoveryIncidents: number;
}

/** Per-section byte breakdown of a rendered flow. */
export interface ByteComposition {
  readonly headerBytes: number;
  readonly declarationBytes: number;
  readonly nodeTreeBytes: number;
  readonly gateBytes: number;
  readonly variableBytes: number;
  readonly warningBytes: number;
  readonly captureReminderBytes: number;
  readonly totalBytes: number;
}

/** Create a RenderTelemetry with sensible defaults. */
export function createRenderTelemetry(overrides: Partial<RenderTelemetry> = {}): RenderTelemetry {
  return {
    promptBytes: 0,
    stableBytes: 0,
    dynamicBytes: 0,
    variableCount: 0,
    variableBytes: 0,
    commandOutputBytes: 0,
    gateCount: 0,
    turnCount: 0,
    fallbackCount: 0,
    recoveryIncidents: 0,
    ...overrides,
  };
}

/**
 * Compute stable vs dynamic bytes by diffing current and previous renders.
 *
 * Stable bytes are lines that appear identically in both renders.
 * Dynamic bytes are lines that changed, were added, or were removed.
 * When there is no previous render, all bytes are dynamic.
 */
export function computeTelemetry(
  rendered: string,
  previousRendered?: string,
): Pick<RenderTelemetry, 'promptBytes' | 'stableBytes' | 'dynamicBytes'> {
  const promptBytes = byteLength(rendered);

  if (previousRendered === undefined) {
    return { promptBytes, stableBytes: 0, dynamicBytes: promptBytes };
  }

  const currentLines = rendered.split('\n');
  const previousLines = previousRendered.split('\n');

  // Build a multiset of previous lines for matching
  const previousCounts = new Map<string, number>();
  for (const line of previousLines) {
    previousCounts.set(line, (previousCounts.get(line) ?? 0) + 1);
  }

  let stableBytes = 0;
  const matchedLines: boolean[] = [];

  for (const line of currentLines) {
    const count = previousCounts.get(line) ?? 0;
    if (count > 0) {
      previousCounts.set(line, count - 1);
      stableBytes += byteLength(line);
      matchedLines.push(true);
    } else {
      matchedLines.push(false);
    }
  }

  // Account for newline separators: stable newlines are between consecutive stable lines
  for (let i = 0; i < matchedLines.length - 1; i++) {
    if (matchedLines[i] && matchedLines[i + 1]) {
      stableBytes += 1; // newline character
    }
  }

  const dynamicBytes = promptBytes - stableBytes;

  return { promptBytes, stableBytes, dynamicBytes };
}

/**
 * Measure per-section byte composition of a rendered flow string.
 *
 * Parses the rendered output by recognizing section boundaries:
 * - Header: first line (the [prompt-language] line)
 * - Declarations: lines between header and first node (rubric/judge/profile blocks)
 * - Node tree: indented flow node lines
 * - Gates: lines after "done when:" header
 * - Variables: lines after "Variables:" header
 * - Warnings: lines after "Warnings:" header
 * - Capture reminder: final [Capture active:...] line
 */
export function measureByteComposition(rendered: string): ByteComposition {
  const lines = rendered.split('\n');
  const totalBytes = byteLength(rendered);

  if (lines.length === 0) {
    return {
      headerBytes: 0,
      declarationBytes: 0,
      nodeTreeBytes: 0,
      gateBytes: 0,
      variableBytes: 0,
      warningBytes: 0,
      captureReminderBytes: 0,
      totalBytes: 0,
    };
  }

  // Classify each line into a section
  type Section =
    | 'header'
    | 'declaration'
    | 'nodeTree'
    | 'gate'
    | 'variable'
    | 'warning'
    | 'captureReminder';

  const sectionLines: Record<Section, string[]> = {
    header: [],
    declaration: [],
    nodeTree: [],
    gate: [],
    variable: [],
    warning: [],
    captureReminder: [],
  };

  let current: Section = 'header';
  let headerDone = false;
  let inDeclarations = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // First line is always header
    if (i === 0) {
      sectionLines.header.push(line);
      continue;
    }

    // Check for section transitions
    if (line === 'done when:') {
      current = 'gate';
      sectionLines.gate.push(line);
      continue;
    }
    if (line === 'Variables:') {
      current = 'variable';
      sectionLines.variable.push(line);
      continue;
    }
    if (line === 'Warnings:') {
      current = 'warning';
      sectionLines.warning.push(line);
      continue;
    }
    if (line.startsWith('[Capture active:')) {
      sectionLines.captureReminder.push(line);
      current = 'captureReminder';
      continue;
    }

    // Blank line after header transitions to declarations or node tree
    if (!headerDone && line === '') {
      headerDone = true;
      // Blank line is part of header section (separator)
      sectionLines.header.push(line);
      continue;
    }

    if (headerDone && !inDeclarations && current === 'header') {
      // Check if this is a declaration (rubric/judge/profile) or a node
      if (isDeclarationLine(line)) {
        inDeclarations = true;
        current = 'declaration';
      } else {
        current = 'nodeTree';
      }
    }

    // A blank line after declarations transitions to node tree
    if (inDeclarations && line === '' && current === 'declaration') {
      sectionLines.declaration.push(line);
      current = 'nodeTree';
      inDeclarations = false;
      continue;
    }

    sectionLines[current].push(line);
  }

  return {
    headerBytes: sectionByteLength(sectionLines.header),
    declarationBytes: sectionByteLength(sectionLines.declaration),
    nodeTreeBytes: sectionByteLength(sectionLines.nodeTree),
    gateBytes: sectionByteLength(sectionLines.gate),
    variableBytes: sectionByteLength(sectionLines.variable),
    warningBytes: sectionByteLength(sectionLines.warning),
    captureReminderBytes: sectionByteLength(sectionLines.captureReminder),
    totalBytes,
  };
}

/** UTF-8 byte length of a string. */
function byteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair — 4 bytes for the full code point
      bytes += 4;
      i++; // skip low surrogate
    } else bytes += 3;
  }
  return bytes;
}

/** Byte length of a section's lines joined by newlines. */
function sectionByteLength(lines: readonly string[]): number {
  if (lines.length === 0) return 0;
  return byteLength(lines.join('\n'));
}

/** Check if a line looks like a declaration (rubric, judge, profile). */
function isDeclarationLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('rubric:') ||
    trimmed.startsWith('judge:') ||
    trimmed.startsWith('use profile ')
  );
}
