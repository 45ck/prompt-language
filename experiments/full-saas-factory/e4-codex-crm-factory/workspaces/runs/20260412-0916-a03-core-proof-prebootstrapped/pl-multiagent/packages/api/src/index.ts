import {
  DomainError,
  buildDashboardSummary,
  createCompany as createDomainCompany,
  createContact as createDomainContact,
  createNote as createDomainNote,
  createOpportunity as createDomainOpportunity,
  createTask as createDomainTask,
  markTaskDone as markDomainTaskDone,
  moveOpportunityStage as moveDomainOpportunityStage,
  type Company,
  type Contact,
  type DashboardSummary,
  type Note,
  type Opportunity,
  type OpportunityStage,
  type Task,
  type TaskStatus
} from '../../domain/src/index.js';

export type {
  Company,
  Contact,
  DashboardSummary,
  Note,
  Opportunity,
  OpportunityStage,
  Task,
  TaskStatus
};

export type CrmErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INVALID_STAGE_TRANSITION';

export interface CrmErrorDetails {
  readonly [key: string]: boolean | number | string;
}

export class CrmError extends Error {
  public readonly code: CrmErrorCode;
  public readonly details?: CrmErrorDetails;

  public constructor(code: CrmErrorCode, message: string, details?: CrmErrorDetails) {
    super(message);
    this.name = 'CrmError';
    this.code = code;
    this.details = details;
  }
}

export interface CreateCompanyInput {
  name: string;
  domain?: string;
}

export interface CreateContactInput {
  fullName: string;
  email?: string;
  phone?: string;
  companyId?: string;
}

export interface CreateOpportunityInput {
  title: string;
  amountCents: number;
  companyId?: string;
  primaryContactId?: string;
}

export interface MoveOpportunityStageInput {
  opportunityId: string;
  nextStage: OpportunityStage;
}

export interface AddTaskInput {
  subject: string;
  dueDate?: string;
  contactId?: string;
  opportunityId?: string;
}

export interface TaskListFilter {
  contactId?: string;
  opportunityId?: string;
  status?: TaskStatus;
}

export interface AddNoteInput {
  body: string;
  contactId?: string;
  opportunityId?: string;
}

export interface NoteListFilter {
  contactId?: string;
  opportunityId?: string;
}

export interface GetDashboardSummaryInput {
  asOfDate: string;
}

export interface CrmCoreApi {
  createCompany(input: CreateCompanyInput): Company;
  getCompany(companyId: string): Company;
  listCompanies(): Company[];
  createContact(input: CreateContactInput): Contact;
  getContact(contactId: string): Contact;
  listContacts(): Contact[];
  createOpportunity(input: CreateOpportunityInput): Opportunity;
  getOpportunity(opportunityId: string): Opportunity;
  listOpportunities(): Opportunity[];
  moveOpportunityStage(input: MoveOpportunityStageInput): Opportunity;
  addTask(input: AddTaskInput): Task;
  markTaskDone(taskId: string): Task;
  listTasks(filter?: TaskListFilter): Task[];
  addNote(input: AddNoteInput): Note;
  listNotes(filter?: NoteListFilter): Note[];
  getDashboardSummary(input: GetDashboardSummaryInput): DashboardSummary;
}

export type IdEntity = 'company' | 'contact' | 'opportunity' | 'task' | 'note';

export type IdGenerator = (entity: IdEntity) => string;

export interface CreateInMemoryCrmCoreApiOptions {
  idGenerator?: IdGenerator;
}

export function createSequentialIdGenerator(): IdGenerator {
  const counters: Record<IdEntity, number> = {
    company: 0,
    contact: 0,
    opportunity: 0,
    task: 0,
    note: 0
  };

  return (entity) => {
    counters[entity] += 1;
    return `${entity}-${counters[entity]}`;
  };
}

export function createInMemoryCrmCoreApi(
  options: CreateInMemoryCrmCoreApiOptions = {}
): CrmCoreApi {
  const nextId = options.idGenerator ?? createSequentialIdGenerator();
  const companies: Company[] = [];
  const contacts: Contact[] = [];
  const opportunities: Opportunity[] = [];
  const tasks: Task[] = [];
  const notes: Note[] = [];

  return {
    createCompany(input) {
      const company = runDomainOperation(() =>
        createDomainCompany({
          companyId: nextId('company'),
          ...input
        })
      );

      companies.push(company);
      return cloneRecord(company);
    },
    getCompany(companyId) {
      return cloneRecord(findCompany(companies, companyId));
    },
    listCompanies() {
      return companies.map(cloneRecord);
    },
    createContact(input) {
      const contact = runDomainOperation(() =>
        createDomainContact({
          contactId: nextId('contact'),
          ...input
        })
      );

      if (contact.companyId !== undefined) {
        findCompany(companies, contact.companyId);
      }

      contacts.push(contact);
      return cloneRecord(contact);
    },
    getContact(contactId) {
      return cloneRecord(findContact(contacts, contactId));
    },
    listContacts() {
      return contacts.map(cloneRecord);
    },
    createOpportunity(input) {
      const opportunity = runDomainOperation(() =>
        createDomainOpportunity({
          opportunityId: nextId('opportunity'),
          ...input
        })
      );

      if (opportunity.companyId !== undefined) {
        findCompany(companies, opportunity.companyId);
      }

      if (opportunity.primaryContactId !== undefined) {
        findContact(contacts, opportunity.primaryContactId);
      }

      opportunities.push(opportunity);
      return cloneRecord(opportunity);
    },
    getOpportunity(opportunityId) {
      return cloneRecord(findOpportunity(opportunities, opportunityId));
    },
    listOpportunities() {
      return opportunities.map(cloneRecord);
    },
    moveOpportunityStage(input) {
      const opportunity = findOpportunity(opportunities, input.opportunityId);
      const updatedOpportunity = runDomainOperation(() =>
        moveDomainOpportunityStage(opportunity, input.nextStage)
      );

      replaceRecord(
        opportunities,
        updatedOpportunity,
        (candidate) => candidate.opportunityId === updatedOpportunity.opportunityId
      );

      return cloneRecord(updatedOpportunity);
    },
    addTask(input) {
      const task = runDomainOperation(() =>
        createDomainTask({
          taskId: nextId('task'),
          ...input
        })
      );

      if (task.contactId !== undefined) {
        findContact(contacts, task.contactId);
      }

      if (task.opportunityId !== undefined) {
        findOpportunity(opportunities, task.opportunityId);
      }

      tasks.push(task);
      return cloneRecord(task);
    },
    markTaskDone(taskId) {
      const task = findTask(tasks, taskId);
      const updatedTask = runDomainOperation(() => markDomainTaskDone(task));

      replaceRecord(tasks, updatedTask, (candidate) => candidate.taskId === updatedTask.taskId);

      return cloneRecord(updatedTask);
    },
    listTasks(filter) {
      return tasks
        .filter((task) => matchesTaskFilter(task, filter))
        .map(cloneRecord);
    },
    addNote(input) {
      const note = runDomainOperation(() =>
        createDomainNote({
          noteId: nextId('note'),
          ...input
        })
      );

      if (note.contactId !== undefined) {
        findContact(contacts, note.contactId);
      }

      if (note.opportunityId !== undefined) {
        findOpportunity(opportunities, note.opportunityId);
      }

      notes.push(note);
      return cloneRecord(note);
    },
    listNotes(filter) {
      return notes
        .filter((note) => matchesNoteFilter(note, filter))
        .map(cloneRecord);
    },
    getDashboardSummary(input) {
      return runDomainOperation(() =>
        buildDashboardSummary({
          asOfDate: input.asOfDate,
          companies,
          contacts,
          opportunities,
          tasks,
          notes
        })
      );
    }
  };
}

function findCompany(companies: readonly Company[], companyId: string): Company {
  return findRecord(companies, companyId, 'companyId', 'Company');
}

function findContact(contacts: readonly Contact[], contactId: string): Contact {
  return findRecord(contacts, contactId, 'contactId', 'Contact');
}

function findOpportunity(
  opportunities: readonly Opportunity[],
  opportunityId: string
): Opportunity {
  return findRecord(opportunities, opportunityId, 'opportunityId', 'Opportunity');
}

function findTask(tasks: readonly Task[], taskId: string): Task {
  return findRecord(tasks, taskId, 'taskId', 'Task');
}

function findRecord<RecordType extends object, IdField extends keyof RecordType>(
  records: readonly RecordType[],
  id: string,
  idField: IdField,
  entityName: string
): RecordType {
  const record = records.find((candidate) => candidate[idField] === id);
  if (record === undefined) {
    throw new CrmError('NOT_FOUND', `${entityName} ${id} was not found.`, {
      entityName,
      id
    });
  }

  return record;
}

function replaceRecord<RecordType>(
  records: RecordType[],
  nextRecord: RecordType,
  predicate: (record: RecordType) => boolean
): void {
  const recordIndex = records.findIndex(predicate);
  records[recordIndex] = nextRecord;
}

function matchesTaskFilter(task: Task, filter: TaskListFilter | undefined): boolean {
  if (filter === undefined) {
    return true;
  }

  return (
    (filter.contactId === undefined || task.contactId === filter.contactId) &&
    (filter.opportunityId === undefined || task.opportunityId === filter.opportunityId) &&
    (filter.status === undefined || task.status === filter.status)
  );
}

function matchesNoteFilter(note: Note, filter: NoteListFilter | undefined): boolean {
  if (filter === undefined) {
    return true;
  }

  return (
    (filter.contactId === undefined || note.contactId === filter.contactId) &&
    (filter.opportunityId === undefined || note.opportunityId === filter.opportunityId)
  );
}

function cloneRecord<RecordType extends object>(record: RecordType): RecordType {
  return Object.assign({} as RecordType, record);
}

function runDomainOperation<Result>(operation: () => Result): Result {
  try {
    return operation();
  } catch (error) {
    if (error instanceof CrmError) {
      throw error;
    }

    if (error instanceof DomainError) {
      throw new CrmError(mapDomainErrorCode(error.code), error.message);
    }

    throw error;
  }
}

function mapDomainErrorCode(code: DomainError['code']): CrmErrorCode {
  switch (code) {
    case 'validation_error':
      return 'VALIDATION_ERROR';
    case 'invalid_stage_transition':
      return 'INVALID_STAGE_TRANSITION';
  }
}
