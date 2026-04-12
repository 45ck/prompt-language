import { randomUUID } from 'node:crypto';

import {
  DomainError,
  buildDashboardSummary,
  cancelTask,
  completeTask,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  renameCompany,
  transitionOpportunityStage,
  updateContactCompany,
} from '../../domain/src/index.js';
import type {
  Company,
  CompanyId,
  Contact,
  ContactId,
  DashboardSummary,
  EntityRef,
  Note,
  NoteId,
  Opportunity,
  OpportunityId,
  OpportunityStage,
  Task,
  TaskId,
} from '../../domain/src/index.js';

export { DomainError };
export type {
  Company,
  CompanyId,
  Contact,
  ContactId,
  DashboardSummary,
  EntityRef,
  Note,
  NoteId,
  Opportunity,
  OpportunityId,
  OpportunityStage,
  Task,
  TaskId,
};

export type Clock = () => Date;
export type IdGenerator = () => string;

export type ApiErrorCode = 'CONFLICT' | 'NOT_FOUND';

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

function assertFound<T>(value: T | undefined, message: string, details?: Record<string, unknown>): T {
  if (value === undefined) {
    throw new ApiError('NOT_FOUND', message, details);
  }
  return value;
}

function assertNoConflict(condition: boolean, message: string, details?: Record<string, unknown>): void {
  if (!condition) {
    throw new ApiError('CONFLICT', message, details);
  }
}

export interface CrmApiDeps {
  readonly now: Clock;
  readonly generateId: IdGenerator;
}

export interface CreateCompanyRequest {
  readonly name: string;
  readonly domain?: string | undefined;
}

export interface CreateContactRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string | undefined;
  readonly companyId?: CompanyId | undefined;
}

export interface CreateOpportunityRequest {
  readonly companyId: CompanyId;
  readonly primaryContactId?: ContactId | undefined;
  readonly title: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly stage?: OpportunityStage | undefined;
}

export interface CreateTaskRequest {
  readonly title: string;
  readonly dueAt?: Date | undefined;
  readonly related?: EntityRef | undefined;
}

export interface AddNoteRequest {
  readonly body: string;
  readonly related: EntityRef;
}

export interface CrmApi {
  // Companies
  createCompany(input: CreateCompanyRequest): Company;
  renameCompany(companyId: CompanyId, name: string): Company;
  listCompanies(): readonly Company[];
  getCompany(companyId: CompanyId): Company;

  // Contacts
  createContact(input: CreateContactRequest): Contact;
  setContactCompany(contactId: ContactId, companyId?: CompanyId | undefined): Contact;
  listContacts(): readonly Contact[];
  getContact(contactId: ContactId): Contact;

  // Opportunities
  createOpportunity(input: CreateOpportunityRequest): Opportunity;
  transitionOpportunityStage(opportunityId: OpportunityId, toStage: OpportunityStage): Opportunity;
  listOpportunities(): readonly Opportunity[];
  getOpportunity(opportunityId: OpportunityId): Opportunity;

  // Tasks
  createTask(input: CreateTaskRequest): Task;
  completeTask(taskId: TaskId): Task;
  cancelTask(taskId: TaskId): Task;
  listTasks(): readonly Task[];
  getTask(taskId: TaskId): Task;

  // Notes
  addNote(input: AddNoteRequest): Note;
  listNotes(): readonly Note[];
  getNote(noteId: NoteId): Note;

  // Dashboard
  getDashboardSummary(at?: Date | undefined): DashboardSummary;
}

export function createCrmApi(overrides: Partial<CrmApiDeps> = {}): CrmApi {
  const deps: CrmApiDeps = {
    now: overrides.now ?? (() => new Date()),
    generateId: overrides.generateId ?? (() => randomUUID()),
  };

  const companies = new Map<CompanyId, Company>();
  const contacts = new Map<ContactId, Contact>();
  const opportunities = new Map<OpportunityId, Opportunity>();
  const tasks = new Map<TaskId, Task>();
  const notes = new Map<NoteId, Note>();

  const nextId = (prefix: string): string => `${prefix}_${deps.generateId()}`;

  const requireCompany = (companyId: CompanyId): Company =>
    assertFound(companies.get(companyId), 'company not found', { companyId });
  const requireContact = (contactId: ContactId): Contact =>
    assertFound(contacts.get(contactId), 'contact not found', { contactId });
  const requireOpportunity = (opportunityId: OpportunityId): Opportunity =>
    assertFound(opportunities.get(opportunityId), 'opportunity not found', { opportunityId });
  const requireTask = (taskId: TaskId): Task =>
    assertFound(tasks.get(taskId), 'task not found', { taskId });
  const requireNote = (noteId: NoteId): Note => assertFound(notes.get(noteId), 'note not found', { noteId });

  const ensureEntityExists = (ref: EntityRef): void => {
    if (ref.type === 'company') {
      requireCompany(ref.id);
      return;
    }
    if (ref.type === 'contact') {
      requireContact(ref.id);
      return;
    }
    requireOpportunity(ref.id);
  };

  const listByCreatedAtAsc = <T extends { createdAt: Date; id: string }>(items: Iterable<T>): readonly T[] =>
    [...items].sort((a, b) => {
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });

  return {
    createCompany(input) {
      const at = deps.now();
      const company = createCompany({
        id: nextId('company'),
        name: input.name,
        domain: input.domain,
        at,
      });
      companies.set(company.id, company);
      return company;
    },

    renameCompany(companyId, name) {
      const company = requireCompany(companyId);
      const updated = renameCompany({ company, name, at: deps.now() });
      companies.set(updated.id, updated);
      return updated;
    },

    listCompanies() {
      return listByCreatedAtAsc(companies.values());
    },

    getCompany(companyId) {
      return requireCompany(companyId);
    },

    createContact(input) {
      if (input.companyId !== undefined) {
        requireCompany(input.companyId);
      }

      const at = deps.now();
      const contact = createContact({
        id: nextId('contact'),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        companyId: input.companyId,
        at,
      });
      contacts.set(contact.id, contact);
      return contact;
    },

    setContactCompany(contactId, companyId) {
      const contact = requireContact(contactId);
      if (companyId !== undefined) {
        requireCompany(companyId);
      }
      const updated = updateContactCompany({ contact, companyId, at: deps.now() });
      contacts.set(updated.id, updated);
      return updated;
    },

    listContacts() {
      return listByCreatedAtAsc(contacts.values());
    },

    getContact(contactId) {
      return requireContact(contactId);
    },

    createOpportunity(input) {
      requireCompany(input.companyId);
      if (input.primaryContactId !== undefined) {
        const contact = requireContact(input.primaryContactId);
        if (contact.companyId !== undefined) {
          assertNoConflict(
            contact.companyId === input.companyId,
            'primary contact belongs to a different company',
            { contactId: contact.id, contactCompanyId: contact.companyId, opportunityCompanyId: input.companyId },
          );
        }
      }

      const at = deps.now();
      const opportunity = createOpportunity({
        id: nextId('opportunity'),
        companyId: input.companyId,
        primaryContactId: input.primaryContactId,
        title: input.title,
        amountCents: input.amountCents,
        currency: input.currency,
        stage: input.stage,
        at,
      });
      opportunities.set(opportunity.id, opportunity);
      return opportunity;
    },

    transitionOpportunityStage(opportunityId, toStage) {
      const opportunity = requireOpportunity(opportunityId);
      const updated = transitionOpportunityStage({ opportunity, toStage, at: deps.now() });
      opportunities.set(updated.id, updated);
      return updated;
    },

    listOpportunities() {
      return listByCreatedAtAsc(opportunities.values());
    },

    getOpportunity(opportunityId) {
      return requireOpportunity(opportunityId);
    },

    createTask(input) {
      if (input.related !== undefined) {
        ensureEntityExists(input.related);
      }
      const at = deps.now();
      const task = createTask({
        id: nextId('task'),
        title: input.title,
        dueAt: input.dueAt,
        related: input.related,
        at,
      });
      tasks.set(task.id, task);
      return task;
    },

    completeTask(taskId) {
      const task = requireTask(taskId);
      const updated = completeTask({ task, at: deps.now() });
      tasks.set(updated.id, updated);
      return updated;
    },

    cancelTask(taskId) {
      const task = requireTask(taskId);
      const updated = cancelTask({ task, at: deps.now() });
      tasks.set(updated.id, updated);
      return updated;
    },

    listTasks() {
      return listByCreatedAtAsc(tasks.values());
    },

    getTask(taskId) {
      return requireTask(taskId);
    },

    addNote(input) {
      ensureEntityExists(input.related);
      const at = deps.now();
      const note = createNote({
        id: nextId('note'),
        body: input.body,
        related: input.related,
        at,
      });
      notes.set(note.id, note);
      return note;
    },

    listNotes() {
      return listByCreatedAtAsc(notes.values());
    },

    getNote(noteId) {
      return requireNote(noteId);
    },

    getDashboardSummary(at) {
      const now = at ?? deps.now();
      return buildDashboardSummary({
        companies: [...companies.values()],
        contacts: [...contacts.values()],
        opportunities: [...opportunities.values()],
        tasks: [...tasks.values()],
        notes: [...notes.values()],
        now,
      });
    },
  };
}

