import type { CompletionGate } from '../../domain/flow-spec.js';
import type { VariableStore, VariableValue } from '../../domain/variable-value.js';

const ARTIFACT_GATE_NAMES = [
  'artifact_exists',
  'artifact_valid',
  'artifact_invalid',
  'artifact_reviewed',
  'artifact_accepted',
  'artifact_rejected',
  'artifact_changes_requested',
  'artifact_active',
  'artifact_superseded',
] as const;

type ArtifactGateName = (typeof ARTIFACT_GATE_NAMES)[number];

interface ParsedArtifactGate {
  readonly kind: 'artifact';
  readonly negated: boolean;
  readonly gateName: ArtifactGateName;
  readonly ref: string;
}

interface ParsedApprovalGate {
  readonly kind: 'approval';
  readonly negated: boolean;
  readonly stepId: string;
}

interface ParsedInvalidSpecialGate {
  readonly kind: 'invalid';
  readonly summary: string;
  readonly action: string;
}

type ParsedSpecialGate = ParsedArtifactGate | ParsedApprovalGate | ParsedInvalidSpecialGate;

export interface SpecialGatePredicateIssue {
  readonly predicate: string;
  readonly summary: string;
  readonly action: string;
}

export interface SpecialGatePredicateEvaluation {
  readonly matched: true;
  readonly passed: boolean;
}

interface ArtifactStateRecord {
  readonly artifactId: string | undefined;
  readonly revisionId: string | undefined;
  readonly runId: string | undefined;
  readonly validationState: string | undefined;
  readonly reviewState: string | undefined;
  readonly revisionState: string | undefined;
}

interface ApprovalStateRecord {
  readonly artifactId: string | undefined;
  readonly revisionId: string | undefined;
  readonly runId: string | undefined;
  readonly outcome: string | undefined;
}

const REF_TOKEN_RE = /^[A-Za-z0-9_./:@-]+$/;

export function collectSpecialGatePredicateIssues(
  gates: readonly CompletionGate[],
): readonly SpecialGatePredicateIssue[] {
  const issues: SpecialGatePredicateIssue[] = [];
  const seen = new Set<string>();

  const visit = (gate: CompletionGate): void => {
    const parsed = parseSpecialGatePredicate(gate.predicate);
    if (parsed?.kind === 'invalid' && !seen.has(gate.predicate)) {
      seen.add(gate.predicate);
      issues.push({
        predicate: gate.predicate,
        summary: parsed.summary,
        action: parsed.action,
      });
    }

    for (const nested of gate.any ?? []) {
      visit(nested);
    }
    for (const nested of gate.all ?? []) {
      visit(nested);
    }
    for (const nested of gate.nOf?.gates ?? []) {
      visit(nested);
    }
  };

  for (const gate of gates) {
    visit(gate);
  }

  return issues;
}

export function evaluateSpecialGatePredicate(
  predicate: string,
  variables: VariableStore,
): SpecialGatePredicateEvaluation | undefined {
  const parsed = parseSpecialGatePredicate(predicate);
  if (parsed == null || parsed.kind === 'invalid') {
    return undefined;
  }

  if (parsed.kind === 'artifact') {
    return { matched: true, passed: evaluateArtifactGate(parsed, variables) };
  }

  return { matched: true, passed: evaluateApprovalGate(parsed, variables) };
}

function parseSpecialGatePredicate(predicate: string): ParsedSpecialGate | undefined {
  const { normalized, negated } = stripNegation(predicate);
  for (const gateName of ARTIFACT_GATE_NAMES) {
    const parsed = parseArtifactGate(normalized, gateName, negated);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  const parsedApproval = parseApprovalGate(normalized, negated);
  if (parsedApproval !== undefined) {
    return parsedApproval;
  }

  if (normalized.startsWith('artifact_')) {
    return {
      kind: 'invalid',
      summary: `Unsupported artifact gate "${normalized}". Use explicit predicates such as artifact_valid <ref>, artifact_accepted <ref>, or artifact_active <ref>.`,
      action:
        'Replace the generic artifact status check with one supported predicate and one explicit artifact reference.',
    };
  }

  if (normalized.startsWith('approval_')) {
    return {
      kind: 'invalid',
      summary: `Unsupported approval gate "${normalized}". Only approval_passed(<step_id>) is supported in completion gates.`,
      action:
        'Use approval_passed(<step_id>) for flow approval checks, and keep artifact review state in artifact_* predicates.',
    };
  }

  return undefined;
}

function stripNegation(predicate: string): { normalized: string; negated: boolean } {
  let normalized = predicate.trim();
  let negated = false;

  while (normalized.toLowerCase().startsWith('not ')) {
    negated = !negated;
    normalized = normalized.slice(4).trim();
  }

  return { normalized, negated };
}

function parseArtifactGate(
  predicate: string,
  gateName: ArtifactGateName,
  negated: boolean,
): ParsedSpecialGate | undefined {
  const ref = parseNamedToken(predicate, gateName, 'artifact reference');
  if (ref === undefined) {
    return undefined;
  }

  if (typeof ref !== 'string') {
    return ref;
  }

  return {
    kind: 'artifact',
    negated,
    gateName,
    ref,
  };
}

function parseApprovalGate(predicate: string, negated: boolean): ParsedSpecialGate | undefined {
  const stepId = parseNamedToken(predicate, 'approval_passed', 'approval step id');
  if (stepId === undefined) {
    return undefined;
  }

  if (typeof stepId !== 'string') {
    return stepId;
  }

  return {
    kind: 'approval',
    negated,
    stepId,
  };
}

function parseNamedToken(
  predicate: string,
  gateName: string,
  tokenLabel: string,
): string | ParsedInvalidSpecialGate | undefined {
  const functionMatch = new RegExp(`^${escapeRegExp(gateName)}\\s*\\((.*)\\)$`).exec(predicate);
  if (functionMatch?.[1] !== undefined) {
    return normalizeToken(functionMatch[1], gateName, tokenLabel);
  }

  if (predicate === gateName || predicate.startsWith(`${gateName}(`)) {
    return {
      kind: 'invalid',
      summary: `${gateName} requires exactly one ${tokenLabel}.`,
      action: `Use "${gateName} <${tokenLabel.replaceAll(' ', '_')}>" or "${gateName}(<${tokenLabel.replaceAll(' ', '_')}>)".`,
    };
  }

  if (predicate.startsWith(`${gateName} `)) {
    return normalizeToken(predicate.slice(gateName.length + 1), gateName, tokenLabel);
  }

  if (predicate.startsWith(gateName)) {
    return {
      kind: 'invalid',
      summary: `Malformed special gate "${predicate}".`,
      action: `Use "${gateName} <${tokenLabel.replaceAll(' ', '_')}>" or "${gateName}(<${tokenLabel.replaceAll(' ', '_')}>)".`,
    };
  }

  return undefined;
}

function normalizeToken(
  rawToken: string,
  gateName: string,
  tokenLabel: string,
): string | ParsedInvalidSpecialGate {
  let token = rawToken.trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (token.length === 0) {
    return {
      kind: 'invalid',
      summary: `${gateName} requires exactly one ${tokenLabel}.`,
      action: `Provide one non-empty ${tokenLabel}.`,
    };
  }

  if (!REF_TOKEN_RE.test(token)) {
    return {
      kind: 'invalid',
      summary: `${gateName} uses an unsupported ${tokenLabel} "${token}".`,
      action:
        'Use an identifier, alias, or scoped ref containing only letters, numbers, ".", "_", "-", "/", "@", or ":".',
    };
  }

  return token;
}

function evaluateArtifactGate(parsed: ParsedArtifactGate, variables: VariableStore): boolean {
  const record = readArtifactStateRecord(variables, parsed.ref);
  const resolved = hasExplicitBinding(record.artifactId, record.revisionId, record.runId);
  let passed = false;

  switch (parsed.gateName) {
    case 'artifact_exists':
      passed = resolved;
      break;
    case 'artifact_valid':
      passed = resolved && record.validationState === 'valid';
      break;
    case 'artifact_invalid':
      passed = resolved && record.validationState === 'invalid';
      break;
    case 'artifact_reviewed':
      passed =
        resolved &&
        (record.reviewState === 'accepted' ||
          record.reviewState === 'rejected' ||
          record.reviewState === 'changes_requested');
      break;
    case 'artifact_accepted':
      passed = resolved && record.reviewState === 'accepted';
      break;
    case 'artifact_rejected':
      passed = resolved && record.reviewState === 'rejected';
      break;
    case 'artifact_changes_requested':
      passed = resolved && record.reviewState === 'changes_requested';
      break;
    case 'artifact_active':
      passed = resolved && record.revisionState === 'active';
      break;
    case 'artifact_superseded':
      passed = resolved && record.revisionState === 'superseded';
      break;
  }

  return parsed.negated ? !passed : passed;
}

function evaluateApprovalGate(parsed: ParsedApprovalGate, variables: VariableStore): boolean {
  const record = readApprovalStateRecord(variables, parsed.stepId);
  const bound = hasExplicitBinding(record.artifactId, record.revisionId, record.runId);
  const passed =
    bound &&
    record.outcome === 'approved' &&
    artifactBindingExists(
      variables,
      record.artifactId ?? '',
      record.revisionId ?? '',
      record.runId ?? '',
    );
  return parsed.negated ? !passed : passed;
}

function readArtifactStateRecord(variables: VariableStore, ref: string): ArtifactStateRecord {
  const prefix = `_artifacts.${ref}`;
  return {
    artifactId: readField(variables, prefix, ['artifactId', 'artifact_id']),
    revisionId: readField(variables, prefix, ['revisionId', 'revision_id']),
    runId: readField(variables, prefix, ['runId', 'run_id']),
    validationState: normalizeState(
      readField(variables, prefix, ['validationState', 'validation_state']),
    ),
    reviewState: normalizeState(readField(variables, prefix, ['reviewState', 'review_state'])),
    revisionState: normalizeState(
      readField(variables, prefix, ['revisionState', 'revision_state']),
    ),
  };
}

function readApprovalStateRecord(variables: VariableStore, stepId: string): ApprovalStateRecord {
  const prefix = `_approvals.${stepId}`;
  return {
    artifactId: readField(variables, prefix, ['artifactId', 'artifact_id']),
    revisionId: readField(variables, prefix, ['revisionId', 'revision_id']),
    runId: readField(variables, prefix, ['runId', 'run_id']),
    outcome: normalizeState(readField(variables, prefix, ['outcome'])),
  };
}

function readField(
  variables: VariableStore,
  prefix: string,
  names: readonly string[],
): string | undefined {
  const nested = variables[prefix];
  if (isPlainObject(nested)) {
    for (const name of names) {
      const scalar = readScalar(nested[name]);
      if (scalar !== undefined) {
        return scalar;
      }
    }
  }

  for (const name of names) {
    const scalar = readScalar(variables[`${prefix}.${name}`]);
    if (scalar !== undefined) {
      return scalar;
    }
  }

  return undefined;
}

function normalizeState(value: string | undefined): string | undefined {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized == null || normalized.length === 0) {
    return undefined;
  }

  switch (normalized) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'request_changes':
      return 'changes_requested';
    default:
      return normalized;
  }
}

function hasExplicitBinding(
  artifactId: string | undefined,
  revisionId: string | undefined,
  runId: string | undefined,
): boolean {
  return artifactId !== undefined && revisionId !== undefined && runId !== undefined;
}

function artifactBindingExists(
  variables: VariableStore,
  artifactId: string,
  revisionId: string,
  runId: string,
): boolean {
  for (const ref of collectArtifactRefs(variables)) {
    const record = readArtifactStateRecord(variables, ref);
    if (
      record.artifactId === artifactId &&
      record.revisionId === revisionId &&
      record.runId === runId
    ) {
      return true;
    }
  }

  return false;
}

function collectArtifactRefs(variables: VariableStore): readonly string[] {
  const refs = new Set<string>();

  for (const key of Object.keys(variables)) {
    if (!key.startsWith('_artifacts.')) {
      continue;
    }

    const suffix = key.slice('_artifacts.'.length);
    if (suffix.length === 0) {
      continue;
    }

    const firstDot = suffix.indexOf('.');
    refs.add(firstDot === -1 ? suffix : suffix.slice(0, firstDot));
  }

  return [...refs];
}

function isPlainObject(
  value: VariableValue | undefined,
): value is Readonly<Record<string, VariableValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readScalar(value: VariableValue | undefined): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
