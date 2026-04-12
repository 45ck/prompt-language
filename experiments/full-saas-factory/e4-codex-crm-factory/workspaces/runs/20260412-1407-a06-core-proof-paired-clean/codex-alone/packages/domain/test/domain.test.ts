import { describe, expect, it } from 'vitest';

import {
  DomainError,
  buildDashboardSummary,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  transitionOpportunityStage,
} from '../src/index.js';

const t0 = new Date('2026-01-01T00:00:00.000Z');
const t1 = new Date('2026-01-02T00:00:00.000Z');
const t2 = new Date('2026-01-03T00:00:00.000Z');

describe('domain', () => {
  const expectDomainError = (fn: () => unknown, code: DomainError['code']) => {
    try {
      fn();
      throw new Error('expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(code);
    }
  };

  it('normalizes email and trims names', () => {
    const contact = createContact({
      id: 'contact_1',
      firstName: '  Ada  ',
      lastName: '  Lovelace ',
      email: ' ADA@Example.Com ',
      at: t0,
    });

    expect(contact.firstName).toBe('Ada');
    expect(contact.lastName).toBe('Lovelace');
    expect(contact.email).toBe('ada@example.com');
  });

  it('enforces opportunity stage transitions', () => {
    const opportunity = createOpportunity({
      id: 'opp_1',
      companyId: 'company_1',
      title: 'Deal',
      amountCents: 50_00,
      currency: 'USD',
      at: t0,
    });

    const qualified = transitionOpportunityStage({
      opportunity,
      toStage: 'Qualified',
      at: t1,
    });
    expect(qualified.stage).toBe('Qualified');

    expect(() =>
      transitionOpportunityStage({
        opportunity: qualified,
        toStage: 'Prospecting',
        at: t2,
      }),
    ).toThrowError(DomainError);

    expectDomainError(
      () =>
        transitionOpportunityStage({
          opportunity,
          toStage: 'Proposal',
          at: t1,
        }),
      'INVALID_STAGE_TRANSITION',
    );
  });

  it('builds a deterministic dashboard summary', () => {
    const company = createCompany({ id: 'company_1', name: 'Acme', domain: 'acme.test', at: t0 });
    const contact = createContact({
      id: 'contact_1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.test',
      companyId: company.id,
      at: t0,
    });
    const oppOpen = createOpportunity({
      id: 'opp_open',
      companyId: company.id,
      primaryContactId: contact.id,
      title: 'Pipeline',
      amountCents: 100_00,
      currency: 'USD',
      stage: 'Qualified',
      at: t0,
    });
    const oppWon = createOpportunity({
      id: 'opp_won',
      companyId: company.id,
      title: 'Won',
      amountCents: 200_00,
      currency: 'USD',
      stage: 'ClosedWon',
      at: t0,
    });
    const taskOverdue = createTask({
      id: 'task_1',
      title: 'Follow up',
      related: { type: 'contact', id: contact.id },
      dueAt: t0,
      at: t0,
    });
    const note = createNote({
      id: 'note_1',
      body: 'First note',
      related: { type: 'opportunity', id: oppOpen.id },
      at: t1,
    });

    const summary = buildDashboardSummary({
      companies: [company],
      contacts: [contact],
      opportunities: [oppOpen, oppWon],
      tasks: [taskOverdue],
      notes: [note],
      now: t2,
      recentNoteLimit: 5,
      noteExcerptLength: 10,
    });

    expect(summary.counts.companies).toBe(1);
    expect(summary.counts.contacts).toBe(1);
    expect(summary.counts.opportunities).toBe(2);
    expect(summary.counts.opportunitiesOpen).toBe(1);
    expect(summary.counts.opportunitiesClosedWon).toBe(1);
    expect(summary.counts.tasksOpen).toBe(1);
    expect(summary.counts.tasksOverdue).toBe(1);
    expect(summary.pipeline.openAmountCentsTotal).toBe(100_00);
    expect(summary.pipeline.openAmountCentsByStage.Qualified).toBe(100_00);
    expect(summary.recentNotes).toHaveLength(1);
    expect(summary.recentNotes[0]?.excerpt).toBe('First note');
  });
});
