/**
 * Resolver — how dynamic state values get filled.
 *
 * Priority order:
 * 1. deterministic (exit code, file exists, loop count)
 * 2. parsed (extract from command output)
 * 3. inferred (narrow Claude evaluator with strict JSON schema)
 * 4. human (user input, policy config)
 */

export type ResolverSource = 'deterministic' | 'parsed' | 'inferred' | 'human';

export interface Resolver {
  readonly name: string;
  readonly source: ResolverSource;
  readonly description: string;
}

export interface ResolvedVariable {
  readonly name: string;
  readonly value: string | number | boolean;
  readonly source: ResolverSource;
}

/**
 * Built-in resolver names for common deterministic cases.
 */
export const BUILTIN_RESOLVERS = [
  'tests_pass',
  'tests_fail',
  'lint_pass',
  'lint_fail',
  'command_failed',
  'command_succeeded',
  'file_exists',
  'diff_nonempty',
  'last_exit_code',
] as const;

export type BuiltinResolverName = (typeof BUILTIN_RESOLVERS)[number];

export function isBuiltinResolver(name: string): name is BuiltinResolverName {
  return (BUILTIN_RESOLVERS as readonly string[]).includes(name);
}

export function createResolver(
  name: string,
  source: ResolverSource,
  description: string,
): Resolver {
  return { name, source, description };
}

export function createResolvedVariable(
  name: string,
  value: string | number | boolean,
  source: ResolverSource,
): ResolvedVariable {
  return { name, value, source };
}
