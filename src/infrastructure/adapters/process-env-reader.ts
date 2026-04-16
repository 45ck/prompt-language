/**
 * ProcessEnvReader — adapter that reads from `process.env`.
 *
 * Thin, side-effect-free wrapper so the application layer can consult
 * environment variables via the EnvReaderPort.
 */
import type { EnvReaderPort } from '../../application/ports/env-reader.js';

export class ProcessEnvReader implements EnvReaderPort {
  read(name: string): string | undefined {
    return process.env[name];
  }
}
