import {
  type Company,
  type Contact,
  CrmError,
  type DashboardSummary,
  type Id,
  type IsoTimestamp,
  type Note,
  type Opportunity,
  type OpportunityStage,
  type SubjectRef,
  type Task,
  completeTask as completeTaskDomain,
  computeDashboardSummary,
  createCompany as createCompanyDomain,
  createContact as createContactDomain,
  createNote as createNoteDomain,
  createOpportunity as createOpportunityDomain,
  createTask as createTaskDomain,
  moveOpportunityStage as moveOpportunityStageDomain,
} from '../../domain/src/index.ts';

export type GenerateId = () => string;

export type CreateCrmServiceInput = {
  generateId: GenerateId;
};

type State = {
  companies: Map<Id, Company>;
  contacts: Map<Id, Contact>;
  opportunities: Map<Id, Opportunity>;
  tasks: Map<Id, Task>;
  notes: Map<Id, Note>;
};

function snapshotState(state: State) {
  return {
    companies: Array.from(state.companies.values()),
    contacts: Array.from(state.contacts.values()),
    opportunities: Array.from(state.opportunities.values()),
    tasks: Array.from(state.tasks.values()),
    notes: Array.from(state.notes.values()),
  };
}

function cloneCompany(company: Company): Company {
  return { ...company };
}

function cloneContact(contact: Contact): Contact {
  return { ...contact };
}

function cloneOpportunity(opportunity: Opportunity): Opportunity {
  return { ...opportunity };
}

function cloneTask(task: Task): Task {
  return { ...task, subject: { ...task.subject } };
}

function cloneNote(note: Note): Note {
  return { ...note, subject: { ...note.subject } };
}

function assertExists(state: State, subject: SubjectRef): void {
  if (subject.type === 'company') {
    if (!state.companies.has(subject.id)) {
      throw new CrmError('not-found', 'Company not found.', { resource: 'company', id: subject.id });
    }
    return;
  }

  if (subject.type === 'contact') {
    if (!state.contacts.has(subject.id)) {
      throw new CrmError('not-found', 'Contact not found.', { resource: 'contact', id: subject.id });
    }
    return;
  }

  if (!state.opportunities.has(subject.id)) {
    throw new CrmError('not-found', 'Opportunity not found.', {
      resource: 'opportunity',
      id: subject.id,
    });
  }
}

export function createCrmService(input: CreateCrmServiceInput) {
  const state: State = {
    companies: new Map(),
    contacts: new Map(),
    opportunities: new Map(),
    tasks: new Map(),
    notes: new Map(),
  };

  return {
    createCompany(args: { name: string; now: IsoTimestamp }): Company {
      const company = createCompanyDomain({
        id: input.generateId(),
        name: args.name,
        createdAt: args.now,
      });
      state.companies.set(company.id, company);
      return cloneCompany(company);
    },

    createContact(args: {
      displayName: string;
      email?: string;
      companyId?: Id;
      now: IsoTimestamp;
    }): Contact {
      if (args.companyId !== undefined && !state.companies.has(args.companyId)) {
        throw new CrmError('not-found', 'Company not found.', {
          resource: 'company',
          id: args.companyId,
        });
      }

      const contact = createContactDomain({
        id: input.generateId(),
        displayName: args.displayName,
        email: args.email,
        companyId: args.companyId,
        createdAt: args.now,
      });
      state.contacts.set(contact.id, contact);
      return cloneContact(contact);
    },

    createOpportunity(args: {
      companyId: Id;
      primaryContactId?: Id;
      title: string;
      amountCents: number;
      currency: string;
      now: IsoTimestamp;
    }): Opportunity {
      if (!state.companies.has(args.companyId)) {
        throw new CrmError('not-found', 'Company not found.', {
          resource: 'company',
          id: args.companyId,
        });
      }
      if (args.primaryContactId !== undefined && !state.contacts.has(args.primaryContactId)) {
        throw new CrmError('not-found', 'Contact not found.', {
          resource: 'contact',
          id: args.primaryContactId,
        });
      }

      const opportunity = createOpportunityDomain({
        id: input.generateId(),
        companyId: args.companyId,
        primaryContactId: args.primaryContactId,
        title: args.title,
        amountCents: args.amountCents,
        currency: args.currency,
        createdAt: args.now,
      });

      state.opportunities.set(opportunity.id, opportunity);
      return cloneOpportunity(opportunity);
    },

    moveOpportunityStage(args: {
      opportunityId: Id;
      toStage: OpportunityStage;
      now: IsoTimestamp;
    }): Opportunity {
      const existing = state.opportunities.get(args.opportunityId);
      if (!existing) {
        throw new CrmError('not-found', 'Opportunity not found.', {
          resource: 'opportunity',
          id: args.opportunityId,
        });
      }

      const updated = moveOpportunityStageDomain(existing, args.toStage, args.now);
      state.opportunities.set(updated.id, updated);
      return cloneOpportunity(updated);
    },

    addTask(args: { subject: SubjectRef; title: string; dueAt?: IsoTimestamp; now: IsoTimestamp }): Task {
      assertExists(state, args.subject);

      const task = createTaskDomain({
        id: input.generateId(),
        subject: args.subject,
        title: args.title,
        dueAt: args.dueAt,
        createdAt: args.now,
      });
      state.tasks.set(task.id, task);
      return cloneTask(task);
    },

    completeTask(args: { taskId: Id; now: IsoTimestamp }): Task {
      const existing = state.tasks.get(args.taskId);
      if (!existing) {
        throw new CrmError('not-found', 'Task not found.', { resource: 'task', id: args.taskId });
      }

      const updated = completeTaskDomain(existing, args.now);
      state.tasks.set(updated.id, updated);
      return cloneTask(updated);
    },

    addNote(args: { subject: SubjectRef; body: string; now: IsoTimestamp }): Note {
      assertExists(state, args.subject);

      const note = createNoteDomain({
        id: input.generateId(),
        subject: args.subject,
        body: args.body,
        createdAt: args.now,
      });
      state.notes.set(note.id, note);
      return cloneNote(note);
    },

    getDashboardSummary(args: { asOf: IsoTimestamp }): DashboardSummary {
      return computeDashboardSummary(snapshotState(state), args.asOf);
    },

    __debug: {
      snapshot() {
        return snapshotState(state);
      },
    },
  };
}

