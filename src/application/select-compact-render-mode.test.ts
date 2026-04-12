import { describe, expect, it } from 'vitest';

import { selectCompactRenderModeForEnvelope } from './select-compact-render-mode.js';

describe('selectCompactRenderModeForEnvelope', () => {
  it('keeps compact mode for a clean active-turn envelope', () => {
    const decision = selectCompactRenderModeForEnvelope(
      [
        '[prompt-language] Flow: clean flow | Status: active',
        '',
        '~ prompt: Gather facts.',
        '> run: npm test  <-- current',
        '',
        'Run npm test and report the result.',
        '',
        '[prompt-language: step 2/2 "run: npm test", vars: 0]',
      ].join('\n'),
    );

    expect(decision).toMatchObject({
      requestedMode: 'compact',
      actualMode: 'compact',
      escalated: false,
      triggerIds: [],
    });
  });

  it('forces full mode on resumed envelopes with pending child work', () => {
    const decision = selectCompactRenderModeForEnvelope(
      [
        '[prompt-language] Flow: parent flow | Status: active',
        '',
        '~ spawn "fix-auth"  [running]',
        '> await all  <-- current',
        '',
        '[resumed from [prompt-language: step 2/3 "await all", vars: 1]]',
        'Continue after restore.',
        '',
        '[prompt-language: step 2/3 "await all", vars: 1]',
      ].join('\n'),
    );

    expect(decision).toMatchObject({
      actualMode: 'full',
      escalated: true,
      triggerIds: ['resume_boundary', 'spawn_uncertainty'],
    });
  });

  it('forces full mode when gate status is still pending', () => {
    const decision = selectCompactRenderModeForEnvelope(
      [
        '[prompt-language] Flow: gated flow | Status: active',
        '',
        '> prompt: Keep going  <-- current',
        '',
        'done when:',
        '  tests_pass  [pending]',
        '  lint_pass  [pass]',
        '',
        'Continue.',
        '',
        '[prompt-language: step 1/1 "prompt: Keep going", vars: 0, gates: 1/2 passed]',
      ].join('\n'),
    );

    expect(decision).toMatchObject({
      actualMode: 'full',
      escalated: true,
      triggerIds: ['gate_uncertainty'],
    });
  });

  it('forces full mode for capture recovery markers', () => {
    const decision = selectCompactRenderModeForEnvelope(
      [
        '[prompt-language] Flow: capture flow | Status: active',
        '',
        '> let items = prompt "List three colors"  [awaiting response...]  <-- current',
        '',
        '[Capture active: write response to .prompt-language/vars/items using Write tool]',
        '',
        'List three colors.',
        '',
        '[Internal — prompt-language variable capture: Save the answer to the capture file.]',
      ].join('\n'),
    );

    expect(decision).toMatchObject({
      actualMode: 'full',
      escalated: true,
      triggerIds: ['capture_failure'],
    });
  });

  it('forces full mode for explicit state mismatch markers', () => {
    const decision = selectCompactRenderModeForEnvelope(
      [
        '[prompt-language] Flow: restored flow | Status: active',
        '',
        '> prompt: Continue  <-- current',
        '',
        '[PLR-004 Resume state is corrupted and could not be recovered from backup.]',
        'Continue.',
        '',
        '[prompt-language: step 1/1 "prompt: Continue", vars: 0]',
      ].join('\n'),
    );

    expect(decision).toMatchObject({
      actualMode: 'full',
      escalated: true,
      triggerIds: ['state_mismatch'],
    });
  });
});
