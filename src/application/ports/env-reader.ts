/**
 * EnvReaderPort — read process environment variables through a testable
 * boundary.
 *
 * Introduced with PR2 of the snapshot/rollback feature so advance-flow
 * does not reach into `process.env` for `PL_SNAPSHOT_INCLUDE_FILES` and
 * friends. Tests substitute an in-memory reader. Infrastructure adapters
 * wrap `process.env`.
 */
export interface EnvReaderPort {
  read(name: string): string | undefined;
}

/**
 * Empty env reader — all reads return undefined. Default for code paths
 * that should not look at the environment (unit tests, in-memory harness).
 */
export class EmptyEnvReader implements EnvReaderPort {
  read(_name: string): string | undefined {
    return undefined;
  }
}

export const EMPTY_ENV_READER: EnvReaderPort = new EmptyEnvReader();
