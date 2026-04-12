import {
  completeTask as domainCompleteTask,
  computeDashboardSummary,
  createCompany as domainCreateCompany,
  createContact as domainCreateContact,
  createNote as domainCreateNote,
  createOpportunity as domainCreateOpportunity,
  createTask as domainCreateTask,
  transitionOpportunityStage,
  type Company,
  type Contact,
  type CrmError,
  type DashboardSummary,
  type Note,
  type NoteTargetType,
  type NotFoundError,
  type Opportunity,
  type OpportunityStage,
  type Result,
  type Task
} from '../../domain/src/index.js';

export type IdGenerator = { nextId(): string };

export class InMemoryCrmService {
  private readonly companies = new Map<string, Company>();
  private readonly contacts = new Map<string, Contact>();
  private readonly opportunities = new Map<string, Opportunity>();
  private readonly tasks = new Map<string, Task>();
  private readonly notesById = new Map<string, Note>();
  private readonly notesInInsertionOrder: Note[] = [];

  public constructor(private readonly idGenerator: IdGenerator) {}

  // Companies
  public createCompany(input: { name: string }): Result<Company> {
    const validated = domainCreateCompany({ id: '__pending__', name: input.name });
    if (!validated.ok) return validated;

    const id = this.idGenerator.nextId();
    const company: Company = { ...validated.value, id };
    this.companies.set(company.id, company);
    return ok(company);
  }

  public getCompany(id: string): Result<Company> {
    const company = this.companies.get(id);
    if (company === undefined) return err(notFound('company', id));
    return ok(company);
  }

  // Contacts
  public createContact(input: {
    displayName: string;
    email?: string;
    companyId?: string;
  }): Result<Contact> {
    if (input.companyId !== undefined && !this.companies.has(input.companyId)) {
      return err(notFound('company', input.companyId));
    }

    const validated = domainCreateContact({
      id: '__pending__',
      displayName: input.displayName,
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.companyId === undefined ? {} : { companyId: input.companyId })
    });
    if (!validated.ok) return validated;

    const id = this.idGenerator.nextId();
    const contact: Contact = { ...validated.value, id };
    this.contacts.set(contact.id, contact);
    return ok(contact);
  }

  public getContact(id: string): Result<Contact> {
    const contact = this.contacts.get(id);
    if (contact === undefined) return err(notFound('contact', id));
    return ok(contact);
  }

  // Opportunities
  public createOpportunity(input: {
    companyId: string;
    primaryContactId?: string;
    title: string;
    amount?: number;
  }): Result<Opportunity> {
    if (!this.companies.has(input.companyId)) {
      return err(notFound('company', input.companyId));
    }
    if (
      input.primaryContactId !== undefined &&
      !this.contacts.has(input.primaryContactId)
    ) {
      return err(notFound('contact', input.primaryContactId));
    }

    const validated = domainCreateOpportunity({
      id: '__pending__',
      companyId: input.companyId,
      ...(input.primaryContactId === undefined
        ? {}
        : { primaryContactId: input.primaryContactId }),
      title: input.title,
      ...(input.amount === undefined ? {} : { amount: input.amount })
    });
    if (!validated.ok) return validated;

    const id = this.idGenerator.nextId();
    const opportunity: Opportunity = { ...validated.value, id };
    this.opportunities.set(opportunity.id, opportunity);
    return ok(opportunity);
  }

  public getOpportunity(id: string): Result<Opportunity> {
    const opportunity = this.opportunities.get(id);
    if (opportunity === undefined) return err(notFound('opportunity', id));
    return ok(opportunity);
  }

  // Opportunity stage transitions
  public moveOpportunityStage(input: {
    opportunityId: string;
    toStage: OpportunityStage;
  }): Result<Opportunity> {
    const existing = this.opportunities.get(input.opportunityId);
    if (existing === undefined) return err(notFound('opportunity', input.opportunityId));

    const transitioned = transitionOpportunityStage(existing, input.toStage);
    if (!transitioned.ok) return transitioned;

    this.opportunities.set(transitioned.value.id, transitioned.value);
    return transitioned;
  }

  // Tasks
  public addTask(input: { opportunityId: string; title: string }): Result<Task> {
    if (!this.opportunities.has(input.opportunityId)) {
      return err(notFound('opportunity', input.opportunityId));
    }

    const validated = domainCreateTask({
      id: '__pending__',
      opportunityId: input.opportunityId,
      title: input.title
    });
    if (!validated.ok) return validated;

    const id = this.idGenerator.nextId();
    const task: Task = { ...validated.value, id };
    this.tasks.set(task.id, task);
    return ok(task);
  }

  public completeTask(input: { taskId: string }): Result<Task> {
    const existing = this.tasks.get(input.taskId);
    if (existing === undefined) return err(notFound('task', input.taskId));

    const completed = domainCompleteTask(existing);
    this.tasks.set(completed.id, completed);
    return ok(completed);
  }

  public listTasksForOpportunity(input: { opportunityId: string }): Result<Task[]> {
    if (!this.opportunities.has(input.opportunityId)) {
      return err(notFound('opportunity', input.opportunityId));
    }

    const tasks: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.opportunityId === input.opportunityId) tasks.push(task);
    }
    return ok(tasks);
  }

  // Notes
  public addNote(input: { targetType: NoteTargetType; targetId: string; body: string }): Result<Note> {
    if (!this.targetExists(input.targetType, input.targetId)) {
      return err(notFound(input.targetType, input.targetId));
    }

    const validated = domainCreateNote({
      id: '__pending__',
      targetType: input.targetType,
      targetId: input.targetId,
      body: input.body
    });
    if (!validated.ok) return validated;

    const id = this.idGenerator.nextId();
    const note: Note = { ...validated.value, id };
    this.notesById.set(note.id, note);
    this.notesInInsertionOrder.push(note);
    return ok(note);
  }

  public listNotesForTarget(input: { targetType: NoteTargetType; targetId: string }): Result<Note[]> {
    if (!this.targetExists(input.targetType, input.targetId)) {
      return err(notFound(input.targetType, input.targetId));
    }

    const notes: Note[] = [];
    for (const note of this.notesInInsertionOrder) {
      if (note.targetType === input.targetType && note.targetId === input.targetId) {
        notes.push(note);
      }
    }
    return ok(notes);
  }

  // Dashboard summary
  public getDashboardSummary(): DashboardSummary {
    return computeDashboardSummary({
      companies: Array.from(this.companies.values()),
      contacts: Array.from(this.contacts.values()),
      opportunities: Array.from(this.opportunities.values()),
      tasks: Array.from(this.tasks.values()),
      notes: this.notesInInsertionOrder
    });
  }

  private targetExists(targetType: NoteTargetType, targetId: string): boolean {
    switch (targetType) {
      case 'company':
        return this.companies.has(targetId);
      case 'contact':
        return this.contacts.has(targetId);
      case 'opportunity':
        return this.opportunities.has(targetId);
    }
  }
}

export type {
  Company,
  Contact,
  CrmError,
  DashboardSummary,
  Note,
  NoteTargetType,
  Opportunity,
  OpportunityStage,
  Result,
  Task
};

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(error: CrmError): Result<T> {
  return { ok: false, error };
}

function notFound(entity: NotFoundError['entity'], id: string): NotFoundError {
  return {
    type: 'not_found',
    entity,
    id,
    message: `${capitalize(entity)} not found.`
  };
}

function capitalize(input: string): string {
  return input.length === 0 ? input : `${input[0].toUpperCase()}${input.slice(1)}`;
}
