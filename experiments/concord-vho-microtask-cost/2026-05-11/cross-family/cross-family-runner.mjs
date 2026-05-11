// Cross-family adversarial review of the v2 100/100 headline.
// Process: ask gemma4:26b (different model family from Qwen) to generate
// adversarial test cases for each of the 10 tasks, then run qwen's
// existing k=1 solutions against the new gemma-generated cases.
//
// Result interpretation:
// - If qwen solutions still pass adversarial cases written by a different
//   family: strong evidence the v2 100/100 isn't memorization-fit; the
//   solutions are substantively correct.
// - If qwen solutions FAIL adversarial cases: the 100/100 was an artifact
//   of in-family oracle weakness, not genuine substitution.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ARM_A_DIR = join(ROOT, 'arm-a-local-full');
const RESULTS_DIR = HERE;
mkdirSync(RESULTS_DIR, { recursive: true });

const ENDPOINT = 'http://localhost:11434';
const REVIEWER_MODEL = process.env.REVIEWER_MODEL || 'gemma4:26b';

const TASKS = JSON.parse(readFileSync(join(ROOT, 'tasks.json'), 'utf8'));

// Promptforming a different-family model to generate adversarial test cases
// for a given task. We deliberately do NOT show it the existing tests so
// it can't just copy them.
function reviewerPrompt(task) {
  return `You are writing adversarial test cases to test a JavaScript implementation of this function:

${task.signature}

Behavior: ${task.description}

Reply with ONLY a JSON array of 6 test cases that go BEYOND the obvious examples. Each test case must be:
{"args": [<args>], "expected": <expected value>}

Use edge cases like: empty inputs, boundary values, large inputs, inputs that look correct but should produce a specific output, unicode/whitespace where relevant, type-coercion edge cases. Do NOT include cases that throw errors — only cases with a definite expected return.

Reply with ONLY the JSON array, no fences, no commentary, no preamble.`;
}

async function generate(model, prompt) {
  const t0 = performance.now();
  const res = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: 1024, temperature: 0.3 },
    }),
  });
  const wallMs = performance.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { response: j.response, wallMs, evalTokens: j.eval_count || 0 };
}

function extractJson(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json|javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // Look for the first [ ... ] block
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = s.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  // Tolerate number equality with epsilon
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9 || (Number.isNaN(a) && Number.isNaN(b));
  }
  return false;
}

const overall = { startedAt: new Date().toISOString(), reviewerModel: REVIEWER_MODEL, perTask: [] };

for (const task of TASKS) {
  console.log(`\n=== ${task.id} ===`);

  // Step 1: ask reviewer for adversarial cases
  console.log(`  asking ${REVIEWER_MODEL} for adversarial cases...`);
  let cases;
  try {
    const gen = await generate(REVIEWER_MODEL, reviewerPrompt(task));
    cases = extractJson(gen.response);
    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      console.log(`  REVIEWER_NO_CASES (raw[0..200]: ${gen.response.slice(0, 200).replace(/\n/g, ' ')})`);
      overall.perTask.push({ id: task.id, status: 'reviewer-no-cases', rawSnippet: gen.response.slice(0, 400) });
      continue;
    }
    console.log(`  got ${cases.length} adversarial cases`);
  } catch (e) {
    console.log(`  REVIEWER_ERROR ${e.message}`);
    overall.perTask.push({ id: task.id, status: 'reviewer-error', error: e.message });
    continue;
  }

  // Step 2: load qwen's k=1 solution
  const solnPath = join(ARM_A_DIR, `${task.id}.k1.mjs`);
  let fn;
  try {
    const mod = await import(`file://${solnPath.replace(/\\/g, '/')}`);
    fn = mod[task.id];
    if (typeof fn !== 'function') throw new Error('export not a function');
  } catch (e) {
    console.log(`  SOLN_LOAD_ERROR ${e.message}`);
    overall.perTask.push({ id: task.id, status: 'solution-load-error', error: e.message });
    continue;
  }

  // Step 3: run qwen's solution against gemma's cases
  let pass = 0;
  const failures = [];
  for (const c of cases) {
    if (!c || !Array.isArray(c.args)) {
      failures.push({ case: c, reason: 'malformed case' });
      continue;
    }
    let actual;
    try {
      actual = fn(...c.args);
    } catch (e) {
      failures.push({ args: c.args, expected: c.expected, threw: e.message });
      continue;
    }
    if (deepEqual(actual, c.expected)) {
      pass++;
    } else {
      failures.push({ args: c.args, expected: c.expected, actual });
    }
  }

  const result = {
    id: task.id,
    status: 'graded',
    casesGenerated: cases.length,
    passed: pass,
    passRate: cases.length ? pass / cases.length : 0,
    failures: failures.slice(0, 5),
    cases,
  };
  console.log(`  qwen pass: ${pass}/${cases.length} (${Math.round(100 * pass / cases.length)}%)`);
  if (failures.length) {
    console.log(`    sample failure: ${JSON.stringify(failures[0]).slice(0, 200)}`);
  }
  overall.perTask.push(result);
}

overall.completedAt = new Date().toISOString();

// Aggregate
const graded = overall.perTask.filter((t) => t.status === 'graded');
const totalCases = graded.reduce((a, t) => a + t.casesGenerated, 0);
const totalPass = graded.reduce((a, t) => a + t.passed, 0);
overall.summary = {
  tasksGraded: graded.length,
  totalAdversarialCases: totalCases,
  totalPassed: totalPass,
  overallPassRate: totalCases ? totalPass / totalCases : 0,
  perTaskPassRates: graded.map((t) => ({ id: t.id, pass: t.passed, total: t.casesGenerated })),
};

writeFileSync(join(RESULTS_DIR, 'cross-family-results.json'), JSON.stringify(overall, null, 2));

console.log('\n=== Cross-family summary ===');
console.log(`Reviewer: ${REVIEWER_MODEL}`);
console.log(`Tasks graded: ${graded.length}/${TASKS.length}`);
console.log(`Adversarial cases (qwen ran against): ${totalCases}`);
console.log(`Overall pass rate: ${totalPass}/${totalCases} (${Math.round(100 * totalPass / totalCases)}%)`);
console.log('Per-task:');
for (const t of overall.summary.perTaskPassRates) {
  console.log(`  ${t.id.padEnd(20)} ${t.pass}/${t.total}`);
}
console.log(`\nWritten to ${join(RESULTS_DIR, 'cross-family-results.json')}`);
