import {
  completeTask,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('domain entities', () => {
  it('validates and trims company name', () => {
    const result = createCompany({ id: 'comp_1', name: '  Acme  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toEqual({ id: 'comp_1', name: 'Acme' });
  });

  it('rejects empty company name', () => {
    const result = createCompany({ id: 'comp_1', name: '   ' });
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'validation',
        field: 'name',
        message: 'Company.name must be non-empty after trimming.'
      }
    });
  });

  it('validates and trims contact displayName and email', () => {
    const result = createContact({
      id: 'con_1',
      displayName: '  Ada Lovelace  ',
      email: 'ada@example.com',
      companyId: 'comp_1'
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toEqual({
      id: 'con_1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      companyId: 'comp_1'
    });
  });

  it('rejects contact email without @', () => {
    const result = createContact({
      id: 'con_1',
      displayName: 'Ada',
      email: 'invalid-email'
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.type).toBe('validation');
  });

  it('creates opportunities at prospecting and validates amount/title', () => {
    const okResult = createOpportunity({
      id: 'opp_1',
      companyId: 'comp_1',
      title: '  Website redesign  ',
      amount: 10_000
    });
    expect(okResult.ok).toBe(true);
    if (!okResult.ok) throw new Error('expected ok');
    expect(okResult.value.stage).toBe('prospecting');
    expect(okResult.value.title).toBe('Website redesign');

    const badAmount = createOpportunity({
      id: 'opp_2',
      companyId: 'comp_1',
      title: 'Deal',
      amount: -1
    });
    expect(badAmount.ok).toBe(false);

    const badTitle = createOpportunity({
      id: 'opp_3',
      companyId: 'comp_1',
      title: '   '
    });
    expect(badTitle.ok).toBe(false);
  });

  it('creates tasks as open and can complete them', () => {
    const created = createTask({
      id: 'task_1',
      opportunityId: 'opp_1',
      title: '  Call customer  '
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('expected ok');
    expect(created.value.status).toBe('open');
    expect(created.value.title).toBe('Call customer');

    const completed = completeTask(created.value);
    expect(completed.status).toBe('done');
  });

  it('validates note body and trims it', () => {
    const okResult = createNote({
      id: 'note_1',
      targetType: 'opportunity',
      targetId: 'opp_1',
      body: '  Important details  '
    });
    expect(okResult.ok).toBe(true);
    if (!okResult.ok) throw new Error('expected ok');
    expect(okResult.value.body).toBe('Important details');

    const badResult = createNote({
      id: 'note_2',
      targetType: 'opportunity',
      targetId: 'opp_1',
      body: '   '
    });
    expect(badResult.ok).toBe(false);
  });
});
