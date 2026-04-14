/**
 * renderFlow — Pure visualization of a flow program with execution state.
 *
 * Reconstructs the DSL text from FlowSpec nodes and annotates it with
 * the current execution position, loop progress, gate results, and variables.
 *
 * ── Canonical Render Spec (B1) ──────────────────────────────────────────
 *
 * Full mode (`renderFlow`) output structure (section order is fixed):
 *
 *   1. Header:   `[prompt-language] Flow: <goal> | Status: <status>[suffix]`
 *                 suffix is ` | [FLOW FAILED: <reason>]` when failed with reason
 *   2. Blank line
 *   3. Declarations (optional): rubric/judge blocks, `use profile "..."` line
 *   4. Node tree: every node rendered with markers and indentation
 *   5. Gates section (optional): `done when:` header + per-gate lines
 *   6. Variables section (optional): `Variables:` header + per-variable lines
 *   7. Warnings section (optional): `Warnings:` header + per-warning lines
 *   8. Capture reminder (optional): active capture file path hint
 *
 * Node rendering rules:
 *   - Indentation: 2 spaces per nesting level, inside a 2-char prefix region
 *   - Prefix markers (first 2 chars of each line):
 *       `> ` — current node or ancestor of current node
 *       `~ ` — completed node (before current in same scope)
 *       `  ` — future or inactive node
 *   - Suffix: `  <-- current` appended only to the exact current node
 *   - Block nodes (while/until/retry/foreach/spawn/try/if/race/review):
 *       header line + indented children + `  <indent>end`
 *   - Loop progress: `[###--] N/M` bar appended to loop headers
 *   - Let annotations: `[= value]`, `[awaiting response...]`, or
 *       `[capture failed: reason — retry N/M]`
 *
 * Gate rendering:
 *   - Each gate: `  <predicate>  [pass]`, `[fail]`, `[fail — detail]`, or `[pending]`
 *   - Gates render in spec declaration order (array index, not alphabetical)
 *
 * Variable rendering:
 *   - Sorted alphabetically by key (locale-aware)
 *   - Hidden: last_exit_code, last_stdout, last_stderr, *_index, *_length,
 *       command_failed/succeeded (unless command_failed === 'true')
 *   - Sliced to execution-path-relevant variables when possible
 *   - Values truncated at 80 chars; JSON arrays shown as `[N items: ...]`
 *
 * Compact mode (`renderFlowCompact`) output structure:
 *   - Header: `[pl] <goal> | <status>`
 *   - Only the active execution path is rendered (inactive branches omitted)
 *   - Short markers: `>` current, `|` ancestor, `~` completed, ` ` other
 *   - Abbreviated node kinds: P (prompt), R (run), L (let), etc.
 *   - Gate summary: `gates: +pass -fail ?pending` on one line
 *
 * Determinism contract (B2):
 *   - renderFlow(state) is a pure function of (FlowSpec, SessionState)
 *   - Same logical state with different JS object insertion order produces
 *     byte-identical output (variables sorted, gates in spec order)
 *   - No Map/Set iteration, no Date.now(), no Math.random() in render path
 *
 * Volatility contract (B3):
 *   - Timestamps (startedAt, completedAt) are NOT rendered in flow output
 *   - renderStateHash canonicalizes and strips timestamps before hashing
 *   - Only iteration counts and status values affect rendered output
 */

import type { FlowNode, ForeachNode, IfNode, LetNode, SpawnNode, TryNode } from './flow-node.js';
import type { FlowSpec } from './flow-spec.js';
import type { SessionState } from './session-state.js';
import { isAskCondition, extractAskQuestion } from './judge-prompt.js';
import {
  stringifyVariableValue,
  type VariableStore,
  type VariableValue,
} from './variable-value.js';

// D04-fix: Simple FNV-1a string hash — replaces node:crypto to keep domain zero-dep
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForHash(item));
  }

  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => key !== 'startedAt' && key !== 'completedAt')
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(
      entries.map(([key, nestedValue]) => [key, canonicalizeForHash(nestedValue)]),
    );
  }

  return value;
}

// H-PERF-001: Compute a hash of render-relevant state to detect unchanged renders
export function renderStateHash(state: SessionState): string {
  const data = JSON.stringify(
    canonicalizeForHash({
      p: state.currentNodePath,
      n: state.nodeProgress,
      g: state.gateResults,
      s: state.status,
    }),
  );
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

function durationMsFromProgress(state: SessionState, nodeId: string): number | null {
  const progress = state.nodeProgress[nodeId];
  if (progress?.startedAt === undefined || progress.completedAt === undefined) return null;
  return Math.max(0, progress.completedAt - progress.startedAt);
}

function formatDurationMs(durationMs: number): string {
  return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.round(durationMs)}ms`;
}

function formatNodePath(path: readonly number[]): string {
  return path.length === 0 ? 'root' : path.join('.');
}

interface NodePathEntry {
  readonly node: FlowNode;
  readonly path: readonly number[];
}

function collectNodePaths(
  nodes: readonly FlowNode[],
  basePath: readonly number[] = [],
): NodePathEntry[] {
  const entries: NodePathEntry[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const path = [...basePath, i];
    entries.push({ node, path });

    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'foreach_spawn':
      case 'spawn':
      case 'review':
        entries.push(...collectNodePaths(node.body, path));
        break;
      case 'if':
        entries.push(...collectNodePaths(node.thenBranch, path));
        entries.push(...collectNodePaths(node.elseBranch, path));
        break;
      case 'try':
        entries.push(...collectNodePaths(node.body, path));
        entries.push(...collectNodePaths(node.catchBody, path));
        entries.push(...collectNodePaths(node.finallyBody, path));
        break;
      case 'race':
        for (let childIndex = 0; childIndex < node.children.length; childIndex++) {
          const child = node.children[childIndex]!;
          const childPath = [...path, childIndex];
          entries.push({ node: child, path: childPath });
          entries.push(...collectNodePaths(child.body, childPath));
        }
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
      case 'swarm':
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }

  return entries;
}

export interface TimedNodeSummary {
  readonly nodeId: string;
  readonly nodeKind: FlowNode['kind'];
  readonly nodePath: string;
  readonly description: string;
  readonly durationMs: number;
}

function isCompletedNode(path: readonly number[], currentPath: readonly number[]): boolean {
  if (path.length === 0 || currentPath.length < path.length) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] !== currentPath[i]) return false;
  }
  return path[path.length - 1]! < currentPath[path.length - 1]!;
}

function buildReviewHeader(node: Extract<FlowNode, { kind: 'review' }>, roundTag = ''): string {
  const strictTag = node.strict ? ' strict' : '';
  const judgeTag = node.judgeName ? ` using judge "${node.judgeName}"` : '';
  return `review${strictTag}${judgeTag} max ${node.maxRounds}${roundTag}`;
}

function renderDeclarationBlock(header: string, lines: readonly string[]): string[] {
  const rendered = [`  ${header}`];
  for (const line of lines) {
    rendered.push(line ? `    ${line}` : '');
  }
  rendered.push('  end');
  return rendered;
}

function formatProfileClause(profile?: string): string {
  return profile != null ? ` using profile "${profile}"` : '';
}

function renderConditionDisplay(
  condition: string,
  options: {
    readonly profile?: string | undefined;
    readonly groundedBy?: string | undefined;
  } = {},
): string {
  if (!isAskCondition(condition)) {
    return condition;
  }

  let rendered = `ask "${extractAskQuestion(condition)}"`;
  if (options.profile != null) {
    rendered += formatProfileClause(options.profile);
  }
  if (options.groundedBy != null) {
    rendered += ` grounded-by "${options.groundedBy}"`;
  }
  return rendered;
}

function renderDeclarations(spec: FlowSpec): string[] {
  const rendered: string[] = [];

  for (const rubric of spec.rubrics ?? []) {
    if (rendered.length > 0) rendered.push('');
    rendered.push(...renderDeclarationBlock(`rubric "${rubric.name}"`, rubric.lines));
  }

  for (const judge of spec.judges ?? []) {
    if (rendered.length > 0) rendered.push('');
    rendered.push(...renderDeclarationBlock(`judge "${judge.name}"`, judge.lines));
  }

  return rendered;
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
    case 'prompt': {
      return [
        `${prefix}${indent}prompt${formatProfileClause(node.profile)}: ${node.text}${suffix}`,
      ];
    }
    case 'run': {
      const timeoutTag = node.timeoutMs ? ` [timeout ${node.timeoutMs / 1000}s]` : '';
      return [`${prefix}${indent}run: ${node.command}${timeoutTag}${suffix}`];
    }
    case 'while': {
      const whileLabel = node.label ? `${node.label}: ` : '';
      const whileTimeout = node.timeoutSeconds ? ` timeout ${node.timeoutSeconds}` : '';
      const whileAskRetries =
        node.askMaxRetries != null ? ` max-retries ${node.askMaxRetries}` : '';
      const whileCond = renderConditionDisplay(node.condition, {
        profile: node.askProfile,
        groundedBy: node.groundedBy,
      });
      return renderLoopNode(
        `${whileLabel}while ${whileCond} max ${node.maxIterations}${whileAskRetries}${whileTimeout}`,
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
      const untilAskRetries =
        node.askMaxRetries != null ? ` max-retries ${node.askMaxRetries}` : '';
      const untilCond = renderConditionDisplay(node.condition, {
        profile: node.askProfile,
        groundedBy: node.groundedBy,
      });
      return renderLoopNode(
        `${untilLabel}until ${untilCond} max ${node.maxIterations}${untilAskRetries}${untilTimeout}`,
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
        `${prefix}${indent}await ${
          node.target === 'all'
            ? 'all'
            : Array.isArray(node.target)
              ? node.target.join(' ')
              : `"${node.target}"`
        }${suffix}`,
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
        buildReviewHeader(node, roundTag),
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
    case 'swarm':
      return [`${prefix}${indent}swarm ${node.name}${suffix}`];
    case 'start':
      return [`${prefix}${indent}start ${node.targets.join(', ')}${suffix}`];
    case 'return':
      return [`${prefix}${indent}return ${node.expression}${suffix}`];
    case 'snapshot':
      return [`${prefix}${indent}snapshot "${node.name}"${suffix}`];
    case 'rollback':
      return [`${prefix}${indent}rollback to "${node.name}"${suffix}`];
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
  const lines: string[] = [`${prefix}${indent}${header}${progress}${suffix}`];

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
  const ifCond = renderConditionDisplay(node.condition, {
    profile: node.askProfile,
    groundedBy: node.groundedBy,
  });
  const askRetries = node.askMaxRetries != null ? ` max-retries ${node.askMaxRetries}` : '';
  const lines: string[] = [`${prefix}${indent}if ${ifCond}${askRetries}${suffix}`];

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

// Variable declarations share LetNode, but render output preserves the
// authored keyword so const/var remain visible during review.
function renderLetNode(
  node: LetNode,
  state: SessionState,
  indent: string,
  prefix: string,
  suffix: string,
): string[] {
  const declarationKeyword = node.declarationKind;
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
    case 'memory':
      sourceText = `memory "${node.source.key}"`;
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
    annotation = `  [= ${stringifyVariableValue(resolved)}]`;
  } else {
    annotation = '';
  }
  return [
    `${prefix}${indent}${declarationKeyword} ${node.variableName} ${operator} ${sourceText}${annotation}${suffix}`,
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
  const currentVal = state.variables[node.variableName];
  const valAnnotation =
    currentVal !== undefined
      ? `  [${node.variableName}=${stringifyVariableValue(currentVal)}]`
      : '';
  const foreachLabel = node.label ? `${node.label}: ` : '';
  const header = `${foreachLabel}foreach ${node.variableName} in ${node.listExpression}`;
  const lines: string[] = [`${prefix}${indent}${header}${progress}${valAnnotation}${suffix}`];

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
const INTERPOLATED_VARIABLE_RE =
  /\$\{([\w.]+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{([\w.]+)\}/g;
const BARE_IDENTIFIER_RE = /\b[A-Za-z_][\w.]*\b/g;
const CONDITION_IDENTIFIER_EXCLUSIONS = new Set([
  'and',
  'ask',
  'false',
  'grounded',
  'by',
  'in',
  'max',
  'max_retries',
  'not',
  'null',
  'or',
  'timeout',
  'true',
]);
const NESTED_INTERPOLATION_RE = /\$\{[^}]*\$\{/;
const OPEN_INTERPOLATION_RE = /\$\{/g;

function isHiddenVariable(key: string, _value: VariableValue, variables: VariableStore): boolean {
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

function extractInterpolatedVariableNames(template: string): readonly string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(INTERPOLATED_VARIABLE_RE)) {
    const name = match[1] ?? match[3] ?? match[5];
    if (name) {
      names.add(name);
    }
  }
  return [...names];
}

function hasUncertainInterpolationSyntax(template: string | undefined): boolean {
  if (template == null || template.length === 0) {
    return false;
  }
  if (NESTED_INTERPOLATION_RE.test(template)) {
    return true;
  }

  const opens = template.match(OPEN_INTERPOLATION_RE)?.length ?? 0;
  const closes = (template.match(/\}/g) ?? []).length;
  return opens > closes;
}

function extractConditionVariableNames(condition: string): readonly string[] {
  const names = new Set(extractInterpolatedVariableNames(condition));
  const inspectable = isAskCondition(condition) ? extractAskQuestion(condition) : condition;

  for (const match of inspectable.matchAll(BARE_IDENTIFIER_RE)) {
    const token = match[0];
    if (token == null) {
      continue;
    }

    const normalized = token.toLowerCase();
    if (CONDITION_IDENTIFIER_EXCLUSIONS.has(normalized)) {
      continue;
    }

    names.add(token);
  }

  return [...names];
}

function addReferencesFromString(target: Set<string>, value: string | undefined): void {
  if (value == null || value.length === 0) {
    return;
  }

  for (const name of extractInterpolatedVariableNames(value)) {
    target.add(name);
  }
}

function addConditionReferences(target: Set<string>, condition: string | undefined): void {
  if (condition == null || condition.length === 0) {
    return;
  }

  for (const name of extractConditionVariableNames(condition)) {
    target.add(name);
  }
}

function collectNodeVariableDependencies(node: FlowNode): readonly string[] {
  const names = new Set<string>();

  switch (node.kind) {
    case 'prompt':
      addReferencesFromString(names, node.text);
      break;
    case 'run':
      addReferencesFromString(names, node.command);
      break;
    case 'while':
    case 'until':
      addConditionReferences(names, node.condition);
      addReferencesFromString(names, node.groundedBy);
      break;
    case 'retry':
      break;
    case 'if':
      addConditionReferences(names, node.condition);
      addReferencesFromString(names, node.groundedBy);
      break;
    case 'try':
      addConditionReferences(names, node.catchCondition);
      break;
    case 'let':
      names.add(node.variableName);
      switch (node.source.type) {
        case 'prompt':
          addReferencesFromString(names, node.source.text);
          break;
        case 'prompt_json':
          addReferencesFromString(names, node.source.text);
          addReferencesFromString(names, node.source.schema);
          break;
        case 'run':
          addReferencesFromString(names, node.source.command);
          break;
        case 'memory':
          addReferencesFromString(names, node.source.key);
          break;
        case 'literal':
          break;
        case 'empty_list':
          break;
      }
      break;
    case 'foreach':
    case 'foreach_spawn':
      names.add(node.variableName);
      addConditionReferences(names, node.listExpression);
      addReferencesFromString(names, node.listCommand);
      break;
    case 'break':
    case 'continue':
      break;
    case 'spawn':
      addConditionReferences(names, node.condition);
      for (const variableName of node.vars ?? []) {
        names.add(variableName);
      }
      break;
    case 'await':
      break;
    case 'approve':
      names.add('approve_rejected');
      addReferencesFromString(names, node.message);
      break;
    case 'review':
      addReferencesFromString(names, node.criteria);
      addReferencesFromString(names, node.groundedBy);
      break;
    case 'race':
      names.add('race_winner');
      break;
    case 'remember':
      addReferencesFromString(names, node.text);
      addReferencesFromString(names, node.key);
      addReferencesFromString(names, node.value);
      break;
    case 'send':
      addReferencesFromString(names, node.target);
      addReferencesFromString(names, node.message);
      break;
    case 'receive':
      names.add(node.variableName);
      addReferencesFromString(names, node.from);
      break;
    case 'swarm':
      break;
    case 'start':
      break;
    case 'return':
      addConditionReferences(names, node.expression);
      break;
    case 'snapshot':
    case 'rollback':
      break;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }

  return [...names];
}

function nodeHasUncertainInterpolation(node: FlowNode): boolean {
  switch (node.kind) {
    case 'prompt':
      return hasUncertainInterpolationSyntax(node.text);
    case 'run':
      return hasUncertainInterpolationSyntax(node.command);
    case 'while':
    case 'until':
      return (
        hasUncertainInterpolationSyntax(node.condition) ||
        hasUncertainInterpolationSyntax(node.groundedBy)
      );
    case 'retry':
      return false;
    case 'if':
      return (
        hasUncertainInterpolationSyntax(node.condition) ||
        hasUncertainInterpolationSyntax(node.groundedBy)
      );
    case 'try':
      return hasUncertainInterpolationSyntax(node.catchCondition);
    case 'let':
      if (node.source.type === 'prompt' || node.source.type === 'prompt_json') {
        return (
          hasUncertainInterpolationSyntax(node.source.text) ||
          (node.source.type === 'prompt_json' &&
            hasUncertainInterpolationSyntax(node.source.schema))
        );
      }
      if (node.source.type === 'run') {
        return hasUncertainInterpolationSyntax(node.source.command);
      }
      if (node.source.type === 'memory') {
        return hasUncertainInterpolationSyntax(node.source.key);
      }
      return false;
    case 'foreach':
    case 'foreach_spawn':
      return (
        hasUncertainInterpolationSyntax(node.listExpression) ||
        hasUncertainInterpolationSyntax(node.listCommand)
      );
    case 'break':
    case 'continue':
      return false;
    case 'spawn':
      return hasUncertainInterpolationSyntax(node.condition);
    case 'await':
      return false;
    case 'approve':
      return hasUncertainInterpolationSyntax(node.message);
    case 'review':
      return (
        hasUncertainInterpolationSyntax(node.criteria) ||
        hasUncertainInterpolationSyntax(node.groundedBy)
      );
    case 'race':
      return false;
    case 'remember':
      return (
        hasUncertainInterpolationSyntax(node.text) ||
        hasUncertainInterpolationSyntax(node.key) ||
        hasUncertainInterpolationSyntax(node.value)
      );
    case 'send':
      return (
        hasUncertainInterpolationSyntax(node.target) ||
        hasUncertainInterpolationSyntax(node.message)
      );
    case 'receive':
      return hasUncertainInterpolationSyntax(node.from);
    case 'swarm':
    case 'start':
      return false;
    case 'return':
      return hasUncertainInterpolationSyntax(node.expression);
    case 'snapshot':
    case 'rollback':
      return false;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function collectExecutionPathNodes(
  nodes: readonly FlowNode[],
  path: readonly number[],
): readonly FlowNode[] {
  const chain: FlowNode[] = [];
  let currentNodes = nodes;
  let remainingPath = [...path];

  while (remainingPath.length > 0) {
    const index = remainingPath[0]!;
    const node = currentNodes[index];
    if (node == null) {
      break;
    }

    chain.push(node);
    remainingPath = remainingPath.slice(1);
    if (remainingPath.length === 0) {
      break;
    }

    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'foreach_spawn':
      case 'review':
      case 'spawn':
        currentNodes = node.body;
        break;
      case 'if':
        currentNodes = [...node.thenBranch, ...node.elseBranch];
        break;
      case 'try':
        currentNodes = [...node.body, ...node.catchBody, ...node.finallyBody];
        break;
      case 'race':
        currentNodes = node.children.flatMap((child) => [child, ...child.body]);
        break;
      case 'swarm':
        currentNodes = [...node.flow];
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
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        remainingPath = [];
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }

  return chain;
}

function collectRelevantVariableNames(state: SessionState): ReadonlySet<string> {
  const names = new Set<string>();

  const executionPathNodes = collectExecutionPathNodes(state.flowSpec.nodes, state.currentNodePath);
  if (
    executionPathNodes.some((node) => nodeHasUncertainInterpolation(node)) ||
    state.flowSpec.completionGates.some((gate) => hasUncertainInterpolationSyntax(gate.predicate))
  ) {
    return new Set<string>();
  }

  for (const node of executionPathNodes) {
    for (const name of collectNodeVariableDependencies(node)) {
      names.add(name);
    }
  }

  for (const gate of state.flowSpec.completionGates) {
    for (const name of extractConditionVariableNames(gate.predicate)) {
      names.add(name);
    }
  }

  return names;
}

function collectDisplayVariables(state: SessionState): readonly [string, VariableValue][] {
  const entries = Object.entries(state.variables);
  if (entries.length === 0) {
    return [];
  }

  const visible = entries
    .filter(([key, value]) => !isHiddenVariable(key, value, state.variables))
    .sort(([left], [right]) => left.localeCompare(right));
  if (visible.length === 0) {
    return [];
  }

  const relevant = collectRelevantVariableNames(state);
  const sliced = visible.filter(([key]) => relevant.has(key));

  return sliced.length > 0 ? sliced : visible;
}

// H#33: Truncate variable values >80 chars for readability
function renderVariables(state: SessionState): string[] {
  const filtered = collectDisplayVariables(state);
  if (filtered.length === 0) return [];

  const lines: string[] = ['', 'Variables:'];
  for (const [key, value] of filtered) {
    const str = stringifyVariableValue(value);
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

function findActiveCaptureVariable(state: SessionState): string | null {
  const currentNode = resolveNodeByPath(state.flowSpec.nodes, state.currentNodePath);
  if (currentNode?.kind !== 'let') return null;

  const progress = state.nodeProgress[currentNode.id];
  return progress?.status === 'awaiting_capture' ? currentNode.variableName : null;
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

  const declarationLines = renderDeclarations(state.flowSpec);
  if (declarationLines.length > 0) {
    lines.push(...declarationLines, '');
  }
  if (state.flowSpec.defaultProfile != null) {
    lines.push(`use profile "${state.flowSpec.defaultProfile}"`, '');
  }

  for (let i = 0; i < state.flowSpec.nodes.length; i++) {
    const node = state.flowSpec.nodes[i]!;
    lines.push(...renderNode(node, state, [i], 0));
  }

  lines.push(...renderGates(state));
  lines.push(...renderVariables(state));
  lines.push(...renderWarnings(state));
  const captureVarName = findActiveCaptureVariable(state);
  if (captureVarName !== null) {
    lines.push(
      '',
      `[Capture active: write response to .prompt-language/vars/${captureVarName} using Write tool]`,
    );
  }

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

  const activeChildIndex = (): number | null => {
    if (!isAnc) return null;
    return state.currentNodePath[path.length] ?? null;
  };

  const renderActiveBody = (body: readonly FlowNode[]): string[] => {
    const index = activeChildIndex();
    if (index == null) return [];
    const child = body[index];
    return child ? compactNode(child, state, [...path, index], depth + 1) : [];
  };

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
      lines.push(...renderActiveBody(node.body));
      return lines;
    }
    case 'retry': {
      const prog = state.nodeProgress[node.id];
      const iter = prog ? `${prog.iteration}/${prog.maxIterations}` : '';
      const lines = [`${mark}${pad}retry ${iter}`];
      lines.push(...renderActiveBody(node.body));
      return lines;
    }
    case 'if': {
      const compactIfCond = isAskCondition(node.condition)
        ? `ask: "${extractAskQuestion(node.condition)}"`
        : node.condition;
      const lines = [`${mark}${pad}if ${compactIfCond}`];
      const index = activeChildIndex();
      if (index != null) {
        if (index < node.thenBranch.length) {
          const child = node.thenBranch[index];
          if (child) {
            lines.push(...compactNode(child, state, [...path, index], depth + 1));
          }
        } else {
          const elseIndex = index - node.thenBranch.length;
          const child = node.elseBranch[elseIndex];
          if (child) {
            lines.push(`${mark}${pad}else`);
            lines.push(
              ...compactNode(
                child,
                state,
                [...path, node.thenBranch.length + elseIndex],
                depth + 1,
              ),
            );
          }
        }
      }
      return lines;
    }
    case 'try': {
      const lines = [`${mark}${pad}try`];
      const index = activeChildIndex();
      if (index != null) {
        if (index < node.body.length) {
          const child = node.body[index];
          if (child) {
            lines.push(...compactNode(child, state, [...path, index], depth + 1));
          }
        } else if (index < node.body.length + node.catchBody.length) {
          const catchIndex = index - node.body.length;
          const child = node.catchBody[catchIndex];
          if (child) {
            lines.push(`${mark}${pad}catch`);
            lines.push(
              ...compactNode(child, state, [...path, node.body.length + catchIndex], depth + 1),
            );
          }
        } else {
          const finallyIndex = index - node.body.length - node.catchBody.length;
          const child = node.finallyBody[finallyIndex];
          if (child) {
            lines.push(`${mark}${pad}finally`);
            lines.push(
              ...compactNode(
                child,
                state,
                [...path, node.body.length + node.catchBody.length + finallyIndex],
                depth + 1,
              ),
            );
          }
        }
      }
      return lines;
    }
    case 'foreach': {
      const prog = state.nodeProgress[node.id];
      const iter = prog ? `${prog.iteration}/${prog.maxIterations}` : '';
      const lines = [`${mark}${pad}each ${node.variableName} ${iter}`];
      lines.push(...renderActiveBody(node.body));
      return lines;
    }
    case 'break':
      return [`${mark}${pad}break`];
    case 'continue':
      return [`${mark}${pad}continue`];
    case 'spawn': {
      const child = state.spawnedChildren[node.name];
      const tag = child ? `[${child.status}]` : '';
      const lines = [`${mark}${pad}spawn "${node.name}" ${tag}`];
      lines.push(...renderActiveBody(node.body));
      return lines;
    }
    case 'await':
      return [`${mark}${pad}await ${node.target}`];
    case 'approve':
      return [`${mark}${pad}approve "${node.message.slice(0, 40)}"`];
    case 'review': {
      const rvProg = state.nodeProgress[node.id];
      const rvIter = rvProg ? `${rvProg.iteration}/${rvProg.maxIterations}` : '';
      const rvHeader = node.strict ? 'review strict' : 'review';
      const rvJudge = node.judgeName ? ` judge="${node.judgeName}"` : '';
      const rvLines = [`${mark}${pad}${rvHeader}${rvJudge} ${rvIter}`.trimEnd()];
      rvLines.push(...renderActiveBody(node.body));
      return rvLines;
    }
    case 'race': {
      const winner = state.variables['race_winner'];
      const raceTag = winner !== undefined && winner !== '' ? `[winner:${winner}]` : '';
      const lines = [`${mark}${pad}race ${raceTag}`];
      const index = activeChildIndex();
      if (index != null) {
        const child = node.children[index];
        if (child) {
          lines.push(...compactNode(child, state, [...path, index], depth + 1));
        }
      }
      return lines;
    }
    case 'foreach_spawn': {
      const lines = [`${mark}${pad}foreach-spawn ${node.variableName}`];
      lines.push(...renderActiveBody(node.body));
      return lines;
    }
    case 'remember':
      return [`${mark}${pad}remember`];
    case 'send':
      return [`${mark}${pad}send → ${node.target}`];
    case 'receive':
      return [`${mark}${pad}receive ${node.variableName}`];
    case 'swarm':
      return [`${mark}${pad}swarm ${node.name}`];
    case 'start':
      return [`${mark}${pad}start ${node.targets.join(', ')}`];
    case 'return':
      return [`${mark}${pad}return ${node.expression}`];
    case 'snapshot':
      return [`${mark}${pad}snapshot "${node.name}"`];
    case 'rollback':
      return [`${mark}${pad}rollback to "${node.name}"`];
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

export const FLOW_SUMMARY_POLICY = {
  inlineNodeDescriptionMaxLength: 40,
} as const;

interface FlowSummarySnapshot {
  readonly gateCount: number;
  readonly gatesPassed: number;
  readonly inlineNodeDescription: string;
  readonly nodeDescription: string;
  readonly stepNum: number;
  readonly status: SessionState['status'];
  readonly totalNodes: number;
  readonly varCount: number;
}

function normalizeSummaryText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateSummaryText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 3) {
    return '.'.repeat(maxLength);
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function buildFlowSummarySnapshot(state: SessionState): FlowSummarySnapshot {
  const totalNodes = countAllNodes(state.flowSpec.nodes);
  const stepNum = findStepIndex(state.flowSpec.nodes, state.currentNodePath);
  const currentNode = resolveNodeByPath(state.flowSpec.nodes, state.currentNodePath);
  const nodeDescription = normalizeSummaryText(currentNode ? describeNode(currentNode) : 'done');
  const gates = state.flowSpec.completionGates;

  return {
    gateCount: gates.length,
    gatesPassed: gates.filter((gate) => state.gateResults[gate.predicate] === true).length,
    inlineNodeDescription: truncateSummaryText(
      nodeDescription,
      FLOW_SUMMARY_POLICY.inlineNodeDescriptionMaxLength,
    ),
    nodeDescription,
    stepNum,
    status: state.status,
    totalNodes,
    varCount: collectDisplayVariables(state).length,
  };
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
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        break;
      case 'swarm':
        count += countAllNodes(node.flow);
        for (const role of node.roles) {
          count += countAllNodes(role.body);
        }
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
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        break;
      case 'swarm':
        result.push(...flattenNodes(node.flow));
        for (const role of node.roles) {
          result.push(...flattenNodes(role.body));
        }
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
    case 'swarm':
    case 'start':
    case 'return':
    case 'snapshot':
    case 'rollback':
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
      return `${node.declarationKind} ${node.variableName}`;
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
      return buildReviewHeader(node);
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
    case 'swarm':
      return `swarm ${node.name}`;
    case 'start':
      return `start ${node.targets.join(', ')}`;
    case 'return':
      return `return ${node.expression}`;
    case 'snapshot':
      return `snapshot "${node.name}"`;
    case 'rollback':
      return `rollback to "${node.name}"`;
  }
}

function findStepIndex(nodes: readonly FlowNode[], path: readonly number[]): number {
  const flat = flattenNodes(nodes);
  const target = resolveNodeByPath(nodes, path);
  if (!target) return 0;
  const idx = flat.indexOf(target);
  return idx >= 0 ? idx + 1 : 0;
}

function buildTimedNodeSummaries(state: SessionState): TimedNodeSummary[] {
  return collectNodePaths(state.flowSpec.nodes)
    .map(({ node, path }) => {
      const durationMs = durationMsFromProgress(state, node.id);
      if (durationMs == null) return null;
      return {
        nodeId: node.id,
        nodeKind: node.kind,
        nodePath: formatNodePath(path),
        description: describeNode(node),
        durationMs,
      } satisfies TimedNodeSummary;
    })
    .filter((row): row is TimedNodeSummary => row !== null)
    .sort((a, b) => b.durationMs - a.durationMs || a.nodePath.localeCompare(b.nodePath));
}

function slowestTimedNode(state: SessionState): TimedNodeSummary | null {
  return buildTimedNodeSummaries(state)[0] ?? null;
}

export function renderTimingReport(state: SessionState): string {
  const rows = buildTimedNodeSummaries(state);
  if (rows.length === 0) return 'No node timing data recorded';

  const lines = ['| Duration | Node | Path |', '| --- | --- | --- |'];
  for (const row of rows) {
    lines.push(`| ${formatDurationMs(row.durationMs)} | ${row.description} | ${row.nodePath} |`);
  }
  return lines.join('\n');
}

export function renderFlowSummary(state: SessionState): string {
  const snapshot = buildFlowSummarySnapshot(state);

  let summary = `[prompt-language: step ${snapshot.stepNum}/${snapshot.totalNodes} "${snapshot.inlineNodeDescription}"`;
  summary += `, vars: ${snapshot.varCount}`;
  if (snapshot.gateCount > 0) {
    summary += `, gates: ${snapshot.gatesPassed}/${snapshot.gateCount} passed`;
  }
  summary += ']';

  return summary;
}

export function renderFlowSummaryBlock(state: SessionState): string {
  const snapshot = buildFlowSummarySnapshot(state);
  const lines = [
    '[prompt-language summary]',
    `status: ${snapshot.status}`,
    `step: ${snapshot.stepNum}/${snapshot.totalNodes}`,
    `node: ${snapshot.nodeDescription}`,
    `vars: ${snapshot.varCount}`,
  ];

  if (snapshot.gateCount > 0) {
    lines.push(`gates: ${snapshot.gatesPassed}/${snapshot.gateCount} passed`);
  }

  return lines.join('\n');
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

  const slowest = slowestTimedNode(state);
  if (slowest && slowest.durationMs > 30_000) {
    parts.push(`slowest node: ${slowest.description} (${formatDurationMs(slowest.durationMs)})`);
  }

  return parts.join(' | ');
}
