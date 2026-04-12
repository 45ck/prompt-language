import { describe, expect, it } from 'vitest';

import { CrmError } from '../../domain/src/index.ts';
import { createCrmService } from '../src/index.ts';

function createIdGenerator(ids: string[]) {
  let index = 0;
  return () => {
    const next = ids[index];
    if (next === undefined) throw new Error('No more IDs in generator.');
    index += 1;
    return next;
  };
}

describe('api crm service (in-memory)', () => {
  it('creates companies, contacts, opportunities, tasks, notes and computes dashboard summary', () => {
    const service = createCrmService({
      generateId: createIdGenerator(['company_1', 'contact_1', 'opp_1', 'task_1', 'note_1']),
    });

    const company = service.createCompany({ name: '  Acme  ', now: '2026-01-01T00:00:00.000Z' });
    expect(company).toEqual({
      id: 'company_1',
      name: 'Acme',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const contact = service.createContact({
      displayName: '  Jane Doe ',
      email: ' jane@example.com ',
      companyId: company.id,
      now: '2026-01-01T00:00:00.000Z',
    });
    expect(contact.companyId).toBe(company.id);
    expect(contact.email).toBe('jane@example.com');

    const opportunity = service.createOpportunity({
      companyId: company.id,
      primaryContactId: contact.id,
      title: '  New Deal ',
      amountCents: 120_00,
      currency: 'USD',
      now: '2026-01-01T00:00:00.000Z',
    });
    expect(opportunity.stage).toBe('prospecting');

    const task = service.addTask({
      subject: { type: 'opportunity', id: opportunity.id },
      title: '  Follow up ',
      dueAt: '2026-01-01T00:00:00.000Z',
      now: '2026-01-01T00:00:00.000Z',
    });
    expect(task.status).toBe('open');

    const note = service.addNote({
      subject: { type: 'contact', id: contact.id },
      body: '  Met at event. ',
      now: '2026-01-01T00:00:00.000Z',
    });
    expect(note.body).toBe('Met at event.');

    const summary = service.getDashboardSummary({ asOf: '2026-01-02T00:00:00.000Z' });
    expect(summary.totals).toEqual({
      companies: 1,
      contacts: 1,
      opportunities: 1,
      tasks: { open: 1, completed: 0 },
      notes: 1,
    });
    expect(summary.opportunitiesByStage.prospecting).toBe(1);
    expect(summary.opportunitiesByStage['closed-won']).toBe(0);
    expect(summary.overdueOpenTasks).toBe(1);
  });

  it('enforces referential integrity and atomicity (no partial writes)', () => {
    const service = createCrmService({ generateId: createIdGenerator(['contact_1']) });

    const before = service.getDashboardSummary({ asOf: '2026-01-01T00:00:00.000Z' });
    expect(before.totals).toEqual({
      companies: 0,
      contacts: 0,
      opportunities: 0,
      tasks: { open: 0, completed: 0 },
      notes: 0,
    });

    try {
      service.createContact({
        displayName: 'Jane',
        companyId: 'missing_company',
        now: '2026-01-01T00:00:00.000Z',
      });
      throw new Error('Expected createContact to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('type', 'not-found');
      expect(error).toHaveProperty('resource', 'company');
    }

    const after = service.getDashboardSummary({ asOf: '2026-01-01T00:00:00.000Z' });
    expect(after).toEqual(before);
  });

  it('rejects invalid opportunity stage transitions without mutating state', () => {
    const service = createCrmService({ generateId: createIdGenerator(['company_1', 'opp_1']) });

    const company = service.createCompany({ name: 'Acme', now: '2026-01-01T00:00:00.000Z' });
    const opportunity = service.createOpportunity({
      companyId: company.id,
      title: 'Deal',
      amountCents: 0,
      currency: 'USD',
      now: '2026-01-01T00:00:00.000Z',
    });

    const qualified = service.moveOpportunityStage({
      opportunityId: opportunity.id,
      toStage: 'qualified',
      now: '2026-01-02T00:00:00.000Z',
    });
    expect(qualified.stage).toBe('qualified');

    const before = service.getDashboardSummary({ asOf: '2026-01-02T00:00:00.000Z' });

    try {
      service.moveOpportunityStage({
        opportunityId: opportunity.id,
        toStage: 'closed-won',
        now: '2026-01-03T00:00:00.000Z',
      });
      throw new Error('Expected moveOpportunityStage to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('type', 'invalid-transition');
    }

    const after = service.getDashboardSummary({ asOf: '2026-01-03T00:00:00.000Z' });
    expect(after).toEqual(before);
    expect(after.opportunitiesByStage.qualified).toBe(1);
    expect(after.opportunitiesByStage['closed-won']).toBe(0);
  });

  it('completes tasks one-way and reports conflicts', () => {
    const service = createCrmService({
      generateId: createIdGenerator(['company_1', 'task_1']),
    });

    const company = service.createCompany({ name: 'Acme', now: '2026-01-01T00:00:00.000Z' });
    const task = service.addTask({
      subject: { type: 'company', id: company.id },
      title: 'Call',
      now: '2026-01-01T00:00:00.000Z',
    });

    service.completeTask({ taskId: task.id, now: '2026-01-02T00:00:00.000Z' });

    const before = service.getDashboardSummary({ asOf: '2026-01-02T00:00:00.000Z' });
    expect(before.totals.tasks).toEqual({ open: 0, completed: 1 });

    try {
      service.completeTask({ taskId: task.id, now: '2026-01-03T00:00:00.000Z' });
      throw new Error('Expected completeTask to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('type', 'conflict');
    }

    const after = service.getDashboardSummary({ asOf: '2026-01-03T00:00:00.000Z' });
    expect(after).toEqual(before);
  });

  it('returns structured errors as CrmError instances', () => {
    const service = createCrmService({ generateId: createIdGenerator(['company_1']) });

    try {
      service.createCompany({ name: ' ', now: '2026-01-01T00:00:00.000Z' });
      throw new Error('Expected createCompany to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CrmError);
      expect(error).toHaveProperty('type', 'validation');
      expect(error).toHaveProperty('issues');
    }
  });
});
