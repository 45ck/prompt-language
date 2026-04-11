import type { SessionState } from '../../domain/session-state.js';

function gateMarker(result: boolean | undefined): string {
  if (result === true) return '+';
  if (result === false) return '-';
  return '?';
}

export function buildCompactGateStatusLine(state: SessionState): string | null {
  const predicates = Array.from(
    new Set(
      state.flowSpec.completionGates
        .map((gate) => gate.predicate)
        .filter((predicate): predicate is string => predicate.trim().length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));

  if (predicates.length === 0) {
    return null;
  }

  const labels = predicates.map(
    (predicate) => `${gateMarker(state.gateResults[predicate])}${predicate}`,
  );
  return `gates: ${labels.join(' ')}`;
}

export function renderCompactGateStatus(compact: string, state: SessionState): string {
  const line = buildCompactGateStatusLine(state);
  if (line === null) {
    return compact;
  }

  const lines = compact.split('\n');
  if (lines.length === 0) {
    return compact;
  }

  const gateLineIndexes = lines
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value.startsWith('gates: '))
    .map(({ index }) => index);

  if (gateLineIndexes.length === 0) {
    return compact.length > 0 ? `${compact}\n${line}` : line;
  }

  const nextLines = [...lines];
  nextLines[gateLineIndexes[0]!] = line;

  for (let i = gateLineIndexes.length - 1; i >= 1; i -= 1) {
    nextLines.splice(gateLineIndexes[i]!, 1);
  }

  return nextLines.join('\n');
}
