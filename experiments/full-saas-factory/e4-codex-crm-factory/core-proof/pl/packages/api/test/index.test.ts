import { describe, expect, it } from 'vitest';

import {
  EntityNotFoundError,
  createInMemoryCrmServices,
  type CalendarDate,
  type Clock,
  type CompanyId,
  type ContactId,
  type NoteId,
  type OpportunityId,
  type TaskId,
  type Timestamp
} from '../src/index.js';

function createClock(
  nowValues: readonly string[],
  today: CalendarDate = '2026-04-12'
): Clock {
  let nextIndex = 0;

  return {
    now() {
      const nextValue = nowValues[nextIndex];

      if (nextValue === undefined) {
        throw new Error('Clock exhausted.');
      }

      nextIndex += 1;
      return nextValue as Timestamp;
    },
    today() {
      return today;
    }
  };
}

describe('in-memory crm services', () => {
  it('creates contacts and opportunities against stored company state', () => {
    const services = createInMemoryCrmServices(
      createClock([
        '2026-04-12T09:00:00Z',
        '2026-04-12T09:01:00Z',
        '2026-04-12T09:02:00Z'
      ])
    );

    const company = services.companies.create({
      id: 'company-1' as CompanyId,
      name: 'Acme'
    });
    const contact = services.contacts.create({
      id: 'contact-1' as ContactId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: ' ADA@example.com ',
      companyId: company.id
    });
    const opportunity = services.opportunities.create({
      id: 'opportunity-1' as OpportunityId,
      name: 'CRM Renewal',
      companyId: company.id,
      primaryContactId: contact.id,
      amount: 12_000
    });

    expect(contact.createdAt).toBe('2026-04-12T09:01:00Z');
    expect(contact.email).toBe('ada@example.com');
    expect(services.contacts.list({ search: 'lovelace' })).toEqual([contact]);
    expect(opportunity.stage).toBe('Lead');
    expect(services.opportunities.list({ search: 'renew' })).toEqual([
      opportunity
    ]);
  });

  it('moves opportunity stages inside the in-memory store', () => {
    const services = createInMemoryCrmServices(
      createClock([
        '2026-04-12T09:00:00Z',
        '2026-04-12T09:01:00Z',
        '2026-04-12T09:02:00Z'
      ])
    );

    const company = services.companies.create({
      id: 'company-1' as CompanyId,
      name: 'Acme'
    });
    const opportunity = services.opportunities.create({
      id: 'opportunity-1' as OpportunityId,
      name: 'Pipeline Deal',
      companyId: company.id
    });

    const qualifiedOpportunity = services.opportunities.moveStage(
      opportunity.id,
      'Qualified'
    );

    expect(qualifiedOpportunity.updatedAt).toBe('2026-04-12T09:02:00Z');
    expect(services.opportunities.get(opportunity.id)?.stage).toBe('Qualified');
    expect(services.opportunities.list({ stage: 'Qualified' })).toEqual([
      qualifiedOpportunity
    ]);
    expect(() =>
      services.opportunities.moveStage(
        'opportunity-missing' as OpportunityId,
        'Qualified'
      )
    ).toThrow(EntityNotFoundError);
  });

  it('adds tasks and notes linked to stored crm records', () => {
    const services = createInMemoryCrmServices(
      createClock([
        '2026-04-12T09:00:00Z',
        '2026-04-12T09:01:00Z',
        '2026-04-12T09:02:00Z',
        '2026-04-12T09:03:00Z',
        '2026-04-12T09:04:00Z'
      ])
    );

    const company = services.companies.create({
      id: 'company-1' as CompanyId,
      name: 'Acme'
    });
    const opportunity = services.opportunities.create({
      id: 'opportunity-1' as OpportunityId,
      name: 'Expansion',
      companyId: company.id
    });
    const task = services.tasks.create({
      id: 'task-1' as TaskId,
      title: 'Schedule follow-up',
      dueDate: '2026-04-15',
      linkedEntityType: 'Opportunity',
      linkedEntityId: opportunity.id
    });
    services.notes.create({
      id: 'note-1' as NoteId,
      body: 'Initial discovery complete.',
      linkedEntityType: 'Opportunity',
      linkedEntityId: opportunity.id
    });
    services.notes.create({
      id: 'note-2' as NoteId,
      body: 'Demo booked for next week.',
      linkedEntityType: 'Opportunity',
      linkedEntityId: opportunity.id
    });

    expect(
      services.tasks.list({
        linkedEntityType: 'Opportunity',
        linkedEntityId: opportunity.id
      })
    ).toEqual([task]);
    expect(
      services
        .notes
        .listForEntity({
          linkedEntityType: 'Opportunity',
          linkedEntityId: opportunity.id
        })
        .map((note) => note.id)
    ).toEqual(['note-2', 'note-1']);
  });

  it('computes dashboard summaries from the current in-memory state', () => {
    const services = createInMemoryCrmServices(
      createClock(
        [
          '2026-04-12T09:00:00Z',
          '2026-04-12T09:01:00Z',
          '2026-04-12T09:02:00Z',
          '2026-04-12T09:03:00Z',
          '2026-04-12T09:04:00Z',
          '2026-04-12T09:05:00Z',
          '2026-04-12T09:06:00Z',
          '2026-04-12T09:07:00Z',
          '2026-04-12T09:08:00Z',
          '2026-04-12T09:09:00Z'
        ],
        '2026-04-12'
      )
    );

    const company = services.companies.create({
      id: 'company-1' as CompanyId,
      name: 'Acme'
    });
    const contact = services.contacts.create({
      id: 'contact-1' as ContactId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      companyId: company.id
    });
    services.opportunities.create({
      id: 'opportunity-1' as OpportunityId,
      name: 'Lead deal',
      companyId: company.id,
      amount: 100
    });
    const proposalOpportunity = services.opportunities.moveStage(
      services.opportunities.create({
        id: 'opportunity-2' as OpportunityId,
        name: 'Proposal deal',
        companyId: company.id,
        amount: 200
      }).id,
      'Qualified'
    );
    services.opportunities.moveStage(proposalOpportunity.id, 'Proposal');
    services.opportunities.moveStage(
      services.opportunities.create({
        id: 'opportunity-3' as OpportunityId,
        name: 'Lost deal',
        companyId: company.id,
        amount: 500
      }).id,
      'Lost'
    );
    services.tasks.create({
      id: 'task-1' as TaskId,
      title: 'Overdue call',
      dueDate: '2026-04-10',
      linkedEntityType: 'Contact',
      linkedEntityId: contact.id
    });
    services.tasks.create({
      id: 'task-2' as TaskId,
      title: 'Future follow-up',
      dueDate: '2026-04-14',
      linkedEntityType: 'Company',
      linkedEntityId: company.id
    });

    expect(services.dashboard.getSummary()).toEqual({
      totalContacts: 1,
      totalCompanies: 1,
      openTaskCount: 2,
      overdueTaskCount: 1,
      opportunityCountByStage: {
        Lead: 1,
        Qualified: 0,
        Proposal: 1,
        Won: 0,
        Lost: 1
      },
      openPipelineAmount: 300
    });
  });
});
