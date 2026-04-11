interface SwarmRoleTemplate {
  readonly name: string;
  readonly bodyLines: readonly string[];
  readonly cwd?: string | undefined;
  readonly model?: string | undefined;
  readonly vars?: readonly string[] | undefined;
  readonly returnExpression?: string | undefined;
}

export interface LowerSwarmFlowLinesResult {
  readonly lines: readonly string[];
  readonly changed: boolean;
  readonly warnings: readonly string[];
}

export interface ExpandSwarmDocumentResult {
  readonly text: string;
  readonly changed: boolean;
  readonly warnings: readonly string[];
  readonly loweredFlowText?: string | undefined;
}

const INDENT = '  ';
const DEFAULT_SWARM_RECEIVE_TIMEOUT_SECONDS = 30;

function currentIndent(line: string): number {
  const match = /^(\s*)/.exec(line);
  return match?.[1]?.length ?? 0;
}

function stripComment(line: string): string {
  return line.replace(/#.*$/, '');
}

function normalizeKeyword(trimmed: string): string {
  return trimmed.replace(/^\w+:\s+(while|until|retry|foreach)\b/i, '$1');
}

function isBlockOpener(trimmed: string): boolean {
  const normalized = normalizeKeyword(trimmed).toLowerCase();
  return (
    normalized.startsWith('while ') ||
    normalized.startsWith('until ') ||
    normalized.startsWith('retry') ||
    normalized.startsWith('if ') ||
    normalized === 'try' ||
    normalized.startsWith('foreach ') ||
    normalized.startsWith('spawn ') ||
    normalized === 'race' ||
    normalized.startsWith('race ') ||
    normalized.startsWith('foreach-spawn ') ||
    normalized === 'review' ||
    normalized.startsWith('review ')
  );
}

function stripBaseIndent(line: string, baseIndent: number): string {
  if (!line.trim()) return '';
  return line.startsWith(' '.repeat(baseIndent)) ? line.slice(baseIndent) : line.trimStart();
}

function indentLine(line: string, levels: number): string {
  if (!line.trim()) return '';
  return `${INDENT.repeat(levels)}${line}`;
}

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^\w-]/g, '_');
}

function parseIdentifierList(source: string): string[] {
  return source
    .split(',')
    .flatMap((part) => part.trim().split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatSpawnHeader(role: SwarmRoleTemplate): string {
  let header = `spawn "${role.name}"`;
  if (role.cwd != null) {
    header += ` in "${role.cwd}"`;
  }
  if (role.model != null) {
    header += ` model "${role.model}"`;
  }
  if (role.vars != null && role.vars.length > 0) {
    header += ` with vars ${role.vars.join(', ')}`;
  }
  return header;
}

function formatLiteralAssignment(name: string, value: string): string {
  return `let ${name} = "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function formatInterpolatedAssignment(name: string, expression: string): string {
  const trimmed = expression.trim();
  return `let ${name} = ${trimmed}`;
}

function formatReturnTransport(expression: string): string[] {
  const trimmed = expression.trim();
  const assignment =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? `let __swarm_return = ${trimmed}`
      : formatInterpolatedAssignment('__swarm_return', trimmed);

  return [assignment, 'send parent "${__swarm_return}"'];
}

function collectNestedBlock(
  lines: readonly string[],
  startIndex: number,
  headerIndent: number,
): { readonly lines: readonly string[]; readonly endIndex: number; readonly missingEnd: boolean } {
  const bodyLines: string[] = [];
  let depth = 0;
  let index = startIndex + 1;

  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = stripComment(line).trim();
    const indent = currentIndent(line);

    if (!trimmed) {
      bodyLines.push(stripBaseIndent(line, headerIndent + INDENT.length));
      continue;
    }

    if (indent === headerIndent && trimmed.toLowerCase() === 'end' && depth === 0) {
      return { lines: bodyLines, endIndex: index, missingEnd: false };
    }

    const normalized = normalizeKeyword(trimmed);
    if (isBlockOpener(normalized)) {
      depth += 1;
    } else if (trimmed.toLowerCase() === 'end' && depth > 0) {
      depth -= 1;
    }

    bodyLines.push(stripBaseIndent(line, headerIndent + INDENT.length));
  }

  return { lines: bodyLines, endIndex: lines.length - 1, missingEnd: true };
}

function parseRoleOptions(rest: string): {
  readonly cwd?: string | undefined;
  readonly model?: string | undefined;
  readonly vars?: readonly string[] | undefined;
} {
  let remaining = rest.trim();
  let cwd: string | undefined;
  let model: string | undefined;
  let vars: string[] | undefined;

  while (remaining.length > 0) {
    const modelMatch = /^model\s+(?:"([^"]+)"|'([^']+)')\s*/i.exec(remaining);
    if (modelMatch) {
      model = modelMatch[1] ?? modelMatch[2];
      remaining = remaining.slice(modelMatch[0].length).trim();
      continue;
    }

    const cwdMatch = /^in\s+(?:"([^"]+)"|'([^']+)')\s*/i.exec(remaining);
    if (cwdMatch) {
      cwd = cwdMatch[1] ?? cwdMatch[2];
      remaining = remaining.slice(cwdMatch[0].length).trim();
      continue;
    }

    const varsMatch = /^with vars\s+([A-Za-z_][\w-]*(?:\s*,\s*[A-Za-z_][\w-]*)*)\s*/i.exec(
      remaining,
    );
    if (varsMatch?.[1]) {
      vars = varsMatch[1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      remaining = remaining.slice(varsMatch[0].length).trim();
      continue;
    }

    break;
  }

  return {
    ...(cwd != null ? { cwd } : {}),
    ...(model != null ? { model } : {}),
    ...(vars != null ? { vars } : {}),
  };
}

function parseRoleBlock(
  swarmName: string,
  lines: readonly string[],
  startIndex: number,
  warnings: string[],
): { readonly role: SwarmRoleTemplate | null; readonly nextIndex: number } {
  const headerLine = lines[startIndex] ?? '';
  const headerIndent = currentIndent(headerLine);
  const trimmed = stripComment(headerLine).trim();
  const match = /^role\s+([A-Za-z_][\w-]*)(.*)$/i.exec(trimmed);
  if (!match?.[1]) {
    warnings.push(`Invalid swarm role header: "${trimmed}"`);
    return { role: null, nextIndex: startIndex };
  }

  const name = match[1];
  const { cwd, model, vars } = parseRoleOptions(match[2] ?? '');
  const block = collectNestedBlock(lines, startIndex, headerIndent);
  if (block.missingEnd) {
    warnings.push(`swarm ${swarmName} role ${name} is missing a closing "end"`);
  }

  let returnExpression: string | undefined;
  const bodyLines: string[] = [];

  for (const relativeLine of block.lines) {
    const trimmedBody = stripComment(relativeLine).trim();
    if (trimmedBody.toLowerCase().startsWith('return ')) {
      returnExpression = trimmedBody.slice('return '.length).trim();
      continue;
    }
    bodyLines.push(relativeLine);
  }

  return {
    role: {
      name,
      bodyLines,
      ...(cwd != null ? { cwd } : {}),
      ...(model != null ? { model } : {}),
      ...(vars != null ? { vars } : {}),
      ...(returnExpression != null ? { returnExpression } : {}),
    },
    nextIndex: block.endIndex,
  };
}

function parseFlowBlock(
  swarmName: string,
  lines: readonly string[],
  startIndex: number,
  warnings: string[],
): { readonly bodyLines: readonly string[]; readonly nextIndex: number } {
  const headerLine = lines[startIndex] ?? '';
  const headerIndent = currentIndent(headerLine);
  const trimmed = stripComment(headerLine).trim();
  if (trimmed.toLowerCase() !== 'flow:') {
    warnings.push(`swarm ${swarmName} is missing a "flow:" block`);
    return { bodyLines: [], nextIndex: startIndex };
  }

  const block = collectNestedBlock(lines, startIndex, headerIndent);
  if (block.missingEnd) {
    warnings.push(`swarm ${swarmName} flow block is missing a closing "end"`);
  }
  return { bodyLines: block.lines, nextIndex: block.endIndex };
}

function lowerAwaitTargets(
  swarmName: string,
  roleNames: readonly string[],
  roles: ReadonlyMap<string, SwarmRoleTemplate>,
  warnings: string[],
  baseIndentLevel: number,
): string[] {
  const lowered: string[] = [];
  const safeSwarm = sanitizeIdentifier(swarmName);

  for (const roleName of roleNames) {
    if (!roles.has(roleName)) {
      warnings.push(`swarm ${swarmName} await references unknown role "${roleName}"`);
      continue;
    }
    const safeRole = sanitizeIdentifier(roleName);
    lowered.push(indentLine(`await "${roleName}"`, baseIndentLevel));
    lowered.push(
      indentLine(
        `receive __${safeSwarm}_${safeRole}_returned from "${roleName}" timeout ${DEFAULT_SWARM_RECEIVE_TIMEOUT_SECONDS}`,
        baseIndentLevel,
      ),
    );
  }

  return lowered;
}

function lowerSwarmBlock(
  swarmName: string,
  bodyLines: readonly string[],
  roles: ReadonlyMap<string, SwarmRoleTemplate>,
  warnings: string[],
): string[] {
  const lowered: string[] = [];
  const startedRoles: string[] = [];

  for (const line of bodyLines) {
    const trimmed = stripComment(line).trim();
    const indentLevel = Math.floor(currentIndent(line) / INDENT.length);

    if (!trimmed) {
      lowered.push('');
      continue;
    }

    if (trimmed.toLowerCase().startsWith('start ')) {
      const roleNames = parseIdentifierList(trimmed.slice('start '.length));
      for (const roleName of roleNames) {
        const role = roles.get(roleName);
        if (!role) {
          warnings.push(`swarm ${swarmName} start references unknown role "${roleName}"`);
          continue;
        }

        if (!startedRoles.includes(roleName)) {
          startedRoles.push(roleName);
        }

        lowered.push(indentLine(formatSpawnHeader(role), indentLevel));
        lowered.push(indentLine(formatLiteralAssignment('__swarm_id', swarmName), indentLevel + 1));
        lowered.push(
          indentLine(formatLiteralAssignment('__swarm_role', role.name), indentLevel + 1),
        );
        for (const roleLine of role.bodyLines) {
          lowered.push(indentLine(roleLine, indentLevel + 1));
        }
        if (role.returnExpression != null) {
          for (const transportLine of formatReturnTransport(role.returnExpression)) {
            lowered.push(indentLine(transportLine, indentLevel + 1));
          }
        }
        lowered.push(indentLine('end', indentLevel));
      }
      continue;
    }

    if (trimmed.toLowerCase() === 'await all') {
      lowered.push(...lowerAwaitTargets(swarmName, startedRoles, roles, warnings, indentLevel));
      continue;
    }

    if (trimmed.toLowerCase().startsWith('await ')) {
      const roleNames = parseIdentifierList(trimmed.slice('await '.length));
      lowered.push(...lowerAwaitTargets(swarmName, roleNames, roles, warnings, indentLevel));
      continue;
    }

    lowered.push(line);
  }

  return lowered;
}

function parseSwarm(
  lines: readonly string[],
  startIndex: number,
  warnings: string[],
): { readonly loweredLines: readonly string[]; readonly nextIndex: number } | null {
  const swarmLine = lines[startIndex] ?? '';
  const swarmIndent = currentIndent(swarmLine);
  const trimmed = stripComment(swarmLine).trim();
  const match = /^swarm\s+([A-Za-z_][\w-]*)$/i.exec(trimmed);
  if (!match?.[1]) {
    return null;
  }

  const swarmName = match[1];
  const roles = new Map<string, SwarmRoleTemplate>();
  let flowBody: readonly string[] = [];
  let index = startIndex + 1;
  let foundEnd = false;

  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineTrimmed = stripComment(line).trim();
    const indent = currentIndent(line);

    if (!lineTrimmed) {
      continue;
    }

    if (indent === swarmIndent && lineTrimmed.toLowerCase() === 'end') {
      foundEnd = true;
      break;
    }

    if (indent !== swarmIndent + INDENT.length) {
      continue;
    }

    if (lineTrimmed.toLowerCase().startsWith('role ')) {
      const parsedRole = parseRoleBlock(swarmName, lines, index, warnings);
      if (parsedRole.role != null) {
        roles.set(parsedRole.role.name, parsedRole.role);
      }
      index = parsedRole.nextIndex;
      continue;
    }

    if (lineTrimmed.toLowerCase() === 'flow:') {
      const parsedFlow = parseFlowBlock(swarmName, lines, index, warnings);
      flowBody = parsedFlow.bodyLines;
      index = parsedFlow.nextIndex;
      continue;
    }
  }

  if (!foundEnd) {
    warnings.push(`swarm ${swarmName} is missing a closing "end"`);
  }

  if (flowBody.length === 0) {
    warnings.push(`swarm ${swarmName} has no lowering flow body`);
  }

  const lowered = lowerSwarmBlock(swarmName, flowBody, roles, warnings).map((line) =>
    indentLine(line, Math.floor(swarmIndent / INDENT.length)),
  );

  return { loweredLines: lowered, nextIndex: index };
}

export function lowerSwarmFlowLines(lines: readonly string[]): LowerSwarmFlowLinesResult {
  const lowered: string[] = [];
  const warnings: string[] = [];
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const parsed = parseSwarm(lines, index, warnings);
    if (!parsed) {
      lowered.push(line);
      continue;
    }

    lowered.push(...parsed.loweredLines);
    index = parsed.nextIndex;
    changed = true;
  }

  return { lines: lowered, changed, warnings };
}

export function expandSwarmDocument(input: string): ExpandSwarmDocumentResult {
  const flowMatch = /^\s*flow:\s*\n/im.exec(input);
  if (!flowMatch) {
    return { text: input, changed: false, warnings: [] };
  }

  const start = flowMatch.index + flowMatch[0].length;
  const doneIdx = input.search(/\n\s*done when:/im);
  const end = doneIdx >= 0 ? doneIdx : input.length;
  const flowLines = input.slice(start, end).split('\n');
  const expansion = lowerSwarmFlowLines(flowLines);

  if (!expansion.changed) {
    return { text: input, changed: false, warnings: [...expansion.warnings] };
  }

  return {
    text: `${input.slice(0, start)}${expansion.lines.join('\n')}${input.slice(end)}`,
    changed: true,
    warnings: [...expansion.warnings],
    loweredFlowText: `flow:\n${expansion.lines.join('\n')}`,
  };
}
