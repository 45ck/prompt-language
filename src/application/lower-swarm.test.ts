import { describe, expect, it } from 'vitest';

import { parseFlow } from './parse-flow.js';
import { expandSwarmDocument, lowerSwarmFlowLines } from './lower-swarm.js';
import { renderNodesToDsl } from './render-node-to-dsl.js';

const managerWorkerSwarmDsl = [
  'Goal: manager worker equivalence',
  '',
  'flow:',
  '  swarm delivery',
  '    role worker',
  '      run: echo worker-ready > worker-note.txt',
  `      return '{"status":"ready","artifact":"worker-note.txt"}'`,
  '    end',
  '    flow:',
  '      start worker',
  '      await all',
  '    end',
  '  end',
  '  run: echo ${delivery.worker.returned} > manager-returned.json',
  '  run: echo ${delivery.worker.status} > manager-status.txt',
].join('\n');

const managerWorkerExplicitDsl = [
  'Goal: manager worker equivalence',
  '',
  'flow:',
  '  spawn "worker"',
  '    let __swarm_id = "delivery"',
  '    let __swarm_role = "worker"',
  '    run: echo worker-ready > worker-note.txt',
  `    let __swarm_return = '{"status":"ready","artifact":"worker-note.txt"}'`,
  '    send parent "${__swarm_return}"',
  '  end',
  '  await "worker"',
  '  receive __delivery_worker_returned from "worker" timeout 30',
  '  run: echo ${delivery.worker.returned} > manager-returned.json',
  '  run: echo ${delivery.worker.status} > manager-status.txt',
].join('\n');

const reviewerAfterWorkersSwarmDsl = [
  'Goal: reviewer after workers equivalence',
  '',
  'flow:',
  '  swarm review_pass',
  '    role frontend',
  '      run: echo frontend-ready > frontend.txt',
  '      return "frontend-ready"',
  '    end',
  '    role backend',
  '      run: echo backend-ready > backend.txt',
  '      return "backend-ready"',
  '    end',
  '    role reviewer',
  '      run: echo ${frontend_result}+${backend_result} > review.txt',
  '      return ${frontend_result}-${backend_result}',
  '    end',
  '    flow:',
  '      start frontend, backend',
  '      await all',
  '      let frontend_result = ${review_pass.frontend.returned}',
  '      let backend_result = ${review_pass.backend.returned}',
  '      start reviewer',
  '      await reviewer',
  '    end',
  '  end',
  '  run: echo ${review_pass.reviewer.returned} > summary.txt',
].join('\n');

const reviewerAfterWorkersExplicitDsl = [
  'Goal: reviewer after workers equivalence',
  '',
  'flow:',
  '  spawn "frontend"',
  '    let __swarm_id = "review_pass"',
  '    let __swarm_role = "frontend"',
  '    run: echo frontend-ready > frontend.txt',
  '    let __swarm_return = "frontend-ready"',
  '    send parent "${__swarm_return}"',
  '  end',
  '  spawn "backend"',
  '    let __swarm_id = "review_pass"',
  '    let __swarm_role = "backend"',
  '    run: echo backend-ready > backend.txt',
  '    let __swarm_return = "backend-ready"',
  '    send parent "${__swarm_return}"',
  '  end',
  '  await "frontend"',
  '  receive __review_pass_frontend_returned from "frontend" timeout 30',
  '  await "backend"',
  '  receive __review_pass_backend_returned from "backend" timeout 30',
  '  let frontend_result = ${review_pass.frontend.returned}',
  '  let backend_result = ${review_pass.backend.returned}',
  '  spawn "reviewer"',
  '    let __swarm_id = "review_pass"',
  '    let __swarm_role = "reviewer"',
  '    run: echo ${frontend_result}+${backend_result} > review.txt',
  '    let __swarm_return = ${frontend_result}-${backend_result}',
  '    send parent "${__swarm_return}"',
  '  end',
  '  await "reviewer"',
  '  receive __review_pass_reviewer_returned from "reviewer" timeout 30',
  '  run: echo ${review_pass.reviewer.returned} > summary.txt',
].join('\n');

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
      '    let __swarm_id = "checkout_fix"',
      '    let __swarm_role = "frontend"',
      '    prompt: Fix the UI regression.',
      '    let __swarm_return = ${summary}',
      '    send parent "${__swarm_return}"',
      '  end',
      '  spawn "backend" in "packages/api"',
      '    let __swarm_id = "checkout_fix"',
      '    let __swarm_role = "backend"',
      '    prompt: Fix the API regression.',
      '    let __swarm_return = "api done"',
      '    send parent "${__swarm_return}"',
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

  it('await all preserves first-start order and does not duplicate repeated starts', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm triage',
      '    role worker',
      '      prompt: Handle the task.',
      '    end',
      '    role reviewer',
      '      prompt: Review the task.',
      '    end',
      '    flow:',
      '      start worker, reviewer',
      '      start worker',
      '      await all',
      '    end',
      '  end',
    ]);

    expect(lowered.warnings).toEqual([]);
    expect(lowered.lines.filter((line) => line.trimStart().startsWith('await "'))).toEqual([
      '  await "worker"',
      '  await "reviewer"',
    ]);
    expect(
      lowered.lines.filter((line) => line.trimStart().startsWith('receive __triage_')),
    ).toEqual([
      '  receive __triage_worker_returned from "worker" timeout 30',
      '  receive __triage_reviewer_returned from "reviewer" timeout 30',
    ]);
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

  it('includes nested starts in deterministic await all ordering', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm checkout_fix',
      '    role frontend',
      '      prompt: Fix the UI regression.',
      '    end',
      '    role backend',
      '      prompt: Fix the API regression.',
      '    end',
      '    flow:',
      '      if ui_changed',
      '        start frontend',
      '      end',
      '      start backend',
      '      await all',
      '    end',
      '  end',
    ]);

    expect(lowered.warnings).toEqual([]);
    expect(lowered.lines).toEqual([
      '  if ui_changed',
      '    spawn "frontend"',
      '      let __swarm_id = "checkout_fix"',
      '      let __swarm_role = "frontend"',
      '      prompt: Fix the UI regression.',
      '    end',
      '  end',
      '  spawn "backend"',
      '    let __swarm_id = "checkout_fix"',
      '    let __swarm_role = "backend"',
      '    prompt: Fix the API regression.',
      '  end',
      '  await "frontend"',
      '  receive __checkout_fix_frontend_returned from "frontend" timeout 30',
      '  await "backend"',
      '  receive __checkout_fix_backend_returned from "backend" timeout 30',
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
      '    let __swarm_id = "checkout_fix"',
      '    let __swarm_role = "frontend"',
      '    prompt: Fix the UI regression.',
      '  end',
    ]);
  });

  it('warns when await references an undeclared role', () => {
    const lowered = lowerSwarmFlowLines([
      '  swarm checkout_fix',
      '    role frontend',
      '      prompt: Fix the UI regression.',
      '    end',
      '    flow:',
      '      await backend',
      '    end',
      '  end',
    ]);

    expect(lowered.changed).toBe(true);
    expect(lowered.lines).toEqual([]);
    expect(lowered.warnings).toEqual([
      'swarm checkout_fix await references unknown role "backend"',
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
    expect(firstSpawn.body.map((node) => node.kind)).toEqual([
      'let',
      'let',
      'prompt',
      'let',
      'send',
    ]);
  });

  it('expands the authored document into a visible lowered flow preview', () => {
    const expanded = expandSwarmDocument(swarmDsl);

    expect(expanded.changed).toBe(true);
    expect(expanded.loweredFlowText).toContain('spawn "backend"');
    expect(expanded.loweredFlowText).toContain('let __swarm_id = "checkout_fix"');
    expect(expanded.loweredFlowText).toContain('let __swarm_return = ${summary}');
    expect(expanded.loweredFlowText).toContain(
      'receive __checkout_fix_frontend_returned from "frontend" timeout 30',
    );
  });

  it('matches the explicit hand-written runtime flow for equivalent orchestration', () => {
    const authored = parseFlow(swarmDsl);
    const explicit = parseFlow(
      [
        'Goal: swarm test',
        '',
        'flow:',
        '  spawn "backend"',
        '    let __swarm_id = "checkout_fix"',
        '    let __swarm_role = "backend"',
        '    prompt: Fix the API regression.',
        '    let __swarm_return = "done"',
        '    send parent "${__swarm_return}"',
        '  end',
        '  spawn "frontend" model "sonnet"',
        '    let __swarm_id = "checkout_fix"',
        '    let __swarm_role = "frontend"',
        '    prompt: Fix the UI regression.',
        '    let __swarm_return = ${summary}',
        '    send parent "${__swarm_return}"',
        '  end',
        '  await "backend"',
        '  receive __checkout_fix_backend_returned from "backend" timeout 30',
        '  await "frontend"',
        '  receive __checkout_fix_frontend_returned from "frontend" timeout 30',
      ].join('\n'),
    );

    expect(authored.warnings).toEqual([]);
    expect(explicit.warnings).toEqual([]);
    expect(renderNodesToDsl(authored.nodes, 0)).toEqual(renderNodesToDsl(explicit.nodes, 0));
  });

  it('matches the explicit manager-worker orchestration through parsing and lowering', () => {
    const authored = parseFlow(managerWorkerSwarmDsl);
    const explicit = parseFlow(managerWorkerExplicitDsl);

    expect(authored.warnings).toEqual([]);
    expect(explicit.warnings).toEqual([]);
    expect(renderNodesToDsl(authored.nodes, 0)).toEqual(renderNodesToDsl(explicit.nodes, 0));
    expect(authored.nodes.map((node) => node.kind)).toEqual([
      'spawn',
      'await',
      'receive',
      'run',
      'run',
    ]);
  });

  it('matches the explicit reviewer-after-workers orchestration through parsing and lowering', () => {
    const authored = parseFlow(reviewerAfterWorkersSwarmDsl);
    const explicit = parseFlow(reviewerAfterWorkersExplicitDsl);

    expect(authored.warnings).toEqual([]);
    expect(explicit.warnings).toEqual([]);
    expect(renderNodesToDsl(authored.nodes, 0)).toEqual(renderNodesToDsl(explicit.nodes, 0));
    expect(authored.nodes.map((node) => node.kind)).toEqual([
      'spawn',
      'spawn',
      'await',
      'receive',
      'await',
      'receive',
      'let',
      'let',
      'spawn',
      'await',
      'receive',
      'run',
    ]);
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
