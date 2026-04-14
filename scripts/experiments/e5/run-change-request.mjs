#!/usr/bin/env node
// E5 change-request invoker.
//
// Takes a stripped workspace + a single change-request ID, spawns a BLIND
// maintenance lane (cold-start codex session, no prior PL context), applies
// the change request prompt, re-runs the journey suite, and records:
//   - pass (boolean)          : journey suite gate after the change
//   - reworkCost              : summed git diff --stat additions+deletions +
//                               counts of modified/created/deleted files
//   - driftDelta              : journeyPassRate delta vs. pre-suite baseline
//
// Blinding discipline: the prompt fed to the maintenance lane MUST NOT
// mention prompt-language, .flow files, or factory-lane identity.

import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJourneySuite } from './run-journey-suite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const CR_DOC = join(
  repoRoot,
  'experiments',
  'results',
  'e5-maintenance',
  'harness',
  'change-requests.md',
);

// Blinded intros (do not mention PL or factory lanes).
const BLIND_INTRO =
  'You are receiving a codebase. Apply the attached change request. You may ' +
  'read any file you want. Your goal is to land the change with passing ' +
  'journey tests and minimal rework. Do not speculate about how this ' +
  'codebase was originally produced.';

function resolveCodexCommand() {
  const explicit = process.env.CODEX_BIN;
  if (explicit && existsSync(explicit)) return { command: explicit, args: [] };
  if (process.platform === 'win32') {
    const r = spawnSync('where.exe', ['codex.cmd'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const shim = (r.stdout || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (r.status === 0 && shim) {
      const dir = dirname(shim);
      const entry = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      const bundled = join(dir, 'node.exe');
      if (existsSync(entry)) {
        return { command: existsSync(bundled) ? bundled : process.execPath, args: [entry] };
      }
    }
    throw new Error('codex binary not found. Install codex or set CODEX_BIN.');
  }
  const w = spawnSync('which', ['codex'], { encoding: 'utf-8' });
  if (w.status === 0 && w.stdout.trim()) return { command: w.stdout.trim(), args: [] };
  throw new Error('codex binary not found on PATH. Install codex or set CODEX_BIN.');
}

export async function runChangeRequest({
  workspace,
  changeRequestId,
  model = 'gpt-5.2',
  budgetMin,
  baselineJourneyReport,
  resultsRoot,
} = {}) {
  if (!workspace) throw new Error('runChangeRequest: workspace is required');
  if (!existsSync(workspace)) throw new Error(`workspace missing: ${workspace}`);
  if (!changeRequestId) throw new Error('runChangeRequest: changeRequestId is required');
  if (!existsSync(CR_DOC)) throw new Error(`change-request suite missing: ${CR_DOC}`);

  const { intent, budgetFromDoc } = await loadChangeRequest(changeRequestId);
  const effectiveBudget = Number.isFinite(budgetMin) && budgetMin > 0 ? budgetMin : budgetFromDoc;

  const out = resultsRoot ?? join(workspace, '.e5-maint', changeRequestId);
  await mkdir(out, { recursive: true });

  const blindPrompt = buildBlindPrompt(changeRequestId, intent);
  await writeFile(join(out, 'prompt.md'), blindPrompt);
  assertBlindingClean(blindPrompt);

  // Record pre-change git baseline (if the workspace is a git repo).
  const preDiff = captureGitStatus(workspace);

  // Spawn the blind maintenance lane.
  const { command, args: prefixArgs } = resolveCodexCommand();
  const lastMsg = join(out, 'last-message.txt');
  const codexArgs = [
    ...prefixArgs,
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
    '--json',
    '--output-last-message',
    lastMsg,
    '-C',
    workspace,
    '--model',
    model,
    '-',
  ];
  const timeoutMs = Math.floor((effectiveBudget ?? 20) * 60_000);
  const started = Date.now();
  const run = await runWithTimeout(command, codexArgs, {
    cwd: workspace,
    input: blindPrompt,
    timeoutMs,
  });
  const wallClockSec = Math.round((Date.now() - started) / 1000);
  await writeFile(join(out, 'events.jsonl'), run.stdout || '(no stdout)\n');
  await writeFile(join(out, 'stderr.log'), run.stderr || '(no stderr)\n');

  // Re-run journey suite against modified workspace.
  const postReport = await runJourneySuite({
    workspace,
    reportPath: join(out, 'post-journey-report.json'),
  });

  // Rework accounting.
  const rework = captureGitDiffStat(workspace);

  // Drift delta: post vs pre journeyPassRate.
  let driftDelta = null;
  if (
    baselineJourneyReport &&
    typeof baselineJourneyReport.journeyPassRate === 'number' &&
    typeof postReport.journeyPassRate === 'number'
  ) {
    driftDelta = Number(
      (postReport.journeyPassRate - baselineJourneyReport.journeyPassRate).toFixed(3),
    );
  }

  const pass =
    postReport.gateStatus === 'passed' &&
    run.exitCode === 0 &&
    !run.timedOut;

  const result = {
    changeRequestId,
    workspace,
    model,
    budgetMin: effectiveBudget,
    wallClockSec,
    pass,
    gateStatus: postReport.gateStatus,
    exitCode: run.exitCode,
    timedOut: run.timedOut,
    reworkCost: rework,
    driftDelta,
    preGitStatus: preDiff,
    postJourneyReport: postReport,
    blindingChecks: {
      promptMentionsPromptLanguage: false,
      promptMentionsFlowFiles: false,
      promptMentionsFactoryLane: false,
    },
  };
  await writeFile(join(out, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

async function loadChangeRequest(id) {
  const text = await readFile(CR_DOC, 'utf8');
  // Find the section: ### <id> — ...
  const rx = new RegExp(`^###\\s+${id}\\b[\\s\\S]*?(?=^###\\s|^## |\\Z)`, 'm');
  const match = text.match(rx);
  if (!match) throw new Error(`change request ${id} not found in ${CR_DOC}`);
  const section = match[0];
  const intentMatch = section.match(/\*\*Intent\*\*[:\s]+"([\s\S]*?)"/);
  const intent = intentMatch ? intentMatch[1].trim() : '';
  const budgetMatch = section.match(/\*\*Budget\*\*[:\s]+(\d+)\s*minutes?/i);
  const budgetFromDoc = budgetMatch ? Number(budgetMatch[1]) : 20;
  if (!intent) throw new Error(`change request ${id} has no Intent block`);
  return { intent, budgetFromDoc };
}

function buildBlindPrompt(id, intent) {
  return [
    BLIND_INTRO,
    '',
    `Change request: ${id}`,
    '',
    `Intent: ${intent}`,
    '',
    'Constraints:',
    '- Keep existing behaviors working.',
    '- Update any documentation that would become misleading.',
    '- Do not rewrite unrelated files.',
    '',
  ].join('\n');
}

function assertBlindingClean(prompt) {
  const banned = [/prompt[- ]?language/i, /\.flow\b/i, /factory[- ]?lane/i, /\bpl-first\b/i];
  for (const rx of banned) {
    if (rx.test(prompt)) {
      throw new Error(
        `blinding violation: maintenance prompt contains banned phrase matching ${rx}. ` +
          'Refusing to send.',
      );
    }
  }
}

function captureGitStatus(workspace) {
  const r = spawnSync('git', ['status', '--porcelain'], {
    cwd: workspace,
    encoding: 'utf-8',
    windowsHide: true,
  });
  return r.status === 0 ? r.stdout : null;
}

function captureGitDiffStat(workspace) {
  // Use `git diff --numstat HEAD` to get additions/deletions per file.
  const r = spawnSync('git', ['diff', '--numstat', 'HEAD'], {
    cwd: workspace,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    return {
      linesOfCodeTouched: null,
      filesModified: null,
      filesCreated: null,
      filesDeleted: null,
      artifactsRewritten: null,
      totalReworkUnits: null,
      raw: '(git not available or not a repo)',
    };
  }
  let adds = 0;
  let dels = 0;
  let filesModified = 0;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [a, d] = line.split(/\s+/);
    adds += Number(a) || 0;
    dels += Number(d) || 0;
    filesModified += 1;
  }
  // Untracked files = "created"
  const st = spawnSync('git', ['status', '--porcelain'], {
    cwd: workspace,
    encoding: 'utf-8',
    windowsHide: true,
  });
  let filesCreated = 0;
  let filesDeleted = 0;
  if (st.status === 0) {
    for (const line of st.stdout.split(/\r?\n/)) {
      if (line.startsWith('??')) filesCreated += 1;
      if (line.startsWith(' D') || line.startsWith('D ')) filesDeleted += 1;
    }
  }
  return {
    linesOfCodeTouched: adds + dels,
    filesModified,
    filesCreated,
    filesDeleted,
    artifactsRewritten: null,
    totalReworkUnits: adds + dels + filesCreated + filesDeleted,
    raw: r.stdout,
  };
}

function runWithTimeout(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    if (typeof input === 'string' && child.stdin.writable) child.stdin.write(input);
    if (child.stdin.writable) child.stdin.end();
    const to = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);
    child.once('error', (err) => {
      clearTimeout(to);
      reject(err);
    });
    child.once('close', (code) => {
      clearTimeout(to);
      resolvePromise({ exitCode: code ?? (timedOut ? 124 : 1), stdout, stderr, timedOut });
    });
  });
}

if (process.argv[1]?.endsWith('run-change-request.mjs')) {
  const args = parseFlags(process.argv.slice(2));
  try {
    const out = await runChangeRequest({
      workspace: args.workspace,
      changeRequestId: args.cr ?? args.id,
      model: args.model,
      budgetMin: args.budgetMin ? Number(args.budgetMin) : undefined,
      resultsRoot: args.resultsRoot,
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`[run-change-request] ${err.message}\n`);
    process.exit(1);
  }
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
