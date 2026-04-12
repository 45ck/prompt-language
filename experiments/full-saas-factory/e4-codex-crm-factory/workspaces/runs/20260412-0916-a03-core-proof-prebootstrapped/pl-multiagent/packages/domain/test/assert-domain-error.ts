import { expect } from 'vitest';

import { DomainError, type DomainErrorCode } from '../src/index.js';

export function expectDomainError(fn: () => unknown, code: DomainErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }

  throw new Error(`Expected DomainError with code "${code}".`);
}
