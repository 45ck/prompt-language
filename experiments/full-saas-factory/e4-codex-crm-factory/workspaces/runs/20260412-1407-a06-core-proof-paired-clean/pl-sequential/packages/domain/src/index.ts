export type Id = string;

export type IsoTimestamp = string;

export type SubjectRef =
  | { type: 'contact'; id: Id }
  | { type: 'company'; id: Id }
  | { type: 'opportunity'; id: Id };

export type OpportunityStage =
  | 'prospecting'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed-won'
  | 'closed-lost';

export type TaskStatus = 'open' | 'completed';

export type Company = {
  id: Id;
  name: string;
  createdAt: IsoTimestamp;
};

export type Contact = {
  id: Id;
  displayName: string;
  email?: string;
  companyId?: Id;
  createdAt: IsoTimestamp;
};

export type Opportunity = {
  id: Id;
  companyId: Id;
  primaryContactId?: Id;
  title: string;
  amountCents: number;
  currency: string;
  stage: OpportunityStage;
  createdAt: IsoTimestamp;
  stageUpdatedAt: IsoTimestamp;
};

export type Task = {
  id: Id;
  subject: SubjectRef;
  title: string;
  dueAt?: IsoTimestamp;
  status: TaskStatus;
  createdAt: IsoTimestamp;
  completedAt?: IsoTimestamp;
};

export type Note = {
  id: Id;
  subject: SubjectRef;
  body: string;
  createdAt: IsoTimestamp;
};

export type ValidationIssue = {
  field: string;
  message: string;
};

export type CrmErrorType = 'validation' | 'not-found' | 'invalid-transition' | 'conflict';

export class CrmError extends Error {
  readonly type: CrmErrorType;
  readonly issues?: ValidationIssue[];
  readonly resource?: string;
  readonly id?: string;
  readonly fromStage?: OpportunityStage;
  readonly toStage?: OpportunityStage;

  constructor(
    type: CrmErrorType,
    message: string,
    details?: Partial<Pick<CrmError, 'issues' | 'resource' | 'id' | 'fromStage' | 'toStage'>>,
  ) {
    super(message);
    this.name = 'CrmError';
    this.type = type;
    if (details) {
      Object.assign(this, details);
    }
  }
}

const ISO_TS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

function isIsoTimestamp(value: string): boolean {
  return ISO_TS_REGEX.test(value);
}

function requireIso(issues: ValidationIssue[], field: string, value: string): void {
  if (!isIsoTimestamp(value)) {
    issues.push({ field, message: 'Must be an ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).' });
  }
}

function requireTrimmedNonEmpty(issues: ValidationIssue[], field: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({ field, message: 'Required.' });
  }
  return trimmed;
}

function optionalTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim();
}

function throwIfIssues(issues: ValidationIssue[]): void {
  if (issues.length > 0) {
    throw new CrmError('validation', 'Validation failed.', { issues });
  }
}

export function createCompany(input: { id: Id; name: string; createdAt: IsoTimestamp }): Company {
  const issues: ValidationIssue[] = [];
  const name = requireTrimmedNonEmpty(issues, 'name', input.name);
  requireIso(issues, 'createdAt', input.createdAt);
  throwIfIssues(issues);
  return { id: input.id, name, createdAt: input.createdAt };
}

export function createContact(input: {
  id: Id;
  displayName: string;
  email?: string;
  companyId?: Id;
  createdAt: IsoTimestamp;
}): Contact {
  const issues: ValidationIssue[] = [];
  const displayName = requireTrimmedNonEmpty(issues, 'displayName', input.displayName);
  const email = optionalTrimmed(input.email);
  if (email !== undefined && !email.includes('@')) {
    issues.push({ field: 'email', message: 'Must contain @.' });
  }
  requireIso(issues, 'createdAt', input.createdAt);
  throwIfIssues(issues);

  const contact: Contact = {
    id: input.id,
    displayName,
    createdAt: input.createdAt,
  };
  if (email !== undefined) contact.email = email;
  if (input.companyId !== undefined) contact.companyId = input.companyId;
  return contact;
}

export function createOpportunity(input: {
  id: Id;
  companyId: Id;
  primaryContactId?: Id;
  title: string;
  amountCents: number;
  currency: string;
  createdAt: IsoTimestamp;
}): Opportunity {
  const issues: ValidationIssue[] = [];
  const title = requireTrimmedNonEmpty(issues, 'title', input.title);

  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    issues.push({ field: 'amountCents', message: 'Must be an integer >= 0.' });
  }

  const currency = input.currency.trim();
  if (!CURRENCY_REGEX.test(currency)) {
    issues.push({ field: 'currency', message: 'Must be a 3-letter uppercase currency code.' });
  }

  requireIso(issues, 'createdAt', input.createdAt);
  throwIfIssues(issues);

  return {
    id: input.id,
    companyId: input.companyId,
    primaryContactId: input.primaryContactId,
    title,
    amountCents: input.amountCents,
    currency,
    stage: 'prospecting',
    createdAt: input.createdAt,
    stageUpdatedAt: input.createdAt,
  };
}

const ALLOWED_STAGE_TRANSITIONS: Record<OpportunityStage, ReadonlySet<OpportunityStage>> = {
  prospecting: new Set(['qualified', 'closed-lost']),
  qualified: new Set(['proposal', 'closed-lost']),
  proposal: new Set(['negotiation', 'closed-lost']),
  negotiation: new Set(['closed-won', 'closed-lost']),
  'closed-won': new Set(),
  'closed-lost': new Set(),
};

export function moveOpportunityStage(
  opportunity: Opportunity,
  toStage: OpportunityStage,
  now: IsoTimestamp,
): Opportunity {
  const issues: ValidationIssue[] = [];
  requireIso(issues, 'now', now);
  throwIfIssues(issues);

  const allowed = ALLOWED_STAGE_TRANSITIONS[opportunity.stage];
  if (!allowed.has(toStage)) {
    throw new CrmError('invalid-transition', 'Stage transition not allowed.', {
      fromStage: opportunity.stage,
      toStage,
    });
  }

  return { ...opportunity, stage: toStage, stageUpdatedAt: now };
}

export function createTask(input: {
  id: Id;
  subject: SubjectRef;
  title: string;
  dueAt?: IsoTimestamp;
  createdAt: IsoTimestamp;
}): Task {
  const issues: ValidationIssue[] = [];
  const title = requireTrimmedNonEmpty(issues, 'title', input.title);
  requireIso(issues, 'createdAt', input.createdAt);
  if (input.dueAt !== undefined) {
    requireIso(issues, 'dueAt', input.dueAt);
  }
  throwIfIssues(issues);

  const task: Task = {
    id: input.id,
    subject: { ...input.subject },
    title,
    status: 'open',
    createdAt: input.createdAt,
  };
  if (input.dueAt !== undefined) task.dueAt = input.dueAt;
  return task;
}

export function completeTask(task: Task, now: IsoTimestamp): Task {
  const issues: ValidationIssue[] = [];
  requireIso(issues, 'now', now);
  throwIfIssues(issues);

  if (task.status !== 'open') {
    throw new CrmError('conflict', 'Task is already completed.');
  }

  return { ...task, status: 'completed', completedAt: now };
}

export function createNote(input: {
  id: Id;
  subject: SubjectRef;
  body: string;
  createdAt: IsoTimestamp;
}): Note {
  const issues: ValidationIssue[] = [];
  const body = requireTrimmedNonEmpty(issues, 'body', input.body);
  requireIso(issues, 'createdAt', input.createdAt);
  throwIfIssues(issues);

  return {
    id: input.id,
    subject: { ...input.subject },
    body,
    createdAt: input.createdAt,
  };
}

export type DashboardState = {
  companies: ReadonlyArray<Company>;
  contacts: ReadonlyArray<Contact>;
  opportunities: ReadonlyArray<Opportunity>;
  tasks: ReadonlyArray<Task>;
  notes: ReadonlyArray<Note>;
};

export type DashboardSummary = {
  totals: {
    companies: number;
    contacts: number;
    opportunities: number;
    tasks: { open: number; completed: number };
    notes: number;
  };
  opportunitiesByStage: Record<OpportunityStage, number>;
  overdueOpenTasks: number;
};

function emptyOpportunitiesByStage(): Record<OpportunityStage, number> {
  return {
    prospecting: 0,
    qualified: 0,
    proposal: 0,
    negotiation: 0,
    'closed-won': 0,
    'closed-lost': 0,
  };
}

export function computeDashboardSummary(state: DashboardState, asOf: IsoTimestamp): DashboardSummary {
  const issues: ValidationIssue[] = [];
  requireIso(issues, 'asOf', asOf);
  throwIfIssues(issues);

  const opportunitiesByStage = emptyOpportunitiesByStage();
  for (const opportunity of state.opportunities) {
    opportunitiesByStage[opportunity.stage] += 1;
  }

  let openTasks = 0;
  let completedTasks = 0;
  let overdueOpenTasks = 0;

  for (const task of state.tasks) {
    if (task.status === 'open') {
      openTasks += 1;
      if (task.dueAt !== undefined && task.dueAt < asOf) {
        overdueOpenTasks += 1;
      }
    } else {
      completedTasks += 1;
    }
  }

  return {
    totals: {
      companies: state.companies.length,
      contacts: state.contacts.length,
      opportunities: state.opportunities.length,
      tasks: { open: openTasks, completed: completedTasks },
      notes: state.notes.length,
    },
    opportunitiesByStage,
    overdueOpenTasks,
  };
}

