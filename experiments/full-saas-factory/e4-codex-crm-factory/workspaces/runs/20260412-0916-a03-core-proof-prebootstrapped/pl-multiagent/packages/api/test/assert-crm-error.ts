import { expect } from 'vitest';

import { CrmError, type CrmErrorCode } from '../src/index.js';

export function expectCrmError(fn: () => unknown, code: CrmErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CrmError);
    expect((error as CrmError).code).toBe(code);
    return;
  }

  throw new Error(`Expected CrmError with code "${code}".`);
}
