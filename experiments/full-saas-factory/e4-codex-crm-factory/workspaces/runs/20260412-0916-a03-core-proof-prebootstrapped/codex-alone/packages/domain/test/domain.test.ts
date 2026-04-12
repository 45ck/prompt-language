import { describe, expect, it } from 'vitest';

import {
  DomainError,
  buildDashboardSummary,
  canTransitionOpportunityStage,
  companyId,
  contactId,
  createCompany,
  createContact,
  createOpportunity,
  createTask,
  opportunityId,
  taskId,
  transitionOpportunityStage
} from '../src/index.js';

describe('domain', () => {
  it('normalizes and validates contacts', () => {
    const now = 1_000;

    const company = createCompany({ id: companyId('com_1'), name: '  Acme  ', now, domain: ' EXAMPLE.COM ' });
    const contact = createContact({
      id: contactId('con_1'),
      name: '  Alice Example  ',
      email: ' Alice@Example.COM ',
      phone: ' +1 (555) 123 ',
      companyId: company.id,
      now
    });

    expect(company.name).toBe('Acme');
    expect(company.domain).toBe('example.com');
    expect(contact.name).toBe('Alice Example');
    expect(contact.email).toBe('alice@example.com');

    expect(() => createContact({ id: contactId('con_2'), name: '   ', now })).toThrowError(DomainError);
  });

  it('enforces opportunity stage transitions', () => {
    const now = 10_000;
    const opportunity = createOpportunity({
      id: opportunityId('opp_1'),
      companyId: companyId('com_1'),
      title: ' Big Deal ',
      valueCents: 123_00,
      now
    });

    expect(opportunity.stage).toBe('Prospecting');
    expect(canTransitionOpportunityStage('Prospecting', 'Qualified')).toBe(true);
    expect(canTransitionOpportunityStage('Qualified', 'Prospecting')).toBe(false);

    const qualified = transitionOpportunityStage(opportunity, 'Qualified', now + 1, 'initial qualification');
    expect(qualified.stage).toBe('Qualified');
    expect(qualified.stageHistory).toHaveLength(1);

    expect(() => transitionOpportunityStage(qualified, 'Prospecting', now + 2)).toThrowError(DomainError);

    const closed = transitionOpportunityStage(qualified, 'ClosedWon', now + 3);
    expect(closed.stage).toBe('ClosedWon');
    expect(() => transitionOpportunityStage(closed, 'Negotiation', now + 4)).toThrowError(DomainError);
  });

  it('computes a deterministic dashboard summary', () => {
    const now = 1_000_000;
    const contacts = [createContact({ id: contactId('con_1'), name: 'Alice', now })];
    const companies = [createCompany({ id: companyId('com_1'), name: 'Acme', now })];
    const opportunities = [
      createOpportunity({
        id: opportunityId('opp_1'),
        companyId: companies[0].id,
        title: 'Deal 1',
        valueCents: 10_00,
        stage: 'Prospecting',
        now
      }),
      createOpportunity({
        id: opportunityId('opp_2'),
        companyId: companies[0].id,
        title: 'Deal 2',
        valueCents: 20_00,
        stage: 'Qualified',
        now
      })
    ];
    const tasks = [
      createTask({
        id: taskId('tsk_1'),
        subject: 'Overdue follow-up',
        dueAt: now - 1,
        now
      }),
      createTask({
        id: taskId('tsk_2'),
        subject: 'Due soon follow-up',
        dueAt: now + 2 * 24 * 60 * 60 * 1000,
        now
      })
    ];

    const summary = buildDashboardSummary({ now, contacts, companies, opportunities, tasks, notes: [] });

    expect(summary.totals.contacts).toBe(1);
    expect(summary.totals.companies).toBe(1);
    expect(summary.totals.opportunities).toBe(2);
    expect(summary.opportunitiesByStage.Prospecting).toBe(1);
    expect(summary.opportunitiesByStage.Qualified).toBe(1);
    expect(summary.tasks.open).toBe(2);
    expect(summary.tasks.overdueOpen).toBe(1);
    expect(summary.tasks.dueNext7DaysOpen).toBe(1);
  });
});

