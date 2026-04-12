import { describe, expect, it } from 'vitest';

import { createInMemoryCrmCoreApi } from '../src/index.js';
import { expectCrmError } from './assert-crm-error.js';

describe('in-memory CRM tasks, notes, and dashboard summaries', () => {
  it('stores tasks and notes, supports focused queries, and builds summary rollups', () => {
    const api = createInMemoryCrmCoreApi();
    const company = api.createCompany({
      name: 'Acme Pty Ltd'
    });
    const contact = api.createContact({
      fullName: 'Jordan Lee',
      companyId: company.companyId
    });
    const opportunity = api.createOpportunity({
      title: 'CRM rollout',
      amountCents: 125000,
      companyId: company.companyId,
      primaryContactId: contact.contactId
    });
    const contactTask = api.addTask({
      subject: 'Call Jordan',
      dueDate: '2026-04-10',
      contactId: contact.contactId
    });
    const openOpportunityTask = api.addTask({
      subject: 'Review pricing',
      dueDate: '2026-04-20',
      opportunityId: opportunity.opportunityId
    });
    const doneOpportunityTask = api.markTaskDone(openOpportunityTask.taskId);
    const opportunityNote = api.addNote({
      body: 'Strong champion in procurement.',
      opportunityId: opportunity.opportunityId
    });
    const contactNote = api.addNote({
      body: 'Prefers email follow-ups.',
      contactId: contact.contactId
    });

    expect(api.listTasks()).toEqual([contactTask, doneOpportunityTask]);
    expect(
      api.listTasks({
        contactId: contact.contactId
      })
    ).toEqual([contactTask]);
    expect(
      api.listTasks({
        status: 'Done'
      })
    ).toEqual([doneOpportunityTask]);
    expect(api.listNotes()).toEqual([opportunityNote, contactNote]);
    expect(
      api.listNotes({
        opportunityId: opportunity.opportunityId
      })
    ).toEqual([opportunityNote]);

    expect(
      api.getDashboardSummary({
        asOfDate: '2026-04-12'
      })
    ).toEqual({
      totals: {
        contacts: 1,
        companies: 1,
        opportunities: 1,
        tasks: 2,
        notes: 2
      },
      opportunitiesByStage: {
        Prospecting: 1,
        Qualified: 0,
        Proposal: 0,
        Negotiation: 0,
        ClosedWon: 0,
        ClosedLost: 0
      },
      openPipelineAmountCents: 125000,
      openTasksDueCount: 1
    });
  });

  it('rejects invalid targeting, missing parents, and malformed dashboard dates', () => {
    const api = createInMemoryCrmCoreApi();

    expectCrmError(
      () =>
        api.addTask({
          subject: 'Broken task'
        }),
      'VALIDATION_ERROR'
    );

    expectCrmError(
      () =>
        api.addTask({
          subject: 'Call the contact',
          contactId: 'contact-missing'
        }),
      'NOT_FOUND'
    );

    expectCrmError(
      () =>
        api.addNote({
          body: 'Missing opportunity',
          opportunityId: 'opportunity-missing'
        }),
      'NOT_FOUND'
    );

    expectCrmError(
      () =>
        api.getDashboardSummary({
          asOfDate: '2026-02-30'
        }),
      'VALIDATION_ERROR'
    );
  });
});
