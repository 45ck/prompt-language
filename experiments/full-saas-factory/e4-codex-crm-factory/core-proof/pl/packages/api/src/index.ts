import {
  buildDashboardSummary,
  createCompany,
  createContact,
  createNote,
  createOpportunity,
  createTask,
  listNotesForEntity,
  searchCompanies,
  searchContacts,
  searchOpportunities,
  transitionOpportunityStage,
  type CalendarDate,
  type Company,
  type CompanyId,
  type Contact,
  type ContactId,
  type CreateCompanyInput,
  type CreateContactInput,
  type CreateNoteInput,
  type CreateOpportunityInput,
  type CreateTaskInput,
  type DashboardSummary,
  type LinkedEntityId,
  type LinkedEntityType,
  type Note,
  type NoteId,
  type Opportunity,
  type OpportunityId,
  type OpportunityStage,
  type Task,
  type TaskId,
  type TaskStatus,
  type Timestamp
} from '../../domain/src/index.js';

export type {
  CalendarDate,
  Company,
  CompanyId,
  Contact,
  ContactId,
  DashboardSummary,
  LinkedEntityId,
  LinkedEntityType,
  Note,
  NoteId,
  Opportunity,
  OpportunityId,
  OpportunityStage,
  Task,
  TaskId,
  TaskStatus,
  Timestamp
} from '../../domain/src/index.js';

export interface Clock {
  now(): Timestamp;
  today(): CalendarDate;
}

export type CreateCompanyCommand = Omit<CreateCompanyInput, 'now'>;
export type CreateContactCommand = Omit<CreateContactInput, 'now'>;
export type CreateOpportunityCommand = Omit<CreateOpportunityInput, 'now'>;
export type CreateTaskCommand = Omit<CreateTaskInput, 'now'>;
export type CreateNoteCommand = Omit<CreateNoteInput, 'now'>;

export interface ListCompaniesQuery {
  readonly search?: string;
}

export interface ListContactsQuery {
  readonly search?: string;
}

export interface ListOpportunitiesQuery {
  readonly search?: string;
  readonly stage?: OpportunityStage;
}

export interface ListTasksQuery {
  readonly status?: TaskStatus;
  readonly linkedEntityType?: LinkedEntityType;
  readonly linkedEntityId?: LinkedEntityId;
}

export interface NotesForEntityQuery {
  readonly linkedEntityType: LinkedEntityType;
  readonly linkedEntityId: LinkedEntityId;
}

export interface CompanyService {
  create(input: CreateCompanyCommand): Company;
  get(id: CompanyId): Company | undefined;
  list(query?: ListCompaniesQuery): Company[];
}

export interface ContactService {
  create(input: CreateContactCommand): Contact;
  get(id: ContactId): Contact | undefined;
  list(query?: ListContactsQuery): Contact[];
}

export interface OpportunityService {
  create(input: CreateOpportunityCommand): Opportunity;
  get(id: OpportunityId): Opportunity | undefined;
  list(query?: ListOpportunitiesQuery): Opportunity[];
  moveStage(id: OpportunityId, nextStage: OpportunityStage): Opportunity;
}

export interface TaskService {
  create(input: CreateTaskCommand): Task;
  list(query?: ListTasksQuery): Task[];
}

export interface NoteService {
  create(input: CreateNoteCommand): Note;
  listForEntity(query: NotesForEntityQuery): Note[];
}

export interface DashboardService {
  getSummary(): DashboardSummary;
}

export interface InMemoryCrmServices {
  readonly companies: CompanyService;
  readonly contacts: ContactService;
  readonly opportunities: OpportunityService;
  readonly tasks: TaskService;
  readonly notes: NoteService;
  readonly dashboard: DashboardService;
}

export class EntityNotFoundError extends Error {
  constructor(entityName: string, entityId: string) {
    super(`${entityName} ${entityId} was not found.`);
    this.name = 'EntityNotFoundError';
  }
}

export function createInMemoryCrmServices(clock: Clock): InMemoryCrmServices {
  const companies = new Map<CompanyId, Company>();
  const contacts = new Map<ContactId, Contact>();
  const opportunities = new Map<OpportunityId, Opportunity>();
  const tasks = new Map<TaskId, Task>();
  const notes = new Map<NoteId, Note>();

  const listCompanySnapshots = (): Company[] => Array.from(companies.values());
  const listContactSnapshots = (): Contact[] => Array.from(contacts.values());
  const listOpportunitySnapshots = (): Opportunity[] =>
    Array.from(opportunities.values());
  const listTaskSnapshots = (): Task[] => Array.from(tasks.values());
  const listNoteSnapshots = (): Note[] => Array.from(notes.values());

  const listCompaniesWithQuery = (query?: ListCompaniesQuery): Company[] => {
    const snapshots = listCompanySnapshots();

    if (query?.search === undefined) {
      return snapshots;
    }

    return searchCompanies(snapshots, query.search);
  };

  const listContactsWithQuery = (query?: ListContactsQuery): Contact[] => {
    const snapshots = listContactSnapshots();

    if (query?.search === undefined) {
      return snapshots;
    }

    return searchContacts(snapshots, query.search);
  };

  const listOpportunitiesWithQuery = (
    query?: ListOpportunitiesQuery
  ): Opportunity[] => {
    let snapshots = listOpportunitySnapshots();

    if (query?.search !== undefined) {
      snapshots = searchOpportunities(snapshots, query.search);
    }

    if (query?.stage !== undefined) {
      snapshots = snapshots.filter(
        (opportunity) => opportunity.stage === query.stage
      );
    }

    return snapshots;
  };

  const listTasksWithQuery = (query?: ListTasksQuery): Task[] => {
    let snapshots = listTaskSnapshots();

    if (query?.status !== undefined) {
      snapshots = snapshots.filter((task) => task.status === query.status);
    }

    if (query?.linkedEntityType !== undefined) {
      snapshots = snapshots.filter(
        (task) => task.linkedEntityType === query.linkedEntityType
      );
    }

    if (query?.linkedEntityId !== undefined) {
      snapshots = snapshots.filter(
        (task) => task.linkedEntityId === query.linkedEntityId
      );
    }

    return snapshots;
  };

  const requireOpportunity = (id: OpportunityId): Opportunity => {
    const opportunity = opportunities.get(id);

    if (opportunity === undefined) {
      throw new EntityNotFoundError('Opportunity', id);
    }

    return opportunity;
  };

  return {
    companies: {
      create(input) {
        const company = createCompany(
          {
            ...input,
            now: clock.now()
          },
          listCompanySnapshots()
        );

        companies.set(company.id, company);
        return company;
      },
      get(id) {
        return companies.get(id);
      },
      list(query) {
        return listCompaniesWithQuery(query);
      }
    },
    contacts: {
      create(input) {
        const contact = createContact(
          {
            ...input,
            now: clock.now()
          },
          listContactSnapshots(),
          listCompanySnapshots()
        );

        contacts.set(contact.id, contact);
        return contact;
      },
      get(id) {
        return contacts.get(id);
      },
      list(query) {
        return listContactsWithQuery(query);
      }
    },
    opportunities: {
      create(input) {
        const opportunity = createOpportunity(
          {
            ...input,
            now: clock.now()
          },
          listCompanySnapshots(),
          listContactSnapshots()
        );

        opportunities.set(opportunity.id, opportunity);
        return opportunity;
      },
      get(id) {
        return opportunities.get(id);
      },
      list(query) {
        return listOpportunitiesWithQuery(query);
      },
      moveStage(id, nextStage) {
        const next = transitionOpportunityStage(
          requireOpportunity(id),
          nextStage,
          clock.now()
        );

        opportunities.set(next.id, next);
        return next;
      }
    },
    tasks: {
      create(input) {
        const task = createTask(
          {
            ...input,
            now: clock.now()
          },
          {
            contacts: listContactSnapshots(),
            companies: listCompanySnapshots(),
            opportunities: listOpportunitySnapshots()
          }
        );

        tasks.set(task.id, task);
        return task;
      },
      list(query) {
        return listTasksWithQuery(query);
      }
    },
    notes: {
      create(input) {
        const note = createNote(
          {
            ...input,
            now: clock.now()
          },
          {
            contacts: listContactSnapshots(),
            companies: listCompanySnapshots(),
            opportunities: listOpportunitySnapshots()
          }
        );

        notes.set(note.id, note);
        return note;
      },
      listForEntity(query) {
        return listNotesForEntity(
          listNoteSnapshots(),
          query.linkedEntityType,
          query.linkedEntityId
        );
      }
    },
    dashboard: {
      getSummary() {
        return buildDashboardSummary({
          contacts: listContactSnapshots(),
          companies: listCompanySnapshots(),
          opportunities: listOpportunitySnapshots(),
          tasks: listTaskSnapshots(),
          currentDate: clock.today()
        });
      }
    }
  };
}
