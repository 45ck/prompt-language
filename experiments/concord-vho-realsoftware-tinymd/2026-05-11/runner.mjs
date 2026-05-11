// Tinymd hybrid runner. Routes F1-F8 to qwen3-coder:30b in dependency order.
// On per-function oracle fail, rolls back to stub and marks frontier-required.
// After all functions, runs integration tests on the assembled workspace.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS_FILE = join(HERE, 'tasks.json');
const WORKSPACE_PATH = join(HERE, 'arm-a-hybrid', 'workspace', 'tinymd.mjs');
const RESULTS_DIR = join(HERE, 'results');
const ARM_B_PATH = join(HERE, 'arm-b-frontier', 'tinymd.mjs');
const ORACLE_TASK = join(HERE, 'oracle', 'run-task.mjs');
const ORACLE_INTEGRATION = join(HERE, 'oracle', 'integration.test.mjs');

mkdirSync(RESULTS_DIR, { recursive: true });

const ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const MODEL = 'qwen3-coder:30b';

// Initial skeleton snapshot — if any function rolls back, restore from this.
const initialSkeleton = `// tinymd skeleton — function bodies start as throw-stubs and get filled
// in by the router from local-model output. The convert orchestrator at
// the bottom is frontier-owned (not routed).

export function escapeHtml(text) { throw new Error('NOT_IMPLEMENTED:escapeHtml'); }

export function parseHeading(line) { throw new Error('NOT_IMPLEMENTED:parseHeading'); }

export function parseListItem(line) { throw new Error('NOT_IMPLEMENTED:parseListItem'); }

export function isFenceLine(line) { throw new Error('NOT_IMPLEMENTED:isFenceLine'); }

export function parseInline(text) { throw new Error('NOT_IMPLEMENTED:parseInline'); }

export function tokenize(markdown) { throw new Error('NOT_IMPLEMENTED:tokenize'); }

export function renderToken(token) { throw new Error('NOT_IMPLEMENTED:renderToken'); }

export function groupListTokens(tokens) { throw new Error('NOT_IMPLEMENTED:groupListTokens'); }

// FRONTIER-OWNED: integration / orchestrator
export function convert(markdown) {
  const tokens = tokenize(markdown);
  const grouped = groupListTokens(tokens);
  return grouped
    .map((t) => {
      if (t.type === 'list') {
        return \`<ul>\\n\${t.items.map(renderToken).join('\\n')}\\n</ul>\`;
      }
      return renderToken(t);
    })
    .join('\\n');
}
`;

writeFileSync(WORKSPACE_PATH, initialSkeleton);

const PROMPT_TEMPLATE = (
  task,
) => `Implement this JavaScript function. Reply with ONLY the function declaration starting with "export function", no fences, no comments, no explanation, no extra exports.

${task.signature}: ${task.description}`;

async function generate(prompt) {
  const t0 = performance.now();
  const res = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { num_predict: 1024, temperature: 0, seed: 1234 },
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
  if (m) s = m[1].trim();
  const idx = s.indexOf('export function');
  if (idx === -1) return null;
  return s.slice(idx).trim();
}

function replaceStub(source, fnName, newImpl) {
  const stubRe = new RegExp(
    `export function ${fnName}\\([^)]*\\)\\s*\\{[\\s\\S]*?NOT_IMPLEMENTED:${fnName}[\\s\\S]*?\\}`,
    'm',
  );
  if (!stubRe.test(source)) return null;
  // newImpl should already be a full export-function block
  return source.replace(stubRe, newImpl);
}

function tokenCount(text) {
  const r = spawnSync(
    'python',
    [
      '-c',
      `import sys, tiktoken; enc=tiktoken.get_encoding('cl100k_base'); print(len(enc.encode(sys.stdin.read())))`,
    ],
    { input: text, encoding: 'utf8' },
  );
  if (r.status === 0) return parseInt(r.stdout.trim(), 10);
  return Math.ceil(text.length / 3.5);
}

function runOracleTask(taskId, workspacePath) {
  const r = spawnSync('node', [ORACLE_TASK, taskId, workspacePath], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    parsed = null;
  }
  return { exitCode: r.status, pass: r.status === 0, parsed, stderr: (r.stderr || '').slice(-400) };
}

function runIntegration(workspacePath) {
  const r = spawnSync('node', [ORACLE_INTEGRATION, workspacePath], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    parsed = null;
  }
  return {
    exitCode: r.status,
    pass: r.status === 0,
    parsed,
    stderr: (r.stderr || '').slice(-1500),
  };
}

const tasks = JSON.parse(readFileSync(TASKS_FILE, 'utf8'));

console.log('=== Warm-up call (discarded) ===');
try {
  await generate('Reply with just OK.');
  console.log('  warm-up complete');
} catch (e) {
  console.error('  warm-up FAILED:', e.message);
  process.exit(1);
}

const manifest = { startedAt: new Date().toISOString(), model: MODEL, perTask: [] };

for (const task of tasks) {
  console.log(`\n=== ${task.id} ===`);
  const beforeSnapshot = readFileSync(WORKSPACE_PATH, 'utf8');

  let attemptResult;
  try {
    const gen = await generate(PROMPT_TEMPLATE(task));
    const code = extractCode(gen.response);
    if (!code) {
      attemptResult = {
        error: 'no code extracted',
        wallMs: Math.round(gen.wallMs),
        localEvalTokens: gen.evalTokens,
        raw: gen.response.slice(0, 200),
      };
    } else {
      const newSource = replaceStub(beforeSnapshot, task.id, code);
      if (!newSource) {
        attemptResult = {
          error: `stub for ${task.id} not found in workspace`,
          wallMs: Math.round(gen.wallMs),
          localEvalTokens: gen.evalTokens,
        };
      } else {
        writeFileSync(WORKSPACE_PATH, newSource);
        const oracle = runOracleTask(task.id, WORKSPACE_PATH);
        attemptResult = {
          pass: oracle.pass,
          oracle: oracle.parsed,
          wallMs: Math.round(gen.wallMs),
          localEvalTokens: gen.evalTokens,
          codeTiktoken: tokenCount(code),
          codeChars: code.length,
          generatedRaw: gen.response,
          extractedCode: code,
        };
      }
    }
  } catch (e) {
    attemptResult = { error: e.message };
  }

  if (attemptResult.pass) {
    console.log(
      `  PASS ${attemptResult.oracle?.passed}/${attemptResult.oracle?.total} | ${attemptResult.wallMs}ms | ${attemptResult.localEvalTokens} local tok | ${attemptResult.codeTiktoken} tiktoken-equiv`,
    );
  } else {
    // Roll back this task's stub
    writeFileSync(WORKSPACE_PATH, beforeSnapshot);
    if (attemptResult.error) {
      console.log(`  FRONTIER-REQUIRED (${attemptResult.error})`);
    } else {
      console.log(
        `  FRONTIER-REQUIRED (oracle ${attemptResult.oracle?.passed}/${attemptResult.oracle?.total}) | ${attemptResult.wallMs}ms | ${attemptResult.localEvalTokens} local tok`,
      );
      if (attemptResult.oracle?.failures?.length) {
        console.log(`    first failure: ${attemptResult.oracle.failures[0].slice(0, 200)}`);
      }
    }
  }

  manifest.perTask.push({
    id: task.id,
    route: attemptResult.pass ? 'local-only' : 'frontier-required',
    attempt: attemptResult,
  });
}

manifest.completedAt = new Date().toISOString();

// Compare to Arm B token cost
const armBSource = readFileSync(ARM_B_PATH, 'utf8');
const armBTokens = tokenCount(armBSource);

// Hybrid arm-A frontier cost so far = scaffolding (counted separately) + repair tokens for each frontier-required
// Repair-token estimate per task = the corresponding section of arm-b-frontier/tinymd.mjs
// (simple proxy: split arm-B tokens proportionally to function chars)

const localPassed = manifest.perTask.filter((t) => t.route === 'local-only').length;
const frontierRequired = manifest.perTask
  .filter((t) => t.route === 'frontier-required')
  .map((t) => t.id);
const totalLocalEvalTokens = manifest.perTask.reduce(
  (a, t) => a + (t.attempt.localEvalTokens || 0),
  0,
);
const totalLocalCodeTokens = manifest.perTask.reduce(
  (a, t) => a + (t.attempt.codeTiktoken || 0),
  0,
);

manifest.summary = {
  totalRoutableTasks: tasks.length,
  localOnly: localPassed,
  frontierRequired,
  totalLocalEvalTokens,
  totalLocalGeneratedTiktokenTokens: totalLocalCodeTokens,
  armB_total_tiktoken_tokens: armBTokens,
};

console.log('\n=== Per-function summary ===');
console.log(`Local-only first-attempt pass: ${localPassed} / ${tasks.length}`);
console.log(`Frontier required for: ${frontierRequired.join(', ') || '(none)'}`);
console.log(`Local eval tokens consumed: ${totalLocalEvalTokens}`);
console.log(`Arm B (frontier-only baseline) full module tokens: ${armBTokens}`);

writeFileSync(join(RESULTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Try integration test now (may fail if any function is still stubbed — that's OK, we capture it)
console.log('\n=== Integration tests (workspace as-is) ===');
const integration = runIntegration(WORKSPACE_PATH);
console.log(
  integration.parsed
    ? `${integration.parsed.passed}/${integration.parsed.total} integration cases pass`
    : `(could not parse oracle output, exit ${integration.exitCode})`,
);
if (!integration.pass && integration.stderr) {
  console.log('first failure context:');
  console.log(integration.stderr.slice(0, 500));
}

manifest.integration = {
  pass: integration.pass,
  exitCode: integration.exitCode,
  result: integration.parsed,
  stderrTail: integration.stderr,
};

writeFileSync(join(RESULTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nManifest written to results/manifest.json');
