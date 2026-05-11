// Pilot v2 runner. Two arms.
//
// Arm A (hybrid): qwen3-coder:30b implements via Ollama; oracle gates each task.
// Arm B (frontier): pre-committed implementations in arm-b-frontier/.
//
// Token economy: tiktoken cl100k_base counts characters of generated code as a
// proxy for Anthropic BPE output tokens (within ~10-15% per pre-flight critic).
// Local eval_count comes from Ollama and is in qwen3-coder's BPE — different
// tokenizer family, so we ALSO normalise everything to tiktoken char counts for
// apples-to-apples comparison.
//
// k=3 per task per arm.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARM_B_DIR = join(HERE, 'arm-b-frontier');
const ARM_A_DIR = join(HERE, 'arm-a-local');
const RESULTS_DIR = join(HERE, 'results');
const ORACLE = join(HERE, 'oracle', 'run-tests.mjs');

mkdirSync(ARM_A_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

const ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const MODEL = 'qwen3-coder:30b';
const REPEATS = Number(process.env.REPEATS || 3);

const DENSITY = process.env.DENSITY || 'full'; // 'full' | 'starved'

const PROMPT_TEMPLATE = (task) => {
  const desc = DENSITY === 'starved' ? task.descriptionStarved : task.description;
  return `Implement this JavaScript function. Reply with ONLY the function declaration starting with "export function", no fences, no comments, no explanation, no extra exports.

${task.signature}: ${desc}`;
};

async function generate(prompt) {
  const t0 = performance.now();
  const res = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { num_predict: 512, temperature: 0, seed: 1234 },
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
  };
}

function extractCode(raw) {
  let s = raw.trim();
  // Strip leading/trailing fences
  s = s.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // If the model still wrote a fenced block somewhere, extract first one
  const m = raw.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
  if (m) s = m[1].trim();
  // Find the first "export function" line and take from there to end (or to next "export")
  const idx = s.indexOf('export function');
  if (idx === -1) return null;
  return s.slice(idx).trim();
}

function tokenCount(text) {
  // Use python tiktoken via spawnSync. Fallback to chars/3.5 if it fails.
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

function runOracle(taskId, implPath) {
  const r = spawnSync('node', [ORACLE, taskId, implPath], { encoding: 'utf8', timeout: 30_000 });
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
    stderr: (r.stderr || '').slice(-400),
  };
}

const tasks = JSON.parse(readFileSync(join(HERE, 'tasks.json'), 'utf8'));

console.log('=== Warm-up call (discarded) ===');
try {
  await generate('Reply with just the word OK.');
  console.log('  warm-up complete');
} catch (e) {
  console.error('  warm-up FAILED:', e.message);
  process.exit(1);
}

const manifest = {
  startedAt: new Date().toISOString(),
  model: MODEL,
  repeats: REPEATS,
  perTask: [],
};

for (const task of tasks) {
  console.log(`\n=== ${task.id} ===`);

  // Arm B (frontier, pre-committed) — load and tokencount once
  const armBPath = join(ARM_B_DIR, `${task.id}.mjs`);
  if (!existsSync(armBPath)) {
    console.log(`  ARM_B_MISSING: ${armBPath}`);
    continue;
  }
  const armBSource = readFileSync(armBPath, 'utf8');
  const armBTokens = tokenCount(armBSource);
  const armBOracle = runOracle(task.id, armBPath);
  console.log(
    `  arm B (frontier): ${armBOracle.pass ? 'PASS' : 'FAIL'} ${armBOracle.parsed?.passed}/${armBOracle.parsed?.total} | ${armBTokens} tiktoken-equiv tokens | ${armBSource.length} chars`,
  );

  // Arm A (local) — k repeats
  const prompt = PROMPT_TEMPLATE(task);
  const promptTokens = tokenCount(prompt);
  const armAReps = [];
  for (let k = 1; k <= REPEATS; k++) {
    process.stdout.write(`  arm A k${k}: `);
    let rep;
    try {
      const gen = await generate(prompt);
      const code = extractCode(gen.response);
      if (!code) {
        rep = {
          k,
          pass: false,
          error: 'no code extracted',
          wallMs: Math.round(gen.wallMs),
          localEvalTokens: gen.evalTokens,
          raw: gen.response.slice(0, 200),
        };
        console.log(`NO_CODE | ${rep.wallMs}ms | ${rep.localEvalTokens} local tok`);
      } else {
        // Write candidate to its own file
        const candidatePath = join(ARM_A_DIR, `${task.id}.k${k}.mjs`);
        writeFileSync(candidatePath, code);
        const oracle = runOracle(task.id, candidatePath);
        const codeTokens = tokenCount(code);
        rep = {
          k,
          pass: oracle.pass,
          oracle: oracle.parsed,
          wallMs: Math.round(gen.wallMs),
          localEvalTokens: gen.evalTokens,
          codeTiktokenTokens: codeTokens,
          codeChars: code.length,
        };
        console.log(
          `${oracle.pass ? 'PASS' : 'FAIL'} ${oracle.parsed?.passed ?? '?'}/${oracle.parsed?.total ?? '?'} | ${rep.wallMs}ms | ${rep.localEvalTokens} local tok | ${codeTokens} tiktoken-equiv`,
        );
      }
    } catch (e) {
      rep = { k, pass: false, error: e.message };
      console.log(`ERROR ${e.message}`);
    }
    armAReps.push(rep);
  }

  const armAPasses = armAReps.filter((r) => r.pass).length;
  const armAFirstPass = armAReps[0]?.pass === true;
  const localTokensSum = armAReps.reduce((a, r) => a + (r.localEvalTokens || 0), 0);
  const passingRep = armAReps.find((r) => r.pass);

  manifest.perTask.push({
    id: task.id,
    category: task.category,
    promptTokensTiktoken: promptTokens,
    armB: {
      pass: armBOracle.pass,
      tokens: armBTokens,
      chars: armBSource.length,
    },
    armA: {
      reps: armAReps,
      passingReps: armAPasses,
      firstAttemptPass: armAFirstPass,
      anyPass: armAPasses > 0,
      bestPassingTokens: passingRep ? passingRep.codeTiktokenTokens : null,
      avgLocalEvalTokens: Math.round(localTokensSum / armAReps.length),
    },
  });
}

manifest.completedAt = new Date().toISOString();

// Portfolio analysis
console.log('\n=== Portfolio analysis ===');
let savings = 0,
  losses = 0,
  savingsTasks = [],
  lossTasks = [];
for (const t of manifest.perTask) {
  if (t.armA.firstAttemptPass) {
    // Saved: would have spent armB.tokens, instead spent ~0 frontier (just the routing overhead)
    const saved = t.armB.tokens;
    savings += saved;
    savingsTasks.push(`${t.id} (+${saved})`);
  } else {
    // Lost: still had to pay armB.tokens (frontier repair) on top of any local attempts
    losses += t.armB.tokens;
    lossTasks.push(`${t.id} (-${t.armB.tokens})`);
  }
}

const totalArmBTokens = manifest.perTask.reduce((a, t) => a + t.armB.tokens, 0);
const netSavings = savings - 0; // No additional cost to attempt local (just GPU time)
const portfolioFrontierOnlyCost = totalArmBTokens;

manifest.portfolio = {
  totalTasks: manifest.perTask.length,
  firstAttemptPass: manifest.perTask.filter((t) => t.armA.firstAttemptPass).length,
  anyPass: manifest.perTask.filter((t) => t.armA.anyPass).length,
  totalArmBTokens,
  tokensSavedWhenLocalPasses: savings,
  tokensStillSpentWhenLocalFails: losses,
  netFrontierTokenSavings: netSavings,
  savingsPercent: Math.round((savings / portfolioFrontierOnlyCost) * 100),
  savingsTasks,
  lossTasks,
};

console.log(
  `First-attempt local pass: ${manifest.portfolio.firstAttemptPass}/${manifest.portfolio.totalTasks}`,
);
console.log(
  `Any-of-${REPEATS} local pass: ${manifest.portfolio.anyPass}/${manifest.portfolio.totalTasks}`,
);
console.log(`Frontier-only baseline cost: ${totalArmBTokens} tiktoken-equiv tokens`);
console.log(
  `Tokens saved by hybrid (first-attempt only): ${savings} (${manifest.portfolio.savingsPercent}%)`,
);
console.log(`Tokens still spent by hybrid (failures): ${losses}`);
console.log(`Saved: ${savingsTasks.join(', ') || '(none)'}`);
console.log(`Failed (frontier still needed): ${lossTasks.join(', ') || '(none)'}`);

writeFileSync(join(RESULTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nManifest written to results/manifest.json`);
