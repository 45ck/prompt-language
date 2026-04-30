#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const EXCLUDED_DIRS = new Set([
  '.git',
  '.prompt-language',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
]);
const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.html',
  '.css',
  '.mjs',
  '.cjs',
]);
const ENTITY_TERMS = {
  customers: ['customer', 'customers', 'customerId'],
  assets: ['asset', 'assets', 'assetId'],
  workOrders: ['workOrder', 'workOrders', 'work order', 'work orders', 'work_order'],
};
const CRUD_TERMS = ['list', 'create', 'edit', 'detail', 'delete'];
const RULE_TERMS = [
  'customerId',
  'assetId',
  'completedAt',
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'urgent',
];

function parseArgs(argv) {
  const options = { workspace: process.cwd(), json: false, runTests: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--no-run-tests') {
      options.runTests = false;
      continue;
    }
    if (arg === '--workspace') {
      const value = argv[index + 1];
      index += 1;
      if (value == null || value.trim() === '') {
        throw new Error('--workspace requires a path');
      }
      options.workspace = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { ...options, workspace: resolve(options.workspace) };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function extensionOf(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

function listTextFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const path = join(dir, entry.name);
      if (TEXT_EXTENSIONS.has(extensionOf(entry.name))) {
        files.push(path);
      }
    }
  }
  if (existsSync(root)) walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function readCorpus(files) {
  return files
    .map((file) => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n')
    .toLowerCase();
}

function checkFileExists(root, relativePath) {
  return existsSync(join(root, relativePath));
}

function hasAny(corpus, terms) {
  return terms.some((term) => corpus.includes(term.toLowerCase()));
}

function countEntityCoverage(corpus) {
  return Object.fromEntries(
    Object.entries(ENTITY_TERMS).map(([entity, terms]) => [entity, hasAny(corpus, terms)]),
  );
}

function countCrudCoverage(corpus) {
  return Object.fromEntries(CRUD_TERMS.map((term) => [term, corpus.includes(term)]));
}

function runNpmTest(workspace, enabled) {
  if (!enabled) {
    return { skipped: true, exitCode: null, stdout: '', stderr: '', durationMs: 0 };
  }

  const started = Date.now();
  const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', npmTestArgs(), {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });

  return {
    skipped: false,
    exitCode: result.status ?? (result.signal ? 124 : 1),
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? String(result.error ?? ''),
    durationMs: Date.now() - started,
  };
}

function npmTestArgs() {
  if (process.platform === 'win32') {
    return ['/d', '/s', '/c', 'npm test'];
  }
  return ['test'];
}

function scoreWorkspace(workspace, packageJson, corpus, testResult) {
  const entityCoverage = countEntityCoverage(corpus);
  const crudCoverage = countCrudCoverage(corpus);
  const ruleCoverage = Object.fromEntries(
    RULE_TERMS.map((term) => [term, corpus.includes(term.toLowerCase())]),
  );
  const checks = {
    packageJson: packageJson !== null,
    readme: checkFileExists(workspace, 'README.md'),
    runManifest: checkFileExists(workspace, 'run-manifest.json'),
    verificationReport: checkFileExists(workspace, 'verification-report.md'),
    testScript: typeof packageJson?.scripts?.test === 'string',
    runScript:
      typeof packageJson?.scripts?.dev === 'string' ||
      typeof packageJson?.scripts?.start === 'string',
    allEntities: Object.values(entityCoverage).every(Boolean),
    allCrudTerms: Object.values(crudCoverage).every(Boolean),
    relationshipRules: ['customerId', 'assetId', 'completedAt'].every((term) =>
      corpus.includes(term.toLowerCase()),
    ),
    statusRules: ['open', 'scheduled', 'in_progress', 'completed', 'cancelled'].every((term) =>
      corpus.includes(term),
    ),
    priorityRules: ['low', 'normal', 'urgent'].every((term) => corpus.includes(term)),
    seedData: corpus.includes('seed'),
    testsPresent: corpus.includes('test') || corpus.includes('describe(') || corpus.includes('it('),
    npmTestPassed: testResult.skipped ? null : testResult.exitCode === 0,
  };

  const score = [
    checks.packageJson ? 10 : 0,
    checks.readme ? 8 : 0,
    checks.runManifest ? 6 : 0,
    checks.verificationReport ? 6 : 0,
    checks.testScript ? 8 : 0,
    checks.runScript ? 5 : 0,
    checks.allEntities ? 15 : 0,
    checks.allCrudTerms ? 10 : 0,
    checks.relationshipRules ? 10 : 0,
    checks.statusRules ? 6 : 0,
    checks.priorityRules ? 4 : 0,
    checks.seedData ? 4 : 0,
    checks.testsPresent ? 4 : 0,
    checks.npmTestPassed === true ? 4 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return { score, checks, entityCoverage, crudCoverage, ruleCoverage };
}

function hardFailures(workspace, scoreResult) {
  const failures = [];
  if (!existsSync(workspace) || !statSync(workspace).isDirectory()) {
    failures.push('workspace_missing');
  }
  if (!scoreResult.checks.packageJson) failures.push('package_json_missing_or_invalid');
  if (!scoreResult.checks.allEntities) failures.push('required_entity_family_missing');
  if (!scoreResult.checks.testScript) failures.push('test_script_missing');
  if (scoreResult.checks.npmTestPassed === false) failures.push('npm_test_failed');
  return failures;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageJson = readJson(join(options.workspace, 'package.json'));
  const files = listTextFiles(options.workspace);
  const corpus = readCorpus(files);
  const testResult = runNpmTest(options.workspace, options.runTests);
  const scoreResult = scoreWorkspace(options.workspace, packageJson, corpus, testResult);
  const failures = hardFailures(options.workspace, scoreResult);
  const passed = failures.length === 0 && scoreResult.score >= 80;
  const report = {
    verifier: 'fullstack-crud-workspace',
    workspace: options.workspace,
    fileCount: files.length,
    files: files.map((file) => relative(options.workspace, file).replaceAll('\\', '/')),
    passed,
    hardFailures: failures,
    score: scoreResult.score,
    maxScore: 100,
    ...scoreResult,
    npmTest: testResult,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `FSCRUD verifier: ${passed ? 'PASS' : 'FAIL'}`,
        `score: ${scoreResult.score}/100`,
        `hard failures: ${failures.length === 0 ? 'none' : failures.join(', ')}`,
      ].join('\n') + '\n',
    );
  }

  process.exitCode = passed ? 0 : 1;
}

main();
