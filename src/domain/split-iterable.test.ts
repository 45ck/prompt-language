import { describe, it, expect } from 'vitest';
import { splitIterable } from './split-iterable.js';

describe('splitIterable', () => {
  describe('empty / blank input', () => {
    it('returns empty array for empty string', () => {
      expect(splitIterable('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(splitIterable('   ')).toEqual([]);
    });
  });

  describe('JSON array parsing', () => {
    it('splits a JSON array of strings', () => {
      expect(splitIterable('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
    });

    it('stringifies non-string elements', () => {
      expect(splitIterable('[1, 2, 3]')).toEqual(['1', '2', '3']);
    });

    it('handles mixed types in JSON array', () => {
      expect(splitIterable('["hello", 42, true]')).toEqual(['hello', '42', 'true']);
    });

    it('handles nested objects in JSON array', () => {
      expect(splitIterable('[{"name":"a"}, {"name":"b"}]')).toEqual([
        '{"name":"a"}',
        '{"name":"b"}',
      ]);
    });

    it('handles single-element JSON array', () => {
      expect(splitIterable('["only"]')).toEqual(['only']);
    });

    it('handles empty JSON array', () => {
      expect(splitIterable('[]')).toEqual([]);
    });

    it('falls through on invalid JSON starting with [', () => {
      expect(splitIterable('[not json')).toEqual(['[not', 'json']);
    });
  });

  describe('newline-delimited parsing', () => {
    it('splits on newlines', () => {
      expect(splitIterable('src/a.ts\nsrc/b.ts\nsrc/c.ts')).toEqual([
        'src/a.ts',
        'src/b.ts',
        'src/c.ts',
      ]);
    });

    it('trims whitespace from lines', () => {
      expect(splitIterable('  foo  \n  bar  ')).toEqual(['foo', 'bar']);
    });

    it('filters empty lines', () => {
      expect(splitIterable('a\n\nb\n\nc')).toEqual(['a', 'b', 'c']);
    });

    it('handles single item with trailing newline', () => {
      expect(splitIterable('only\n')).toEqual(['only']);
    });
  });

  describe('whitespace-delimited parsing', () => {
    it('splits on spaces', () => {
      expect(splitIterable('a b c')).toEqual(['a', 'b', 'c']);
    });

    it('splits on tabs', () => {
      expect(splitIterable('a\tb\tc')).toEqual(['a', 'b', 'c']);
    });

    it('splits on mixed whitespace', () => {
      expect(splitIterable('a  b\tc')).toEqual(['a', 'b', 'c']);
    });

    it('handles single item', () => {
      expect(splitIterable('only')).toEqual(['only']);
    });
  });

  describe('priority order', () => {
    it('prefers JSON over newline when input starts with [', () => {
      expect(splitIterable('["a\\nb", "c"]')).toEqual(['a\nb', 'c']);
    });

    it('prefers newline over whitespace when newlines present', () => {
      expect(splitIterable('a b\nc d')).toEqual(['a b', 'c d']);
    });
  });
});
