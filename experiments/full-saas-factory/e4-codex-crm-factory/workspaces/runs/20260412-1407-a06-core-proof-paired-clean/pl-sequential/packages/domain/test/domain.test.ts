import { describe, expect, it } from 'vitest';

import {
  completeTask,
  computeDashboardSummary,
  createCompany,
  createOpportunity,
  createTask,
  moveOpportunityStage,
} from '../src/index.ts';

describe('domain', () => {
  it('creates a company with trimmed name', () => {
    const company = createCompany({
      id: 'c_1',
      name: '  Acme  ',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(company).toEqual({
      id: 'c_1',
      name: 'Acme',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('creates an opportunity with default stage and stageUpdatedAt', () => {
    const opportunity = createOpportunity({
      id: 'o_1',
      companyId: 'c_1',
      title: '  New Deal ',
      amountCents: 12300,
      currency: 'USD',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(opportunity.stage).toBe('prospecting');
    expect(opportunity.stageUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('allows only the specified opportunity stage transitions', () => {
    const base = createOpportunity({
      id: 'o_1',
      companyId: 'c_1',
      title: 'Deal',
      amountCents: 0,
      currency: 'USD',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const qualified = moveOpportunityStage(base, 'qualified', '2026-01-02T00:00:00.000Z');
    expect(qualified.stage).toBe('qualified');

    try {
      moveOpportunityStage(qualified, 'closed-won', '2026-01-03T00:00:00.000Z');
      throw new Error('Expected moveOpportunityStage to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('type', 'invalid-transition');
    }
  });

  it('completes tasks one-way only', () => {
    const task = createTask({
      id: 't_1',
      subject: { type: 'company', id: 'c_1' },
      title: 'Call',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const completed = completeTask(task, '2026-01-02T00:00:00.000Z');
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe('2026-01-02T00:00:00.000Z');

    try {
      completeTask(completed, '2026-01-03T00:00:00.000Z');
      throw new Error('Expected completeTask to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('type', 'conflict');
    }
  });

  it('computes a deterministic dashboard summary', () => {
    const summary = computeDashboardSummary(
      {
        companies: [
          createCompany({
            id: 'c_1',
            name: 'Acme',
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
        contacts: [],
        opportunities: [
          createOpportunity({
            id: 'o_1',
            companyId: 'c_1',
            title: 'Deal',
            amountCents: 0,
            currency: 'USD',
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
        tasks: [
          createTask({
            id: 't_1',
            subject: { type: 'company', id: 'c_1' },
            title: 'Call',
            dueAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
        notes: [],
      },
      '2026-01-02T00:00:00.000Z',
    );

    expect(summary.totals.companies).toBe(1);
    expect(summary.totals.opportunities).toBe(1);
    expect(summary.totals.tasks.open).toBe(1);
    expect(summary.overdueOpenTasks).toBe(1);
    expect(summary.opportunitiesByStage.prospecting).toBe(1);
    expect(summary.opportunitiesByStage['closed-won']).toBe(0);
  });
});
