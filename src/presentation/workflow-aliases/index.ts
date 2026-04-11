import { CLARIFY_WORKFLOW_ALIAS } from './clarify-template.js';

export type WorkflowAlias = keyof typeof WORKFLOW_ALIAS_RECORD;

export interface WorkflowAliasDefinition {
  readonly alias: WorkflowAlias;
  readonly summary: string;
  readonly description: string;
  readonly flowText: string;
  readonly previewSafe: boolean;
}

const WORKFLOW_ALIAS_RECORD = {
  clarify: CLARIFY_WORKFLOW_ALIAS,
} as const;

export function listWorkflowAliasDefinitions(): readonly WorkflowAliasDefinition[] {
  return Object.values(WORKFLOW_ALIAS_RECORD);
}

export function getWorkflowAliasDefinition(alias: WorkflowAlias): WorkflowAliasDefinition {
  return WORKFLOW_ALIAS_RECORD[alias];
}

export function isWorkflowAlias(alias: string): alias is WorkflowAlias {
  return Object.hasOwn(WORKFLOW_ALIAS_RECORD, alias);
}
