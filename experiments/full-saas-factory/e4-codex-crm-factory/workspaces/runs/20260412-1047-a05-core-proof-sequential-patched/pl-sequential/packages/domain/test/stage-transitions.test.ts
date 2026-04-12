import { transitionOpportunityStage, type Opportunity } from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('opportunity stage transitions', () => {
  const baseOpportunity: Opportunity = {
    id: 'opp_1',
    companyId: 'comp_1',
    title: 'Deal',
    stage: 'prospecting'
  };

  it('allows moving forward in the pipeline', () => {
    const qualified = transitionOpportunityStage(baseOpportunity, 'qualified');
    expect(qualified.ok).toBe(true);
    if (!qualified.ok) throw new Error('expected ok');
    expect(qualified.value.stage).toBe('qualified');

    const proposal = transitionOpportunityStage(qualified.value, 'proposal');
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) throw new Error('expected ok');
    expect(proposal.value.stage).toBe('proposal');
  });

  it('allows moving from a non-terminal stage to won or lost', () => {
    const won = transitionOpportunityStage(baseOpportunity, 'won');
    expect(won.ok).toBe(true);
    if (!won.ok) throw new Error('expected ok');
    expect(won.value.stage).toBe('won');

    const lost = transitionOpportunityStage(baseOpportunity, 'lost');
    expect(lost.ok).toBe(true);
    if (!lost.ok) throw new Error('expected ok');
    expect(lost.value.stage).toBe('lost');
  });

  it('rejects moving backward', () => {
    const proposalOpp: Opportunity = { ...baseOpportunity, stage: 'proposal' };
    const result = transitionOpportunityStage(proposalOpp, 'qualified');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.type).toBe('invalid_transition');
  });

  it('rejects transitions once won or lost', () => {
    const wonOpp: Opportunity = { ...baseOpportunity, stage: 'won' };
    const result = transitionOpportunityStage(wonOpp, 'lost');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.type).toBe('invalid_transition');
  });
});
