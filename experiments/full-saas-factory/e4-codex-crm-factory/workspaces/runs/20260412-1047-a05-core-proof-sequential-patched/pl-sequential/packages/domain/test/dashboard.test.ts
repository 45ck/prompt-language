import {
  computeDashboardSummary,
  type Company,
  type Contact,
  type Note,
  type Opportunity,
  type Task
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('dashboard summary', () => {
  it('computes totals and stage/task breakdowns', () => {
    const companies: Company[] = [{ id: 'comp_1', name: 'Acme' }];
    const contacts: Contact[] = [{ id: 'con_1', displayName: 'Ada' }];
    const opportunities: Opportunity[] = [
      { id: 'opp_1', companyId: 'comp_1', title: 'Deal 1', stage: 'prospecting' },
      { id: 'opp_2', companyId: 'comp_1', title: 'Deal 2', stage: 'won' }
    ];
    const tasks: Task[] = [
      { id: 'task_1', opportunityId: 'opp_1', title: 'Call', status: 'open' },
      { id: 'task_2', opportunityId: 'opp_2', title: 'Send invoice', status: 'done' }
    ];
    const notes: Note[] = [
      { id: 'note_1', targetType: 'company', targetId: 'comp_1', body: 'A' },
      { id: 'note_2', targetType: 'opportunity', targetId: 'opp_1', body: 'B' }
    ];

    const summary = computeDashboardSummary({
      companies,
      contacts,
      opportunities,
      tasks,
      notes
    });

    expect(summary.companiesTotal).toBe(1);
    expect(summary.contactsTotal).toBe(1);
    expect(summary.opportunitiesTotal).toBe(2);
    expect(summary.opportunitiesByStage.prospecting).toBe(1);
    expect(summary.opportunitiesByStage.won).toBe(1);
    expect(summary.openOpportunitiesTotal).toBe(1);
    expect(summary.wonOpportunitiesTotal).toBe(1);
    expect(summary.lostOpportunitiesTotal).toBe(0);
    expect(summary.tasksOpenTotal).toBe(1);
    expect(summary.tasksDoneTotal).toBe(1);
    expect(summary.notesTotal).toBe(2);
  });
});
