import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  inspectArtifactPackage,
  listArtifactPackages,
  renderArtifactPackageDetails,
  renderArtifactPackageList,
  renderArtifactValidationResult,
  validateArtifactPackage,
} from './inspect-artifacts.js';

const ROOT = join(import.meta.dirname, '..', '..');
const ARTIFACT_ROOT = join(ROOT, 'artifacts');
const SAMPLE_PACKAGE = join(ARTIFACT_ROOT, 'samples', 'implementation-plan-v1');
const SAMPLE_SCHEMAS = join(ARTIFACT_ROOT, 'schemas');
const SAMPLE_DECLARATION = join(SAMPLE_SCHEMAS, 'types', 'implementation-plan.schema.json');

describe('artifact inspection', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('lists the checked-in artifact packages from the default fixture root', async () => {
    const result = await listArtifactPackages(ARTIFACT_ROOT);

    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactId: 'sample-implementation-plan-v1',
          artifactType: 'implementation_plan',
          valid: true,
        }),
      ]),
    );
    expect(renderArtifactPackageList(result)).toContain('sample-implementation-plan-v1');
  });

  it('renders an empty-list message when no artifact packages exist under the root', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-artifact-empty-'));
    const artifactRoot = join(tempDir, 'artifacts');
    await mkdir(artifactRoot, { recursive: true });

    const result = await listArtifactPackages(artifactRoot);

    expect(result.artifacts).toEqual([]);
    expect(renderArtifactPackageList(result)).toContain('No artifact packages found');
  });

  it('marks invalid artifact manifests when listing a custom root', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-artifact-invalid-'));
    const artifactRoot = join(tempDir, 'artifacts');
    const brokenPackage = join(artifactRoot, 'broken');
    await mkdir(brokenPackage, { recursive: true });
    await writeFile(join(brokenPackage, 'manifest.json'), '{"artifactId":""}', 'utf8');

    const result = await listArtifactPackages(artifactRoot);

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toMatchObject({
      relativePackagePath: 'broken',
      artifactType: 'invalid',
      valid: false,
    });
    expect(renderArtifactPackageList(result)).toContain('broken | INVALID');
  });

  it('shows package details and can inline a registered view by name', async () => {
    const details = await inspectArtifactPackage('sample-implementation-plan-v1', {
      rootDir: ARTIFACT_ROOT,
      viewName: 'markdown',
    });

    expect(details.manifest.title).toBe('Phase 1 artifact package slice');
    expect(details.selectedView?.body).toContain('# Phase 1 Artifact Package Slice');
    expect(renderArtifactPackageDetails(details)).toContain('View: markdown');
  });

  it('inspects a package when pointed at its manifest.json file directly', async () => {
    const details = await inspectArtifactPackage(join(SAMPLE_PACKAGE, 'manifest.json'));

    expect(details.manifest.artifactId).toBe('sample-implementation-plan-v1');
  });

  it('throws when an artifact id is ambiguous under the selected root', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-artifact-ambiguous-'));
    const artifactRoot = join(tempDir, 'artifacts');
    await cp(SAMPLE_PACKAGE, join(artifactRoot, 'samples', 'copy-a'), { recursive: true });
    await cp(SAMPLE_PACKAGE, join(artifactRoot, 'samples', 'copy-b'), { recursive: true });

    await expect(
      inspectArtifactPackage('sample-implementation-plan-v1', { rootDir: artifactRoot }),
    ).rejects.toThrow('is ambiguous');
  });

  it('throws when the selected artifact target is not found', async () => {
    await expect(
      inspectArtifactPackage('missing-artifact', { rootDir: ARTIFACT_ROOT }),
    ).rejects.toThrow('was not found');
  });

  it('throws when the inspected manifest is readable JSON but invalid', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-inspect-invalid-manifest-');
    tempDir = copied.tempRoot;
    const manifestPath = join(copied.copiedPackage, 'manifest.json');
    await writeFile(manifestPath, '{"artifactId":""}', 'utf8');

    await expect(inspectArtifactPackage(copied.copiedPackage)).rejects.toThrow(
      'Artifact manifest is invalid',
    );
  });

  it('throws when the requested view name is not registered', async () => {
    await expect(
      inspectArtifactPackage('sample-implementation-plan-v1', {
        rootDir: ARTIFACT_ROOT,
        viewName: 'docx',
      }),
    ).rejects.toThrow('is not registered');
  });

  it('throws when the requested view file is missing on disk', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-missing-view-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;
    await rm(join(copiedPackage, 'views', 'artifact.md'));

    await expect(
      inspectArtifactPackage(copiedPackage, {
        viewName: 'markdown',
      }),
    ).rejects.toThrow('is missing');
  });

  it('rejects manifests that try to traverse outside the package via registered view paths', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-view-traversal-');
    tempDir = copied.tempRoot;
    const manifestPath = join(copied.copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    const views = manifest['views'] as Record<string, unknown>[];
    views[0]!['path'] = 'views/../../outside.md';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    await expect(inspectArtifactPackage(copied.copiedPackage)).rejects.toThrow(
      /views\.0\.path: .*package root/i,
    );
  });

  it('validates the shipped sample package successfully', async () => {
    const result = await validateArtifactPackage('sample-implementation-plan-v1', {
      rootDir: ARTIFACT_ROOT,
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(renderArtifactValidationResult(result)).toContain('Validation: PASS');
  });

  it('reports invalid manifest fields as ART-001 validation issues', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-invalid-manifest-');
    tempDir = copied.tempRoot;
    await writeFile(join(copied.copiedPackage, 'manifest.json'), '{"artifactId":""}', 'utf8');

    const result = await validateArtifactPackage(copied.copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-001',
          path: 'artifactId',
        }),
      ]),
    );
  });

  it('reports a missing declaration schema as a validation issue', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-missing-declaration-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;

    const manifestPath = join(copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest['declarationRef'] = '../../schemas/types/does-not-exist.schema.json';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const result = await validateArtifactPackage(copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-004',
          path: '../../schemas/types/does-not-exist.schema.json',
        }),
      ]),
    );
  });

  it('reports unreadable canonical content as a validation issue', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-invalid-content-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;
    const brokenContent = '{not json}';
    await writeFile(join(copiedPackage, 'content', 'source.json'), brokenContent, 'utf8');

    const manifestPath = join(copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest['declarationRef'] = SAMPLE_DECLARATION;
    const content = manifest['content'] as Record<string, unknown>;
    content['sha256'] = createHash('sha256').update(brokenContent).digest('hex');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const result = await validateArtifactPackage(copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-005',
          path: 'content/source.json',
        }),
      ]),
    );
  });

  it('emits a warning when no built-in payload validator exists for the artifact type', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-unsupported-payload-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;

    const manifestPath = join(copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest['artifactType'] = 'custom_packet';
    manifest['declarationRef'] = SAMPLE_DECLARATION;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const result = await validateArtifactPackage(copiedPackage);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-W001',
        }),
      ]),
    );
    expect(renderArtifactValidationResult(result)).toContain('Warnings:');
  });

  it('reports missing registered files as validation issues', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-missing-file-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;
    await rm(join(copiedPackage, 'views', 'artifact.json'));

    const result = await validateArtifactPackage(copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-002',
          path: 'views/artifact.json',
        }),
      ]),
    );
  });

  it('reports path traversal in registered file paths as ART-001 manifest issues', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-invalid-view-path-');
    tempDir = copied.tempRoot;
    const manifestPath = join(copied.copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    const views = manifest['views'] as Record<string, unknown>[];
    views[0]!['path'] = 'views/../../outside.md';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const result = await validateArtifactPackage(copied.copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-001',
          path: 'views.0.path',
        }),
      ]),
    );
  });

  it('reports traversal-capable attachment paths as ART-001 manifest issues', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-invalid-attachment-path-');
    tempDir = copied.tempRoot;
    const manifestPath = join(copied.copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest['attachments'] = [
      {
        name: 'leak',
        path: 'attachments/../../outside.txt',
        mediaType: 'text/plain',
        role: 'debug',
        sha256: createHash('sha256').update('outside').digest('hex'),
      },
    ];
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const result = await validateArtifactPackage(copied.copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-001',
          path: 'attachments.0.path',
          message: expect.stringContaining('package root'),
        }),
      ]),
    );
  });

  it('reports schema-invalid implementation-plan payloads as ART-006 issues', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-invalid-payload-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;
    const invalidPayload = '{}';
    await writeFile(join(copiedPackage, 'content', 'source.json'), invalidPayload, 'utf8');

    const manifestPath = join(copiedPackage, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest['declarationRef'] = SAMPLE_DECLARATION;
    const content = manifest['content'] as Record<string, unknown>;
    content['sha256'] = createHash('sha256').update(invalidPayload).digest('hex');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const result = await validateArtifactPackage(copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-006',
        }),
      ]),
    );
  });

  it('reports checksum failures for broken registered files', async () => {
    const copied = await copySamplePackageToTemp('pl-artifact-inspect-');
    tempDir = copied.tempRoot;
    const copiedPackage = copied.copiedPackage;

    const markdownPath = join(copiedPackage, 'views', 'artifact.md');
    const originalMarkdown = await readFile(markdownPath, 'utf8');
    await writeFile(markdownPath, `${originalMarkdown}\ncorrupted\n`, 'utf8');

    const result = await validateArtifactPackage(copiedPackage);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ART-003',
          path: 'views/artifact.md',
        }),
      ]),
    );
  });
});

async function copySamplePackageToTemp(
  prefix: string,
): Promise<{ readonly tempRoot: string; readonly copiedPackage: string }> {
  const tempRoot = await mkdtemp(join(tmpdir(), prefix));
  const artifactRoot = join(tempRoot, 'artifacts');
  const copiedPackage = join(artifactRoot, 'samples', 'sample-copy');
  await cp(SAMPLE_PACKAGE, copiedPackage, { recursive: true });
  await cp(SAMPLE_SCHEMAS, join(artifactRoot, 'schemas'), { recursive: true });
  return { tempRoot, copiedPackage };
}
