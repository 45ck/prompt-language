import { existsSync, readFileSync } from 'node:fs';
import type { FlowNode } from '../domain/flow-node.js';
import type { CompletionGate, FlowSpec } from '../domain/flow-spec.js';
import {
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  createProfileWarningDiagnostic,
  PROFILE_DIAGNOSTIC_CODES,
  type DiagnosticReport,
  type FlowDiagnostic,
} from '../domain/diagnostic-report.js';
import { explainGatePrerequisite, type WorkspaceAccess } from './gate-prerequisites.js';

export type RunnerName = 'claude' | 'codex' | 'opencode' | 'ollama';
export type ExecutionMode = 'interactive' | 'headless';

export interface ExecutionPreflightInput {
  readonly cwd: string;
  readonly runner: RunnerName;
  readonly mode?: ExecutionMode | undefined;
}

export interface ExecutionPreflightDeps {
  readonly probeRunnerBinary?: ((runner: RunnerName) => boolean) | undefined;
  readonly workspaceAccess?: WorkspaceAccess | undefined;
}

const defaultWorkspaceAccess: WorkspaceAccess = {
  exists: existsSync,
  readText: (path) => readFileSync(path, 'utf8'),
};

interface ProfileRequirements {
  readonly requiresApprove: boolean;
  readonly requiresMessagePassing: boolean;
}

interface ProfileCapabilities {
  readonly supportsApprove: boolean;
  readonly supportsMessagePassing: boolean;
}

function flattenCompletionGates(gates: readonly CompletionGate[]): CompletionGate[] {
  const flattened: CompletionGate[] = [];

  for (const gate of gates) {
    flattened.push(gate);
    if (gate.any) {
      flattened.push(...flattenCompletionGates(gate.any));
    }
    if (gate.all) {
      flattened.push(...flattenCompletionGates(gate.all));
    }
    if (gate.nOf) {
      flattened.push(...flattenCompletionGates(gate.nOf.gates));
    }
  }

  return flattened;
}

function dedupeDiagnostics(diagnostics: readonly FlowDiagnostic[]): FlowDiagnostic[] {
  const seen = new Set<string>();
  const deduped: FlowDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(diagnostic);
  }

  return deduped;
}

function emptyRequirements(): ProfileRequirements {
  return {
    requiresApprove: false,
    requiresMessagePassing: false,
  };
}

function mergeRequirements(
  left: ProfileRequirements,
  right: ProfileRequirements,
): ProfileRequirements {
  return {
    requiresApprove: left.requiresApprove || right.requiresApprove,
    requiresMessagePassing: left.requiresMessagePassing || right.requiresMessagePassing,
  };
}

function collectProfileRequirements(nodes: readonly FlowNode[]): ProfileRequirements {
  let requirements = emptyRequirements();

  for (const node of nodes) {
    switch (node.kind) {
      case 'approve':
        requirements = mergeRequirements(requirements, {
          requiresApprove: true,
          requiresMessagePassing: false,
        });
        break;
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'spawn':
      case 'foreach_spawn':
      case 'review':
        requirements = mergeRequirements(requirements, collectProfileRequirements(node.body));
        break;
      case 'if':
        requirements = mergeRequirements(
          requirements,
          mergeRequirements(
            collectProfileRequirements(node.thenBranch),
            collectProfileRequirements(node.elseBranch),
          ),
        );
        break;
      case 'try':
        requirements = mergeRequirements(
          requirements,
          mergeRequirements(
            collectProfileRequirements(node.body),
            mergeRequirements(
              collectProfileRequirements(node.catchBody),
              collectProfileRequirements(node.finallyBody),
            ),
          ),
        );
        break;
      case 'race':
        requirements = mergeRequirements(
          requirements,
          collectProfileRequirements(node.children.flatMap((child) => child.body)),
        );
        break;
      case 'send':
      case 'receive':
        requirements = mergeRequirements(requirements, {
          requiresApprove: false,
          requiresMessagePassing: true,
        });
        break;
      case 'swarm': {
        requirements = mergeRequirements(requirements, {
          requiresApprove: false,
          requiresMessagePassing: true,
        });
        requirements = mergeRequirements(requirements, collectProfileRequirements(node.flow));
        for (const role of node.roles) {
          requirements = mergeRequirements(requirements, collectProfileRequirements(role.body));
        }
        break;
      }
      case 'prompt':
      case 'run':
      case 'let':
      case 'break':
      case 'continue':
      case 'await':
      case 'remember':
      case 'start':
      case 'return':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }

  return requirements;
}

function resolveProfileCapabilities(
  runner: RunnerName,
  mode: ExecutionMode,
): ProfileCapabilities | null {
  if (mode === 'interactive') {
    if (runner !== 'claude') {
      return null;
    }
    return {
      supportsApprove: true,
      supportsMessagePassing: false,
    };
  }

  if (runner === 'claude') {
    return {
      supportsApprove: false,
      supportsMessagePassing: false,
    };
  }

  return {
    supportsApprove: false,
    supportsMessagePassing: true,
  };
}

function evaluateProfileCompatibility(
  spec: FlowSpec,
  input: ExecutionPreflightInput,
): FlowDiagnostic[] {
  if (input.mode == null) {
    return [];
  }

  const capabilities = resolveProfileCapabilities(input.runner, input.mode);
  if (capabilities == null) {
    return [
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.unsupportedHostOrMode,
        `Execution profile runner=${input.runner} mode=${input.mode} is unsupported.`,
        'Use runner=claude mode=interactive, or choose a headless profile for codex, opencode, or ollama.',
      ),
    ];
  }

  const requirements = collectProfileRequirements(spec.nodes);
  const diagnostics: FlowDiagnostic[] = [];

  if (input.mode === 'headless') {
    diagnostics.push(
      createProfileWarningDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.unavailableUxSurface,
        `Interactive UX surfaces such as the status line and watch mode are unavailable for runner=${input.runner} mode=headless.`,
      ),
    );
  }

  if (requirements.requiresApprove && !capabilities.supportsApprove) {
    diagnostics.push(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.unsupportedApprove,
        `approve is unsupported for runner=${input.runner} mode=${input.mode}.`,
        'Use an interactive profile, or replace approve with a policy/pre-approval step.',
      ),
    );
  }

  if (requirements.requiresMessagePassing && !capabilities.supportsMessagePassing) {
    diagnostics.push(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.unsupportedParallelSemantics,
        `send/receive semantics are unavailable for runner=${input.runner} mode=${input.mode}.`,
        'Use a profile with message-passing support, or remove send/receive from this flow.',
      ),
    );
  }

  return diagnostics;
}

export function runExecutionPreflight(
  spec: FlowSpec,
  input: ExecutionPreflightInput,
  deps: ExecutionPreflightDeps = {},
): DiagnosticReport {
  const diagnostics: FlowDiagnostic[] = [];
  const probeRunnerBinary = deps.probeRunnerBinary ?? (() => true);
  const workspaceAccess = deps.workspaceAccess ?? defaultWorkspaceAccess;

  if (!probeRunnerBinary(input.runner)) {
    diagnostics.push(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingRunnerBinary,
        `Runner "${input.runner}" is unavailable because the binary was not found on PATH.`,
        `Install ${input.runner}, or choose a different runner before executing this flow.`,
      ),
    );
  }

  for (const gate of flattenCompletionGates(spec.completionGates)) {
    const issue = explainGatePrerequisite(gate.predicate, input.cwd, workspaceAccess);
    if (!issue) continue;
    diagnostics.push(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingGatePrerequisite,
        issue.summary,
        issue.action,
      ),
    );
  }

  diagnostics.push(...evaluateProfileCompatibility(spec, input));

  return createDiagnosticReport(dedupeDiagnostics(diagnostics));
}
