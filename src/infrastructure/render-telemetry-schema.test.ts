import { describe, expect, it } from 'vitest';

import {
  hookByteCompositionSchema,
  renderTelemetryByteCompositionMetricsSchema,
} from './render-telemetry-schema.js';

describe('renderTelemetryByteCompositionMetricsSchema', () => {
  it('requires byte-composition metrics for all three hooks', () => {
    const result = renderTelemetryByteCompositionMetricsSchema.safeParse({
      hookByteComposition: {
        userPromptSubmit: {
          stableBytes: 120,
          dynamicBytes: 30,
          variableBytes: 10,
          commandOutputBytes: 5,
          totalBytes: 150,
          visibleVariableCount: 4,
          changedVariableCount: 1,
        },
        stop: {
          stableBytes: 90,
          dynamicBytes: 20,
          variableBytes: 8,
          commandOutputBytes: 4,
          totalBytes: 110,
          visibleVariableCount: 3,
          changedVariableCount: 1,
        },
        taskCompleted: {
          stableBytes: 140,
          dynamicBytes: 35,
          variableBytes: 12,
          commandOutputBytes: 6,
          totalBytes: 175,
          visibleVariableCount: 5,
          changedVariableCount: 2,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing hook composition entries', () => {
    const result = renderTelemetryByteCompositionMetricsSchema.safeParse({
      hookByteComposition: {
        userPromptSubmit: {
          stableBytes: 120,
          dynamicBytes: 30,
          variableBytes: 10,
          commandOutputBytes: 5,
          totalBytes: 150,
          visibleVariableCount: 4,
          changedVariableCount: 1,
        },
        stop: {
          stableBytes: 90,
          dynamicBytes: 20,
          variableBytes: 8,
          commandOutputBytes: 4,
          totalBytes: 110,
          visibleVariableCount: 3,
          changedVariableCount: 1,
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['hookByteComposition', 'taskCompleted'],
        }),
      ]),
    );
  });
});

describe('hookByteCompositionSchema', () => {
  it('rejects totals that do not match stable plus dynamic bytes', () => {
    const result = hookByteCompositionSchema.safeParse({
      stableBytes: 100,
      dynamicBytes: 40,
      variableBytes: 12,
      commandOutputBytes: 8,
      totalBytes: 141,
      visibleVariableCount: 5,
      changedVariableCount: 2,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['totalBytes'],
          message: 'totalBytes must equal stableBytes + dynamicBytes.',
        }),
      ]),
    );
  });

  it('rejects dynamic bytes that do not cover variable and command output bytes', () => {
    const result = hookByteCompositionSchema.safeParse({
      stableBytes: 100,
      dynamicBytes: 15,
      variableBytes: 12,
      commandOutputBytes: 8,
      totalBytes: 115,
      visibleVariableCount: 5,
      changedVariableCount: 2,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['dynamicBytes'],
          message: 'dynamicBytes must cover at least variableBytes + commandOutputBytes.',
        }),
      ]),
    );
  });
});
