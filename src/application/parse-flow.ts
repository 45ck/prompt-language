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
  createRaceNode,
  createForeachSpawnNode,
  createRememberNode,
  createSendNode,
  createReceiveNode,
  createApproveNode,
  createReviewNode,
  DEFAULT_MAX_ITERATIONS,
} from '../domain/flow-node.js';
import type { SpawnNode } from '../domain/flow-node.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';
import { ASK_CONDITION_PREFIX } from '../domain/judge-prompt.js';

interface LibraryParam {
  readonly name: string;
  readonly default?: string | undefined;
}

interface LibraryExport {
  readonly kind: 'flow' | 'gates' | 'prompt';
  readonly name: string;
  readonly params: readonly LibraryParam[];
  readonly body: string;
}

interface LibraryFile {
  readonly name: string;
  readonly exports: ReadonlyMap<string, LibraryExport>;
}

type LibraryRegistry = ReadonlyMap<string, LibraryFile>;

interface ParseContext {
  lines: readonly string[];
  pos: number;
  warnings: string[];
  nodeCounter: number;
  registry: LibraryRegistry;
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

/** Strip surrounding single or double quotes from a string value. */
function stripQuotesStandalone(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse key=value args from a use call argument string (standalone, no ParseContext). */
function parseUseArgsStandalone(argsStr: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!argsStr.trim()) return result;
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (const ch of argsStr) {
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (inQuote && ch === quoteChar) {
      inQuote = false;
      current += ch;
    } else if (!inQuote && ch === ',') {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    const val = stripQuotesStandalone(rawVal);
    if (key) result.set(key, val);
  }
  return result;
}

/** Substitute ${param} placeholders (standalone, no ParseContext). */
function substituteParamsStandalone(body: string, bindings: Map<string, string>): string {
  return body.replace(/\$\{(\w+)\}/g, (match, name: string) => {
    return bindings.has(name) ? (bindings.get(name) ?? match) : match;
  });
}

/** Parse the "done when:" section into completion gates. */
export function parseGates(
  input: string,
  registry?: LibraryRegistry,
  warnings?: string[],
): readonly CompletionGate[] {
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

    // Handle `use namespace.symbol()` for export gates
    const useMatch = /^use\s+(\w+)\.(\w+)\s*\(([^)]*)\)\s*$/i.exec(trimmed);
    if (useMatch?.[1] && useMatch[2] && registry) {
      const namespace = useMatch[1];
      const symbol = useMatch[2];
      const argsStr = useMatch[3] ?? '';
      const libFile = registry.get(namespace);
      if (!libFile) {
        warnings?.push(`Unknown namespace "${namespace}" in done when: use`);
      } else {
        const exported = libFile.exports.get(symbol);
        if (!exported) {
          warnings?.push(`Unknown symbol "${symbol}" in namespace "${namespace}"`);
        } else if (exported.kind === 'gates') {
          // Parse bound body as gate predicates
          const providedArgs = parseUseArgsStandalone(argsStr);
          const bindings = new Map<string, string>();
          for (const param of exported.params) {
            if (providedArgs.has(param.name)) {
              bindings.set(param.name, providedArgs.get(param.name)!);
            } else if (param.default !== undefined) {
              bindings.set(param.name, param.default);
            } else {
              warnings?.push(
                `Missing required argument "${param.name}" for use ${namespace}.${symbol}`,
              );
            }
          }
          const expandedBody = substituteParamsStandalone(exported.body, bindings);
          for (const gateLine of expandedBody.split('\n')) {
            const gt = gateLine.trim();
            if (gt) gates.push(createCompletionGate(gt));
          }
        } else {
          warnings?.push(`Symbol "${symbol}" is not an export gates — cannot use in done when:`);
        }
      }
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

interface AskConditionOptions {
  readonly groundedBy?: string | undefined;
  readonly maxRetries?: number | undefined;
}

function parseAskConditionOptions(trailing: string, ctx: ParseContext): AskConditionOptions {
  let working = trailing;
  let groundedBy: string | undefined;
  let maxRetries: number | undefined;

  const groundedMatch = /\bgrounded-by\s+(?:"([^"]+)"|'([^']+)')/i.exec(working);
  if (groundedMatch) {
    groundedBy = groundedMatch[1] ?? groundedMatch[2];
    working = working.replace(groundedMatch[0], '').trim();
  }

  const maxRetriesMatch = /\bmax-retries\s+(\d+)\b/i.exec(working);
  if (maxRetriesMatch?.[1]) {
    maxRetries = parseInt(maxRetriesMatch[1], 10);
    working = working.replace(maxRetriesMatch[0], '').trim();
  }

  working = working.replace(/\bmax\s+\d+\b/i, '').trim();

  if (working.trim()) {
    warn(ctx, `Unrecognized ask condition options: "${working.trim()}"`);
  }

  return {
    ...(groundedBy != null ? { groundedBy } : {}),
    ...(maxRetries != null ? { maxRetries } : {}),
  };
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
  const askMatch = /^while\s+ask\s+["']([^"']+)["'](.*)$/i.exec(stripped);
  if (askMatch) {
    const question = askMatch[1]!;
    const askOpts = parseAskConditionOptions(askMatch[2] ?? '', ctx);
    const maxMatch = /\bmax\s+(\d+)\b/i.exec(askMatch[2] ?? '');
    let askMax = maxMatch?.[1] ? parseInt(maxMatch[1], 10) : undefined;
    if (askMax === undefined) {
      warn(
        ctx,
        `Missing "max N" on while ask — defaulting to 5. Try: while ask "${question}" max 5`,
      );
      askMax = DEFAULT_MAX_ITERATIONS;
    }
    const askBody = parseBlock(ctx, baseIndent);
    consumeEnd(ctx);
    return createWhileNode(
      nextId(ctx),
      `${ASK_CONDITION_PREFIX}"${question}"`,
      askBody,
      askMax,
      label,
      timeout,
      askOpts.groundedBy,
      askOpts.maxRetries,
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
  consumeEnd(ctx);
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
  const askMatch = /^until\s+ask\s+["']([^"']+)["'](.*)$/i.exec(stripped);
  if (askMatch) {
    const question = askMatch[1]!;
    const askOpts = parseAskConditionOptions(askMatch[2] ?? '', ctx);
    const maxMatch = /\bmax\s+(\d+)\b/i.exec(askMatch[2] ?? '');
    let askMax = maxMatch?.[1] ? parseInt(maxMatch[1], 10) : undefined;
    if (askMax === undefined) {
      warn(
        ctx,
        `Missing "max N" on until ask — defaulting to 5. Try: until ask "${question}" max 5`,
      );
      askMax = DEFAULT_MAX_ITERATIONS;
    }
    const askBody = parseBlock(ctx, baseIndent);
    consumeEnd(ctx);
    return createUntilNode(
      nextId(ctx),
      `${ASK_CONDITION_PREFIX}"${question}"`,
      askBody,
      askMax,
      label,
      timeout,
      askOpts.groundedBy,
      askOpts.maxRetries,
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
  consumeEnd(ctx);
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
  consumeEnd(ctx);
  return createRetryNode(nextId(ctx), body, max, label, timeout, backoffMs);
}

function parseIfLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  // AI-evaluated condition: if ask "question" [grounded-by "cmd"]
  const askMatch = /^if\s+ask\s+["']([^"']+)["'](.*)$/i.exec(line.trim());
  let condition: string;
  let groundedBy: string | undefined;
  let askMaxRetries: number | undefined;
  if (askMatch) {
    condition = `${ASK_CONDITION_PREFIX}"${askMatch[1]!}"`;
    const askOpts = parseAskConditionOptions(askMatch[2] ?? '', ctx);
    groundedBy = askOpts.groundedBy;
    askMaxRetries = askOpts.maxRetries;
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
  return createIfNode(nextId(ctx), condition, thenBranch, elseBranch, groundedBy, askMaxRetries);
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
    // Check for `as json { ... }` suffix — may be single-line or multi-line
    const promptRhs = effectiveRhs.slice(7).trim();
    const asJsonMatch = /^(["'][^"']*["'])\s+as\s+json\s*\{(.*)$/i.exec(promptRhs);
    if (asJsonMatch?.[1] && asJsonMatch[2] !== undefined) {
      const text = stripQuotes(asJsonMatch[1]);
      const afterBrace = asJsonMatch[2];
      // Collect schema lines until closing `}` at base indent or dedented
      const schemaLines: string[] = [];
      if (afterBrace.trim().endsWith('}')) {
        // Single-line: `as json { ... }`
        const inner = afterBrace.trim().slice(0, -1).trim();
        schemaLines.push(inner);
      } else {
        // Multi-line: consume ctx lines until we see a `}` alone or a dedented `}`
        if (afterBrace.trim()) schemaLines.push(afterBrace.trim());
        while (ctx.pos < ctx.lines.length) {
          const schemaLine = ctx.lines[ctx.pos] ?? '';
          ctx.pos += 1;
          const trimmedSchema = schemaLine.trim();
          if (trimmedSchema === '}' || trimmedSchema.startsWith('}')) {
            // Stop at closing brace — don't include it in schema text
            break;
          }
          schemaLines.push(trimmedSchema);
        }
      }
      const schema = schemaLines.join('\n').trim();
      source = { type: 'prompt_json', text, schema };
    } else {
      const text = stripQuotes(promptRhs);
      source = { type: 'prompt', text };
    }
  } else if (effectiveLower.startsWith('run ')) {
    const command = stripQuotes(effectiveRhs.slice(4).trim());
    source = { type: 'run', command };
  } else if (effectiveLower.startsWith('memory ')) {
    const memoryRhs = effectiveRhs.slice(7).trim();
    const memoryMatch = /^(?:"([^"]+)"|'([^']+)'|(\S+))$/i.exec(memoryRhs);
    if (!memoryMatch?.[1] && !memoryMatch?.[2] && !memoryMatch?.[3]) {
      warn(ctx, `Invalid memory syntax: "${trimmed}" — try: let name = memory "key"`);
      return createPromptNode(nextId(ctx), trimmed);
    }
    const key = (memoryMatch[1] ?? memoryMatch[2] ?? memoryMatch[3] ?? '').trim();
    if (!key) {
      warn(ctx, `Invalid memory syntax: "${trimmed}" — try: let name = memory "key"`);
      return createPromptNode(nextId(ctx), trimmed);
    }
    source = { type: 'memory', key };
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

/** Extract optional `if <condition>` suffix from spawn line. */
function extractSpawnCondition(line: string): string | undefined {
  const condMatch = /\bif\s+(\S.*)$/i.exec(line);
  const trimmed = condMatch?.[1]?.trim();
  return trimmed !== '' ? trimmed : undefined;
}

/** Strip `if <condition>` suffix from spawn line. */
function stripConditionSuffix(line: string): string {
  return line.replace(/\s+if\s+\S.*$/i, '');
}

/** Extract optional `model "name"` from spawn line (after spawn name). */
function extractSpawnModel(line: string): string | undefined {
  const modelMatch = /\bmodel\s+(?:"([^"]+)"|'([^']+)')/i.exec(line);
  return modelMatch?.[1] ?? modelMatch?.[2] ?? undefined;
}

/** Strip `model "name"` from spawn line. */
function stripModelSuffix(line: string): string {
  return line.replace(/\s+model\s+(?:"[^"]*"|'[^']*')/i, '');
}

function parseSpawnBlock(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  // Parse in order: vars (suffix), condition (suffix), model (middle), cwd (middle), name
  // H-SEC-005: Extract optional vars allowlist before other parsing
  const vars = extractSpawnVars(line);
  let cleanLine = stripVarsSuffix(line);

  // beads: prompt-language-lmep — extract optional `if <condition>` suffix
  const condition = extractSpawnCondition(cleanLine);
  cleanLine = stripConditionSuffix(cleanLine);

  // beads: prompt-language-2j9v — extract optional `model "name"`
  const model = extractSpawnModel(cleanLine);
  cleanLine = stripModelSuffix(cleanLine);

  // H-INT-005: Parse optional `in "path"` for cross-directory spawn
  const cwdMatch =
    /^spawn\s+"([^"]+)"\s+in\s+"([^"]+)"/i.exec(cleanLine) ??
    /^spawn\s+'([^']+)'\s+in\s+'([^']+)'/i.exec(cleanLine);
  if (cwdMatch?.[1] && cwdMatch[2]) {
    const body = parseBlock(ctx, baseIndent);
    consumeEnd(ctx);
    return createSpawnNode(nextId(ctx), cwdMatch[1], body, cwdMatch[2], vars, model, condition);
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
  return createSpawnNode(nextId(ctx), name, body, undefined, vars, model, condition);
}

function parseRaceBlock(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  const timeout = parseTimeout(line);
  const rawNodes = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  const children: SpawnNode[] = [];
  for (const node of rawNodes) {
    if (node.kind === 'spawn') {
      children.push(node);
    } else {
      warn(ctx, `Only spawn nodes are allowed inside a race block; ignoring "${node.kind}" node`);
    }
  }
  return createRaceNode(nextId(ctx), children, timeout);
}

function parseForeachSpawnLine(
  ctx: ParseContext,
  line: string,
  baseIndent: number,
  label?: string,
): FlowNode {
  const match = /^foreach-spawn\s+(\w+)\s+in\s+(.+?)(?:\s+max\s+(\d+))?$/i.exec(line);
  if (!match?.[1] || !match[2]) {
    warn(ctx, `Invalid foreach-spawn syntax: "${line}". Try: foreach-spawn item in \${list}`);
    return createPromptNode(nextId(ctx), line);
  }
  const variableName = match[1];
  const rawExpr = match[2].trim();
  const max = match[3] ? parseInt(match[3], 10) : undefined;
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  const runMatch = /^run\s+(.+)$/i.exec(rawExpr);
  if (runMatch?.[1]) {
    const command = stripQuotes(runMatch[1].trim());
    return createForeachSpawnNode(nextId(ctx), variableName, '', body, max, label, command);
  }
  const listExpression = stripQuotes(rawExpr);
  return createForeachSpawnNode(nextId(ctx), variableName, listExpression, body, max, label);
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

function parseRememberLine(ctx: ParseContext, trimmed: string): FlowNode {
  const rest = trimmed.slice('remember'.length).trim();
  if (!rest) {
    warn(ctx, 'remember node has no content — add a quoted text or key=... value=...');
    return createRememberNode(nextId(ctx));
  }
  // remember key = "k" value = "v"
  const kvMatch = /^key\s*=\s*["']([^"']*)["']\s+value\s*=\s*["']([^"']*)["']$/i.exec(rest);
  if (kvMatch?.[1] !== undefined && kvMatch[2] !== undefined) {
    return createRememberNode(nextId(ctx), undefined, kvMatch[1], kvMatch[2]);
  }
  // remember "text"
  const textMatch = /^["'](.*)["']$/.exec(rest);
  if (textMatch?.[1] !== undefined) {
    return createRememberNode(nextId(ctx), textMatch[1]);
  }
  return createRememberNode(nextId(ctx), rest);
}

function parseSendLine(ctx: ParseContext, trimmed: string): FlowNode {
  // send "message" to target
  const messageToTargetDoubleMatch =
    /^send\s+"([^"]*)"\s+to\s+(parent|[\w-]+|"[^"]+"|'[^']+')$/i.exec(trimmed);
  if (messageToTargetDoubleMatch?.[1] !== undefined && messageToTargetDoubleMatch[2]) {
    return createSendNode(
      nextId(ctx),
      stripQuotes(messageToTargetDoubleMatch[2]),
      messageToTargetDoubleMatch[1],
    );
  }
  // send 'message' to target
  const messageToTargetSingleMatch =
    /^send\s+'([^']*)'\s+to\s+(parent|[\w-]+|"[^"]+"|'[^']+')$/i.exec(trimmed);
  if (messageToTargetSingleMatch?.[1] !== undefined && messageToTargetSingleMatch[2]) {
    return createSendNode(
      nextId(ctx),
      stripQuotes(messageToTargetSingleMatch[2]),
      messageToTargetSingleMatch[1],
    );
  }
  // send "target" "message"
  const doubleQuoteMatch = /^send\s+"([^"]+)"\s+"([^"]*)"$/i.exec(trimmed);
  if (doubleQuoteMatch?.[1] !== undefined && doubleQuoteMatch[2] !== undefined) {
    return createSendNode(nextId(ctx), doubleQuoteMatch[1], doubleQuoteMatch[2]);
  }
  // send parent "message"
  const parentMatch = /^send\s+parent\s+"([^"]*)"$/i.exec(trimmed);
  if (parentMatch?.[1] !== undefined) {
    return createSendNode(nextId(ctx), 'parent', parentMatch[1]);
  }
  // send parent 'message' (single quotes)
  const parentSingleMatch = /^send\s+parent\s+'([^']*)'$/i.exec(trimmed);
  if (parentSingleMatch?.[1] !== undefined) {
    return createSendNode(nextId(ctx), 'parent', parentSingleMatch[1]);
  }
  // send 'target' 'message' (single quotes)
  const singleQuoteMatch = /^send\s+'([^']+)'\s+'([^']*)'$/i.exec(trimmed);
  if (singleQuoteMatch?.[1] !== undefined && singleQuoteMatch[2] !== undefined) {
    return createSendNode(nextId(ctx), singleQuoteMatch[1], singleQuoteMatch[2]);
  }
  warn(ctx, `Invalid send syntax: "${trimmed}". Try: send "target" "message" or send parent "msg"`);
  return createPromptNode(nextId(ctx), trimmed);
}

function parseReceiveLine(ctx: ParseContext, trimmed: string): FlowNode {
  const match =
    /^receive\s+(\w+)(?:\s+from\s+(parent|[\w-]+|"[^"]+"|'[^']+'))?(?:\s+timeout\s+(\d+))?$/i.exec(
      trimmed,
    );
  if (match?.[1]) {
    return createReceiveNode(
      nextId(ctx),
      match[1],
      match[2] ? stripQuotes(match[2]) : undefined,
      match[3] ? parseInt(match[3], 10) : undefined,
    );
  }
  warn(ctx, `Invalid receive syntax: "${trimmed}". Try: receive msg or receive msg from "source"`);
  return createPromptNode(nextId(ctx), trimmed);
}

function parseApproveLine(ctx: ParseContext, trimmed: string): FlowNode {
  const match = /^approve\s+(?:"([^"]+)"|'([^']+)')(?:\s+timeout\s+(\d+))?$/i.exec(trimmed);
  if (!match) {
    warn(
      ctx,
      `Invalid approve syntax: "${trimmed}". Try: approve "message" or approve "message" timeout 60`,
    );
    return createPromptNode(nextId(ctx), trimmed);
  }
  const message = (match[1] ?? match[2])!;
  const timeoutSeconds = match[3] != null ? parseInt(match[3], 10) : undefined;
  return createApproveNode(nextId(ctx), message, timeoutSeconds);
}

interface ReviewSpec {
  readonly maxRounds: number;
  readonly criteria: string | undefined;
  readonly groundedBy: string | undefined;
}

function parseReviewOpenLine(trimmed: string): ReviewSpec | null {
  // Strip leading "review" keyword
  const rest = trimmed.slice('review'.length).trim();
  if (!rest) return null;

  // Extract criteria: "..." or criteria: '...'
  let criteria: string | undefined;
  let working = rest;
  const criteriaMatch = /\bcriteria:\s*(?:"([^"]+)"|'([^']+)')/i.exec(working);
  if (criteriaMatch) {
    criteria = criteriaMatch[1] ?? criteriaMatch[2];
    working = working.replace(criteriaMatch[0], '').trim();
  }

  // Extract grounded-by "cmd" or grounded-by 'cmd'
  let groundedBy: string | undefined;
  const groundedMatch = /\bgrounded-by\s+(?:"([^"]+)"|'([^']+)')/i.exec(working);
  if (groundedMatch) {
    groundedBy = groundedMatch[1] ?? groundedMatch[2];
    working = working.replace(groundedMatch[0], '').trim();
  }

  // Extract required max N
  const maxMatch = /\bmax\s+(\d+)\b/i.exec(working);
  if (!maxMatch?.[1]) return null;
  const maxRounds = parseInt(maxMatch[1], 10);

  return { maxRounds, criteria, groundedBy };
}

function parseReviewBlock(ctx: ParseContext, trimmed: string, baseIndent: number): FlowNode {
  const spec = parseReviewOpenLine(trimmed);
  if (!spec) {
    warn(
      ctx,
      `Invalid review syntax: "${trimmed}". Try: review max 3 or review criteria: "..." max 3`,
    );
    return createPromptNode(nextId(ctx), trimmed);
  }
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  return createReviewNode(nextId(ctx), body, spec.maxRounds, spec.criteria, spec.groundedBy);
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
    if (lower.startsWith('use ')) {
      const expanded = expandUse(trimmed, ctx);
      nodes.push(...expanded);
      continue;
    }
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
    // D2: allow either [timeout N] or bare trailing timeout N.
    const bracketTimeoutMatch = /^(.+?)\s+\[timeout\s+(\d+)\]$/i.exec(runText);
    const bareTimeoutMatch = /^(.+?)\s+timeout\s+(\d+)$/i.exec(runText);
    const timeoutMatch =
      bracketTimeoutMatch ??
      (bareTimeoutMatch && (bareTimeoutMatch[1]?.trim().split(/\s+/).length ?? 0) > 1
        ? bareTimeoutMatch
        : null);
    if (timeoutMatch?.[1] && timeoutMatch[2]) {
      const timeoutSecondsRaw = timeoutMatch[2] ?? timeoutMatch[3];
      const timeoutSec = parseInt(timeoutSecondsRaw ?? '', 10);
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
  if (lower === 'race' || lower.startsWith('race ')) {
    return parseRaceBlock(ctx, trimmed, indent);
  }
  if (lower.startsWith('foreach-spawn ')) {
    return parseForeachSpawnLine(ctx, trimmed, indent);
  }
  if (lower.startsWith('remember') || lower === 'remember') {
    return parseRememberLine(ctx, trimmed);
  }
  if (lower.startsWith('send ')) {
    return parseSendLine(ctx, trimmed);
  }
  if (lower.startsWith('receive ') || lower === 'receive') {
    return parseReceiveLine(ctx, trimmed);
  }
  if (lower.startsWith('approve ')) {
    return parseApproveLine(ctx, trimmed);
  }
  if (lower.startsWith('review ') || lower === 'review') {
    return parseReviewBlock(ctx, trimmed, indent);
  }
  warn(
    ctx,
    `Unknown keyword "${trimmed}" — treating as prompt. Valid keywords: prompt, run, let, while, until, retry, if, try, foreach, foreach-spawn, break, continue, spawn, await, race, remember, send, receive, approve, review`,
  );
  return createPromptNode(nextId(ctx), trimmed);
}

/** Parse the optional "memory:" section into an array of key names to prefetch. */
export function parseMemoryKeys(input: string): readonly string[] {
  const match =
    /^memory:\s*\n([\s\S]*?)(?=\n\s*(?:env:|flow:|done when:))/im.exec(input) ??
    /^memory:\s*\n([\s\S]+)/im.exec(input);
  if (!match?.[1]) return [];
  const keys: string[] = [];
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(?:env|flow|done when):/i.test(trimmed)) break;
    if (/^\w+$/.test(trimmed)) keys.push(trimmed);
  }
  return keys;
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

/** Parse a library file into a LibraryFile structure. */
export function parseLibraryFile(content: string): LibraryFile {
  const lines = content.split('\n');
  let libraryName = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headerMatch = /^library:\s*(\S+)/i.exec(trimmed);
    if (headerMatch?.[1]) {
      libraryName = headerMatch[1];
    }
    break;
  }

  const exports = new Map<string, LibraryExport>();
  const exportRe = /^export\s+(flow|gates|prompt)\s+(\w+)\s*(?:\(([^)]*)\))?\s*:\s*$/i;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    const exportMatch = exportRe.exec(trimmed);
    if (exportMatch?.[1] && exportMatch[2]) {
      const kind = exportMatch[1].toLowerCase() as 'flow' | 'gates' | 'prompt';
      const name = exportMatch[2];
      const rawParams = exportMatch[3] ?? '';
      const params: LibraryParam[] = [];
      if (rawParams.trim()) {
        for (const part of rawParams.split(',')) {
          const p = part.trim();
          if (!p) continue;
          const defaultMatch =
            /^(\w+)\s*=\s*"([^"]*)"$/.exec(p) ?? /^(\w+)\s*=\s*'([^']*)'$/.exec(p);
          if (defaultMatch?.[1] && defaultMatch[2] !== undefined) {
            params.push({ name: defaultMatch[1], default: defaultMatch[2] });
          } else {
            params.push({ name: p });
          }
        }
      }
      i += 1;
      const bodyLines: string[] = [];
      while (i < lines.length) {
        const bodyLine = lines[i] ?? '';
        const bodyTrimmed = bodyLine.trim();
        if (exportRe.test(bodyTrimmed)) break;
        bodyLines.push(bodyLine);
        i += 1;
      }
      while (bodyLines.length > 0 && !(bodyLines[bodyLines.length - 1] ?? '').trim()) {
        bodyLines.pop();
      }
      const body = bodyLines.join('\n');
      exports.set(name, { kind, name, params, body });
    } else {
      i += 1;
    }
  }

  return { name: libraryName, exports };
}

/** Parse positional or key=value args from a `use` call argument string. */
function parseUseArgs(argsStr: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!argsStr.trim()) return result;
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (const ch of argsStr) {
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (inQuote && ch === quoteChar) {
      inQuote = false;
      current += ch;
    } else if (!inQuote && ch === ',') {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    const val = stripQuotes(rawVal);
    if (key) result.set(key, val);
  }
  return result;
}

/** Substitute ${param} placeholders in body text with bound values (only known params). */
function substituteParams(body: string, bindings: Map<string, string>): string {
  return body.replace(/\$\{(\w+)\}/g, (match, name: string) => {
    return bindings.has(name) ? (bindings.get(name) ?? match) : match;
  });
}

/** Expand a `use namespace.symbol(args)` line into FlowNodes. */
function expandUse(line: string, ctx: ParseContext): FlowNode[] {
  const useMatch = /^use\s+(\w+)\.(\w+)\s*\(([^)]*)\)\s*$/i.exec(line);
  if (!useMatch?.[1] || !useMatch[2]) {
    ctx.warnings.push(
      `line ${ctx.pos}: Invalid use syntax: "${line}" — expected: use namespace.symbol(args)`,
    );
    return [];
  }
  const namespace = useMatch[1];
  const symbol = useMatch[2];
  const argsStr = useMatch[3] ?? '';

  const libFile = ctx.registry.get(namespace);
  if (!libFile) {
    ctx.warnings.push(`line ${ctx.pos}: Unknown namespace "${namespace}" — did you import it?`);
    return [];
  }
  const exported = libFile.exports.get(symbol);
  if (!exported) {
    ctx.warnings.push(`line ${ctx.pos}: Unknown symbol "${symbol}" in namespace "${namespace}"`);
    return [];
  }

  const providedArgs = parseUseArgs(argsStr);
  const bindings = new Map<string, string>();
  for (const param of exported.params) {
    if (providedArgs.has(param.name)) {
      bindings.set(param.name, providedArgs.get(param.name)!);
    } else if (param.default !== undefined) {
      bindings.set(param.name, param.default);
    } else {
      ctx.warnings.push(
        `line ${ctx.pos}: Missing required argument "${param.name}" for use ${namespace}.${symbol}`,
      );
    }
  }

  const expandedBody = substituteParams(exported.body, bindings);

  if (exported.kind === 'prompt') {
    return [createPromptNode(nextId(ctx), expandedBody.trim())];
  }

  if (exported.kind === 'flow') {
    const bodyLines = expandedBody.split('\n');
    const savedLines = ctx.lines;
    const savedPos = ctx.pos;
    ctx.lines = bodyLines;
    ctx.pos = 0;
    const nodes = parseBlock(ctx, -1);
    ctx.lines = savedLines;
    ctx.pos = savedPos;
    return nodes;
  }

  ctx.warnings.push(`line ${ctx.pos}: Cannot use export gates "${symbol}" as a flow node`);
  return [];
}

/** IMPORT_RE matches: import "path" or import 'path' or import "path" as namespace */
const IMPORT_RE = /^import\s+(?:"([^"]+)"|'([^']+)')(?:\s+as\s+(\w+))?$/i;

interface ImportResult {
  /** Input text with import lines removed (for gate/env/goal parsing). */
  text: string;
  /** Flow lines inlined from anonymous imports, to be prepended to the extracted flow block. */
  inlinedFlowLines: string[];
  registry: LibraryRegistry;
  importedPaths: string[];
}

/**
 * Resolve `import "path"` and `import "path" as namespace` directives.
 * Anonymous imports collect the imported file's flow lines into inlinedFlowLines
 * (prepended to the parent flow block by parseFlow).
 * Namespaced imports register the library in the registry.
 */
function resolveImports(
  input: string,
  warnings: string[],
  basePath: string,
  seen: Set<string>,
  fileReader: (path: string) => string,
): ImportResult {
  const registry = new Map<string, LibraryFile>();
  const importedPaths: string[] = [];
  const outputLines: string[] = [];
  const inlinedFlowLines: string[] = [];

  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    const importMatch = IMPORT_RE.exec(trimmed);

    if (!importMatch) {
      outputLines.push(line);
      continue;
    }

    const importPath = (importMatch[1] ?? importMatch[2])!;
    const namespace = importMatch[3] ?? null;

    if (isAbsolute(importPath) || !SAFE_INCLUDE_RE.test(importPath)) {
      warnings.push(
        `Invalid import path "${importPath}" — must be a relative path with .flow/.prompt/.txt extension`,
      );
      continue;
    }

    const fullPath = resolve(basePath, importPath);
    if (seen.has(fullPath)) {
      warnings.push(`Circular import detected: "${importPath}" — skipping`);
      continue;
    }

    seen.add(fullPath);
    let content: string;
    try {
      content = fileReader(fullPath);
    } catch {
      warnings.push(`Could not read import file "${importPath}"`);
      continue;
    }

    importedPaths.push(fullPath);

    if (namespace !== null) {
      const libFile = parseLibraryFile(content);
      registry.set(namespace, libFile);
    } else {
      // Anonymous import: recursively resolve imports in the file, then collect its flow lines
      const subResult = resolveImports(content, warnings, dirname(fullPath), seen, fileReader);
      for (const [ns, lib] of subResult.registry) {
        if (!registry.has(ns)) registry.set(ns, lib);
      }
      importedPaths.push(...subResult.importedPaths);
      const importedFlowLines = extractFlowBlock(subResult.text);
      inlinedFlowLines.push(...subResult.inlinedFlowLines);
      inlinedFlowLines.push(...importedFlowLines.map((l) => `  ${l.trimStart()}`));
    }
  }

  return { text: outputLines.join('\n'), inlinedFlowLines, registry, importedPaths };
}

export function parseFlow(
  input: string,
  options?: { basePath?: string; fileReader?: (path: string) => string },
): FlowSpec {
  const warnings: string[] = [];
  const goal = parseGoal(input);
  const env = parseEnv(input);
  const memoryKeys = parseMemoryKeys(input);
  const basePath = options?.basePath ?? process.cwd();
  const fileReader = options?.fileReader ?? ((p: string) => readFileSync(p, 'utf-8'));

  const seen = new Set<string>();
  const importResult = resolveImports(input, warnings, basePath, seen, fileReader);
  const { text: resolvedText, inlinedFlowLines, registry, importedPaths } = importResult;

  const gates = parseGates(resolvedText, registry, warnings);
  const rawLines = [...inlinedFlowLines, ...extractFlowBlock(resolvedText)];
  // H-INT-001: Resolve include directives (share `seen` for cross-pass cycle detection)
  const flowLines = resolveIncludes(rawLines, warnings, basePath, seen, fileReader);
  const ctx: ParseContext = {
    lines: flowLines,
    pos: 0,
    warnings,
    nodeCounter: 0,
    registry,
  };
  const nodes = parseBlock(ctx, -1);
  return createFlowSpec(
    goal,
    nodes,
    gates,
    warnings,
    undefined,
    env,
    importedPaths,
    memoryKeys.length > 0 ? memoryKeys : undefined,
  );
}
