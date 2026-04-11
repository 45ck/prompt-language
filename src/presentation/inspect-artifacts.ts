import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, join, posix, relative, resolve } from 'node:path';
import { z } from 'zod';

const DEFAULT_ARTIFACT_ROOT = 'artifacts';
const MANIFEST_FILE_NAME = 'manifest.json';
const CONTENT_FILE_PATH = 'content/source.json';
const RELATIVE_PATH_RE = /^(content|views|exports|attachments)\/.+$/;
const REGISTERED_PATH_PREFIXES = ['content', 'views', 'exports', 'attachments'] as const;
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git',
  '.prompt-language',
  'coverage',
  'dist',
  'node_modules',
]);

function isSafeRegisteredRelativePath(path: string): boolean {
  if (!RELATIVE_PATH_RE.test(path) || path.includes('\\')) {
    return false;
  }
  const normalized = posix.normalize(path);
  if (normalized !== path) {
    return false;
  }
  const resolved = posix.resolve('/', path);
  return REGISTERED_PATH_PREFIXES.some((prefix) => resolved.startsWith(`/${prefix}/`));
}

const registeredRelativePathSchema = z.string().refine(isSafeRegisteredRelativePath, {
  message:
    'Path must stay within the artifact package root under content/, views/, exports/, or attachments/.',
});

const artifactManifestSchema = z.strictObject({
  manifestVersion: z.number().int().min(1),
  artifactId: z.string().min(1),
  artifactType: z.string().min(1),
  artifactSchemaVersion: z.number().int().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(['draft', 'active', 'superseded', 'archived']),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  producer: z.strictObject({
    kind: z.enum(['flow', 'runtime', 'host_integration', 'tool']),
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  origin: z.strictObject({
    runId: z.string().min(1),
    flowNode: z.string().min(1),
    phase: z.string().min(1),
  }),
  declarationRef: z.string().min(1),
  content: z.strictObject({
    path: z.literal(CONTENT_FILE_PATH),
    mediaType: z.literal('application/json'),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  views: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        path: registeredRelativePathSchema,
        mediaType: z.string().min(1),
        renderer: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1),
  attachments: z.array(
    z.strictObject({
      name: z.string().min(1),
      path: registeredRelativePathSchema,
      mediaType: z.string().min(1),
      role: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
});

const implementationPlanContentSchema = z.strictObject({
  objective: z.string().min(1),
  scope: z.array(z.string().min(1)).min(1),
  workstreams: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        title: z.string().min(1),
        summary: z.string().min(1),
        status: z.enum(['planned', 'in_progress', 'done']),
      }),
    )
    .min(1),
  risks: z.array(
    z.strictObject({
      id: z.string().min(1),
      statement: z.string().min(1),
      mitigation: z.string().min(1),
    }),
  ),
  exitCriteria: z.array(z.string().min(1)).min(1),
  evidence: z
    .array(
      z.strictObject({
        kind: z.string().min(1),
        ref: z.string().min(1),
      }),
    )
    .min(1),
});

export type ArtifactManifest = z.infer<typeof artifactManifestSchema>;

export interface ArtifactPackageSummary {
  readonly packagePath: string;
  readonly relativePackagePath: string;
  readonly artifactId: string;
  readonly artifactType: string;
  readonly artifactSchemaVersion: number;
  readonly status: string;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly viewCount: number;
  readonly attachmentCount: number;
  readonly valid: boolean;
  readonly loadError?: string | undefined;
}

export interface ArtifactRegisteredFile {
  readonly name: string;
  readonly relativePath: string;
  readonly mediaType: string;
  readonly sha256: string;
  readonly absolutePath: string;
  readonly exists: boolean;
}

export interface ArtifactRegisteredView extends ArtifactRegisteredFile {
  readonly renderer: string;
}

export interface ArtifactRegisteredAttachment extends ArtifactRegisteredFile {
  readonly role: string;
}

export interface ArtifactPackageDetails {
  readonly packagePath: string;
  readonly relativePackagePath: string;
  readonly manifest: ArtifactManifest;
  readonly declarationPath: string;
  readonly contentPath: string;
  readonly contentExists: boolean;
  readonly views: readonly ArtifactRegisteredView[];
  readonly attachments: readonly ArtifactRegisteredAttachment[];
  readonly selectedView?: Readonly<{
    name: string;
    path: string;
    mediaType: string;
    renderer: string;
    body: string;
  }>;
}

export interface ArtifactValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string | undefined;
}

export interface ArtifactValidationResult {
  readonly ok: boolean;
  readonly packagePath: string;
  readonly relativePackagePath: string;
  readonly artifactId?: string | undefined;
  readonly artifactType?: string | undefined;
  readonly issues: readonly ArtifactValidationIssue[];
  readonly warnings: readonly ArtifactValidationIssue[];
  readonly checkedPaths: readonly string[];
}

export interface ArtifactResolutionOptions {
  readonly rootDir?: string | undefined;
}

export interface ArtifactInspectionOptions extends ArtifactResolutionOptions {
  readonly viewName?: string | undefined;
}

export interface ArtifactListResult {
  readonly rootDir: string;
  readonly artifacts: readonly ArtifactPackageSummary[];
}

export async function listArtifactPackages(
  rootDir = DEFAULT_ARTIFACT_ROOT,
): Promise<ArtifactListResult> {
  const resolvedRoot = resolve(process.cwd(), rootDir);
  const packageDirs = await collectArtifactPackageDirectories(resolvedRoot);
  const artifacts = await Promise.all(
    packageDirs.map((packageDir) => summarizeArtifactPackage(packageDir, resolvedRoot)),
  );
  return {
    rootDir: resolvedRoot,
    artifacts: [...artifacts].sort((left, right) =>
      left.relativePackagePath.localeCompare(right.relativePackagePath),
    ),
  };
}

export async function inspectArtifactPackage(
  target: string,
  options: ArtifactInspectionOptions = {},
): Promise<ArtifactPackageDetails> {
  const resolvedRoot = resolve(process.cwd(), options.rootDir ?? DEFAULT_ARTIFACT_ROOT);
  const packageDir = await resolveArtifactPackageTarget(target, resolvedRoot);
  const manifestPath = join(packageDir, MANIFEST_FILE_NAME);
  const rawManifest = await readJsonFile(manifestPath);
  const manifestResult = artifactManifestSchema.safeParse(rawManifest);

  if (!manifestResult.success) {
    throw new Error(formatZodIssues('Artifact manifest is invalid', manifestResult.error.issues));
  }

  const manifest = manifestResult.data;
  const contentPath = join(packageDir, manifest.content.path);
  const declarationPath = resolve(packageDir, manifest.declarationRef);
  const views = manifest.views.map(
    (view): ArtifactRegisteredView => ({
      name: view.name,
      relativePath: view.path,
      mediaType: view.mediaType,
      sha256: view.sha256,
      renderer: view.renderer,
      absolutePath: resolveRegisteredPathWithinPackage(packageDir, view.path),
      exists: false,
    }),
  );
  const attachments = manifest.attachments.map(
    (attachment): ArtifactRegisteredAttachment => ({
      name: attachment.name,
      relativePath: attachment.path,
      mediaType: attachment.mediaType,
      role: attachment.role,
      sha256: attachment.sha256,
      absolutePath: resolveRegisteredPathWithinPackage(packageDir, attachment.path),
      exists: false,
    }),
  );

  const contentExists = await pathExists(contentPath);
  const hydratedViews = await Promise.all(
    views.map(async (view) => ({
      ...view,
      exists: await pathExists(view.absolutePath),
    })),
  );
  const hydratedAttachments = await Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      exists: await pathExists(attachment.absolutePath),
    })),
  );

  const selectedView =
    options.viewName == null
      ? undefined
      : await readSelectedViewContent(options.viewName, hydratedViews);

  return {
    packagePath: packageDir,
    relativePackagePath: normalizeForDisplay(relative(process.cwd(), packageDir) || '.'),
    manifest,
    declarationPath,
    contentPath,
    contentExists,
    views: hydratedViews,
    attachments: hydratedAttachments,
    ...(selectedView != null ? { selectedView } : {}),
  };
}

export async function validateArtifactPackage(
  target: string,
  options: ArtifactResolutionOptions = {},
): Promise<ArtifactValidationResult> {
  const resolvedRoot = resolve(process.cwd(), options.rootDir ?? DEFAULT_ARTIFACT_ROOT);
  const packageDir = await resolveArtifactPackageTarget(target, resolvedRoot);
  return validateArtifactPackageAtPath(packageDir);
}

export function renderArtifactPackageList(result: ArtifactListResult): string {
  const relativeRoot = normalizeForDisplay(relative(process.cwd(), result.rootDir) || '.');

  if (result.artifacts.length === 0) {
    return `[prompt-language artifacts] No artifact packages found under ${relativeRoot}.`;
  }

  return [
    `[prompt-language artifacts] Found ${result.artifacts.length} artifact package${result.artifacts.length === 1 ? '' : 's'} under ${relativeRoot}.`,
    ...result.artifacts.map((artifact) =>
      artifact.valid
        ? `${artifact.relativePackagePath} | ${artifact.artifactId} | ${artifact.artifactType} | ${artifact.status} | ${artifact.title}`
        : `${artifact.relativePackagePath} | INVALID | ${artifact.loadError ?? 'manifest could not be read'}`,
    ),
  ].join('\n');
}

export function renderArtifactPackageDetails(details: ArtifactPackageDetails): string {
  const lines = [
    `[prompt-language artifacts] ${details.manifest.artifactId}`,
    `Path: ${details.relativePackagePath}`,
    `Type: ${details.manifest.artifactType} v${details.manifest.artifactSchemaVersion}`,
    `Status: ${details.manifest.status}`,
    `Title: ${details.manifest.title}`,
    `Summary: ${details.manifest.summary}`,
    `Updated: ${details.manifest.updatedAt}`,
    `Declaration: ${normalizeForDisplay(relative(process.cwd(), details.declarationPath))}`,
    `Content: ${details.manifest.content.path}${details.contentExists ? '' : ' [missing]'}`,
    'Views:',
    ...details.views.map(
      (view) =>
        `- ${view.name} -> ${view.relativePath} (${view.mediaType}, renderer=${view.renderer})${view.exists ? '' : ' [missing]'}`,
    ),
    `Attachments: ${details.attachments.length}`,
    ...details.attachments.map(
      (attachment) =>
        `- ${attachment.name} -> ${attachment.relativePath} (${attachment.mediaType}, role=${attachment.role})${attachment.exists ? '' : ' [missing]'}`,
    ),
  ];

  if (details.selectedView) {
    lines.push(
      '',
      `View: ${details.selectedView.name} (${details.selectedView.path})`,
      details.selectedView.body,
    );
  }

  return lines.join('\n');
}

export function renderArtifactValidationResult(result: ArtifactValidationResult): string {
  const lines = [
    `[prompt-language artifacts] ${result.artifactId ?? basename(result.packagePath)}`,
    `Path: ${result.relativePackagePath}`,
    `Validation: ${result.ok ? 'PASS' : 'FAIL'}`,
  ];

  if (result.checkedPaths.length > 0) {
    lines.push('Checked files:', ...result.checkedPaths.map((checkedPath) => `- ${checkedPath}`));
  }

  if (result.issues.length > 0) {
    lines.push('Issues:', ...result.issues.map((issue) => formatIssueLine(issue)));
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:', ...result.warnings.map((warning) => formatIssueLine(warning)));
  }

  if (result.issues.length === 0 && result.warnings.length === 0) {
    lines.push('No validation findings.');
  }

  return lines.join('\n');
}

async function validateArtifactPackageAtPath(
  packageDir: string,
): Promise<ArtifactValidationResult> {
  const manifestPath = join(packageDir, MANIFEST_FILE_NAME);
  const checkedPaths = [normalizeForDisplay(relative(process.cwd(), manifestPath))];
  const issues: ArtifactValidationIssue[] = [];
  const warnings: ArtifactValidationIssue[] = [];
  const rawManifest = await readJsonFile(manifestPath).catch((error: unknown) => {
    issues.push({
      code: 'ART-001',
      message: `Could not read manifest.json: ${error instanceof Error ? error.message : String(error)}`,
      path: 'manifest.json',
    });
    return undefined;
  });

  if (rawManifest == null) {
    return {
      ok: false,
      packagePath: packageDir,
      relativePackagePath: normalizeForDisplay(relative(process.cwd(), packageDir) || '.'),
      issues,
      warnings,
      checkedPaths,
    };
  }

  const manifestResult = artifactManifestSchema.safeParse(rawManifest);
  if (!manifestResult.success) {
    for (const issue of manifestResult.error.issues) {
      issues.push({
        code: 'ART-001',
        message: issue.message,
        path: issue.path.map(String).join('.'),
      });
    }
    return {
      ok: false,
      packagePath: packageDir,
      relativePackagePath: normalizeForDisplay(relative(process.cwd(), packageDir) || '.'),
      issues,
      warnings,
      checkedPaths,
    };
  }

  const manifest = manifestResult.data;
  const declarationPath = resolve(packageDir, manifest.declarationRef);
  const declarationRelativePath = normalizeForDisplay(relative(process.cwd(), declarationPath));
  const contentPath = join(packageDir, manifest.content.path);
  checkedPaths.push(normalizeForDisplay(relative(process.cwd(), contentPath)));

  if (!(await pathExists(declarationPath))) {
    issues.push({
      code: 'ART-004',
      message: `Declaration schema is missing: ${declarationRelativePath}`,
      path: manifest.declarationRef,
    });
  }

  await validateRegisteredFile(
    packageDir,
    manifest.content.path,
    manifest.content.sha256,
    checkedPaths,
    issues,
    'content',
  );

  for (const view of manifest.views) {
    await validateRegisteredFile(
      packageDir,
      view.path,
      view.sha256,
      checkedPaths,
      issues,
      `view "${view.name}"`,
    );
  }

  for (const attachment of manifest.attachments) {
    await validateRegisteredFile(
      packageDir,
      attachment.path,
      attachment.sha256,
      checkedPaths,
      issues,
      `attachment "${attachment.name}"`,
    );
  }

  if (issues.length === 0) {
    const contentParse = await parseArtifactContentFile(contentPath);
    if (!contentParse.ok) {
      issues.push(contentParse.issue);
    } else {
      const payloadCheck = validateArtifactPayload(manifest, contentParse.value);
      warnings.push(...payloadCheck.warnings);
      issues.push(...payloadCheck.issues);
    }
  }

  return {
    ok: issues.length === 0,
    packagePath: packageDir,
    relativePackagePath: normalizeForDisplay(relative(process.cwd(), packageDir) || '.'),
    artifactId: manifest.artifactId,
    artifactType: manifest.artifactType,
    issues,
    warnings,
    checkedPaths,
  };
}

async function collectArtifactPackageDirectories(rootDir: string): Promise<readonly string[]> {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const packageDirs: string[] = [];
  await walkArtifactTree(rootDir, packageDirs);
  return packageDirs;
}

async function walkArtifactTree(currentDir: string, packageDirs: string[]): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === MANIFEST_FILE_NAME)) {
    packageDirs.push(currentDir);
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !SKIPPED_DIRECTORY_NAMES.has(entry.name))
      .map((entry) => walkArtifactTree(join(currentDir, entry.name), packageDirs)),
  );
}

async function summarizeArtifactPackage(
  packageDir: string,
  rootDir: string,
): Promise<ArtifactPackageSummary> {
  const manifestPath = join(packageDir, MANIFEST_FILE_NAME);
  const relativePackagePath = normalizeForDisplay(relative(rootDir, packageDir) || '.');

  try {
    const rawManifest = await readJsonFile(manifestPath);
    const manifestResult = artifactManifestSchema.safeParse(rawManifest);

    if (!manifestResult.success) {
      return {
        packagePath: packageDir,
        relativePackagePath,
        artifactId: basename(packageDir),
        artifactType: 'invalid',
        artifactSchemaVersion: 0,
        status: 'invalid',
        title: 'Invalid artifact manifest',
        summary: 'Manifest does not match the shipped artifact contract.',
        updatedAt: '',
        viewCount: 0,
        attachmentCount: 0,
        valid: false,
        loadError: formatZodIssues('manifest validation failed', manifestResult.error.issues),
      };
    }

    const manifest = manifestResult.data;
    return {
      packagePath: packageDir,
      relativePackagePath,
      artifactId: manifest.artifactId,
      artifactType: manifest.artifactType,
      artifactSchemaVersion: manifest.artifactSchemaVersion,
      status: manifest.status,
      title: manifest.title,
      summary: manifest.summary,
      updatedAt: manifest.updatedAt,
      viewCount: manifest.views.length,
      attachmentCount: manifest.attachments.length,
      valid: true,
    };
  } catch (error) {
    return {
      packagePath: packageDir,
      relativePackagePath,
      artifactId: basename(packageDir),
      artifactType: 'invalid',
      artifactSchemaVersion: 0,
      status: 'invalid',
      title: 'Unreadable artifact manifest',
      summary: 'Manifest could not be read.',
      updatedAt: '',
      viewCount: 0,
      attachmentCount: 0,
      valid: false,
      loadError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveArtifactPackageTarget(target: string, rootDir: string): Promise<string> {
  const directCandidates = target.startsWith('.')
    ? [resolve(process.cwd(), target)]
    : [resolve(process.cwd(), target), resolve(rootDir, target)];

  for (const candidate of directCandidates) {
    const packageDir = await coerceArtifactPackageDir(candidate);
    if (packageDir != null) {
      return packageDir;
    }
  }

  const listed = await listArtifactPackages(rootDir);
  const matches = listed.artifacts.filter(
    (artifact) => artifact.valid && artifact.artifactId === target,
  );

  if (matches.length === 1) {
    return matches[0]!.packagePath;
  }

  if (matches.length > 1) {
    const duplicatePaths = matches.map((artifact) => artifact.relativePackagePath).join(', ');
    throw new Error(
      `Artifact id "${target}" is ambiguous under ${normalizeForDisplay(relative(process.cwd(), rootDir) || '.')}: ${duplicatePaths}`,
    );
  }

  throw new Error(
    `Artifact "${target}" was not found. Pass a package path or use --root to point at the artifact store.`,
  );
}

async function coerceArtifactPackageDir(candidate: string): Promise<string | undefined> {
  const stats = await fs.stat(candidate).catch(() => undefined);
  if (!stats) return undefined;

  if (stats.isFile() && basename(candidate) === MANIFEST_FILE_NAME) {
    return resolve(candidate, '..');
  }

  if (!stats.isDirectory()) {
    return undefined;
  }

  return (await pathExists(join(candidate, MANIFEST_FILE_NAME))) ? candidate : undefined;
}

async function readSelectedViewContent(
  viewName: string,
  views: readonly ArtifactRegisteredView[],
): Promise<
  Readonly<{ name: string; path: string; mediaType: string; renderer: string; body: string }>
> {
  const selectedView = views.find((view) => view.name === viewName);
  if (!selectedView) {
    const availableViews = views.map((view) => view.name).join(', ');
    throw new Error(
      `Artifact view "${viewName}" is not registered. Available views: ${availableViews || 'none'}.`,
    );
  }

  if (!selectedView.exists) {
    throw new Error(`Artifact view "${viewName}" is missing at ${selectedView.relativePath}.`);
  }

  const body = await fs.readFile(selectedView.absolutePath, 'utf8');
  return {
    name: selectedView.name,
    path: selectedView.relativePath,
    mediaType: selectedView.mediaType,
    renderer: selectedView.renderer,
    body,
  };
}

async function validateRegisteredFile(
  packageDir: string,
  relativePath: string,
  expectedSha256: string,
  checkedPaths: string[],
  issues: ArtifactValidationIssue[],
  label: string,
): Promise<void> {
  let absolutePath: string;
  try {
    absolutePath = resolveRegisteredPathWithinPackage(packageDir, relativePath);
  } catch (error) {
    issues.push({
      code: 'ART-001',
      message: error instanceof Error ? error.message : String(error),
      path: relativePath,
    });
    return;
  }
  const displayPath = normalizeForDisplay(relative(process.cwd(), absolutePath));
  if (!checkedPaths.includes(displayPath)) {
    checkedPaths.push(displayPath);
  }

  if (!(await pathExists(absolutePath))) {
    issues.push({
      code: 'ART-002',
      message: `Registered ${label} is missing: ${displayPath}`,
      path: relativePath,
    });
    return;
  }

  const sha256 = await computeFileSha256(absolutePath);
  if (sha256 !== expectedSha256) {
    issues.push({
      code: 'ART-003',
      message: `Checksum mismatch for ${label}: expected ${expectedSha256}, got ${sha256}`,
      path: relativePath,
    });
  }
}

async function parseArtifactContentFile(
  contentPath: string,
): Promise<
  Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false; issue: ArtifactValidationIssue }>
> {
  try {
    return { ok: true, value: await readJsonFile(contentPath) };
  } catch (error) {
    return {
      ok: false,
      issue: {
        code: 'ART-005',
        message: `Canonical content could not be read: ${error instanceof Error ? error.message : String(error)}`,
        path: CONTENT_FILE_PATH,
      },
    };
  }
}

function validateArtifactPayload(
  manifest: ArtifactManifest,
  payload: unknown,
): Readonly<{
  issues: readonly ArtifactValidationIssue[];
  warnings: readonly ArtifactValidationIssue[];
}> {
  if (manifest.artifactType === 'implementation_plan' && manifest.artifactSchemaVersion === 1) {
    const payloadResult = implementationPlanContentSchema.safeParse(payload);

    if (payloadResult.success) {
      return { issues: [], warnings: [] };
    }

    return {
      issues: payloadResult.error.issues.map(
        (issue): ArtifactValidationIssue => ({
          code: 'ART-006',
          message: issue.message,
          path: issue.path.map(String).join('.'),
        }),
      ),
      warnings: [],
    };
  }

  return {
    issues: [],
    warnings: [
      {
        code: 'ART-W001',
        message: `No built-in payload validator is registered for ${manifest.artifactType} v${manifest.artifactSchemaVersion}.`,
      },
    ],
  };
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path, 'utf8')) as unknown;
}

async function computeFileSha256(path: string): Promise<string> {
  const content = await fs.readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

async function pathExists(path: string): Promise<boolean> {
  return (await fs.stat(path).catch(() => undefined)) != null;
}

function resolveRegisteredPathWithinPackage(packageDir: string, relativePath: string): string {
  const absolutePath = resolve(packageDir, relativePath);
  const relativeToPackage = normalizeForDisplay(relative(packageDir, absolutePath));
  if (
    relativeToPackage === '' ||
    relativeToPackage === '.' ||
    relativeToPackage === '..' ||
    relativeToPackage.startsWith('../')
  ) {
    throw new Error(`Registered path escapes artifact package root: ${relativePath}`);
  }
  return absolutePath;
}

function formatZodIssues(prefix: string, issues: readonly z.ZodIssue[]): string {
  return `${prefix}: ${issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.map(String).join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ')}`;
}

function formatIssueLine(issue: ArtifactValidationIssue): string {
  return `- ${issue.code}${issue.path ? ` (${issue.path})` : ''}: ${issue.message}`;
}

function normalizeForDisplay(path: string): string {
  return path.replaceAll('\\', '/');
}
