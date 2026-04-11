import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('shows package details and can inline a registered view by name', async () => {
    const details = await inspectArtifactPackage('sample-implementation-plan-v1', {
      rootDir: ARTIFACT_ROOT,
      viewName: 'markdown',
    });

    expect(details.manifest.title).toBe('Phase 1 artifact package slice');
    expect(details.selectedView?.body).toContain('# Phase 1 Artifact Package Slice');
    expect(renderArtifactPackageDetails(details)).toContain('View: markdown');
  });

  it('validates the shipped sample package successfully', async () => {
    const result = await validateArtifactPackage('sample-implementation-plan-v1', {
      rootDir: ARTIFACT_ROOT,
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(renderArtifactValidationResult(result)).toContain('Validation: PASS');
  });

  it('reports checksum failures for broken registered files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-artifact-inspect-'));
    const copiedPackage = join(tempDir, 'artifacts', 'sample-copy');
    await cp(SAMPLE_PACKAGE, copiedPackage, { recursive: true });

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
