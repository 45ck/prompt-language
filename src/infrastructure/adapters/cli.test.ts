import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

function createClaudeCliEnv(homeDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
  };
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

  it('artifacts list reports the checked-in sample package', () => {
    const output = execFileSync('node', [CLI, 'artifacts', 'list'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(output).toContain('sample-implementation-plan-v1');
    expect(output).toContain('implementation_plan');
  });

  it('artifacts show can resolve a package by artifact id and inline a registered view', () => {
    const output = execFileSync(
      'node',
      [CLI, 'artifacts', 'show', 'sample-implementation-plan-v1', '--view', 'markdown'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    );

    expect(output).toContain('Type: implementation_plan v1');
    expect(output).toContain('View: markdown');
    expect(output).toContain('# Phase 1 Artifact Package Slice');
  });

  it('artifacts validate --json succeeds for the shipped sample package', () => {
    const output = execFileSync(
      'node',
      [CLI, 'artifacts', 'validate', 'sample-implementation-plan-v1', '--json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      ok: true,
      artifactId: 'sample-implementation-plan-v1',
      artifactType: 'implementation_plan',
      issues: [],
    });
  });

  it('artifacts validate exits 2 when a registered file checksum is broken', async () => {
    tempDir = await createTempDir('pl-cli-artifacts-validate-');
    const copiedPackage = join(tempDir, 'artifacts', 'sample-copy');
    await cp(join(ROOT, 'artifacts', 'samples', 'implementation-plan-v1'), copiedPackage, {
      recursive: true,
    });
    await writeFile(join(copiedPackage, 'views', 'artifact.md'), '# corrupted\n', 'utf8');

    try {
      execFileSync('node', [CLI, 'artifacts', 'validate', copiedPackage, '--json'], {
        cwd: tempDir,
        encoding: 'utf8',
      });
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(2);
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'ART-003',
            path: 'views/artifact.md',
          }),
        ]),
      });
    }
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

  it('validate makes lowered swarm execution inspectable in the text preview', async () => {
    tempDir = await createTempDir('pl-cli-validate-swarm-');
    const flowPath = join(tempDir, 'swarm.flow');
    await writeFile(
      flowPath,
      [
        'Goal: swarm test',
        '',
        'flow:',
        '  swarm checkout_fix',
        '    role frontend model "sonnet"',
        '      prompt: Fix the UI regression.',
        '      return ${summary}',
        '    end',
        '    flow:',
        '      start frontend',
        '      await all',
        '    end',
        '  end',
      ].join('\n'),
      'utf8',
    );

    const output = execFileSync('node', [CLI, 'validate', '--file', flowPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    expect(output).toContain('Lowered swarm flow:');
    expect(output).toContain('spawn "frontend" model "sonnet"');
    expect(output).toContain('Rendered runtime flow:');
    expect(output).toContain('spawn "frontend"');
    expect(output).toContain('receive __checkout_fix_frontend_returned from "frontend" timeout 30');
  });

  it('render-workflow prints the lowered clarify flow', async () => {
    tempDir = await createTempDir('pl-cli-render-workflow-');

    const output = execFileSync('node', [CLI, 'render-workflow', 'clarify'], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    expect(output).toContain(
      'Goal: clarify the request, record boundaries, and produce an inspectable plan draft',
    );
    expect(output).toContain('prompt: Clarify the task without editing files or running commands.');
    expect(output).not.toContain('run:');
  });

  it('render-workflow exits 1 for an unknown alias', async () => {
    tempDir = await createTempDir('pl-cli-render-workflow-bad-');

    try {
      execFileSync('node', [CLI, 'render-workflow', 'parallelize'], {
        cwd: tempDir,
        encoding: 'utf8',
      });
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      expect(failure.status).toBe(1);
      expect(failure.stderr ?? '').toContain('Unknown workflow alias "parallelize"');
    }
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

  it('validate --check-gates --json succeeds when all gate commands pass', async () => {
    tempDir = await createTempDir('pl-cli-validate-gates-pass-');
    const flowPath = join(tempDir, 'sample.flow');
    await writeFile(
      flowPath,
      [
        'Goal: gate pass',
        '',
        'flow:',
        '  prompt: hello',
        '',
        'done when:',
        `  gate smoke_ok: node -e "process.stdout.write('ok')"`,
      ].join('\n'),
      'utf8',
    );

    const output = execFileSync(
      process.execPath,
      [CLI, 'validate', '--check-gates', '--json', '--file', flowPath],
      {
        cwd: tempDir,
        encoding: 'utf8',
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      status: 'ok',
      gateChecks: [
        expect.objectContaining({
          predicate: 'smoke_ok',
          passed: true,
          exitCode: 0,
          stdout: 'ok',
        }),
      ],
    });
  });

  it('validate --check-gates --json exits 1 when a gate command fails', async () => {
    tempDir = await createTempDir('pl-cli-validate-gates-fail-');
    const flowPath = join(tempDir, 'sample.flow');
    await writeFile(
      flowPath,
      [
        'Goal: gate fail',
        '',
        'flow:',
        '  prompt: hello',
        '',
        'done when:',
        `  gate smoke_ok: node -e "process.stderr.write('bad'); process.exit(1)"`,
      ].join('\n'),
      'utf8',
    );

    try {
      execFileSync(
        process.execPath,
        [CLI, 'validate', '--check-gates', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
        },
      );
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(1);
      expect(JSON.parse(failure.stdout ?? '{}')).toMatchObject({
        status: 'unsuccessful',
        gateChecks: [
          expect.objectContaining({
            predicate: 'smoke_ok',
            passed: false,
            exitCode: 1,
            stderr: 'bad',
          }),
        ],
      });
    }
  });

  it('validate --check-gates --json exits 2 when gate prerequisites are missing', async () => {
    tempDir = await createTempDir('pl-cli-validate-gates-blocked-');
    const flowPath = join(tempDir, 'sample.flow');
    await writeFile(
      flowPath,
      'Goal: blocked\n\nflow:\n  prompt: hello\n\ndone when:\n  lint_pass\n',
      'utf8',
    );

    try {
      execFileSync(
        process.execPath,
        [CLI, 'validate', '--check-gates', '--json', '--file', flowPath],
        {
          cwd: tempDir,
          encoding: 'utf8',
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
    expect(source).toContain('Supported runners: claude, codex, opencode, ollama, aider.');
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

  it('status reports a healthy Claude install after install', async () => {
    tempDir = await createTempDir('pl-cli-status-install-');
    const env = createClaudeCliEnv(tempDir);

    execFileSync(process.execPath, [CLI, 'install'], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
    });

    const output = execFileSync(process.execPath, [CLI, 'status'], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
    });

    expect(output).toContain('  Installed:    yes');
    expect(output).toContain('  Registered:   yes');
    expect(output).not.toContain('  Issue:');
    expect(output).not.toContain('Remediation:');
  });

  it('status diagnoses stale installed_plugins metadata for Claude installs', async () => {
    tempDir = await createTempDir('pl-cli-status-stale-');
    const env = createClaudeCliEnv(tempDir);
    const pluginVersion = JSON.parse(
      await readFile(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ).version as string;
    const staleDir = join(
      tempDir,
      '.claude',
      'plugins',
      'cache',
      'prompt-language-local',
      'prompt-language',
      '0.0.1',
    );
    const expectedDir = join(
      tempDir,
      '.claude',
      'plugins',
      'cache',
      'prompt-language-local',
      'prompt-language',
      pluginVersion,
    );

    await mkdir(join(tempDir, '.claude', 'plugins'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify(
        {
          version: 2,
          plugins: {
            'prompt-language@prompt-language-local': [
              {
                scope: 'user',
                installPath: staleDir,
                version: '0.0.1',
              },
            ],
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(
        {
          enabledPlugins: {
            'prompt-language@prompt-language-local': true,
          },
          extraKnownMarketplaces: {
            'prompt-language-local': {
              source: {
                source: 'directory',
                path: join(tempDir, '.claude', 'plugins', 'cache', 'prompt-language-local'),
              },
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const output = execFileSync(process.execPath, [CLI, 'status'], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
    });

    expect(output).toContain(
      `installed_plugins.json points to ${staleDir}, but this build expects ${expectedDir}.`,
    );
    expect(output).toContain('installed_plugins.json records version 0.0.1');
    expect(output).toContain(
      `installed_plugins.json points to ${staleDir}, but that directory is missing.`,
    );
    expect(output).toContain('Remediation:');
    expect(output).toContain(
      'Run "npx @45ck/prompt-language install" to refresh the Claude install.',
    );
    expect(output).not.toContain('Stale:');
  });

  it('install fails with actionable diagnostics when Claude settings.json is invalid', async () => {
    tempDir = await createTempDir('pl-cli-install-invalid-settings-');
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'settings.json'), '{ invalid json', 'utf8');

    try {
      execFileSync(process.execPath, [CLI, 'install'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: tempDir,
          USERPROFILE: tempDir,
        },
      });
      expect.unreachable();
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      expect(failure.status).toBe(1);
      expect(failure.stderr ?? '').toContain('settings.json');
      expect(failure.stderr ?? '').toContain('contains invalid JSON');
      expect(failure.stderr ?? '').toContain('npx @45ck/prompt-language status');
    }
  });
});
