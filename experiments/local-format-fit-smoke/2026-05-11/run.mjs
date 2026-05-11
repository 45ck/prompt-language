#!/usr/bin/env node
// Bounded local-model coding smoke. Not claim-eligible. 2026-05-11.

import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const REPEATS = Number(process.env.REPEATS || 1);
const args = process.argv.slice(2);
const MODELS = args.length ? args : ['qwen3-coder:30b', 'devstral-small-2:24b'];
const OUT_DIR = process.env.OUT_DIR || './results-2026-05-11';
mkdirSync(OUT_DIR, { recursive: true });

const TASKS = [
  {
    id: 'isPrime',
    prompt: 'Reply with ONLY the JavaScript line: `const fn = (n) => /* your impl */;` that returns true iff n is a prime integer >= 2. No fences, no commentary.',
    cases: [[2,true],[3,true],[4,false],[5,true],[9,false],[11,true],[1,false],[0,false],[-7,false],[97,true],[100,false]],
  },
  {
    id: 'reverseString',
    prompt: 'Reply with ONLY the JavaScript line: `const fn = (s) => /* your impl */;` that returns s reversed. No fences, no commentary.',
    cases: [['',''],['a','a'],['ab','ba'],['hello','olleh'],['racecar','racecar'],['12345','54321']],
  },
  {
    id: 'fibonacci',
    prompt: 'Reply with ONLY the JavaScript line: `const fn = (n) => /* your impl */;` that returns the nth Fibonacci with fn(0)=0, fn(1)=1, fn(2)=1, fn(10)=55. No fences, no commentary.',
    cases: [[0,0],[1,1],[2,1],[3,2],[5,5],[10,55],[15,610]],
  },
  {
    id: 'gcd',
    prompt: 'Reply with ONLY the JavaScript line: `const fn = (a, b) => /* your impl */;` that returns the gcd of two positive ints. No fences, no commentary.',
    cases: [[[12,8],4],[[100,75],25],[[17,5],1],[[1,1],1],[[48,18],6]],
  },
  {
    id: 'classifyStderr',
    prompt: "Reply with ONLY the JavaScript line: `const fn = (s) => /* your impl */;` that classifies a stderr string into one of: 'dependency','syntax','type','runtime','network','other'. Heuristics: 'Cannot find module' or 'MODULE_NOT_FOUND' -> dependency; 'SyntaxError' -> syntax; 'TypeError' -> type; 'ECONNREFUSED' or 'ETIMEDOUT' -> network; 'ReferenceError' or 'RangeError' -> runtime; otherwise other. No fences, no commentary.",
    cases: [
      ["Error: Cannot find module 'lodash'",'dependency'],
      ['SyntaxError: Unexpected token <','syntax'],
      ['TypeError: x.map is not a function','type'],
      ['Error: connect ECONNREFUSED 127.0.0.1:5432','network'],
      ['ReferenceError: foo is not defined','runtime'],
      ['Some unknown weird message','other'],
    ],
  },
];

async function generate(model, prompt) {
  const t0 = performance.now();
  const res = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: 512, temperature: 0 } }),
  });
  const wallMs = performance.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return {
    response: j.response,
    wallMs,
    loadMs: (j.load_duration || 0) / 1e6,
    promptEvalMs: (j.prompt_eval_duration || 0) / 1e6,
    promptTokens: j.prompt_eval_count || 0,
    evalMs: (j.eval_duration || 0) / 1e6,
    evalTokens: j.eval_count || 0,
    tokensPerSec: j.eval_count && j.eval_duration ? j.eval_count / (j.eval_duration / 1e9) : 0,
  };
}

function extractFn(raw) {
  let s = raw.trim();
  // Strip surrounding markdown code fences with any language tag
  s = s.replace(/^```[a-zA-Z]*\n?/i, '').replace(/\n?```\s*$/i, '');
  // Strip surrounding single backticks (inline-code wrapper)
  if (s.startsWith('`') && s.endsWith('`')) s = s.slice(1, -1);
  s = s.trim();
  const lines = s.split(/\r?\n/);
  let fnLine = lines.find((l) => /\bconst\s+fn\s*=/.test(l));
  if (fnLine) return fnLine.replace(/^`|`$/g, '').trim();
  const idx = s.indexOf('const fn');
  return idx === -1 ? null : s.slice(idx).replace(/`/g, '');
}

function runOracle(fnSource, cases) {
  if (!fnSource) return { passed: 0, total: cases.length, details: 'no fn extracted' };
  let fn;
  try {
    fn = Function(`${fnSource}; return fn;`)();
  } catch (e) {
    return { passed: 0, total: cases.length, details: `parse error: ${e.message}` };
  }
  let passed = 0;
  const failures = [];
  for (const [input, expected] of cases) {
    let actual;
    try {
      actual = Array.isArray(input) ? fn(...input) : fn(input);
    } catch (e) {
      failures.push(`fn(${JSON.stringify(input)}) threw: ${e.message}`);
      continue;
    }
    if (Object.is(actual, expected)) passed++;
    else failures.push(`fn(${JSON.stringify(input)})=${JSON.stringify(actual)} exp ${JSON.stringify(expected)}`);
  }
  return { passed, total: cases.length, details: failures.slice(0, 2).join(' | ') };
}

const allResults = [];

for (const model of MODELS) {
  console.log(`\n=== ${model} (k=${REPEATS}) ===`);
  for (const task of TASKS) {
    for (let k = 1; k <= REPEATS; k++) {
      process.stdout.write(`[${task.id} k${k}] `);
      let result;
      try {
        const gen = await generate(model, task.prompt);
        const fnSource = extractFn(gen.response);
        const oracle = runOracle(fnSource, task.cases);
        result = {
          model,
          task: task.id,
          k,
          oraclePass: oracle.passed === oracle.total,
          passed: oracle.passed,
          total: oracle.total,
          wallMs: Math.round(gen.wallMs),
          loadMs: Math.round(gen.loadMs),
          evalTokens: gen.evalTokens,
          tokensPerSec: Math.round(gen.tokensPerSec * 10) / 10,
          fnSource,
          oracleDetail: oracle.details,
        };
      } catch (e) {
        result = { model, task: task.id, k, error: e.message };
      }
      allResults.push(result);
      if (result.error) {
        console.log(`ERROR ${result.error}`);
      } else {
        console.log(`${result.oraclePass ? 'PASS' : 'FAIL'} ${result.passed}/${result.total} | ${result.wallMs}ms | ${result.tokensPerSec} t/s | ${result.evalTokens} tok`);
        if (!result.oraclePass) console.log(`     ${result.oracleDetail}`);
      }
    }
  }
}

writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(allResults, null, 2));

console.log('\n=== Per-task pass rate (model x task) ===');
const byMT = {};
for (const r of allResults) {
  if (r.error) continue;
  const key = `${r.model}|${r.task}`;
  if (!byMT[key]) byMT[key] = { passed: 0, runs: 0 };
  byMT[key].passed += r.oraclePass ? 1 : 0;
  byMT[key].runs += 1;
}
const tasks = [...new Set(allResults.map((r) => r.task))];
const models = [...new Set(allResults.map((r) => r.model))];
const header = `${'model'.padEnd(28)} | ${tasks.map((t) => t.padEnd(15)).join(' ')}`;
console.log(header);
console.log('-'.repeat(header.length));
for (const m of models) {
  const cells = tasks.map((t) => {
    const c = byMT[`${m}|${t}`];
    return c ? `${c.passed}/${c.runs}`.padEnd(15) : '-'.padEnd(15);
  });
  console.log(`${m.padEnd(28)} | ${cells.join(' ')}`);
}

console.log('\n=== Aggregate ===');
const summary = {};
for (const r of allResults) {
  if (r.error) continue;
  if (!summary[r.model]) summary[r.model] = { passed: 0, total: 0, wallMs: 0, tokens: 0 };
  summary[r.model].passed += r.oraclePass ? 1 : 0;
  summary[r.model].total += 1;
  summary[r.model].wallMs += r.wallMs;
  summary[r.model].tokens += r.evalTokens;
}
for (const [m, s] of Object.entries(summary)) {
  const tps = s.tokens && s.wallMs ? Math.round((s.tokens / (s.wallMs / 1000)) * 10) / 10 : 0;
  console.log(`${m}: ${s.passed}/${s.total} oracle | ${s.wallMs}ms total | ${s.tokens} tokens | ~${tps} t/s overall`);
}
writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify({ summary, byTask: byMT }, null, 2));
console.log(`\nResults written to ${OUT_DIR}/`);
