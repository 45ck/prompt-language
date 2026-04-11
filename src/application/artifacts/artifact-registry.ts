export interface ArtifactManifestProducer {
  readonly kind: string;
  readonly name: string;
  readonly version: string;
}

export interface ArtifactManifestOrigin {
  readonly runId: string;
  readonly flowNode: string;
  readonly phase: string;
}

export interface ArtifactManifestContent {
  readonly path: string;
  readonly mediaType: string;
  readonly sha256: string;
}

export interface ArtifactManifestView {
  readonly name: string;
  readonly path: string;
  readonly mediaType: string;
  readonly renderer: string;
  readonly sha256: string;
}

export interface ArtifactManifestAttachment {
  readonly name: string;
  readonly path: string;
  readonly mediaType: string;
  readonly role: string;
  readonly sha256: string;
}

export interface ArtifactManifest {
  readonly manifestVersion: number;
  readonly artifactId: string;
  readonly artifactType: string;
  readonly artifactSchemaVersion: number;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly producer: ArtifactManifestProducer;
  readonly origin: ArtifactManifestOrigin;
  readonly declarationRef: string;
  readonly content: ArtifactManifestContent;
  readonly views: readonly ArtifactManifestView[];
  readonly attachments: readonly ArtifactManifestAttachment[];
}

export interface ArtifactRegistrySource {
  readonly packageRoot: string;
  readonly manifest: ArtifactManifest;
  readonly aliases?: readonly string[];
}

export interface ArtifactRegistryEntry {
  readonly packageRoot: string;
  readonly manifest: ArtifactManifest;
  readonly runId: string;
  readonly scopedId: string;
  readonly aliases: readonly string[];
}

export interface ArtifactRegistry {
  readonly entries: readonly ArtifactRegistryEntry[];
  readonly byScopedId: ReadonlyMap<string, ArtifactRegistryEntry>;
  readonly byArtifactId: ReadonlyMap<string, readonly ArtifactRegistryEntry[]>;
  readonly byAlias: ReadonlyMap<string, readonly ArtifactRegistryEntry[]>;
}

export type ArtifactRegistryIssueCode =
  | 'blank_alias'
  | 'duplicate_alias_in_run'
  | 'duplicate_scoped_id';

export interface ArtifactRegistryIssue {
  readonly code: ArtifactRegistryIssueCode;
  readonly message: string;
  readonly packageRoot: string;
  readonly runId: string;
  readonly artifactId: string;
  readonly scopedId: string;
  readonly alias?: string;
  readonly conflictingPackageRoot?: string;
}

export type BuildArtifactRegistryResult =
  | { readonly ok: true; readonly registry: ArtifactRegistry }
  | { readonly ok: false; readonly issues: readonly ArtifactRegistryIssue[] };

export interface ArtifactLookup {
  readonly kind: 'alias' | 'id';
  readonly value: string;
  readonly runId?: string;
}

export type ResolveArtifactLookupResult =
  | { readonly ok: true; readonly entry: ArtifactRegistryEntry }
  | {
      readonly ok: false;
      readonly reason: 'ambiguous';
      readonly lookup: ArtifactLookup;
      readonly candidates: readonly ArtifactRegistryEntry[];
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid';
      readonly lookup: ArtifactLookup;
      readonly message: string;
    }
  | { readonly ok: false; readonly reason: 'not_found'; readonly lookup: ArtifactLookup };

export function formatArtifactScopedId(runId: string, artifactId: string): string {
  return `${runId}/${artifactId}`;
}

export function buildArtifactRegistry(
  sources: readonly ArtifactRegistrySource[],
): BuildArtifactRegistryResult {
  const issues: ArtifactRegistryIssue[] = [];
  const entries = sources.map((source) => createEntry(source, issues)).sort(compareEntries);
  const byScopedId = new Map<string, ArtifactRegistryEntry>();
  const byArtifactId = new Map<string, ArtifactRegistryEntry[]>();
  const byAlias = new Map<string, ArtifactRegistryEntry[]>();
  const byScopedAlias = new Map<string, ArtifactRegistryEntry>();

  for (const entry of entries) {
    registerScopedId(entry, byScopedId, issues);
    appendLookupEntry(byArtifactId, entry.manifest.artifactId, entry);
    registerAliases(entry, byAlias, byScopedAlias, issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    registry: {
      entries,
      byScopedId,
      byArtifactId,
      byAlias,
    },
  };
}

export function listArtifactRegistryEntries(
  registry: ArtifactRegistry,
  options: { readonly runId?: string } = {},
): readonly ArtifactRegistryEntry[] {
  const runId = normalizeOptionalRunId(options.runId);
  if (runId === undefined) {
    return registry.entries;
  }

  return registry.entries.filter((entry) => entry.runId === runId);
}

export function resolveArtifactLookup(
  registry: ArtifactRegistry,
  lookup: ArtifactLookup,
): ResolveArtifactLookupResult {
  const value = normalizeLookupValue(lookup.value);
  if (value.length === 0) {
    return {
      ok: false,
      reason: 'invalid',
      lookup,
      message: `Artifact ${lookup.kind} lookup must not be blank.`,
    };
  }

  const runId = normalizeOptionalRunId(lookup.runId);
  if (lookup.runId !== undefined && runId === undefined) {
    return {
      ok: false,
      reason: 'invalid',
      lookup,
      message: 'Artifact runId scope must not be blank when provided.',
    };
  }

  const matches = filterEntries(selectLookupBucket(registry, lookup.kind, value), runId);
  if (matches.length === 0) {
    return { ok: false, reason: 'not_found', lookup };
  }

  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous', lookup, candidates: matches };
  }

  const match = matches[0];
  if (match === undefined) {
    return { ok: false, reason: 'not_found', lookup };
  }

  return { ok: true, entry: match };
}

function createEntry(
  source: ArtifactRegistrySource,
  issues: ArtifactRegistryIssue[],
): ArtifactRegistryEntry {
  const runId = source.manifest.origin.runId;
  return {
    packageRoot: source.packageRoot,
    manifest: source.manifest,
    runId,
    scopedId: formatArtifactScopedId(runId, source.manifest.artifactId),
    aliases: normalizeAliases(source, issues),
  };
}

function normalizeAliases(
  source: ArtifactRegistrySource,
  issues: ArtifactRegistryIssue[],
): readonly string[] {
  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const rawAlias of source.aliases ?? []) {
    const alias = normalizeLookupValue(rawAlias);
    if (alias.length === 0) {
      issues.push({
        code: 'blank_alias',
        message: `Artifact ${source.manifest.artifactId} declares a blank alias.`,
        packageRoot: source.packageRoot,
        runId: source.manifest.origin.runId,
        artifactId: source.manifest.artifactId,
        scopedId: formatArtifactScopedId(source.manifest.origin.runId, source.manifest.artifactId),
      });
      continue;
    }

    if (seen.has(alias)) {
      continue;
    }

    seen.add(alias);
    aliases.push(alias);
  }

  return aliases;
}

function compareEntries(left: ArtifactRegistryEntry, right: ArtifactRegistryEntry): number {
  return left.scopedId.localeCompare(right.scopedId);
}

function registerScopedId(
  entry: ArtifactRegistryEntry,
  byScopedId: Map<string, ArtifactRegistryEntry>,
  issues: ArtifactRegistryIssue[],
): void {
  const existing = byScopedId.get(entry.scopedId);
  if (existing === undefined) {
    byScopedId.set(entry.scopedId, entry);
    return;
  }

  issues.push({
    code: 'duplicate_scoped_id',
    message: `Artifact ${entry.scopedId} is declared more than once in the registry.`,
    packageRoot: entry.packageRoot,
    runId: entry.runId,
    artifactId: entry.manifest.artifactId,
    scopedId: entry.scopedId,
    conflictingPackageRoot: existing.packageRoot,
  });
}

function registerAliases(
  entry: ArtifactRegistryEntry,
  byAlias: Map<string, ArtifactRegistryEntry[]>,
  byScopedAlias: Map<string, ArtifactRegistryEntry>,
  issues: ArtifactRegistryIssue[],
): void {
  for (const alias of entry.aliases) {
    const scopedAlias = formatScopedAliasKey(entry.runId, alias);
    const existing = byScopedAlias.get(scopedAlias);
    if (existing !== undefined) {
      issues.push({
        code: 'duplicate_alias_in_run',
        message: `Artifact alias "${alias}" resolves to more than one artifact in run ${entry.runId}.`,
        packageRoot: entry.packageRoot,
        runId: entry.runId,
        artifactId: entry.manifest.artifactId,
        scopedId: entry.scopedId,
        alias,
        conflictingPackageRoot: existing.packageRoot,
      });
      continue;
    }

    byScopedAlias.set(scopedAlias, entry);
    appendLookupEntry(byAlias, alias, entry);
  }
}

function appendLookupEntry(
  buckets: Map<string, ArtifactRegistryEntry[]>,
  key: string,
  entry: ArtifactRegistryEntry,
): void {
  const bucket = buckets.get(key);
  if (bucket === undefined) {
    buckets.set(key, [entry]);
    return;
  }

  bucket.push(entry);
}

function selectLookupBucket(
  registry: ArtifactRegistry,
  kind: ArtifactLookup['kind'],
  value: string,
): readonly ArtifactRegistryEntry[] {
  if (kind === 'id') {
    return registry.byArtifactId.get(value) ?? [];
  }

  return registry.byAlias.get(value) ?? [];
}

function filterEntries(
  entries: readonly ArtifactRegistryEntry[],
  runId: string | undefined,
): readonly ArtifactRegistryEntry[] {
  if (runId === undefined) {
    return entries;
  }

  return entries.filter((entry) => entry.runId === runId);
}

function normalizeLookupValue(value: string): string {
  return value.trim();
}

function normalizeOptionalRunId(runId: string | undefined): string | undefined {
  if (runId === undefined) {
    return undefined;
  }

  const normalized = normalizeLookupValue(runId);
  return normalized.length > 0 ? normalized : undefined;
}

function formatScopedAliasKey(runId: string, alias: string): string {
  return `${runId}\u0000${alias}`;
}
