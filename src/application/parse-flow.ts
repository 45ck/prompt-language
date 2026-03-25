/**
 * DSL parser — converts flow DSL text into a FlowSpec.
 *
 * Soft parser: produces warnings instead of errors for recoverable issues.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import type { FlowNode } from '../domain/flow-node.js';
import type { CompletionGate, FlowSpec } from '../domain/flow-spec.js';
import type { LetSource } from '../domain/flow-node.js';
import {
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createPromptNode,
  createRunNode,
  createTryNode,
  createLetNode,
  createForeachNode,
  createBreakNode,
  createContinueNode,
  createSpawnNode,
  createAwaitNode,
  DEFAULT_MAX_ITERATIONS,
} from '../domain/flow-node.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';
import { ASK_CONDITION_PREFIX } from '../domain/judge-prompt.js';

interface ParseContext {
  lines: readonly string[];
  pos: number;
  warnings: string[];
  nodeCounter: number;
}

function nextId(ctx: ParseContext): string {
  ctx.nodeCounter += 1;
  return `n${ctx.nodeCounter}`;
}

// H#28: Prepend line numbers to parser warnings
function warn(ctx: ParseContext, message: string): void {
  ctx.warnings.push(`line ${ctx.pos}: ${message}`);
}

function currentIndent(line: string): number {
  const match = /^(\s*)/.exec(line);
  return match?.[1] ? match[1].length : 0;
}

function stripComment(line: string): string {
  return line.replace(/#.*$/, '');
}

/** Parse the "Goal:" line from input. */
function parseGoal(input: string): string {
  const match = /^Goal:\s*(.+)/im.exec(input);
  return match?.[1] ? match[1].trim() : '';
}

/** Parse the "done when:" section into completion gates. */
export function parseGates(input: string): readonly CompletionGate[] {
  const match = /done when:\s*\n([\s\S]*)$/im.exec(input);
  if (!match?.[1]) return [];
  const block = match[1];
  const gates: CompletionGate[] = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    // D3: stop at first blank line to avoid consuming trailing prose
    if (!trimmed) {
      if (gates.length > 0) break;
      continue;
    }

    // H-INT-010: any(gate1, gate2, ...) composite gate
    const anyMatch = /^any\s*\((.+)\)\s*$/i.exec(trimmed);
    if (anyMatch?.[1]) {
      const subPredicates = anyMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (subPredicates.length > 0) {
        const subGates = subPredicates.map((p) => createCompletionGate(p));
        gates.push({ predicate: `any(${subPredicates.join(', ')})`, any: subGates });
        continue;
      }
    }

    // H-LANG-010: all(gate1, gate2, ...) composite gate (explicit AND)
    const allMatch = /^all\s*\((.+)\)\s*$/i.exec(trimmed);
    if (allMatch?.[1]) {
      const subPredicates = allMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (subPredicates.length > 0) {
        const subGates = subPredicates.map((p) => createCompletionGate(p));
        gates.push({ predicate: `all(${subPredicates.join(', ')})`, all: subGates });
        continue;
      }
    }

    // H-LANG-010: N_of(n, gate1, gate2, ...) composite gate
    const nOfMatch = /^(\d+)_of\s*\((.+)\)\s*$/i.exec(trimmed);
    if (nOfMatch?.[1] && nOfMatch[2]) {
      const n = parseInt(nOfMatch[1], 10);
      const subPredicates = nOfMatch[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (n > 0 && subPredicates.length > 0) {
        const subGates = subPredicates.map((p) => createCompletionGate(p));
        gates.push({
          predicate: `${n}_of(${subPredicates.join(', ')})`,
          nOf: { n, gates: subGates },
        });
        continue;
      }
    }

    // H#26: Custom gate definition — "gate name: command"
    const gateMatch = /^gate\s+(\w+)\s*:\s*(.+)$/i.exec(trimmed);
    if (gateMatch?.[1] && gateMatch[2]) {
      gates.push(createCompletionGate(gateMatch[1], gateMatch[2].trim()));
      continue;
    }

    const eqMatch = /^(\S+)\s*==\s*(.+)$/.exec(trimmed);
    if (eqMatch?.[1] && eqMatch[2]) {
      gates.push(createCompletionGate(`${eqMatch[1]} == ${eqMatch[2]}`));
    } else {
      gates.push(createCompletionGate(trimmed));
    }
  }
  return gates;
}

// Conservative bare-flow detection: only unambiguous DSL patterns
const BARE_FLOW_PATTERNS = [
  /^prompt:\s/i,
  /^run:\s/i,
  /^foreach\s+\w+\s+in\s/i,
  /^let\s+\w+\s*[+]?=/i,
  /^var\s+\w+\s*[+]?=/i,
  /^retry\s+max\s+\d+/i,
  /^while\s+.+\s+max\s+\d+/i,
  /^until\s+.+\s+max\s+\d+/i,
];

export function detectBareFlow(input: string): boolean {
  if (/^\s*flow:\s*$/m.test(input)) return false;
  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^Goal:/i.test(trimmed)) continue;
    if (BARE_FLOW_PATTERNS.some((re) => re.test(trimmed))) return true;
  }
  return false;
}

/** Extract the flow: block lines. */
function extractFlowBlock(input: string): readonly string[] {
  const doneIdx = input.search(/\n\s*done when:/im);
  const flowMatch = /^\s*flow:\s*\n/im.exec(input);
  if (flowMatch) {
    const start = flowMatch.index + flowMatch[0].length;
    const end = doneIdx >= 0 ? doneIdx : input.length;
    return input.slice(start, end).split('\n');
  }

  // Bare flow detection fallback
  if (!detectBareFlow(input)) return [];
  const lines = input.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^Goal:/i.test(trimmed)) continue;
    if (/^\s*done\s+when:/i.test(line)) break;
    result.push(`  ${trimmed}`);
  }
  return result;
}

// H-LANG-008: Extract optional "timeout N" from loop line
function parseTimeout(line: string): number | undefined {
  const match = /\btimeout\s+(\d+)\b/i.exec(line);
  return match?.[1] ? parseInt(match[1], 10) : undefined;
}

// H-LANG-008: Strip "timeout N" from line for further parsing
function stripTimeout(line: string): string {
  return line.replace(/\s+timeout\s+\d+/i, '');
}

function parseWhileLine(
  ctx: ParseContext,
  line: string,
  baseIndent: number,
  label?: string,
): FlowNode {
  const timeout = parseTimeout(line);
  const stripped = stripTimeout(line);

  // AI-evaluated condition: while ask "question" [grounded-by "cmd"] [max N]
  const askMatch =
    /^while\s+ask\s+["']([^"']+)["'](?:\s+grounded-by\s+["']([^"']+)["'])?(?:\s+max\s+(\d+))?$/i.exec(
      stripped,
    );
  if (askMatch) {
    const question = askMatch[1]!;
    const groundedBy = askMatch[2];
    let askMax = askMatch[3] ? parseInt(askMatch[3], 10) : undefined;
    if (askMax === undefined) {
      warn(
        ctx,
        `Missing "max N" on while ask — defaulting to 5. Try: while ask "${question}" max 5`,
      );
      askMax = DEFAULT_MAX_ITERATIONS;
    }
    const askBody = parseBlock(ctx, baseIndent);
    return createWhileNode(
      nextId(ctx),
      `${ASK_CONDITION_PREFIX}"${question}"`,
      askBody,
      askMax,
      label,
      timeout,
      groundedBy,
    );
  }

  const match = /^while\s+(?:not\s+)?(.+?)(?:\s+max\s+(\d+))?$/i.exec(stripped);
  const condition = match?.[1] ?? 'true';
  let max = match?.[2] ? parseInt(match[2], 10) : undefined;
  if (!/max\s+\d+/i.exec(stripped)) {
    warn(ctx, `Missing "max N" on while — defaulting to 5. Try: while ${condition} max 5`);
    max = DEFAULT_MAX_ITERATIONS;
  }
  const negated = /^while\s+not\s+/i.test(stripped);
  const cond = negated ? `not ${condition}` : condition;
  const body = parseBlock(ctx, baseIndent);
  return createWhileNode(nextId(ctx), cond, body, max, label, timeout);
}

function parseUntilLine(
  ctx: ParseContext,
  line: string,
  baseIndent: number,
  label?: string,
): FlowNode {
  const timeout = parseTimeout(line);
  const stripped = stripTimeout(line);

  // AI-evaluated condition: until ask "question" [grounded-by "cmd"] [max N]
  const askMatch =
    /^until\s+ask\s+["']([^"']+)["'](?:\s+grounded-by\s+["']([^"']+)["'])?(?:\s+max\s+(\d+))?$/i.exec(
      stripped,
    );
  if (askMatch) {
    const question = askMatch[1]!;
    const groundedBy = askMatch[2];
    let askMax = askMatch[3] ? parseInt(askMatch[3], 10) : undefined;
    if (askMax === undefined) {
      warn(
        ctx,
        `Missing "max N" on until ask — defaulting to 5. Try: until ask "${question}" max 5`,
      );
      askMax = DEFAULT_MAX_ITERATIONS;
    }
    const askBody = parseBlock(ctx, baseIndent);
    return createUntilNode(
      nextId(ctx),
      `${ASK_CONDITION_PREFIX}"${question}"`,
      askBody,
      askMax,
      label,
      timeout,
      groundedBy,
    );
  }

  const match = /^until\s+(.+?)(?:\s+max\s+(\d+))?$/i.exec(stripped);
  const condition = match?.[1] ?? 'true';
  let max = match?.[2] ? parseInt(match[2], 10) : undefined;
  if (!/max\s+\d+/i.exec(stripped)) {
    warn(ctx, `Missing "max N" on until — defaulting to 5. Try: until ${condition} max 5`);
    max = DEFAULT_MAX_ITERATIONS;
  }
  const body = parseBlock(ctx, baseIndent);
  return createUntilNode(nextId(ctx), condition, body, max, label, timeout);
}

function parseRetryLine(
  ctx: ParseContext,
  line: string,
  baseIndent: number,
  label?: string,
): FlowNode {
  const timeout = parseTimeout(line);
  const stripped = stripTimeout(line);
  const match = /^retry(?:\s+max\s+(\d+))?(?:\s+backoff\s+(\d+)s)?/i.exec(stripped);
  const max = match?.[1] ? parseInt(match[1], 10) : undefined;
  const backoffMs = match?.[2] ? parseInt(match[2], 10) * 1000 : undefined;
  const body = parseBlock(ctx, baseIndent);
  return createRetryNode(nextId(ctx), body, max, label, timeout, backoffMs);
}

function parseIfLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  // AI-evaluated condition: if ask "question" [grounded-by "cmd"]
  const askMatch = /^if\s+ask\s+["']([^"']+)["'](?:\s+grounded-by\s+["']([^"']+)["'])?$/i.exec(
    line.trim(),
  );
  let condition: string;
  let groundedBy: string | undefined;
  if (askMatch) {
    condition = `${ASK_CONDITION_PREFIX}"${askMatch[1]!}"`;
    groundedBy = askMatch[2];
  } else {
    const match = /^if\s+(.+)/i.exec(line);
    condition = match?.[1] ? match[1].trim() : 'true';
  }
  const thenBranch = parseBlock(ctx, baseIndent, ['else', 'elif', 'end']);
  let elseBranch: FlowNode[] = [];
  let nestedElseIf = false;
  if (ctx.pos < ctx.lines.length) {
    const peekLine = ctx.lines[ctx.pos];
    const peek = peekLine ? peekLine.trim() : '';
    const lower = peek.toLowerCase();
    // H-LANG-003: Handle "else if ..." and "elif ..." as nested IfNode in else branch
    const elseIfMatch = /^else\s+if\s+(.+)/i.exec(peek);
    const elifMatch = /^elif\s+(.+)/i.exec(peek);
    if (elseIfMatch?.[1] || elifMatch?.[1]) {
      ctx.pos += 1;
      const nestedCondition = (elseIfMatch?.[1] ?? elifMatch?.[1])!.trim();
      const nestedIf = parseIfLine(ctx, `if ${nestedCondition}`, baseIndent);
      elseBranch = [nestedIf];
      nestedElseIf = true;
    } else if (lower === 'else') {
      ctx.pos += 1;
      elseBranch = parseBlock(ctx, baseIndent, ['end']);
    }
  }
  // The innermost else-if / elif already consumed the shared "end"
  if (!nestedElseIf) {
    consumeEnd(ctx);
  }
  return createIfNode(nextId(ctx), condition, thenBranch, elseBranch, groundedBy);
}

function parseTryBlock(ctx: ParseContext, baseIndent: number): FlowNode {
  const body = parseBlock(ctx, baseIndent, ['catch', 'finally', 'end']);
  let catchCondition = 'command_failed';
  let catchBody: FlowNode[] = [];
  let finallyBody: FlowNode[] = [];

  if (ctx.pos < ctx.lines.length) {
    const peekLine = ctx.lines[ctx.pos];
    const peek = peekLine ? peekLine.trim() : '';
    const catchMatch = /^catch(?:\s+(.+))?/i.exec(peek);
    if (catchMatch) {
      catchCondition = catchMatch[1]?.trim() ?? 'command_failed';
      ctx.pos += 1;
      catchBody = parseBlock(ctx, baseIndent, ['finally', 'end']);
    }
  }

  // H#20: Parse optional finally block
  if (ctx.pos < ctx.lines.length) {
    const peekLine = ctx.lines[ctx.pos];
    const peek = peekLine ? peekLine.trim().toLowerCase() : '';
    if (peek === 'finally') {
      ctx.pos += 1;
      finallyBody = parseBlock(ctx, baseIndent, ['end']);
    }
  }

  consumeEnd(ctx);
  return createTryNode(nextId(ctx), body, catchCondition, catchBody, finallyBody);
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseLetLine(ctx: ParseContext, trimmed: string): FlowNode | null {
  // Strip "let " or "var " prefix
  const afterKeyword = trimmed.slice(trimmed.indexOf(' ') + 1);

  // Detect += (append) vs = (assign) — check += first
  const appendIdx = afterKeyword.indexOf('+=');
  const eqIdx = afterKeyword.indexOf('=');
  const isAppend = appendIdx >= 0 && (eqIdx < 0 || appendIdx <= eqIdx);
  const splitIdx = isAppend ? appendIdx : eqIdx;

  if (splitIdx < 0) {
    warn(ctx, `Invalid let/var syntax: "${trimmed}" — missing "=". Try: let name = "value"`);
    return null;
  }
  const variableName = afterKeyword.slice(0, splitIdx).trim();
  if (!variableName) {
    warn(
      ctx,
      `Invalid let/var syntax: "${trimmed}" — missing variable name. Try: let name = "value"`,
    );
    return null;
  }
  const rhs = afterKeyword.slice(splitIdx + (isAppend ? 2 : 1)).trim();
  if (!rhs) {
    warn(
      ctx,
      `Invalid let/var syntax: "${trimmed}" — missing value after "=". Try: let ${variableName} = "value"`,
    );
    return null;
  }

  // Handle empty list initializer: []
  if (rhs === '[]') {
    if (isAppend) {
      warn(ctx, `Cannot append empty list: "${trimmed}" — use = [] to initialize`);
      return null;
    }
    return createLetNode(nextId(ctx), variableName, { type: 'empty_list' }, false);
  }

  // H-LANG-005: Detect pipe transform suffix on prompt/run sources
  let transform: string | undefined;
  let effectiveRhs = rhs;
  const rhsLower = effectiveRhs.toLowerCase();

  if (rhsLower.startsWith('prompt ') || rhsLower.startsWith('run ')) {
    const pipeIdx = effectiveRhs.lastIndexOf(' | ');
    if (pipeIdx >= 0) {
      const candidate = effectiveRhs.slice(pipeIdx + 3).trim();
      if (/^(trim|upper|lower|first|last)$/i.test(candidate)) {
        transform = candidate.toLowerCase();
        effectiveRhs = effectiveRhs.slice(0, pipeIdx).trimEnd();
      }
    }
  }

  const effectiveLower = effectiveRhs.toLowerCase();
  let source: LetSource;

  if (effectiveLower.startsWith('prompt ')) {
    const text = stripQuotes(effectiveRhs.slice(7).trim());
    source = { type: 'prompt', text };
  } else if (effectiveLower.startsWith('run ')) {
    const command = stripQuotes(effectiveRhs.slice(4).trim());
    source = { type: 'run', command };
  } else {
    const value = stripQuotes(effectiveRhs);
    source = { type: 'literal', value };
  }

  return createLetNode(nextId(ctx), variableName, source, isAppend, transform);
}

function parseForeachLine(
  ctx: ParseContext,
  line: string,
  baseIndent: number,
  label?: string,
): FlowNode {
  const match = /^foreach\s+(\w+)\s+in\s+(.+?)(?:\s+max\s+(\d+))?$/i.exec(line);
  if (!match?.[1] || !match[2]) {
    warn(ctx, `Invalid foreach syntax: "${line}". Try: foreach item in \${list}`);
    return createPromptNode(nextId(ctx), line);
  }
  const variableName = match[1];
  const rawExpr = match[2].trim();
  const max = match[3] ? parseInt(match[3], 10) : undefined;
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);

  // H-LANG-007: Detect `run "cmd"` as dynamic list source
  const runMatch = /^run\s+(.+)$/i.exec(rawExpr);
  if (runMatch?.[1]) {
    const command = stripQuotes(runMatch[1].trim());
    return createForeachNode(nextId(ctx), variableName, '', body, max, label, command);
  }

  const listExpression = stripQuotes(rawExpr);
  return createForeachNode(nextId(ctx), variableName, listExpression, body, max, label);
}

/** H-SEC-005: Extract `with vars x, y` from spawn line and return variable list. */
function extractSpawnVars(line: string): readonly string[] | undefined {
  const varsMatch = /\bwith\s+vars\s+(.+)$/i.exec(line);
  if (!varsMatch?.[1]) return undefined;
  return varsMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** H-SEC-005: Strip `with vars ...` suffix from spawn line for name/cwd parsing. */
function stripVarsSuffix(line: string): string {
  return line.replace(/\s+with\s+vars\s+.+$/i, '');
}

function parseSpawnBlock(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  // H-SEC-005: Extract optional vars allowlist before parsing name/cwd
  const vars = extractSpawnVars(line);
  const cleanLine = stripVarsSuffix(line);

  // H-INT-005: Parse optional `in "path"` for cross-directory spawn
  const cwdMatch =
    /^spawn\s+"([^"]+)"\s+in\s+"([^"]+)"/i.exec(cleanLine) ??
    /^spawn\s+'([^']+)'\s+in\s+'([^']+)'/i.exec(cleanLine);
  if (cwdMatch?.[1] && cwdMatch[2]) {
    const body = parseBlock(ctx, baseIndent);
    consumeEnd(ctx);
    return createSpawnNode(nextId(ctx), cwdMatch[1], body, cwdMatch[2], vars);
  }

  const match = /^spawn\s+"([^"]+)"/i.exec(cleanLine) ?? /^spawn\s+'([^']+)'/i.exec(cleanLine);
  // D5: Accept bare-word spawn names (consistent with await)
  const name = match?.[1] ?? cleanLine.replace(/^spawn\s+/i, '').trim();
  if (!name) {
    warn(ctx, `Invalid spawn syntax: "${line}" — expected spawn "name"`);
    return createPromptNode(nextId(ctx), line);
  }
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  return createSpawnNode(nextId(ctx), name, body, undefined, vars);
}

function parseAwaitLine(ctx: ParseContext, line: string): FlowNode {
  const match = /^await\s+(.+)/i.exec(line);
  if (!match?.[1]) {
    warn(ctx, `Invalid await syntax: "${line}" — expected await all or await "name"`);
    return createPromptNode(nextId(ctx), line);
  }
  const target = match[1].trim().toLowerCase();
  if (target === 'all') {
    return createAwaitNode(nextId(ctx), 'all');
  }
  const nameMatch = /^"([^"]+)"$/.exec(match[1].trim()) ?? /^'([^']+)'$/.exec(match[1].trim());
  if (nameMatch?.[1]) {
    return createAwaitNode(nextId(ctx), nameMatch[1]);
  }
  // Bare word target
  return createAwaitNode(nextId(ctx), match[1].trim());
}

function consumeEnd(ctx: ParseContext): void {
  if (ctx.pos < ctx.lines.length) {
    const peekLine = ctx.lines[ctx.pos];
    const peek = peekLine ? peekLine.trim().toLowerCase() : '';
    if (peek === 'end') {
      ctx.pos += 1;
      return;
    }
  }
  warn(
    ctx,
    'Missing "end" — auto-closed block. Add "end" at the same indent level as the opening keyword',
  );
}

function parseBlock(
  ctx: ParseContext,
  parentIndent: number,
  stopKeywords: string[] = [],
): FlowNode[] {
  const nodes: FlowNode[] = [];
  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos] ?? '';
    const cleaned = stripComment(raw);
    const trimmed = cleaned.trim();
    if (!trimmed) {
      ctx.pos += 1;
      continue;
    }
    const indent = currentIndent(raw);
    if (indent <= parentIndent) {
      const firstWord = trimmed.toLowerCase().split(/\s/)[0] ?? '';
      if (stopKeywords.some((kw) => firstWord === kw)) break;
      break;
    }
    const lower = trimmed.toLowerCase();
    const firstWord = lower.split(/\s/)[0] ?? '';
    if (stopKeywords.some((kw) => firstWord === kw)) break;
    if (lower === 'end') break;
    ctx.pos += 1;
    const node = parseLine(ctx, trimmed, indent);
    if (node) nodes.push(node);
  }
  return nodes;
}

function parseLine(ctx: ParseContext, trimmed: string, indent: number): FlowNode | null {
  const lower = trimmed.toLowerCase();

  // H-LANG-011: Detect labeled loop — "label: while/until/retry/foreach ..."
  const labelMatch = /^(\w+):\s+(while|until|retry|foreach)\b/i.exec(trimmed);
  if (labelMatch?.[1] && labelMatch[2]) {
    const label = labelMatch[1];
    const rest = trimmed.slice(trimmed.indexOf(labelMatch[2]));
    const keyword = labelMatch[2].toLowerCase();
    if (keyword === 'while') return parseWhileLine(ctx, rest, indent, label);
    if (keyword === 'until') return parseUntilLine(ctx, rest, indent, label);
    if (keyword === 'retry') return parseRetryLine(ctx, rest, indent, label);
    if (keyword === 'foreach') return parseForeachLine(ctx, rest, indent, label);
  }

  if (lower.startsWith('while ')) {
    return parseWhileLine(ctx, trimmed, indent);
  }
  if (lower.startsWith('until ')) {
    return parseUntilLine(ctx, trimmed, indent);
  }
  if (lower.startsWith('retry')) {
    return parseRetryLine(ctx, trimmed, indent);
  }
  if (lower.startsWith('if ')) {
    return parseIfLine(ctx, trimmed, indent);
  }
  if (lower === 'try') {
    return parseTryBlock(ctx, indent);
  }
  if (lower.startsWith('prompt:')) {
    return createPromptNode(nextId(ctx), trimmed.slice(7).trim());
  }
  if (lower.startsWith('run:')) {
    const runText = trimmed.slice(4).trim();
    // D2: bracket syntax [timeout N] is unambiguous — can't conflict with command text
    const timeoutMatch = /^(.+?)\s+\[timeout\s+(\d+)\]$/i.exec(runText);
    if (timeoutMatch?.[1] && timeoutMatch[2]) {
      const timeoutSec = parseInt(timeoutMatch[2], 10);
      if (timeoutSec > 0) {
        return createRunNode(nextId(ctx), timeoutMatch[1].trim(), timeoutSec * 1000);
      }
    }
    return createRunNode(nextId(ctx), runText);
  }
  if (lower.startsWith('foreach ')) {
    return parseForeachLine(ctx, trimmed, indent);
  }
  if (lower.startsWith('let ') || lower.startsWith('var ')) {
    return parseLetLine(ctx, trimmed);
  }
  // H-LANG-011: break/continue with optional label
  if (lower === 'break' || lower.startsWith('break ')) {
    const labelArg = lower === 'break' ? undefined : trimmed.slice(6).trim() || undefined;
    return createBreakNode(nextId(ctx), labelArg);
  }
  if (lower === 'continue' || lower.startsWith('continue ')) {
    const labelArg = lower === 'continue' ? undefined : trimmed.slice(9).trim() || undefined;
    return createContinueNode(nextId(ctx), labelArg);
  }
  if (lower.startsWith('spawn ')) {
    return parseSpawnBlock(ctx, trimmed, indent);
  }
  if (lower.startsWith('await ') || lower === 'await') {
    return parseAwaitLine(ctx, trimmed);
  }
  warn(
    ctx,
    `Unknown keyword "${trimmed}" — treating as prompt. Valid keywords: prompt, run, let, while, until, retry, if, try, foreach, break, continue, spawn, await`,
  );
  return createPromptNode(nextId(ctx), trimmed);
}

/** H-LANG-009: Parse the "env:" section into key-value pairs. */
export function parseEnv(input: string): Readonly<Record<string, string>> | undefined {
  // Try matching env: followed by flow: or done when: section
  const match =
    /^env:\s*\n([\s\S]*?)(?=\n\s*(?:flow:|done when:))/im.exec(input) ??
    /^env:\s*\n([\s\S]+)/im.exec(input);
  if (!match?.[1]) return undefined;
  const env: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) env[key] = stripQuotes(value);
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

/** H-INT-001: Safe path check — must be relative, no "..", no absolute paths. */
const SAFE_INCLUDE_RE = /^(?!.*\.\.)[\w ./-]+\.(?:flow|prompt|txt)$/;

const INCLUDE_RE = /^include\s+(?:"([^"]+)"|'([^']+)')$/i;

/**
 * H-INT-001: Resolve `include "path"` directives by inlining file content.
 * Tracks included files to detect circular includes. Restricts to relative paths.
 */
function resolveIncludes(
  lines: readonly string[],
  warnings: string[],
  basePath: string,
  seen?: Set<string>,
  fileReader?: (path: string) => string,
): string[] {
  const visited = seen ?? new Set<string>();
  const reader = fileReader ?? ((p: string) => readFileSync(p, 'utf-8'));
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = INCLUDE_RE.exec(trimmed);
    if (!match) {
      result.push(line);
      continue;
    }

    const includePath = (match[1] ?? match[2])!;
    if (isAbsolute(includePath) || !SAFE_INCLUDE_RE.test(includePath)) {
      warnings.push(
        `Invalid include path "${includePath}" — must be a relative path with .flow/.prompt/.txt extension`,
      );
      continue;
    }

    const fullPath = resolve(basePath, includePath);
    if (visited.has(fullPath)) {
      warnings.push(`Circular include detected: "${includePath}" — skipping`);
      continue;
    }

    visited.add(fullPath);
    try {
      const content = reader(fullPath);
      const indent = /^(\s*)/.exec(line)?.[1] ?? '';
      const includedLines = content.split('\n').map((l) => (l.trim() ? `${indent}${l}` : l));
      const resolved = resolveIncludes(
        includedLines,
        warnings,
        dirname(fullPath),
        visited,
        fileReader,
      );
      result.push(...resolved);
    } catch {
      warnings.push(`Could not read include file "${includePath}"`);
    }
  }

  return result;
}

export function parseFlow(
  input: string,
  options?: { basePath?: string; fileReader?: (path: string) => string },
): FlowSpec {
  const warnings: string[] = [];
  const goal = parseGoal(input);
  const gates = parseGates(input);
  const env = parseEnv(input);
  const rawLines = extractFlowBlock(input);
  // H-INT-001: Resolve include directives
  const basePath = options?.basePath ?? process.cwd();
  const flowLines = resolveIncludes(rawLines, warnings, basePath, undefined, options?.fileReader);
  const ctx: ParseContext = {
    lines: flowLines,
    pos: 0,
    warnings,
    nodeCounter: 0,
  };
  const nodes = parseBlock(ctx, -1);
  return createFlowSpec(goal, nodes, gates, warnings, undefined, env);
}
