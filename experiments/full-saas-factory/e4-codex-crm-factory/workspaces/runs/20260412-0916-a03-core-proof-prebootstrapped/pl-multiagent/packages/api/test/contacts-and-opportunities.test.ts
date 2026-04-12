import { describe, expect, it } from 'vitest';

import { createInMemoryCrmCoreApi } from '../src/index.js';
import { expectCrmError } from './assert-crm-error.js';

describe('in-memory CRM contact and opportunity services', () => {
  it('creates linked records with generated ids and deterministic snapshots', () => {
    const api = createInMemoryCrmCoreApi();
    const company = api.createCompany({
      name: 'Acme Pty Ltd',
      domain: 'acme.example'
    });
    const contact = api.createContact({
      fullName: 'Jordan Lee',
      email: 'jordan@example.com',
      companyId: company.companyId
    });
    const opportunity = api.createOpportunity({
      title: 'CRM rollout',
      amountCents: 125000,
      companyId: company.companyId,
      primaryContactId: contact.contactId
    });

    expect(company).toEqual({
      companyId: 'company-1',
      name: 'Acme Pty Ltd',
      domain: 'acme.example'
    });
    expect(contact).toEqual({
      contactId: 'contact-1',
      fullName: 'Jordan Lee',
      email: 'jordan@example.com',
      companyId: 'company-1'
    });
    expect(opportunity).toEqual({
      opportunityId: 'opportunity-1',
      title: 'CRM rollout',
      stage: 'Prospecting',
      amountCents: 125000,
      companyId: 'company-1',
      primaryContactId: 'contact-1'
    });

    expect(api.getCompany(company.companyId)).toEqual(company);
    expect(api.getContact(contact.contactId)).toEqual(contact);
    expect(api.getOpportunity(opportunity.opportunityId)).toEqual(opportunity);
    expect(api.listCompanies()).toEqual([company]);
    expect(api.listContacts()).toEqual([contact]);
    expect(api.listOpportunities()).toEqual([opportunity]);
  });

  it('rejects unknown linked records during creation', () => {
    const api = createInMemoryCrmCoreApi();

    expectCrmError(
      () =>
        api.createContact({
          fullName: 'Jordan Lee',
          companyId: 'company-missing'
        }),
      'NOT_FOUND'
    );

    expectCrmError(
      () =>
        api.createOpportunity({
          title: 'Expansion',
          amountCents: 90000,
          primaryContactId: 'contact-missing'
        }),
      'NOT_FOUND'
    );
  });
});
