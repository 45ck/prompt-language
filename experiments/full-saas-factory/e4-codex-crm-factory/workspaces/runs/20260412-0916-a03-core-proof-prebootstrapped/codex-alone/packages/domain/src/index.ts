export type TimestampMs = number;

type Brand<T, B extends string> = T & { readonly __brand: B };

export type ContactId = Brand<string, 'ContactId'>;
export type CompanyId = Brand<string, 'CompanyId'>;
export type OpportunityId = Brand<string, 'OpportunityId'>;
export type TaskId = Brand<string, 'TaskId'>;
export type NoteId = Brand<string, 'NoteId'>;

export type OpportunityStage =
  | 'Prospecting'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'ClosedWon'
  | 'ClosedLost';

export type DomainErrorCode = 'VALIDATION_FAILED' | 'INVALID_STAGE_TRANSITION';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export type Contact = {
  readonly id: ContactId;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly companyId?: CompanyId;
  readonly createdAt: TimestampMs;
  readonly updatedAt: TimestampMs;
};

export type Company = {
  readonly id: CompanyId;
  readonly name: string;
  readonly domain?: string;
  readonly createdAt: TimestampMs;
  readonly updatedAt: TimestampMs;
};

export type OpportunityStageTransition = {
  readonly from: OpportunityStage;
  readonly to: OpportunityStage;
  readonly at: TimestampMs;
  readonly reason?: string;
};

export type Opportunity = {
  readonly id: OpportunityId;
  readonly companyId: CompanyId;
  readonly primaryContactId?: ContactId;
  readonly title: string;
  readonly valueCents: number;
  readonly currency: string;
  readonly stage: OpportunityStage;
  readonly stageHistory: readonly OpportunityStageTransition[];
  readonly createdAt: TimestampMs;
  readonly updatedAt: TimestampMs;
};

export type TaskStatus = 'Open' | 'Completed';

export type TaskRelatedTo =
  | { readonly type: 'contact'; readonly id: ContactId }
  | { readonly type: 'company'; readonly id: CompanyId }
  | { readonly type: 'opportunity'; readonly id: OpportunityId };

export type Task = {
  readonly id: TaskId;
  readonly subject: string;
  readonly dueAt?: TimestampMs;
  readonly status: TaskStatus;
  readonly relatedTo?: TaskRelatedTo;
  readonly createdAt: TimestampMs;
  readonly updatedAt: TimestampMs;
  readonly completedAt?: TimestampMs;
};

export type NoteRelatedTo = TaskRelatedTo | { readonly type: 'task'; readonly id: TaskId };

export type Note = {
  readonly id: NoteId;
  readonly body: string;
  readonly relatedTo: NoteRelatedTo;
  readonly createdAt: TimestampMs;
  readonly updatedAt: TimestampMs;
};

export function contactId(raw: string): ContactId {
  return brandId(raw, 'con_', 'ContactId');
}

export function companyId(raw: string): CompanyId {
  return brandId(raw, 'com_', 'CompanyId');
}

export function opportunityId(raw: string): OpportunityId {
  return brandId(raw, 'opp_', 'OpportunityId');
}

export function taskId(raw: string): TaskId {
  return brandId(raw, 'tsk_', 'TaskId');
}

export function noteId(raw: string): NoteId {
  return brandId(raw, 'note_', 'NoteId');
}

function brandId<T extends string>(raw: string, prefix: string, brandName: string): Brand<string, T> {
  const value = safeTrim(raw);
  if (!value.startsWith(prefix)) {
    throw new DomainError('VALIDATION_FAILED', `Invalid ${brandName}: expected prefix ${prefix}`, {
      prefix,
      raw
    });
  }
  if (value.length <= prefix.length) {
    throw new DomainError('VALIDATION_FAILED', `Invalid ${brandName}: missing suffix`, { prefix, raw });
  }
  return value as Brand<string, T>;
}

export function createContact(input: {
  id: ContactId;
  name: string;
  now: TimestampMs;
  email?: string;
  phone?: string;
  companyId?: CompanyId;
}): Contact {
  const name = nonEmptyTrimmed(input.name, 'name');
  const email = input.email === undefined ? undefined : normalizeEmail(input.email);
  const phone = input.phone === undefined ? undefined : normalizePhone(input.phone);

  return {
    id: input.id,
    name,
    email,
    phone,
    companyId: input.companyId,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateContact(
  contact: Contact,
  patch: { name?: string; email?: string | null; phone?: string | null; companyId?: CompanyId | null },
  now: TimestampMs
): Contact {
  const nextName = patch.name === undefined ? contact.name : nonEmptyTrimmed(patch.name, 'name');
  const nextEmail =
    patch.email === undefined
      ? contact.email
      : patch.email === null
        ? undefined
        : normalizeEmail(patch.email);
  const nextPhone =
    patch.phone === undefined
      ? contact.phone
      : patch.phone === null
        ? undefined
        : normalizePhone(patch.phone);
  const nextCompanyId =
    patch.companyId === undefined ? contact.companyId : patch.companyId === null ? undefined : patch.companyId;

  return {
    ...contact,
    name: nextName,
    email: nextEmail,
    phone: nextPhone,
    companyId: nextCompanyId,
    updatedAt: now
  };
}

export function createCompany(input: { id: CompanyId; name: string; now: TimestampMs; domain?: string }): Company {
  const name = nonEmptyTrimmed(input.name, 'name');
  const domain = input.domain === undefined ? undefined : normalizeDomain(input.domain);

  return {
    id: input.id,
    name,
    domain,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateCompany(company: Company, patch: { name?: string; domain?: string | null }, now: TimestampMs): Company {
  const nextName = patch.name === undefined ? company.name : nonEmptyTrimmed(patch.name, 'name');
  const nextDomain =
    patch.domain === undefined ? company.domain : patch.domain === null ? undefined : normalizeDomain(patch.domain);

  return { ...company, name: nextName, domain: nextDomain, updatedAt: now };
}

export function createOpportunity(input: {
  id: OpportunityId;
  companyId: CompanyId;
  now: TimestampMs;
  title: string;
  valueCents: number;
  currency?: string;
  stage?: OpportunityStage;
  primaryContactId?: ContactId;
}): Opportunity {
  const title = nonEmptyTrimmed(input.title, 'title');
  const valueCents = nonNegativeInteger(input.valueCents, 'valueCents');
  const currency = input.currency === undefined ? 'USD' : nonEmptyTrimmed(input.currency, 'currency');
  const stage = input.stage ?? 'Prospecting';

  return {
    id: input.id,
    companyId: input.companyId,
    primaryContactId: input.primaryContactId,
    title,
    valueCents,
    currency,
    stage,
    stageHistory: [],
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateOpportunity(
  opportunity: Opportunity,
  patch: { title?: string; valueCents?: number; primaryContactId?: ContactId | null },
  now: TimestampMs
): Opportunity {
  const nextTitle = patch.title === undefined ? opportunity.title : nonEmptyTrimmed(patch.title, 'title');
  const nextValueCents =
    patch.valueCents === undefined ? opportunity.valueCents : nonNegativeInteger(patch.valueCents, 'valueCents');
  const nextPrimaryContactId =
    patch.primaryContactId === undefined
      ? opportunity.primaryContactId
      : patch.primaryContactId === null
        ? undefined
        : patch.primaryContactId;

  return {
    ...opportunity,
    title: nextTitle,
    valueCents: nextValueCents,
    primaryContactId: nextPrimaryContactId,
    updatedAt: now
  };
}

export function canTransitionOpportunityStage(from: OpportunityStage, to: OpportunityStage): boolean {
  if (from === to) return true;
  if (isClosedStage(from)) return false;
  if (to === 'ClosedWon' || to === 'ClosedLost') return true;

  const order: OpportunityStage[] = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'ClosedWon', 'ClosedLost'];
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export function transitionOpportunityStage(
  opportunity: Opportunity,
  to: OpportunityStage,
  at: TimestampMs,
  reason?: string
): Opportunity {
  if (!canTransitionOpportunityStage(opportunity.stage, to)) {
    throw new DomainError('INVALID_STAGE_TRANSITION', `Cannot transition opportunity from ${opportunity.stage} to ${to}`, {
      from: opportunity.stage,
      to
    });
  }

  if (opportunity.stage === to) return { ...opportunity, updatedAt: at };

  const historyEntry: OpportunityStageTransition = {
    from: opportunity.stage,
    to,
    at,
    reason: reason === undefined ? undefined : safeTrim(reason)
  };

  return {
    ...opportunity,
    stage: to,
    stageHistory: [...opportunity.stageHistory, historyEntry],
    updatedAt: at
  };
}

export function createTask(input: {
  id: TaskId;
  subject: string;
  now: TimestampMs;
  dueAt?: TimestampMs;
  relatedTo?: TaskRelatedTo;
}): Task {
  const subject = nonEmptyTrimmed(input.subject, 'subject');
  if (input.dueAt !== undefined) assertFiniteNumber(input.dueAt, 'dueAt');

  return {
    id: input.id,
    subject,
    dueAt: input.dueAt,
    status: 'Open',
    relatedTo: input.relatedTo,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function completeTask(task: Task, at: TimestampMs): Task {
  if (task.status === 'Completed') return { ...task, updatedAt: at };

  return {
    ...task,
    status: 'Completed',
    completedAt: at,
    updatedAt: at
  };
}

export function createNote(input: { id: NoteId; body: string; relatedTo: NoteRelatedTo; now: TimestampMs }): Note {
  const body = nonEmptyTrimmed(input.body, 'body');
  return {
    id: input.id,
    body,
    relatedTo: input.relatedTo,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateNote(note: Note, patch: { body: string }, now: TimestampMs): Note {
  const body = nonEmptyTrimmed(patch.body, 'body');
  return { ...note, body, updatedAt: now };
}

export type DashboardSummary = {
  readonly totals: {
    readonly contacts: number;
    readonly companies: number;
    readonly opportunities: number;
    readonly tasks: number;
    readonly notes: number;
  };
  readonly opportunitiesByStage: Record<OpportunityStage, number>;
  readonly tasks: {
    readonly open: number;
    readonly completed: number;
    readonly overdueOpen: number;
    readonly dueNext7DaysOpen: number;
  };
};

export function buildDashboardSummary(input: {
  now: TimestampMs;
  contacts: readonly Contact[];
  companies: readonly Company[];
  opportunities: readonly Opportunity[];
  tasks: readonly Task[];
  notes: readonly Note[];
}): DashboardSummary {
  const opportunitiesByStage: Record<OpportunityStage, number> = {
    Prospecting: 0,
    Qualified: 0,
    Proposal: 0,
    Negotiation: 0,
    ClosedWon: 0,
    ClosedLost: 0
  };

  for (const opportunity of input.opportunities) {
    opportunitiesByStage[opportunity.stage] += 1;
  }

  let open = 0;
  let completed = 0;
  let overdueOpen = 0;
  let dueNext7DaysOpen = 0;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const dueSoonCutoff = input.now + sevenDaysMs;

  for (const task of input.tasks) {
    if (task.status === 'Open') {
      open += 1;
      if (task.dueAt !== undefined) {
        if (task.dueAt < input.now) overdueOpen += 1;
        if (task.dueAt >= input.now && task.dueAt <= dueSoonCutoff) dueNext7DaysOpen += 1;
      }
    } else {
      completed += 1;
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
    tasks: { open, completed, overdueOpen, dueNext7DaysOpen }
  };
}

function isClosedStage(stage: OpportunityStage): boolean {
  return stage === 'ClosedWon' || stage === 'ClosedLost';
}

function safeTrim(value: string): string {
  return value.trim();
}

function nonEmptyTrimmed(value: string, fieldName: string): string {
  const trimmed = safeTrim(value);
  if (trimmed.length === 0) throw new DomainError('VALIDATION_FAILED', `${fieldName} must not be empty`, { fieldName });
  return trimmed;
}

function assertFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value)) {
    throw new DomainError('VALIDATION_FAILED', `${fieldName} must be a finite number`, { fieldName, value });
  }
}

function nonNegativeInteger(value: number, fieldName: string): number {
  assertFiniteNumber(value, fieldName);
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError('VALIDATION_FAILED', `${fieldName} must be a non-negative integer`, { fieldName, value });
  }
  return value;
}

function normalizeEmail(value: string): string {
  const email = safeTrim(value).toLowerCase();
  if (email.length === 0) throw new DomainError('VALIDATION_FAILED', 'email must not be empty', { value });
  if (email.includes(' ')) throw new DomainError('VALIDATION_FAILED', 'email must not contain spaces', { value });
  const parts = email.split('@');
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    throw new DomainError('VALIDATION_FAILED', 'email must be in the form local@domain', { value });
  }
  if (!parts[1].includes('.')) {
    throw new DomainError('VALIDATION_FAILED', 'email domain must contain a dot', { value });
  }
  return email;
}

function normalizeDomain(value: string): string {
  const domain = safeTrim(value).toLowerCase();
  if (domain.length === 0) throw new DomainError('VALIDATION_FAILED', 'domain must not be empty', { value });
  if (domain.includes(' ')) throw new DomainError('VALIDATION_FAILED', 'domain must not contain spaces', { value });
  return domain;
}

function normalizePhone(value: string): string {
  const phone = safeTrim(value);
  if (phone.length === 0) throw new DomainError('VALIDATION_FAILED', 'phone must not be empty', { value });
  return phone;
}
