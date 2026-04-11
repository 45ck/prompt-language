import { describe, expect, it } from 'vitest';

import type { ArtifactManifest } from './manifest.js';
import { isArtifactManifest, validateArtifactManifest } from './validate-artifact-manifest.js';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SHA_C = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const SHA_D = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

function createValidManifest(): ArtifactManifest {
  return {
    manifestVersion: 1,
    artifactId: 'checkout-review-packet-v1',
    artifactType: 'browser_qa_packet',
    artifactSchemaVersion: 1,
    title: 'Checkout review packet',
    summary: 'Captured browser QA evidence for the checkout flow.',
    status: 'draft',
    createdAt: '2026-04-11T00:00:00Z',
    updatedAt: '2026-04-11T00:05:00Z',
    producer: {
      kind: 'flow',
      name: 'checkout.qa',
      version: 'v1',
    },
    origin: {
      runId: 'run-2026-04-11-001',
      flowNode: 'verify.checkout',
      phase: 'verify',
    },
    declarationRef: '../../../schemas/types/browser-qa-packet.schema.json',
    content: {
      path: 'content/source.json',
      mediaType: 'application/json',
      sha256: SHA_A,
    },
    views: [
      {
        name: 'markdown',
        path: 'views/artifact.md',
        mediaType: 'text/markdown',
        renderer: 'core-markdown',
        sha256: SHA_B,
      },
      {
        name: 'pdf',
        path: 'exports/artifact.pdf',
        mediaType: 'application/pdf',
        renderer: 'core-pdf',
        sha256: SHA_C,
      },
    ],
    attachments: [
      {
        name: 'checkout-screenshot',
        path: 'attachments/screenshots/checkout-step-1.png',
        mediaType: 'image/png',
        role: 'evidence',
        sha256: SHA_D,
      },
    ],
  };
}

describe('validateArtifactManifest', () => {
  it('accepts a manifest that matches the accepted package contract', () => {
    const manifest = createValidManifest();

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.manifest).toEqual(manifest);
    expect(isArtifactManifest(manifest)).toBe(true);
  });

  it('allows empty view and attachment inventories', () => {
    const manifest = {
      ...createValidManifest(),
      views: [],
      attachments: [],
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects a non-object manifest', () => {
    const result = validateArtifactManifest('not-a-manifest');

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      {
        path: '$',
        code: 'expected-object',
        message: 'Artifact manifest must be an object.',
      },
    ]);
  });

  it('rejects missing required fields', () => {
    const manifest = {
      manifestVersion: 1,
      artifactId: 'artifact-1',
      artifactSchemaVersion: 1,
      title: 'Artifact',
      summary: 'Summary',
      status: 'draft',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
      producer: {
        kind: 'flow',
        name: 'producer',
        version: 'v1',
      },
      views: [],
      attachments: [],
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'artifactType', code: 'required' }),
        expect.objectContaining({ path: 'origin', code: 'required' }),
        expect.objectContaining({ path: 'content', code: 'required' }),
      ]),
    );
  });

  it('rejects invalid lifecycle and provenance fields', () => {
    const manifest = {
      ...createValidManifest(),
      status: 'reviewing',
      createdAt: '11/04/2026',
      updatedAt: '2026-04-10T23:59:59Z',
      producer: {
        kind: 'agent',
        name: '',
        version: 'v1',
      },
      origin: {
        runId: 'run-1',
        flowNode: '',
        phase: 'verify',
      },
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'status', code: 'invalid-status' }),
        expect.objectContaining({ path: 'createdAt', code: 'invalid-date-time' }),
        expect.objectContaining({ path: 'producer.kind', code: 'invalid-producer-kind' }),
        expect.objectContaining({ path: 'producer.name', code: 'expected-string' }),
        expect.objectContaining({ path: 'origin.flowNode', code: 'expected-string' }),
      ]),
    );
  });

  it('rejects invalid canonical content references', () => {
    const manifest = {
      ...createValidManifest(),
      content: {
        path: 'views/artifact.json',
        mediaType: 'text/plain',
        sha256: 'not-a-sha',
      },
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'content.path', code: 'invalid-content-path' }),
        expect.objectContaining({
          path: 'content.mediaType',
          code: 'invalid-content-media-type',
        }),
        expect.objectContaining({ path: 'content.sha256', code: 'invalid-sha256' }),
      ]),
    );
  });

  it('rejects invalid and duplicate view references', () => {
    const manifest = {
      ...createValidManifest(),
      views: [
        {
          name: 'markdown',
          path: 'attachments/view.md',
          mediaType: 'text/markdown',
          renderer: 'core-markdown',
          sha256: SHA_B,
        },
        {
          name: 'markdown',
          path: 'views\\artifact.md',
          mediaType: 'text/markdown',
          renderer: 'core-markdown',
          sha256: SHA_C,
        },
        {
          name: 'html',
          path: 'views/artifact.html',
          mediaType: 'text/html',
          renderer: 'core-html',
          sha256: SHA_C,
        },
        {
          name: 'json',
          path: 'views/artifact.html',
          mediaType: 'application/json',
          renderer: 'core-json',
          sha256: SHA_D,
        },
      ],
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'views[0].path',
          code: 'invalid-reference-path',
        }),
        expect.objectContaining({
          path: 'views[1].path',
          code: 'invalid-reference-path',
        }),
        expect.objectContaining({
          path: 'views[1].name',
          code: 'duplicate-reference-name',
        }),
        expect.objectContaining({
          path: 'views[3].path',
          code: 'duplicate-reference-path',
        }),
      ]),
    );
  });

  it('rejects invalid and conflicting attachment references', () => {
    const manifest = {
      ...createValidManifest(),
      attachments: [
        {
          name: 'evidence',
          path: 'attachments/./step-1.png',
          mediaType: 'image/png',
          role: 'evidence',
          sha256: SHA_D,
        },
        {
          name: 'evidence',
          path: 'attachments/screenshots/checkout-step-1.png',
          mediaType: 'image/png',
          role: 'evidence',
          sha256: SHA_C,
        },
        {
          name: 'render-copy',
          path: 'attachments/screenshots/checkout-step-1.png',
          mediaType: 'application/pdf',
          role: 'supporting-image',
          sha256: SHA_B,
        },
      ],
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'attachments[0].path',
          code: 'invalid-reference-path',
        }),
        expect.objectContaining({
          path: 'attachments[1].name',
          code: 'duplicate-reference-name',
        }),
        expect.objectContaining({
          path: 'attachments[2].path',
          code: 'duplicate-reference-path',
        }),
      ]),
    );
  });

  it('rejects malformed scalar fields and optional declaration references', () => {
    const manifest = {
      ...createValidManifest(),
      manifestVersion: 0,
      artifactSchemaVersion: 0,
      title: '   ',
      summary: '',
      declarationRef: 42,
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'manifestVersion', code: 'expected-integer' }),
        expect.objectContaining({ path: 'artifactSchemaVersion', code: 'expected-integer' }),
        expect.objectContaining({ path: 'title', code: 'expected-string' }),
        expect.objectContaining({ path: 'summary', code: 'expected-string' }),
        expect.objectContaining({ path: 'declarationRef', code: 'expected-string' }),
      ]),
    );
  });

  it('rejects non-object nested records and non-array inventories', () => {
    const manifest = {
      ...createValidManifest(),
      producer: 'flow',
      origin: null,
      content: [],
      views: {},
      attachments: 'attachments',
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'producer', code: 'expected-object' }),
        expect.objectContaining({ path: 'origin', code: 'expected-object' }),
        expect.objectContaining({ path: 'content', code: 'expected-object' }),
        expect.objectContaining({ path: 'views', code: 'expected-array' }),
        expect.objectContaining({ path: 'attachments', code: 'expected-array' }),
      ]),
    );
  });

  it('rejects non-object view and attachment entries', () => {
    const manifest = {
      ...createValidManifest(),
      views: [null],
      attachments: [7],
    };

    const result = validateArtifactManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'views[0]',
          code: 'expected-object',
        }),
        expect.objectContaining({
          path: 'attachments[0]',
          code: 'expected-object',
        }),
      ]),
    );
  });
});
