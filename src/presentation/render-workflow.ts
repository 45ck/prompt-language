import { buildValidateFlowPreview, type ValidateFlowPreview } from './validate-flow.js';
import {
  getWorkflowAliasDefinition,
  isWorkflowAlias,
  listWorkflowAliasDefinitions,
  type WorkflowAlias,
} from './workflow-aliases/index.js';

export interface WorkflowAliasSummary {
  readonly alias: WorkflowAlias;
  readonly summary: string;
  readonly description: string;
  readonly previewSafe: boolean;
}

export interface RenderedWorkflowAlias extends WorkflowAliasSummary {
  readonly flowText: string;
  readonly preview: ValidateFlowPreview;
}

export function listWorkflowAliases(): readonly WorkflowAlias[] {
  return listWorkflowAliasDefinitions().map(({ alias }) => alias);
}

export function inspectWorkflowAliases(): readonly WorkflowAliasSummary[] {
  return listWorkflowAliasDefinitions().map(
    ({ alias, summary, description, previewSafe }): WorkflowAliasSummary => ({
      alias,
      summary,
      description,
      previewSafe,
    }),
  );
}

export function renderWorkflowAlias(alias: string): RenderedWorkflowAlias {
  const normalized = normalizeWorkflowAlias(alias);

  if (!normalized) {
    throw new Error(`Workflow alias is required. Available aliases: ${formatAvailableAliases()}.`);
  }

  if (!isWorkflowAlias(normalized)) {
    const normalizedDetail = normalized === alias ? '' : ` (normalized: "${normalized}")`;

    throw new Error(
      `Unknown workflow alias "${alias}"${normalizedDetail}. Available aliases: ${formatAvailableAliases()}.`,
    );
  }

  const definition = getWorkflowAliasDefinition(normalized);

  try {
    return {
      ...definition,
      preview: buildValidateFlowPreview(definition.flowText),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown preview error';

    throw new Error(`Workflow alias "${normalized}" could not be previewed: ${message}`);
  }
}

function normalizeWorkflowAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function formatAvailableAliases(): string {
  return listWorkflowAliases().join(', ');
}
