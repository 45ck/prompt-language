import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectWorkspaceTestCommand, explainGatePrerequisite } from './gate-prerequisites.js';

describe('gate-prerequisites', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('blocks generic tests_pass when no supported project markers exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-empty-'));

    expect(detectWorkspaceTestCommand(tempDir)).toBeUndefined();
    expect(explainGatePrerequisite('tests_pass', tempDir)?.summary).toContain(
      'detectable test runner',
    );
  });

  it('detects npm test when package.json has a test script', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-npm-test-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { test: 'vitest run' } }),
      'utf8',
    );

    expect(detectWorkspaceTestCommand(tempDir)).toBe('npm test');
    expect(explainGatePrerequisite('tests_pass', tempDir)).toBeNull();
  });

  it('returns undefined when package.json cannot be parsed for test detection', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-bad-package-'));
    await writeFile(join(tempDir, 'package.json'), '{ not-json', 'utf8');

    expect(detectWorkspaceTestCommand(tempDir)).toBeUndefined();
  });

  it('blocks lint_pass when package.json lacks a lint script', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-lint-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { test: 'node test.js' } }),
      'utf8',
    );

    expect(explainGatePrerequisite('lint_pass', tempDir)?.summary).toContain(
      'requires package.json with a lint script',
    );
  });

  it('blocks lint_pass when package.json is unreadable or invalid JSON', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-lint-invalid-'));
    await writeFile(join(tempDir, 'package.json'), '{ not-json', 'utf8');

    expect(explainGatePrerequisite('lint_pass', tempDir)?.summary).toContain(
      'package.json could not be parsed',
    );
  });

  it('accepts lint_pass when a lint script is present', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-lint-ok-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { lint: 'eslint .' } }),
      'utf8',
    );

    expect(explainGatePrerequisite('lint_pass', tempDir)).toBeNull();
  });

  it('accepts polyglot test markers without forcing npm', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-polyglot-'));

    await writeFile(join(tempDir, 'pyproject.toml'), '[project]\nname = "demo"\n', 'utf8');
    expect(detectWorkspaceTestCommand(tempDir)).toBe('python -m pytest');

    await rm(join(tempDir, 'pyproject.toml'));
    await writeFile(join(tempDir, 'go.mod'), 'module example.com/demo\n', 'utf8');
    expect(detectWorkspaceTestCommand(tempDir)).toBe('go test ./...');

    await rm(join(tempDir, 'go.mod'));
    await writeFile(
      join(tempDir, 'Cargo.toml'),
      '[package]\nname = "demo"\nversion = "0.1.0"\n',
      'utf8',
    );
    expect(detectWorkspaceTestCommand(tempDir)).toBe('cargo test');
  });

  it('accepts explicit language-specific gate predicates when marker files exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-language-gates-'));

    await writeFile(join(tempDir, 'pyproject.toml'), '[project]\nname = "demo"\n', 'utf8');
    expect(explainGatePrerequisite('pytest_pass', tempDir)).toBeNull();
    await rm(join(tempDir, 'pyproject.toml'));

    await writeFile(join(tempDir, 'go.mod'), 'module example.com/demo\n', 'utf8');
    expect(explainGatePrerequisite('go_test_pass', tempDir)).toBeNull();
    await rm(join(tempDir, 'go.mod'));

    await writeFile(
      join(tempDir, 'Cargo.toml'),
      '[package]\nname = "demo"\nversion = "0.1.0"\n',
      'utf8',
    );
    expect(explainGatePrerequisite('cargo_test_pass', tempDir)).toBeNull();
  });

  it('does not treat file_exists as a preflight blocker', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-file-exists-'));
    await mkdir(join(tempDir, 'nested'), { recursive: true });

    expect(explainGatePrerequisite('file_exists nested/output.txt', tempDir)).toBeNull();
  });

  it('requires a git worktree for diff_nonempty', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-git-'));

    expect(explainGatePrerequisite('diff_nonempty', tempDir)?.summary).toContain(
      'requires a git worktree',
    );
  });

  it('accepts diff_nonempty when a git worktree marker exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-git-ok-'));
    await mkdir(join(tempDir, '.git'), { recursive: true });

    expect(explainGatePrerequisite('diff_nonempty', tempDir)).toBeNull();
  });

  it('normalizes inverted predicates before checking prerequisites', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-gate-prerequisite-not-tests-'));

    expect(explainGatePrerequisite('not tests_pass', tempDir)?.predicate).toBe('not tests_pass');
    expect(explainGatePrerequisite('not tests_pass', tempDir)?.summary).toContain(
      'detectable test runner',
    );
  });
});
