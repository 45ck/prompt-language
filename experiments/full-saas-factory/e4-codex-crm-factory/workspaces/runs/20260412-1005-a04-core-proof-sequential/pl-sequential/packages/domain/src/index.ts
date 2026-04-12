export type CrmErrorCode =
  | 'validation_error'
  | 'duplicate_id'
  | 'reference_not_found'
  | 'invalid_stage_transition';

export class CrmError extends Error {
  readonly code: CrmErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CrmErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? code);
    this.name = 'CrmError';
    this.code = code;
    this.details = details;
  }
}

export type SubjectType = 'company' | 'contact' | 'opportunity';
export type SubjectRef = { type: SubjectType; id: string };

export type Company = {
  id: string;
  name: string;
  createdAt: string;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  companyId?: string;
  createdAt: string;
};

export type OpportunityStage =
  | 'Prospecting'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'ClosedWon'
  | 'ClosedLost';

export type OpportunityStageChange = {
  from: OpportunityStage;
  to: OpportunityStage;
  at: string;
};

export type Opportunity = {
  id: string;
  companyId: string;
  name: string;
  stage: OpportunityStage;
  amountCents: number;
  primaryContactId?: string;
  createdAt: string;
  stageHistory: OpportunityStageChange[];
};

export type TaskStatus = 'open' | 'done';

export type Task = {
  id: string;
  subject: SubjectRef;
  title: string;
  dueOn: string;
  status: TaskStatus;
  createdAt: string;
};

export type Note = {
  id: string;
  subject: SubjectRef;
  body: string;
  createdAt: string;
};

export type DashboardSummary = {
  companiesTotal: number;
  contactsTotal: number;
  opportunitiesTotal: number;
  openOpportunitiesTotal: number;
  opportunitiesByStage: Record<OpportunityStage, number>;
  openOpportunityAmountCentsTotal: number;
  openTasksTotal: number;
  openTasksOverdue: number;
  openTasksDueToday: number;
};

const iso8601UtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const yyyymmddRegex = /^\d{4}-\d{2}-\d{2}$/;

function assertNonEmpty(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CrmError('validation_error', `${field} must be non-empty`, { field });
  }
}

function assertIso8601(value: string, field: string): void {
  assertNonEmpty(value, field);
  if (!iso8601UtcRegex.test(value)) {
    throw new CrmError('validation_error', `${field} must be ISO-8601 UTC`, {
      field,
      format: 'iso8601_utc'
    });
  }
}

function assertYyyyMmDd(value: string, field: string): void {
  assertNonEmpty(value, field);
  if (!yyyymmddRegex.test(value)) {
    throw new CrmError('validation_error', `${field} must be YYYY-MM-DD`, {
      field,
      format: 'yyyy_mm_dd'
    });
  }
}

function assertEmail(value: string, field: string): void {
  assertNonEmpty(value, field);
  if (/\s/.test(value)) {
    throw new CrmError('validation_error', `${field} must be a valid email`, { field });
  }

  const parts = value.split('@');
  if (parts.length !== 2) {
    throw new CrmError('validation_error', `${field} must be a valid email`, { field });
  }
  const [local, domain] = parts;
  if (local.length === 0 || domain.length === 0) {
    throw new CrmError('validation_error', `${field} must be a valid email`, { field });
  }
  if (!domain.includes('.')) {
    throw new CrmError('validation_error', `${field} must be a valid email`, { field });
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new CrmError('validation_error', `${field} must be a non-negative integer`, { field });
  }
}

export function createCompany(input: { id: string; name: string; now: string }): Company {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.name, 'name');
  assertIso8601(input.now, 'now');

  return {
    id: input.id,
    name: input.name,
    createdAt: input.now
  };
}

export function createContact(input: {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  companyId?: string;
  now: string;
}): Contact {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.firstName, 'firstName');
  assertNonEmpty(input.lastName, 'lastName');
  if (input.email !== undefined) {
    assertEmail(input.email, 'email');
  }
  if (input.companyId !== undefined) {
    assertNonEmpty(input.companyId, 'companyId');
  }
  assertIso8601(input.now, 'now');

  return {
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    companyId: input.companyId,
    createdAt: input.now
  };
}

export function createOpportunity(input: {
  id: string;
  companyId: string;
  name: string;
  amountCents: number;
  primaryContactId?: string;
  now: string;
}): Opportunity {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.companyId, 'companyId');
  assertNonEmpty(input.name, 'name');
  assertNonNegativeInteger(input.amountCents, 'amountCents');
  if (input.primaryContactId !== undefined) {
    assertNonEmpty(input.primaryContactId, 'primaryContactId');
  }
  assertIso8601(input.now, 'now');

  return {
    id: input.id,
    companyId: input.companyId,
    name: input.name,
    stage: 'Prospecting',
    amountCents: input.amountCents,
    primaryContactId: input.primaryContactId,
    createdAt: input.now,
    stageHistory: []
  };
}

const openStages: OpportunityStage[] = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation'];
const orderedWinPath: OpportunityStage[] = [
  'Prospecting',
  'Qualified',
  'Proposal',
  'Negotiation',
  'ClosedWon'
];

function isOpenStage(stage: OpportunityStage): boolean {
  return openStages.includes(stage);
}

function isTerminalStage(stage: OpportunityStage): boolean {
  return stage === 'ClosedWon' || stage === 'ClosedLost';
}

function isValidStageTransition(from: OpportunityStage, to: OpportunityStage): boolean {
  if (from === to) {
    return false;
  }
  if (isTerminalStage(from)) {
    return false;
  }
  if (to === 'ClosedLost') {
    return isOpenStage(from);
  }

  const fromIndex = orderedWinPath.indexOf(from);
  if (fromIndex === -1) {
    return false;
  }
  return orderedWinPath[fromIndex + 1] === to;
}

export function moveOpportunityStage(input: {
  opportunity: Opportunity;
  to: OpportunityStage;
  at: string;
}): Opportunity {
  const { opportunity, to, at } = input;
  assertIso8601(at, 'at');

  const from = opportunity.stage;
  if (!isValidStageTransition(from, to)) {
    throw new CrmError('invalid_stage_transition', `Invalid stage transition: ${from} -> ${to}`, {
      from,
      to
    });
  }

  return {
    ...opportunity,
    stage: to,
    stageHistory: [...opportunity.stageHistory, { from, to, at }]
  };
}

export function createTask(input: {
  id: string;
  subject: SubjectRef;
  title: string;
  dueOn: string;
  now: string;
}): Task {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.subject.id, 'subject.id');
  assertNonEmpty(input.subject.type, 'subject.type');
  assertNonEmpty(input.title, 'title');
  assertYyyyMmDd(input.dueOn, 'dueOn');
  assertIso8601(input.now, 'now');

  return {
    id: input.id,
    subject: input.subject,
    title: input.title,
    dueOn: input.dueOn,
    status: 'open',
    createdAt: input.now
  };
}

export function markTaskDone(task: Task): Task {
  return {
    ...task,
    status: 'done'
  };
}

export function createNote(input: { id: string; subject: SubjectRef; body: string; now: string }): Note {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.subject.id, 'subject.id');
  assertNonEmpty(input.subject.type, 'subject.type');
  assertNonEmpty(input.body, 'body');
  assertIso8601(input.now, 'now');

  return {
    id: input.id,
    subject: input.subject,
    body: input.body,
    createdAt: input.now
  };
}

export function computeDashboardSummary(input: {
  companies: Company[];
  contacts: Contact[];
  opportunities: Opportunity[];
  tasks: Task[];
  today: string;
}): DashboardSummary {
  assertYyyyMmDd(input.today, 'today');

  const opportunitiesByStage: Record<OpportunityStage, number> = {
    Prospecting: 0,
    Qualified: 0,
    Proposal: 0,
    Negotiation: 0,
    ClosedWon: 0,
    ClosedLost: 0
  };

  let openOpportunitiesTotal = 0;
  let openOpportunityAmountCentsTotal = 0;
  for (const opportunity of input.opportunities) {
    opportunitiesByStage[opportunity.stage] += 1;
    if (opportunity.stage !== 'ClosedWon' && opportunity.stage !== 'ClosedLost') {
      openOpportunitiesTotal += 1;
      openOpportunityAmountCentsTotal += opportunity.amountCents;
    }
  }

  let openTasksTotal = 0;
  let openTasksOverdue = 0;
  let openTasksDueToday = 0;
  for (const task of input.tasks) {
    if (task.status !== 'open') {
      continue;
    }
    openTasksTotal += 1;
    if (task.dueOn < input.today) {
      openTasksOverdue += 1;
    } else if (task.dueOn === input.today) {
      openTasksDueToday += 1;
    }
  }

  return {
    companiesTotal: input.companies.length,
    contactsTotal: input.contacts.length,
    opportunitiesTotal: input.opportunities.length,
    openOpportunitiesTotal,
    opportunitiesByStage,
    openOpportunityAmountCentsTotal,
    openTasksTotal,
    openTasksOverdue,
    openTasksDueToday
  };
}

