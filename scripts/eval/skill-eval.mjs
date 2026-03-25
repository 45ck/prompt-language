#!/usr/bin/env node
/**
 * skill-eval.mjs — Skill parse + execution eval tests via `claude -p`.
 *
 * Validates that skills (SKILL.md files with embedded flow DSL) parse correctly
 * and execute end-to-end through Claude's real agent loop.
 *
 * Tests:
 *   Section 1 — Parse-only (fast, always run):
 *     SA: fix-and-test parses           SB: deploy-check parses
 *     SC: tdd parses                    SD: refactor parses
 *     SE: All skills have frontmatter   SF: All flow blocks parse
 *
 *   Section 2 — Existing skill execution (slow, skip in --quick):
 *     SG: fix-and-test fixes a bug      SH: deploy-check runs pipeline
 *     SI: refactor keeps tests green    SJ: fix-and-test custom command
 *
 *   Section 3 — Experimental skill flows (SK-SN quick, SO slow):
 *     SK: Environment scan              SL: Foreach file generator
 *     SM: Pipeline chain                SN: Try/catch error recovery
 *     SO: List aggregation (slow)
 *
 * Usage:
 *   node scripts/eval/skill-eval.mjs          # all tests
 *   node scripts/eval/skill-eval.mjs --quick  # parse-only + no-LLM experimental
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const SKILLS_DIR = join(PROJECT_ROOT, 'skills');
const RESULTS_DIR = join(__dirname, 'results');

const QUICK_MODE = process.argv.includes('--quick');
const TIMEOUT = 180_000;

let passed = 0;
let failed = 0;

/** Structured results collected during the run. */
const results = [];
let currentTest = { name: '', label: '', startTime: 0 };

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }

  const testName = label.match(/^(S[A-Z]):/)?.[1] ?? label;
  const testLabel = label.replace(/^S[A-Z]:\s*/, '');
  const duration = Date.now() - currentTest.startTime;

  results.push({
    name: testName,
    label: testLabel,
    passed: condition,
    duration_ms: duration,
    error: condition ? null : detail || null,
  });
}

/** Wrap a test function to track timing. */
async function timed(name, label, fn) {
  currentTest = { name, label, startTime: Date.now() };
  await fn();
}

/** Write structured results to a JSON file. */
async function writeResults(totalStart) {
  await mkdir(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `skill-${timestamp}.json`;
  const filepath = join(RESULTS_DIR, filename);

  let nodeVersion = '';
  try {
    nodeVersion = execSync('node -v', { encoding: 'utf-8' }).trim();
  } catch {
    nodeVersion = process.version;
  }

  const report = {
    timestamp: new Date().toISOString(),
    os: platform(),
    nodeVersion,
    quickMode: QUICK_MODE,
    duration_ms: Date.now() - totalStart,
    passed,
    failed,
    tests: results,
  };

  await writeFile(filepath, JSON.stringify(report, null, 2));
  console.log(`\n[skill-eval] Results written to ${filepath}`);
}

/** Keep only the most recent 50 result files. */
async function cleanupOldResults() {
  try {
    const files = (await readdir(RESULTS_DIR))
      .filter((f) => f.startsWith('skill-') && f.endsWith('.json'))
      .sort();

    if (files.length > 50) {
      const toDelete = files.slice(0, files.length - 50);
      for (const f of toDelete) {
        await unlink(join(RESULTS_DIR, f));
      }
      console.log(`[skill-eval] Cleaned up ${toDelete.length} old result file(s).`);
    }
  } catch {
    /* results dir may not exist yet */
  }
}

function claudeRun(prompt, cwd) {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  try {
    return execSync('claude -p --dangerously-skip-permissions', {
      input: prompt,
      encoding: 'utf-8',
      cwd,
      timeout: TIMEOUT,
      env,
    });
  } catch (err) {
    if (err.stderr) console.error(`  [debug] stderr: ${err.stderr.slice(0, 200)}`);
    return err.stdout ?? '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupDir(dir, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      if (i < retries - 1) await sleep(1000);
    }
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pl-skill-'));
  try {
    await fn(dir);
  } finally {
    await cleanupDir(dir);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Read a SKILL.md file and extract the flow block from the fenced code block.
 * Returns the raw text including `flow:` and `done when:` sections.
 */
async function readSkillFlow(skillName) {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
  const content = await readFile(skillPath, 'utf-8');

  // Extract fenced code block that starts with flow: (skip example blocks)
  const blocks = [...content.matchAll(/```\n([\s\S]*?)```/g)];
  for (const m of blocks) {
    const text = m[1].trim();
    if (/^flow:/m.test(text)) return text;
  }
  return null;
}

/**
 * Read SKILL.md frontmatter fields (name, description).
 */
async function readSkillFrontmatter(skillName) {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
  const content = await readFile(skillPath, 'utf-8');

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

/**
 * Get list of all skill directories.
 */
async function listSkills() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/**
 * Check if a node tree contains a node of the given kind.
 */
function hasNodeKind(nodes, kind) {
  for (const node of nodes) {
    if (node.kind === kind) return true;
    // Check children based on node kind
    if (node.body && hasNodeKind(node.body, kind)) return true;
    if (node.thenBranch && hasNodeKind(node.thenBranch, kind)) return true;
    if (node.elseBranch && hasNodeKind(node.elseBranch, kind)) return true;
    if (node.catchBody && hasNodeKind(node.catchBody, kind)) return true;
    if (node.finallyBody && hasNodeKind(node.finallyBody, kind)) return true;
  }
  return false;
}

// ── Section 1: Parse-only tests (SA-SF) ─────────────────────────────

async function testFixAndTestParses() {
  const { parseFlow } = await import('../../dist/application/parse-flow.js');
  const flowText = await readSkillFlow('fix-and-test');

  assert(
    'SA: fix-and-test flow extracted',
    flowText !== null,
    flowText ? 'flow block found' : 'no flow block in SKILL.md',
  );

  if (!flowText) return;

  const spec = parseFlow(`Goal: test parse\n\n${flowText}`);
  const hasRetry = hasNodeKind(spec.nodes, 'retry');
  const hasRun = hasNodeKind(spec.nodes, 'run');
  const hasIf = hasNodeKind(spec.nodes, 'if');
  const hasTestsPass = spec.completionGates.some((g) => g.predicate === 'tests_pass');

  assert(
    'SA: fix-and-test parses correctly',
    hasRetry && hasRun && hasIf && hasTestsPass,
    `retry=${hasRetry}, run=${hasRun}, if=${hasIf}, tests_pass=${hasTestsPass}`,
  );
}

async function testDeployCheckParses() {
  const { parseFlow } = await import('../../dist/application/parse-flow.js');
  const flowText = await readSkillFlow('deploy-check');

  assert(
    'SB: deploy-check flow extracted',
    flowText !== null,
    flowText ? 'flow block found' : 'no flow block in SKILL.md',
  );

  if (!flowText) return;

  const spec = parseFlow(`Goal: test parse\n\n${flowText}`);
  const hasRetry = hasNodeKind(spec.nodes, 'retry');
  const hasRun = hasNodeKind(spec.nodes, 'run');
  const hasTestsPass = spec.completionGates.some((g) => g.predicate === 'tests_pass');
  const hasLintPass = spec.completionGates.some((g) => g.predicate === 'lint_pass');

  assert(
    'SB: deploy-check parses correctly',
    hasRetry && hasRun && hasTestsPass && hasLintPass,
    `retry=${hasRetry}, run=${hasRun}, tests_pass=${hasTestsPass}, lint_pass=${hasLintPass}`,
  );
}

async function testTddParses() {
  const { parseFlow } = await import('../../dist/application/parse-flow.js');
  const flowText = await readSkillFlow('tdd');

  assert(
    'SC: tdd flow extracted',
    flowText !== null,
    flowText ? 'flow block found' : 'no flow block in SKILL.md',
  );

  if (!flowText) return;

  const spec = parseFlow(`Goal: test parse\n\n${flowText}`);
  const hasRetry = hasNodeKind(spec.nodes, 'retry');
  const hasTestsPass = spec.completionGates.some((g) => g.predicate === 'tests_pass');

  assert(
    'SC: tdd parses correctly',
    hasRetry && hasTestsPass,
    `retry=${hasRetry}, tests_pass=${hasTestsPass}`,
  );
}

async function testRefactorParses() {
  const { parseFlow } = await import('../../dist/application/parse-flow.js');
  const flowText = await readSkillFlow('refactor');

  assert(
    'SD: refactor flow extracted',
    flowText !== null,
    flowText ? 'flow block found' : 'no flow block in SKILL.md',
  );

  if (!flowText) return;

  const spec = parseFlow(`Goal: test parse\n\n${flowText}`);
  const hasRetry = hasNodeKind(spec.nodes, 'retry');
  const hasRun = hasNodeKind(spec.nodes, 'run');
  const hasPrompt = hasNodeKind(spec.nodes, 'prompt');

  assert(
    'SD: refactor parses correctly',
    hasRetry && hasRun && hasPrompt,
    `retry=${hasRetry}, run=${hasRun}, prompt=${hasPrompt}`,
  );
}

async function testAllSkillsFrontmatter() {
  const skills = await listSkills();

  let allValid = true;
  const issues = [];

  for (const skill of skills) {
    const fm = await readSkillFrontmatter(skill);
    if (!fm) {
      allValid = false;
      issues.push(`${skill}: no frontmatter`);
    } else {
      if (!fm.name) {
        allValid = false;
        issues.push(`${skill}: missing name`);
      }
      if (!fm.description) {
        allValid = false;
        issues.push(`${skill}: missing description`);
      }
    }
  }

  assert(
    'SE: All skills have valid frontmatter',
    allValid,
    allValid ? `${skills.length} skills checked` : issues.join(', '),
  );
}

async function testAllFlowBlocksParse() {
  const { parseFlow } = await import('../../dist/application/parse-flow.js');
  const skills = await listSkills();

  let allParsed = true;
  let flowCount = 0;
  const issues = [];

  for (const skill of skills) {
    const flowText = await readSkillFlow(skill);
    if (!flowText) continue; // skill without flow: block is fine (e.g. flow-reset, flow-status)

    flowCount++;
    try {
      const spec = parseFlow(`Goal: test\n\n${flowText}`);
      if (spec.nodes.length === 0) {
        allParsed = false;
        issues.push(`${skill}: parsed but 0 nodes`);
      }
    } catch (err) {
      allParsed = false;
      issues.push(`${skill}: ${err.message.slice(0, 60)}`);
    }
  }

  assert(
    'SF: All flow blocks parse without errors',
    allParsed && flowCount > 0,
    allParsed ? `${flowCount} flow blocks parsed` : issues.join(', '),
  );
}

// ── Section 2: Existing skill execution (SG-SJ) ────────────────────

async function testFixAndTestExecution() {
  await withTempDir(async (dir) => {
    // Setup: buggy app with test
    await writeFile(join(dir, 'app.js'), 'module.exports.add = (a, b) => a - b;\n');
    await writeFile(
      join(dir, 'test.js'),
      [
        'const { add } = require("./app.js");',
        'const result = add(2, 3);',
        'if (result !== 5) {',
        '  console.error(`Expected 5, got ${result}`);',
        '  process.exit(1);',
        '}',
        'console.log("PASS");',
      ].join('\n'),
    );
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'sg-test', scripts: { test: 'node test.js' } }),
    );

    const flowText = await readSkillFlow('fix-and-test');
    const prompt = `Goal: fix the add function so tests pass\n\n${flowText}`;
    claudeRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'test.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'SG: fix-and-test fixes a bug',
      exitCode === 0,
      exitCode === 0 ? 'add(2,3) returns 5' : 'test still fails',
    );
  });
}

async function testDeployCheckExecution() {
  await withTempDir(async (dir) => {
    // Setup: code with lint issue + passing test + build script
    await writeFile(join(dir, 'app.js'), 'var x = 1;\nconsole.log(x);\n');
    await writeFile(
      join(dir, 'lint-check.js'),
      [
        'const fs = require("fs");',
        'const code = fs.readFileSync("app.js", "utf-8");',
        'if (code.includes("var ")) {',
        '  console.error("Lint error: use const/let instead of var");',
        '  process.exit(1);',
        '}',
        'console.log("Lint passed");',
      ].join('\n'),
    );
    await writeFile(join(dir, 'test.js'), 'console.log("Tests passed");\n');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'sh-test',
        scripts: {
          lint: 'node lint-check.js',
          test: 'node test.js',
          build: 'echo build-ok',
        },
      }),
    );

    const flowText = await readSkillFlow('deploy-check');
    const prompt = `Goal: fix lint issues so the full deploy pipeline passes\n\n${flowText}`;
    claudeRun(prompt, dir);

    let lintPasses = false;
    try {
      execSync(`node "${join(dir, 'lint-check.js')}"`, { cwd: dir, timeout: 5000 });
      lintPasses = true;
    } catch {
      /* still fails */
    }

    assert(
      'SH: deploy-check runs pipeline',
      lintPasses,
      lintPasses ? 'lint passes (var replaced)' : 'lint still fails',
    );
  });
}

async function testRefactorExecution() {
  await withTempDir(async (dir) => {
    // Setup: working but ugly code + tests
    await writeFile(
      join(dir, 'math.js'),
      [
        '// ugly but working',
        'function a(x,y){return x+y}',
        'function s(x,y){return x-y}',
        'module.exports={a:a,s:s};',
      ].join('\n'),
    );
    await writeFile(
      join(dir, 'test.js'),
      [
        'const m = require("./math.js");',
        'if (m.a(2,3) !== 5) { console.error("add failed"); process.exit(1); }',
        'if (m.s(5,3) !== 2) { console.error("sub failed"); process.exit(1); }',
        'console.log("PASS");',
      ].join('\n'),
    );
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'si-test', scripts: { test: 'node test.js', lint: 'echo lint-ok' } }),
    );

    const flowText = await readSkillFlow('refactor');
    const prompt = `Goal: refactor math.js — rename a to add, s to subtract, use descriptive names\n\n${flowText}`;
    claudeRun(prompt, dir);

    let testsPassing = false;
    try {
      execSync(`node "${join(dir, 'test.js')}"`, { timeout: 5000 });
      testsPassing = true;
    } catch {
      /* tests fail */
    }

    assert(
      'SI: refactor keeps tests green',
      testsPassing,
      testsPassing ? 'tests still pass after refactor' : 'tests broken after refactor',
    );
  });
}

async function testFixAndTestCustomCommand() {
  await withTempDir(async (dir) => {
    // Same as SG but with custom verify.js instead of npm test
    await writeFile(join(dir, 'app.js'), 'module.exports.multiply = (a, b) => a + b;\n');
    await writeFile(
      join(dir, 'verify.js'),
      [
        'const { multiply } = require("./app.js");',
        'const result = multiply(3, 4);',
        'if (result !== 12) {',
        '  console.error(`Expected 12, got ${result}`);',
        '  process.exit(1);',
        '}',
        'console.log("PASS");',
      ].join('\n'),
    );
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'sj-test', scripts: { test: 'node verify.js' } }),
    );

    // Use the fix-and-test flow but the test command is already wired via package.json
    const flowText = await readSkillFlow('fix-and-test');
    const prompt = `Goal: fix the multiply function so tests pass (run: node verify.js)\n\n${flowText}`;
    claudeRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'verify.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'SJ: fix-and-test with custom test command',
      exitCode === 0,
      exitCode === 0 ? 'multiply(3,4) returns 12' : 'verify.js still fails',
    );
  });
}

// ── Section 3: Experimental skill flows (SK-SO) ─────────────────────

async function testEnvScan() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: scan environment',
      '',
      'flow:',
      '  let node_ver = run "node -v"',
      '  let npm_ver = run "npm -v"',
      '  let plat = run "node -e \\"console.log(process.platform)\\""',
      '  run: echo "${node_ver}" > env-report.txt',
      '  run: echo "${npm_ver}" >> env-report.txt',
      '  run: echo "${plat}" >> env-report.txt',
    ].join('\n');

    claudeRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'env-report.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'SK: Environment scan',
      content.length > 0 && /v\d+/.test(content),
      content.length > 0 ? 'env-report.txt has version info' : 'env-report.txt empty or missing',
    );
  });
}

async function testForeachFileGenerator() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: generate module files',
      '',
      'flow:',
      '  foreach mod in "auth database api"',
      '    run: echo "// ${mod} module" > ${mod}.js',
      '  end',
    ].join('\n');

    claudeRun(prompt, dir);

    let found = 0;
    for (const mod of ['auth', 'database', 'api']) {
      try {
        const content = (await readFile(join(dir, `${mod}.js`), 'utf-8')).trim();
        if (content.includes(mod)) found++;
      } catch {
        /* file not created */
      }
    }

    assert(
      'SL: Foreach file generator',
      found >= 2,
      found >= 2 ? `${found}/3 module files created` : `only ${found}/3 files found`,
    );
  });
}

async function testPipelineChain() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test pipeline chain',
      '',
      'flow:',
      '  run: echo "step1-output" > step1.txt',
      '  let s1 = run "cat step1.txt"',
      '  if command_succeeded',
      '    run: echo "step2-${s1}" > step2.txt',
      '  end',
    ].join('\n');

    claudeRun(prompt, dir);

    let step1 = '';
    let step2 = '';
    try {
      step1 = (await readFile(join(dir, 'step1.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      step2 = (await readFile(join(dir, 'step2.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    const step1Ok = step1.includes('step1-output');
    const step2Ok = step2.includes('step2') && step2.includes('step1-output');

    assert(
      'SM: Pipeline chain',
      step1Ok && step2Ok,
      step1Ok && step2Ok
        ? 'both pipeline stages produced output'
        : `step1="${step1.slice(0, 40)}", step2="${step2.slice(0, 40)}"`,
    );
  });
}

async function testTryCatchRecovery() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test try/catch error recovery',
      '',
      'flow:',
      '  try',
      '    run: node -e "process.exit(1)"',
      '  catch command_failed',
      '    run: echo caught-error > recovery.txt',
      '  finally',
      '    run: echo cleanup-done > cleanup.txt',
      '  end',
    ].join('\n');

    claudeRun(prompt, dir);

    let recovery = '';
    let cleanup = '';
    try {
      recovery = (await readFile(join(dir, 'recovery.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      cleanup = (await readFile(join(dir, 'cleanup.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'SN: Try/catch error recovery',
      recovery.includes('caught-error') && cleanup.includes('cleanup-done'),
      recovery.includes('caught-error') && cleanup.includes('cleanup-done')
        ? 'recovery + cleanup both ran'
        : `recovery="${recovery}", cleanup="${cleanup}"`,
    );
  });
}

async function testListAggregation() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test list aggregation',
      '',
      'flow:',
      '  let results = []',
      '  foreach item in "alpha beta gamma"',
      '    let results += run "echo processed-${item}"',
      '  end',
      '  run: echo "${results_length}" > total.txt',
    ].join('\n');

    claudeRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'total.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'SO: List aggregation',
      content.includes('3'),
      content.includes('3') ? 'results_length = 3' : `got: "${content.slice(0, 40)}"`,
    );
  });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();
  console.log('[skill-eval] Starting skill eval tests...\n');

  // Section 1: Parse-only (always run, fast)
  console.log('── Section 1: Parse-only tests ──');
  await timed('SA', 'fix-and-test parses', testFixAndTestParses);
  await timed('SB', 'deploy-check parses', testDeployCheckParses);
  await timed('SC', 'tdd parses', testTddParses);
  await timed('SD', 'refactor parses', testRefactorParses);
  await timed('SE', 'All skills frontmatter', testAllSkillsFrontmatter);
  await timed('SF', 'All flow blocks parse', testAllFlowBlocksParse);

  // Section 3 quick tests: experimental flows that need claude -p but no LLM reasoning
  console.log('\n── Section 3: Experimental skill flows (quick) ──');

  // Check claude CLI is available before running execution tests
  let claudeAvailable = false;
  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
    claudeAvailable = true;
  } catch {
    console.log('  [skill-eval] claude CLI not found — skipping execution tests.');
  }

  if (claudeAvailable) {
    await timed('SK', 'Environment scan', testEnvScan);
    await timed('SL', 'Foreach file generator', testForeachFileGenerator);
    await timed('SM', 'Pipeline chain', testPipelineChain);
    await timed('SN', 'Try/catch recovery', testTryCatchRecovery);

    if (!QUICK_MODE) {
      await timed('SO', 'List aggregation', testListAggregation);

      // Section 2: Existing skill execution (slow)
      console.log('\n── Section 2: Existing skill execution ──');
      await timed('SG', 'fix-and-test execution', testFixAndTestExecution);
      await timed('SH', 'deploy-check execution', testDeployCheckExecution);
      await timed('SI', 'refactor execution', testRefactorExecution);
      await timed('SJ', 'fix-and-test custom cmd', testFixAndTestCustomCommand);
    } else {
      console.log('  SKIP  SO: List aggregation (--quick mode)');
      console.log('\n── Section 2: Existing skill execution (skipped in --quick) ──');
      console.log('  SKIP  SG: fix-and-test execution (--quick mode)');
      console.log('  SKIP  SH: deploy-check execution (--quick mode)');
      console.log('  SKIP  SI: refactor execution (--quick mode)');
      console.log('  SKIP  SJ: fix-and-test custom cmd (--quick mode)');
    }
  }

  console.log(`\n[skill-eval] Summary: ${passed}/${passed + failed} passed`);

  await writeResults(totalStart);
  await cleanupOldResults();

  if (failed > 0) {
    console.error('[skill-eval] FAIL — some tests did not pass.');
    process.exit(1);
  }

  console.log('[skill-eval] PASS — all tests passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[skill-eval] Fatal error:', err.message);
  process.exit(1);
});
