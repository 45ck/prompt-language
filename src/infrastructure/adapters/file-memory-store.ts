/**
 * FileMemoryStore — file-based implementation of the MemoryStore port.
 *
 * beads: prompt-language-7g58
 *
 * Stores persistent memory in `.prompt-language/memory.json` inside the
 * active working directory. The file is a JSON array of MemoryEntry objects.
 *
 * Concurrency: read-modify-write is not atomic at the OS level. For the
 * single-process Claude plugin use-case this is acceptable. If concurrent
 * writes are needed in the future, replace with file locking or a database.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { MemoryStore, MemoryEntry } from '../../application/ports/memory-store.js';

export class FileMemoryStore implements MemoryStore {
  private readonly memoryPath: string;

  constructor(stateDir: string) {
    this.memoryPath = join(stateDir, 'memory.json');
  }

  async append(entry: MemoryEntry): Promise<void> {
    const existing = await this.readAll();
    let updated: MemoryEntry[];

    if (entry.key !== undefined) {
      // Replace any existing entry with the same key
      const filtered = existing.filter((e) => e.key !== entry.key);
      updated = [...filtered, entry];
    } else {
      // Free-form text: always append
      updated = [...existing, entry];
    }

    await this.writeAll(updated);
  }

  async findByKey(key: string): Promise<MemoryEntry | undefined> {
    const all = await this.readAll();
    // Return the last entry with this key (most recent)
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i]?.key === key) return all[i];
    }
    return undefined;
  }

  async readAll(): Promise<readonly MemoryEntry[]> {
    try {
      const raw = await readFile(this.memoryPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed as MemoryEntry[];
    } catch {
      // File does not exist or is unreadable — return empty
      return [];
    }
  }

  private async writeAll(entries: readonly MemoryEntry[]): Promise<void> {
    await mkdir(dirname(this.memoryPath), { recursive: true });
    await writeFile(this.memoryPath, JSON.stringify(entries, null, 2), 'utf-8');
  }
}
