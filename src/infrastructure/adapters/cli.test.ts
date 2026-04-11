import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function createFakeRunner(
  directory: string,
  name: string,
  sentinelPath: string,
): Promise<void> {
  if (process.platform === 'win32') {
    await writeFile(
      join(directory, `${name}.cmd`),
      `@echo off\r\necho ran>"${sentinelPath}"\r\nexit /b 0\r\n`,
      'utf8',
    );
    return;
  }

  await writeFile(join(directory, name), `#!/bin/sh\nprintf 'ran' > '${sentinelPath}'\n`, {
    encoding: 'utf8',
    mode: 0o755,
  });
}

async function createFakeHeadlessRunner(
  directory: string,
  name: string,
  options: {
    readonly outputText?: string | undefined;
    readonly writes?: readonly { readonly path: string; readonly content: string }[] | undefined;
    readonly exitCode?: number | undefined;
  } = {},
): Promise<void> {
  const scriptPath = join(directory, `${name}.js`);
  const runnerCode = `const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output-last-message');
const cwdIdx = args.indexOf('-C');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
const cwd = cwdIdx >= 0 ? args[cwdIdx + 1] : process.cwd();
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, ${JSON.stringify(options.outputText ?? 'done')}, 'utf8');
}
for (const entry of ${JSON.stringify(options.writes ?? [])}) {
  const target = path.join(cwd, entry.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, entry.content, 'utf8');
}
process.exit(${options.exitCode ?? 0});
`;
  await writeFile(scriptPath, runnerCode, 'utf8');

  if (process.platform === 'win32') {
    await writeFile(
      join(directory, `${name}.cmd`),
      `@echo off\r\n"${process.execPath}" "%~dp0\\${name}.js" %*\r\n`,
      'utf8',
    );
    return;
  }

  await writeFile(join(directory, name), `#!/bin/sh\nexec "${process.execPath}" "$0.js" "$@"\n`, {
    encoding: 'utf8',
    mode: 0o755,
  });
}

describe('CLI commands', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('list finds .flow files recursively and skips common build directories', async () => {
    tempDir = await createTempDir('pl-cli-list-');
    await mkdir(join(tempDir, 'nested'), { recursive: true });
    await mkdir(join(tempDir, 'node_modules'), { recursive: true });
    await mkdir(join(tempDir, 'dist'), { recursive: true });

    await writeFile(join(tempDir, 'a.flow'), 'Goal: a\n', 'utf8');
    await writeFile(join(tempDir, 'nested', 'b.flow'), 'Goal: b\n', 'utf8');
    await writeFile(join(tempDir, 'node_modules', 'ignored.flow'), 'Goal: ignored\n', 'utf8');
    await writeFile(join(tempDir, 'dist', 'ignored.flow'), 'Goal: ignored\n', 'utf8');

    const output = execFileSync('node', [CLI, 'list'], {
      cwd: tempDir,
      encoding: 'utf8',
    }).trim();

    expect(
      output
        .split(/\r?\n/)
        .map((line) => line.replace(/\\/g, '/'))
        .sort(),
    ).toEqual(['a.flow', 'nested/b.flow']);
  });

  it('validate prints the preview output for a valid flow', async () => {
    tempDir = await createTempDir('pl-cli-validate-');
    const flowPath = join(tempDir, 'sample.flow');
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: hello\n', 'utf8');

    const output = execFileSync('node', [CLI, 'validate', '--file', flowPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    expect(output).toContain('[prompt-language validate] Flow parsed successfully.');
    expect(output).toContain('prompt: hello');
  });

  it('validate --runner --mode --json exits 2 for approve on a headless profile', async () => {
    tempDir = await createTempDir('pl-cli-validate-mode-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  approve "Ship it?"\n', 'utf8');
    await createFakeRunner(join(tempDir, 'bin'), 'opencode', join(tempDir, 'unused.txt'));

    try {
      execFileSync(
        process.execPath,
        [
          CLI,
          'validate',
          '--runner',
          'opencode',
          '--mode',
          'headless',
          '--json',
          '--file',
          flowPath,
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(2);
      const payload = JSON.parse(failure.stdout ?? '{}') as {
        status?: string;
        diagnostics?: { code?: string }[];
      };
      expect(payload.status).toBe('blocked');
      expect(payload.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'PLC-004',
          }),
        ]),
      );
    }
  });

  it('validate --runner --mode --json succeeds for approve on claude interactive', async () => {
    tempDir = await createTempDir('pl-cli-validate-interactive-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  approve "Ship it?"\n', 'utf8');
    await createFakeRunner(join(tempDir, 'bin'), 'claude', join(tempDir, 'unused.txt'));

    const output = execFileSync(
      process.execPath,
      [
        CLI,
        'validate',
        '--runner',
        'claude',
        '--mode',
        'interactive',
        '--json',
        '--file',
        flowPath,
      ],
      {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
        },
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      status: 'ok',
      diagnostics: [],
    });
  });

  it('validate rejects unsupported mode values before building diagnostics', async () => {
    tempDir = await createTempDir('pl-cli-validate-bad-mode-');
    const flowPath = join(tempDir, 'sample.flow');
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: hello\n', 'utf8');

    try {
      execFileSync(
        process.execPath,
        [CLI, 'validate', '--runner', 'codex', '--mode', 'watch', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      expect(failure.status).toBe(1);
      expect(failure.stderr ?? '').toContain('Unsupported mode "watch"');
    }
  });

  it('validate --runner --json exits 2 with a blocked preflight report when the runner is missing', async () => {
    tempDir = await createTempDir('pl-cli-validate-json-');
    const flowPath = join(tempDir, 'sample.flow');
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: hello\n', 'utf8');

    try {
      execFileSync(
        process.execPath,
        [CLI, 'validate', '--runner', 'codex', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: dirname(process.execPath),
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(2);
      const payload = JSON.parse(failure.stdout ?? '{}') as {
        status?: string;
        diagnostics?: { code?: string }[];
      };
      expect(payload.status).toBe('blocked');
      expect(payload.diagnostics?.[0]?.code).toBe('PLC-001');
    }
  });

  it('validate blocks unsupported interactive profiles for headless runners', async () => {
    tempDir = await createTempDir('pl-cli-validate-mode-blocked-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: hello\n', 'utf8');
    await createFakeRunner(join(tempDir, 'bin'), 'codex', join(tempDir, 'unused.txt'));

    try {
      execFileSync(
        process.execPath,
        [
          CLI,
          'validate',
          '--runner',
          'codex',
          '--mode',
          'interactive',
          '--json',
          '--file',
          flowPath,
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(2);
      const payload = JSON.parse(failure.stdout ?? '{}') as {
        status?: string;
        diagnostics?: { code?: string }[];
      };
      expect(payload.status).toBe('blocked');
      expect(payload.diagnostics?.some((diagnostic) => diagnostic.code === 'PLC-003')).toBe(true);
    }
  });

  it('validate preserves supported headless semantics and returns warnings with exit 0', async () => {
    tempDir = await createTempDir('pl-cli-validate-mode-warn-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: hello\n', 'utf8');
    await createFakeRunner(join(tempDir, 'bin'), 'opencode', join(tempDir, 'unused.txt'));

    const output = execFileSync(
      process.execPath,
      [CLI, 'validate', '--runner', 'opencode', '--mode', 'headless', '--json', '--file', flowPath],
      {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
        },
      },
    );

    const payload = JSON.parse(output) as {
      status?: string;
      diagnostics?: { code?: string; blocksExecution?: boolean }[];
    };
    expect(payload.status).toBe('ok');
    expect(payload.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PLC-007',
          blocksExecution: false,
        }),
      ]),
    );
  });

  it('run blocks on preflight gate prerequisites before invoking the runner', async () => {
    tempDir = await createTempDir('pl-cli-run-preflight-');
    const sentinelPath = join(tempDir, 'codex-ran.txt');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { test: 'node test.js' } }),
      'utf8',
    );
    await createFakeRunner(join(tempDir, 'bin'), 'codex', sentinelPath);

    try {
      execFileSync(process.execPath, [CLI, 'run', '--runner', 'codex'], {
        cwd: tempDir,
        encoding: 'utf8',
        input: 'Goal: test\n\ndone when:\n  lint_pass\n',
        env: {
          ...process.env,
          PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}`,
        },
      });
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      expect(failure.status).toBe(2);
      expect(failure.stderr ?? '').toContain('PLC-005');
    }

    await expect(readFile(sentinelPath, 'utf8')).rejects.toThrow();
  });

  it('ci blocks on preflight gate prerequisites before invoking the runner', async () => {
    tempDir = await createTempDir('pl-cli-ci-preflight-');
    const sentinelPath = join(tempDir, 'codex-ran.txt');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { test: 'node test.js' } }),
      'utf8',
    );
    await createFakeRunner(join(tempDir, 'bin'), 'codex', sentinelPath);

    try {
      execFileSync(process.execPath, [CLI, 'ci', '--runner', 'codex'], {
        cwd: tempDir,
        encoding: 'utf8',
        input: 'Goal: test\n\ndone when:\n  lint_pass\n',
        env: {
          ...process.env,
          PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}`,
        },
      });
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      expect(failure.status).toBe(2);
      expect(failure.stderr ?? '').toContain('PLC-005');
    }

    await expect(readFile(sentinelPath, 'utf8')).rejects.toThrow();
  });

  it('run supports the native claude path and all headless runners', async () => {
    const source = await readFile(CLI, 'utf8');
    expect(source).toContain("case 'run':");
    expect(source).toContain("if (runner === 'codex')");
    expect(source).toContain("if (runner === 'opencode')");
    expect(source).toContain("if (runner === 'ollama')");
    expect(source).toContain("return runner === 'codex' ? 'gpt-5.2' : undefined;");
    expect(source).toContain("const claudeArgs = ['-p', '--dangerously-skip-permissions']");
    expect(source).toContain("readOptionValue(args, '--model')");
    expect(source).toContain('Supported runners: claude, codex, opencode, ollama.');
  });

  it('eval exposes the dataset runner with harness, baseline, and report output support', async () => {
    const source = await readFile(CLI, 'utf8');
    expect(source).toContain("case 'eval':");
    expect(source).toContain('async function evalDataset()');
    expect(source).toContain("readOptionValue(args, '--harness')");
    expect(source).toContain("readOptionValue(args, '--baseline-report')");
    expect(source).toContain("readOptionValue(args, '--baseline')");
    expect(source).toContain("readOptionValue(args, '--output')");
    expect(source).toContain("readOptionValue(args, '--out')");
    expect(source).toContain('buildDefaultEvalOutputPath');
    expect(source).toContain('runEvalDatasetFromFile');
    expect(source).toContain('readEvalReport');
  });

  it('validate source supports runner-aware JSON output', async () => {
    const source = await readFile(CLI, 'utf8');
    expect(source).toContain("hasOption(args, '--json')");
    expect(source).toContain('readValidateProfileOptions(args)');
    expect(source).toContain("readOptionValue(args, '--mode')");
    expect(source).toContain('JSON.stringify(');
    expect(source).toContain('process.exit(2)');
  });

  it('run --runner codex --json returns a completed execution report', async () => {
    tempDir = await createTempDir('pl-cli-run-json-success-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'cli-run-json-success',
        scripts: {
          test: 'node verify-done.js',
        },
      }),
      'utf8',
    );
    await writeFile(
      join(tempDir, 'verify-done.js'),
      "const fs = require('node:fs');\nprocess.exit(fs.existsSync('done.txt') ? 0 : 1);\n",
      'utf8',
    );
    await writeFile(
      flowPath,
      'Goal: test\n\nflow:\n  prompt: Create done.txt\n\ndone when:\n  tests_pass\n',
      'utf8',
    );
    await createFakeHeadlessRunner(join(tempDir, 'bin'), 'codex', {
      writes: [{ path: 'done.txt', content: 'ok' }],
    });

    const output = execFileSync(
      process.execPath,
      [CLI, 'run', '--runner', 'codex', '--json', '--file', flowPath],
      {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
        },
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      status: 'ok',
      outcomes: [expect.objectContaining({ code: 'PLO-005' })],
    });
  });

  it('run --runner codex --json exits 1 for unsuccessful terminal outcomes', async () => {
    tempDir = await createTempDir('pl-cli-run-json-unsuccessful-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(
      flowPath,
      'Goal: test\n\nflow:\n  prompt: Create notes.txt\n\ndone when:\n  file_exists done.txt\n',
      'utf8',
    );
    await createFakeHeadlessRunner(join(tempDir, 'bin'), 'codex', {
      writes: [{ path: 'notes.txt', content: 'partial' }],
      outputText: 'Made a partial change but the required file was not created.',
    });

    try {
      execFileSync(
        process.execPath,
        [CLI, 'run', '--runner', 'codex', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(1);
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        status: 'unsuccessful',
        outcomes: [expect.objectContaining({ code: 'PLO-001' })],
      });
    }
  });

  it('run --runner claude --json returns a blocked profile report', async () => {
    tempDir = await createTempDir('pl-cli-run-json-claude-blocked-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: Create done.txt\n', 'utf8');
    await createFakeRunner(join(tempDir, 'bin'), 'claude', join(tempDir, 'claude-ran.txt'));

    try {
      execFileSync(
        process.execPath,
        [CLI, 'run', '--runner', 'claude', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(2);
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        status: 'blocked',
        diagnostics: [expect.objectContaining({ code: 'PLC-007' })],
      });
    }
  });

  it('ci --runner codex --json exits 3 for failed headless execution', async () => {
    tempDir = await createTempDir('pl-cli-ci-json-failed-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\nflow:\n  prompt: Create done.txt\n', 'utf8');
    await createFakeHeadlessRunner(join(tempDir, 'bin'), 'codex', {
      exitCode: 42,
      outputText: 'runner crashed',
    });

    try {
      execFileSync(
        process.execPath,
        [CLI, 'ci', '--runner', 'codex', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      const expectedExitCode = process.platform === 'win32' ? 1 : 42;
      expect(failure.status).toBe(3);
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        status: 'failed',
        reason: expect.stringContaining(`Prompt runner exited with code ${expectedExitCode}`),
      });
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        reason: expect.stringContaining('runner crashed'),
      });
    }
  });

  it('run blocks preflight in JSON mode before headless execution starts', async () => {
    tempDir = await createTempDir('pl-cli-run-json-blocked-');
    const flowPath = join(tempDir, 'sample.flow');
    await mkdir(join(tempDir, 'bin'), { recursive: true });
    await writeFile(flowPath, 'Goal: test\n\ndone when:\n  lint_pass\n', 'utf8');
    await createFakeHeadlessRunner(join(tempDir, 'bin'), 'codex');

    try {
      execFileSync(
        process.execPath,
        [CLI, 'run', '--runner', 'codex', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(tempDir, 'bin')}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`,
          },
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(2);
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        status: 'blocked',
        diagnostics: [expect.objectContaining({ code: 'PLC-005' })],
      });
    }
  });
});
