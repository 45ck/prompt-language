import type { JudgeDefinition } from './flow-spec.js';

export type JudgeKind = 'model' | 'code' | 'human';

function findScalarValue(lines: readonly string[], key: string): string | undefined {
  const pattern = new RegExp(`^${key}:\\s*(.+)$`, 'i');
  for (const line of lines) {
    const match = pattern.exec(line.trim());
    if (!match?.[1]) continue;
    const value = match[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

export function extractJudgeKind(judge: JudgeDefinition): JudgeKind | 'unknown' {
  const raw = findScalarValue(judge.lines, 'kind')?.toLowerCase();
  if (raw === undefined || raw === 'model' || raw === 'code' || raw === 'human') {
    return raw ?? 'model';
  }
  return 'unknown';
}

export function extractJudgeModel(judge: JudgeDefinition): string | undefined {
  return findScalarValue(judge.lines, 'model');
}

export function extractJudgeInputs(judge: JudgeDefinition): readonly string[] {
  const raw = findScalarValue(judge.lines, 'inputs');
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  return body
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter((entry) => entry.length > 0);
}
