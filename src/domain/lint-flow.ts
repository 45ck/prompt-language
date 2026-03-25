/**
 * lintFlow — Pure flow linter detecting anti-patterns.
 *
 * H#75: Warns about common mistakes in flow definitions.
 * H-DX-001: Unresolved variable warnings with "did you mean?" suggestions.
 * H-DX-010: Infinite loop warnings when loop body has no run node.
 * Returns an array of lint warnings.
 */

import type { FlowNode } from './flow-node.js';
import type { FlowSpec } from './flow-spec.js';
import { isAskCondition } from './judge-prompt.js';

export interface LintWarning {
  readonly nodeId: string;
  readonly message: string;
}

/** Built-in auto-variables that are always available at runtime. */
const BUILTIN_AUTO_VARIABLES = new Set([
  'last_exit_code',
  'command_failed',
  'command_succeeded',
  'last_stdout',
  'last_stderr',
]);

/** Condition predicates that require a run node to change state. */
const STATE_CHANGING_PREDICATES = new Set([
  'tests_fail',
  'tests_pass',
  'command_failed',
  'command_succeeded',
  'lint_pass',
  'lint_fail',
]);

/** Levenshtein distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

/** Collect all variable names defined by let/var nodes in the AST. */
function collectDefinedVariables(nodes: readonly FlowNode[]): Set<string> {
  const defined = new Set<string>();
  for (const node of nodes) {
    switch (node.kind) {
      case 'let':
        defined.add(node.variableName);
        break;
      case 'foreach':
        defined.add(node.variableName);
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        break;
      case 'while':
      case 'until':
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        break;
      case 'retry':
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        break;
      case 'if':
        collectDefinedVariables(node.thenBranch).forEach((v) => defined.add(v));
        collectDefinedVariables(node.elseBranch).forEach((v) => defined.add(v));
        break;
      case 'try':
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        collectDefinedVariables(node.catchBody).forEach((v) => defined.add(v));
        collectDefinedVariables(node.finallyBody).forEach((v) => defined.add(v));
        break;
      case 'spawn':
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        break;
      default:
        break;
    }
  }
  return defined;
}

/** Check if a variable name is a known auto-variable (built-in or generated suffix). */
function isAutoVariable(name: string): boolean {
  if (BUILTIN_AUTO_VARIABLES.has(name)) return true;
  // foreach auto-variables: <varName>_index, <varName>_length, and any list _length
  if (name.endsWith('_index') || name.endsWith('_length')) return true;
  return false;
}

/** Extract all ${varName} references from a text string. */
function extractVarRefs(text: string): string[] {
  const refs: string[] = [];
  // Match both ${var:-default} and ${var} forms
  const re = /\$\{(\w+)(?::-((?:[^}\\]|\\.)*))?}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.push(m[1]!);
  }
  return refs;
}

/** Find the closest match from a set of candidates for "did you mean?" suggestions. */
function findClosestMatch(name: string, candidates: ReadonlySet<string>): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  const threshold = Math.max(2, Math.floor(name.length / 2));
  for (const candidate of candidates) {
    const dist = levenshtein(name, candidate);
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

/** H-DX-001: Lint for unresolved variable references. */
function lintUnresolvedVars(
  nodes: readonly FlowNode[],
  definedVars: ReadonlySet<string>,
  warnings: LintWarning[],
): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'prompt': {
        for (const ref of extractVarRefs(node.text)) {
          if (!definedVars.has(ref) && !isAutoVariable(ref)) {
            const suggestion = findClosestMatch(ref, definedVars);
            const msg = suggestion
              ? `Reference to undefined variable "\${${ref}}" — did you mean "\${${suggestion}}"?`
              : `Reference to undefined variable "\${${ref}}"`;
            warnings.push({ nodeId: node.id, message: msg });
          }
        }
        break;
      }
      case 'run': {
        for (const ref of extractVarRefs(node.command)) {
          if (!definedVars.has(ref) && !isAutoVariable(ref)) {
            const suggestion = findClosestMatch(ref, definedVars);
            const msg = suggestion
              ? `Reference to undefined variable "\${${ref}}" — did you mean "\${${suggestion}}"?`
              : `Reference to undefined variable "\${${ref}}"`;
            warnings.push({ nodeId: node.id, message: msg });
          }
        }
        break;
      }
      case 'let': {
        // Check variable references in literal values, run commands, and prompt text
        const text =
          node.source.type === 'literal'
            ? node.source.value
            : node.source.type === 'run'
              ? node.source.command
              : node.source.type === 'prompt'
                ? node.source.text
                : undefined;
        if (text) {
          for (const ref of extractVarRefs(text)) {
            if (!definedVars.has(ref) && !isAutoVariable(ref)) {
              const suggestion = findClosestMatch(ref, definedVars);
              const msg = suggestion
                ? `Reference to undefined variable "\${${ref}}" — did you mean "\${${suggestion}}"?`
                : `Reference to undefined variable "\${${ref}}"`;
              warnings.push({ nodeId: node.id, message: msg });
            }
          }
        }
        break;
      }
      case 'foreach': {
        for (const ref of extractVarRefs(node.listExpression)) {
          if (!definedVars.has(ref) && !isAutoVariable(ref)) {
            const suggestion = findClosestMatch(ref, definedVars);
            const msg = suggestion
              ? `Reference to undefined variable "\${${ref}}" — did you mean "\${${suggestion}}"?`
              : `Reference to undefined variable "\${${ref}}"`;
            warnings.push({ nodeId: node.id, message: msg });
          }
        }
        lintUnresolvedVars(node.body, definedVars, warnings);
        break;
      }
      case 'while':
      case 'until':
        lintUnresolvedVars(node.body, definedVars, warnings);
        break;
      case 'retry':
        lintUnresolvedVars(node.body, definedVars, warnings);
        break;
      case 'if':
        lintUnresolvedVars(node.thenBranch, definedVars, warnings);
        lintUnresolvedVars(node.elseBranch, definedVars, warnings);
        break;
      case 'try':
        lintUnresolvedVars(node.body, definedVars, warnings);
        lintUnresolvedVars(node.catchBody, definedVars, warnings);
        lintUnresolvedVars(node.finallyBody, definedVars, warnings);
        break;
      case 'spawn':
        lintUnresolvedVars(node.body, definedVars, warnings);
        break;
      default:
        break;
    }
  }
}

/** H-DX-010: Check if any node tree contains a run node recursively. */
function containsRunNode(nodes: readonly FlowNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === 'run') return true;
    switch (node.kind) {
      case 'if':
        if (containsRunNode(node.thenBranch) || containsRunNode(node.elseBranch)) return true;
        break;
      case 'try':
        if (
          containsRunNode(node.body) ||
          containsRunNode(node.catchBody) ||
          containsRunNode(node.finallyBody)
        )
          return true;
        break;
      case 'while':
      case 'until':
        if (containsRunNode(node.body)) return true;
        break;
      case 'retry':
        if (containsRunNode(node.body)) return true;
        break;
      case 'foreach':
        if (containsRunNode(node.body)) return true;
        break;
      case 'spawn':
        if (containsRunNode(node.body)) return true;
        break;
      case 'let':
        if (node.source.type === 'run') return true;
        break;
      default:
        break;
    }
  }
  return false;
}

/** Check if a condition text references any state-changing predicates. */
function referencesStateChangingPredicate(condition: string): boolean {
  for (const pred of STATE_CHANGING_PREDICATES) {
    if (condition.includes(pred)) return true;
  }
  return false;
}

function lintNodes(nodes: readonly FlowNode[], insideLoop: boolean, warnings: LintWarning[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'while':
      case 'until':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: `Empty ${node.kind} body` });
        }
        if (isAskCondition(node.condition) && !node.groundedBy) {
          warnings.push({
            nodeId: node.id,
            message: `ask condition without grounded-by — AI evaluation has no evidence. Consider: ${node.kind} ask "..." grounded-by "cmd"`,
          });
        }
        // H-DX-010: warn if condition references state-changing predicate but body has no run node
        if (
          !isAskCondition(node.condition) &&
          referencesStateChangingPredicate(node.condition) &&
          !containsRunNode(node.body)
        ) {
          warnings.push({
            nodeId: node.id,
            message: `"${node.condition}" loop body has no run: node — condition may never change`,
          });
        }
        lintNodes(node.body, true, warnings);
        break;
      case 'retry':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty retry body' });
        }
        if (!node.body.some((n) => n.kind === 'run')) {
          warnings.push({
            nodeId: node.id,
            message: 'Retry without run node — retry re-loops on command_failed',
          });
        }
        lintNodes(node.body, true, warnings);
        break;
      case 'foreach':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty foreach body' });
        }
        lintNodes(node.body, true, warnings);
        break;
      case 'if':
        if (node.thenBranch.length === 0 && node.elseBranch.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty if — both branches are empty' });
        }
        lintNodes(node.thenBranch, insideLoop, warnings);
        lintNodes(node.elseBranch, insideLoop, warnings);
        break;
      case 'try':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty try body' });
        }
        lintNodes(node.body, insideLoop, warnings);
        lintNodes(node.catchBody, insideLoop, warnings);
        lintNodes(node.finallyBody, insideLoop, warnings);
        break;
      case 'break':
        if (!insideLoop) {
          warnings.push({ nodeId: node.id, message: 'Break outside of loop' });
        }
        break;
      case 'continue':
        if (!insideLoop) {
          warnings.push({ nodeId: node.id, message: 'Continue outside of loop' });
        }
        break;
      case 'spawn':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty spawn body' });
        }
        lintNodes(node.body, false, warnings);
        break;
      case 'await':
      case 'prompt':
      case 'run':
      case 'let':
        break;
    }
  }
}

/** Gate predicates whose side effects depend on command execution. */
const GATE_SIDE_EFFECT_PREDICATES = new Set([
  'tests_pass',
  'tests_fail',
  'lint_pass',
  'lint_fail',
  'command_succeeded',
  'command_failed',
  'pytest_pass',
  'pytest_fail',
  'go_test_pass',
  'go_test_fail',
  'cargo_test_pass',
  'cargo_test_fail',
]);

/**
 * H-SEC-007: Check if all run nodes at the top level are inside conditional blocks.
 * Returns true if there are run nodes and every one is inside an if/else branch
 * (meaning the agent could skip execution entirely by choosing the other branch).
 */
function allRunsInsideConditional(nodes: readonly FlowNode[]): boolean {
  let hasRun = false;
  let hasUnconditionalRun = false;

  function walk(list: readonly FlowNode[], insideConditional: boolean): void {
    for (const node of list) {
      switch (node.kind) {
        case 'run':
          hasRun = true;
          if (!insideConditional) hasUnconditionalRun = true;
          break;
        case 'let':
          if (node.source.type === 'run') {
            hasRun = true;
            if (!insideConditional) hasUnconditionalRun = true;
          }
          break;
        case 'if':
          walk(node.thenBranch, true);
          walk(node.elseBranch, true);
          break;
        case 'while':
        case 'until':
          walk(node.body, insideConditional);
          break;
        case 'retry':
          walk(node.body, insideConditional);
          break;
        case 'foreach':
          walk(node.body, insideConditional);
          break;
        case 'try':
          walk(node.body, insideConditional);
          walk(node.catchBody, insideConditional);
          walk(node.finallyBody, insideConditional);
          break;
        case 'spawn':
          walk(node.body, insideConditional);
          break;
        default:
          break;
      }
    }
  }

  walk(nodes, false);
  return hasRun && !hasUnconditionalRun;
}

export function lintFlow(spec: FlowSpec): readonly LintWarning[] {
  const warnings: LintWarning[] = [];

  if (!spec.goal) {
    warnings.push({ nodeId: '', message: 'Missing Goal' });
  }

  if (spec.nodes.length === 0) {
    warnings.push({ nodeId: '', message: 'Empty flow — no nodes defined' });
  }

  lintNodes(spec.nodes, false, warnings);

  // H-DX-001: Check for unresolved variable references
  const definedVars = collectDefinedVariables(spec.nodes);
  lintUnresolvedVars(spec.nodes, definedVars, warnings);

  // H-SEC-007: Gaslighting detection — warn when all run nodes are conditional
  // but gates depend on their side effects
  if (spec.completionGates.length > 0 && allRunsInsideConditional(spec.nodes)) {
    const sideEffectGates = spec.completionGates.filter((g) =>
      GATE_SIDE_EFFECT_PREDICATES.has(g.predicate),
    );
    if (sideEffectGates.length > 0) {
      const predicates = sideEffectGates.map((g) => g.predicate).join(', ');
      warnings.push({
        nodeId: '',
        message: `All run nodes are inside conditional blocks but gates reference "${predicates}" — agent could skip execution entirely`,
      });
    }
  }

  return warnings;
}
