import { describe, expect, it } from 'vitest';

import { createContact } from '../src/index.js';
import { expectDomainError } from './assert-domain-error.js';

describe('createContact', () => {
  it('creates a contact with optional fields intact', () => {
    const contact = createContact({
      contactId: 'contact-1',
      fullName: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '0400 111 222',
      companyId: 'company-1'
    });

    expect(contact).toEqual({
      contactId: 'contact-1',
      fullName: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '0400 111 222',
      companyId: 'company-1'
    });
  });

  it('rejects blank full names', () => {
    expectDomainError(
      () =>
        createContact({
          contactId: 'contact-2',
          fullName: ' '
        }),
      'validation_error'
    );
  });
});
