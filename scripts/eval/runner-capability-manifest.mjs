export const RUNNER_CAPABILITY_SCHEMA_VERSION = 1;

export const UNSAFE_PERMISSION_BYPASS_FLAGS = new Set([
  '--dangerously-skip-permissions',
  '--dangerously-bypass-approvals-and-sandbox',
]);

export function buildRunnerCapabilityManifest({
  runnerId = 'unknown',
  adapter = null,
  provider = runnerId,
  model = null,
  command = runnerId,
  binaryPath = null,
  binarySha256 = null,
  argv = [],
  readRoots = [],
  writeRoots = [],
  outputRoots = [],
  timeoutMs = null,
  expectedPairCount = null,
  transportWitness = 'none',
  networkMode = 'unknown',
  sandboxMode = 'unknown',
  approvalMode = null,
  shellMode = 'model-directed',
  allowedCommands = [],
  envAllowlist = [],
  externalProcess = true,
  detached = false,
  killOnTimeout = true,
} = {}) {
  const unsafeFlags = argv.filter((arg) => UNSAFE_PERMISSION_BYPASS_FLAGS.has(arg));
  const resolvedApprovalMode = approvalMode ?? (unsafeFlags.length > 0 ? 'bypassed' : 'enforced');
  const claimPosture =
    unsafeFlags.length > 0 ||
    resolvedApprovalMode === 'bypassed' ||
    sandboxMode === 'unknown' ||
    networkMode === 'unknown' ||
    shellMode === 'model-directed' ||
    transportWitness === 'none'
      ? 'recorded-only'
      : 'claim-eligible';

  return {
    schemaVersion: RUNNER_CAPABILITY_SCHEMA_VERSION,
    runner: {
      id: runnerId,
      adapter,
      provider,
      model,
      command,
      argv: [...argv],
      binaryPath,
      binarySha256,
    },
    safety: {
      claimPosture,
      unsafeFlags,
      approvalMode: resolvedApprovalMode,
      sandboxMode,
      networkMode,
      filesystem: {
        readRoots: [...readRoots],
        writeRoots: [...writeRoots],
        outputRoots: [...outputRoots],
      },
      env: {
        allowlist: [...envAllowlist],
        redacted: ['*_API_KEY', '*TOKEN*', '*SECRET*'],
      },
      shell: {
        mode: shellMode,
        allowedCommands: [...allowedCommands],
      },
      process: {
        externalProcess,
        detached,
        timeoutMs,
        killOnTimeout,
        childLease: 'required',
      },
      witness: {
        traceRequired: true,
        shimRequired: transportWitness === 'shim',
        transportWitness,
        expectedPairCount,
      },
    },
  };
}

export function assessRunnerCapabilityManifest(manifest) {
  const blockers = [];
  if (!manifest || typeof manifest !== 'object') {
    return {
      status: 'unsafe',
      blockers: ['runner-capability-manifest-missing'],
    };
  }

  if (manifest.schemaVersion !== RUNNER_CAPABILITY_SCHEMA_VERSION) {
    blockers.push('runner-capability-manifest-version-invalid');
  }
  if (!manifest.runner || typeof manifest.runner !== 'object') {
    blockers.push('runner-capability-manifest-invalid');
  }
  if (!manifest.safety || typeof manifest.safety !== 'object') {
    blockers.push('runner-capability-manifest-invalid');
  }

  const safety = manifest.safety ?? {};
  const unsafeFlags = Array.isArray(safety.unsafeFlags) ? safety.unsafeFlags : [];
  const knownUnsafeFlags = unsafeFlags.filter((flag) => UNSAFE_PERMISSION_BYPASS_FLAGS.has(flag));
  if (knownUnsafeFlags.length > 0) blockers.push('runner-unsafe-permission-bypass');
  if (safety.approvalMode === 'bypassed') blockers.push('runner-approval-bypassed');
  if (safety.claimPosture !== 'claim-eligible') blockers.push('runner-recorded-only-posture');

  if (!['workspace', 'container', 'sandboxed'].includes(safety.sandboxMode)) {
    blockers.push('runner-sandbox-unverified');
  }
  if (!['none', 'loopback-only', 'frontier', 'explicit-allowlist'].includes(safety.networkMode)) {
    blockers.push('runner-network-unbounded');
  }
  if (!['none', 'allowlist'].includes(safety.shell?.mode)) {
    blockers.push('runner-shell-unbounded');
  }

  const timeoutMs = safety.process?.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    blockers.push('runner-process-lease-missing');
  }
  if (safety.process?.detached === true || safety.process?.killOnTimeout !== true) {
    blockers.push('runner-process-lease-unsafe');
  }

  if (safety.witness?.traceRequired !== true) blockers.push('runner-trace-not-required');
  if (safety.witness?.transportWitness === 'none') {
    blockers.push('runner-transport-witness-missing');
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'unsafe',
    blockers: [...new Set(blockers)],
  };
}
