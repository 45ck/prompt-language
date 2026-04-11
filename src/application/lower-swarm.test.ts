import { describe, expect, it } from 'vitest';

import { parseFlow } from './parse-flow.js';
import { expandSwarmDocument, lowerSwarmFlowLines } from './lower-swarm.js';

describe('lowerSwarmFlowLines', () => {
  it('lowers swarm roles into spawn and receive primitives', () => {
    const source = [
      '  swarm checkout_fix',
      '    role frontend model "sonnet" with vars summary, confidence',
      '      prompt: Fix the UI regression.',
      '      return ${summary}',
      '    end',
      '    role backend in "packages/api"',
      '      prompt: Fix the API regression.',
      '      return "api done"',
      '    end',
      '    flow:',
      '      start frontend, backend',
      '      await all',
      '    end',
      '  end',
    ];

    const lowered = lowerSwarmFlowLines(source);

    expect(lowered.changed).toBe(true);
    expect(lowered.warnings).toEqual([]);
    expect(lowered.lines).toEqual([
      '  spawn "frontend" model "sonnet" with vars summary, confidence',
      '    prompt: Fix the UI regression.',
      '    send parent "${summary}"',
      '  end',
      '  spawn "backend" in "packages/api"',
      '    prompt: Fix the API regression.',
      '    send parent "api done"',
      '  end',
      '  await "frontend"',
      '  receive __checkout_fix_frontend_returned from "frontend" timeout 30',
      '  await "backend"',
      '  receive __checkout_fix_backend_returned from "backend" timeout 30',
    ]);
  });

  it('preserves deterministic await all ordering from start order', () => {
    const source = [
      '  swarm review_pass',
      '    role reviewer',
      '      prompt: Review the patch.',
      '      return ${last_stdout}',
      '    end',
      '    role worker',
      '      prompt: Implement the patch.',
      '      return ${last_stdout}',
      '    end',
      '    flow:',
      '      start worker',
      '      start reviewer',
      '      await all',
      '    end',
      '  end',
    ];

    const lowered = lowerSwarmFlowLines(source);
    const joinLines = lowered.lines.filter((line) => line.trimStart().startsWith('await "'));
    const receiveLines = lowered.lines.filter((line) =>
      line.trimStart().startsWith('receive __review_pass_'),
    );

    expect(joinLines).toEqual(['  await "worker"', '  await "reviewer"']);
    expect(receiveLines).toEqual([
      '  receive __review_pass_worker_returned from "worker" timeout 30',
      '  receive __review_pass_reviewer_returned from "reviewer" timeout 30',
    ]);
  });

  it('splits role targets on commas and whitespace for start and await', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm triage',
      '    role frontend',
      '      prompt: Fix the UI regression.',
      '    end',
      '    role backend',
      '      prompt: Fix the API regression.',
      '    end',
      '    role qa',
      '      prompt: Verify the patch.',
      '    end',
      '    flow:',
      '      start frontend backend',
      '      await frontend, qa',
      '    end',
      '  end',
    ]);

    expect(lowered.warnings).toEqual([]);
    expect(lowered.lines).toContain('  spawn "frontend"');
    expect(lowered.lines).toContain('  spawn "backend"');
    expect(lowered.lines).toContain('  await "frontend"');
    expect(lowered.lines).toContain('  await "qa"');
  });

  it('warns when a swarm is missing flow and closing end markers', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm broken',
      '    role frontend',
      '      prompt: Fix it.',
      '    end',
    ]);

    expect(lowered.changed).toBe(true);
    expect(lowered.lines).toEqual([]);
    expect(lowered.warnings).toEqual([
      'swarm broken is missing a closing "end"',
      'swarm broken has no lowering flow body',
    ]);
  });

  it('warns when start references an undeclared role', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm checkout_fix',
      '    role frontend',
      '      prompt: Fix the UI regression.',
      '    end',
      '    flow:',
      '      start backend',
      '    end',
      '  end',
    ]);

    expect(lowered.changed).toBe(true);
    expect(lowered.lines).toEqual([]);
    expect(lowered.warnings).toEqual([
      'swarm checkout_fix start references unknown role "backend"',
    ]);
  });

  it('preserves blank lines and passthrough flow lines while lowering nested awaits', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm checkout_fix',
      '    role frontend',
      '      prompt: Fix the UI regression.',
      '    end',
      '    flow:',
      '      prompt: Summarize the issue.',
      '',
      '      if ready',
      '        await frontend',
      '      end',
      '    end',
      '  end',
    ]);

    expect(lowered.warnings).toEqual([]);
    expect(lowered.lines).toEqual([
      '  prompt: Summarize the issue.',
      '',
      '  if ready',
      '    await "frontend"',
      '    receive __checkout_fix_frontend_returned from "frontend" timeout 30',
      '  end',
    ]);
  });

  it('warns on malformed role headers and missing lowering flow bodies', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm checkout_fix',
      '    role "frontend"',
      '      prompt: Fix the UI regression.',
      '    end',
      '  end',
    ]);

    expect(lowered.changed).toBe(true);
    expect(lowered.lines).toEqual([]);
    expect(lowered.warnings).toEqual([
      'Invalid swarm role header: "role "frontend""',
      'swarm checkout_fix has no lowering flow body',
    ]);
  });

  it('warns when a flow block is missing its closing end', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm checkout_fix',
      '    role frontend',
      '      prompt: Fix the UI regression.',
      '    end',
      '    flow:',
      '      start frontend',
    ]);

    expect(lowered.changed).toBe(true);
    expect(lowered.warnings).toEqual([
      'swarm checkout_fix flow block is missing a closing "end"',
      'swarm checkout_fix is missing a closing "end"',
    ]);
    expect(lowered.lines).toEqual([
      '  spawn "frontend"',
      '    prompt: Fix the UI regression.',
      '  end',
    ]);
  });
});

describe('swarm lowering integration', () => {
  const swarmDsl = [
    'Goal: swarm test',
    '',
    'flow:',
    '  swarm checkout_fix',
    '    role frontend model "sonnet"',
    '      prompt: Fix the UI regression.',
    '      return ${summary}',
    '    end',
    '    role backend',
    '      prompt: Fix the API regression.',
    '      return "done"',
    '    end',
    '    flow:',
    '      start backend',
    '      start frontend',
    '      await all',
    '    end',
    '  end',
  ].join('\n');

  it('parses lowered swarm source as ordinary runtime nodes', () => {
    const expanded = expandSwarmDocument(swarmDsl);
    const spec = parseFlow(expanded.text);

    expect(spec.warnings).toEqual([]);
    expect(spec.nodes).toHaveLength(6);
    expect(spec.nodes[0]?.kind).toBe('spawn');
    expect(spec.nodes[1]?.kind).toBe('spawn');
    expect(spec.nodes[2]?.kind).toBe('await');
    expect(spec.nodes[3]?.kind).toBe('receive');
    expect(spec.nodes[4]?.kind).toBe('await');
    expect(spec.nodes[5]?.kind).toBe('receive');

    const firstSpawn = spec.nodes[0];
    if (firstSpawn?.kind !== 'spawn') {
      throw new Error('expected first node to be spawn');
    }

    expect(firstSpawn.name).toBe('backend');
    expect(firstSpawn.body.at(-1)?.kind).toBe('send');
  });

  it('expands the authored document into a visible lowered flow preview', () => {
    const expanded = expandSwarmDocument(swarmDsl);

    expect(expanded.changed).toBe(true);
    expect(expanded.loweredFlowText).toContain('spawn "backend"');
    expect(expanded.loweredFlowText).toContain(
      'receive __checkout_fix_frontend_returned from "frontend" timeout 30',
    );
  });

  it('returns the original document unchanged when no flow block exists', () => {
    const expanded = expandSwarmDocument('Goal: no flow here');

    expect(expanded).toEqual({
      text: 'Goal: no flow here',
      changed: false,
      warnings: [],
    });
  });
});
