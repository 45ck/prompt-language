import { describe, expect, it } from 'vitest';

import { CrmError, InMemoryCrmService } from '../src/index.js';

function expectCrmError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('Expected CrmError to be thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(CrmError);
    expect((error as CrmError).code).toBe(code);
  }
}

describe('InMemoryCrmService', () => {
  it('creates companies and rejects duplicate ids', () => {
    const crm = new InMemoryCrmService();
    crm.createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });

    expectCrmError(
      () => crm.createCompany({ id: 'c_1', name: 'Acme 2', now: '2026-04-12T00:00:00Z' }),
      'duplicate_id'
    );
  });

  it('creates contacts and enforces company references', () => {
    const crm = new InMemoryCrmService();
    expectCrmError(
      () =>
        crm.createContact({
          id: 'p_1',
          firstName: 'Jane',
          lastName: 'Doe',
          companyId: 'missing_company',
          now: '2026-04-12T00:00:00Z'
        }),
      'reference_not_found'
    );

    crm.createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });
    const contact = crm.createContact({
      id: 'p_1',
      firstName: 'Jane',
      lastName: 'Doe',
      companyId: 'c_1',
      now: '2026-04-12T00:00:00Z'
    });
    expect(crm.getContact('p_1')).toEqual(contact);
  });

  it('creates opportunities, enforces references, and moves stages', () => {
    const crm = new InMemoryCrmService();
    crm.createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });

    expectCrmError(
      () =>
        crm.createOpportunity({
          id: 'opp_1',
          companyId: 'c_missing',
          name: 'Deal',
          amountCents: 100,
          now: '2026-04-12T00:00:00Z'
        }),
      'reference_not_found'
    );

    const opportunity = crm.createOpportunity({
      id: 'opp_1',
      companyId: 'c_1',
      name: 'Deal',
      amountCents: 100,
      now: '2026-04-12T00:00:00Z'
    });
    expect(opportunity.stage).toBe('Prospecting');
    expect(opportunity.stageHistory).toEqual([]);

    const qualified = crm.moveOpportunityStage({
      id: 'opp_1',
      to: 'Qualified',
      at: '2026-04-12T01:00:00Z'
    });
    expect(qualified.stage).toBe('Qualified');
    expect(qualified.stageHistory).toEqual([
      { from: 'Prospecting', to: 'Qualified', at: '2026-04-12T01:00:00Z' }
    ]);

    expectCrmError(
      () =>
        crm.moveOpportunityStage({
          id: 'opp_1',
          to: 'Negotiation',
          at: '2026-04-12T02:00:00Z'
        }),
      'invalid_stage_transition'
    );

    expectCrmError(
      () => crm.moveOpportunityStage({ id: 'opp_missing', to: 'Qualified', at: '2026-04-12T00:00:00Z' }),
      'reference_not_found'
    );
  });

  it('adds tasks and notes with subject existence and supports marking tasks done', () => {
    const crm = new InMemoryCrmService();
    crm.createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });

    expectCrmError(
      () =>
        crm.addTask({
          id: 't_1',
          subject: { type: 'contact', id: 'p_missing' },
          title: 'Call',
          dueOn: '2026-04-12',
          now: '2026-04-12T00:00:00Z'
        }),
      'reference_not_found'
    );

    const contact = crm.createContact({
      id: 'p_1',
      firstName: 'Jane',
      lastName: 'Doe',
      companyId: 'c_1',
      now: '2026-04-12T00:00:00Z'
    });

    const task = crm.addTask({
      id: 't_1',
      subject: { type: 'contact', id: contact.id },
      title: 'Call',
      dueOn: '2026-04-12',
      now: '2026-04-12T00:00:00Z'
    });
    expect(task.status).toBe('open');

    const done = crm.markTaskDone({ id: 't_1' });
    expect(done.status).toBe('done');

    expectCrmError(() => crm.markTaskDone({ id: 't_missing' }), 'reference_not_found');

    const note = crm.addNote({
      id: 'n_1',
      subject: { type: 'company', id: 'c_1' },
      body: 'Intro call went well',
      now: '2026-04-12T00:00:00Z'
    });
    expect(crm.getNote('n_1')).toEqual(note);

    expectCrmError(
      () =>
        crm.addNote({
          id: 'n_2',
          subject: { type: 'opportunity', id: 'opp_missing' },
          body: 'No such opp',
          now: '2026-04-12T00:00:00Z'
        }),
      'reference_not_found'
    );
  });

  it('computes a dashboard summary from current state', () => {
    const crm = new InMemoryCrmService();
    crm.createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });
    crm.createContact({
      id: 'p_1',
      firstName: 'Jane',
      lastName: 'Doe',
      companyId: 'c_1',
      now: '2026-04-12T00:00:00Z'
    });
    crm.createOpportunity({
      id: 'opp_1',
      companyId: 'c_1',
      name: 'Deal',
      amountCents: 1000,
      now: '2026-04-12T00:00:00Z'
    });
    crm.addTask({
      id: 't_1',
      subject: { type: 'company', id: 'c_1' },
      title: 'Email',
      dueOn: '2026-04-11',
      now: '2026-04-12T00:00:00Z'
    });

    const summary = crm.computeDashboardSummary({ today: '2026-04-12' });
    expect(summary.companiesTotal).toBe(1);
    expect(summary.contactsTotal).toBe(1);
    expect(summary.opportunitiesTotal).toBe(1);
    expect(summary.openOpportunitiesTotal).toBe(1);
    expect(summary.openTasksTotal).toBe(1);
    expect(summary.openTasksOverdue).toBe(1);

    expectCrmError(() => crm.computeDashboardSummary({ today: '2026/04/12' }), 'validation_error');
  });
});

