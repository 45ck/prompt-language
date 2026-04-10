import { execSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type EvalCandidate = 'gated' | 'vanilla';

export interface EvalDatasetCase {
  readonly id: string;
  readonly fixture: string;
  readonly inputType: 'prompt' | 'flow';
  readonly inputFile: string;
  readonly verify: string;
  readonly gates?: readonly string[] | undefined;
}

export interface EvalCaseResult {
  readonly caseId: string;
  readonly repeat: number;
  readonly candidate: EvalCandidate;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly harnessOutput?: string | undefined;
  readonly verifyStdout?: string | undefined;
  readonly verifyStderr?: string | undefined;
  readonly error?: string | undefined;
}

export interface EvalReportSummary {
  readonly totalRuns: number;
  readonly passedRuns: number;
  readonly failedRuns: number;
  readonly passRate: number;
  readonly averageDurationMs: number;
}

export interface EvalReportComparison {
  readonly baselineCandidate: string;
  readonly candidatePassRate: number;
  readonly baselinePassRate: number;
  readonly passRateDelta: number;
  readonly candidateWins: number;
  readonly baselineWins: number;
  readonly ties: number;
  readonly winner: 'candidate' | 'baseline' | 'tie';
}

export interface EvalRunReport {
  readonly schemaVersion: 1;
  readonly kind: 'prompt-language-eval-report';
  readonly generatedAt: string;
  readonly datasetPath: string;
  readonly datasetName: string;
  readonly harness: string;
  readonly candidate: EvalCandidate;
  readonly repeat: number;
  readonly model?: string | undefined;
  readonly summary: EvalReportSummary;
  readonly cases: readonly EvalCaseResult[];
  readonly comparison?: EvalReportComparison | undefined;
}

export interface RunEvalDatasetOptions {
  readonly candidate?: EvalCandidate | undefined;
  readonly datasetPath: string;
  readonly repeat?: number | undefined;
  readonly model?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly baselineReport?: EvalRunReport | undefined;
  readonly outputPath?: string | undefined;
}

interface PreparedWorkspace {
  readonly cwd: string;
  cleanup(): Promise<void>;
}

interface VerifyResult {
  readonly passed: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

interface DatasetRunnerDeps {
  now(): number;
  getHarnessName(): Promise<string>;
  prepareWorkspace(
    caseSpec: EvalDatasetCase,
    datasetDir: string,
    repeat: number,
  ): Promise<PreparedWorkspace>;
  loadInputText(caseSpec: EvalDatasetCase, workspace: PreparedWorkspace): Promise<string>;
  runPrompt(
    prompt: string,
    options: {
      readonly cwd: string;
      readonly model?: string | undefined;
      readonly timeoutMs: number;
    },
  ): Promise<string>;
  runFlow(
    flowText: string,
    options: {
      readonly cwd: string;
      readonly model?: string | undefined;
      readonly timeoutMs: number;
    },
  ): Promise<string>;
  verifyWorkspace(caseSpec: EvalDatasetCase, workspace: PreparedWorkspace): Promise<VerifyResult>;
  writeReport?(outputPath: string, report: EvalRunReport): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_VERIFY_TIMEOUT_MS = 30_000;
const DEFAULT_REPEAT = 1;

let harnessModulePromise:
  | Promise<{
      readonly getHarnessName: () => string;
      readonly runHarnessPrompt: (
        prompt: string,
        options: {
          readonly cwd?: string;
          readonly timeout?: number;
          readonly model?: string;
          readonly strict?: boolean;
        },
      ) => string;
      readonly runHarnessFlow: (
        flowText: string,
        options: {
          readonly cwd?: string;
          readonly timeout?: number;
          readonly model?: string;
          readonly strict?: boolean;
        },
      ) => string;
    }>
  | undefined;

function sanitizeSegment(value: string): string {
  return value
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function isEvalCandidate(value: string): value is EvalCandidate {
  return value === 'gated' || value === 'vanilla';
}

function normalizeGates(gates: unknown): readonly string[] | undefined {
  if (!Array.isArray(gates)) return undefined;
  const normalized = gates
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCandidate(candidate?: EvalCandidate): EvalCandidate {
  return candidate ?? 'gated';
}

function normalizeRepeatCount(repeat?: number): number {
  if (repeat == null) return DEFAULT_REPEAT;
  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new Error('Eval repeat must be a positive integer.');
  }
  return repeat;
}

export function parseEvalDatasetJsonl(text: string): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [];
  const seenIds = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(
        `Invalid JSON on dataset line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Dataset line ${index + 1} must be a JSON object.`);
    }

    const candidate = parsed as Record<string, unknown>;
    const id = typeof candidate['id'] === 'string' ? candidate['id'].trim() : '';
    const fixture = typeof candidate['fixture'] === 'string' ? candidate['fixture'].trim() : '';
    const inputTypeRaw =
      typeof candidate['input_type'] === 'string'
        ? candidate['input_type'].trim().toLowerCase()
        : '';
    const inputFile =
      typeof candidate['input_file'] === 'string' ? candidate['input_file'].trim() : '';
    const verify =
      typeof candidate['verify'] === 'string' ? candidate['verify'].trim() : 'node test.js';

    if (id.length === 0) throw new Error(`Dataset line ${index + 1} is missing "id".`);
    if (fixture.length === 0) throw new Error(`Dataset line ${index + 1} is missing "fixture".`);
    if (inputTypeRaw !== 'prompt' && inputTypeRaw !== 'flow') {
      throw new Error(`Dataset line ${index + 1} must use input_type "prompt" or "flow".`);
    }
    if (inputFile.length === 0) {
      throw new Error(`Dataset line ${index + 1} is missing "input_file".`);
    }
    if (verify.length === 0) throw new Error(`Dataset line ${index + 1} is missing "verify".`);
    if (seenIds.has(id)) {
      throw new Error(`Dataset line ${index + 1} uses duplicate id "${id}".`);
    }
    seenIds.add(id);

    const gates = normalizeGates(candidate['gates']);

    cases.push({
      id,
      fixture,
      inputType: inputTypeRaw,
      inputFile,
      verify,
      ...(gates != null ? { gates } : {}),
    });
  }

  if (cases.length === 0) {
    throw new Error('Dataset is empty.');
  }

  return cases;
}

export function buildCandidateInput(
  caseSpec: EvalDatasetCase,
  sourceText: string,
  candidate: EvalCandidate,
): string {
  if (caseSpec.inputType === 'flow') return sourceText;
  if (candidate !== 'gated') {
    return sourceText;
  }

  const promptText = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ');
  const flowLines = [`Goal: eval ${caseSpec.id}`, '', 'flow:', `  prompt: ${promptText}`];

  if (caseSpec.gates != null && caseSpec.gates.length > 0) {
    flowLines.push('', 'done when:');
    for (const gate of caseSpec.gates) {
      flowLines.push(`  ${gate}`);
    }
  }

  return `${flowLines.join('\n')}\n`;
}

function averageDuration(results: readonly EvalCaseResult[]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, result) => sum + result.durationMs, 0);
  return total / results.length;
}

function summarizeResults(results: readonly EvalCaseResult[]): EvalReportSummary {
  const passedRuns = results.filter((result) => result.passed).length;
  const totalRuns = results.length;
  const failedRuns = totalRuns - passedRuns;
  return {
    totalRuns,
    passedRuns,
    failedRuns,
    passRate: totalRuns === 0 ? 0 : passedRuns / totalRuns,
    averageDurationMs: averageDuration(results),
  };
}

function summarizeByCase(results: readonly EvalCaseResult[]): Map<string, number> {
  const summary = new Map<string, { passed: number; total: number }>();
  for (const result of results) {
    const existing = summary.get(result.caseId) ?? { passed: 0, total: 0 };
    existing.total += 1;
    if (result.passed) existing.passed += 1;
    summary.set(result.caseId, existing);
  }

  return new Map(
    [...summary.entries()].map(([caseId, value]) => [
      caseId,
      value.total === 0 ? 0 : value.passed / value.total,
    ]),
  );
}

function summarizeCaseIds(report: EvalRunReport): string[] {
  return [...new Set(report.cases.map((result) => result.caseId))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function assertComparableBaseline(candidate: EvalRunReport, baseline: EvalRunReport): void {
  if (candidate.kind !== baseline.kind || candidate.schemaVersion !== baseline.schemaVersion) {
    throw new Error('Baseline report is not a compatible prompt-language eval report.');
  }

  if (candidate.datasetName !== baseline.datasetName) {
    throw new Error(
      `Baseline dataset "${baseline.datasetName}" does not match candidate dataset "${candidate.datasetName}".`,
    );
  }

  const candidateCaseIds = summarizeCaseIds(candidate);
  const baselineCaseIds = summarizeCaseIds(baseline);
  if (
    candidateCaseIds.length !== baselineCaseIds.length ||
    candidateCaseIds.some((caseId, index) => caseId !== baselineCaseIds[index])
  ) {
    throw new Error('Baseline report cases do not match the current dataset.');
  }
}

export function compareEvalReports(
  candidate: EvalRunReport,
  baseline: EvalRunReport,
): EvalReportComparison {
  const candidateRates = summarizeByCase(candidate.cases);
  const baselineRates = summarizeByCase(baseline.cases);
  const caseIds = new Set([...candidateRates.keys(), ...baselineRates.keys()]);
  let candidateWins = 0;
  let baselineWins = 0;
  let ties = 0;

  for (const caseId of caseIds) {
    const candidateRate = candidateRates.get(caseId) ?? 0;
    const baselineRate = baselineRates.get(caseId) ?? 0;
    if (candidateRate > baselineRate) {
      candidateWins += 1;
    } else if (baselineRate > candidateRate) {
      baselineWins += 1;
    } else {
      ties += 1;
    }
  }

  const passRateDelta = candidate.summary.passRate - baseline.summary.passRate;
  const winner =
    candidateWins > baselineWins ? 'candidate' : baselineWins > candidateWins ? 'baseline' : 'tie';

  return {
    baselineCandidate: baseline.candidate,
    candidatePassRate: candidate.summary.passRate,
    baselinePassRate: baseline.summary.passRate,
    passRateDelta,
    candidateWins,
    baselineWins,
    ties,
    winner,
  };
}

async function loadHarnessModule() {
  harnessModulePromise ??= import(
    pathToFileURL(join(import.meta.dirname, '..', '..', '..', 'scripts', 'eval', 'harness.mjs'))
      .href
  );
  return harnessModulePromise;
}

async function createDefaultDeps(): Promise<DatasetRunnerDeps> {
  const harness = await loadHarnessModule();

  return {
    now: () => Date.now(),
    getHarnessName: async () => harness.getHarnessName(),
    prepareWorkspace: async (caseSpec, datasetDir, repeat) => {
      const fixturePath = resolve(datasetDir, caseSpec.fixture);
      const workspace = await mkdtemp(
        join(tmpdir(), `pl-eval-${sanitizeSegment(caseSpec.id)}-${repeat + 1}-`),
      );
      await cp(fixturePath, workspace, { recursive: true });
      return {
        cwd: workspace,
        cleanup: async () => {
          await rm(workspace, { recursive: true, force: true });
        },
      };
    },
    loadInputText: async (caseSpec, workspace) =>
      readFile(join(workspace.cwd, caseSpec.inputFile), 'utf8'),
    runPrompt: async (prompt, options) =>
      harness.runHarnessPrompt(prompt, {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        ...(options.model != null ? { model: options.model } : {}),
        strict: true,
      }),
    runFlow: async (flowText, options) =>
      harness.runHarnessFlow(flowText, {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        ...(options.model != null ? { model: options.model } : {}),
        strict: true,
      }),
    verifyWorkspace: async (caseSpec, workspace) => {
      try {
        const stdout = execSync(caseSpec.verify, {
          cwd: workspace.cwd,
          encoding: 'utf8',
          timeout: DEFAULT_VERIFY_TIMEOUT_MS,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { passed: true, stdout, stderr: '' };
      } catch (error) {
        const execError = error as { stdout?: unknown; stderr?: unknown };
        return {
          passed: false,
          stdout: typeof execError.stdout === 'string' ? execError.stdout : '',
          stderr: typeof execError.stderr === 'string' ? execError.stderr : '',
        };
      }
    },
    writeReport: async (outputPath, report) => {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    },
  };
}

export async function runEvalDataset(
  cases: readonly EvalDatasetCase[],
  options: RunEvalDatasetOptions,
  deps?: Partial<DatasetRunnerDeps>,
): Promise<EvalRunReport> {
  const datasetDir = dirname(resolve(options.datasetPath));
  const repeat = normalizeRepeatCount(options.repeat);
  const candidate = normalizeCandidate(options.candidate);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolvedDeps = { ...(await createDefaultDeps()), ...(deps ?? {}) } as DatasetRunnerDeps;
  const caseResults: EvalCaseResult[] = [];

  for (const caseSpec of cases) {
    for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
      const workspace = await resolvedDeps.prepareWorkspace(caseSpec, datasetDir, repeatIndex);
      const startedAt = resolvedDeps.now();
      try {
        const sourceText = await resolvedDeps.loadInputText(caseSpec, workspace);
        const candidateInput = buildCandidateInput(caseSpec, sourceText, candidate);
        const shouldRunFlow = caseSpec.inputType === 'flow' || candidate === 'gated';
        const harnessOutput = shouldRunFlow
          ? await resolvedDeps.runFlow(candidateInput, {
              cwd: workspace.cwd,
              ...(options.model != null ? { model: options.model } : {}),
              timeoutMs,
            })
          : await resolvedDeps.runPrompt(candidateInput, {
              cwd: workspace.cwd,
              ...(options.model != null ? { model: options.model } : {}),
              timeoutMs,
            });
        const verify = await resolvedDeps.verifyWorkspace(caseSpec, workspace);
        caseResults.push({
          caseId: caseSpec.id,
          repeat: repeatIndex + 1,
          candidate,
          passed: verify.passed,
          durationMs: resolvedDeps.now() - startedAt,
          harnessOutput,
          verifyStdout: verify.stdout,
          verifyStderr: verify.stderr,
        });
      } catch (error) {
        caseResults.push({
          caseId: caseSpec.id,
          repeat: repeatIndex + 1,
          candidate,
          passed: false,
          durationMs: resolvedDeps.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        try {
          await workspace.cleanup();
        } catch {
          // Best-effort temp workspace cleanup. Do not discard run evidence because
          // Windows is still releasing a handle in the background.
        }
      }
    }
  }

  const report: EvalRunReport = {
    schemaVersion: 1,
    kind: 'prompt-language-eval-report',
    generatedAt: new Date().toISOString(),
    datasetPath: resolve(options.datasetPath),
    datasetName: basename(options.datasetPath),
    harness: await resolvedDeps.getHarnessName(),
    candidate,
    repeat,
    ...(options.model != null ? { model: options.model } : {}),
    summary: summarizeResults(caseResults),
    cases: caseResults,
  };

  const comparison =
    options.baselineReport != null
      ? (assertComparableBaseline(report, options.baselineReport),
        compareEvalReports(report, options.baselineReport))
      : undefined;
  const finalReport =
    comparison != null
      ? {
          ...report,
          comparison,
        }
      : report;

  if (options.outputPath != null && resolvedDeps.writeReport) {
    await resolvedDeps.writeReport(options.outputPath, finalReport);
  }

  return finalReport;
}

export async function runEvalDatasetFromFile(
  datasetPath: string,
  options: Omit<RunEvalDatasetOptions, 'datasetPath'> = {},
  deps?: Partial<DatasetRunnerDeps>,
): Promise<EvalRunReport> {
  const datasetText = await readFile(datasetPath, 'utf8');
  const cases = parseEvalDatasetJsonl(datasetText);
  return runEvalDataset(cases, { ...options, datasetPath }, deps);
}

export async function readEvalReport(reportPath: string): Promise<EvalRunReport> {
  return JSON.parse(await readFile(reportPath, 'utf8')) as EvalRunReport;
}
