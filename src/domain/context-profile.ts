export interface ContextProfile {
  readonly name: string;
  readonly systemPreamble?: string | undefined;
  readonly skills?: readonly string[] | undefined;
  readonly memory?: readonly string[] | undefined;
  readonly model?: string | undefined;
  readonly modelHints?: readonly string[] | undefined;
  readonly toolPolicy?: string | undefined;
}

export type ContextProfileRegistry = Readonly<Record<string, ContextProfile>>;

export interface ResolvedContextProfile {
  readonly appliedProfiles: readonly string[];
  readonly systemPreambles: readonly string[];
  readonly skills: readonly string[];
  readonly memory: readonly string[];
  readonly model?: string | undefined;
  readonly modelHints: readonly string[];
  readonly toolPolicy?: string | undefined;
}

function dedupePreserveOrder(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }

  return ordered;
}

export function resolveContextProfile(
  registry: ContextProfileRegistry | undefined,
  names: readonly string[],
): ResolvedContextProfile | undefined {
  if (registry == null || names.length === 0) {
    return undefined;
  }

  const orderedNames = dedupePreserveOrder(names);
  const appliedProfiles: string[] = [];
  const systemPreambles: string[] = [];
  const skills: string[] = [];
  const memory: string[] = [];
  const modelHints: string[] = [];
  let model: string | undefined;
  let toolPolicy: string | undefined;

  for (const name of orderedNames) {
    const profile = registry[name];
    if (profile == null) continue;

    appliedProfiles.push(name);
    if (profile.systemPreamble != null) {
      systemPreambles.push(profile.systemPreamble);
    }
    if (profile.skills != null) {
      skills.push(...profile.skills);
    }
    if (profile.memory != null) {
      memory.push(...profile.memory);
    }
    if (profile.model != null) {
      model = profile.model;
    }
    if (profile.modelHints != null) {
      modelHints.push(...profile.modelHints);
    }
    if (profile.toolPolicy != null) {
      toolPolicy = profile.toolPolicy;
    }
  }

  if (appliedProfiles.length === 0) {
    return undefined;
  }

  return {
    appliedProfiles,
    systemPreambles,
    skills: dedupePreserveOrder(skills),
    memory: dedupePreserveOrder(memory),
    ...(model != null ? { model } : {}),
    modelHints: dedupePreserveOrder(modelHints),
    ...(toolPolicy != null ? { toolPolicy } : {}),
  };
}
