import { describe, expect, it } from 'vitest';
import {
  createRuntimeOutputArtifactRecord,
  toRuntimeOutputArtifactVariableValue,
} from './runtime-output-artifact.js';

describe('createRuntimeOutputArtifactRecord', () => {
  it('builds deterministic artifact ids and handles for runtime outputs', () => {
    const record = createRuntimeOutputArtifactRecord({
      channel: 'stdout',
      content: 'hello world',
      nodeId: 'Run Step 1',
      runId: 'session-7',
    });

    expect(record).toEqual({
      artifactId: 'runtime-output-run-step-1-stdout',
      artifactType: 'runtime_output',
      channel: 'stdout',
      content: 'hello world',
      handle: 'artifact:session-7/runtime-output-run-step-1-stdout',
      mediaType: 'text/plain',
      nodeId: 'Run Step 1',
      runId: 'session-7',
      scopedId: 'session-7/runtime-output-run-step-1-stdout',
      sizeChars: 11,
    });
  });

  it('serializes records into plain variable-safe objects', () => {
    const record = createRuntimeOutputArtifactRecord({
      channel: 'stderr',
      content: 'boom',
      nodeId: 'r1',
      runId: 'session-2',
    });

    expect(toRuntimeOutputArtifactVariableValue(record)).toEqual({
      artifactId: 'runtime-output-r1-stderr',
      artifactType: 'runtime_output',
      channel: 'stderr',
      content: 'boom',
      handle: 'artifact:session-2/runtime-output-r1-stderr',
      mediaType: 'text/plain',
      nodeId: 'r1',
      runId: 'session-2',
      scopedId: 'session-2/runtime-output-r1-stderr',
      sizeChars: 4,
    });
  });
});
