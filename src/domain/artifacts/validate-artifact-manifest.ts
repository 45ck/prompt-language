import {
  ARTIFACT_MANIFEST_STATUSES,
  ARTIFACT_PRODUCER_KINDS,
  type ArtifactAttachmentReference,
  type ArtifactContentReference,
  type ArtifactManifest,
  type ArtifactManifestStatus,
  type ArtifactOrigin,
  type ArtifactProducer,
  type ArtifactProducerKind,
  type ArtifactViewReference,
} from './manifest.js';

export type ArtifactManifestValidationCode =
  | 'expected-object'
  | 'expected-array'
  | 'required'
  | 'expected-integer'
  | 'expected-string'
  | 'invalid-status'
  | 'invalid-producer-kind'
  | 'invalid-date-time'
  | 'invalid-sha256'
  | 'invalid-reference-path'
  | 'invalid-content-path'
  | 'invalid-content-media-type'
  | 'duplicate-reference-name'
  | 'duplicate-reference-path'
  | 'invalid-timestamp-order';

export interface ArtifactManifestValidationIssue {
  readonly path: string;
  readonly code: ArtifactManifestValidationCode;
  readonly message: string;
}

export interface ArtifactManifestValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ArtifactManifestValidationIssue[];
  readonly manifest?: ArtifactManifest | undefined;
}

type UnknownRecord = Record<string, unknown>;

const RFC_3339_UTC_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SHA_256_HEX = /^[a-f0-9]{64}$/u;

export function validateArtifactManifest(input: unknown): ArtifactManifestValidationResult {
  const issues: ArtifactManifestValidationIssue[] = [];

  if (!isRecord(input)) {
    pushIssue(issues, '$', 'expected-object', 'Artifact manifest must be an object.');
    return { valid: false, issues };
  }

  const manifestVersion = readPositiveInteger(input, 'manifestVersion', issues);
  const artifactId = readNonEmptyString(input, 'artifactId', issues);
  const artifactType = readNonEmptyString(input, 'artifactType', issues);
  const artifactSchemaVersion = readPositiveInteger(input, 'artifactSchemaVersion', issues);
  const title = readNonEmptyString(input, 'title', issues);
  const summary = readNonEmptyString(input, 'summary', issues);
  const status = readStatus(input, issues);
  const createdAt = readDateTime(input, 'createdAt', issues);
  const updatedAt = readDateTime(input, 'updatedAt', issues);
  const producer = readProducer(input['producer'], 'producer', issues);
  const origin = readOrigin(input['origin'], 'origin', issues);
  const declarationRef = readOptionalNonEmptyString(input, 'declarationRef', issues);
  const content = readContentReference(input['content'], 'content', issues);
  const views = readViewReferences(input['views'], 'views', issues);
  const attachments = readAttachmentReferences(input['attachments'], 'attachments', issues);

  if (
    createdAt !== undefined &&
    updatedAt !== undefined &&
    Date.parse(updatedAt) < Date.parse(createdAt)
  ) {
    pushIssue(
      issues,
      'updatedAt',
      'invalid-timestamp-order',
      'updatedAt must be on or after createdAt.',
    );
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  const manifest: ArtifactManifest = {
    manifestVersion: manifestVersion!,
    artifactId: artifactId!,
    artifactType: artifactType!,
    artifactSchemaVersion: artifactSchemaVersion!,
    title: title!,
    summary: summary!,
    status: status!,
    createdAt: createdAt!,
    updatedAt: updatedAt!,
    producer: producer!,
    origin: origin!,
    ...(declarationRef !== undefined ? { declarationRef } : {}),
    content: content!,
    views: views!,
    attachments: attachments!,
  };

  return { valid: true, issues, manifest };
}

export function isArtifactManifest(input: unknown): input is ArtifactManifest {
  return validateArtifactManifest(input).valid;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushIssue(
  issues: ArtifactManifestValidationIssue[],
  path: string,
  code: ArtifactManifestValidationCode,
  message: string,
): void {
  issues.push({ path, code, message });
}

function readPositiveInteger(
  record: UnknownRecord,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): number | undefined {
  const value = record[path];
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    pushIssue(
      issues,
      path,
      'expected-integer',
      `${path} must be an integer greater than or equal to 1.`,
    );
    return undefined;
  }
  return value;
}

function readNonEmptyString(
  record: UnknownRecord,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): string | undefined {
  const value = record[lastPathSegment(path)];
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') {
    pushIssue(issues, path, 'expected-string', `${path} must be a string.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    pushIssue(issues, path, 'expected-string', `${path} must not be empty.`);
    return undefined;
  }
  return trimmed;
}

function readOptionalNonEmptyString(
  record: UnknownRecord,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): string | undefined {
  const value = record[lastPathSegment(path)];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    pushIssue(issues, path, 'expected-string', `${path} must be a string.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    pushIssue(issues, path, 'expected-string', `${path} must not be empty when provided.`);
    return undefined;
  }
  return trimmed;
}

function readStatus(
  record: UnknownRecord,
  issues: ArtifactManifestValidationIssue[],
): ArtifactManifestStatus | undefined {
  const status = readNonEmptyString(record, 'status', issues);
  if (status === undefined) {
    return undefined;
  }
  if (!ARTIFACT_MANIFEST_STATUSES.includes(status as ArtifactManifestStatus)) {
    pushIssue(
      issues,
      'status',
      'invalid-status',
      `status must be one of: ${ARTIFACT_MANIFEST_STATUSES.join(', ')}.`,
    );
    return undefined;
  }
  return status as ArtifactManifestStatus;
}

function readDateTime(
  record: UnknownRecord,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): string | undefined {
  const value = readNonEmptyString(record, path, issues);
  if (value === undefined) {
    return undefined;
  }
  if (!RFC_3339_UTC_OFFSET.test(value) || Number.isNaN(Date.parse(value))) {
    pushIssue(issues, path, 'invalid-date-time', `${path} must be an RFC 3339 date-time string.`);
    return undefined;
  }
  return value;
}

function readProducer(
  value: unknown,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): ArtifactProducer | undefined {
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (!isRecord(value)) {
    pushIssue(issues, path, 'expected-object', `${path} must be an object.`);
    return undefined;
  }

  const kind = readNonEmptyString(value, `${path}.kind`, issues);
  const name = readNonEmptyString(value, `${path}.name`, issues);
  const version = readNonEmptyString(value, `${path}.version`, issues);

  if (kind !== undefined && !ARTIFACT_PRODUCER_KINDS.includes(kind as ArtifactProducerKind)) {
    pushIssue(
      issues,
      `${path}.kind`,
      'invalid-producer-kind',
      `producer.kind must be one of: ${ARTIFACT_PRODUCER_KINDS.join(', ')}.`,
    );
    return undefined;
  }

  if (kind === undefined || name === undefined || version === undefined) {
    return undefined;
  }

  return {
    kind: kind as ArtifactProducerKind,
    name,
    version,
  };
}

function readOrigin(
  value: unknown,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): ArtifactOrigin | undefined {
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (!isRecord(value)) {
    pushIssue(issues, path, 'expected-object', `${path} must be an object.`);
    return undefined;
  }

  const runId = readNonEmptyString(value, `${path}.runId`, issues);
  const flowNode = readNonEmptyString(value, `${path}.flowNode`, issues);
  const phase = readNonEmptyString(value, `${path}.phase`, issues);

  if (runId === undefined || flowNode === undefined || phase === undefined) {
    return undefined;
  }

  return { runId, flowNode, phase };
}

function readContentReference(
  value: unknown,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): ArtifactContentReference | undefined {
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (!isRecord(value)) {
    pushIssue(issues, path, 'expected-object', `${path} must be an object.`);
    return undefined;
  }

  const refPath = readNonEmptyString(value, `${path}.path`, issues);
  const mediaType = readNonEmptyString(value, `${path}.mediaType`, issues);
  const sha256 = readSha256(value, `${path}.sha256`, issues);

  if (refPath !== undefined && refPath !== 'content/source.json') {
    pushIssue(
      issues,
      `${path}.path`,
      'invalid-content-path',
      'content.path must be "content/source.json".',
    );
  }
  if (mediaType !== undefined && mediaType !== 'application/json') {
    pushIssue(
      issues,
      `${path}.mediaType`,
      'invalid-content-media-type',
      'content.mediaType must be "application/json".',
    );
  }

  if (
    refPath !== 'content/source.json' ||
    mediaType !== 'application/json' ||
    sha256 === undefined
  ) {
    return undefined;
  }

  return {
    path: 'content/source.json',
    mediaType: 'application/json',
    sha256,
  };
}

function readViewReferences(
  value: unknown,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): readonly ArtifactViewReference[] | undefined {
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    pushIssue(issues, path, 'expected-array', `${path} must be an array.`);
    return undefined;
  }

  const views: ArtifactViewReference[] = [];
  const names = new Set<string>();
  const paths = new Set<string>();

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      pushIssue(issues, entryPath, 'expected-object', `${entryPath} must be an object.`);
      return;
    }

    const name = readNonEmptyString(entry, `${entryPath}.name`, issues);
    const refPath = readReferencePath(entry, `${entryPath}.path`, 'view', issues);
    const mediaType = readNonEmptyString(entry, `${entryPath}.mediaType`, issues);
    const renderer = readNonEmptyString(entry, `${entryPath}.renderer`, issues);
    const sha256 = readSha256(entry, `${entryPath}.sha256`, issues);

    if (name !== undefined) {
      if (names.has(name)) {
        pushIssue(
          issues,
          `${entryPath}.name`,
          'duplicate-reference-name',
          `View name "${name}" is already registered.`,
        );
      } else {
        names.add(name);
      }
    }

    if (refPath !== undefined) {
      if (paths.has(refPath)) {
        pushIssue(
          issues,
          `${entryPath}.path`,
          'duplicate-reference-path',
          `View path "${refPath}" is already registered.`,
        );
      } else {
        paths.add(refPath);
      }
    }

    if (
      name !== undefined &&
      refPath !== undefined &&
      mediaType !== undefined &&
      renderer !== undefined &&
      sha256 !== undefined
    ) {
      views.push({ name, path: refPath, mediaType, renderer, sha256 });
    }
  });

  return views;
}

function readAttachmentReferences(
  value: unknown,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): readonly ArtifactAttachmentReference[] | undefined {
  if (value === undefined) {
    pushIssue(issues, path, 'required', `${path} is required.`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    pushIssue(issues, path, 'expected-array', `${path} must be an array.`);
    return undefined;
  }

  const attachments: ArtifactAttachmentReference[] = [];
  const names = new Set<string>();
  const paths = new Set<string>();

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      pushIssue(issues, entryPath, 'expected-object', `${entryPath} must be an object.`);
      return;
    }

    const name = readNonEmptyString(entry, `${entryPath}.name`, issues);
    const refPath = readReferencePath(entry, `${entryPath}.path`, 'attachment', issues);
    const mediaType = readNonEmptyString(entry, `${entryPath}.mediaType`, issues);
    const role = readNonEmptyString(entry, `${entryPath}.role`, issues);
    const sha256 = readSha256(entry, `${entryPath}.sha256`, issues);

    if (name !== undefined) {
      if (names.has(name)) {
        pushIssue(
          issues,
          `${entryPath}.name`,
          'duplicate-reference-name',
          `Attachment name "${name}" is already registered.`,
        );
      } else {
        names.add(name);
      }
    }

    if (refPath !== undefined) {
      if (paths.has(refPath)) {
        pushIssue(
          issues,
          `${entryPath}.path`,
          'duplicate-reference-path',
          `Attachment path "${refPath}" is already registered.`,
        );
      } else {
        paths.add(refPath);
      }
    }

    if (
      name !== undefined &&
      refPath !== undefined &&
      mediaType !== undefined &&
      role !== undefined &&
      sha256 !== undefined
    ) {
      attachments.push({ name, path: refPath, mediaType, role, sha256 });
    }
  });

  return attachments;
}

function readSha256(
  record: UnknownRecord,
  path: string,
  issues: ArtifactManifestValidationIssue[],
): string | undefined {
  const value = readNonEmptyString(record, path, issues);
  if (value === undefined) {
    return undefined;
  }
  if (!SHA_256_HEX.test(value)) {
    pushIssue(
      issues,
      path,
      'invalid-sha256',
      `${path} must be a lowercase 64-character SHA-256 hex digest.`,
    );
    return undefined;
  }
  return value;
}

function readReferencePath(
  record: UnknownRecord,
  path: string,
  kind: 'view' | 'attachment',
  issues: ArtifactManifestValidationIssue[],
): string | undefined {
  const value = readNonEmptyString(record, path, issues);
  if (value === undefined) {
    return undefined;
  }
  if (!isValidReferencePath(value, kind)) {
    const expected = kind === 'view' ? 'views/... or exports/...' : 'attachments/...';
    pushIssue(
      issues,
      path,
      'invalid-reference-path',
      `${path} must be a package-relative path under ${expected}.`,
    );
    return undefined;
  }
  return value;
}

function isValidReferencePath(path: string, kind: 'view' | 'attachment'): boolean {
  if (path.includes('\\') || path.startsWith('/') || path.includes('//')) {
    return false;
  }

  const segments = path.split('/');
  if (
    segments.length < 2 ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    return false;
  }

  const first = segments[0];
  if (kind === 'view') {
    return first === 'views' || first === 'exports';
  }
  return first === 'attachments';
}

function lastPathSegment(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
}
