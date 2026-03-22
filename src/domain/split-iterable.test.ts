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

  describe('markdown bullet list parsing', () => {
    it('strips dash bullets', () => {
      expect(splitIterable('- alpha\n- beta\n- gamma')).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('strips asterisk bullets', () => {
      expect(splitIterable('* one\n* two\n* three')).toEqual(['one', 'two', 'three']);
    });

    it('strips plus bullets', () => {
      expect(splitIterable('+ foo\n+ bar')).toEqual(['foo', 'bar']);
    });

    it('handles leading/trailing whitespace on bullet lines', () => {
      expect(splitIterable('  - alpha  \n  - beta  ')).toEqual(['alpha', 'beta']);
    });

    it('filters empty lines between bullets', () => {
      expect(splitIterable('- a\n\n- b\n\n- c')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('numbered list parsing', () => {
    it('strips period-style numbers (1. )', () => {
      expect(splitIterable('1. first\n2. second\n3. third')).toEqual(['first', 'second', 'third']);
    });

    it('strips paren-style numbers (1) )', () => {
      expect(splitIterable('1) alpha\n2) beta')).toEqual(['alpha', 'beta']);
    });

    it('handles large numbers', () => {
      expect(splitIterable('10. ten\n11. eleven')).toEqual(['ten', 'eleven']);
    });
  });

  describe('mixed non-list newlines', () => {
    it('falls through to newline splitting when not all lines are list items', () => {
      expect(splitIterable('- bullet\nnot a bullet')).toEqual(['- bullet', 'not a bullet']);
    });
  });

  describe('priority order', () => {
    it('prefers JSON over newline when input starts with [', () => {
      expect(splitIterable('["a\\nb", "c"]')).toEqual(['a\nb', 'c']);
    });

    it('prefers newline over whitespace when newlines present', () => {
      expect(splitIterable('a b\nc d')).toEqual(['a b', 'c d']);
    });

    it('prefers markdown bullets over plain newline splitting', () => {
      expect(splitIterable('- item one\n- item two')).toEqual(['item one', 'item two']);
    });
  });
});
