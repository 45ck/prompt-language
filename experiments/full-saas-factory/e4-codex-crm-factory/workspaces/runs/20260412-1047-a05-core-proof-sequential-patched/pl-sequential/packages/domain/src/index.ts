export type Result<T> = { ok: true; value: T } | { ok: false; error: CrmError };

export type ValidationError = {
  type: 'validation';
  message: string;
  field?: string;
};

export type NotFoundError = {
  type: 'not_found';
  message: string;
  entity: 'company' | 'contact' | 'opportunity' | 'task' | 'note';
  id: string;
};

export const opportunityPipelineStages = [
  'prospecting',
  'qualified',
  'proposal',
  'negotiation'
] as const;

export const opportunityTerminalStages = ['won', 'lost'] as const;

export const opportunityStages = [
  ...opportunityPipelineStages,
  ...opportunityTerminalStages
] as const;

export type OpportunityStage = (typeof opportunityStages)[number];

export type InvalidTransitionError = {
  type: 'invalid_transition';
  message: string;
  from: OpportunityStage;
  to: OpportunityStage;
};

export type CrmError = ValidationError | NotFoundError | InvalidTransitionError;

export type Company = {
  id: string;
  name: string;
};

export type Contact = {
  id: string;
  displayName: string;
  email?: string;
  companyId?: string;
};

export type Opportunity = {
  id: string;
  companyId: string;
  primaryContactId?: string;
  title: string;
  amount?: number;
  stage: OpportunityStage;
};

export type TaskStatus = 'open' | 'done';

export type Task = {
  id: string;
  opportunityId: string;
  title: string;
  status: TaskStatus;
};

export type NoteTargetType = 'contact' | 'company' | 'opportunity';

export type Note = {
  id: string;
  targetType: NoteTargetType;
  targetId: string;
  body: string;
};

export type DashboardSummary = {
  companiesTotal: number;
  contactsTotal: number;
  opportunitiesTotal: number;
  opportunitiesByStage: Record<OpportunityStage, number>;
  openOpportunitiesTotal: number;
  wonOpportunitiesTotal: number;
  lostOpportunitiesTotal: number;
  tasksOpenTotal: number;
  tasksDoneTotal: number;
  notesTotal: number;
};

export type CreateCompanyInput = { id: string; name: string };
export type CreateContactInput = {
  id: string;
  displayName: string;
  email?: string;
  companyId?: string;
};
export type CreateOpportunityInput = {
  id: string;
  companyId: string;
  primaryContactId?: string;
  title: string;
  amount?: number;
};
export type CreateTaskInput = { id: string; opportunityId: string; title: string };
export type CreateNoteInput = {
  id: string;
  targetType: NoteTargetType;
  targetId: string;
  body: string;
};

export function createCompany(input: CreateCompanyInput): Result<Company> {
  const name = input.name.trim();
  if (name.length === 0) {
    return err({
      type: 'validation',
      field: 'name',
      message: 'Company.name must be non-empty after trimming.'
    });
  }
  return ok({ id: input.id, name });
}

export function createContact(input: CreateContactInput): Result<Contact> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return err({
      type: 'validation',
      field: 'displayName',
      message: 'Contact.displayName must be non-empty after trimming.'
    });
  }

  const email = input.email?.trim();
  if (email !== undefined && !email.includes('@')) {
    return err({
      type: 'validation',
      field: 'email',
      message: 'Contact.email must contain "@".'
    });
  }

  return ok({
    id: input.id,
    displayName,
    ...(email === undefined ? {} : { email }),
    ...(input.companyId === undefined ? {} : { companyId: input.companyId })
  });
}

export function createOpportunity(input: CreateOpportunityInput): Result<Opportunity> {
  const title = input.title.trim();
  if (title.length === 0) {
    return err({
      type: 'validation',
      field: 'title',
      message: 'Opportunity.title must be non-empty after trimming.'
    });
  }

  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      return err({
        type: 'validation',
        field: 'amount',
        message: 'Opportunity.amount must be a finite number >= 0.'
      });
    }
  }

  return ok({
    id: input.id,
    companyId: input.companyId,
    ...(input.primaryContactId === undefined
      ? {}
      : { primaryContactId: input.primaryContactId }),
    title,
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    stage: 'prospecting'
  });
}

export function transitionOpportunityStage(
  opportunity: Opportunity,
  toStage: OpportunityStage
) : Result<Opportunity> {
  const fromStage = opportunity.stage;

  if (isTerminalStage(fromStage)) {
    return err({
      type: 'invalid_transition',
      from: fromStage,
      to: toStage,
      message: 'Cannot transition an opportunity once it is won or lost.'
    });
  }

  if (toStage === fromStage) {
    return err({
      type: 'invalid_transition',
      from: fromStage,
      to: toStage,
      message: 'Cannot transition an opportunity to the same stage.'
    });
  }

  if (isTerminalStage(toStage)) {
    return ok({ ...opportunity, stage: toStage });
  }

  const fromIndex = opportunityPipelineStages.indexOf(fromStage);
  const toIndex = opportunityPipelineStages.indexOf(toStage);
  const isForward = fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex;
  if (!isForward) {
    return err({
      type: 'invalid_transition',
      from: fromStage,
      to: toStage,
      message: 'Opportunity stage transitions must move forward in the pipeline.'
    });
  }

  return ok({ ...opportunity, stage: toStage });
}

export function createTask(input: CreateTaskInput): Result<Task> {
  const title = input.title.trim();
  if (title.length === 0) {
    return err({
      type: 'validation',
      field: 'title',
      message: 'Task.title must be non-empty after trimming.'
    });
  }
  return ok({
    id: input.id,
    opportunityId: input.opportunityId,
    title,
    status: 'open'
  });
}

export function completeTask(task: Task): Task {
  return { ...task, status: 'done' };
}

export function createNote(input: CreateNoteInput): Result<Note> {
  const body = input.body.trim();
  if (body.length === 0) {
    return err({
      type: 'validation',
      field: 'body',
      message: 'Note.body must be non-empty after trimming.'
    });
  }

  return ok({
    id: input.id,
    targetType: input.targetType,
    targetId: input.targetId,
    body
  });
}

export function computeDashboardSummary(input: {
  companies: readonly Company[];
  contacts: readonly Contact[];
  opportunities: readonly Opportunity[];
  tasks: readonly Task[];
  notes: readonly Note[];
}): DashboardSummary {
  const opportunitiesByStage: Record<OpportunityStage, number> = Object.fromEntries(
    opportunityStages.map((stage) => [stage, 0])
  ) as Record<OpportunityStage, number>;

  for (const opportunity of input.opportunities) {
    opportunitiesByStage[opportunity.stage] += 1;
  }

  const wonOpportunitiesTotal = opportunitiesByStage.won;
  const lostOpportunitiesTotal = opportunitiesByStage.lost;
  const opportunitiesTotal = input.opportunities.length;
  const openOpportunitiesTotal =
    opportunitiesTotal - wonOpportunitiesTotal - lostOpportunitiesTotal;

  let tasksOpenTotal = 0;
  let tasksDoneTotal = 0;
  for (const task of input.tasks) {
    if (task.status === 'open') tasksOpenTotal += 1;
    if (task.status === 'done') tasksDoneTotal += 1;
  }

  return {
    companiesTotal: input.companies.length,
    contactsTotal: input.contacts.length,
    opportunitiesTotal,
    opportunitiesByStage,
    openOpportunitiesTotal,
    wonOpportunitiesTotal,
    lostOpportunitiesTotal,
    tasksOpenTotal,
    tasksDoneTotal,
    notesTotal: input.notes.length
  };
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(error: CrmError): Result<T> {
  return { ok: false, error };
}

function isTerminalStage(stage: OpportunityStage): stage is (typeof opportunityTerminalStages)[number] {
  return (opportunityTerminalStages as readonly string[]).includes(stage);
}
