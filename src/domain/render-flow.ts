/**
 * renderFlow — Pure visualization of a flow program with execution state.
 *
 * Reconstructs the DSL text from FlowSpec nodes and annotates it with
 * the current execution position, loop progress, gate results, and variables.
 */

import type { FlowNode, ForeachNode, IfNode, LetNode, SpawnNode, TryNode } from './flow-node.js';
import type { SessionState } from './session-state.js';
import { isAskCondition, extractAskQuestion } from './judge-prompt.js';

// D04-fix: Simple FNV-1a string hash — replaces node:crypto to keep domain zero-dep
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// H-PERF-001: Compute a hash of render-relevant state to detect unchanged renders
export function renderStateHash(state: SessionState): string {
  const data = JSON.stringify({
    p: state.currentNodePath,
    n: state.nodeProgress,
    g: state.gateResults,
    s: state.status,
  });
  return fnv1aHash(data);
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isAncestorPath(ancestor: readonly number[], descendant: readonly number[]): boolean {
  if (ancestor.length >= descendant.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) return false;
  }
  return true;
}

// H#32: Visual progress bar for loop nodes
function progressAnnotation(state: SessionState, nodeId: string): string {
  const progress = state.nodeProgress[nodeId];
  if (!progress) return '';
  const done = progress.iteration;
  const total = progress.maxIterations;
  const barWidth = 5;
  const filled = Math.min(barWidth, Math.round((done / total) * barWidth));
  const bar = '#'.repeat(filled) + '-'.repeat(barWidth - filled);
  return ` [${bar}] ${done}/${total}`;
}

// H-DX-002: Show elapsed time for completed nodes (>0.5s)
function timingAnnotation(state: SessionState, nodeId: string): string {
  const progress = state.nodeProgress[nodeId];
  if (!progress?.startedAt || !progress.completedAt) return '';
  const elapsed = (progress.completedAt - progress.startedAt) / 1000;
  if (elapsed <= 0.5) return '';
  return ` [${elapsed.toFixed(1)}s]`;
}

function isCompletedNode(path: readonly number[], currentPath: readonly number[]): boolean {
  if (path.length === 0 || currentPath.length < path.length) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] !== currentPath[i]) return false;
  }
  return path[path.length - 1]! < currentPath[path.length - 1]!;
}

function renderNode(
  node: FlowNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const currentPath = state.currentNodePath;
  const isCurrent = arraysEqual(path, currentPath);
  const isAncestor = isAncestorPath(path, currentPath);
  const completed = !isCurrent && !isAncestor && isCompletedNode(path, currentPath);
  const prefix = isCurrent || isAncestor ? '> ' : completed ? '~ ' : '  ';
  const suffix = isCurrent ? '  <-- current' : '';

  switch (node.kind) {
    case 'prompt':
      return [`${prefix}${indent}prompt: ${node.text}${suffix}`];
    case 'run': {
      const timeoutTag = node.timeoutMs ? ` [timeout ${node.timeoutMs / 1000}s]` : '';
      return [`${prefix}${indent}run: ${node.command}${timeoutTag}${suffix}`];
    }
    case 'while': {
      const whileLabel = node.label ? `${node.label}: ` : '';
      const whileTimeout = node.timeoutSeconds ? ` timeout ${node.timeoutSeconds}` : '';
      const whileCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      return renderLoopNode(
        `${whileLabel}while ${whileCond} max ${node.maxIterations}${whileTimeout}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    }
    case 'until': {
      const untilLabel = node.label ? `${node.label}: ` : '';
      const untilTimeout = node.timeoutSeconds ? ` timeout ${node.timeoutSeconds}` : '';
      const untilCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      return renderLoopNode(
        `${untilLabel}until ${untilCond} max ${node.maxIterations}${untilTimeout}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    }
    case 'retry': {
      const retryLabel = node.label ? `${node.label}: ` : '';
      const retryTimeout = node.timeoutSeconds ? ` timeout ${node.timeoutSeconds}` : '';
      return renderLoopNode(
        `${retryLabel}retry max ${node.maxAttempts}${retryTimeout}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    }
    case 'if':
      return renderIfNode(node, state, path, indentLevel, prefix, suffix);
    case 'try':
      return renderTryNode(node, state, path, indentLevel, prefix, suffix);
    case 'let':
      return renderLetNode(node, state, indent, prefix, suffix);
    case 'foreach': {
      return renderForeachNode(node, state, path, indentLevel, prefix, suffix);
    }
    case 'break': {
      const breakLabel = node.label ? ` ${node.label}` : '';
      return [`${prefix}${indent}break${breakLabel}${suffix}`];
    }
    case 'continue': {
      const continueLabel = node.label ? ` ${node.label}` : '';
      return [`${prefix}${indent}continue${continueLabel}${suffix}`];
    }
    case 'spawn':
      return renderSpawnNode(node, state, path, indentLevel, prefix, suffix);
    case 'await':
      return [
        `${prefix}${indent}await ${node.target === 'all' ? 'all' : `"${node.target}"`}${suffix}`,
      ];
    case 'approve': {
      const approveTimeout = node.timeoutSeconds ? ` timeout ${node.timeoutSeconds / 60}m` : '';
      const approveRejected = state.variables['approve_rejected'];
      const approveTag =
        approveRejected === 'true'
          ? '  [rejected]'
          : approveRejected === 'false'
            ? '  [approved]'
            : '  [pending]';
      return [`${prefix}${indent}approve "${node.message}"${approveTimeout}${approveTag}${suffix}`];
    }
    case 'review': {
      const reviewProgress = state.nodeProgress[node.id];
      const reviewRound = reviewProgress?.iteration ?? 0;
      const roundTag = reviewRound > 0 ? ` [round ${reviewRound}/${node.maxRounds}]` : '';
      return renderLoopNode(
        `review max ${node.maxRounds}${roundTag}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    }
    case 'race': {
      const winner = state.variables['race_winner'];
      const raceTag = winner !== undefined && winner !== '' ? `  [winner: ${String(winner)}]` : '';
      const raceLines = [`${prefix}${indent}race${raceTag}${suffix}`];
      for (let i = 0; i < node.children.length; i++) {
        raceLines.push(...renderNode(node.children[i]!, state, [...path, i], indentLevel + 1));
      }
      raceLines.push(`${prefix}${indent}end${suffix}`);
      return raceLines;
    }
    case 'foreach_spawn': {
      const prog = state.nodeProgress[node.id];
      const iter = prog ? `  [${prog.iteration}/${prog.maxIterations}]` : '';
      return renderLoopNode(
        `foreach-spawn ${node.variableName} in "${node.listExpression}"${iter}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    }
    case 'remember': {
      if (node.key !== undefined && node.value !== undefined) {
        return [`${prefix}${indent}remember key="${node.key}" value="${node.value}"${suffix}`];
      }
      return [`${prefix}${indent}remember "${node.text ?? ''}"${suffix}`];
    }
    case 'send': {
      return [`${prefix}${indent}send "${node.target}" "${node.message}"${suffix}`];
    }
    case 'receive': {
      const progress = state.nodeProgress[node.id];
      const statusTag =
        progress?.status === 'completed'
          ? ' [received]'
          : progress?.status === 'running'
            ? ' [waiting]'
            : '';
      const fromTag = node.from !== undefined ? ` from "${node.from}"` : '';
      return [`${prefix}${indent}receive ${node.variableName}${fromTag}${statusTag}${suffix}`];
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function renderLoopNode(
  header: string,
  body: readonly FlowNode[],
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
  nodeId: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const progress = progressAnnotation(state, nodeId);
  const timing = timingAnnotation(state, nodeId);
  const lines: string[] = [`${prefix}${indent}${header}${progress}${timing}${suffix}`];

  for (let i = 0; i < body.length; i++) {
    const child = body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderIfNode(
  node: IfNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const ifCond = isAskCondition(node.condition)
    ? `ask: "${extractAskQuestion(node.condition)}"`
    : node.condition;
  const lines: string[] = [`${prefix}${indent}if ${ifCond}${suffix}`];

  for (let i = 0; i < node.thenBranch.length; i++) {
    const child = node.thenBranch[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  if (node.elseBranch.length > 0) {
    lines.push(`  ${indent}else`);
    const offset = node.thenBranch.length;
    for (let i = 0; i < node.elseBranch.length; i++) {
      const child = node.elseBranch[i]!;
      lines.push(...renderNode(child, state, [...path, offset + i], indentLevel + 1));
    }
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderTryNode(
  node: TryNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [`${prefix}${indent}try${suffix}`];

  for (let i = 0; i < node.body.length; i++) {
    const child = node.body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  if (node.catchBody.length > 0) {
    lines.push(`  ${indent}catch ${node.catchCondition}`);
    const offset = node.body.length;
    for (let i = 0; i < node.catchBody.length; i++) {
      const child = node.catchBody[i]!;
      lines.push(...renderNode(child, state, [...path, offset + i], indentLevel + 1));
    }
  }

  // H#20: Render finally block
  if (node.finallyBody.length > 0) {
    lines.push(`  ${indent}finally`);
    const finallyOffset = node.body.length + node.catchBody.length;
    for (let i = 0; i < node.finallyBody.length; i++) {
      const child = node.finallyBody[i]!;
      lines.push(...renderNode(child, state, [...path, finallyOffset + i], indentLevel + 1));
    }
  }

  lines.push(`  ${indent}end`);
  return lines;
}

// Both `let` and `var` are parsed as LetNode (they are aliases).
// Rendering always uses `let` for consistency.
function renderLetNode(
  node: LetNode,
  state: SessionState,
  indent: string,
  prefix: string,
  suffix: string,
): string[] {
  const operator = node.append ? '+=' : '=';
  let sourceText: string;
  switch (node.source.type) {
    case 'prompt':
      sourceText = `prompt "${node.source.text}"`;
      break;
    case 'prompt_json': {
      const schemaPreview =
        node.source.schema.length > 40
          ? node.source.schema.slice(0, 40) + '...'
          : node.source.schema;
      sourceText = `prompt "${node.source.text}" as json { ${schemaPreview} }`;
      break;
    }
    case 'run':
      sourceText = `run "${node.source.command}"`;
      break;
    case 'literal':
      sourceText = `"${node.source.value}"`;
      break;
    case 'empty_list':
      sourceText = '[]';
      break;
  }
  const progress = state.nodeProgress[node.id];
  const isAwaitingCapture = progress?.status === 'awaiting_capture';
  const resolved = state.variables[node.variableName];
  let annotation: string;
  if (isAwaitingCapture && progress.captureFailureReason) {
    const retry = `${progress.iteration}/${progress.maxIterations}`;
    annotation = `  [capture failed: ${progress.captureFailureReason} — retry ${retry}]`;
  } else if (isAwaitingCapture) {
    annotation = '  [awaiting response...]';
  } else if (resolved !== undefined) {
    annotation = `  [= ${String(resolved)}]`;
  } else {
    annotation = '';
  }
  return [
    `${prefix}${indent}let ${node.variableName} ${operator} ${sourceText}${annotation}${suffix}`,
  ];
}

function renderForeachNode(
  node: ForeachNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const progress = progressAnnotation(state, node.id);
  const timing = timingAnnotation(state, node.id);
  const currentVal = state.variables[node.variableName];
  const valAnnotation = currentVal !== undefined ? `  [${node.variableName}=${currentVal}]` : '';
  const foreachLabel = node.label ? `${node.label}: ` : '';
  const header = `${foreachLabel}foreach ${node.variableName} in ${node.listExpression}`;
  const lines: string[] = [
    `${prefix}${indent}${header}${progress}${timing}${valAnnotation}${suffix}`,
  ];

  for (let i = 0; i < node.body.length; i++) {
    const child = node.body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderSpawnNode(
  node: SpawnNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const child = state.spawnedChildren[node.name];
  const statusTag = child ? `  [${child.status}]` : '';
  const lines: string[] = [`${prefix}${indent}spawn "${node.name}"${statusTag}${suffix}`];

  for (let i = 0; i < node.body.length; i++) {
    const bodyNode = node.body[i]!;
    lines.push(...renderNode(bodyNode, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderGates(state: SessionState): string[] {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return [];

  const lines: string[] = ['', 'done when:'];
  for (const gate of gates) {
    const result = state.gateResults[gate.predicate];
    const diag = state.gateDiagnostics?.[gate.predicate];

    if (result === true) {
      lines.push(`  ${gate.predicate}  [pass]`);
    } else if (result === false && diag?.command) {
      const detail = formatGateDiagnostic(diag);
      lines.push(`  ${gate.predicate}  [fail — ${detail}]`);
    } else if (result === false) {
      lines.push(`  ${gate.predicate}  [fail]`);
    } else {
      lines.push(`  ${gate.predicate}  [pending]`);
    }
  }
  return lines;
}

// H#36: Show first 3 lines of stderr for more actionable gate diagnostics
// H-DX-004: Fall back to stdout (first 200 chars) when stderr is empty
function formatGateDiagnostic(diag: {
  readonly command?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly stdout?: string;
}): string {
  const parts: string[] = [];
  if (diag.exitCode !== undefined) parts.push(`exit ${diag.exitCode}`);
  if (diag.command) parts.push(`"${diag.command}"`);
  if (diag.stderr) {
    const lines = diag.stderr.split('\n').filter((l) => l.trim());
    const snippet = lines
      .slice(0, 3)
      .map((l) => l.slice(0, 80))
      .join(' | ');
    parts.push(snippet);
  } else if (diag.stdout) {
    // H-DX-004: Show first 200 chars of stdout when stderr is empty
    parts.push(diag.stdout.slice(0, 200));
  }
  return parts.join(': ');
}

// H-PERF-002: Internal/auto-set variables to exclude from display
const HIDDEN_VARIABLES = new Set(['last_exit_code', 'last_stdout', 'last_stderr']);
const AUTO_SUFFIX_RE = /_(index|length)$/;

function isHiddenVariable(
  key: string,
  _value: string | number | boolean,
  variables: Readonly<Record<string, string | number | boolean>>,
): boolean {
  if (HIDDEN_VARIABLES.has(key)) return true;
  if (AUTO_SUFFIX_RE.test(key)) return true;
  // Show command_failed / command_succeeded only when command_failed is 'true'
  if (key === 'command_failed' || key === 'command_succeeded') {
    return String(variables['command_failed']) !== 'true';
  }
  return false;
}

// H-DX-008: Format JSON array values as list summaries
function formatListValue(str: string): string | null {
  try {
    const parsed: unknown = JSON.parse(str);
    if (!Array.isArray(parsed)) return null;
    const len = parsed.length;
    const preview = parsed
      .slice(0, 3)
      .map((item) => `"${String(item)}"`)
      .join(', ');
    const ellipsis = len > 3 ? ', ...' : '';
    return `[${len} items: ${preview}${ellipsis}]`;
  } catch {
    return null;
  }
}

// H#33: Truncate variable values >80 chars for readability
function renderVariables(state: SessionState): string[] {
  const entries = Object.entries(state.variables);
  if (entries.length === 0) return [];

  const filtered = entries.filter(([key, value]) => !isHiddenVariable(key, value, state.variables));
  if (filtered.length === 0) return [];

  const lines: string[] = ['', 'Variables:'];
  for (const [key, value] of filtered) {
    const str = String(value);
    const listDisplay = typeof value === 'string' ? formatListValue(str) : null;
    const display = listDisplay ?? (str.length > 80 ? str.slice(0, 77) + '...' : str);
    lines.push(`  ${key} = ${display}`);
  }
  return lines;
}

// H#51: Surface parser/advancement warnings in flow output
function renderWarnings(state: SessionState): string[] {
  if (state.warnings.length === 0) return [];
  const lines: string[] = ['', 'Warnings:'];
  for (const w of state.warnings) {
    lines.push(`  [!] ${w}`);
  }
  return lines;
}

export function renderFlow(state: SessionState): string {
  const statusSuffix =
    state.status === 'failed' && state.failureReason
      ? ` | [FLOW FAILED: ${state.failureReason}]`
      : '';
  const lines: string[] = [
    `[prompt-language] Flow: ${state.flowSpec.goal} | Status: ${state.status}${statusSuffix}`,
    '',
  ];

  for (let i = 0; i < state.flowSpec.nodes.length; i++) {
    const node = state.flowSpec.nodes[i]!;
    lines.push(...renderNode(node, state, [i], 0));
  }

  lines.push(...renderGates(state));
  lines.push(...renderVariables(state));
  lines.push(...renderWarnings(state));

  return lines.join('\n');
}

// H-PERF-005: Compact context format for prompt injection (less tokens)
function compactNode(
  node: FlowNode,
  state: SessionState,
  path: readonly number[],
  depth: number,
): string[] {
  const currentPath = state.currentNodePath;
  const isCurrent = arraysEqual(path, currentPath);
  const isAnc = isAncestorPath(path, currentPath);
  const completed = !isCurrent && !isAnc && isCompletedNode(path, currentPath);
  const mark = isCurrent ? '>' : isAnc ? '|' : completed ? '~' : ' ';
  const pad = ' '.repeat(depth);

  switch (node.kind) {
    case 'prompt':
      return [`${mark}${pad}P: ${node.text.slice(0, 60)}`];
    case 'run':
      return [`${mark}${pad}R: ${node.command}`];
    case 'let': {
      const op = node.append ? '+=' : '=';
      const val = state.variables[node.variableName];
      const annotation = val !== undefined ? ` [${String(val).slice(0, 30)}]` : '';
      return [`${mark}${pad}L ${node.variableName} ${op}${annotation}`];
    }
    case 'while':
    case 'until': {
      const prog = state.nodeProgress[node.id];
      const iter = prog ? `${prog.iteration}/${prog.maxIterations}` : '';
      const compactCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      const lines = [`${mark}${pad}${node.kind} ${compactCond} ${iter}`];
      for (let i = 0; i < node.body.length; i++) {
        lines.push(...compactNode(node.body[i]!, state, [...path, i], depth + 1));
      }
      return lines;
    }
    case 'retry': {
      const prog = state.nodeProgress[node.id];
      const iter = prog ? `${prog.iteration}/${prog.maxIterations}` : '';
      const lines = [`${mark}${pad}retry ${iter}`];
      for (let i = 0; i < node.body.length; i++) {
        lines.push(...compactNode(node.body[i]!, state, [...path, i], depth + 1));
      }
      return lines;
    }
    case 'if': {
      const compactIfCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      const lines = [`${mark}${pad}if ${compactIfCond}`];
      for (let i = 0; i < node.thenBranch.length; i++) {
        lines.push(...compactNode(node.thenBranch[i]!, state, [...path, i], depth + 1));
      }
      if (node.elseBranch.length > 0) {
        lines.push(`${mark}${pad}else`);
        const off = node.thenBranch.length;
        for (let i = 0; i < node.elseBranch.length; i++) {
          lines.push(...compactNode(node.elseBranch[i]!, state, [...path, off + i], depth + 1));
        }
      }
      return lines;
    }
    case 'try': {
      const lines = [`${mark}${pad}try`];
      for (let i = 0; i < node.body.length; i++) {
        lines.push(...compactNode(node.body[i]!, state, [...path, i], depth + 1));
      }
      if (node.catchBody.length > 0) {
        const off = node.body.length;
        lines.push(`${mark}${pad}catch`);
        for (let i = 0; i < node.catchBody.length; i++) {
          lines.push(...compactNode(node.catchBody[i]!, state, [...path, off + i], depth + 1));
        }
      }
      return lines;
    }
    case 'foreach': {
      const prog = state.nodeProgress[node.id];
      const iter = prog ? `${prog.iteration}/${prog.maxIterations}` : '';
      const lines = [`${mark}${pad}each ${node.variableName} ${iter}`];
      for (let i = 0; i < node.body.length; i++) {
        lines.push(...compactNode(node.body[i]!, state, [...path, i], depth + 1));
      }
      return lines;
    }
    case 'break':
      return [`${mark}${pad}break`];
    case 'continue':
      return [`${mark}${pad}continue`];
    case 'spawn': {
      const child = state.spawnedChildren[node.name];
      const tag = child ? `[${child.status}]` : '';
      return [`${mark}${pad}spawn "${node.name}" ${tag}`];
    }
    case 'await':
      return [`${mark}${pad}await ${node.target}`];
    case 'approve':
      return [`${mark}${pad}approve "${node.message.slice(0, 40)}"`];
    case 'review': {
      const rvProg = state.nodeProgress[node.id];
      const rvIter = rvProg ? `${rvProg.iteration}/${rvProg.maxIterations}` : '';
      const rvLines = [`${mark}${pad}review ${rvIter}`];
      for (let i = 0; i < node.body.length; i++) {
        rvLines.push(...compactNode(node.body[i]!, state, [...path, i], depth + 1));
      }
      return rvLines;
    }
    case 'race': {
      const winner = state.variables['race_winner'];
      const raceTag = winner !== undefined && winner !== '' ? `[winner:${winner}]` : '';
      return [`${mark}${pad}race ${raceTag}`];
    }
    case 'foreach_spawn':
      return [`${mark}${pad}foreach-spawn ${node.variableName}`];
    case 'remember':
      return [`${mark}${pad}remember`];
    case 'send':
      return [`${mark}${pad}send → ${node.target}`];
    case 'receive':
      return [`${mark}${pad}receive ${node.variableName}`];
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function renderFlowCompact(state: SessionState): string {
  const lines: string[] = [`[pl] ${state.flowSpec.goal} | ${state.status}`];
  for (let i = 0; i < state.flowSpec.nodes.length; i++) {
    lines.push(...compactNode(state.flowSpec.nodes[i]!, state, [i], 0));
  }
  const gates = state.flowSpec.completionGates;
  if (gates.length > 0) {
    const labels = gates.map((g) => {
      const r = state.gateResults[g.predicate];
      return r === true ? `+${g.predicate}` : r === false ? `-${g.predicate}` : `?${g.predicate}`;
    });
    lines.push(`gates: ${labels.join(' ')}`);
  }
  return lines.join('\n');
}

// H-REL-011: Compact single-line summary for compaction resilience
function countAllNodes(nodes: readonly FlowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'foreach_spawn':
      case 'spawn':
        count += countAllNodes(node.body);
        break;
      case 'race':
        for (const child of node.children) count += 1 + countAllNodes(child.body);
        break;
      case 'if':
        count += countAllNodes(node.thenBranch) + countAllNodes(node.elseBranch);
        break;
      case 'try':
        count +=
          countAllNodes(node.body) +
          countAllNodes(node.catchBody) +
          countAllNodes(node.finallyBody);
        break;
      case 'review':
        count += countAllNodes(node.body);
        break;
      case 'prompt':
      case 'run':
      case 'let':
      case 'break':
      case 'continue':
      case 'await':
      case 'approve':
      case 'remember':
      case 'send':
      case 'receive':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return count;
}

function flattenNodes(nodes: readonly FlowNode[]): FlowNode[] {
  const result: FlowNode[] = [];
  for (const node of nodes) {
    result.push(node);
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'foreach_spawn':
      case 'spawn':
        result.push(...flattenNodes(node.body));
        break;
      case 'race':
        for (const child of node.children) {
          result.push(child);
          result.push(...flattenNodes(child.body));
        }
        break;
      case 'if':
        result.push(...flattenNodes(node.thenBranch), ...flattenNodes(node.elseBranch));
        break;
      case 'try':
        result.push(
          ...flattenNodes(node.body),
          ...flattenNodes(node.catchBody),
          ...flattenNodes(node.finallyBody),
        );
        break;
      case 'review':
        result.push(...flattenNodes(node.body));
        break;
      case 'prompt':
      case 'run':
      case 'let':
      case 'break':
      case 'continue':
      case 'await':
      case 'approve':
      case 'remember':
      case 'send':
      case 'receive':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return result;
}

function resolveNodeByPath(nodes: readonly FlowNode[], path: readonly number[]): FlowNode | null {
  if (path.length === 0) return null;
  const idx = path[0]!;
  const node = nodes[idx];
  if (!node) return null;
  if (path.length === 1) return node;
  const rest = path.slice(1);
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'foreach':
    case 'foreach_spawn':
    case 'review':
    case 'spawn':
      return resolveNodeByPath(node.body, rest);
    case 'race': {
      const raceBodies = node.children.flatMap((c) => [c, ...c.body]);
      return resolveNodeByPath(raceBodies, rest);
    }
    case 'if':
      return resolveNodeByPath([...node.thenBranch, ...node.elseBranch], rest);
    case 'try':
      return resolveNodeByPath([...node.body, ...node.catchBody, ...node.finallyBody], rest);
    case 'prompt':
    case 'run':
    case 'let':
    case 'break':
    case 'continue':
    case 'await':
    case 'approve':
    case 'remember':
    case 'send':
    case 'receive':
      return null;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function describeNode(node: FlowNode): string {
  switch (node.kind) {
    case 'prompt':
      return `prompt: ${node.text}`;
    case 'run':
      return `run: ${node.command}`;
    case 'let':
      return `let ${node.variableName}`;
    case 'while': {
      const wCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      return `while ${wCond}`;
    }
    case 'until': {
      const uCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      return `until ${uCond}`;
    }
    case 'retry':
      return `retry max ${node.maxAttempts}`;
    case 'if':
      return `if ${node.condition}`;
    case 'try':
      return 'try';
    case 'foreach':
      return `foreach ${node.variableName}`;
    case 'break':
      return 'break';
    case 'continue':
      return 'continue';
    case 'spawn':
      return `spawn "${node.name}"`;
    case 'await':
      return `await ${node.target}`;
    case 'approve':
      return `approve "${node.message}"`;
    case 'review':
      return `review max ${node.maxRounds}`;
    case 'race':
      return 'race';
    case 'foreach_spawn':
      return `foreach-spawn ${node.variableName}`;
    case 'remember':
      return `remember${node.key != null ? ` ${node.key}` : ''}`;
    case 'send':
      return `send to "${node.target}"`;
    case 'receive':
      return `receive ${node.variableName}`;
  }
}

function findStepIndex(nodes: readonly FlowNode[], path: readonly number[]): number {
  const flat = flattenNodes(nodes);
  const target = resolveNodeByPath(nodes, path);
  if (!target) return 0;
  const idx = flat.indexOf(target);
  return idx >= 0 ? idx + 1 : 0;
}

export function renderFlowSummary(state: SessionState): string {
  const totalNodes = countAllNodes(state.flowSpec.nodes);
  const stepNum = findStepIndex(state.flowSpec.nodes, state.currentNodePath);
  const currentNode = resolveNodeByPath(state.flowSpec.nodes, state.currentNodePath);
  const nodeDesc = currentNode ? describeNode(currentNode) : 'done';

  const varCount = Object.keys(state.variables).length;
  const gates = state.flowSpec.completionGates;
  const gatesPassed = gates.filter((g) => state.gateResults[g.predicate] === true).length;

  const truncatedDesc = nodeDesc.length > 40 ? nodeDesc.slice(0, 37) + '...' : nodeDesc;

  let summary = `[prompt-language: step ${stepNum}/${totalNodes} "${truncatedDesc}"`;
  summary += `, vars: ${varCount}`;
  if (gates.length > 0) {
    summary += `, gates: ${gatesPassed}/${gates.length} passed`;
  }
  summary += ']';

  return summary;
}

// H-DX-009: Final summary emitted when flow transitions to completed
export function renderCompletionSummary(state: SessionState): string {
  const totalNodes = countAllNodes(state.flowSpec.nodes);

  // Count total iterations across loop nodes
  let totalIterations = 0;
  let totalMaxIterations = 0;
  for (const progress of Object.values(state.nodeProgress)) {
    if (progress.maxIterations > 1) {
      totalIterations += progress.iteration;
      totalMaxIterations += progress.maxIterations;
    }
  }

  // Count user-defined variables (exclude hidden/auto)
  const varEntries = Object.entries(state.variables);
  const visibleVars = varEntries.filter(
    ([key, value]) => !isHiddenVariable(key, value, state.variables),
  );

  const parts: string[] = [`Flow ${state.status}`];
  parts.push(`${totalNodes} nodes`);
  if (totalMaxIterations > 0) {
    parts.push(`${totalIterations}/${totalMaxIterations} iterations`);
  }
  parts.push(`vars: ${visibleVars.length} set`);

  const gates = state.flowSpec.completionGates;
  if (gates.length > 0) {
    const passed = gates.filter((g) => state.gateResults[g.predicate] === true).length;
    parts.push(`gates: ${passed}/${gates.length}`);
  }

  return parts.join(' | ');
}
