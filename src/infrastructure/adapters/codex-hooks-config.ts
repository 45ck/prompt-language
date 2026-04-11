export type CodexHooksOwnership = 'absent' | 'managed' | 'user-owned' | 'conflict';

export interface CodexHooksConfigSnapshot {
  readonly ownership: CodexHooksOwnership;
  readonly enabled: boolean;
}

export interface CodexHooksMutation {
  readonly outcome:
    | 'already-enabled'
    | 'updated'
    | 'user-owned'
    | 'conflict'
    | 'removed'
    | 'not-managed';
  readonly raw: string;
  readonly snapshot: CodexHooksConfigSnapshot;
}

const MANAGED_MARKER = 'prompt-language managed: codex_hooks';
const MANAGED_SECTION_COMMENT = '# prompt-language managed section: codex_hooks';
const SCAFFOLD_HEADER_LINES = [
  '# prompt-language Codex scaffold.',
  '# Codex hooks are experimental; opt in explicitly before using the local install.',
] as const;
const MANAGED_LINE = `codex_hooks = true # ${MANAGED_MARKER}`;
const SECTION_PATTERN = /^\s*\[(.+?)\]\s*$/;
const CODEX_HOOKS_PATTERN = /^\s*codex_hooks\s*=\s*(true|false)\s*(#.*)?$/i;

interface CodexHooksEntry {
  readonly index: number;
  readonly section: string | null;
  readonly managed: boolean;
  readonly enabled: boolean;
}

interface ParsedCodexHooksConfig {
  readonly normalized: string;
  readonly lines: string[];
  readonly featuresSectionStart: number;
  readonly featuresSectionEnd: number;
  readonly entries: readonly CodexHooksEntry[];
}

export function createManagedCodexHooksConfig(): string {
  return (
    `${SCAFFOLD_HEADER_LINES.join('\n')}\n\n` +
    `${MANAGED_SECTION_COMMENT}\n` +
    '[features]\n' +
    `${MANAGED_LINE}\n`
  );
}

export function inspectCodexHooksConfig(raw: string): CodexHooksConfigSnapshot {
  return inspectParsedCodexHooksConfig(parseCodexHooksConfig(raw));
}

export function enableManagedCodexHooks(raw: string): CodexHooksMutation {
  const parsed = parseCodexHooksConfig(raw);
  const snapshot = inspectParsedCodexHooksConfig(parsed);

  if (snapshot.ownership === 'conflict') {
    return {
      outcome: 'conflict',
      raw: ensureTrailingNewline(parsed.normalized),
      snapshot,
    };
  }

  if (snapshot.ownership === 'user-owned') {
    return {
      outcome: 'user-owned',
      raw: ensureTrailingNewline(parsed.normalized),
      snapshot,
    };
  }

  if (snapshot.ownership === 'managed' && snapshot.enabled) {
    return {
      outcome: 'already-enabled',
      raw: ensureTrailingNewline(parsed.normalized),
      snapshot,
    };
  }

  const lines = [...parsed.lines];

  if (snapshot.ownership === 'managed') {
    const managedEntry = parsed.entries.find(
      (entry) => entry.section === 'features' && entry.managed,
    );
    if (managedEntry == null) {
      return {
        outcome: 'conflict',
        raw: ensureTrailingNewline(parsed.normalized),
        snapshot: { ownership: 'conflict', enabled: snapshot.enabled },
      };
    }
    lines[managedEntry.index] = MANAGED_LINE;
  } else if (parsed.featuresSectionStart === -1) {
    const prefix = parsed.normalized.trim().length > 0 ? `${parsed.normalized.trimEnd()}\n\n` : '';
    return finalizeCodexHooksMutation(
      'updated',
      `${prefix}${MANAGED_SECTION_COMMENT}\n[features]\n${MANAGED_LINE}\n`,
    );
  } else {
    let insertionIndex = parsed.featuresSectionEnd;
    while (
      insertionIndex > parsed.featuresSectionStart + 1 &&
      (lines[insertionIndex - 1] ?? '').trim() === ''
    ) {
      insertionIndex -= 1;
    }
    lines.splice(insertionIndex, 0, MANAGED_LINE);
  }

  return finalizeCodexHooksMutation('updated', lines.join('\n'));
}

export function disableManagedCodexHooks(raw: string): CodexHooksMutation {
  const parsed = parseCodexHooksConfig(raw);
  const snapshot = inspectParsedCodexHooksConfig(parsed);

  if (snapshot.ownership === 'conflict') {
    return {
      outcome: 'conflict',
      raw: ensureTrailingNewline(parsed.normalized),
      snapshot,
    };
  }

  if (snapshot.ownership !== 'managed') {
    return {
      outcome: 'not-managed',
      raw: ensureTrailingNewline(parsed.normalized),
      snapshot,
    };
  }

  const lines = parsed.lines.filter(
    (_, index) =>
      !parsed.entries.some(
        (entry) => entry.section === 'features' && entry.managed && entry.index === index,
      ),
  );

  return finalizeCodexHooksMutation('removed', cleanupManagedArtifacts(lines).join('\n'));
}

function finalizeCodexHooksMutation(
  outcome: CodexHooksMutation['outcome'],
  raw: string,
): CodexHooksMutation {
  const normalized = ensureTrailingNewline(raw);
  return {
    outcome,
    raw: normalized,
    snapshot: inspectCodexHooksConfig(normalized),
  };
}

function parseCodexHooksConfig(raw: string): ParsedCodexHooksConfig {
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const entries: CodexHooksEntry[] = [];

  let currentSection: string | null = null;
  let featuresSectionStart = -1;
  let featuresSectionEnd = lines.length;

  for (const [index, line] of lines.entries()) {
    const sectionMatch = SECTION_PATTERN.exec(line);
    if (sectionMatch != null) {
      const sectionName = sectionMatch[1]?.trim() ?? '';
      if (
        currentSection === 'features' &&
        featuresSectionStart >= 0 &&
        featuresSectionEnd === lines.length
      ) {
        featuresSectionEnd = index;
      }
      currentSection = sectionName;
      if (sectionName === 'features' && featuresSectionStart === -1) {
        featuresSectionStart = index;
      }
      continue;
    }

    const entryMatch = CODEX_HOOKS_PATTERN.exec(line);
    if (entryMatch == null) {
      continue;
    }

    const comment = entryMatch[2] ?? '';
    entries.push({
      index,
      section: currentSection,
      managed: comment.includes(MANAGED_MARKER),
      enabled: entryMatch[1]?.toLowerCase() === 'true',
    });
  }

  return {
    normalized,
    lines,
    featuresSectionStart,
    featuresSectionEnd,
    entries,
  };
}

function inspectParsedCodexHooksConfig(parsed: ParsedCodexHooksConfig): CodexHooksConfigSnapshot {
  const strayEntries = parsed.entries.filter((entry) => entry.section !== 'features');
  if (strayEntries.length > 0) {
    return { ownership: 'conflict', enabled: strayEntries.some((entry) => entry.enabled) };
  }

  const featureEntries = parsed.entries.filter((entry) => entry.section === 'features');
  if (featureEntries.length === 0) {
    return { ownership: 'absent', enabled: false };
  }

  const managedEntries = featureEntries.filter((entry) => entry.managed);
  const userEntries = featureEntries.filter((entry) => !entry.managed);

  if (managedEntries.length === 1 && userEntries.length === 0) {
    return { ownership: 'managed', enabled: managedEntries[0]?.enabled ?? false };
  }

  if (managedEntries.length === 0 && userEntries.length === 1) {
    return { ownership: 'user-owned', enabled: userEntries[0]?.enabled ?? false };
  }

  return { ownership: 'conflict', enabled: featureEntries.some((entry) => entry.enabled) };
}

function ensureTrailingNewline(raw: string): string {
  if (raw.length === 0) {
    return '';
  }

  return raw.endsWith('\n') ? raw : `${raw}\n`;
}

function cleanupManagedArtifacts(lines: readonly string[]): string[] {
  const nextLines = trimLeadingEmptyLines(
    lines.filter((line) => line !== MANAGED_SECTION_COMMENT && !SCAFFOLD_HEADER_LINES.includes(line)),
  );
  return cleanupEmptyFeaturesSection(nextLines);
}

function cleanupEmptyFeaturesSection(lines: readonly string[]): string[] {
  const nextLines = [...lines];
  const featuresIndex = nextLines.findIndex((line) => line.trim() === '[features]');
  if (featuresIndex < 0) {
    return trimTrailingEmptyLines(nextLines);
  }

  let nextSectionIndex = nextLines.length;
  for (let index = featuresIndex + 1; index < nextLines.length; index += 1) {
    if (SECTION_PATTERN.test(nextLines[index] ?? '')) {
      nextSectionIndex = index;
      break;
    }
  }

  const sectionLines = nextLines.slice(featuresIndex + 1, nextSectionIndex);
  if (sectionLines.some((line) => line.trim().length > 0)) {
    return trimTrailingEmptyLines(nextLines);
  }

  let removeStart = featuresIndex;
  if (removeStart > 0 && nextLines[removeStart - 1]?.trim() === '') {
    removeStart -= 1;
  }

  nextLines.splice(removeStart, nextSectionIndex - removeStart);
  return trimTrailingEmptyLines(nextLines);
}

function trimTrailingEmptyLines(lines: readonly string[]): string[] {
  const nextLines = [...lines];
  while (nextLines.length > 0 && nextLines[nextLines.length - 1]?.trim() === '') {
    nextLines.pop();
  }
  return nextLines;
}

function trimLeadingEmptyLines(lines: readonly string[]): string[] {
  const nextLines = [...lines];
  while (nextLines.length > 0 && nextLines[0]?.trim() === '') {
    nextLines.shift();
  }
  return nextLines;
}
