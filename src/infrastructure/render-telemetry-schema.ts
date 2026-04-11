import { z } from 'zod';

const nonNegativeIntSchema = z.number().int().min(0);

export const hookByteCompositionSchema = z
  .strictObject({
    stableBytes: nonNegativeIntSchema,
    dynamicBytes: nonNegativeIntSchema,
    variableBytes: nonNegativeIntSchema,
    commandOutputBytes: nonNegativeIntSchema,
    totalBytes: nonNegativeIntSchema,
    visibleVariableCount: nonNegativeIntSchema,
    changedVariableCount: nonNegativeIntSchema,
  })
  .superRefine((value, context) => {
    if (value.totalBytes !== value.stableBytes + value.dynamicBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'totalBytes must equal stableBytes + dynamicBytes.',
        path: ['totalBytes'],
      });
    }

    if (value.dynamicBytes < value.variableBytes + value.commandOutputBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dynamicBytes must cover at least variableBytes + commandOutputBytes.',
        path: ['dynamicBytes'],
      });
    }
  });

export const renderTelemetryHookByteCompositionSchema = z.strictObject({
  userPromptSubmit: hookByteCompositionSchema,
  stop: hookByteCompositionSchema,
  taskCompleted: hookByteCompositionSchema,
});

export const renderTelemetryByteCompositionMetricsSchema = z.strictObject({
  hookByteComposition: renderTelemetryHookByteCompositionSchema,
});

export type HookByteComposition = z.infer<typeof hookByteCompositionSchema>;
export type RenderTelemetryHookByteComposition = z.infer<
  typeof renderTelemetryHookByteCompositionSchema
>;
export type RenderTelemetryByteCompositionMetrics = z.infer<
  typeof renderTelemetryByteCompositionMetricsSchema
>;
