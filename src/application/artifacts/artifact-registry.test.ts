import { describe, expect, it } from 'vitest';

import {
  buildArtifactRegistry,
  formatArtifactScopedId,
  listArtifactRegistryEntries,
  resolveArtifactLookup,
  type ArtifactManifest,
  type ArtifactRegistry,
  type ArtifactRegistryEntry,
  type ArtifactRegistrySource,
} from './artifact-registry.js';

describe('buildArtifactRegistry', () => {
  it('indexes artifacts in deterministic scoped-id order', () => {
    const registry = expectBuiltRegistry([
      makeSource({ runId: 'run-b', artifactId: 'zeta-report', aliases: ['release-report'] }),
      makeSource({ runId: 'run-a', artifactId: 'alpha-plan', aliases: ['release-plan'] }),
    ]);

    expect(listArtifactRegistryEntries(registry).map((entry) => entry.scopedId)).toEqual([
      'run-a/alpha-plan',
      'run-b/zeta-report',
    ]);
    expect(
      listArtifactRegistryEntries(registry, { runId: 'run-b' }).map((entry) => entry.scopedId),
    ).toEqual(['run-b/zeta-report']);
  });

  it('rejects duplicate artifact ids within the same run', () => {
    const result = buildArtifactRegistry([
      makeSource({ runId: 'run-a', artifactId: 'shared-plan', packageRoot: '/pkg/one' }),
      makeSource({ runId: 'run-a', artifactId: 'shared-plan', packageRoot: '/pkg/two' }),
    ]);

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'duplicate_scoped_id',
          scopedId: 'run-a/shared-plan',
          conflictingPackageRoot: '/pkg/one',
        }),
      ],
    });
  });

  it('rejects duplicate aliases within the same run', () => {
    const result = buildArtifactRegistry([
      makeSource({ runId: 'run-a', artifactId: 'alpha-plan', aliases: ['release'] }),
      makeSource({ runId: 'run-a', artifactId: 'beta-report', aliases: ['release'] }),
    ]);

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'duplicate_alias_in_run',
          alias: 'release',
          scopedId: 'run-a/beta-report',
        }),
      ],
    });
  });

  it('flags blank aliases and ignores repeated aliases on the same artifact', () => {
    const result = buildArtifactRegistry([
      makeSource({
        runId: 'run-a',
        artifactId: 'alpha-plan',
        aliases: ['release-plan', '  ', 'release-plan'],
      }),
    ]);

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'blank_alias',
          scopedId: 'run-a/alpha-plan',
        }),
      ],
    });
  });
});

describe('resolveArtifactLookup', () => {
  it('resolves a unique artifact id without a run scope', () => {
    const registry = expectBuiltRegistry([
      makeSource({ runId: 'run-a', artifactId: 'alpha-plan' }),
      makeSource({ runId: 'run-b', artifactId: 'beta-report' }),
    ]);

    expect(resolveArtifactLookup(registry, { kind: 'id', value: 'alpha-plan' })).toEqual({
      ok: true,
      entry: expect.objectContaining({
        scopedId: 'run-a/alpha-plan',
      }),
    });
  });

  it('requires an explicit run scope when the same artifact id appears in more than one run', () => {
    const registry = expectBuiltRegistry([
      makeSource({ runId: 'run-a', artifactId: 'deploy-plan' }),
      makeSource({ runId: 'run-b', artifactId: 'deploy-plan' }),
    ]);

    expect(resolveArtifactLookup(registry, { kind: 'id', value: 'deploy-plan' })).toEqual({
      ok: false,
      reason: 'ambiguous',
      lookup: { kind: 'id', value: 'deploy-plan' },
      candidates: [
        expect.objectContaining({ scopedId: 'run-a/deploy-plan' }),
        expect.objectContaining({ scopedId: 'run-b/deploy-plan' }),
      ],
    });
    expect(
      resolveArtifactLookup(registry, { kind: 'id', value: 'deploy-plan', runId: 'run-b' }),
    ).toEqual({
      ok: true,
      entry: expect.objectContaining({
        scopedId: 'run-b/deploy-plan',
      }),
    });
  });

  it('treats aliases as explicit pointers to immutable run-owned artifacts', () => {
    const registry = expectBuiltRegistry([
      makeSource({ runId: 'run-a', artifactId: 'deploy-plan', aliases: ['release-plan'] }),
      makeSource({ runId: 'run-b', artifactId: 'deploy-plan', aliases: ['release-plan'] }),
    ]);

    expect(resolveArtifactLookup(registry, { kind: 'alias', value: 'release-plan' })).toEqual({
      ok: false,
      reason: 'ambiguous',
      lookup: { kind: 'alias', value: 'release-plan' },
      candidates: [
        expect.objectContaining({ scopedId: 'run-a/deploy-plan' }),
        expect.objectContaining({ scopedId: 'run-b/deploy-plan' }),
      ],
    });
    expect(
      resolveArtifactLookup(registry, { kind: 'alias', value: 'release-plan', runId: 'run-a' }),
    ).toEqual({
      ok: true,
      entry: expect.objectContaining({
        scopedId: 'run-a/deploy-plan',
      }),
    });
  });

  it('returns stable invalid and not-found results for unusable lookups', () => {
    const registry = expectBuiltRegistry([
      makeSource({ runId: 'run-a', artifactId: 'alpha-plan' }),
    ]);

    expect(resolveArtifactLookup(registry, { kind: 'id', value: '   ' })).toEqual({
      ok: false,
      reason: 'invalid',
      lookup: { kind: 'id', value: '   ' },
      message: 'Artifact id lookup must not be blank.',
    });
    expect(resolveArtifactLookup(registry, { kind: 'alias', value: 'missing' })).toEqual({
      ok: false,
      reason: 'not_found',
      lookup: { kind: 'alias', value: 'missing' },
    });
    expect(
      resolveArtifactLookup(registry, { kind: 'id', value: 'alpha-plan', runId: '   ' }),
    ).toEqual({
      ok: false,
      reason: 'invalid',
      lookup: { kind: 'id', value: 'alpha-plan', runId: '   ' },
      message: 'Artifact runId scope must not be blank when provided.',
    });
  });

  it('defensively treats malformed registry buckets as not found', () => {
    const registry = {
      entries: [],
      byScopedId: new Map(),
      byArtifactId: new Map([
        ['alpha-plan', [undefined] as unknown as readonly ArtifactRegistryEntry[]],
      ]),
      byAlias: new Map(),
    } satisfies ArtifactRegistry;

    expect(resolveArtifactLookup(registry, { kind: 'id', value: 'alpha-plan' })).toEqual({
      ok: false,
      reason: 'not_found',
      lookup: { kind: 'id', value: 'alpha-plan' },
    });
  });
});

function expectBuiltRegistry(sources: readonly ArtifactRegistrySource[]): ArtifactRegistry {
  const result = buildArtifactRegistry(sources);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(
      `Expected registry to build successfully, got issues: ${result.issues.map((issue) => issue.code).join(', ')}`,
    );
  }

  return result.registry;
}

function makeSource(input: {
  readonly runId: string;
  readonly artifactId: string;
  readonly aliases?: readonly string[];
  readonly packageRoot?: string;
}): ArtifactRegistrySource {
  const packageRoot =
    input.packageRoot ?? `/artifacts/${formatArtifactScopedId(input.runId, input.artifactId)}`;
  const source: ArtifactRegistrySource = {
    packageRoot,
    manifest: makeManifest(input.runId, input.artifactId),
  };

  if (input.aliases !== undefined) {
    return { ...source, aliases: input.aliases };
  }

  return source;
}

function makeManifest(runId: string, artifactId: string): ArtifactManifest {
  return {
    manifestVersion: 1,
    artifactId,
    artifactType: 'implementation_plan',
    artifactSchemaVersion: 1,
    title: `${artifactId} title`,
    summary: `${artifactId} summary`,
    status: 'draft',
    createdAt: '2026-04-11T00:00:00Z',
    updatedAt: '2026-04-11T00:00:00Z',
    producer: {
      kind: 'flow',
      name: 'artifact-registry-test',
      version: '1',
    },
    origin: {
      runId,
      flowNode: 'flow.artifact',
      phase: 'plan',
    },
    declarationRef: '../../../artifacts/schemas/types/implementation-plan.schema.json',
    content: {
      path: 'content/source.json',
      mediaType: 'application/json',
      sha256: '82478d7accc51f5cff2aa5f6f7380facb6a0c7160eb0277e937a24c3cc8de3a0',
    },
    views: [
      {
        name: 'markdown',
        path: 'views/artifact.md',
        mediaType: 'text/markdown',
        renderer: 'core-fallback-markdown',
        sha256: '0dd1499bddc164d138b98fdffc9af3f9cb9666c108df8526d238585e34632caa',
      },
    ],
    attachments: [],
  };
}
