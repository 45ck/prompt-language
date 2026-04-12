type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type Timestamp = string;
export type CalendarDate = string;

export type ContactId = Brand<string, 'ContactId'>;
export type CompanyId = Brand<string, 'CompanyId'>;
export type OpportunityId = Brand<string, 'OpportunityId'>;
export type TaskId = Brand<string, 'TaskId'>;
export type NoteId = Brand<string, 'NoteId'>;

export type OpportunityStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Won'
  | 'Lost';

export type TaskStatus = 'Open' | 'Completed';
export type LinkedEntityType = 'Contact' | 'Company' | 'Opportunity';
export type LinkedEntityId = ContactId | CompanyId | OpportunityId;

export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Lost'
];

export const TASK_STATUSES: readonly TaskStatus[] = ['Open', 'Completed'];
export const LINKED_ENTITY_TYPES: readonly LinkedEntityType[] = [
  'Contact',
  'Company',
  'Opportunity'
];

export interface Contact {
  readonly id: ContactId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly companyId?: CompanyId;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface Company {
  readonly id: CompanyId;
  readonly name: string;
  readonly website?: string;
  readonly industry?: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface Opportunity {
  readonly id: OpportunityId;
  readonly name: string;
  readonly companyId: CompanyId;
  readonly primaryContactId?: ContactId;
  readonly stage: OpportunityStage;
  readonly amount?: number;
  readonly targetCloseDate?: CalendarDate;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly closedAt?: Timestamp;
}

export interface Task {
  readonly id: TaskId;
  readonly title: string;
  readonly status: TaskStatus;
  readonly dueDate?: CalendarDate;
  readonly linkedEntityType: LinkedEntityType;
  readonly linkedEntityId: LinkedEntityId;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly completedAt?: Timestamp;
}

export interface Note {
  readonly id: NoteId;
  readonly body: string;
  readonly linkedEntityType: LinkedEntityType;
  readonly linkedEntityId: LinkedEntityId;
  readonly createdAt: Timestamp;
}

export type OpportunityCountByStage = Record<OpportunityStage, number>;

export interface DashboardSummary {
  readonly totalContacts: number;
  readonly totalCompanies: number;
  readonly openTaskCount: number;
  readonly overdueTaskCount: number;
  readonly opportunityCountByStage: OpportunityCountByStage;
  readonly openPipelineAmount: number;
}

export interface EntityReferenceCollections {
  readonly contacts?: readonly Pick<Contact, 'id'>[];
  readonly companies?: readonly Pick<Company, 'id'>[];
  readonly opportunities?: readonly Pick<Opportunity, 'id'>[];
}

export interface CreateContactInput {
  readonly id: ContactId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly companyId?: CompanyId;
  readonly now: Timestamp;
}

export interface UpdateContactInput {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly companyId?: CompanyId;
  readonly now: Timestamp;
}

export interface CreateCompanyInput {
  readonly id: CompanyId;
  readonly name: string;
  readonly website?: string;
  readonly industry?: string;
  readonly now: Timestamp;
}

export interface UpdateCompanyInput {
  readonly name?: string;
  readonly website?: string;
  readonly industry?: string;
  readonly now: Timestamp;
}

export interface CreateOpportunityInput {
  readonly id: OpportunityId;
  readonly name: string;
  readonly companyId: CompanyId;
  readonly primaryContactId?: ContactId;
  readonly stage?: OpportunityStage;
  readonly amount?: number;
  readonly targetCloseDate?: CalendarDate;
  readonly now: Timestamp;
}

export interface UpdateOpportunityInput {
  readonly name?: string;
  readonly companyId?: CompanyId;
  readonly primaryContactId?: ContactId;
  readonly amount?: number;
  readonly targetCloseDate?: CalendarDate;
  readonly now: Timestamp;
}

export interface CreateTaskInput {
  readonly id: TaskId;
  readonly title: string;
  readonly dueDate?: CalendarDate;
  readonly linkedEntityType: LinkedEntityType;
  readonly linkedEntityId: LinkedEntityId;
  readonly now: Timestamp;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly dueDate?: CalendarDate;
  readonly now: Timestamp;
}

export interface CreateNoteInput {
  readonly id: NoteId;
  readonly body: string;
  readonly linkedEntityType: LinkedEntityType;
  readonly linkedEntityId: LinkedEntityId;
  readonly now: Timestamp;
}

const ACTIVE_OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  'Lead',
  'Qualified',
  'Proposal'
];

const ALLOWED_STAGE_TRANSITIONS: Readonly<
  Record<OpportunityStage, readonly OpportunityStage[]>
> = {
  Lead: ['Qualified', 'Lost'],
  Qualified: ['Proposal', 'Lost'],
  Proposal: ['Won', 'Lost'],
  Won: [],
  Lost: []
};

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase();
}

export function allowedNextStages(
  stage: OpportunityStage
): readonly OpportunityStage[] {
  return ALLOWED_STAGE_TRANSITIONS[stage];
}

export function isClosedOpportunityStage(stage: OpportunityStage): boolean {
  return stage === 'Won' || stage === 'Lost';
}

export function isActiveOpportunityStage(stage: OpportunityStage): boolean {
  return ACTIVE_OPPORTUNITY_STAGES.includes(stage);
}

export function createContact(
  input: CreateContactInput,
  existingContacts: readonly Contact[] = [],
  existingCompanies: readonly Pick<Company, 'id'>[] = []
): Contact {
  const firstName = requireText(input.firstName, 'Contact firstName');
  const lastName = requireText(input.lastName, 'Contact lastName');
  const email = normalizeOptionalEmail(input.email);
  const phone = normalizeOptionalText(input.phone);

  assertUniqueContactEmail(email, existingContacts);
  assertCompanyExists(input.companyId, existingCompanies);

  return {
    id: input.id,
    firstName,
    lastName,
    email,
    phone,
    companyId: input.companyId,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateContact(
  current: Contact,
  input: UpdateContactInput,
  existingContacts: readonly Contact[] = [],
  existingCompanies: readonly Pick<Company, 'id'>[] = []
): Contact {
  const next: Contact = {
    ...current,
    firstName:
      input.firstName === undefined
        ? current.firstName
        : requireText(input.firstName, 'Contact firstName'),
    lastName:
      input.lastName === undefined
        ? current.lastName
        : requireText(input.lastName, 'Contact lastName'),
    email:
      input.email === undefined ? current.email : normalizeOptionalEmail(input.email),
    phone:
      input.phone === undefined ? current.phone : normalizeOptionalText(input.phone),
    companyId: input.companyId === undefined ? current.companyId : input.companyId,
    updatedAt: input.now
  };

  assertUniqueContactEmail(next.email, existingContacts, current.id);
  assertCompanyExists(next.companyId, existingCompanies);

  return next;
}

export function searchContacts(
  contacts: readonly Contact[],
  query: string
): Contact[] {
  return contacts.filter((contact) =>
    matchesQuery(
      [contact.firstName, contact.lastName, contact.email ?? ''].join(' '),
      query
    )
  );
}

export function createCompany(
  input: CreateCompanyInput,
  existingCompanies: readonly Company[] = []
): Company {
  const name = requireText(input.name, 'Company name');
  const website = normalizeOptionalText(input.website);
  const industry = normalizeOptionalText(input.industry);

  assertUniqueCompanyName(name, existingCompanies);

  return {
    id: input.id,
    name,
    website,
    industry,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateCompany(
  current: Company,
  input: UpdateCompanyInput,
  existingCompanies: readonly Company[] = []
): Company {
  const next: Company = {
    ...current,
    name:
      input.name === undefined
        ? current.name
        : requireText(input.name, 'Company name'),
    website:
      input.website === undefined
        ? current.website
        : normalizeOptionalText(input.website),
    industry:
      input.industry === undefined
        ? current.industry
        : normalizeOptionalText(input.industry),
    updatedAt: input.now
  };

  assertUniqueCompanyName(next.name, existingCompanies, current.id);

  return next;
}

export function searchCompanies(
  companies: readonly Company[],
  query: string
): Company[] {
  return companies.filter((company) => matchesQuery(company.name, query));
}

export function createOpportunity(
  input: CreateOpportunityInput,
  existingCompanies: readonly Pick<Company, 'id'>[],
  existingContacts: readonly Pick<Contact, 'id'>[] = []
): Opportunity {
  const name = requireText(input.name, 'Opportunity name');

  if (input.stage !== undefined && input.stage !== 'Lead') {
    throw new DomainValidationError(
      'New opportunities must start in stage Lead.'
    );
  }

  assertCompanyExists(input.companyId, existingCompanies);
  assertContactExists(input.primaryContactId, existingContacts);
  assertNonNegativeAmount(input.amount);

  return {
    id: input.id,
    name,
    companyId: input.companyId,
    primaryContactId: input.primaryContactId,
    stage: 'Lead',
    amount: input.amount,
    targetCloseDate: normalizeOptionalText(input.targetCloseDate),
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateOpportunity(
  current: Opportunity,
  input: UpdateOpportunityInput,
  existingCompanies: readonly Pick<Company, 'id'>[],
  existingContacts: readonly Pick<Contact, 'id'>[] = []
): Opportunity {
  const next: Opportunity = {
    ...current,
    name:
      input.name === undefined
        ? current.name
        : requireText(input.name, 'Opportunity name'),
    companyId: input.companyId === undefined ? current.companyId : input.companyId,
    primaryContactId:
      input.primaryContactId === undefined
        ? current.primaryContactId
        : input.primaryContactId,
    amount: input.amount === undefined ? current.amount : input.amount,
    targetCloseDate:
      input.targetCloseDate === undefined
        ? current.targetCloseDate
        : normalizeOptionalText(input.targetCloseDate),
    updatedAt: input.now
  };

  assertCompanyExists(next.companyId, existingCompanies);
  assertContactExists(next.primaryContactId, existingContacts);
  assertNonNegativeAmount(next.amount);

  return next;
}

export function transitionOpportunityStage(
  current: Opportunity,
  nextStage: OpportunityStage,
  now: Timestamp
): Opportunity {
  if (!allowedNextStages(current.stage).includes(nextStage)) {
    throw new DomainValidationError(
      `Cannot transition opportunity from ${current.stage} to ${nextStage}.`
    );
  }

  return {
    ...current,
    stage: nextStage,
    updatedAt: now,
    closedAt: isClosedOpportunityStage(nextStage) ? now : undefined
  };
}

export function filterOpportunitiesByStage(
  opportunities: readonly Opportunity[],
  stage: OpportunityStage
): Opportunity[] {
  return opportunities.filter((opportunity) => opportunity.stage === stage);
}

export function searchOpportunities(
  opportunities: readonly Opportunity[],
  query: string
): Opportunity[] {
  return opportunities.filter((opportunity) =>
    matchesQuery(opportunity.name, query)
  );
}

export function createTask(
  input: CreateTaskInput,
  references: EntityReferenceCollections
): Task {
  const title = requireText(input.title, 'Task title');

  assertLinkedEntityExists(
    input.linkedEntityType,
    input.linkedEntityId,
    references
  );

  return {
    id: input.id,
    title,
    status: 'Open',
    dueDate: normalizeOptionalText(input.dueDate),
    linkedEntityType: input.linkedEntityType,
    linkedEntityId: input.linkedEntityId,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateTask(current: Task, input: UpdateTaskInput): Task {
  assertTaskIsOpen(current);

  return {
    ...current,
    title:
      input.title === undefined ? current.title : requireText(input.title, 'Task title'),
    dueDate:
      input.dueDate === undefined
        ? current.dueDate
        : normalizeOptionalText(input.dueDate),
    updatedAt: input.now
  };
}

export function completeTask(current: Task, now: Timestamp): Task {
  assertTaskIsOpen(current);

  return {
    ...current,
    status: 'Completed',
    updatedAt: now,
    completedAt: now
  };
}

export function isTaskOverdue(task: Task, currentDate: CalendarDate): boolean {
  return task.status === 'Open' && task.dueDate !== undefined && task.dueDate < currentDate;
}

export function createNote(
  input: CreateNoteInput,
  references: EntityReferenceCollections
): Note {
  const body = requireText(input.body, 'Note body');

  assertLinkedEntityExists(
    input.linkedEntityType,
    input.linkedEntityId,
    references
  );

  return {
    id: input.id,
    body,
    linkedEntityType: input.linkedEntityType,
    linkedEntityId: input.linkedEntityId,
    createdAt: input.now
  };
}

export function updateNoteBody(note: Note, body: string): never {
  void note;
  void body;

  throw new DomainValidationError('Notes are append-only.');
}

export function listNotesForEntity(
  notes: readonly Note[],
  linkedEntityType: LinkedEntityType,
  linkedEntityId: LinkedEntityId
): Note[] {
  return notes
    .filter(
      (note) =>
        note.linkedEntityType === linkedEntityType &&
        note.linkedEntityId === linkedEntityId
    )
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function buildDashboardSummary(input: {
  readonly contacts: readonly Contact[];
  readonly companies: readonly Company[];
  readonly opportunities: readonly Opportunity[];
  readonly tasks: readonly Task[];
  readonly currentDate: CalendarDate;
}): DashboardSummary {
  const opportunityCountByStage = createEmptyOpportunityCountByStage();

  for (const opportunity of input.opportunities) {
    opportunityCountByStage[opportunity.stage] += 1;
  }

  const openTaskCount = input.tasks.filter((task) => task.status === 'Open').length;
  const overdueTaskCount = input.tasks.filter((task) =>
    isTaskOverdue(task, input.currentDate)
  ).length;
  const openPipelineAmount = input.opportunities.reduce((total, opportunity) => {
    if (!isActiveOpportunityStage(opportunity.stage)) {
      return total;
    }

    return total + (opportunity.amount ?? 0);
  }, 0);

  return {
    totalContacts: input.contacts.length,
    totalCompanies: input.companies.length,
    openTaskCount,
    overdueTaskCount,
    opportunityCountByStage,
    openPipelineAmount
  };
}

function createEmptyOpportunityCountByStage(): OpportunityCountByStage {
  return {
    Lead: 0,
    Qualified: 0,
    Proposal: 0,
    Won: 0,
    Lost: 0
  };
}

function requireText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
}

function normalizeOptionalEmail(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeEmail(value);

  return normalized.length === 0 ? undefined : normalized;
}

function assertUniqueContactEmail(
  email: string | undefined,
  contacts: readonly Contact[],
  currentId?: ContactId
): void {
  if (email === undefined) {
    return;
  }

  const duplicate = contacts.some(
    (contact) =>
      contact.id !== currentId &&
      contact.email !== undefined &&
      normalizeEmail(contact.email) === email
  );

  if (duplicate) {
    throw new DomainValidationError('Contact email must be unique.');
  }
}

function assertUniqueCompanyName(
  name: string,
  companies: readonly Company[],
  currentId?: CompanyId
): void {
  const normalizedName = normalizeCompanyName(name);
  const duplicate = companies.some(
    (company) =>
      company.id !== currentId &&
      normalizeCompanyName(company.name) === normalizedName
  );

  if (duplicate) {
    throw new DomainValidationError('Company name must be unique.');
  }
}

function assertCompanyExists(
  companyId: CompanyId | undefined,
  companies: readonly Pick<Company, 'id'>[]
): void {
  if (companyId === undefined) {
    return;
  }

  if (!companies.some((company) => company.id === companyId)) {
    throw new DomainValidationError('Company reference must exist.');
  }
}

function assertContactExists(
  contactId: ContactId | undefined,
  contacts: readonly Pick<Contact, 'id'>[]
): void {
  if (contactId === undefined) {
    return;
  }

  if (!contacts.some((contact) => contact.id === contactId)) {
    throw new DomainValidationError('Contact reference must exist.');
  }
}

function assertNonNegativeAmount(amount: number | undefined): void {
  if (amount !== undefined && amount < 0) {
    throw new DomainValidationError('Opportunity amount cannot be negative.');
  }
}

function assertLinkedEntityExists(
  linkedEntityType: LinkedEntityType,
  linkedEntityId: LinkedEntityId,
  references: EntityReferenceCollections
): void {
  const exists =
    linkedEntityType === 'Contact'
      ? references.contacts?.some((contact) => contact.id === linkedEntityId)
      : linkedEntityType === 'Company'
        ? references.companies?.some((company) => company.id === linkedEntityId)
        : references.opportunities?.some(
            (opportunity) => opportunity.id === linkedEntityId
          );

  if (!exists) {
    throw new DomainValidationError(
      `Linked ${linkedEntityType} reference must exist.`
    );
  }
}

function assertTaskIsOpen(task: Task): void {
  if (task.status !== 'Open') {
    throw new DomainValidationError('Completed tasks cannot be updated.');
  }
}

function matchesQuery(value: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return value.toLowerCase().includes(normalizedQuery);
}
