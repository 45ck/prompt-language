/**
 * FileCaptureReader — reads/clears captured variable files from `.prompt-language/vars/`.
 */

import { readFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CaptureReader } from '../../application/ports/capture-reader.js';

const VARS_DIR = '.prompt-language/vars';
const MAX_CAPTURE_LENGTH = 2000;

export class FileCaptureReader implements CaptureReader {
  private readonly varsDir: string;

  constructor(basePath: string) {
    this.varsDir = join(basePath, VARS_DIR);
  }

  async read(varName: string): Promise<string | null> {
    try {
      const filePath = join(this.varsDir, varName);
      const content = await readFile(filePath, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) return null;
      if (trimmed.length > MAX_CAPTURE_LENGTH) {
        return trimmed.slice(0, MAX_CAPTURE_LENGTH);
      }
      return trimmed;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async clear(varName: string): Promise<void> {
    try {
      const filePath = join(this.varsDir, varName);
      await unlink(filePath);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.varsDir, { recursive: true });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
