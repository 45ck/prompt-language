import { describe, expect, it } from 'vitest';

import {
  inspectWorkflowAliases,
  listWorkflowAliases,
  renderWorkflowAlias,
} from './render-workflow.js';

describe('renderWorkflowAlias', () => {
  it('lists the shipped workflow aliases', () => {
    expect(listWorkflowAliases()).toEqual(['clarify']);
  });

  it('returns inspectable metadata for the shipped aliases', () => {
    expect(inspectWorkflowAliases()).toEqual([
      {
        alias: 'clarify',
        summary: 'Clarify scope before implementation',
        description: 'Inspectable, side-effect-free prompt flow for scoping and plan drafting.',
        previewSafe: true,
      },
    ]);
  });

  it('renders the clarify alias as ordinary flow text with preview output', () => {
    const rendered = renderWorkflowAlias('clarify');

    expect(rendered.alias).toBe('clarify');
    expect(rendered.summary).toBe('Clarify scope before implementation');
    expect(rendered.flowText).toContain(
      'Goal: clarify the request, record boundaries, and produce an inspectable plan draft',
    );
    expect(rendered.preview.output).toContain(
      '[prompt-language validate] Flow parsed successfully.',
    );
  });

  it('renders flow text that stays parse-safe and preview-safe', () => {
    const rendered = renderWorkflowAlias('  CLARIFY  ');

    expect(rendered.preview.report.status).toBe('ok');
    expect(rendered.preview.lintWarningCount).toBe(0);
    expect(rendered.preview.renderedFlow).toContain('clarify the request');
    expect(rendered.flowText).not.toContain('run:');
    expect(rendered.flowText).not.toContain('.prompt-language/runs/demo');
  });

  it('rejects a missing alias with a helpful message', () => {
    expect(() => renderWorkflowAlias('   ')).toThrow(
      'Workflow alias is required. Available aliases: clarify.',
    );
  });

  it('rejects unknown aliases with a normalized helpful message', () => {
    expect(() => renderWorkflowAlias(' Parallelize ')).toThrow(
      'Unknown workflow alias " Parallelize " (normalized: "parallelize"). Available aliases: clarify.',
    );
  });
});
