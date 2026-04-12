import {
  CrmError,
  computeDashboardSummary,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  markTaskDone,
  moveOpportunityStage,
  type Company,
  type Contact,
  type DashboardSummary,
  type Note,
  type Opportunity,
  type OpportunityStage,
  type SubjectRef,
  type Task
} from '../../domain/src/index.js';

export type {
  Company,
  Contact,
  DashboardSummary,
  Note,
  Opportunity,
  OpportunityStage,
  SubjectRef,
  Task
} from '../../domain/src/index.js';
export { CrmError } from '../../domain/src/index.js';

function assertUniqueId(map: Map<string, unknown>, id: string, recordType: string): void {
  if (map.has(id)) {
    throw new CrmError('duplicate_id', `${recordType} id already exists`, { id, recordType });
  }
}

function assertExists(value: unknown, refType: string, id: string): void {
  if (value === undefined) {
    throw new CrmError('reference_not_found', `${refType} not found`, { refType, id });
  }
}

export class InMemoryCrmService {
  private readonly companies = new Map<string, Company>();
  private readonly contacts = new Map<string, Contact>();
  private readonly opportunities = new Map<string, Opportunity>();
  private readonly tasks = new Map<string, Task>();
  private readonly notes = new Map<string, Note>();

  createCompany(input: { id: string; name: string; now: string }): Company {
    const company = createCompany(input);
    assertUniqueId(this.companies, company.id, 'company');
    this.companies.set(company.id, company);
    return company;
  }

  createContact(input: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    companyId?: string;
    now: string;
  }): Contact {
    const contact = createContact(input);
    assertUniqueId(this.contacts, contact.id, 'contact');
    if (contact.companyId !== undefined) {
      assertExists(this.companies.get(contact.companyId), 'company', contact.companyId);
    }
    this.contacts.set(contact.id, contact);
    return contact;
  }

  createOpportunity(input: {
    id: string;
    companyId: string;
    name: string;
    amountCents: number;
    primaryContactId?: string;
    now: string;
  }): Opportunity {
    const opportunity = createOpportunity(input);
    assertUniqueId(this.opportunities, opportunity.id, 'opportunity');
    assertExists(this.companies.get(opportunity.companyId), 'company', opportunity.companyId);
    if (opportunity.primaryContactId !== undefined) {
      assertExists(this.contacts.get(opportunity.primaryContactId), 'contact', opportunity.primaryContactId);
    }
    this.opportunities.set(opportunity.id, opportunity);
    return opportunity;
  }

  moveOpportunityStage(input: { id: string; to: OpportunityStage; at: string }): Opportunity {
    const existing = this.opportunities.get(input.id);
    assertExists(existing, 'opportunity', input.id);

    const updated = moveOpportunityStage({ opportunity: existing, to: input.to, at: input.at });
    this.opportunities.set(updated.id, updated);
    return updated;
  }

  addTask(input: { id: string; subject: SubjectRef; title: string; dueOn: string; now: string }): Task {
    const task = createTask(input);
    assertUniqueId(this.tasks, task.id, 'task');
    this.assertSubjectExists(task.subject);
    this.tasks.set(task.id, task);
    return task;
  }

  markTaskDone(input: { id: string }): Task {
    const existing = this.tasks.get(input.id);
    assertExists(existing, 'task', input.id);
    const updated = markTaskDone(existing);
    this.tasks.set(updated.id, updated);
    return updated;
  }

  addNote(input: { id: string; subject: SubjectRef; body: string; now: string }): Note {
    const note = createNote(input);
    assertUniqueId(this.notes, note.id, 'note');
    this.assertSubjectExists(note.subject);
    this.notes.set(note.id, note);
    return note;
  }

  computeDashboardSummary(input: { today: string }): DashboardSummary {
    return computeDashboardSummary({
      companies: [...this.companies.values()],
      contacts: [...this.contacts.values()],
      opportunities: [...this.opportunities.values()],
      tasks: [...this.tasks.values()],
      today: input.today
    });
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  getContact(id: string): Contact | undefined {
    return this.contacts.get(id);
  }

  getOpportunity(id: string): Opportunity | undefined {
    return this.opportunities.get(id);
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getNote(id: string): Note | undefined {
    return this.notes.get(id);
  }

  private assertSubjectExists(subject: SubjectRef): void {
    if (subject.type === 'company') {
      assertExists(this.companies.get(subject.id), 'company', subject.id);
      return;
    }
    if (subject.type === 'contact') {
      assertExists(this.contacts.get(subject.id), 'contact', subject.id);
      return;
    }
    assertExists(this.opportunities.get(subject.id), 'opportunity', subject.id);
  }
}

