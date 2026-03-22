/**
 * Advance-flow — node advancement and flow completion logic.
 *
 * Extracted from inject-context.ts to isolate advancement concerns.
 */

import {
  advanceNode,
  updateVariable,
  updateNodeProgress,
  markCompleted,
  allGatesPassing,
} from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { FlowNode } from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import { interpolate, shellInterpolate } from '../domain/interpolate.js';
import { evaluateCondition } from '../domain/evaluate-condition.js';
import { resolveBuiltinCommand, isInvertedPredicate } from './evaluate-completion.js';
import { splitIterable } from '../domain/split-iterable.js';
import {
  buildCapturePrompt,
  buildCaptureRetryPrompt,
  DEFAULT_MAX_CAPTURE_RETRIES,
} from '../domain/capture-prompt.js';

export function resolveCurrentNode(
  nodes: readonly FlowNode[],
  path: readonly number[],
): FlowNode | null {
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
      return resolveCurrentNode(node.body, rest);
    case 'if':
      return resolveCurrentNode([...node.thenBranch, ...node.elseBranch], rest);
    case 'try':
      return resolveCurrentNode([...node.body, ...node.catchBody], rest);
    default:
      return null;
  }
}

export function advancePath(path: readonly number[]): readonly number[] {
  if (path.length === 0) return [0];
  const last = path[path.length - 1]!;
  return [...path.slice(0, -1), last + 1];
}

const MAX_OUTPUT_LENGTH = 2000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.slice(0, MAX_OUTPUT_LENGTH) + '\n... (truncated)';
}

/**
 * Evaluate a flow condition using variable lookup, falling back to command execution.
 * Returns null if the condition cannot be resolved.
 */
async function evaluateFlowCondition(
  condition: string,
  variables: Readonly<Record<string, string | number | boolean>>,
  commandRunner?: CommandRunner,
): Promise<boolean | null> {
  const pureResult = evaluateCondition(condition, variables);
  if (pureResult !== null) return pureResult;

  if (!commandRunner) return null;

  const command = resolveBuiltinCommand(condition);
  if (!command) return null;

  const result = await commandRunner.run(command);
  const inverted = isInvertedPredicate(condition);
  return inverted ? result.exitCode !== 0 : result.exitCode === 0;
}

/**
 * When a run node fails inside a try body, find the catch jump target.
 * Returns the path to the first catch child, or null if no try ancestor.
 */
function findTryCatchJump(
  nodes: readonly FlowNode[],
  path: readonly number[],
): readonly number[] | null {
  for (let depth = path.length - 1; depth >= 1; depth--) {
    const ancestorPath = path.slice(0, depth);
    const ancestor = resolveCurrentNode(nodes, ancestorPath);
    if (ancestor?.kind !== 'try') continue;

    const childIdx = path[depth]!;
    if (childIdx < ancestor.body.length && ancestor.catchBody.length > 0) {
      return [...ancestorPath, ancestor.body.length];
    }
  }
  return null;
}

/**
 * Handle body exhaustion: when resolveCurrentNode returns null and we're
 * inside a parent scope (path.length >= 2), decide whether to loop or exit.
 */
async function handleBodyExhaustion(
  state: SessionState,
  commandRunner?: CommandRunner,
): Promise<SessionState | null> {
  const path = state.currentNodePath;
  if (path.length <= 1) return null;

  const parentPath = path.slice(0, -1);
  const parentNode = resolveCurrentNode(state.flowSpec.nodes, parentPath);
  if (!parentNode) return null;

  let current = state;

  switch (parentNode.kind) {
    case 'while': {
      const condResult = await evaluateFlowCondition(
        parentNode.condition,
        current.variables,
        commandRunner,
      );
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (condResult === true && iteration < parentNode.maxIterations) {
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: parentNode.maxIterations,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: parentNode.maxIterations,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'until': {
      const condResult = await evaluateFlowCondition(
        parentNode.condition,
        current.variables,
        commandRunner,
      );
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (condResult === false && iteration < parentNode.maxIterations) {
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: parentNode.maxIterations,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: parentNode.maxIterations,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'retry': {
      const commandFailed = current.variables['command_failed'];
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (commandFailed === true && iteration < parentNode.maxAttempts) {
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: parentNode.maxAttempts,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: parentNode.maxAttempts,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'foreach': {
      const rawList = interpolate(parentNode.listExpression, current.variables);
      const items = splitIterable(rawList).slice(0, parentNode.maxIterations);
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (iteration < items.length) {
        const nextItem = items[iteration]!;
        current = updateVariable(current, parentNode.variableName, nextItem);
        current = updateVariable(current, `${parentNode.variableName}_index`, iteration);
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: items.length,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: items.length,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'if':
    case 'try': {
      current = advanceNode(current, advancePath(parentPath));
      return current;
    }

    default:
      return null;
  }
}

export interface AutoAdvanceResult {
  readonly state: SessionState;
  readonly capturedPrompt: string | null;
}

export async function autoAdvanceNodes(
  state: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult> {
  const MAX_ADVANCES = 100;
  let advances = 0;
  let current = state;

  while (advances < MAX_ADVANCES) {
    const node = resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath);

    if (!node) {
      const exhaustionResult = await handleBodyExhaustion(current, commandRunner);
      if (!exhaustionResult) break;
      current = exhaustionResult;
      advances += 1;
      continue;
    }

    switch (node.kind) {
      case 'let': {
        let value: string;
        let tryCatchJump: readonly number[] | null = null;
        switch (node.source.type) {
          case 'literal':
            value = node.source.value;
            break;
          case 'prompt': {
            const progress = current.nodeProgress[node.id];
            const isAwaiting = progress?.status === 'awaiting_capture';

            if (!isAwaiting) {
              // Phase 1: First encounter — emit capture prompt
              if (captureReader) {
                await captureReader.clear(node.variableName);
              }
              current = updateNodeProgress(current, node.id, {
                iteration: 1,
                maxIterations: DEFAULT_MAX_CAPTURE_RETRIES,
                status: 'awaiting_capture',
              });
              const promptText = interpolate(node.source.text, current.variables);
              const metaPrompt = buildCapturePrompt(promptText, node.variableName);
              return { state: current, capturedPrompt: metaPrompt };
            }

            // Phase 2: Return visit — try to read captured file
            if (captureReader) {
              const captured = await captureReader.read(node.variableName);
              if (captured) {
                value = captured;
                await captureReader.clear(node.variableName);
                break;
              }
            }

            // File missing/empty — retry or fail-open
            const iteration = progress.iteration;
            if (iteration < progress.maxIterations) {
              current = updateNodeProgress(current, node.id, {
                iteration: iteration + 1,
                maxIterations: progress.maxIterations,
                status: 'awaiting_capture',
              });
              const retryPrompt = buildCaptureRetryPrompt(node.variableName);
              return { state: current, capturedPrompt: retryPrompt };
            }

            // Max retries exceeded — fail-open with empty string
            value = '';
            current = {
              ...current,
              warnings: [
                ...current.warnings,
                `Variable capture for '${node.variableName}' failed after ${progress.maxIterations} attempts; using empty string.`,
              ],
            };
            break;
          }
          case 'run': {
            if (!commandRunner) return { state: current, capturedPrompt: null };
            const letCmd = shellInterpolate(node.source.command, current.variables);
            const result = await commandRunner.run(letCmd);
            value = result.stdout.trimEnd();
            current = updateVariable(current, 'last_exit_code', result.exitCode);
            current = updateVariable(current, 'command_failed', result.exitCode !== 0);
            current = updateVariable(current, 'command_succeeded', result.exitCode === 0);
            current = updateVariable(
              current,
              'last_stdout',
              truncateOutput(result.stdout.trimEnd()),
            );
            current = updateVariable(
              current,
              'last_stderr',
              truncateOutput(result.stderr.trimEnd()),
            );
            if (result.exitCode !== 0) {
              tryCatchJump = findTryCatchJump(current.flowSpec.nodes, current.currentNodePath);
            }
            break;
          }
        }
        current = updateVariable(current, node.variableName, value);
        if (tryCatchJump) {
          current = advanceNode(current, tryCatchJump);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'run': {
        if (!commandRunner) return { state: current, capturedPrompt: null };
        const command = shellInterpolate(node.command, current.variables);
        const result = await commandRunner.run(command);
        current = updateVariable(current, 'last_exit_code', result.exitCode);
        current = updateVariable(current, 'command_failed', result.exitCode !== 0);
        current = updateVariable(current, 'command_succeeded', result.exitCode === 0);
        current = updateVariable(current, 'last_stdout', truncateOutput(result.stdout.trimEnd()));
        current = updateVariable(current, 'last_stderr', truncateOutput(result.stderr.trimEnd()));

        if (result.exitCode !== 0) {
          const jumpTarget = findTryCatchJump(current.flowSpec.nodes, current.currentNodePath);
          if (jumpTarget) {
            current = advanceNode(current, jumpTarget);
            advances += 1;
            break;
          }
        }

        current = advanceNode(current, advancePath(current.currentNodePath));
        advances += 1;
        break;
      }
      case 'prompt': {
        const capturedPrompt = interpolate(node.text, current.variables);
        current = advanceNode(current, advancePath(current.currentNodePath));
        return { state: current, capturedPrompt };
      }
      case 'while': {
        const condResult = await evaluateFlowCondition(
          node.condition,
          current.variables,
          commandRunner,
        );
        if (condResult === null) return { state: current, capturedPrompt: null };
        if (condResult) {
          current = updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxIterations,
            status: 'running',
          });
          current = advanceNode(current, [...current.currentNodePath, 0]);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'until': {
        const condResult = await evaluateFlowCondition(
          node.condition,
          current.variables,
          commandRunner,
        );
        if (condResult === null) return { state: current, capturedPrompt: null };
        if (!condResult) {
          current = updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxIterations,
            status: 'running',
          });
          current = advanceNode(current, [...current.currentNodePath, 0]);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'retry': {
        current = updateNodeProgress(current, node.id, {
          iteration: 1,
          maxIterations: node.maxAttempts,
          status: 'running',
        });
        current = advanceNode(current, [...current.currentNodePath, 0]);
        advances += 1;
        break;
      }
      case 'if': {
        const condResult = await evaluateFlowCondition(
          node.condition,
          current.variables,
          commandRunner,
        );
        if (condResult === null) return { state: current, capturedPrompt: null };
        if (condResult) {
          current = advanceNode(current, [...current.currentNodePath, 0]);
        } else if (node.elseBranch.length > 0) {
          current = advanceNode(current, [...current.currentNodePath, node.thenBranch.length]);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'try': {
        current = advanceNode(current, [...current.currentNodePath, 0]);
        advances += 1;
        break;
      }
      case 'foreach': {
        const rawList = interpolate(node.listExpression, current.variables);
        const items = splitIterable(rawList);

        if (items.length === 0) {
          current = advanceNode(current, advancePath(current.currentNodePath));
          advances += 1;
          break;
        }

        const cappedItems = items.slice(0, node.maxIterations);
        const firstItem = cappedItems[0]!;

        current = updateVariable(current, node.variableName, firstItem);
        current = updateVariable(current, `${node.variableName}_index`, 0);
        current = updateVariable(current, `${node.variableName}_length`, cappedItems.length);
        current = updateNodeProgress(current, node.id, {
          iteration: 1,
          maxIterations: cappedItems.length,
          status: 'running',
        });
        current = advanceNode(current, [...current.currentNodePath, 0]);
        advances += 1;
        break;
      }
    }
  }

  if (advances >= MAX_ADVANCES) {
    current = {
      ...current,
      warnings: [
        ...current.warnings,
        'MAX_ADVANCES (100) reached; auto-advance stopped to prevent infinite loop.',
      ],
    };
  }

  return { state: current, capturedPrompt: null };
}

export function maybeCompleteFlow(state: SessionState): SessionState {
  if (state.status !== 'active') return state;
  // If still inside a control-flow scope, body exhaustion needs handling first
  if (state.currentNodePath.length > 1) return state;
  const node = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath);
  if (node !== null) return state;
  if (state.flowSpec.completionGates.length === 0 || allGatesPassing(state)) {
    return markCompleted(state);
  }
  return state;
}
