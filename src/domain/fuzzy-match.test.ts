import { describe, it, expect } from 'vitest';
import { findSimilarPredicate } from './fuzzy-match.js';

describe('findSimilarPredicate', () => {
  it('suggests tests_pass for test_pass (missing s)', () => {
    expect(findSimilarPredicate('test_pass')).toBe('tests_pass');
  });

  it('suggests tests_fail for test_fail (missing s)', () => {
    expect(findSimilarPredicate('test_fail')).toBe('tests_fail');
  });

  it('suggests lint_pass for lint_pas (missing trailing s)', () => {
    expect(findSimilarPredicate('lint_pas')).toBe('lint_pass');
  });

  it('suggests tests_pass for tets_pass (transposition)', () => {
    expect(findSimilarPredicate('tets_pass')).toBe('tests_pass');
  });

  it('suggests pytest_pass for pytest_pas', () => {
    expect(findSimilarPredicate('pytest_pas')).toBe('pytest_pass');
  });

  it('suggests cargo_test_pass for cargo_test_pas', () => {
    expect(findSimilarPredicate('cargo_test_pas')).toBe('cargo_test_pass');
  });

  it('returns null for completely unrelated input', () => {
    expect(findSimilarPredicate('deploy_production')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(findSimilarPredicate('')).toBeNull();
  });

  it('suggests diff_nonempty for diff_nonmepty (transposition)', () => {
    expect(findSimilarPredicate('diff_nonmepty')).toBe('diff_nonempty');
  });

  it('handles not prefix — suggests tests_pass for not test_pass', () => {
    expect(findSimilarPredicate('not test_pass')).toBe('tests_pass');
  });

  it('returns exact match via substring containment for file_exist', () => {
    expect(findSimilarPredicate('file_exist')).toBe('file_exists');
  });
});
