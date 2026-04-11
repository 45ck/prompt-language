import { resolve } from 'node:path';
import { z } from 'zod';
import type { ContextProfile, ContextProfileRegistry } from '../domain/context-profile.js';

const PROFILE_CONFIG_LOCATIONS = ['prompt-language.config.json', '.prompt-language/config.json'];

const nonEmptyString = z.string().trim().min(1);
const stringList = z.array(nonEmptyString);

const contextProfileSchema = z
  .object({
    systemPreamble: nonEmptyString.optional(),
    skills: stringList.optional(),
    memory: stringList.optional(),
    model: nonEmptyString.optional(),
    modelHints: stringList.optional(),
    toolPolicy: nonEmptyString.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.systemPreamble != null ||
      value.skills != null ||
      value.memory != null ||
      value.model != null ||
      value.modelHints != null ||
      value.toolPolicy != null,
    {
      message:
        'Profile definitions must set at least one of systemPreamble, skills, memory, model, modelHints, or toolPolicy.',
    },
  );

const promptLanguageConfigSchema = z
  .object({
    profiles: z.record(z.string().trim().min(1), contextProfileSchema).default({}),
  })
  .strict();

export function loadContextProfileRegistry(
  basePath: string,
  fileReader: (path: string) => string,
): ContextProfileRegistry {
  for (const relativePath of PROFILE_CONFIG_LOCATIONS) {
    const absolutePath = resolve(basePath, relativePath);
    let raw: string;

    try {
      raw = fileReader(absolutePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON.';
      throw new Error(`Invalid profile config at "${relativePath}": ${message}`);
    }

    const validated = promptLanguageConfigSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `Invalid profile config at "${relativePath}": ${validated.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join('; ')}`,
      );
    }

    const profiles = Object.fromEntries(
      Object.entries(validated.data.profiles).map(([name, profile]) => [
        name,
        {
          name,
          ...(profile.systemPreamble != null ? { systemPreamble: profile.systemPreamble } : {}),
          ...(profile.skills != null && profile.skills.length > 0
            ? { skills: profile.skills }
            : {}),
          ...(profile.memory != null && profile.memory.length > 0
            ? { memory: profile.memory }
            : {}),
          ...(profile.model != null ? { model: profile.model } : {}),
          ...(profile.modelHints != null && profile.modelHints.length > 0
            ? { modelHints: profile.modelHints }
            : {}),
          ...(profile.toolPolicy != null ? { toolPolicy: profile.toolPolicy } : {}),
        } satisfies ContextProfile,
      ]),
    );

    return profiles;
  }

  return {};
}

export function assertKnownContextProfile(
  registry: ContextProfileRegistry,
  profileName: string,
  source: string,
): void {
  if (registry[profileName] != null) {
    return;
  }

  const known = Object.keys(registry);
  const guidance =
    known.length === 0
      ? 'Define it under "profiles" in prompt-language.config.json.'
      : `Known profiles: ${known.join(', ')}. Define it under "profiles.${profileName}" in prompt-language.config.json.`;

  throw new Error(`Unknown profile "${profileName}" in ${source}. ${guidance}`);
}
