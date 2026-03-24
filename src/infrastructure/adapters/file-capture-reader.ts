/**
 * FileCaptureReader — reads/clears captured variable files from `.prompt-language/vars/`.
 */

import { readFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CaptureReader } from '../../application/ports/capture-reader.js';
import { captureFilePath, CAPTURE_VARS_DIR } from '../../domain/capture-prompt.js';

const MAX_CAPTURE_LENGTH = 2000;
const SAFE_VAR_NAME = /^\w+$/;

export class FileCaptureReader implements CaptureReader {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async read(varName: string): Promise<string | null> {
    if (!SAFE_VAR_NAME.test(varName)) return null;
    try {
      const filePath = join(this.basePath, captureFilePath(varName));
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
    if (!SAFE_VAR_NAME.test(varName)) return;
    try {
      const filePath = join(this.basePath, captureFilePath(varName));
      await unlink(filePath);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async ensureDir(): Promise<void> {
    await mkdir(join(this.basePath, CAPTURE_VARS_DIR), { recursive: true });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
