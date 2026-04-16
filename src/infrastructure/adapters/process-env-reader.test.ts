import { describe, expect, it } from 'vitest';

import { ProcessEnvReader } from './process-env-reader.js';

describe('ProcessEnvReader', () => {
  it('reads present variables and returns undefined for missing variables', () => {
    const reader = new ProcessEnvReader();
    const prev = process.env['PL_TEST_ENV_READER'];

    process.env['PL_TEST_ENV_READER'] = 'present';
    try {
      expect(reader.read('PL_TEST_ENV_READER')).toBe('present');
      expect(reader.read('PL_TEST_ENV_READER_MISSING')).toBeUndefined();
    } finally {
      if (prev === undefined) {
        delete process.env['PL_TEST_ENV_READER'];
      } else {
        process.env['PL_TEST_ENV_READER'] = prev;
      }
    }
  });
});
