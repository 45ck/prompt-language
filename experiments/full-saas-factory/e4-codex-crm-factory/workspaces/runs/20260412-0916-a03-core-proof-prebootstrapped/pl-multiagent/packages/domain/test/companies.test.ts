import { describe, expect, it } from 'vitest';

import { createCompany } from '../src/index.js';
import { expectDomainError } from './assert-domain-error.js';

describe('createCompany', () => {
  it('creates a company with the provided fields', () => {
    const company = createCompany({
      companyId: 'company-1',
      name: 'Acme Pty Ltd',
      domain: 'acme.example'
    });

    expect(company).toEqual({
      companyId: 'company-1',
      name: 'Acme Pty Ltd',
      domain: 'acme.example'
    });
  });

  it('rejects blank names', () => {
    expectDomainError(
      () =>
        createCompany({
          companyId: 'company-2',
          name: '   '
        }),
      'validation_error'
    );
  });
});
