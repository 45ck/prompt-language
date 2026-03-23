/**
 * DSL parser — converts flow DSL text into a FlowSpec.
 *
 * Soft parser: produces warnings instead of errors for recoverable issues.
 */

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
  createSpawnNode,
  createAwaitNode,
  DEFAULT_MAX_ITERATIONS,
} from '../domain/flow-node.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';

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

/** Extract the flow: block lines. */
function extractFlowBlock(input: string): readonly string[] {
  const doneIdx = input.search(/\n\s*done when:/im);
  const flowMatch = /^\s*flow:\s*\n/im.exec(input);
  if (!flowMatch) return [];
  const start = flowMatch.index + flowMatch[0].length;
  const end = doneIdx >= 0 ? doneIdx : input.length;
  return input.slice(start, end).split('\n');
}

function parseWhileLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^while\s+(?:not\s+)?(.+?)(?:\s+max\s+(\d+))?$/i.exec(line);
  const condition = match?.[1] ?? 'true';
  let max = match?.[2] ? parseInt(match[2], 10) : undefined;
  if (!/max\s+\d+/i.exec(line)) {
    warn(ctx, 'Missing "max N" on while — defaulting to 5');
    max = DEFAULT_MAX_ITERATIONS;
  }
  const negated = /^while\s+not\s+/i.test(line);
  const cond = negated ? `not ${condition}` : condition;
  const body = parseBlock(ctx, baseIndent);
  return createWhileNode(nextId(ctx), cond, body, max);
}

function parseUntilLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^until\s+(.+?)(?:\s+max\s+(\d+))?$/i.exec(line);
  const condition = match?.[1] ?? 'true';
  let max = match?.[2] ? parseInt(match[2], 10) : undefined;
  if (!/max\s+\d+/i.exec(line)) {
    warn(ctx, 'Missing "max N" on until — defaulting to 5');
    max = DEFAULT_MAX_ITERATIONS;
  }
  const body = parseBlock(ctx, baseIndent);
  return createUntilNode(nextId(ctx), condition, body, max);
}

function parseRetryLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^retry(?:\s+max\s+(\d+))?/i.exec(line);
  const max = match?.[1] ? parseInt(match[1], 10) : undefined;
  const body = parseBlock(ctx, baseIndent);
  return createRetryNode(nextId(ctx), body, max);
}

function parseIfLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^if\s+(.+)/i.exec(line);
  const condition = match?.[1] ? match[1].trim() : 'true';
  const thenBranch = parseBlock(ctx, baseIndent, ['else', 'end']);
  let elseBranch: FlowNode[] = [];
  if (ctx.pos < ctx.lines.length) {
    const peekLine = ctx.lines[ctx.pos];
    const peek = peekLine ? peekLine.trim().toLowerCase() : '';
    if (peek === 'else') {
      ctx.pos += 1;
      elseBranch = parseBlock(ctx, baseIndent, ['end']);
    }
  }
  consumeEnd(ctx);
  return createIfNode(nextId(ctx), condition, thenBranch, elseBranch);
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
    warn(ctx, `Invalid let/var syntax: "${trimmed}" — missing "="`);
    return null;
  }
  const variableName = afterKeyword.slice(0, splitIdx).trim();
  if (!variableName) {
    warn(ctx, `Invalid let/var syntax: "${trimmed}" — missing variable name`);
    return null;
  }
  const rhs = afterKeyword.slice(splitIdx + (isAppend ? 2 : 1)).trim();
  if (!rhs) {
    warn(ctx, `Invalid let/var syntax: "${trimmed}" — missing value`);
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

  const rhsLower = rhs.toLowerCase();
  let source: LetSource;

  if (rhsLower.startsWith('prompt ')) {
    const text = stripQuotes(rhs.slice(7).trim());
    source = { type: 'prompt', text };
  } else if (rhsLower.startsWith('run ')) {
    const command = stripQuotes(rhs.slice(4).trim());
    source = { type: 'run', command };
  } else {
    const value = stripQuotes(rhs);
    source = { type: 'literal', value };
  }

  return createLetNode(nextId(ctx), variableName, source, isAppend);
}

function parseForeachLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^foreach\s+(\w+)\s+in\s+(.+?)(?:\s+max\s+(\d+))?$/i.exec(line);
  if (!match?.[1] || !match[2]) {
    warn(ctx, `Invalid foreach syntax: "${line}"`);
    return createPromptNode(nextId(ctx), line);
  }
  const variableName = match[1];
  const listExpression = stripQuotes(match[2].trim());
  const max = match[3] ? parseInt(match[3], 10) : undefined;
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  return createForeachNode(nextId(ctx), variableName, listExpression, body, max);
}

function parseSpawnBlock(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^spawn\s+"([^"]+)"/i.exec(line) ?? /^spawn\s+'([^']+)'/i.exec(line);
  if (!match?.[1]) {
    warn(ctx, `Invalid spawn syntax: "${line}" — expected spawn "name"`);
    return createPromptNode(nextId(ctx), line);
  }
  const name = match[1];
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  return createSpawnNode(nextId(ctx), name, body);
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
  warn(ctx, 'Missing "end" — auto-closed block');
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
  if (lower === 'break') {
    return createBreakNode(nextId(ctx));
  }
  if (lower.startsWith('spawn ')) {
    return parseSpawnBlock(ctx, trimmed, indent);
  }
  if (lower.startsWith('await ') || lower === 'await') {
    return parseAwaitLine(ctx, trimmed);
  }
  warn(ctx, `Unknown keyword "${trimmed}" — treating as prompt`);
  return createPromptNode(nextId(ctx), trimmed);
}

export function parseFlow(input: string): FlowSpec {
  const warnings: string[] = [];
  const goal = parseGoal(input);
  const gates = parseGates(input);
  const flowLines = extractFlowBlock(input);
  const ctx: ParseContext = {
    lines: flowLines,
    pos: 0,
    warnings,
    nodeCounter: 0,
  };
  const nodes = parseBlock(ctx, -1);
  return createFlowSpec(goal, nodes, gates, warnings);
}
