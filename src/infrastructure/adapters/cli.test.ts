import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
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

  it('run supports the claude, opencode, and ollama runners', async () => {
    const source = await readFile(CLI, 'utf8');
    expect(source).toContain("case 'run':");
    expect(source).toContain("if (runner === 'opencode' || runner === 'ollama')");
    expect(source).toContain("const claudeArgs = ['-p', '--dangerously-skip-permissions']");
    expect(source).toContain("readOptionValue(args, '--model')");
    expect(source).toContain('Supported runners: claude, opencode, ollama.');
  });
});
