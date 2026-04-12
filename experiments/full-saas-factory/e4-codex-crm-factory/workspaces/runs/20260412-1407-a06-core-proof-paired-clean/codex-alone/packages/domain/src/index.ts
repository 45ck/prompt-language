export type CompanyId = string;
export type ContactId = string;
export type OpportunityId = string;
export type TaskId = string;
export type NoteId = string;

export type DomainErrorCode =
  | 'EMPTY_FIELD'
  | 'EMPTY_ID'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  | 'INVALID_DATE'
  | 'INVALID_DATE_ORDER'
  | 'INVALID_DOMAIN'
  | 'INVALID_EMAIL'
  | 'INVALID_STAGE_TRANSITION'
  | 'INVALID_TASK_STATUS_TRANSITION';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(
    code: DomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'DomainError';
  }
}

function assert(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    throw new DomainError(code, message, details);
  }
}

function toTrimmed(value: string, field: string): string {
  assert(typeof value === 'string', 'EMPTY_FIELD', `${field} must be a string`, {
    field,
  });
  const trimmed = value.trim();
  assert(trimmed.length > 0, 'EMPTY_FIELD', `${field} must be non-empty`, {
    field,
  });
  return trimmed;
}

function assertNonEmptyId(value: string, field: string): void {
  assert(typeof value === 'string', 'EMPTY_ID', `${field} must be a string`, {
    field,
  });
  assert(value.trim().length > 0, 'EMPTY_ID', `${field} must be non-empty`, {
    field,
    value,
  });
}

function assertValidDate(value: Date, field: string): void {
  assert(value instanceof Date, 'INVALID_DATE', `${field} must be a Date`, {
    field,
  });
  assert(!Number.isNaN(value.getTime()), 'INVALID_DATE', `${field} is invalid`, {
    field,
  });
}

function assertNotBefore(earlier: Date, later: Date, label: string): void {
  assertValidDate(earlier, `${label}.earlier`);
  assertValidDate(later, `${label}.later`);
  assert(
    later.getTime() >= earlier.getTime(),
    'INVALID_DATE_ORDER',
    `${label} must be non-decreasing`,
    { earlier: earlier.toISOString(), later: later.toISOString() },
  );
}

function normalizeEmail(value: string): string {
  const trimmed = toTrimmed(value, 'email');
  const normalized = trimmed.toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  assert(ok, 'INVALID_EMAIL', 'email is invalid', { email: value });
  return normalized;
}

function normalizeDomain(value: string): string {
  const trimmed = toTrimmed(value, 'domain');
  const normalized = trimmed.toLowerCase();
  const ok = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized);
  assert(ok, 'INVALID_DOMAIN', 'domain is invalid', { domain: value });
  return normalized;
}

function assertCurrency(value: string): void {
  assert(typeof value === 'string', 'INVALID_CURRENCY', 'currency must be a string', {
    currency: value,
  });
  const ok = /^[A-Z]{3}$/.test(value);
  assert(ok, 'INVALID_CURRENCY', 'currency must be a 3-letter ISO code', {
    currency: value,
  });
}

function assertAmountCents(value: number): void {
  assert(
    Number.isInteger(value) && value >= 0,
    'INVALID_AMOUNT',
    'amountCents must be a non-negative integer',
    { amountCents: value },
  );
}

export interface Company {
  readonly id: CompanyId;
  readonly name: string;
  readonly domain?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Contact {
  readonly id: ContactId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string | undefined;
  readonly companyId?: CompanyId | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type OpportunityStage =
  | 'Prospecting'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'ClosedWon'
  | 'ClosedLost';

export const opportunityOpenStages: readonly OpportunityStage[] = [
  'Prospecting',
  'Qualified',
  'Proposal',
  'Negotiation',
] as const;

export const opportunityClosedStages: readonly OpportunityStage[] = [
  'ClosedWon',
  'ClosedLost',
] as const;

export function isClosedOpportunityStage(
  stage: OpportunityStage,
): stage is 'ClosedWon' | 'ClosedLost' {
  return stage === 'ClosedWon' || stage === 'ClosedLost';
}

export interface Opportunity {
  readonly id: OpportunityId;
  readonly companyId: CompanyId;
  readonly primaryContactId?: ContactId | undefined;
  readonly title: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly stage: OpportunityStage;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly closedAt?: Date | undefined;
}

export type EntityRef =
  | { readonly type: 'company'; readonly id: CompanyId }
  | { readonly type: 'contact'; readonly id: ContactId }
  | { readonly type: 'opportunity'; readonly id: OpportunityId };

export type TaskStatus = 'Open' | 'Completed' | 'Canceled';

export interface Task {
  readonly id: TaskId;
  readonly title: string;
  readonly status: TaskStatus;
  readonly dueAt?: Date | undefined;
  readonly related?: EntityRef | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt?: Date | undefined;
  readonly canceledAt?: Date | undefined;
}

export interface Note {
  readonly id: NoteId;
  readonly body: string;
  readonly related: EntityRef;
  readonly createdAt: Date;
}

export interface CreateCompanyInput {
  readonly id: CompanyId;
  readonly name: string;
  readonly domain?: string | undefined;
  readonly at: Date;
}

export function createCompany(input: CreateCompanyInput): Company {
  assertNonEmptyId(input.id, 'company.id');
  const at = input.at;
  assertValidDate(at, 'company.at');

  const name = toTrimmed(input.name, 'company.name');
  const domain = input.domain === undefined ? undefined : normalizeDomain(input.domain);

  return {
    id: input.id,
    name,
    domain,
    createdAt: new Date(at.getTime()),
    updatedAt: new Date(at.getTime()),
  };
}

export interface RenameCompanyInput {
  readonly company: Company;
  readonly name: string;
  readonly at: Date;
}

export function renameCompany(input: RenameCompanyInput): Company {
  assertNonEmptyId(input.company.id, 'company.id');
  const at = input.at;
  assertValidDate(at, 'company.at');
  assertNotBefore(input.company.updatedAt, at, 'company.updatedAt');

  const name = toTrimmed(input.name, 'company.name');
  return {
    ...input.company,
    name,
    updatedAt: new Date(at.getTime()),
  };
}

export interface CreateContactInput {
  readonly id: ContactId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string | undefined;
  readonly companyId?: CompanyId | undefined;
  readonly at: Date;
}

export function createContact(input: CreateContactInput): Contact {
  assertNonEmptyId(input.id, 'contact.id');
  const at = input.at;
  assertValidDate(at, 'contact.at');

  const firstName = toTrimmed(input.firstName, 'contact.firstName');
  const lastName = toTrimmed(input.lastName, 'contact.lastName');
  const email = input.email === undefined ? undefined : normalizeEmail(input.email);
  if (input.companyId !== undefined) {
    assertNonEmptyId(input.companyId, 'contact.companyId');
  }

  return {
    id: input.id,
    firstName,
    lastName,
    email,
    companyId: input.companyId,
    createdAt: new Date(at.getTime()),
    updatedAt: new Date(at.getTime()),
  };
}

export interface UpdateContactCompanyInput {
  readonly contact: Contact;
  readonly companyId?: CompanyId | undefined;
  readonly at: Date;
}

export function updateContactCompany(input: UpdateContactCompanyInput): Contact {
  assertNonEmptyId(input.contact.id, 'contact.id');
  const at = input.at;
  assertValidDate(at, 'contact.at');
  assertNotBefore(input.contact.updatedAt, at, 'contact.updatedAt');
  if (input.companyId !== undefined) {
    assertNonEmptyId(input.companyId, 'contact.companyId');
  }

  return {
    ...input.contact,
    companyId: input.companyId,
    updatedAt: new Date(at.getTime()),
  };
}

export interface CreateOpportunityInput {
  readonly id: OpportunityId;
  readonly companyId: CompanyId;
  readonly primaryContactId?: ContactId | undefined;
  readonly title: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly stage?: OpportunityStage | undefined;
  readonly at: Date;
}

export function createOpportunity(input: CreateOpportunityInput): Opportunity {
  assertNonEmptyId(input.id, 'opportunity.id');
  assertNonEmptyId(input.companyId, 'opportunity.companyId');
  if (input.primaryContactId !== undefined) {
    assertNonEmptyId(input.primaryContactId, 'opportunity.primaryContactId');
  }
  const at = input.at;
  assertValidDate(at, 'opportunity.at');

  const title = toTrimmed(input.title, 'opportunity.title');
  assertAmountCents(input.amountCents);
  assertCurrency(input.currency);

  const stage = input.stage ?? 'Prospecting';
  const closedAt = isClosedOpportunityStage(stage) ? new Date(at.getTime()) : undefined;

  return {
    id: input.id,
    companyId: input.companyId,
    primaryContactId: input.primaryContactId,
    title,
    amountCents: input.amountCents,
    currency: input.currency,
    stage,
    createdAt: new Date(at.getTime()),
    updatedAt: new Date(at.getTime()),
    closedAt,
  };
}

const allowedStageTransitions: Readonly<Record<OpportunityStage, readonly OpportunityStage[]>> =
  {
    Prospecting: ['Qualified', 'ClosedLost'],
    Qualified: ['Proposal', 'ClosedLost'],
    Proposal: ['Negotiation', 'ClosedLost'],
    Negotiation: ['ClosedWon', 'ClosedLost'],
    ClosedWon: [],
    ClosedLost: [],
  };

export function canTransitionOpportunityStage(
  from: OpportunityStage,
  to: OpportunityStage,
): boolean {
  return allowedStageTransitions[from].includes(to);
}

export interface TransitionOpportunityStageInput {
  readonly opportunity: Opportunity;
  readonly toStage: OpportunityStage;
  readonly at: Date;
}

export function transitionOpportunityStage(
  input: TransitionOpportunityStageInput,
): Opportunity {
  const opportunity = input.opportunity;
  assertNonEmptyId(opportunity.id, 'opportunity.id');
  const at = input.at;
  assertValidDate(at, 'opportunity.at');
  assertNotBefore(opportunity.updatedAt, at, 'opportunity.updatedAt');

  assert(
    canTransitionOpportunityStage(opportunity.stage, input.toStage),
    'INVALID_STAGE_TRANSITION',
    `cannot transition opportunity stage from ${opportunity.stage} to ${input.toStage}`,
    { from: opportunity.stage, to: input.toStage },
  );

  const toStage = input.toStage;
  const closedAt = isClosedOpportunityStage(toStage) ? new Date(at.getTime()) : undefined;

  return {
    ...opportunity,
    stage: toStage,
    updatedAt: new Date(at.getTime()),
    closedAt,
  };
}

export interface CreateTaskInput {
  readonly id: TaskId;
  readonly title: string;
  readonly dueAt?: Date | undefined;
  readonly related?: EntityRef | undefined;
  readonly at: Date;
}

export function createTask(input: CreateTaskInput): Task {
  assertNonEmptyId(input.id, 'task.id');
  const at = input.at;
  assertValidDate(at, 'task.at');
  const title = toTrimmed(input.title, 'task.title');
  if (input.dueAt !== undefined) {
    assertValidDate(input.dueAt, 'task.dueAt');
  }
  if (input.related !== undefined) {
    assertNonEmptyId(input.related.id, 'task.related.id');
  }

  return {
    id: input.id,
    title,
    status: 'Open',
    dueAt: input.dueAt === undefined ? undefined : new Date(input.dueAt.getTime()),
    related: input.related,
    createdAt: new Date(at.getTime()),
    updatedAt: new Date(at.getTime()),
  };
}

export interface CompleteTaskInput {
  readonly task: Task;
  readonly at: Date;
}

export function completeTask(input: CompleteTaskInput): Task {
  assertNonEmptyId(input.task.id, 'task.id');
  const at = input.at;
  assertValidDate(at, 'task.at');
  assertNotBefore(input.task.updatedAt, at, 'task.updatedAt');

  assert(
    input.task.status === 'Open',
    'INVALID_TASK_STATUS_TRANSITION',
    `cannot complete task from status ${input.task.status}`,
    { from: input.task.status, to: 'Completed' },
  );

  return {
    ...input.task,
    status: 'Completed',
    completedAt: new Date(at.getTime()),
    updatedAt: new Date(at.getTime()),
  };
}

export interface CancelTaskInput {
  readonly task: Task;
  readonly at: Date;
}

export function cancelTask(input: CancelTaskInput): Task {
  assertNonEmptyId(input.task.id, 'task.id');
  const at = input.at;
  assertValidDate(at, 'task.at');
  assertNotBefore(input.task.updatedAt, at, 'task.updatedAt');

  assert(
    input.task.status === 'Open',
    'INVALID_TASK_STATUS_TRANSITION',
    `cannot cancel task from status ${input.task.status}`,
    { from: input.task.status, to: 'Canceled' },
  );

  return {
    ...input.task,
    status: 'Canceled',
    canceledAt: new Date(at.getTime()),
    updatedAt: new Date(at.getTime()),
  };
}

export interface CreateNoteInput {
  readonly id: NoteId;
  readonly body: string;
  readonly related: EntityRef;
  readonly at: Date;
}

export function createNote(input: CreateNoteInput): Note {
  assertNonEmptyId(input.id, 'note.id');
  assertNonEmptyId(input.related.id, 'note.related.id');
  const at = input.at;
  assertValidDate(at, 'note.at');
  const body = toTrimmed(input.body, 'note.body');
  assert(body.length <= 5000, 'EMPTY_FIELD', 'note.body is too long', {
    maxLength: 5000,
    length: body.length,
  });

  return {
    id: input.id,
    body,
    related: input.related,
    createdAt: new Date(at.getTime()),
  };
}

export interface NotePreview {
  readonly id: NoteId;
  readonly related: EntityRef;
  readonly createdAt: Date;
  readonly excerpt: string;
}

export interface DashboardSummary {
  readonly counts: {
    readonly companies: number;
    readonly contacts: number;
    readonly opportunities: number;
    readonly opportunitiesOpen: number;
    readonly opportunitiesClosedWon: number;
    readonly opportunitiesClosedLost: number;
    readonly tasks: number;
    readonly tasksOpen: number;
    readonly tasksOverdue: number;
    readonly notes: number;
  };
  readonly pipeline: {
    readonly openAmountCentsTotal: number;
    readonly openAmountCentsByStage: Record<OpportunityStage, number>;
  };
  readonly recentNotes: readonly NotePreview[];
}

function compareByCreatedAtDescThenId(a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }): number {
  const delta = b.createdAt.getTime() - a.createdAt.getTime();
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

export interface BuildDashboardSummaryInput {
  readonly companies: readonly Company[];
  readonly contacts: readonly Contact[];
  readonly opportunities: readonly Opportunity[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly now: Date;
  readonly recentNoteLimit?: number | undefined;
  readonly noteExcerptLength?: number | undefined;
}

export function buildDashboardSummary(input: BuildDashboardSummaryInput): DashboardSummary {
  assertValidDate(input.now, 'dashboard.now');
  const recentLimit = input.recentNoteLimit ?? 10;
  const excerptLength = input.noteExcerptLength ?? 120;
  assert(
    Number.isInteger(recentLimit) && recentLimit >= 0,
    'EMPTY_FIELD',
    'recentNoteLimit must be a non-negative integer',
    { recentNoteLimit: recentLimit },
  );
  assert(
    Number.isInteger(excerptLength) && excerptLength >= 0,
    'EMPTY_FIELD',
    'noteExcerptLength must be a non-negative integer',
    { noteExcerptLength: excerptLength },
  );

  const pipelineByStage: Record<OpportunityStage, number> = {
    Prospecting: 0,
    Qualified: 0,
    Proposal: 0,
    Negotiation: 0,
    ClosedWon: 0,
    ClosedLost: 0,
  };

  let opportunitiesOpen = 0;
  let opportunitiesClosedWon = 0;
  let opportunitiesClosedLost = 0;
  let openAmountTotal = 0;

  for (const opportunity of input.opportunities) {
    if (isClosedOpportunityStage(opportunity.stage)) {
      if (opportunity.stage === 'ClosedWon') opportunitiesClosedWon += 1;
      if (opportunity.stage === 'ClosedLost') opportunitiesClosedLost += 1;
      continue;
    }

    opportunitiesOpen += 1;
    openAmountTotal += opportunity.amountCents;
    pipelineByStage[opportunity.stage] += opportunity.amountCents;
  }

  let tasksOpen = 0;
  let tasksOverdue = 0;
  const nowMs = input.now.getTime();

  for (const task of input.tasks) {
    if (task.status !== 'Open') continue;
    tasksOpen += 1;
    if (task.dueAt !== undefined && task.dueAt.getTime() < nowMs) {
      tasksOverdue += 1;
    }
  }

  const recentNotes = [...input.notes]
    .sort(compareByCreatedAtDescThenId)
    .slice(0, recentLimit)
    .map((note): NotePreview => ({
      id: note.id,
      related: note.related,
      createdAt: new Date(note.createdAt.getTime()),
      excerpt: note.body.length <= excerptLength ? note.body : `${note.body.slice(0, excerptLength)}…`,
    }));

  return {
    counts: {
      companies: input.companies.length,
      contacts: input.contacts.length,
      opportunities: input.opportunities.length,
      opportunitiesOpen,
      opportunitiesClosedWon,
      opportunitiesClosedLost,
      tasks: input.tasks.length,
      tasksOpen,
      tasksOverdue,
      notes: input.notes.length,
    },
    pipeline: {
      openAmountCentsTotal: openAmountTotal,
      openAmountCentsByStage: pipelineByStage,
    },
    recentNotes,
  };
}

