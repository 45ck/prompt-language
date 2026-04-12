import {
  DomainError,
  type Company,
  type CompanyId,
  type Contact,
  type ContactId,
  type DashboardSummary,
  type Note,
  type NoteId,
  type NoteRelatedTo,
  type Opportunity,
  type OpportunityId,
  type OpportunityStage,
  type Task,
  type TaskId,
  type TaskRelatedTo,
  type TimestampMs,
  buildDashboardSummary,
  companyId,
  contactId,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  noteId,
  opportunityId,
  taskId,
  transitionOpportunityStage,
  updateCompany,
  updateContact,
  updateNote,
  updateOpportunity,
  completeTask
} from '../../domain/src/index.js';

export * from '../../domain/src/index.js';

export type ApiErrorCode = 'NOT_FOUND' | 'BAD_REQUEST';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export type InMemoryCrmApiOptions = {
  readonly now?: () => TimestampMs;
};

export type CrmApi = {
  readonly createCompany: (input: { name: string; domain?: string }) => Company;
  readonly updateCompany: (id: CompanyId, patch: { name?: string; domain?: string | null }) => Company;
  readonly getCompany: (id: CompanyId) => Company;
  readonly listCompanies: () => Company[];

  readonly createContact: (input: { name: string; email?: string; phone?: string; companyId?: CompanyId }) => Contact;
  readonly updateContact: (
    id: ContactId,
    patch: { name?: string; email?: string | null; phone?: string | null; companyId?: CompanyId | null }
  ) => Contact;
  readonly getContact: (id: ContactId) => Contact;
  readonly listContacts: (filter?: { companyId?: CompanyId }) => Contact[];

  readonly createOpportunity: (input: {
    companyId: CompanyId;
    title: string;
    valueCents: number;
    currency?: string;
    stage?: OpportunityStage;
    primaryContactId?: ContactId;
  }) => Opportunity;
  readonly updateOpportunity: (
    id: OpportunityId,
    patch: { title?: string; valueCents?: number; primaryContactId?: ContactId | null }
  ) => Opportunity;
  readonly transitionOpportunityStage: (id: OpportunityId, to: OpportunityStage, reason?: string) => Opportunity;
  readonly getOpportunity: (id: OpportunityId) => Opportunity;
  readonly listOpportunities: (filter?: { companyId?: CompanyId }) => Opportunity[];

  readonly createTask: (input: { subject: string; dueAt?: TimestampMs; relatedTo?: TaskRelatedTo }) => Task;
  readonly completeTask: (id: TaskId) => Task;
  readonly getTask: (id: TaskId) => Task;
  readonly listTasks: (filter?: { status?: 'Open' | 'Completed'; relatedTo?: TaskRelatedTo }) => Task[];

  readonly createNote: (input: { body: string; relatedTo: NoteRelatedTo }) => Note;
  readonly updateNote: (id: NoteId, patch: { body: string }) => Note;
  readonly getNote: (id: NoteId) => Note;
  readonly listNotes: (filter?: { relatedTo?: NoteRelatedTo }) => Note[];

  readonly getDashboardSummary: () => DashboardSummary;
};

export function createInMemoryCrmApi(options: InMemoryCrmApiOptions = {}): CrmApi {
  const now = options.now ?? (() => Date.now());

  const companies = new Map<CompanyId, Company>();
  const contacts = new Map<ContactId, Contact>();
  const opportunities = new Map<OpportunityId, Opportunity>();
  const tasks = new Map<TaskId, Task>();
  const notes = new Map<NoteId, Note>();

  const ids = {
    company: 0,
    contact: 0,
    opportunity: 0,
    task: 0,
    note: 0
  };

  function nextCompanyId(): CompanyId {
    ids.company += 1;
    return companyId(`com_${ids.company}`);
  }

  function nextContactId(): ContactId {
    ids.contact += 1;
    return contactId(`con_${ids.contact}`);
  }

  function nextOpportunityId(): OpportunityId {
    ids.opportunity += 1;
    return opportunityId(`opp_${ids.opportunity}`);
  }

  function nextTaskId(): TaskId {
    ids.task += 1;
    return taskId(`tsk_${ids.task}`);
  }

  function nextNoteId(): NoteId {
    ids.note += 1;
    return noteId(`note_${ids.note}`);
  }

  function requireCompany(id: CompanyId): Company {
    const company = companies.get(id);
    if (company === undefined) throw new ApiError('NOT_FOUND', `Company not found: ${id}`, { id });
    return company;
  }

  function requireContact(id: ContactId): Contact {
    const contact = contacts.get(id);
    if (contact === undefined) throw new ApiError('NOT_FOUND', `Contact not found: ${id}`, { id });
    return contact;
  }

  function requireOpportunity(id: OpportunityId): Opportunity {
    const opportunity = opportunities.get(id);
    if (opportunity === undefined) throw new ApiError('NOT_FOUND', `Opportunity not found: ${id}`, { id });
    return opportunity;
  }

  function requireTask(id: TaskId): Task {
    const task = tasks.get(id);
    if (task === undefined) throw new ApiError('NOT_FOUND', `Task not found: ${id}`, { id });
    return task;
  }

  function requireNote(id: NoteId): Note {
    const note = notes.get(id);
    if (note === undefined) throw new ApiError('NOT_FOUND', `Note not found: ${id}`, { id });
    return note;
  }

  function assertRelatedExists(relatedTo: TaskRelatedTo | NoteRelatedTo): void {
    switch (relatedTo.type) {
      case 'company':
        requireCompany(relatedTo.id);
        return;
      case 'contact':
        requireContact(relatedTo.id);
        return;
      case 'opportunity':
        requireOpportunity(relatedTo.id);
        return;
      case 'task':
        requireTask(relatedTo.id);
        return;
      default: {
        const exhaustive: never = relatedTo;
        throw new ApiError('BAD_REQUEST', `Unsupported relatedTo type`, { exhaustive });
      }
    }
  }

  function wrapDomain<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof DomainError) {
        throw new ApiError('BAD_REQUEST', error.message, { domainCode: error.code, domainDetails: error.details });
      }
      throw error;
    }
  }

  function byCreatedAtThenId<T extends { createdAt: TimestampMs; id: string }>(a: T, b: T): number {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id.localeCompare(b.id);
  }

  return {
    createCompany: (input) =>
      wrapDomain(() => {
        const entity = createCompany({ id: nextCompanyId(), name: input.name, domain: input.domain, now: now() });
        companies.set(entity.id, entity);
        return entity;
      }),
    updateCompany: (id, patch) =>
      wrapDomain(() => {
        const updated = updateCompany(requireCompany(id), patch, now());
        companies.set(updated.id, updated);
        return updated;
      }),
    getCompany: (id) => requireCompany(id),
    listCompanies: () => [...companies.values()].sort(byCreatedAtThenId),

    createContact: (input) =>
      wrapDomain(() => {
        if (input.companyId !== undefined) requireCompany(input.companyId);
        const entity = createContact({
          id: nextContactId(),
          name: input.name,
          email: input.email,
          phone: input.phone,
          companyId: input.companyId,
          now: now()
        });
        contacts.set(entity.id, entity);
        return entity;
      }),
    updateContact: (id, patch) =>
      wrapDomain(() => {
        if (patch.companyId !== undefined && patch.companyId !== null) requireCompany(patch.companyId);
        const updated = updateContact(requireContact(id), patch, now());
        contacts.set(updated.id, updated);
        return updated;
      }),
    getContact: (id) => requireContact(id),
    listContacts: (filter) => {
      const all = [...contacts.values()];
      const filtered = filter?.companyId === undefined ? all : all.filter((c) => c.companyId === filter.companyId);
      return filtered.sort(byCreatedAtThenId);
    },

    createOpportunity: (input) =>
      wrapDomain(() => {
        requireCompany(input.companyId);
        if (input.primaryContactId !== undefined) {
          const contact = requireContact(input.primaryContactId);
          if (contact.companyId !== undefined && contact.companyId !== input.companyId) {
            throw new ApiError('BAD_REQUEST', `Primary contact companyId does not match opportunity companyId`, {
              contactId: contact.id,
              contactCompanyId: contact.companyId,
              companyId: input.companyId
            });
          }
        }

        const entity = createOpportunity({
          id: nextOpportunityId(),
          companyId: input.companyId,
          primaryContactId: input.primaryContactId,
          title: input.title,
          valueCents: input.valueCents,
          currency: input.currency,
          stage: input.stage,
          now: now()
        });
        opportunities.set(entity.id, entity);
        return entity;
      }),
    updateOpportunity: (id, patch) =>
      wrapDomain(() => {
        const existing = requireOpportunity(id);
        if (patch.primaryContactId !== undefined && patch.primaryContactId !== null) {
          const contact = requireContact(patch.primaryContactId);
          if (contact.companyId !== undefined && contact.companyId !== existing.companyId) {
            throw new ApiError('BAD_REQUEST', `Primary contact companyId does not match opportunity companyId`, {
              contactId: contact.id,
              contactCompanyId: contact.companyId,
              companyId: existing.companyId
            });
          }
        }
        const updated = updateOpportunity(existing, patch, now());
        opportunities.set(updated.id, updated);
        return updated;
      }),
    transitionOpportunityStage: (id, to, reason) =>
      wrapDomain(() => {
        const updated = transitionOpportunityStage(requireOpportunity(id), to, now(), reason);
        opportunities.set(updated.id, updated);
        return updated;
      }),
    getOpportunity: (id) => requireOpportunity(id),
    listOpportunities: (filter) => {
      const all = [...opportunities.values()];
      const filtered = filter?.companyId === undefined ? all : all.filter((o) => o.companyId === filter.companyId);
      return filtered.sort(byCreatedAtThenId);
    },

    createTask: (input) =>
      wrapDomain(() => {
        if (input.relatedTo !== undefined) assertRelatedExists(input.relatedTo);
        const entity = createTask({
          id: nextTaskId(),
          subject: input.subject,
          dueAt: input.dueAt,
          relatedTo: input.relatedTo,
          now: now()
        });
        tasks.set(entity.id, entity);
        return entity;
      }),
    completeTask: (id) =>
      wrapDomain(() => {
        const updated = completeTask(requireTask(id), now());
        tasks.set(updated.id, updated);
        return updated;
      }),
    getTask: (id) => requireTask(id),
    listTasks: (filter) => {
      const all = [...tasks.values()];
      const filtered = all.filter((t) => {
        if (filter?.status !== undefined && t.status !== filter.status) return false;
        if (filter?.relatedTo !== undefined) {
          if (t.relatedTo === undefined) return false;
          if (t.relatedTo.type !== filter.relatedTo.type) return false;
          return t.relatedTo.id === filter.relatedTo.id;
        }
        return true;
      });
      return filtered.sort(byCreatedAtThenId);
    },

    createNote: (input) =>
      wrapDomain(() => {
        assertRelatedExists(input.relatedTo);
        const entity = createNote({ id: nextNoteId(), body: input.body, relatedTo: input.relatedTo, now: now() });
        notes.set(entity.id, entity);
        return entity;
      }),
    updateNote: (id, patch) =>
      wrapDomain(() => {
        const updated = updateNote(requireNote(id), patch, now());
        notes.set(updated.id, updated);
        return updated;
      }),
    getNote: (id) => requireNote(id),
    listNotes: (filter) => {
      const all = [...notes.values()];
      const relatedTo = filter?.relatedTo;
      const filtered =
        relatedTo === undefined
          ? all
          : all.filter((n) => n.relatedTo.type === relatedTo.type && n.relatedTo.id === relatedTo.id);
      return filtered.sort(byCreatedAtThenId);
    },

    getDashboardSummary: () =>
      buildDashboardSummary({
        now: now(),
        contacts: [...contacts.values()],
        companies: [...companies.values()],
        opportunities: [...opportunities.values()],
        tasks: [...tasks.values()],
        notes: [...notes.values()]
      })
  };
}
