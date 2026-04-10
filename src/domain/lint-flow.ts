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

export interface ImportRegistry {
  hasNamespace(ns: string): boolean;
  hasSymbol(ns: string, symbol: string): boolean;
}

/** Built-in auto-variables that are always available at runtime. */
const BUILTIN_AUTO_VARIABLES = new Set([
  'last_exit_code',
  'command_failed',
  'command_succeeded',
  'last_stdout',
  'last_stderr',
  'approve_rejected',
  '_review_critique',
  'race_winner',
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
function collectDefinedVariables(
  nodes: readonly FlowNode[],
  initialNames: readonly string[] = [],
): Set<string> {
  const defined = new Set<string>(initialNames);
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
      case 'review':
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        break;
      case 'race':
        node.children.forEach((child) =>
          collectDefinedVariables(child.body).forEach((v) => defined.add(v)),
        );
        break;
      case 'foreach_spawn':
        defined.add(node.variableName);
        collectDefinedVariables(node.body).forEach((v) => defined.add(v));
        break;
      case 'receive':
        defined.add(node.variableName);
        break;
      case 'prompt':
      case 'run':
      case 'break':
      case 'continue':
      case 'await':
      case 'approve':
      case 'remember':
      case 'send':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
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
      case 'review':
        lintUnresolvedVars(node.body, definedVars, warnings);
        break;
      case 'race':
        node.children.forEach((child) => lintUnresolvedVars(child.body, definedVars, warnings));
        break;
      case 'foreach_spawn': {
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
}

/** Warn when declarations in nested scopes shadow outer-scope variables. */
function lintVariableShadowing(
  nodes: readonly FlowNode[],
  inheritedDefinitions: ReadonlyMap<string, string>,
  warnings: LintWarning[],
): void {
  const definitionsInScope = new Map<string, string>();

  const inheritedPlusScope = (): Map<string, string> => {
    const merged = new Map(inheritedDefinitions);
    for (const [name, nodeId] of definitionsInScope) {
      merged.set(name, nodeId);
    }
    return merged;
  };

  const warnIfShadowed = (
    name: string,
    nodeId: string,
    declarationKind: 'variable' | 'foreach',
    includeCurrentScope = false,
  ) => {
    const outerDefinitionNodeId =
      inheritedDefinitions.get(name) ??
      (includeCurrentScope ? definitionsInScope.get(name) : undefined);
    if (outerDefinitionNodeId != null) {
      const prefix = declarationKind === 'foreach' ? 'Foreach loop variable' : 'Variable';
      warnings.push({
        nodeId,
        message: `${prefix} "${name}" shadows variable from an outer scope (outer definition at node "${outerDefinitionNodeId}")`,
      });
    }
  };

  for (const node of nodes) {
    switch (node.kind) {
      case 'let':
        warnIfShadowed(node.variableName, node.id, 'variable');
        definitionsInScope.set(node.variableName, node.id);
        break;
      case 'receive':
        warnIfShadowed(node.variableName, node.id, 'variable');
        definitionsInScope.set(node.variableName, node.id);
        break;
      case 'foreach': {
        warnIfShadowed(node.variableName, node.id, 'foreach', true);
        const foreachScope = inheritedPlusScope();
        foreachScope.set(node.variableName, node.id);
        lintVariableShadowing(node.body, foreachScope, warnings);
        break;
      }
      case 'foreach_spawn': {
        warnIfShadowed(node.variableName, node.id, 'foreach', true);
        const foreachScope = inheritedPlusScope();
        foreachScope.set(node.variableName, node.id);
        lintVariableShadowing(node.body, foreachScope, warnings);
        break;
      }
      case 'while':
      case 'until':
      case 'retry':
      case 'spawn':
      case 'review':
        lintVariableShadowing(node.body, inheritedPlusScope(), warnings);
        break;
      case 'if': {
        const scope = inheritedPlusScope();
        lintVariableShadowing(node.thenBranch, scope, warnings);
        lintVariableShadowing(node.elseBranch, scope, warnings);
        break;
      }
      case 'try': {
        const scope = inheritedPlusScope();
        lintVariableShadowing(node.body, scope, warnings);
        lintVariableShadowing(node.catchBody, scope, warnings);
        lintVariableShadowing(node.finallyBody, scope, warnings);
        break;
      }
      case 'race': {
        const scope = inheritedPlusScope();
        for (const child of node.children) {
          lintVariableShadowing(child.body, scope, warnings);
        }
        break;
      }
      case 'await':
      case 'approve':
      case 'break':
      case 'continue':
      case 'prompt':
      case 'remember':
      case 'run':
      case 'send':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
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
      case 'review':
        if (containsRunNode(node.body)) return true;
        break;
      case 'let':
        if (node.source.type === 'run') return true;
        break;
      case 'race':
        if (node.children.some((child) => containsRunNode(child.body))) return true;
        break;
      case 'foreach_spawn':
        if (containsRunNode(node.body)) return true;
        break;
      case 'prompt':
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
      case 'approve':
        if (!node.message.trim()) {
          warnings.push({ nodeId: node.id, message: 'approve node has empty message' });
        }
        break;
      case 'review':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty review body' });
        }
        lintNodes(node.body, false, warnings);
        break;
      case 'race':
        if (node.children.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty race — no children to race' });
        }
        node.children.forEach((child) => lintNodes(child.body, false, warnings));
        break;
      case 'foreach_spawn':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty foreach_spawn body' });
        }
        lintNodes(node.body, false, warnings);
        break;
      case 'await':
      case 'prompt':
      case 'run':
      case 'let':
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
        case 'review':
          walk(node.body, insideConditional);
          break;
        case 'race':
          node.children.forEach((child) => walk(child.body, insideConditional));
          break;
        case 'foreach_spawn':
          walk(node.body, insideConditional);
          break;
        case 'prompt':
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
  }

  walk(nodes, false);
  return hasRun && !hasUnconditionalRun;
}

function lintReviewJudgeReferences(
  nodes: readonly FlowNode[],
  judgeNames: ReadonlySet<string>,
  warnings: LintWarning[],
): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'spawn':
      case 'review':
      case 'foreach_spawn':
        if (node.kind === 'review' && node.judgeName && !judgeNames.has(node.judgeName)) {
          warnings.push({
            nodeId: node.id,
            message: `review references unknown judge "${node.judgeName}"`,
          });
        }
        lintReviewJudgeReferences(node.body, judgeNames, warnings);
        break;
      case 'if':
        lintReviewJudgeReferences(node.thenBranch, judgeNames, warnings);
        lintReviewJudgeReferences(node.elseBranch, judgeNames, warnings);
        break;
      case 'try':
        lintReviewJudgeReferences(node.body, judgeNames, warnings);
        lintReviewJudgeReferences(node.catchBody, judgeNames, warnings);
        lintReviewJudgeReferences(node.finallyBody, judgeNames, warnings);
        break;
      case 'race':
        node.children.forEach((child) =>
          lintReviewJudgeReferences(child.body, judgeNames, warnings),
        );
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
}

function lintEvaluationDeclarations(spec: FlowSpec, warnings: LintWarning[]): void {
  const rubrics = spec.rubrics ?? [];
  const judges = spec.judges ?? [];
  const rubricNames = new Set<string>();
  const judgeNames = new Set<string>();

  for (const rubric of rubrics) {
    if (rubricNames.has(rubric.name)) {
      warnings.push({ nodeId: '', message: `Duplicate rubric declaration "${rubric.name}"` });
    } else {
      rubricNames.add(rubric.name);
    }

    if (rubric.lines.length === 0) {
      warnings.push({ nodeId: '', message: `Rubric "${rubric.name}" has empty body` });
    }
  }

  for (const judge of judges) {
    if (judgeNames.has(judge.name)) {
      warnings.push({ nodeId: '', message: `Duplicate judge declaration "${judge.name}"` });
    } else {
      judgeNames.add(judge.name);
    }

    if (judge.lines.length === 0) {
      warnings.push({ nodeId: '', message: `Judge "${judge.name}" has empty body` });
    }

    if (judge.rubric && !rubricNames.has(judge.rubric)) {
      warnings.push({
        nodeId: '',
        message: `Judge "${judge.name}" references unknown rubric "${judge.rubric}"`,
      });
    }
  }

  lintReviewJudgeReferences(spec.nodes, judgeNames, warnings);
}

export function lintFlow(spec: FlowSpec, _importRegistry?: ImportRegistry): readonly LintWarning[] {
  const warnings: LintWarning[] = [];

  if (!spec.goal) {
    warnings.push({ nodeId: '', message: 'Missing Goal' });
  }

  if (spec.nodes.length === 0) {
    warnings.push({ nodeId: '', message: 'Empty flow — no nodes defined' });
  }

  lintNodes(spec.nodes, false, warnings);

  // H-DX-001: Check for unresolved variable references
  const definedVars = collectDefinedVariables(spec.nodes, spec.memoryKeys ?? []);
  lintUnresolvedVars(spec.nodes, definedVars, warnings);
  lintEvaluationDeclarations(spec, warnings);
  lintVariableShadowing(spec.nodes, new Map(), warnings);

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
