import { describe, expect, it } from 'vitest';

import {
  DomainValidationError,
  allowedNextStages,
  buildDashboardSummary,
  completeTask,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  filterOpportunitiesByStage,
  isTaskOverdue,
  listNotesForEntity,
  searchCompanies,
  searchContacts,
  searchOpportunities,
  transitionOpportunityStage,
  updateCompany,
  updateNoteBody,
  updateTask,
  type CompanyId,
  type ContactId,
  type NoteId,
  type OpportunityId,
  type TaskId
} from '../src/index.js';

describe('contacts', () => {
  it('creates searchable contacts and enforces normalized email uniqueness', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: 'Acme',
      now: '2026-04-12T09:00:00Z'
    });

    const contact = createContact(
      {
        id: 'contact-1' as ContactId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: ' Ada@Example.com ',
        companyId: company.id,
        now: '2026-04-12T09:05:00Z'
      },
      [],
      [company]
    );

    expect(contact.email).toBe('ada@example.com');
    expect(searchContacts([contact], 'lovelace')).toEqual([contact]);
    expect(searchContacts([contact], 'EXAMPLE')).toEqual([contact]);

    expect(() =>
      createContact(
        {
          id: 'contact-2' as ContactId,
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'ada@example.com',
          now: '2026-04-12T09:06:00Z'
        },
        [contact]
      )
    ).toThrow(DomainValidationError);
  });

  it('rejects a missing company reference', () => {
    expect(() =>
      createContact({
        id: 'contact-3' as ContactId,
        firstName: 'Alan',
        lastName: 'Turing',
        companyId: 'company-missing' as CompanyId,
        now: '2026-04-12T09:07:00Z'
      })
    ).toThrow(DomainValidationError);
  });
});

describe('companies', () => {
  it('creates searchable companies and blocks duplicate normalized names', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: ' Acme Corp ',
      now: '2026-04-12T09:00:00Z'
    });

    expect(searchCompanies([company], 'corp')).toEqual([company]);

    expect(() =>
      createCompany(
        {
          id: 'company-2' as CompanyId,
          name: 'acme corp',
          now: '2026-04-12T09:01:00Z'
        },
        [company]
      )
    ).toThrow(DomainValidationError);

    expect(() =>
      updateCompany(
        company,
        {
          name: '   ',
          now: '2026-04-12T09:02:00Z'
        },
        [company]
      )
    ).toThrow(DomainValidationError);
  });
});

describe('opportunities', () => {
  it('creates searchable lead opportunities with valid references', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: 'Acme',
      now: '2026-04-12T09:00:00Z'
    });
    const contact = createContact(
      {
        id: 'contact-1' as ContactId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        now: '2026-04-12T09:01:00Z'
      },
      [],
      [company]
    );

    const opportunity = createOpportunity(
      {
        id: 'opportunity-1' as OpportunityId,
        name: 'CRM Rollout',
        companyId: company.id,
        primaryContactId: contact.id,
        amount: 25_000,
        now: '2026-04-12T09:02:00Z'
      },
      [company],
      [contact]
    );

    expect(opportunity.stage).toBe('Lead');
    expect(searchOpportunities([opportunity], 'roll')).toEqual([opportunity]);
    expect(filterOpportunitiesByStage([opportunity], 'Lead')).toEqual([
      opportunity
    ]);
  });

  it('rejects invalid initial stages and negative amounts', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: 'Acme',
      now: '2026-04-12T09:00:00Z'
    });

    expect(() =>
      createOpportunity(
        {
          id: 'opportunity-2' as OpportunityId,
          name: 'Direct Close',
          companyId: company.id,
          stage: 'Qualified',
          now: '2026-04-12T09:03:00Z'
        },
        [company]
      )
    ).toThrow(DomainValidationError);

    expect(() =>
      createOpportunity(
        {
          id: 'opportunity-3' as OpportunityId,
          name: 'Negative Deal',
          companyId: company.id,
          amount: -1,
          now: '2026-04-12T09:04:00Z'
        },
        [company]
      )
    ).toThrow(DomainValidationError);
  });
});

describe('stage transitions', () => {
  it('allows forward-only transitions and closes terminal opportunities', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: 'Acme',
      now: '2026-04-12T09:00:00Z'
    });
    const leadOpportunity = createOpportunity(
      {
        id: 'opportunity-1' as OpportunityId,
        name: 'CRM Rollout',
        companyId: company.id,
        now: '2026-04-12T09:01:00Z'
      },
      [company]
    );

    expect(allowedNextStages('Qualified')).toEqual(['Proposal', 'Lost']);
    expect(() =>
      transitionOpportunityStage(
        leadOpportunity,
        'Won',
        '2026-04-12T09:02:00Z'
      )
    ).toThrow(DomainValidationError);

    const qualifiedOpportunity = transitionOpportunityStage(
      leadOpportunity,
      'Qualified',
      '2026-04-12T09:03:00Z'
    );
    const proposalOpportunity = transitionOpportunityStage(
      qualifiedOpportunity,
      'Proposal',
      '2026-04-12T09:04:00Z'
    );
    const wonOpportunity = transitionOpportunityStage(
      proposalOpportunity,
      'Won',
      '2026-04-12T09:05:00Z'
    );

    expect(wonOpportunity.closedAt).toBe('2026-04-12T09:05:00Z');
    expect(() =>
      transitionOpportunityStage(wonOpportunity, 'Lost', '2026-04-12T09:06:00Z')
    ).toThrow(DomainValidationError);
  });
});

describe('tasks', () => {
  it('creates, updates, completes, and derives overdue state for tasks', () => {
    const contact = createContact({
      id: 'contact-1' as ContactId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      now: '2026-04-12T09:00:00Z'
    });

    const task = createTask(
      {
        id: 'task-1' as TaskId,
        title: ' Call back ',
        dueDate: '2026-04-11',
        linkedEntityType: 'Contact',
        linkedEntityId: contact.id,
        now: '2026-04-12T09:01:00Z'
      },
      { contacts: [contact] }
    );

    const updatedTask = updateTask(task, {
      title: 'Call back today',
      dueDate: '2026-04-11',
      now: '2026-04-12T09:02:00Z'
    });

    expect(updatedTask.status).toBe('Open');
    expect(updatedTask.updatedAt).toBe('2026-04-12T09:02:00Z');
    expect(isTaskOverdue(updatedTask, '2026-04-12')).toBe(true);

    const completedTask = completeTask(
      updatedTask,
      '2026-04-12T09:03:00Z'
    );

    expect(completedTask.status).toBe('Completed');
    expect(completedTask.completedAt).toBe('2026-04-12T09:03:00Z');
    expect(() =>
      updateTask(completedTask, {
        title: 'Should fail',
        now: '2026-04-12T09:04:00Z'
      })
    ).toThrow(DomainValidationError);
  });

  it('rejects tasks linked to missing records', () => {
    expect(() =>
      createTask(
        {
          id: 'task-2' as TaskId,
          title: 'Follow up',
          linkedEntityType: 'Company',
          linkedEntityId: 'company-missing' as CompanyId,
          now: '2026-04-12T09:05:00Z'
        },
        {}
      )
    ).toThrow(DomainValidationError);
  });
});

describe('notes', () => {
  it('creates append-only notes and lists them newest first', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: 'Acme',
      now: '2026-04-12T09:00:00Z'
    });

    const firstNote = createNote(
      {
        id: 'note-1' as NoteId,
        body: 'First note',
        linkedEntityType: 'Company',
        linkedEntityId: company.id,
        now: '2026-04-12T09:01:00Z'
      },
      { companies: [company] }
    );
    const secondNote = createNote(
      {
        id: 'note-2' as NoteId,
        body: 'Second note',
        linkedEntityType: 'Company',
        linkedEntityId: company.id,
        now: '2026-04-12T09:02:00Z'
      },
      { companies: [company] }
    );

    expect(
      listNotesForEntity([firstNote, secondNote], 'Company', company.id).map(
        (note) => note.id
      )
    ).toEqual(['note-2', 'note-1']);

    expect(() => updateNoteBody(firstNote, 'Changed')).toThrow(
      DomainValidationError
    );
    expect(() =>
      createNote(
        {
          id: 'note-3' as NoteId,
          body: '   ',
          linkedEntityType: 'Company',
          linkedEntityId: company.id,
          now: '2026-04-12T09:03:00Z'
        },
        { companies: [company] }
      )
    ).toThrow(DomainValidationError);
  });
});

describe('dashboard summaries', () => {
  it('returns complete stage counts, open pipeline amount, and overdue task totals', () => {
    const company = createCompany({
      id: 'company-1' as CompanyId,
      name: 'Acme',
      now: '2026-04-12T09:00:00Z'
    });
    const contact = createContact(
      {
        id: 'contact-1' as ContactId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        companyId: company.id,
        now: '2026-04-12T09:01:00Z'
      },
      [],
      [company]
    );

    const leadOpportunity = createOpportunity(
      {
        id: 'opportunity-1' as OpportunityId,
        name: 'Lead Deal',
        companyId: company.id,
        amount: 100,
        now: '2026-04-12T09:02:00Z'
      },
      [company]
    );
    const qualifiedOpportunity = transitionOpportunityStage(
      createOpportunity(
        {
          id: 'opportunity-2' as OpportunityId,
          name: 'Qualified Deal',
          companyId: company.id,
          amount: 200,
          now: '2026-04-12T09:03:00Z'
        },
        [company]
      ),
      'Qualified',
      '2026-04-12T09:04:00Z'
    );
    const wonOpportunity = transitionOpportunityStage(
      transitionOpportunityStage(
        createOpportunity(
          {
            id: 'opportunity-3' as OpportunityId,
            name: 'Won Deal',
            companyId: company.id,
            amount: 500,
            now: '2026-04-12T09:05:00Z'
          },
          [company]
        ),
        'Qualified',
        '2026-04-12T09:06:00Z'
      ),
      'Lost',
      '2026-04-12T09:07:00Z'
    );

    const overdueTask = createTask(
      {
        id: 'task-1' as TaskId,
        title: 'Overdue task',
        dueDate: '2026-04-10',
        linkedEntityType: 'Contact',
        linkedEntityId: contact.id,
        now: '2026-04-12T09:08:00Z'
      },
      { contacts: [contact] }
    );
    const openTask = createTask(
      {
        id: 'task-2' as TaskId,
        title: 'Open task',
        dueDate: '2026-04-13',
        linkedEntityType: 'Company',
        linkedEntityId: company.id,
        now: '2026-04-12T09:09:00Z'
      },
      { companies: [company] }
    );
    const completedTask = completeTask(
      createTask(
        {
          id: 'task-3' as TaskId,
          title: 'Completed task',
          linkedEntityType: 'Contact',
          linkedEntityId: contact.id,
          now: '2026-04-12T09:10:00Z'
        },
        { contacts: [contact] }
      ),
      '2026-04-12T09:11:00Z'
    );

    expect(
      buildDashboardSummary({
        contacts: [contact],
        companies: [company],
        opportunities: [leadOpportunity, qualifiedOpportunity, wonOpportunity],
        tasks: [overdueTask, openTask, completedTask],
        currentDate: '2026-04-12'
      })
    ).toEqual({
      totalContacts: 1,
      totalCompanies: 1,
      openTaskCount: 2,
      overdueTaskCount: 1,
      opportunityCountByStage: {
        Lead: 1,
        Qualified: 1,
        Proposal: 0,
        Won: 0,
        Lost: 1
      },
      openPipelineAmount: 300
    });
  });
});
