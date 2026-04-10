import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CLI_PATH = join(ROOT, 'bin', 'cli.mjs');

async function withTempProject(
  setup: (projectDir: string) => Promise<void>,
  assertFlow: (flow: string) => void,
): Promise<void> {
  const projectDir = await mkdtemp(join(tmpdir(), 'pl-init-'));
  try {
    await setup(projectDir);
    execSync(`node "${CLI_PATH}" init`, { cwd: projectDir, stdio: 'pipe' });
    const flow = await readFile(join(projectDir, 'example.flow'), 'utf8');
    assertFlow(flow);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

describe('cli init project detection', () => {
  it('scaffolds npm test/lint/build flow when package.json scripts exist', async () => {
    await withTempProject(
      async (projectDir) => {
        await writeFile(
          join(projectDir, 'package.json'),
          JSON.stringify(
            {
              name: 'tmp-js',
              version: '1.0.0',
              scripts: {
                build: 'tsc -p tsconfig.json',
                test: 'vitest run',
                lint: 'eslint .',
              },
            },
            null,
            2,
          ),
          'utf8',
        );
      },
      (flow) => {
        expect(flow).toContain('run: npm run build');
        expect(flow).toContain('run: npm test');
        expect(flow).toContain('run: npm run lint');
        expect(flow).toContain('done when:');
        expect(flow).toContain('tests_pass');
        expect(flow).toContain('lint_pass');
      },
    );
  });

  it('scaffolds pytest flow for Python projects', async () => {
    await withTempProject(
      async (projectDir) => {
        await writeFile(join(projectDir, 'pyproject.toml'), '[project]\nname = "tmp-py"\n', 'utf8');
      },
      (flow) => {
        expect(flow).toContain('run: python -m pytest');
        expect(flow).toContain('pytest_pass');
      },
    );
  });

  it('scaffolds go test flow for Go projects', async () => {
    await withTempProject(
      async (projectDir) => {
        await writeFile(join(projectDir, 'go.mod'), 'module example.com/tmp\n', 'utf8');
      },
      (flow) => {
        expect(flow).toContain('run: go test ./...');
        expect(flow).toContain('go_test_pass');
      },
    );
  });

  it('scaffolds cargo test flow for Rust projects', async () => {
    await withTempProject(
      async (projectDir) => {
        await writeFile(
          join(projectDir, 'Cargo.toml'),
          '[package]\nname = "tmp-rs"\nversion = "0.1.0"\n',
          'utf8',
        );
      },
      (flow) => {
        expect(flow).toContain('run: cargo test');
        expect(flow).toContain('cargo_test_pass');
      },
    );
  });
});
