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
  readonly runId?: string | undefined;
  readonly verifyExitCode?: number | undefined;
  readonly regressionClassification?: EvalRegressionClassification | undefined;
  readonly baselineRunId?: string | undefined;
  readonly replay?: EvalReplayHandle | undefined;
  readonly artifacts?: EvalCaseArtifacts | undefined;
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

export type EvalRunStatus = 'passed' | 'failed' | 'blocked';

export type EvalRegressionClassification =
  | 'product_regression'
  | 'environment_blocker'
  | 'not_applicable';

export type EvalReplayMode = 'rerun_from_dataset' | 'rerun_with_fixture_snapshot' | 'evidence_only';

export interface EvalReplayHandle {
  readonly mode: EvalReplayMode;
  readonly runId: string;
  readonly datasetPath: string;
  readonly caseId: string;
  readonly candidate: EvalCandidate;
  readonly harness: string;
  readonly repeat: number;
  readonly model?: string | undefined;
  readonly commit?: string | undefined;
  readonly limitations: readonly string[];
}

export interface EvalCaseArtifacts {
  readonly bundlePath: string;
  readonly transcriptPath: string | null;
  readonly verifyStdoutPath: string | null;
  readonly verifyStderrPath: string | null;
  readonly errorPath: string | null;
  readonly annotationPath: string | null;
}

export interface EvalArtifactBundle {
  readonly schemaVersion: 1;
  readonly kind: 'prompt-language-eval-artifact-bundle';
  readonly runId: string;
  readonly generatedAt: string;
  readonly dataset: {
    readonly path: string;
    readonly name: string;
    readonly caseId: string;
    readonly inputFile: string;
    readonly verify: string;
  };
  readonly execution: {
    readonly candidate: EvalCandidate;
    readonly harness: string;
    readonly model?: string | undefined;
    readonly repeat: number;
    readonly commit?: string | undefined;
    readonly host: {
      readonly os: string;
      readonly shell?: string | undefined;
    };
    readonly status: EvalRunStatus;
    readonly regressionClassification: EvalRegressionClassification;
    readonly durationMs: number;
  };
  readonly artifacts: EvalCaseArtifacts;
  readonly summary: {
    readonly passed: boolean;
    readonly verifyExitCode: number | null;
  };
  readonly replay: EvalReplayHandle;
}

export interface EvalResolvedRun {
  readonly runId: string;
  readonly datasetPath: string;
  readonly datasetName: string;
  readonly caseId: string;
  readonly candidate: EvalCandidate;
  readonly harness: string;
  readonly repeat: number;
  readonly model?: string | undefined;
  readonly baselineRunId?: string | undefined;
  readonly replay?: EvalReplayHandle | undefined;
  readonly artifacts?: EvalCaseArtifacts | undefined;
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
  readonly exitCode?: number | undefined;
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
const EVAL_ARTIFACT_BUNDLE_KIND = 'prompt-language-eval-artifact-bundle';
const RUNS_DIRECTORY = 'runs';

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

function stripExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.');
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
}

function toRunIdTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/[:.]/g, '-');
}

function buildEvalRunId(input: {
  readonly datasetName: string;
  readonly caseId: string;
  readonly harness: string;
  readonly candidate: EvalCandidate;
  readonly repeat: number;
  readonly generatedAt: string;
}): string {
  return [
    'eval',
    sanitizeSegment(stripExtension(input.datasetName)),
    sanitizeSegment(input.caseId),
    sanitizeSegment(input.harness),
    input.candidate,
    `r${input.repeat}`,
    toRunIdTimestamp(input.generatedAt),
  ].join('.');
}

function getHostShell(): string | undefined {
  const shell = process.env['SHELL'] ?? process.env['ComSpec'];
  return typeof shell === 'string' && shell.trim().length > 0 ? shell : undefined;
}

function getCurrentGitCommit(): string | undefined {
  try {
    const commit = execSync('git rev-parse --short HEAD', {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return commit.length > 0 ? commit : undefined;
  } catch {
    return undefined;
  }
}

function makeBaselineCaseKey(caseId: string, repeat: number): string {
  return `${caseId}\u0000${repeat}`;
}

function indexBaselineCases(
  baselineReport: EvalRunReport | undefined,
): Map<string, EvalCaseResult> {
  if (baselineReport == null) return new Map();
  return new Map(
    baselineReport.cases.map((caseResult) => [
      makeBaselineCaseKey(caseResult.caseId, caseResult.repeat),
      caseResult,
    ]),
  );
}

function classifyRegression(
  result: Pick<EvalCaseResult, 'passed'>,
  baselineResult: EvalCaseResult | undefined,
): EvalRegressionClassification {
  if (baselineResult == null) return 'not_applicable';
  if (baselineResult.passed && !result.passed) {
    return 'product_regression';
  }
  return 'not_applicable';
}

function determineReplayMode(
  result: Pick<EvalCaseResult, 'error'>,
  regressionClassification: EvalRegressionClassification,
): EvalReplayMode {
  if (regressionClassification === 'environment_blocker') {
    return 'evidence_only';
  }
  if (result.error != null && /blocked/i.test(result.error)) {
    return 'evidence_only';
  }
  return 'rerun_from_dataset';
}

function buildReplayLimitations(result: Pick<EvalCaseResult, 'error'>): readonly string[] {
  return [
    'Replays rerun the checked-in dataset row and verify command; they do not reproduce model output deterministically.',
    ...(result.error != null
      ? ['Original run captured a terminal error instead of a full successful harness transcript.']
      : []),
  ];
}

function buildCaseArtifacts(
  outputPath: string,
  runId: string,
  result: {
    readonly harnessOutput?: string | undefined;
    readonly verifyStdout?: string | undefined;
    readonly verifyStderr?: string | undefined;
    readonly error?: string | undefined;
  },
): EvalCaseArtifacts {
  const runDirectory = join(dirname(resolve(outputPath)), RUNS_DIRECTORY, runId);
  return {
    bundlePath: join(runDirectory, 'manifest.json'),
    transcriptPath:
      result.harnessOutput != null && result.harnessOutput.length > 0
        ? join(runDirectory, 'transcript.md')
        : null,
    verifyStdoutPath:
      result.verifyStdout != null && result.verifyStdout.length > 0
        ? join(runDirectory, 'verify.stdout.txt')
        : null,
    verifyStderrPath:
      result.verifyStderr != null && result.verifyStderr.length > 0
        ? join(runDirectory, 'verify.stderr.txt')
        : null,
    errorPath:
      result.error != null && result.error.length > 0 ? join(runDirectory, 'error.txt') : null,
    annotationPath: null,
  };
}

function buildReplayHandle(input: {
  readonly runId: string;
  readonly datasetPath: string;
  readonly caseId: string;
  readonly candidate: EvalCandidate;
  readonly harness: string;
  readonly repeat: number;
  readonly model?: string | undefined;
  readonly commit?: string | undefined;
  readonly result: Pick<EvalCaseResult, 'error'>;
  readonly regressionClassification: EvalRegressionClassification;
}): EvalReplayHandle {
  return {
    mode: determineReplayMode(input.result, input.regressionClassification),
    runId: input.runId,
    datasetPath: input.datasetPath,
    caseId: input.caseId,
    candidate: input.candidate,
    harness: input.harness,
    repeat: input.repeat,
    ...(input.model != null ? { model: input.model } : {}),
    ...(input.commit != null ? { commit: input.commit } : {}),
    limitations: buildReplayLimitations(input.result),
  };
}

function determineRunStatus(result: Pick<EvalCaseResult, 'passed' | 'error'>): EvalRunStatus {
  if (result.passed) return 'passed';
  return result.error != null && /blocked/i.test(result.error) ? 'blocked' : 'failed';
}

interface EvalArtifactBundleDraft {
  readonly generatedAt: string;
  readonly caseSpec: EvalDatasetCase;
  readonly result: EvalCaseResult;
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
        return { passed: true, stdout, stderr: '', exitCode: 0 };
      } catch (error) {
        const execError = error as { stdout?: unknown; stderr?: unknown; status?: unknown };
        return {
          passed: false,
          stdout: typeof execError.stdout === 'string' ? execError.stdout : '',
          stderr: typeof execError.stderr === 'string' ? execError.stderr : '',
          exitCode: typeof execError.status === 'number' ? execError.status : undefined,
        };
      }
    },
    writeReport: async (outputPath, report) => {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    },
  };
}

async function writeArtifactContent(
  path: string | null,
  content: string | undefined,
): Promise<void> {
  if (path == null || content == null || content.length === 0) return;
  await writeFile(path, content, 'utf8');
}

function createArtifactBundle(input: {
  readonly datasetPath: string;
  readonly datasetName: string;
  readonly harness: string;
  readonly model?: string | undefined;
  readonly commit?: string | undefined;
  readonly draft: EvalArtifactBundleDraft;
}): EvalArtifactBundle {
  const { caseSpec, generatedAt, result } = input.draft;
  const artifacts = result.artifacts;
  if (artifacts == null) {
    throw new Error(
      `Cannot create an eval artifact bundle for run ${result.runId ?? '<unknown>'}.`,
    );
  }

  return {
    schemaVersion: 1,
    kind: EVAL_ARTIFACT_BUNDLE_KIND,
    runId: result.runId ?? '',
    generatedAt,
    dataset: {
      path: input.datasetPath,
      name: input.datasetName,
      caseId: caseSpec.id,
      inputFile: caseSpec.inputFile,
      verify: caseSpec.verify,
    },
    execution: {
      candidate: result.candidate,
      harness: input.harness,
      ...(input.model != null ? { model: input.model } : {}),
      repeat: result.repeat,
      ...(input.commit != null ? { commit: input.commit } : {}),
      host: {
        os: process.platform,
        ...(getHostShell() != null ? { shell: getHostShell() } : {}),
      },
      status: determineRunStatus(result),
      regressionClassification: result.regressionClassification ?? 'not_applicable',
      durationMs: result.durationMs,
    },
    artifacts,
    summary: {
      passed: result.passed,
      verifyExitCode: result.verifyExitCode ?? null,
    },
    replay:
      result.replay ??
      buildReplayHandle({
        runId: result.runId ?? '',
        datasetPath: input.datasetPath,
        caseId: caseSpec.id,
        candidate: result.candidate,
        harness: input.harness,
        repeat: result.repeat,
        ...(input.model != null ? { model: input.model } : {}),
        ...(input.commit != null ? { commit: input.commit } : {}),
        result,
        regressionClassification: result.regressionClassification ?? 'not_applicable',
      }),
  };
}

async function writeEvalArtifactBundles(input: {
  readonly datasetPath: string;
  readonly datasetName: string;
  readonly harness: string;
  readonly model?: string | undefined;
  readonly commit?: string | undefined;
  readonly drafts: readonly EvalArtifactBundleDraft[];
}): Promise<void> {
  for (const draft of input.drafts) {
    const artifacts = draft.result.artifacts;
    if (artifacts == null) continue;

    await mkdir(dirname(artifacts.bundlePath), { recursive: true });
    await writeArtifactContent(artifacts.transcriptPath, draft.result.harnessOutput);
    await writeArtifactContent(artifacts.verifyStdoutPath, draft.result.verifyStdout);
    await writeArtifactContent(artifacts.verifyStderrPath, draft.result.verifyStderr);
    await writeArtifactContent(artifacts.errorPath, draft.result.error);

    const manifest = createArtifactBundle({
      datasetPath: input.datasetPath,
      datasetName: input.datasetName,
      harness: input.harness,
      ...(input.model != null ? { model: input.model } : {}),
      ...(input.commit != null ? { commit: input.commit } : {}),
      draft,
    });
    await writeFile(artifacts.bundlePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
}

export async function runEvalDataset(
  cases: readonly EvalDatasetCase[],
  options: RunEvalDatasetOptions,
  deps?: Partial<DatasetRunnerDeps>,
): Promise<EvalRunReport> {
  const datasetPath = resolve(options.datasetPath);
  const datasetDir = dirname(datasetPath);
  const datasetName = basename(options.datasetPath);
  const repeat = normalizeRepeatCount(options.repeat);
  const candidate = normalizeCandidate(options.candidate);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolvedDeps = { ...(await createDefaultDeps()), ...(deps ?? {}) } as DatasetRunnerDeps;
  const harness = await resolvedDeps.getHarnessName();
  const reportGeneratedAt = new Date().toISOString();
  const baselineCaseIndex = indexBaselineCases(options.baselineReport);
  const commit = getCurrentGitCommit();
  const caseResults: EvalCaseResult[] = [];
  const artifactBundleDrafts: EvalArtifactBundleDraft[] = [];

  for (const caseSpec of cases) {
    for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
      const workspace = await resolvedDeps.prepareWorkspace(caseSpec, datasetDir, repeatIndex);
      const startedAt = resolvedDeps.now();
      const runId = buildEvalRunId({
        datasetName,
        caseId: caseSpec.id,
        harness,
        candidate,
        repeat: repeatIndex + 1,
        generatedAt: reportGeneratedAt,
      });
      const baselineCase = baselineCaseIndex.get(makeBaselineCaseKey(caseSpec.id, repeatIndex + 1));
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
        const result: EvalCaseResult = {
          caseId: caseSpec.id,
          repeat: repeatIndex + 1,
          candidate,
          passed: verify.passed,
          durationMs: resolvedDeps.now() - startedAt,
          runId,
          verifyExitCode: verify.exitCode ?? (verify.passed ? 0 : undefined),
          regressionClassification: classifyRegression({ passed: verify.passed }, baselineCase),
          ...(baselineCase?.runId != null ? { baselineRunId: baselineCase.runId } : {}),
          replay: buildReplayHandle({
            runId,
            datasetPath,
            caseId: caseSpec.id,
            candidate,
            harness,
            repeat: repeatIndex + 1,
            ...(options.model != null ? { model: options.model } : {}),
            ...(commit != null ? { commit } : {}),
            result: { error: undefined },
            regressionClassification: classifyRegression({ passed: verify.passed }, baselineCase),
          }),
          ...(options.outputPath != null
            ? {
                artifacts: buildCaseArtifacts(options.outputPath, runId, {
                  harnessOutput,
                  verifyStdout: verify.stdout,
                  verifyStderr: verify.stderr,
                }),
              }
            : {}),
          harnessOutput,
          verifyStdout: verify.stdout,
          verifyStderr: verify.stderr,
        };
        caseResults.push(result);
        artifactBundleDrafts.push({
          generatedAt: reportGeneratedAt,
          caseSpec,
          result,
        });
      } catch (error) {
        const result: EvalCaseResult = {
          caseId: caseSpec.id,
          repeat: repeatIndex + 1,
          candidate,
          passed: false,
          durationMs: resolvedDeps.now() - startedAt,
          runId,
          regressionClassification: classifyRegression({ passed: false }, baselineCase),
          ...(baselineCase?.runId != null ? { baselineRunId: baselineCase.runId } : {}),
          replay: buildReplayHandle({
            runId,
            datasetPath,
            caseId: caseSpec.id,
            candidate,
            harness,
            repeat: repeatIndex + 1,
            ...(options.model != null ? { model: options.model } : {}),
            ...(commit != null ? { commit } : {}),
            result: {
              error: error instanceof Error ? error.message : String(error),
            },
            regressionClassification: classifyRegression({ passed: false }, baselineCase),
          }),
          ...(options.outputPath != null
            ? {
                artifacts: buildCaseArtifacts(options.outputPath, runId, {
                  error: error instanceof Error ? error.message : String(error),
                }),
              }
            : {}),
          error: error instanceof Error ? error.message : String(error),
        };
        caseResults.push(result);
        artifactBundleDrafts.push({
          generatedAt: reportGeneratedAt,
          caseSpec,
          result,
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
    generatedAt: reportGeneratedAt,
    datasetPath,
    datasetName,
    harness,
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
    await writeEvalArtifactBundles({
      datasetPath,
      datasetName,
      harness,
      ...(options.model != null ? { model: options.model } : {}),
      ...(commit != null ? { commit } : {}),
      drafts: artifactBundleDrafts,
    });
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

export async function readEvalArtifactBundle(bundlePath: string): Promise<EvalArtifactBundle> {
  return JSON.parse(await readFile(bundlePath, 'utf8')) as EvalArtifactBundle;
}

export function resolveEvalRunById(
  report: EvalRunReport,
  runId: string,
): EvalResolvedRun | undefined {
  const caseResult = report.cases.find((candidateCase) => candidateCase.runId === runId);
  if (caseResult == null) return undefined;
  return {
    runId,
    datasetPath: report.datasetPath,
    datasetName: report.datasetName,
    caseId: caseResult.caseId,
    candidate: caseResult.candidate,
    harness: report.harness,
    repeat: caseResult.repeat,
    ...(report.model != null ? { model: report.model } : {}),
    ...(caseResult.baselineRunId != null ? { baselineRunId: caseResult.baselineRunId } : {}),
    ...(caseResult.replay != null ? { replay: caseResult.replay } : {}),
    ...(caseResult.artifacts != null ? { artifacts: caseResult.artifacts } : {}),
  };
}
