import { describe, it, expect, vi } from 'vitest';
import { createFlowSpec } from '../domain/flow-spec.js';
import { createSessionState } from '../domain/session-state.js';
import { terminateRunningSpawnedChildren } from './terminate-spawned-children.js';
import type { ProcessSpawner } from './ports/process-spawner.js';

function makeState() {
  const spec = createFlowSpec('goal', []);
  return createSessionState('s1', spec);
}

describe('terminateRunningSpawnedChildren', () => {
  it('returns the same state when it is not terminal', async () => {
    const state = makeState();
    const next = await terminateRunningSpawnedChildren(state, {
      spawn: vi.fn(),
      poll: vi.fn(),
    });

    expect(next).toBe(state);
  });

  it('marks running children failed and records a termination warning', async () => {
    const terminate = vi.fn(async () => true);
    const spawner: ProcessSpawner = {
      spawn: vi.fn(),
      poll: vi.fn(),
      terminate,
    };
    const state = {
      ...makeState(),
      status: 'failed' as const,
      spawnedChildren: {
        child: {
          name: 'child',
          status: 'running' as const,
          pid: 1234,
          stateDir: '/tmp/child',
        },
      },
    };

    const next = await terminateRunningSpawnedChildren(state, spawner);

    expect(terminate).toHaveBeenCalledWith(1234);
    expect(next.spawnedChildren['child']?.status).toBe('failed');
    expect(next.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('terminated spawned child "child"')]),
    );
  });

  it('records already-gone when the child termination hook returns false', async () => {
    const terminate = vi.fn(async () => false);
    const spawner: ProcessSpawner = {
      spawn: vi.fn(),
      poll: vi.fn(),
      terminate,
    };
    const state = {
      ...makeState(),
      status: 'cancelled' as const,
      spawnedChildren: {
        child: {
          name: 'child',
          status: 'running' as const,
          pid: 1234,
          stateDir: '/tmp/child',
        },
      },
    };

    const next = await terminateRunningSpawnedChildren(state, spawner);

    expect(terminate).toHaveBeenCalledWith(1234);
    expect(next.spawnedChildren['child']?.status).toBe('failed');
    expect(next.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('already gone')]),
    );
  });

  it('records when no process cleanup hook is available', async () => {
    const state = {
      ...makeState(),
      status: 'failed' as const,
      spawnedChildren: {
        child: {
          name: 'child',
          status: 'running' as const,
          pid: 1234,
          stateDir: '/tmp/child',
        },
      },
    };

    const next = await terminateRunningSpawnedChildren(state, {
      spawn: vi.fn(),
      poll: vi.fn(),
    });

    expect(next.spawnedChildren['child']?.status).toBe('failed');
    expect(next.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('no process cleanup available')]),
    );
  });

  it('leaves non-running children untouched', async () => {
    const state = {
      ...makeState(),
      status: 'failed' as const,
      spawnedChildren: {
        child: {
          name: 'child',
          status: 'completed' as const,
          pid: 1234,
          stateDir: '/tmp/child',
        },
      },
    };

    const next = await terminateRunningSpawnedChildren(state, {
      spawn: vi.fn(),
      poll: vi.fn(),
    });

    expect(next).toBe(state);
    expect(next.warnings).toEqual(state.warnings);
  });
});
