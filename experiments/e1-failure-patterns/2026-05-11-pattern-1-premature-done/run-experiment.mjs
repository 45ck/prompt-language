// E1 Pattern 1 experiment driver.
// k=5 reps per arm. Reset fixture before each rep.
//
// Baseline arm: one prompt to qwen3-coder, then test.
// PL-fix arm: prompt + test in a loop until tests pass or maxIter hit.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixture');
const RESULTS_DIR = join(HERE, 'results');
mkdirSync(RESULTS_DIR, { recursive: true });

const ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const MODEL = 'qwen3-coder:30b';
const REPS = Number(process.env.REPS || 5);
const MAX_PL_ITER = 5; // PL-fix arm gives up after this many iterations

const BROKEN_MATH = `// Deliberately-broken math module for E1 Pattern 1 experiment.
// Each function has a single-character/operator bug.

export function add(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a + b;
}

export function divide(a, b) {
  return a * b;
}
`;

const TASK_PROMPT = `Fix the math.mjs file in this directory so that all tests in math.test.mjs pass. The current math.mjs has bugs in add, multiply, and divide. Reply with ONLY the complete corrected math.mjs file contents, no fences, no commentary, no explanation. Start with "// math.mjs" or "export".`;

const PL_FIX_RETRY_PROMPT = (testStderr) => `Your previous fix did not pass all tests. Test runner output:

${testStderr.slice(0, 500)}

Reply with ONLY the complete corrected math.mjs file contents that fixes all failing tests. No fences, no commentary.`;

function resetFixture() {
  writeFileSync(join(FIXTURE_DIR, 'math.mjs'), BROKEN_MATH);
}

async function generate(prompt) {
  const t0 = performance.now();
  const res = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { num_predict: 1024, temperature: 0, seed: Date.now() % 1_000_000 },
    }),
  });
  const wallMs = performance.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { response: j.response, wallMs, evalTokens: j.eval_count || 0 };
}

function extractCode(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  const m = raw.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
  if (m) return m[1].trim();
  // Find the first export or comment line and take from there
  const idx = Math.max(0, s.indexOf('export '));
  return s.slice(idx).trim();
}

function runTests() {
  const r = spawnSync('node', ['--test', join(FIXTURE_DIR, 'math.test.mjs')], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  // Parse tests-passing count from output
  const passMatch = (r.stdout + '\n' + r.stderr).match(/# pass (\d+)/);
  const failMatch = (r.stdout + '\n' + r.stderr).match(/# fail (\d+)/);
  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failed = failMatch ? parseInt(failMatch[1], 10) : 3;
  return {
    exitCode: r.status,
    allPass: r.status === 0,
    passed,
    failed,
    stderr: (r.stderr || '').slice(-400),
    stdout: (r.stdout || '').slice(-400),
  };
}

async function baselineArm(rep) {
  resetFixture();
  const gen = await generate(TASK_PROMPT);
  const code = extractCode(gen.response);
  if (!code) {
    return { rep, arm: 'baseline', error: 'no code extracted', evalTokens: gen.evalTokens };
  }
  writeFileSync(join(FIXTURE_DIR, 'math.mjs'), code);
  const tests = runTests();
  return {
    rep,
    arm: 'baseline',
    iterations: 1,
    finalAllPass: tests.allPass,
    finalPassed: tests.passed,
    finalFailed: tests.failed,
    totalLocalTokens: gen.evalTokens,
    totalWallMs: Math.round(gen.wallMs),
  };
}

async function plFixArm(rep) {
  resetFixture();
  let totalTokens = 0;
  let totalWallMs = 0;
  let lastTests = null;
  let iter;
  for (iter = 1; iter <= MAX_PL_ITER; iter++) {
    const prompt = iter === 1 ? TASK_PROMPT : PL_FIX_RETRY_PROMPT(lastTests.stderr);
    const gen = await generate(prompt);
    totalTokens += gen.evalTokens;
    totalWallMs += gen.wallMs;
    const code = extractCode(gen.response);
    if (!code) continue;
    writeFileSync(join(FIXTURE_DIR, 'math.mjs'), code);
    lastTests = runTests();
    if (lastTests.allPass) break;
  }
  return {
    rep,
    arm: 'pl-fix',
    iterations: iter,
    finalAllPass: lastTests?.allPass || false,
    finalPassed: lastTests?.passed || 0,
    finalFailed: lastTests?.failed || 3,
    totalLocalTokens: totalTokens,
    totalWallMs: Math.round(totalWallMs),
  };
}

const manifest = { startedAt: new Date().toISOString(), model: MODEL, reps: REPS, runs: [] };

console.log(`=== E1 Pattern 1: Premature Done elimination (k=${REPS}) ===\n`);
console.log('--- Baseline arm ---');
for (let i = 1; i <= REPS; i++) {
  process.stdout.write(`rep ${i}: `);
  try {
    const r = await baselineArm(i);
    manifest.runs.push(r);
    console.log(`${r.finalAllPass ? 'ALL_PASS' : `PARTIAL ${r.finalPassed}/3`} | iter=${r.iterations} | ${r.totalLocalTokens} tok`);
  } catch (e) {
    manifest.runs.push({ rep: i, arm: 'baseline', error: e.message });
    console.log(`ERROR: ${e.message}`);
  }
}

console.log('\n--- PL-fix arm ---');
for (let i = 1; i <= REPS; i++) {
  process.stdout.write(`rep ${i}: `);
  try {
    const r = await plFixArm(i);
    manifest.runs.push(r);
    console.log(`${r.finalAllPass ? 'ALL_PASS' : `STUCK ${r.finalPassed}/3`} | iter=${r.iterations} | ${r.totalLocalTokens} tok`);
  } catch (e) {
    manifest.runs.push({ rep: i, arm: 'pl-fix', error: e.message });
    console.log(`ERROR: ${e.message}`);
  }
}

manifest.completedAt = new Date().toISOString();

// Summary
const baselineRuns = manifest.runs.filter((r) => r.arm === 'baseline' && !r.error);
const plRuns = manifest.runs.filter((r) => r.arm === 'pl-fix' && !r.error);
const baselineAllPass = baselineRuns.filter((r) => r.finalAllPass).length;
const plAllPass = plRuns.filter((r) => r.finalAllPass).length;

manifest.summary = {
  baseline: {
    runs: baselineRuns.length,
    allPass: baselineAllPass,
    avgPassed: baselineRuns.reduce((a, r) => a + r.finalPassed, 0) / Math.max(1, baselineRuns.length),
    totalTokens: baselineRuns.reduce((a, r) => a + r.totalLocalTokens, 0),
  },
  plFix: {
    runs: plRuns.length,
    allPass: plAllPass,
    avgPassed: plRuns.reduce((a, r) => a + r.finalPassed, 0) / Math.max(1, plRuns.length),
    totalTokens: plRuns.reduce((a, r) => a + r.totalLocalTokens, 0),
    avgIter: plRuns.reduce((a, r) => a + r.iterations, 0) / Math.max(1, plRuns.length),
  },
};

console.log('\n=== Summary ===');
console.log(`Baseline:  ${baselineAllPass}/${baselineRuns.length} all-pass (avg ${manifest.summary.baseline.avgPassed.toFixed(1)}/3 tests passing)`);
console.log(`PL-fix:    ${plAllPass}/${plRuns.length} all-pass (avg ${manifest.summary.plFix.avgPassed.toFixed(1)}/3, ${manifest.summary.plFix.avgIter.toFixed(1)} iterations avg)`);

writeFileSync(join(RESULTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nManifest written to ${join(RESULTS_DIR, 'manifest.json')}`);

resetFixture(); // leave fixture in known broken state for re-runs
