// router.mjs — Concord/VHO pilot routing logic.
// For each task: try local-fast, then local-second-opinion, then mark for frontier.
// Captures real per-attempt timing/tokens. Does NOT call frontier from here —
// the frontier (Claude) handles repair manually after this script reports.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, 'workspace');
const ORACLE_DIR = join(HERE, 'oracle');
const RESULTS_DIR = join(HERE, 'results');
const TODO_PATH = join(WORKSPACE, 'todo.mjs');

const ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const MODEL_FAST = 'qwen3-coder:30b';
const MODEL_SECOND_OPINION = 'devstral-small-2:24b';

async function generate(model, prompt) {
  const t0 = performance.now();
  const res = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: 1024, temperature: 0 },
    }),
  });
  const wallMs = performance.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return {
    response: j.response,
    wallMs,
    evalTokens: j.eval_count || 0,
    promptTokens: j.prompt_eval_count || 0,
    tokensPerSec: j.eval_count && j.eval_duration ? j.eval_count / (j.eval_duration / 1e9) : 0,
  };
}

function extractFnBody(raw) {
  // Strip outer code fences if present
  let s = raw.trim();
  s = s.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```\s*$/i, '');
  // If model wrapped with multiple fences, take the first complete code block
  const m = raw.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
  if (m) return m[1].trim();
  return s.trim();
}

function replaceStub(currentSource, fnName, newImpl) {
  // Find the stub: `export function NAME(...) { ... NOT_IMPLEMENTED:NAME ... }`
  const stubRe = new RegExp(
    `export function ${fnName}\\([^)]*\\)\\s*\\{[\\s\\S]*?NOT_IMPLEMENTED:${fnName}[\\s\\S]*?\\}`,
    'm',
  );
  if (!stubRe.test(currentSource)) {
    return null;
  }
  // newImpl might already include `export function NAME(...) { ... }` or just the body — handle both
  const exportFnRe = new RegExp(`export function ${fnName}\\b[\\s\\S]*\\}`, 'm');
  const match = newImpl.match(exportFnRe);
  if (match) {
    return currentSource.replace(stubRe, match[0]);
  }
  // Otherwise treat newImpl as the body and wrap it
  return currentSource.replace(stubRe, `export function ${fnName}() {\n${newImpl}\n}`);
}

function replaceTwoStubs(currentSource, fnNames, newImpl) {
  let result = currentSource;
  for (const fnName of fnNames) {
    const stubRe = new RegExp(
      `export function ${fnName}\\([^)]*\\)\\s*\\{[\\s\\S]*?NOT_IMPLEMENTED:${fnName}[\\s\\S]*?\\}`,
      'm',
    );
    const exportFnRe = new RegExp(`export function ${fnName}\\b[^{]*\\{[\\s\\S]*?\\n\\}`, 'm');
    const match = newImpl.match(exportFnRe);
    if (match) {
      result = result.replace(stubRe, match[0]);
    }
  }
  return result;
}

function ensureFsImport(source) {
  if (source.includes("from 'node:fs'") || source.includes('from "node:fs"')) return source;
  return `import { writeFileSync, readFileSync, existsSync } from 'node:fs';\n` + source;
}

async function runOracle(testPattern) {
  const r = spawnSync(
    'node',
    ['--test', '--test-name-pattern', testPattern, join(ORACLE_DIR, 'todo.test.mjs')],
    { encoding: 'utf8', cwd: HERE, timeout: 30_000 },
  );
  return {
    exitCode: r.status,
    pass: r.status === 0,
    stdout: r.stdout,
    stderr: r.stderr,
  };
}

function readWorkspace() {
  return readFileSync(TODO_PATH, 'utf8');
}

function writeWorkspace(s) {
  writeFileSync(TODO_PATH, s);
}

async function attemptTask(task, model, currentSource) {
  const gen = await generate(model, task.prompt);
  const body = extractFnBody(gen.response);
  let newSource;
  if (task.id === 'T5') {
    newSource = replaceTwoStubs(currentSource, ['save', 'load'], body);
    newSource = ensureFsImport(newSource);
  } else {
    newSource = replaceStub(currentSource, task.name, body);
  }
  if (!newSource) {
    return {
      model,
      replaceFailed: true,
      generatedRaw: gen.response,
      extractedBody: body,
      wallMs: Math.round(gen.wallMs),
      evalTokens: gen.evalTokens,
      tokensPerSec: Math.round(gen.tokensPerSec * 10) / 10,
    };
  }
  writeWorkspace(newSource);
  // Cache-bust: dynamic import will re-read since we use spawnSync of node --test
  const oracle = await runOracle(task.testPattern);
  return {
    model,
    pass: oracle.pass,
    wallMs: Math.round(gen.wallMs),
    evalTokens: gen.evalTokens,
    tokensPerSec: Math.round(gen.tokensPerSec * 10) / 10,
    oracleExitCode: oracle.exitCode,
    oracleStderrTail: oracle.stderr.slice(-400),
    generatedRaw: gen.response,
    extractedBody: body,
    sourceAfter: newSource,
  };
}

const tasks = JSON.parse(readFileSync(join(HERE, 'tasks.json'), 'utf8'));
const manifest = { startedAt: new Date().toISOString(), tasks: [] };

for (const task of tasks) {
  console.log(`\n=== ${task.id} ${task.name} ===`);
  const baselineSource = readWorkspace();

  // Attempt 1: local fast
  console.log(`  attempt 1 → ${MODEL_FAST}`);
  const a1 = await attemptTask(task, MODEL_FAST, baselineSource);
  console.log(`    ${a1.pass ? 'PASS' : a1.replaceFailed ? 'REPLACE_FAILED' : 'FAIL'} | ${a1.wallMs}ms | ${a1.evalTokens} tok`);

  if (a1.pass) {
    manifest.tasks.push({
      id: task.id,
      name: task.name,
      route: 'local-fast',
      attempt1: a1,
      attempt2: null,
      frontierRequired: false,
      tokensTotalLocal: a1.evalTokens,
      wallMsTotalLocal: a1.wallMs,
    });
    continue;
  }

  // Attempt 2: local second opinion — but FIRST roll back the broken impl
  writeWorkspace(baselineSource);
  console.log(`  attempt 2 → ${MODEL_SECOND_OPINION}`);
  const a2 = await attemptTask(task, MODEL_SECOND_OPINION, baselineSource);
  console.log(`    ${a2.pass ? 'PASS' : a2.replaceFailed ? 'REPLACE_FAILED' : 'FAIL'} | ${a2.wallMs}ms | ${a2.evalTokens} tok`);

  if (a2.pass) {
    manifest.tasks.push({
      id: task.id,
      name: task.name,
      route: 'local-second-opinion',
      attempt1: a1,
      attempt2: a2,
      frontierRequired: false,
      tokensTotalLocal: a1.evalTokens + a2.evalTokens,
      wallMsTotalLocal: a1.wallMs + a2.wallMs,
    });
    continue;
  }

  // Both locals failed — roll back, mark for frontier repair
  writeWorkspace(baselineSource);
  console.log(`  → frontier repair required`);
  manifest.tasks.push({
    id: task.id,
    name: task.name,
    route: 'frontier-required',
    attempt1: a1,
    attempt2: a2,
    frontierRequired: true,
    tokensTotalLocal: a1.evalTokens + a2.evalTokens,
    wallMsTotalLocal: a1.wallMs + a2.wallMs,
  });
}

manifest.completedAt = new Date().toISOString();

const localOnly = manifest.tasks.filter((t) => !t.frontierRequired).length;
const frontierNeeded = manifest.tasks.filter((t) => t.frontierRequired).map((t) => t.id);
const totalLocalTokens = manifest.tasks.reduce((a, t) => a + t.tokensTotalLocal, 0);

manifest.summary = {
  totalTasks: tasks.length,
  closedByLocal: localOnly,
  frontierRequiredFor: frontierNeeded,
  totalLocalTokens,
  totalLocalWallMs: manifest.tasks.reduce((a, t) => a + t.wallMsTotalLocal, 0),
};

writeFileSync(join(RESULTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('\n=== Summary ===');
console.log(`Closed by local: ${localOnly} / ${tasks.length}`);
console.log(`Frontier required for: ${frontierNeeded.join(', ') || '(none)'}`);
console.log(`Total local tokens: ${totalLocalTokens}`);
console.log(`Manifest written to results/manifest.json`);
