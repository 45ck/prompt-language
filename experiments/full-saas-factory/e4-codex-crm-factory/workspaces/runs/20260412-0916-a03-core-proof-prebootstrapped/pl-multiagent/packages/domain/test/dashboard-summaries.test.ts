import { describe, expect, it } from 'vitest';

import {
  buildDashboardSummary,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask
} from '../src/index.js';

describe('buildDashboardSummary', () => {
  it('builds deterministic totals, stage counts, and due-task rollups', () => {
    const summary = buildDashboardSummary({
      asOfDate: '2026-04-12',
      companies: [
        createCompany({
          companyId: 'company-1',
          name: 'Acme Pty Ltd'
        })
      ],
      contacts: [
        createContact({
          contactId: 'contact-1',
          fullName: 'Jordan Lee',
          companyId: 'company-1'
        }),
        createContact({
          contactId: 'contact-2',
          fullName: 'Alex Chen'
        })
      ],
      opportunities: [
        createOpportunity({
          opportunityId: 'opportunity-1',
          title: 'New logo refresh',
          stage: 'Prospecting',
          amountCents: 100000
        }),
        createOpportunity({
          opportunityId: 'opportunity-2',
          title: 'Expansion deal',
          stage: 'Negotiation',
          amountCents: 250000
        }),
        createOpportunity({
          opportunityId: 'opportunity-3',
          title: 'Completed renewal',
          stage: 'ClosedWon',
          amountCents: 50000
        })
      ],
      tasks: [
        createTask({
          taskId: 'task-1',
          subject: 'Call Jordan',
          dueDate: '2026-04-10',
          contactId: 'contact-1'
        }),
        createTask({
          taskId: 'task-2',
          subject: 'Review pricing',
          dueDate: '2026-04-12',
          opportunityId: 'opportunity-2'
        }),
        createTask({
          taskId: 'task-3',
          subject: 'Future follow-up',
          dueDate: '2026-04-20',
          opportunityId: 'opportunity-1'
        }),
        createTask({
          taskId: 'task-4',
          subject: 'Already done',
          status: 'Done',
          dueDate: '2026-04-01',
          contactId: 'contact-2'
        }),
        createTask({
          taskId: 'task-5',
          subject: 'No due date yet',
          contactId: 'contact-2'
        })
      ],
      notes: [
        createNote({
          noteId: 'note-1',
          body: 'Strong champion in procurement.',
          opportunityId: 'opportunity-2'
        }),
        createNote({
          noteId: 'note-2',
          body: 'Requested a follow-up next week.',
          contactId: 'contact-1'
        })
      ]
    });

    expect(summary).toEqual({
      totals: {
        contacts: 2,
        companies: 1,
        opportunities: 3,
        tasks: 5,
        notes: 2
      },
      opportunitiesByStage: {
        Prospecting: 1,
        Qualified: 0,
        Proposal: 0,
        Negotiation: 1,
        ClosedWon: 1,
        ClosedLost: 0
      },
      openPipelineAmountCents: 350000,
      openTasksDueCount: 2
    });
  });
});
