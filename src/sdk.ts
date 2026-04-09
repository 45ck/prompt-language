/**
 * Public SDK for @45ck/prompt-language.
 *
 * Stable programmatic surface for parsing, session management,
 * gate evaluation, and flow rendering. Import via:
 *
 *   import { parseFlow, createSession, advanceFlow, evaluateGates, renderFlow } from '@45ck/prompt-language';
 *   import { parseFlow, createSession, advanceFlow, evaluateGates, renderFlow } from '@45ck/prompt-language/sdk';
 *
 * Note: evaluateCompletion requires infrastructure adapters (StateStore,
 * CommandRunner) that must be supplied by the caller. Use InMemoryStateStore
 * and InMemoryCommandRunner from the infrastructure layer for testing.
 */

// Parsing
export { parseFlow } from './application/parse-flow.js';

// Session management
export { createSessionState, createSessionState as createSession } from './domain/session-state.js';

// Gate evaluation
export {
  evaluateCompletion,
  evaluateCompletion as evaluateGates,
} from './application/evaluate-completion.js';

// Rendering
export { renderFlow, renderFlowCompact, renderFlowSummary } from './domain/render-flow.js';

// Linting
export { lintFlow } from './domain/lint-flow.js';

// Flow advancement
export { autoAdvanceNodes, autoAdvanceNodes as advanceFlow } from './application/advance-flow.js';

// Type exports
export type { FlowSpec, CompletionGate, FlowDefaults } from './domain/flow-spec.js';
export type {
  FlowNode,
  FlowNodeKind,
  PromptNode,
  RunNode,
  WhileNode,
  UntilNode,
  RetryNode,
  IfNode,
  TryNode,
  LetNode,
  LetSource,
  ForeachNode,
  BreakNode,
  SpawnNode,
  AwaitNode,
} from './domain/flow-node.js';
export type {
  SessionState,
  NodeProgress,
  FlowStatus,
  SpawnedChild,
} from './domain/session-state.js';
export type { LintWarning } from './domain/lint-flow.js';
export type { EvaluateCompletionOutput } from './application/evaluate-completion.js';
export type { AutoAdvanceResult } from './application/advance-flow.js';
