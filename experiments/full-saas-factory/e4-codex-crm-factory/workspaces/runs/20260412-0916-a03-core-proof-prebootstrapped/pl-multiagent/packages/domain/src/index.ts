export const OPPORTUNITY_STAGES = [
  'Prospecting',
  'Qualified',
  'Proposal',
  'Negotiation',
  'ClosedWon',
  'ClosedLost'
] as const;

export const TASK_STATUSES = ['Open', 'Done'] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Company {
  companyId: string;
  name: string;
  domain?: string;
}

export interface Contact {
  contactId: string;
  fullName: string;
  email?: string;
  phone?: string;
  companyId?: string;
}

export interface Opportunity {
  opportunityId: string;
  title: string;
  stage: OpportunityStage;
  amountCents: number;
  companyId?: string;
  primaryContactId?: string;
}

export interface Task {
  taskId: string;
  subject: string;
  status: TaskStatus;
  dueDate?: string;
  contactId?: string;
  opportunityId?: string;
}

export interface Note {
  noteId: string;
  body: string;
  contactId?: string;
  opportunityId?: string;
}

export interface DashboardSummary {
  totals: {
    contacts: number;
    companies: number;
    opportunities: number;
    tasks: number;
    notes: number;
  };
  opportunitiesByStage: Record<OpportunityStage, number>;
  openPipelineAmountCents: number;
  openTasksDueCount: number;
}

export interface DashboardSummaryInput {
  companies: readonly Company[];
  contacts: readonly Contact[];
  opportunities: readonly Opportunity[];
  tasks: readonly Task[];
  notes: readonly Note[];
  asOfDate: string;
}

export interface OpportunityInput {
  opportunityId: string;
  title: string;
  stage?: OpportunityStage;
  amountCents: number;
  companyId?: string;
  primaryContactId?: string;
}

export interface TaskInput {
  taskId: string;
  subject: string;
  status?: TaskStatus;
  dueDate?: string;
  contactId?: string;
  opportunityId?: string;
}

export type DomainErrorCode = 'validation_error' | 'invalid_stage_transition';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;

  public constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

const ALLOWED_STAGE_TRANSITIONS: Readonly<Record<OpportunityStage, readonly OpportunityStage[]>> = {
  Prospecting: ['Qualified', 'ClosedLost'],
  Qualified: ['Proposal', 'ClosedLost'],
  Proposal: ['Negotiation', 'ClosedLost'],
  Negotiation: ['ClosedWon', 'ClosedLost'],
  ClosedWon: [],
  ClosedLost: []
};

const TERMINAL_STAGES = new Set<OpportunityStage>(['ClosedWon', 'ClosedLost']);

export function createCompany(props: Company): Company {
  assertNonEmptyString(props.companyId, 'companyId');
  assertNonEmptyString(props.name, 'name');

  return { ...props };
}

export function createContact(props: Contact): Contact {
  assertNonEmptyString(props.contactId, 'contactId');
  assertNonEmptyString(props.fullName, 'fullName');
  assertOptionalNonEmptyString(props.companyId, 'companyId');

  return { ...props };
}

export function createOpportunity(props: OpportunityInput): Opportunity {
  const opportunity: Opportunity = {
    ...props,
    stage: props.stage ?? 'Prospecting'
  };

  assertNonEmptyString(opportunity.opportunityId, 'opportunityId');
  assertNonEmptyString(opportunity.title, 'title');
  assertOpportunityStage(opportunity.stage);
  assertAmountCents(opportunity.amountCents);
  assertOptionalNonEmptyString(opportunity.companyId, 'companyId');
  assertOptionalNonEmptyString(opportunity.primaryContactId, 'primaryContactId');

  return opportunity;
}

export function canTransitionOpportunityStage(from: OpportunityStage, to: OpportunityStage): boolean {
  return ALLOWED_STAGE_TRANSITIONS[from].includes(to);
}

export function moveOpportunityStage(
  opportunity: Opportunity,
  nextStage: OpportunityStage
): Opportunity {
  validateOpportunity(opportunity);
  assertOpportunityStage(nextStage);

  if (!canTransitionOpportunityStage(opportunity.stage, nextStage)) {
    throw new DomainError(
      'invalid_stage_transition',
      `Cannot move opportunity from ${opportunity.stage} to ${nextStage}.`
    );
  }

  return {
    ...opportunity,
    stage: nextStage
  };
}

export function createTask(props: TaskInput): Task {
  const task: Task = {
    ...props,
    status: props.status ?? 'Open'
  };

  validateTask(task);

  return task;
}

export function markTaskDone(task: Task): Task {
  validateTask(task);

  return {
    ...task,
    status: 'Done'
  };
}

export function createNote(props: Note): Note {
  assertNonEmptyString(props.noteId, 'noteId');
  assertNonEmptyString(props.body, 'body');
  assertExactlyOneTarget(props.contactId, props.opportunityId, 'note');

  return { ...props };
}

export function buildDashboardSummary(input: DashboardSummaryInput): DashboardSummary {
  assertPlainDate(input.asOfDate, 'asOfDate');

  const opportunitiesByStage = createEmptyStageCounts();
  let openPipelineAmountCents = 0;
  let openTasksDueCount = 0;

  for (const opportunity of input.opportunities) {
    opportunitiesByStage[opportunity.stage] += 1;

    if (!TERMINAL_STAGES.has(opportunity.stage)) {
      openPipelineAmountCents += opportunity.amountCents;
    }
  }

  for (const task of input.tasks) {
    if (task.status === 'Open' && task.dueDate !== undefined && task.dueDate <= input.asOfDate) {
      openTasksDueCount += 1;
    }
  }

  return {
    totals: {
      contacts: input.contacts.length,
      companies: input.companies.length,
      opportunities: input.opportunities.length,
      tasks: input.tasks.length,
      notes: input.notes.length
    },
    opportunitiesByStage,
    openPipelineAmountCents,
    openTasksDueCount
  };
}

function validateOpportunity(opportunity: Opportunity): void {
  assertNonEmptyString(opportunity.opportunityId, 'opportunityId');
  assertNonEmptyString(opportunity.title, 'title');
  assertOpportunityStage(opportunity.stage);
  assertAmountCents(opportunity.amountCents);
  assertOptionalNonEmptyString(opportunity.companyId, 'companyId');
  assertOptionalNonEmptyString(opportunity.primaryContactId, 'primaryContactId');
}

function validateTask(task: Task): void {
  assertNonEmptyString(task.taskId, 'taskId');
  assertNonEmptyString(task.subject, 'subject');
  assertTaskStatus(task.status);
  assertPlainDate(task.dueDate, 'dueDate');
  assertExactlyOneTarget(task.contactId, task.opportunityId, 'task');
}

function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new DomainError('validation_error', `${fieldName} must be non-empty.`);
  }
}

function assertOptionalNonEmptyString(value: string | undefined, fieldName: string): void {
  if (value !== undefined) {
    assertNonEmptyString(value, fieldName);
  }
}

function assertAmountCents(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError(
      'validation_error',
      'amountCents must be an integer greater than or equal to zero.'
    );
  }
}

function assertOpportunityStage(value: OpportunityStage): void {
  if (!OPPORTUNITY_STAGES.includes(value)) {
    throw new DomainError('validation_error', `Unknown opportunity stage: ${value}.`);
  }
}

function assertTaskStatus(value: TaskStatus): void {
  if (!TASK_STATUSES.includes(value)) {
    throw new DomainError('validation_error', `Unknown task status: ${value}.`);
  }
}

function assertExactlyOneTarget(
  contactId: string | undefined,
  opportunityId: string | undefined,
  entityName: string
): void {
  assertOptionalNonEmptyString(contactId, 'contactId');
  assertOptionalNonEmptyString(opportunityId, 'opportunityId');

  const targetCount = Number(contactId !== undefined) + Number(opportunityId !== undefined);
  if (targetCount !== 1) {
    throw new DomainError(
      'validation_error',
      `${entityName} must target exactly one of contactId or opportunityId.`
    );
  }
}

function assertPlainDate(value: string | undefined, fieldName: string): void {
  if (value === undefined) {
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError('validation_error', `${fieldName} must be a YYYY-MM-DD date.`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const matchesDate =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;

  if (!matchesDate) {
    throw new DomainError('validation_error', `${fieldName} must be a valid YYYY-MM-DD date.`);
  }
}

function createEmptyStageCounts(): Record<OpportunityStage, number> {
  return {
    Prospecting: 0,
    Qualified: 0,
    Proposal: 0,
    Negotiation: 0,
    ClosedWon: 0,
    ClosedLost: 0
  };
}
