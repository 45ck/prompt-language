import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileCaptureReader } from './file-capture-reader.js';

describe('FileCaptureReader', () => {
  let baseDir: string;
  let reader: FileCaptureReader;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'capture-test-'));
    reader = new FileCaptureReader(baseDir);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  describe('read', () => {
    it('returns null when file does not exist', async () => {
      expect(await reader.read('missing')).toBeNull();
    });

    it('returns null for empty file', async () => {
      const varsDir = join(baseDir, '.prompt-language', 'vars');
      await mkdir(varsDir, { recursive: true });
      await writeFile(join(varsDir, 'empty'), '');
      expect(await reader.read('empty')).toBeNull();
    });

    it('returns trimmed content for existing file', async () => {
      const varsDir = join(baseDir, '.prompt-language', 'vars');
      await mkdir(varsDir, { recursive: true });
      await writeFile(join(varsDir, 'tasks'), '  bug1\nbug2  \n');
      expect(await reader.read('tasks')).toBe('bug1\nbug2');
    });

    it('truncates content longer than 2000 chars', async () => {
      const varsDir = join(baseDir, '.prompt-language', 'vars');
      await mkdir(varsDir, { recursive: true });
      const longContent = 'x'.repeat(3000);
      await writeFile(join(varsDir, 'big'), longContent);
      const result = await reader.read('big');
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2000);
    });
  });

  describe('clear', () => {
    it('removes existing file', async () => {
      const varsDir = join(baseDir, '.prompt-language', 'vars');
      await mkdir(varsDir, { recursive: true });
      const filePath = join(varsDir, 'tasks');
      await writeFile(filePath, 'content');
      await reader.clear('tasks');
      await expect(access(filePath)).rejects.toThrow();
    });

    it('does not throw when file does not exist', async () => {
      await expect(reader.clear('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('ensureDir', () => {
    it('creates the vars directory', async () => {
      await reader.ensureDir();
      const varsDir = join(baseDir, '.prompt-language', 'vars');
      await expect(access(varsDir)).resolves.toBeUndefined();
    });
  });
});
