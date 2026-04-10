import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '../../../..');

function readJson(relativePath: string): unknown {
  const raw = readFileSync(join(PROJECT_ROOT, relativePath), 'utf-8');
  return JSON.parse(raw);
}

// ── plugin.json schema (d4kl) ──────────────────────────────────────────

describe('plugin.json schema contract', () => {
  const plugin = readJson('.claude-plugin/plugin.json') as Record<string, unknown>;

  it('has a non-empty name string', () => {
    expect(typeof plugin['name']).toBe('string');
    expect((plugin['name'] as string).length).toBeGreaterThan(0);
  });

  it('has a valid semver version', () => {
    expect(typeof plugin['version']).toBe('string');
    expect(plugin['version']).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has a non-empty description string', () => {
    expect(typeof plugin['description']).toBe('string');
    expect((plugin['description'] as string).length).toBeGreaterThan(0);
  });

  it('has author as object with name property (not a string)', () => {
    expect(typeof plugin['author']).toBe('object');
    expect(plugin['author']).not.toBeNull();
    expect(Array.isArray(plugin['author'])).toBe(false);
    const author = plugin['author'] as Record<string, unknown>;
    expect(typeof author['name']).toBe('string');
    expect((author['name'] as string).length).toBeGreaterThan(0);
  });

  it('has a license field', () => {
    expect(plugin['license']).toBeDefined();
    expect(typeof plugin['license']).toBe('string');
  });
});

// ── marketplace.json schema (5vlf) ─────────────────────────────────────

describe('marketplace.json schema contract', () => {
  const marketplace = readJson('.claude-plugin/marketplace.json') as Record<string, unknown>;

  it('has a $schema field', () => {
    expect(marketplace['$schema']).toBeDefined();
    expect(typeof marketplace['$schema']).toBe('string');
  });

  it('has owner as object with name property', () => {
    expect(typeof marketplace['owner']).toBe('object');
    expect(marketplace['owner']).not.toBeNull();
    const owner = marketplace['owner'] as Record<string, unknown>;
    expect(typeof owner['name']).toBe('string');
    expect((owner['name'] as string).length).toBeGreaterThan(0);
  });

  it('has a non-empty plugins array', () => {
    expect(Array.isArray(marketplace['plugins'])).toBe(true);
    expect((marketplace['plugins'] as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  describe('each plugin entry', () => {
    const plugins = marketplace['plugins'] as Record<string, unknown>[];

    it('has required fields: name, description, version, author, source, category', () => {
      for (const entry of plugins) {
        expect(typeof entry['name']).toBe('string');
        expect(typeof entry['description']).toBe('string');
        expect(typeof entry['version']).toBe('string');
        expect(typeof entry['source']).toBe('string');
        expect(typeof entry['category']).toBe('string');
      }
    });

    it('has author as object (not string) in each entry', () => {
      for (const entry of plugins) {
        expect(typeof entry['author']).toBe('object');
        expect(entry['author']).not.toBeNull();
        const author = entry['author'] as Record<string, unknown>;
        expect(typeof author['name']).toBe('string');
      }
    });

    it('uses relative source paths', () => {
      for (const entry of plugins) {
        const source = entry['source'] as string;
        expect(source.startsWith('.') || source.startsWith('./')).toBe(true);
      }
    });

    it('has plugin name matching "prompt-language"', () => {
      const names = plugins.map((p) => p['name']);
      expect(names).toContain('prompt-language');
    });
  });
});

// ── Hook file structure (y5mf) ──────────────────────────────────────────

describe('hooks.json structure contract', () => {
  const hooksFile = readJson('hooks/hooks.json') as {
    hooks: Record<string, unknown[]>;
  };
  const hookEvents = Object.keys(hooksFile.hooks);

  const EXPECTED_EVENTS = [
    'UserPromptSubmit',
    'Stop',
    'TaskCompleted',
    'PostToolUse',
    'SessionStart',
  ];

  it('contains all expected hook events', () => {
    for (const event of EXPECTED_EVENTS) {
      expect(hookEvents).toContain(event);
    }
  });

  for (const event of EXPECTED_EVENTS) {
    describe(`${event} hook`, () => {
      it('has type "command" for all hooks', () => {
        const entries = hooksFile.hooks[event] as {
          hooks: { type: string; command: string }[];
        }[];
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            expect(hook.type).toBe('command');
          }
        }
      });

      it('uses ${CLAUDE_PLUGIN_ROOT} in command', () => {
        const entries = hooksFile.hooks[event] as {
          hooks: { command: string }[];
        }[];
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            expect(hook.command).toContain('${CLAUDE_PLUGIN_ROOT}');
          }
        }
      });

      it('references a dist file that exists on disk', () => {
        const entries = hooksFile.hooks[event] as {
          hooks: { command: string }[];
        }[];
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            // Extract the path after "node ${CLAUDE_PLUGIN_ROOT}/"
            const match = /\$\{CLAUDE_PLUGIN_ROOT\}\/(.+?)(?:\s|$)/.exec(hook.command);
            expect(match).not.toBeNull();
            const relativePath = match![1]!;
            const fullPath = join(PROJECT_ROOT, relativePath);
            expect(existsSync(fullPath), `Referenced file should exist: ${relativePath}`).toBe(
              true,
            );
          }
        }
      });
    });
  }

  it('matcher fields are valid regex patterns where present', () => {
    for (const event of hookEvents) {
      const entries = hooksFile.hooks[event] as { matcher?: string }[];
      for (const entry of entries) {
        if (entry.matcher) {
          expect(() => new RegExp(entry.matcher!)).not.toThrow();
        }
      }
    }
  });
});

// ── Installed file layout (fafi) ────────────────────────────────────────

describe('installed file layout contract', () => {
  it('.claude-plugin/plugin.json exists', () => {
    expect(existsSync(join(PROJECT_ROOT, '.claude-plugin/plugin.json'))).toBe(true);
  });

  it('.claude-plugin/marketplace.json exists', () => {
    expect(existsSync(join(PROJECT_ROOT, '.claude-plugin/marketplace.json'))).toBe(true);
  });

  it('hooks/hooks.json exists', () => {
    expect(existsSync(join(PROJECT_ROOT, 'hooks/hooks.json'))).toBe(true);
  });

  it('bin/cli.mjs exists', () => {
    expect(existsSync(join(PROJECT_ROOT, 'bin/cli.mjs'))).toBe(true);
  });

  it('dist/ directory exists', () => {
    expect(existsSync(join(PROJECT_ROOT, 'dist'))).toBe(true);
  });

  describe('skills/ directory', () => {
    const expectedSkills = ['deploy-check', 'fix-and-test', 'refactor', 'tdd', 'write-flow'];

    it('skills/ directory exists', () => {
      expect(existsSync(join(PROJECT_ROOT, 'skills'))).toBe(true);
    });

    for (const skill of expectedSkills) {
      it(`skills/${skill}/ subdirectory exists`, () => {
        expect(existsSync(join(PROJECT_ROOT, 'skills', skill))).toBe(true);
      });
    }
  });

  describe('commands/ directory', () => {
    const expectedCommands = ['flow-reset.md', 'flow-status.md', 'flow-run.md'];

    it('commands/ directory exists', () => {
      expect(existsSync(join(PROJECT_ROOT, 'commands'))).toBe(true);
    });

    for (const command of expectedCommands) {
      it(`commands/${command} exists`, () => {
        expect(existsSync(join(PROJECT_ROOT, 'commands', command))).toBe(true);
      });
    }
  });

  it('all hook command dist files exist', () => {
    const hooksFile = readJson('hooks/hooks.json') as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    for (const entries of Object.values(hooksFile.hooks)) {
      for (const entry of entries) {
        for (const hook of entry.hooks) {
          const match = /\$\{CLAUDE_PLUGIN_ROOT\}\/(.+?)(?:\s|$)/.exec(hook.command);
          if (match) {
            const fullPath = join(PROJECT_ROOT, match[1]!);
            expect(existsSync(fullPath), `Hook dist file should exist: ${match[1]}`).toBe(true);
          }
        }
      }
    }
  });
});
