import { describe, it, expect } from 'vitest';
import { extractCaptureTag, extractAllCaptureTags } from './tag-capture-reader.js';
import { CAPTURE_TAG, captureTagName } from '../../domain/capture-prompt.js';

describe('extractCaptureTag', () => {
  it('extracts value from valid capture tag', () => {
    const text = `Here is my answer: <${CAPTURE_TAG} name="colors">red\ngreen\nblue</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'colors')).toBe('red\ngreen\nblue');
  });

  it('returns null when tag is not present', () => {
    const text = 'Just a regular response with no tags.';
    expect(extractCaptureTag(text, 'colors')).toBeNull();
  });

  it('returns null for different variable name', () => {
    const text = `<${CAPTURE_TAG} name="other">value</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'colors')).toBeNull();
  });

  it('returns null for empty content', () => {
    const text = `<${CAPTURE_TAG} name="x"></${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'x')).toBeNull();
  });

  it('returns null for whitespace-only content', () => {
    const text = `<${CAPTURE_TAG} name="x">   </${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'x')).toBeNull();
  });

  it('trims whitespace from captured content', () => {
    const text = `<${CAPTURE_TAG} name="val">  hello world  </${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'val')).toBe('hello world');
  });

  it('handles multiline content', () => {
    const text = `<${CAPTURE_TAG} name="items">
apple
banana
cherry
</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'items')).toBe('apple\nbanana\ncherry');
  });

  it('extracts from text with surrounding content', () => {
    const text = `I found the following:
<${CAPTURE_TAG} name="result">42</${CAPTURE_TAG}>
That's the answer.`;
    expect(extractCaptureTag(text, 'result')).toBe('42');
  });

  it('returns null when closing tag is missing', () => {
    const text = `<${CAPTURE_TAG} name="x">value without closing`;
    expect(extractCaptureTag(text, 'x')).toBeNull();
  });

  it('truncates content exceeding 2000 characters', () => {
    const longContent = 'x'.repeat(3000);
    const text = `<${CAPTURE_TAG} name="big">${longContent}</${CAPTURE_TAG}>`;
    const result = extractCaptureTag(text, 'big');
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2000);
  });

  it('handles special characters in content', () => {
    const text = `<${CAPTURE_TAG} name="code">const x = "hello"; // comment</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'code')).toBe('const x = "hello"; // comment');
  });

  it('extracts first match when multiple tags exist', () => {
    const text = `<${CAPTURE_TAG} name="x">first</${CAPTURE_TAG}> then <${CAPTURE_TAG} name="x">second</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'x')).toBe('first');
  });

  it('returns null for unsafe variable names (D7)', () => {
    const text = `<${CAPTURE_TAG} name="../../etc/passwd">evil</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, '../../etc/passwd')).toBeNull();
  });

  it('returns null when content contains nested capture tags (D7)', () => {
    const text = `<${CAPTURE_TAG} name="a">val-a <${CAPTURE_TAG} name="b">val-b</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'a')).toBeNull();
  });
});

describe('extractAllCaptureTags', () => {
  it('extracts multiple variables from text', () => {
    const text = `<${CAPTURE_TAG} name="a">alpha</${CAPTURE_TAG}> and <${CAPTURE_TAG} name="b">beta</${CAPTURE_TAG}>`;
    const result = extractAllCaptureTags(text);
    expect(result).toEqual([
      { varName: 'a', value: 'alpha' },
      { varName: 'b', value: 'beta' },
    ]);
  });

  it('returns empty array when no tags found', () => {
    expect(extractAllCaptureTags('no tags here')).toEqual([]);
  });

  it('deduplicates variable names (first wins)', () => {
    const text = `<${CAPTURE_TAG} name="x">first</${CAPTURE_TAG}> <${CAPTURE_TAG} name="x">second</${CAPTURE_TAG}>`;
    const result = extractAllCaptureTags(text);
    expect(result).toEqual([{ varName: 'x', value: 'first' }]);
  });

  it('skips tags with empty content', () => {
    const text = `<${CAPTURE_TAG} name="empty"></${CAPTURE_TAG}> <${CAPTURE_TAG} name="ok">value</${CAPTURE_TAG}>`;
    const result = extractAllCaptureTags(text);
    expect(result).toEqual([{ varName: 'ok', value: 'value' }]);
  });

  it('skips tags with unsafe variable names', () => {
    const text = `<${CAPTURE_TAG} name="../bad">evil</${CAPTURE_TAG}> <${CAPTURE_TAG} name="good">safe</${CAPTURE_TAG}>`;
    const result = extractAllCaptureTags(text);
    expect(result).toEqual([{ varName: 'good', value: 'safe' }]);
  });
});

describe('extractCaptureTag with nonce (H-SEC-004)', () => {
  const nonce = 'abcd1234';
  const tag = captureTagName(nonce);

  it('extracts value when nonce matches', () => {
    const text = `<${tag} name="x">hello</${tag}>`;
    expect(extractCaptureTag(text, 'x', nonce)).toBe('hello');
  });

  it('rejects tag without nonce when nonce is required', () => {
    const text = `<${CAPTURE_TAG} name="x">hello</${CAPTURE_TAG}>`;
    expect(extractCaptureTag(text, 'x', nonce)).toBeNull();
  });

  it('rejects tag with wrong nonce', () => {
    const wrongTag = captureTagName('deadbeef');
    const text = `<${wrongTag} name="x">hello</${wrongTag}>`;
    expect(extractCaptureTag(text, 'x', nonce)).toBeNull();
  });
});

describe('extractAllCaptureTags with nonce (H-SEC-004)', () => {
  const nonce = 'abcd1234';
  const tag = captureTagName(nonce);

  it('extracts only tags matching the nonce', () => {
    const text = `<${tag} name="a">alpha</${tag}> <${CAPTURE_TAG} name="b">beta</${CAPTURE_TAG}>`;
    const result = extractAllCaptureTags(text, nonce);
    expect(result).toEqual([{ varName: 'a', value: 'alpha' }]);
  });

  it('returns empty array when no tags match the nonce', () => {
    const text = `<${CAPTURE_TAG} name="x">val</${CAPTURE_TAG}>`;
    expect(extractAllCaptureTags(text, nonce)).toEqual([]);
  });
});
