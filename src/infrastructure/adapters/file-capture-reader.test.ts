import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureFilePath, CAPTURE_VARS_DIR } from '../../domain/capture-prompt.js';
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

  function capturePath(varName: string): string {
    return join(baseDir, captureFilePath(varName));
  }

  describe('read', () => {
    it('returns null when file does not exist', async () => {
      expect(await reader.read('missing')).toBeNull();
    });

    it('returns null for empty file', async () => {
      const varsDir = join(baseDir, CAPTURE_VARS_DIR);
      await mkdir(varsDir, { recursive: true });
      await writeFile(capturePath('empty'), '');
      expect(await reader.read('empty')).toBeNull();
    });

    it('returns trimmed content for existing file', async () => {
      const varsDir = join(baseDir, CAPTURE_VARS_DIR);
      await mkdir(varsDir, { recursive: true });
      await writeFile(capturePath('tasks'), '  bug1\nbug2  \n');
      expect(await reader.read('tasks')).toBe('bug1\nbug2');
    });

    it('truncates content longer than 2000 chars', async () => {
      const varsDir = join(baseDir, CAPTURE_VARS_DIR);
      await mkdir(varsDir, { recursive: true });
      const longContent = 'x'.repeat(3000);
      await writeFile(capturePath('big'), longContent);
      const result = await reader.read('big');
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2000);
    });

    it('returns null for path-traversal variable name', async () => {
      expect(await reader.read('../../etc/passwd')).toBeNull();
    });

    it('returns null for variable name with slashes', async () => {
      expect(await reader.read('../hack')).toBeNull();
    });

    it('returns null for variable name with dots', async () => {
      expect(await reader.read('foo.bar')).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes existing file', async () => {
      const varsDir = join(baseDir, CAPTURE_VARS_DIR);
      await mkdir(varsDir, { recursive: true });
      const filePath = capturePath('tasks');
      await writeFile(filePath, 'content');
      await reader.clear('tasks');
      await expect(access(filePath)).rejects.toThrow();
    });

    it('does not throw when file does not exist', async () => {
      await expect(reader.clear('nonexistent')).resolves.toBeUndefined();
    });

    it('is a no-op for path-traversal variable name', async () => {
      await expect(reader.clear('../hack')).resolves.toBeUndefined();
    });
  });

  describe('ensureDir', () => {
    it('creates the vars directory', async () => {
      await reader.ensureDir();
      const varsDir = join(baseDir, CAPTURE_VARS_DIR);
      await expect(access(varsDir)).resolves.toBeUndefined();
    });
  });

  describe('read rethrows non-ENOENT errors', () => {
    it('throws when var file path is a directory', async () => {
      // Create a directory where the var file would be
      const varPath = capturePath('myvar');
      await mkdir(varPath, { recursive: true });

      await expect(reader.read('myvar')).rejects.toThrow();
    });
  });

  describe('clear rethrows non-ENOENT errors', () => {
    it('throws when var file path is a non-empty directory', async () => {
      // Create a non-empty directory where the var file would be
      const varPath = capturePath('myvar');
      await mkdir(varPath, { recursive: true });
      await writeFile(join(varPath, 'dummy'), 'x', 'utf-8');

      await expect(reader.clear('myvar')).rejects.toThrow();
    });
  });
});
