import { InMemoryCrmService, type IdGenerator } from '../src/index.js';
import { describe, expect, it } from 'vitest';

function sequenceIdGenerator(ids: readonly string[]): IdGenerator {
  let index = 0;
  return {
    nextId() {
      const id = ids[index];
      if (id === undefined) throw new Error('IdGenerator exhausted.');
      index += 1;
      return id;
    }
  };
}

describe('InMemoryCrmService', () => {
  it('creates and reads companies and contacts with referential integrity', () => {
    const service = new InMemoryCrmService(sequenceIdGenerator(['comp_1', 'con_1']));

    const company = service.createCompany({ name: '  Acme  ' });
    expect(company.ok).toBe(true);
    if (!company.ok) throw new Error('expected ok');
    expect(company.value).toEqual({ id: 'comp_1', name: 'Acme' });

    expect(service.getCompany('comp_1')).toEqual(company);

    const contact = service.createContact({
      displayName: '  Ada Lovelace  ',
      email: 'ada@example.com',
      companyId: 'comp_1'
    });
    expect(contact.ok).toBe(true);
    if (!contact.ok) throw new Error('expected ok');
    expect(contact.value).toEqual({
      id: 'con_1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      companyId: 'comp_1'
    });

    const missingCompany = service.createContact({
      displayName: 'Bob',
      companyId: 'comp_missing'
    });
    expect(missingCompany).toEqual({
      ok: false,
      error: {
        type: 'not_found',
        entity: 'company',
        id: 'comp_missing',
        message: 'Company not found.'
      }
    });
  });

  it('creates opportunities and enforces stage transitions', () => {
    const service = new InMemoryCrmService(
      sequenceIdGenerator(['comp_1', 'con_1', 'opp_1'])
    );
    const company = service.createCompany({ name: 'Acme' });
    if (!company.ok) throw new Error('expected ok');
    const contact = service.createContact({ displayName: 'Ada' });
    if (!contact.ok) throw new Error('expected ok');

    const opportunity = service.createOpportunity({
      companyId: 'comp_1',
      primaryContactId: 'con_1',
      title: '  Website redesign  ',
      amount: 10_000
    });
    expect(opportunity.ok).toBe(true);
    if (!opportunity.ok) throw new Error('expected ok');
    expect(opportunity.value.id).toBe('opp_1');
    expect(opportunity.value.stage).toBe('prospecting');
    expect(opportunity.value.title).toBe('Website redesign');

    const qualified = service.moveOpportunityStage({
      opportunityId: 'opp_1',
      toStage: 'qualified'
    });
    expect(qualified.ok).toBe(true);
    if (!qualified.ok) throw new Error('expected ok');
    expect(qualified.value.stage).toBe('qualified');

    const backward = service.moveOpportunityStage({
      opportunityId: 'opp_1',
      toStage: 'prospecting'
    });
    expect(backward.ok).toBe(false);

    const persisted = service.getOpportunity('opp_1');
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) throw new Error('expected ok');
    expect(persisted.value.stage).toBe('qualified');

    const notFound = service.moveOpportunityStage({
      opportunityId: 'opp_missing',
      toStage: 'proposal'
    });
    expect(notFound).toEqual({
      ok: false,
      error: {
        type: 'not_found',
        entity: 'opportunity',
        id: 'opp_missing',
        message: 'Opportunity not found.'
      }
    });
  });

  it('adds, completes, and lists tasks', () => {
    const service = new InMemoryCrmService(
      sequenceIdGenerator(['comp_1', 'opp_1', 'task_1', 'task_2'])
    );
    const company = service.createCompany({ name: 'Acme' });
    if (!company.ok) throw new Error('expected ok');
    const opportunity = service.createOpportunity({ companyId: 'comp_1', title: 'Deal' });
    if (!opportunity.ok) throw new Error('expected ok');

    const task1 = service.addTask({ opportunityId: 'opp_1', title: '  Call  ' });
    expect(task1.ok).toBe(true);
    if (!task1.ok) throw new Error('expected ok');
    expect(task1.value).toEqual({
      id: 'task_1',
      opportunityId: 'opp_1',
      title: 'Call',
      status: 'open'
    });

    const task2 = service.addTask({ opportunityId: 'opp_1', title: 'Email follow-up' });
    expect(task2.ok).toBe(true);
    if (!task2.ok) throw new Error('expected ok');
    expect(task2.value.id).toBe('task_2');

    const listed = service.listTasksForOpportunity({ opportunityId: 'opp_1' });
    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error('expected ok');
    expect(listed.value.map((t) => t.id)).toEqual(['task_1', 'task_2']);

    const completed = service.completeTask({ taskId: 'task_1' });
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error('expected ok');
    expect(completed.value.status).toBe('done');

    const missing = service.completeTask({ taskId: 'task_missing' });
    expect(missing.ok).toBe(false);
  });

  it('adds and lists notes in insertion order', () => {
    const service = new InMemoryCrmService(
      sequenceIdGenerator(['comp_1', 'opp_1', 'note_1', 'note_2', 'note_3'])
    );
    const company = service.createCompany({ name: 'Acme' });
    if (!company.ok) throw new Error('expected ok');
    const opportunity = service.createOpportunity({ companyId: 'comp_1', title: 'Deal' });
    if (!opportunity.ok) throw new Error('expected ok');

    const note1 = service.addNote({ targetType: 'opportunity', targetId: 'opp_1', body: '  A  ' });
    const note2 = service.addNote({ targetType: 'opportunity', targetId: 'opp_1', body: 'B' });
    const note3 = service.addNote({ targetType: 'company', targetId: 'comp_1', body: 'C' });
    expect(note1.ok).toBe(true);
    expect(note2.ok).toBe(true);
    expect(note3.ok).toBe(true);

    const notesForOpportunity = service.listNotesForTarget({
      targetType: 'opportunity',
      targetId: 'opp_1'
    });
    expect(notesForOpportunity.ok).toBe(true);
    if (!notesForOpportunity.ok) throw new Error('expected ok');
    expect(notesForOpportunity.value.map((n) => n.body)).toEqual(['A', 'B']);

    const notesForCompany = service.listNotesForTarget({
      targetType: 'company',
      targetId: 'comp_1'
    });
    expect(notesForCompany.ok).toBe(true);
    if (!notesForCompany.ok) throw new Error('expected ok');
    expect(notesForCompany.value.map((n) => n.body)).toEqual(['C']);
  });

  it('computes dashboard summary from current state', () => {
    const service = new InMemoryCrmService(
      sequenceIdGenerator(['comp_1', 'con_1', 'opp_1', 'task_1', 'note_1'])
    );
    const company = service.createCompany({ name: 'Acme' });
    if (!company.ok) throw new Error('expected ok');
    const contact = service.createContact({ displayName: 'Ada' });
    if (!contact.ok) throw new Error('expected ok');
    const opportunity = service.createOpportunity({
      companyId: 'comp_1',
      primaryContactId: 'con_1',
      title: 'Deal'
    });
    if (!opportunity.ok) throw new Error('expected ok');
    const task = service.addTask({ opportunityId: 'opp_1', title: 'Call' });
    if (!task.ok) throw new Error('expected ok');
    const note = service.addNote({ targetType: 'company', targetId: 'comp_1', body: 'Note' });
    if (!note.ok) throw new Error('expected ok');

    const summary = service.getDashboardSummary();
    expect(summary.companiesTotal).toBe(1);
    expect(summary.contactsTotal).toBe(1);
    expect(summary.opportunitiesTotal).toBe(1);
    expect(summary.opportunitiesByStage.prospecting).toBe(1);
    expect(summary.openOpportunitiesTotal).toBe(1);
    expect(summary.tasksOpenTotal).toBe(1);
    expect(summary.tasksDoneTotal).toBe(0);
    expect(summary.notesTotal).toBe(1);
  });
});

