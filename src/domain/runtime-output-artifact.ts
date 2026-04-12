export type RuntimeOutputArtifactChannel = 'stdout' | 'stderr';

export interface RuntimeOutputArtifactRecord {
  readonly artifactId: string;
  readonly artifactType: 'runtime_output';
  readonly channel: RuntimeOutputArtifactChannel;
  readonly content: string;
  readonly handle: string;
  readonly mediaType: 'text/plain';
  readonly nodeId: string;
  readonly runId: string;
  readonly scopedId: string;
  readonly sizeChars: number;
}

export function createRuntimeOutputArtifactRecord(input: {
  readonly channel: RuntimeOutputArtifactChannel;
  readonly content: string;
  readonly nodeId: string;
  readonly runId: string;
}): RuntimeOutputArtifactRecord {
  const artifactId = `runtime-output-${sanitizeArtifactToken(input.nodeId)}-${input.channel}`;
  const scopedId = `${input.runId}/${artifactId}`;
  return {
    artifactId,
    artifactType: 'runtime_output',
    channel: input.channel,
    content: input.content,
    handle: `artifact:${scopedId}`,
    mediaType: 'text/plain',
    nodeId: input.nodeId,
    runId: input.runId,
    scopedId,
    sizeChars: input.content.length,
  };
}

export function toRuntimeOutputArtifactVariableValue(
  record: RuntimeOutputArtifactRecord,
): Readonly<Record<string, string | number>> {
  return {
    artifactId: record.artifactId,
    artifactType: record.artifactType,
    channel: record.channel,
    content: record.content,
    handle: record.handle,
    mediaType: record.mediaType,
    nodeId: record.nodeId,
    runId: record.runId,
    scopedId: record.scopedId,
    sizeChars: record.sizeChars,
  };
}

function sanitizeArtifactToken(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'node';
}
