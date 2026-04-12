import { describe, expect, it } from 'vitest';

import { createOpportunity } from '../src/index.js';
import { expectDomainError } from './assert-domain-error.js';

describe('createOpportunity', () => {
  it('defaults the stage to Prospecting and preserves links', () => {
    const opportunity = createOpportunity({
      opportunityId: 'opportunity-1',
      title: 'CRM rollout',
      amountCents: 125000,
      companyId: 'company-1',
      primaryContactId: 'contact-1'
    });

    expect(opportunity).toEqual({
      opportunityId: 'opportunity-1',
      title: 'CRM rollout',
      stage: 'Prospecting',
      amountCents: 125000,
      companyId: 'company-1',
      primaryContactId: 'contact-1'
    });
  });

  it('rejects invalid numeric values', () => {
    expectDomainError(
      () =>
        createOpportunity({
          opportunityId: 'opportunity-2',
          title: 'Upsell',
          amountCents: -1
        }),
      'validation_error'
    );
  });
});
