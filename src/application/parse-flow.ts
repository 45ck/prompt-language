/**
 * DSL parser — converts flow DSL text into a FlowSpec.
 *
 * Soft parser: produces warnings instead of errors for recoverable issues.
 */

import type { FlowNode } from '../domain/flow-node.js';
import type { CompletionGate, FlowSpec } from '../domain/flow-spec.js';
import {
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createPromptNode,
  createRunNode,
  createTryNode,
} from '../domain/flow-node.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';

interface ParseContext {
  lines: readonly string[];
  pos: number;
  warnings: string[];
  nodeCounter: number;
}

const DEFAULT_MAX = 5;

function nextId(ctx: ParseContext): string {
  ctx.nodeCounter += 1;
  return `n${ctx.nodeCounter}`;
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
function parseGates(input: string): readonly CompletionGate[] {
  const match = /done when:\s*\n([\s\S]*)$/im.exec(input);
  if (!match?.[1]) return [];
  const block = match[1];
  const gates: CompletionGate[] = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
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
  const doneIdx = input.search(/\ndone when:/im);
  const flowMatch = /^flow:\s*\n/im.exec(input);
  if (!flowMatch) return [];
  const start = flowMatch.index + flowMatch[0].length;
  const end = doneIdx >= 0 ? doneIdx : input.length;
  return input.slice(start, end).split('\n');
}

/** Detect natural language and convert to structured DSL. */
function normalizeNaturalLanguage(input: string, warnings: string[]): string {
  let result = input;
  const patterns: { re: RegExp; repl: string; msg: string }[] = [
    {
      re: /keep going until (.+)/i,
      repl: 'until $1 max 5',
      msg: 'Converted "keep going until" to until loop',
    },
    {
      re: /don'?t stop until (.+)/i,
      repl: 'until $1 max 5',
      msg: 'Converted "don\'t stop until" to until loop',
    },
    {
      re: /loop until (.+)/i,
      repl: 'until $1 max 5',
      msg: 'Converted "loop until" to until loop',
    },
    {
      re: /retry (\d+) times/i,
      repl: 'retry max $1',
      msg: 'Converted "retry N times" to retry block',
    },
  ];
  for (const { re, repl, msg } of patterns) {
    if (re.test(result)) {
      result = result.replace(re, repl);
      warnings.push(msg);
    }
  }
  return result;
}

function parseWhileLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^while\s+(?:not\s+)?(\S+)(?:\s+max\s+(\d+))?/i.exec(line);
  const condition = match?.[1] ?? 'true';
  let max = match?.[2] ? parseInt(match[2], 10) : undefined;
  if (!/max\s+\d+/i.exec(line)) {
    ctx.warnings.push('Missing "max N" on while — defaulting to 5');
    max = DEFAULT_MAX;
  }
  const negated = /^while\s+not\s+/i.test(line);
  const cond = negated ? `not ${condition}` : condition;
  const body = parseBlock(ctx, baseIndent);
  return createWhileNode(nextId(ctx), cond, body, max);
}

function parseUntilLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const match = /^until\s+(\S+)(?:\s+max\s+(\d+))?/i.exec(line);
  const condition = match?.[1] ?? 'true';
  let max = match?.[2] ? parseInt(match[2], 10) : undefined;
  if (!/max\s+\d+/i.exec(line)) {
    ctx.warnings.push('Missing "max N" on until — defaulting to 5');
    max = DEFAULT_MAX;
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
  const body = parseBlock(ctx, baseIndent, ['catch', 'end']);
  let catchCondition = 'command_failed';
  let catchBody: FlowNode[] = [];
  if (ctx.pos < ctx.lines.length) {
    const peekLine = ctx.lines[ctx.pos];
    const peek = peekLine ? peekLine.trim() : '';
    const catchMatch = /^catch(?:\s+(.+))?/i.exec(peek);
    if (catchMatch) {
      catchCondition = catchMatch[1]?.trim() ?? 'command_failed';
      ctx.pos += 1;
      catchBody = parseBlock(ctx, baseIndent, ['end']);
    }
  }
  consumeEnd(ctx);
  return createTryNode(nextId(ctx), body, catchCondition, catchBody);
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
  ctx.warnings.push('Missing "end" — auto-closed block');
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
    return createRunNode(nextId(ctx), trimmed.slice(4).trim());
  }
  if (lower.startsWith('let ')) return null;
  ctx.warnings.push(`Unknown keyword "${trimmed}" — treating as prompt`);
  return createPromptNode(nextId(ctx), trimmed);
}

export function parseFlow(input: string): FlowSpec {
  const warnings: string[] = [];
  const normalized = normalizeNaturalLanguage(input, warnings);
  const goal = parseGoal(normalized);
  const gates = parseGates(normalized);
  const flowLines = extractFlowBlock(normalized);
  const ctx: ParseContext = {
    lines: flowLines,
    pos: 0,
    warnings,
    nodeCounter: 0,
  };
  const nodes = parseBlock(ctx, -1);
  return createFlowSpec(goal, nodes, gates, warnings);
}
