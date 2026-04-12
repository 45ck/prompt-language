import { describe, expect, it } from 'vitest';

import {
  CrmError,
  computeDashboardSummary,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  markTaskDone,
  moveOpportunityStage
} from '../src/index.js';

function expectCrmError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('Expected CrmError to be thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(CrmError);
    expect((error as CrmError).code).toBe(code);
  }
}

describe('domain', () => {
  it('creates a company with createdAt = now', () => {
    const company = createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });
    expect(company).toEqual({ id: 'c_1', name: 'Acme', createdAt: '2026-04-12T00:00:00Z' });
  });

  it('validates company name', () => {
    expectCrmError(
      () => createCompany({ id: 'c_1', name: '', now: '2026-04-12T00:00:00Z' }),
      'validation_error'
    );
  });

  it('validates contact required fields and email', () => {
    expectCrmError(
      () =>
        createContact({
          id: 'p_1',
          firstName: '',
          lastName: 'Doe',
          now: '2026-04-12T00:00:00Z'
        }),
      'validation_error'
    );

    expectCrmError(
      () =>
        createContact({
          id: 'p_1',
          firstName: 'Jane',
          lastName: '',
          now: '2026-04-12T00:00:00Z'
        }),
      'validation_error'
    );

    expectCrmError(
      () =>
        createContact({
          id: 'p_1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'not-an-email',
          now: '2026-04-12T00:00:00Z'
        }),
      'validation_error'
    );
  });

  it('creates opportunities in Prospecting with empty stageHistory', () => {
    const opportunity = createOpportunity({
      id: 'opp_1',
      companyId: 'c_1',
      name: 'Deal',
      amountCents: 123,
      now: '2026-04-12T00:00:00Z'
    });

    expect(opportunity.stage).toBe('Prospecting');
    expect(opportunity.stageHistory).toEqual([]);
  });

  it('enforces the opportunity stage machine', () => {
    const base = createOpportunity({
      id: 'opp_1',
      companyId: 'c_1',
      name: 'Deal',
      amountCents: 123,
      now: '2026-04-12T00:00:00Z'
    });

    const qualified = moveOpportunityStage({
      opportunity: base,
      to: 'Qualified',
      at: '2026-04-12T01:00:00Z'
    });
    expect(qualified.stage).toBe('Qualified');
    expect(qualified.stageHistory).toEqual([
      { from: 'Prospecting', to: 'Qualified', at: '2026-04-12T01:00:00Z' }
    ]);

    expectCrmError(
      () =>
        moveOpportunityStage({
          opportunity: base,
          to: 'Proposal',
          at: '2026-04-12T01:00:00Z'
        }),
      'invalid_stage_transition'
    );

    const closedWon = moveOpportunityStage({
      opportunity: moveOpportunityStage({
        opportunity: moveOpportunityStage({
          opportunity: qualified,
          to: 'Proposal',
          at: '2026-04-12T02:00:00Z'
        }),
        to: 'Negotiation',
        at: '2026-04-12T03:00:00Z'
      }),
      to: 'ClosedWon',
      at: '2026-04-12T04:00:00Z'
    });

    expectCrmError(
      () =>
        moveOpportunityStage({
          opportunity: closedWon,
          to: 'ClosedLost',
          at: '2026-04-12T05:00:00Z'
        }),
      'invalid_stage_transition'
    );
  });

  it('creates tasks and notes and supports marking tasks done', () => {
    const task = createTask({
      id: 't_1',
      subject: { type: 'contact', id: 'p_1' },
      title: 'Call',
      dueOn: '2026-04-12',
      now: '2026-04-12T00:00:00Z'
    });
    expect(task.status).toBe('open');

    const done = markTaskDone(task);
    expect(done.status).toBe('done');

    const note = createNote({
      id: 'n_1',
      subject: { type: 'contact', id: 'p_1' },
      body: 'Met at conference',
      now: '2026-04-12T00:00:00Z'
    });
    expect(note.body).toBe('Met at conference');
  });

  it('computes a dashboard summary from in-memory state', () => {
    const company = createCompany({ id: 'c_1', name: 'Acme', now: '2026-04-12T00:00:00Z' });
    const contact = createContact({
      id: 'p_1',
      firstName: 'Jane',
      lastName: 'Doe',
      companyId: 'c_1',
      now: '2026-04-12T00:00:00Z'
    });
    const openOpp = createOpportunity({
      id: 'opp_1',
      companyId: 'c_1',
      name: 'Deal',
      amountCents: 500,
      now: '2026-04-12T00:00:00Z'
    });
    const closedLost = moveOpportunityStage({
      opportunity: openOpp,
      to: 'ClosedLost',
      at: '2026-04-12T01:00:00Z'
    });

    const openTaskOverdue = createTask({
      id: 't_1',
      subject: { type: 'company', id: 'c_1' },
      title: 'Email',
      dueOn: '2026-04-11',
      now: '2026-04-12T00:00:00Z'
    });
    const openTaskDueToday = createTask({
      id: 't_2',
      subject: { type: 'contact', id: 'p_1' },
      title: 'Call',
      dueOn: '2026-04-12',
      now: '2026-04-12T00:00:00Z'
    });
    const doneTask = markTaskDone(openTaskDueToday);

    const summary = computeDashboardSummary({
      companies: [company],
      contacts: [contact],
      opportunities: [openOpp, closedLost],
      tasks: [openTaskOverdue, doneTask],
      today: '2026-04-12'
    });

    expect(summary.companiesTotal).toBe(1);
    expect(summary.contactsTotal).toBe(1);
    expect(summary.opportunitiesTotal).toBe(2);
    expect(summary.openOpportunitiesTotal).toBe(1);
    expect(summary.openOpportunityAmountCentsTotal).toBe(500);
    expect(summary.opportunitiesByStage.Prospecting).toBe(1);
    expect(summary.opportunitiesByStage.ClosedLost).toBe(1);
    expect(summary.openTasksTotal).toBe(1);
    expect(summary.openTasksOverdue).toBe(1);
    expect(summary.openTasksDueToday).toBe(0);
  });
});

