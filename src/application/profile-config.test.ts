import { describe, expect, it } from 'vitest';
import { assertKnownContextProfile, loadContextProfileRegistry } from './profile-config.js';

function missingFile(path: string): never {
  const error = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  throw error;
}

describe('profile-config', () => {
  it('loads profiles from the primary config location', () => {
    const registry = loadContextProfileRegistry('/repo', (path) => {
      if (path.endsWith('prompt-language.config.json')) {
        return JSON.stringify({
          profiles: {
            reviewer: {
              systemPreamble: 'Review carefully.',
              skills: ['security-review'],
              memory: ['repo_rules'],
              model: 'profile-model',
              modelHints: ['fast'],
              toolPolicy: 'read-only',
            },
          },
        });
      }
      return missingFile(path);
    });

    expect(registry).toEqual({
      reviewer: {
        name: 'reviewer',
        systemPreamble: 'Review carefully.',
        skills: ['security-review'],
        memory: ['repo_rules'],
        model: 'profile-model',
        modelHints: ['fast'],
        toolPolicy: 'read-only',
      },
    });
  });

  it('falls back to the nested config location', () => {
    const registry = loadContextProfileRegistry('/repo', (path) => {
      if (
        path.endsWith('.prompt-language/config.json') ||
        path.endsWith('.prompt-language\\config.json')
      ) {
        return JSON.stringify({
          profiles: {
            planner: { skills: ['planning'] },
          },
        });
      }
      return missingFile(path);
    });

    expect(registry['planner']?.skills).toEqual(['planning']);
  });

  it('rejects invalid schema with a clear error', () => {
    expect(() =>
      loadContextProfileRegistry('/repo', (path) => {
        if (path.endsWith('prompt-language.config.json')) {
          return JSON.stringify({
            profiles: {
              empty: {},
            },
          });
        }
        return missingFile(path);
      }),
    ).toThrow(
      'Invalid profile config at "prompt-language.config.json": profiles.empty: Profile definitions must set at least one of systemPreamble, skills, memory, model, modelHints, or toolPolicy.',
    );
  });

  it('reports known profiles when a reference is unknown', () => {
    expect(() =>
      assertKnownContextProfile(
        {
          reviewer: { name: 'reviewer', systemPreamble: 'Review carefully.' },
          planner: { name: 'planner', skills: ['planning'] },
        },
        'missing',
        'flow-level use profile',
      ),
    ).toThrow(
      'Unknown profile "missing" in flow-level use profile. Known profiles: reviewer, planner. Define it under "profiles.missing" in prompt-language.config.json.',
    );
  });
});
