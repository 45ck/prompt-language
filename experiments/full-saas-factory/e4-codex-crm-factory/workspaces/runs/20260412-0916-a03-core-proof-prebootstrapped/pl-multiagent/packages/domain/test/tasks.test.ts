import { describe, expect, it } from 'vitest';

import { createTask, markTaskDone } from '../src/index.js';
import { expectDomainError } from './assert-domain-error.js';

describe('tasks', () => {
  it('creates an open task for a single parent target', () => {
    const task = createTask({
      taskId: 'task-1',
      subject: 'Call the decision maker',
      dueDate: '2026-04-15',
      contactId: 'contact-1'
    });

    expect(task).toEqual({
      taskId: 'task-1',
      subject: 'Call the decision maker',
      status: 'Open',
      dueDate: '2026-04-15',
      contactId: 'contact-1'
    });
  });

  it('marks a task done without changing other fields', () => {
    const task = createTask({
      taskId: 'task-2',
      subject: 'Prepare proposal',
      opportunityId: 'opportunity-1'
    });

    expect(markTaskDone(task)).toEqual({
      ...task,
      status: 'Done'
    });
  });

  it('rejects invalid targeting and invalid dates', () => {
    expectDomainError(
      () =>
        createTask({
          taskId: 'task-3',
          subject: 'Broken task'
        }),
      'validation_error'
    );

    expectDomainError(
      () =>
        createTask({
          taskId: 'task-4',
          subject: 'Also broken',
          dueDate: '2026-02-30',
          opportunityId: 'opportunity-1'
        }),
      'validation_error'
    );
  });
});
