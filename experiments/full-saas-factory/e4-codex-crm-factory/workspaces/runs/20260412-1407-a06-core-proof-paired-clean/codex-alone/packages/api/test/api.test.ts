import { describe, expect, it } from 'vitest';

import { ApiError, DomainError, createCrmApi } from '../src/index.js';

function createDeterministicDeps() {
  let counter = 0;
  let current = new Date('2026-01-01T00:00:00.000Z');

  return {
    now: () => new Date(current.getTime()),
    setNow: (value: Date) => {
      current = new Date(value.getTime());
    },
    generateId: () => `id${(counter += 1)}`,
  };
}

describe('api', () => {
  const expectApiError = (fn: () => unknown, code: ApiError['code']) => {
    try {
      fn();
      throw new Error('expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe(code);
    }
  };

  const expectDomainError = (fn: () => unknown, code: DomainError['code']) => {
    try {
      fn();
      throw new Error('expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(code);
    }
  };

  it('creates and relates core CRM entities', () => {
    const deps = createDeterministicDeps();
    const crm = createCrmApi({ now: deps.now, generateId: deps.generateId });

    const company = crm.createCompany({ name: 'Acme', domain: 'acme.test' });
    const contact = crm.createContact({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.test',
      companyId: company.id,
    });
    const opportunity = crm.createOpportunity({
      companyId: company.id,
      primaryContactId: contact.id,
      title: 'Big Deal',
      amountCents: 500_00,
      currency: 'USD',
    });

    deps.setNow(new Date('2026-01-02T00:00:00.000Z'));
    const qualified = crm.transitionOpportunityStage(opportunity.id, 'Qualified');
    expect(qualified.stage).toBe('Qualified');

    crm.createTask({
      title: 'Follow up',
      dueAt: new Date('2026-01-01T00:00:00.000Z'),
      related: { type: 'opportunity', id: opportunity.id },
    });
    crm.addNote({
      body: 'Customer asked for updated proposal.',
      related: { type: 'opportunity', id: opportunity.id },
    });

    const summary = crm.getDashboardSummary(new Date('2026-01-10T00:00:00.000Z'));
    expect(summary.counts.companies).toBe(1);
    expect(summary.counts.contacts).toBe(1);
    expect(summary.counts.opportunitiesOpen).toBe(1);
    expect(summary.counts.tasksOverdue).toBe(1);
    expect(summary.pipeline.openAmountCentsTotal).toBe(500_00);
    expect(summary.recentNotes).toHaveLength(1);
  });

  it('throws NOT_FOUND when referencing missing entities', () => {
    const deps = createDeterministicDeps();
    const crm = createCrmApi({ now: deps.now, generateId: deps.generateId });

    expectApiError(
      () =>
        crm.createContact({
          firstName: 'Ada',
          lastName: 'Lovelace',
          companyId: 'company_missing',
        }),
      'NOT_FOUND',
    );
  });

  it('throws CONFLICT when a primary contact belongs to another company', () => {
    const deps = createDeterministicDeps();
    const crm = createCrmApi({ now: deps.now, generateId: deps.generateId });

    const a = crm.createCompany({ name: 'A' });
    const b = crm.createCompany({ name: 'B' });
    const contact = crm.createContact({
      firstName: 'Ada',
      lastName: 'Lovelace',
      companyId: a.id,
    });

    expectApiError(
      () =>
        crm.createOpportunity({
          companyId: b.id,
          primaryContactId: contact.id,
          title: 'Deal',
          amountCents: 1_00,
          currency: 'USD',
        }),
      'CONFLICT',
    );
  });

  it('surfaces invalid stage transitions as domain errors', () => {
    const deps = createDeterministicDeps();
    const crm = createCrmApi({ now: deps.now, generateId: deps.generateId });

    const company = crm.createCompany({ name: 'Acme' });
    const opportunity = crm.createOpportunity({
      companyId: company.id,
      title: 'Deal',
      amountCents: 1_00,
      currency: 'USD',
    });

    expectDomainError(
      () => crm.transitionOpportunityStage(opportunity.id, 'Proposal'),
      'INVALID_STAGE_TRANSITION',
    );
  });
});
