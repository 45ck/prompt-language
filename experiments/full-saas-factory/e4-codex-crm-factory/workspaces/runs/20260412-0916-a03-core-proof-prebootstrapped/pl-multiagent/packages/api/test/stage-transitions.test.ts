import { describe, expect, it } from 'vitest';

import { createInMemoryCrmCoreApi } from '../src/index.js';
import { expectCrmError } from './assert-crm-error.js';

describe('in-memory CRM opportunity stage movement', () => {
  it('updates stored opportunities when the next stage is allowed', () => {
    const api = createInMemoryCrmCoreApi();
    const opportunity = api.createOpportunity({
      title: 'Renewal',
      amountCents: 80000
    });

    const qualifiedOpportunity = api.moveOpportunityStage({
      opportunityId: opportunity.opportunityId,
      nextStage: 'Qualified'
    });

    expect(qualifiedOpportunity).toEqual({
      ...opportunity,
      stage: 'Qualified'
    });
    expect(api.getOpportunity(opportunity.opportunityId)).toEqual(qualifiedOpportunity);
  });

  it('reports not found and invalid transition failures with application error codes', () => {
    const api = createInMemoryCrmCoreApi();

    expectCrmError(
      () =>
        api.moveOpportunityStage({
          opportunityId: 'opportunity-missing',
          nextStage: 'Qualified'
        }),
      'NOT_FOUND'
    );

    const opportunity = api.createOpportunity({
      title: 'Upsell',
      amountCents: 45000
    });

    expectCrmError(
      () =>
        api.moveOpportunityStage({
          opportunityId: opportunity.opportunityId,
          nextStage: 'Negotiation'
        }),
      'INVALID_STAGE_TRANSITION'
    );
  });
});
