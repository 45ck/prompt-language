import { describe, expect, it } from 'vitest';

import {
  canTransitionOpportunityStage,
  createOpportunity,
  moveOpportunityStage
} from '../src/index.js';
import { expectDomainError } from './assert-domain-error.js';

describe('opportunity stage transitions', () => {
  it('reports the allowed transition graph', () => {
    expect(canTransitionOpportunityStage('Prospecting', 'Qualified')).toBe(true);
    expect(canTransitionOpportunityStage('Qualified', 'ClosedWon')).toBe(false);
    expect(canTransitionOpportunityStage('ClosedLost', 'Prospecting')).toBe(false);
  });

  it('moves an opportunity to a valid next stage', () => {
    const opportunity = createOpportunity({
      opportunityId: 'opportunity-1',
      title: 'Renewal',
      stage: 'Proposal',
      amountCents: 90000
    });

    expect(moveOpportunityStage(opportunity, 'Negotiation')).toEqual({
      ...opportunity,
      stage: 'Negotiation'
    });
  });

  it('rejects invalid or terminal transitions', () => {
    const closedOpportunity = createOpportunity({
      opportunityId: 'opportunity-2',
      title: 'Expansion',
      stage: 'ClosedWon',
      amountCents: 40000
    });

    expectDomainError(
      () => moveOpportunityStage(closedOpportunity, 'Qualified'),
      'invalid_stage_transition'
    );
  });
});
