import { describe, expect, it } from 'vitest';

import { createNote } from '../src/index.js';
import { expectDomainError } from './assert-domain-error.js';

describe('createNote', () => {
  it('creates a note for exactly one parent target', () => {
    const note = createNote({
      noteId: 'note-1',
      body: 'Confirmed budget and timeline.',
      opportunityId: 'opportunity-1'
    });

    expect(note).toEqual({
      noteId: 'note-1',
      body: 'Confirmed budget and timeline.',
      opportunityId: 'opportunity-1'
    });
  });

  it('rejects blank bodies and ambiguous targets', () => {
    expectDomainError(
      () =>
        createNote({
          noteId: 'note-2',
          body: ' ',
          contactId: 'contact-1'
        }),
      'validation_error'
    );

    expectDomainError(
      () =>
        createNote({
          noteId: 'note-3',
          body: 'This should fail.',
          contactId: 'contact-1',
          opportunityId: 'opportunity-1'
        }),
      'validation_error'
    );
  });
});
