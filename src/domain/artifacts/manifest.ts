export const ARTIFACT_MANIFEST_STATUSES = ['draft', 'active', 'superseded', 'archived'] as const;

export type ArtifactManifestStatus = (typeof ARTIFACT_MANIFEST_STATUSES)[number];

export const ARTIFACT_PRODUCER_KINDS = ['flow', 'runtime', 'host_integration', 'tool'] as const;

export type ArtifactProducerKind = (typeof ARTIFACT_PRODUCER_KINDS)[number];

export interface ArtifactProducer {
  readonly kind: ArtifactProducerKind;
  readonly name: string;
  readonly version: string;
}

export interface ArtifactOrigin {
  readonly runId: string;
  readonly flowNode: string;
  readonly phase: string;
}

export interface ArtifactContentReference {
  readonly path: 'content/source.json';
  readonly mediaType: 'application/json';
  readonly sha256: string;
}

export interface ArtifactViewReference {
  readonly name: string;
  readonly path: string;
  readonly mediaType: string;
  readonly renderer: string;
  readonly sha256: string;
}

export interface ArtifactAttachmentReference {
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
  readonly status: ArtifactManifestStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly producer: ArtifactProducer;
  readonly origin: ArtifactOrigin;
  readonly declarationRef?: string | undefined;
  readonly content: ArtifactContentReference;
  readonly views: readonly ArtifactViewReference[];
  readonly attachments: readonly ArtifactAttachmentReference[];
}
