/**
 * InjectContext — UserPromptSubmit hook use case.
 *
 * If the prompt starts a new flow, parse it and persist session state.
 * If a flow is already active, inject step context into the prompt.
 */

import { createSessionState } from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { FlowNode } from '../domain/flow-node.js';
import type { StateStore } from './ports/state-store.js';
import { parseFlow } from './parse-flow.js';

const FLOW_BLOCK_RE = /^flow:\s*$/m;

export interface InjectContextInput {
  readonly prompt: string;
  readonly sessionId: string;
}

export interface InjectContextOutput {
  readonly prompt: string;
}

function hasFlowBlock(prompt: string): boolean {
  return FLOW_BLOCK_RE.test(prompt);
}

function extractFlowDsl(prompt: string): string {
  const idx = prompt.indexOf('flow:');
  return idx >= 0 ? prompt.slice(idx) : prompt;
}

function getChildren(node: FlowNode): readonly FlowNode[] {
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'try':
      return node.body;
    case 'if':
      return node.thenBranch;
    case 'prompt':
    case 'run':
      return [];
  }
}

function resolveCurrentNode(state: SessionState): FlowNode | undefined {
  let candidates: readonly FlowNode[] = state.flowSpec.nodes;
  let current: FlowNode | undefined;
  for (const idx of state.currentNodePath) {
    current = candidates[idx];
    if (!current) return undefined;
    candidates = getChildren(current);
  }
  return current;
}

function buildContextBlock(state: SessionState): string {
  const node = resolveCurrentNode(state);
  const lines: string[] = [
    `[prompt-language] Active flow: ${state.flowSpec.goal}`,
    `Status: ${state.status}`,
  ];

  if (node) {
    lines.push(`Current step: ${node.kind} (${node.id})`);
  }

  lines.push(`Path: [${state.currentNodePath.join(', ')}]`);

  const varEntries = Object.entries(state.variables);
  if (varEntries.length > 0) {
    lines.push('Variables:');
    for (const [k, v] of varEntries) {
      lines.push(`  ${k} = ${String(v)}`);
    }
  }

  if (state.lastStep) {
    lines.push(`Last step: ${state.lastStep.kind} — ${state.lastStep.summary}`);
  }

  return lines.join('\n');
}

export async function injectContext(
  input: InjectContextInput,
  stateStore: StateStore,
): Promise<InjectContextOutput> {
  const existing = await stateStore.loadCurrent();

  if (existing?.status === 'active') {
    const ctx = buildContextBlock(existing);
    return { prompt: `${ctx}\n\n${input.prompt}` };
  }

  if (hasFlowBlock(input.prompt)) {
    const dsl = extractFlowDsl(input.prompt);
    const spec = parseFlow(dsl);
    const session = createSessionState(input.sessionId, spec);
    await stateStore.save(session);
    const ctx = buildContextBlock(session);
    return { prompt: `${ctx}\n\n${input.prompt}` };
  }

  return { prompt: input.prompt };
}
