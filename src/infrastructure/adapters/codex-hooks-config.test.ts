import { describe, expect, it } from 'vitest';

import {
  createManagedCodexHooksConfig,
  disableManagedCodexHooks,
  enableManagedCodexHooks,
  inspectCodexHooksConfig,
} from './codex-hooks-config.js';

describe('codex-hooks-config', () => {
  it('creates a managed Codex config scaffold with explicit ownership markers', () => {
    const raw = createManagedCodexHooksConfig();

    expect(raw).toContain('# prompt-language managed section: codex_hooks');
    expect(raw).toContain('[features]');
    expect(raw).toContain('codex_hooks = true # prompt-language managed: codex_hooks');
    expect(inspectCodexHooksConfig(raw)).toEqual({
      ownership: 'managed',
      enabled: true,
    });
  });

  it('enables managed codex_hooks inside an existing features section without crossing section boundaries', () => {
    const result = enableManagedCodexHooks(
      '[features]\nother_flag = true\n\n[runner]\nmodel = "gpt-5"\n',
    );

    expect(result.outcome).toBe('updated');
    expect(result.raw).toBe(
      '[features]\nother_flag = true\ncodex_hooks = true # prompt-language managed: codex_hooks\n\n[runner]\nmodel = "gpt-5"\n',
    );
    expect(result.snapshot).toEqual({
      ownership: 'managed',
      enabled: true,
    });
  });

  it('adds a managed features section when codex config is otherwise absent', () => {
    const result = enableManagedCodexHooks('# existing config\n[runner]\nmodel = "gpt-5"\n');

    expect(result.outcome).toBe('updated');
    expect(result.raw).toBe(
      '# existing config\n[runner]\nmodel = "gpt-5"\n\n# prompt-language managed section: codex_hooks\n[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\n',
    );
    expect(result.snapshot).toEqual({
      ownership: 'managed',
      enabled: true,
    });
  });

  it('upgrades a managed codex_hooks=false entry back to enabled on refresh', () => {
    const raw = '[features]\ncodex_hooks = false # prompt-language managed: codex_hooks\n';

    const result = enableManagedCodexHooks(raw);

    expect(result.outcome).toBe('updated');
    expect(result.raw).toBe(
      '[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\n',
    );
    expect(result.snapshot).toEqual({
      ownership: 'managed',
      enabled: true,
    });
  });

  it('leaves a user-owned codex_hooks entry unchanged', () => {
    const raw = '[features]\ncodex_hooks = true\n';

    expect(enableManagedCodexHooks(raw)).toMatchObject({
      outcome: 'user-owned',
      raw,
      snapshot: {
        ownership: 'user-owned',
        enabled: true,
      },
    });
  });

  it('does not remove a user-owned codex_hooks entry on disable', () => {
    const raw = '[features]\ncodex_hooks = true\nother_flag = true\n';

    expect(disableManagedCodexHooks(raw)).toMatchObject({
      outcome: 'not-managed',
      raw,
      snapshot: {
        ownership: 'user-owned',
        enabled: true,
      },
    });
  });

  it('reports conflicts when multiple codex_hooks entries exist', () => {
    const raw =
      '[features]\ncodex_hooks = true\ncodex_hooks = true # prompt-language managed: codex_hooks\n';

    expect(inspectCodexHooksConfig(raw)).toEqual({
      ownership: 'conflict',
      enabled: true,
    });
    expect(enableManagedCodexHooks(raw).outcome).toBe('conflict');
    expect(disableManagedCodexHooks(raw).outcome).toBe('conflict');
  });

  it('treats codex_hooks outside the features section as a conflict', () => {
    const raw = '[runner]\ncodex_hooks = true\n';

    expect(inspectCodexHooksConfig(raw)).toEqual({
      ownership: 'conflict',
      enabled: true,
    });
    expect(enableManagedCodexHooks(raw).outcome).toBe('conflict');
  });

  it('removes only the managed codex_hooks entry on disable', () => {
    const raw =
      '[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\nother_flag = true\n';

    const result = disableManagedCodexHooks(raw);

    expect(result.outcome).toBe('removed');
    expect(result.raw).toBe('[features]\nother_flag = true\n');
    expect(result.snapshot).toEqual({
      ownership: 'absent',
      enabled: false,
    });
  });

  it('removes an owned scaffold entirely on disable', () => {
    const result = disableManagedCodexHooks(createManagedCodexHooksConfig());

    expect(result.outcome).toBe('removed');
    expect(result.raw).toBe('');
    expect(result.snapshot).toEqual({
      ownership: 'absent',
      enabled: false,
    });
  });

  it('cleans up an appended managed section during uninstall', () => {
    const raw =
      '# existing config\n[runner]\nmodel = "gpt-5"\n\n# prompt-language managed section: codex_hooks\n[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\n';

    const result = disableManagedCodexHooks(raw);

    expect(result.outcome).toBe('removed');
    expect(result.raw).toBe('# existing config\n[runner]\nmodel = "gpt-5"\n');
    expect(result.snapshot).toEqual({
      ownership: 'absent',
      enabled: false,
    });
  });

  it('drops stale scaffold markers while preserving user settings in the features section', () => {
    const raw =
      '# prompt-language Codex scaffold.\n# Codex hooks are experimental; opt in explicitly before using the local install.\n\n# prompt-language managed section: codex_hooks\n[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\nother_flag = true\n';

    const result = disableManagedCodexHooks(raw);

    expect(result.outcome).toBe('removed');
    expect(result.raw).toBe('[features]\nother_flag = true\n');
    expect(result.snapshot).toEqual({
      ownership: 'absent',
      enabled: false,
    });
  });
});
