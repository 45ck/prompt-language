/**
 * FileCaptureReader — reads/clears captured variable files from `.prompt-language/vars/`.
 */

import { readFile, unlink, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CAPTURE_PENDING_SENTINEL,
  type CaptureReader,
} from '../../application/ports/capture-reader.js';
import { resolveStateRoot } from './resolve-state-root.js';

const MAX_CAPTURE_LENGTH = 2000;
const SAFE_VAR_NAME = /^\w+$/;

export class FileCaptureReader implements CaptureReader {
  readonly PENDING_SENTINEL = CAPTURE_PENDING_SENTINEL;
  private readonly stateRoot: string;

  constructor(basePath: string, stateDir = '.prompt-language') {
    this.stateRoot = resolveStateRoot(basePath, stateDir);
  }

  private buildCapturePath(varName: string): string {
    return join(this.stateRoot, 'vars', varName);
  }

  async read(varName: string): Promise<string | null> {
    if (!SAFE_VAR_NAME.test(varName)) return null;
    try {
      const filePath = this.buildCapturePath(varName);
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
      const filePath = this.buildCapturePath(varName);
      await unlink(filePath);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async prime(varName: string): Promise<void> {
    if (!SAFE_VAR_NAME.test(varName)) return;
    const filePath = this.buildCapturePath(varName);
    await mkdir(join(this.stateRoot, 'vars'), { recursive: true });
    await writeFile(filePath, CAPTURE_PENDING_SENTINEL, 'utf-8');
  }

  async ensureDir(): Promise<void> {
    await mkdir(join(this.stateRoot, 'vars'), { recursive: true });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
