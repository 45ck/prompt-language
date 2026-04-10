import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface WorkspaceAccess {
  exists(path: string): boolean;
  readText(path: string): string;
}

export interface GatePrerequisiteIssue {
  readonly predicate: string;
  readonly summary: string;
  readonly action?: string | undefined;
}

const defaultWorkspaceAccess: WorkspaceAccess = {
  exists: existsSync,
  readText: (path) => readFileSync(path, 'utf8'),
};

function readPackageScripts(
  cwd: string,
  access: WorkspaceAccess,
): Readonly<Record<string, string>> | null | undefined {
  const packagePath = join(cwd, 'package.json');
  if (!access.exists(packagePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(access.readText(packagePath)) as { scripts?: unknown };
    if (!parsed || typeof parsed !== 'object' || parsed.scripts == null) {
      return {};
    }
    if (typeof parsed.scripts !== 'object' || Array.isArray(parsed.scripts)) {
      return {};
    }

    const scripts: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed.scripts)) {
      if (typeof value === 'string') {
        scripts[name] = value;
      }
    }
    return scripts;
  } catch {
    return undefined;
  }
}

function hasWorkspaceFile(cwd: string, access: WorkspaceAccess, relativePath: string): boolean {
  return access.exists(join(cwd, relativePath));
}

function normalizePredicate(predicate: string): string {
  return predicate.startsWith('not ') ? predicate.slice(4).trim() : predicate;
}

export function detectWorkspaceTestCommand(
  cwd = process.cwd(),
  access: WorkspaceAccess = defaultWorkspaceAccess,
): string | undefined {
  if (hasWorkspaceFile(cwd, access, 'go.mod')) return 'go test ./...';
  if (
    hasWorkspaceFile(cwd, access, 'pyproject.toml') ||
    hasWorkspaceFile(cwd, access, 'setup.py')
  ) {
    return 'python -m pytest';
  }
  if (hasWorkspaceFile(cwd, access, 'Cargo.toml')) return 'cargo test';

  const scripts = readPackageScripts(cwd, access);
  if (scripts === undefined) return undefined;
  if (scripts == null) return undefined;
  return typeof scripts['test'] === 'string' ? 'npm test' : undefined;
}

export function detectTestCommand(): string {
  return detectWorkspaceTestCommand() ?? 'npm test';
}

export function explainGatePrerequisite(
  predicate: string,
  cwd = process.cwd(),
  access: WorkspaceAccess = defaultWorkspaceAccess,
): GatePrerequisiteIssue | null {
  const normalized = normalizePredicate(predicate);

  if (normalized.startsWith('file_exists ')) {
    return null;
  }

  if (normalized === 'tests_pass' || normalized === 'tests_fail') {
    const testCommand = detectWorkspaceTestCommand(cwd, access);
    if (testCommand) return null;

    return {
      predicate,
      summary:
        'tests_pass requires a detectable test runner in the current workspace, but no supported project marker or package.json test script was found.',
      action:
        'Add package.json with a test script, or add pyproject.toml/setup.py, go.mod, or Cargo.toml before running this flow.',
    };
  }

  if (normalized === 'lint_pass' || normalized === 'lint_fail') {
    const scripts = readPackageScripts(cwd, access);
    if (scripts === undefined) {
      return {
        predicate,
        summary:
          'lint_pass requires a readable package.json with a lint script, but package.json could not be parsed.',
        action: 'Fix package.json parsing errors or remove lint_pass from done when:.',
      };
    }
    if (scripts == null || typeof scripts['lint'] !== 'string') {
      return {
        predicate,
        summary: 'lint_pass requires package.json with a lint script in the current workspace.',
        action:
          'Add a "lint" script to package.json or replace lint_pass with a custom gate command.',
      };
    }
    return null;
  }

  if (normalized === 'pytest_pass' || normalized === 'pytest_fail') {
    if (
      hasWorkspaceFile(cwd, access, 'pyproject.toml') ||
      hasWorkspaceFile(cwd, access, 'setup.py')
    ) {
      return null;
    }
    return {
      predicate,
      summary: `${normalized} requires pyproject.toml or setup.py in the current workspace.`,
      action: 'Add the Python project marker file or replace the gate with a custom command.',
    };
  }

  if (normalized === 'go_test_pass' || normalized === 'go_test_fail') {
    if (hasWorkspaceFile(cwd, access, 'go.mod')) {
      return null;
    }
    return {
      predicate,
      summary: `${normalized} requires go.mod in the current workspace.`,
      action: 'Add go.mod or replace the gate with a custom command.',
    };
  }

  if (normalized === 'cargo_test_pass' || normalized === 'cargo_test_fail') {
    if (hasWorkspaceFile(cwd, access, 'Cargo.toml')) {
      return null;
    }
    return {
      predicate,
      summary: `${normalized} requires Cargo.toml in the current workspace.`,
      action: 'Add Cargo.toml or replace the gate with a custom command.',
    };
  }

  if (normalized === 'diff_nonempty') {
    if (hasWorkspaceFile(cwd, access, '.git')) {
      return null;
    }
    return {
      predicate,
      summary: 'diff_nonempty requires a git worktree in the current workspace.',
      action:
        'Run the flow from inside a git repository or replace diff_nonempty with a custom gate.',
    };
  }

  return null;
}
