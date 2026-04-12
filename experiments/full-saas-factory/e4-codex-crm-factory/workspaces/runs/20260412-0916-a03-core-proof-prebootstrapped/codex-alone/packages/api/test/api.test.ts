import { describe, expect, it } from 'vitest';

import { ApiError, companyId, createInMemoryCrmApi } from '../src/index.js';

describe('api', () => {
  it('rejects references to missing entities', () => {
    const api = createInMemoryCrmApi({ now: () => 1_000 });

    expect(() => api.createContact({ name: 'Bob', companyId: companyId('com_999') })).toThrowError(ApiError);

    try {
      api.createContact({ name: 'Bob', companyId: companyId('com_999') });
      throw new Error('expected createContact to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('NOT_FOUND');
    }
  });

  it('creates core CRM records and returns a summary', () => {
    let now = 1_000_000;
    const api = createInMemoryCrmApi({ now: () => now });

    const company = api.createCompany({ name: ' Acme ', domain: 'Example.COM' });
    const contact = api.createContact({ name: 'Alice', email: 'ALICE@EXAMPLE.COM', companyId: company.id });
    const opportunity = api.createOpportunity({
      companyId: company.id,
      primaryContactId: contact.id,
      title: 'Big deal',
      valueCents: 500_00
    });

    now += 1;
    api.transitionOpportunityStage(opportunity.id, 'Qualified');

    const overdueTask = api.createTask({
      subject: 'Overdue follow-up',
      dueAt: now - 1,
      relatedTo: { type: 'opportunity', id: opportunity.id }
    });
    api.createTask({ subject: 'Due soon follow-up', dueAt: now + 3 * 24 * 60 * 60 * 1000 });
    api.createNote({ body: 'Called customer', relatedTo: { type: 'task', id: overdueTask.id } });

    const summary = api.getDashboardSummary();
    expect(summary.totals.companies).toBe(1);
    expect(summary.totals.contacts).toBe(1);
    expect(summary.totals.opportunities).toBe(1);
    expect(summary.opportunitiesByStage.Qualified).toBe(1);
    expect(summary.tasks.open).toBe(2);
    expect(summary.tasks.overdueOpen).toBe(1);
    expect(summary.tasks.dueNext7DaysOpen).toBe(1);
  });

  it('supports completing tasks', () => {
    const api = createInMemoryCrmApi({ now: () => 1_000 });
    const task = api.createTask({ subject: 'Follow up' });

    const completed = api.completeTask(task.id);
    expect(completed.status).toBe('Completed');

    const summary = api.getDashboardSummary();
    expect(summary.tasks.open).toBe(0);
    expect(summary.tasks.completed).toBe(1);
  });
});

