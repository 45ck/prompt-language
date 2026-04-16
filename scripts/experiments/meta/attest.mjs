#!/usr/bin/env node

import { createHash, generateKeyPairSync } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { canonicalJSON } from '../../eval/provenance-schema.mjs';
import {
  buildAttestationRecord,
  buildBundlePayload,
  DEFAULT_REVOKED_SIGNERS_PATH,
  DEFAULT_TRUSTED_SIGNERS_PATH,
  exportEd25519PublicKeyBase64,
  loadTrustedSignerRegistry,
  verifyAttestationAgainstBundle,
} from './attestation-lib.mjs';

const DEFAULT_ATTEST_LOG_PATH = join(homedir(), '.pl-attest-log.jsonl');

function parseArgs(argv) {
  const out = {
    bundle: null,
    signer: null,
    key: process.env.PL_ATTEST_KEY_PATH?.trim() || null,
    trustedSigners: DEFAULT_TRUSTED_SIGNERS_PATH,
    forceReplace: false,
    json: false,
    keygen: false,
    keygenOut: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bundle') out.bundle = argv[++i];
    else if (arg === '--signer') out.signer = argv[++i];
    else if (arg === '--key') out.key = argv[++i];
    else if (arg === '--trusted-signers') out.trustedSigners = argv[++i];
    else if (arg === '--force-replace') out.forceReplace = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--keygen') out.keygen = true;
    else if (arg === '--keygen-out') out.keygenOut = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Usage:\n' +
          '  node scripts/experiments/meta/attest.mjs --bundle <dir> --signer <signer-id> --key <private-key>\n' +
          '       [--trusted-signers <file>] [--force-replace] [--json]\n' +
          '  node scripts/experiments/meta/attest.mjs --keygen --signer <signer-id> [--keygen-out <dir>]\n' +
          '\n' +
          'Defaults:\n' +
          `  --trusted-signers  ${DEFAULT_TRUSTED_SIGNERS_PATH}\n` +
          '  --key              also read from env PL_ATTEST_KEY_PATH\n' +
          '  --keygen-out       scripts/eval/.attest-keys/\n' +
          '  audit log          ~/.pl-attest-log.jsonl (override with PL_ATTEST_LOG_PATH)\n',
      );
      process.exit(0);
    } else {
      process.stderr.write(`attest: unknown argument ${arg}\n`);
      process.exit(2);
    }
  }

  return out;
}

function fail(message, code = 1) {
  process.stderr.write(`attest: ${message}\n`);
  process.exit(code);
}

/**
 * NF2 / prompt-kv57.2: key directory + file permissions must be 0700 / 0600
 * on POSIX. On Windows POSIX modes are advisory; emit a loud warning
 * instead. Mirrors the pattern in run-meta-experiment.mjs:358-368 for the
 * nonce store.
 */
function ensureSecureDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
  } catch {
    /* POSIX chmod may fail on Windows; modes are advisory there */
  }
  warnIfWorldAccessible(dir, 'directory');
}

function ensureSecureFile(path) {
  try {
    chmodSync(path, 0o600);
  } catch {
    /* noop on Windows */
  }
  warnIfWorldAccessible(path, 'file');
}

function warnIfWorldAccessible(path, label) {
  if (process.platform === 'win32') {
    // POSIX modes are advisory on Windows. We cannot reliably detect
    // "writable by others" via fs.stat on NTFS without parsing ACLs. The
    // security-minded fallback is a loud one-time warning so operators
    // know the shared-host threat model.
    process.stderr.write(
      `attest: warning: ${label} ${path} — on Windows, POSIX 0700/0600 modes are advisory. ` +
        `Confirm via NTFS ACLs that only the current user can read this ${label}.\n`,
    );
    return;
  }
  try {
    const st = statSync(path);
    // Bits 0o077 cover group+other read/write/execute. Any of those set
    // means the file is accessible beyond the owner.
    if ((st.mode & 0o077) !== 0) {
      process.stderr.write(
        `attest: warning: ${label} ${path} has mode ${(st.mode & 0o777).toString(8)}; ` +
          `expected 0700/0600\n`,
      );
    }
  } catch {
    /* best-effort */
  }
}

/**
 * G2 / prompt-kv57.7: append a local audit line for every sign call.
 * Defense in depth so an operator can notice 'I did not sign bundle X'.
 * Override the log path via PL_ATTEST_LOG_PATH for tests. A failure to
 * write the log is warned but never fatal — the log is not a gate.
 */
function appendAuditLog({ signerId, bundleDir, payloadSha256, signedAt }) {
  const logPath = process.env.PL_ATTEST_LOG_PATH?.trim() || DEFAULT_ATTEST_LOG_PATH;
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    const record = { signerId, bundleDir, payloadSha256, signedAt };
    appendFileSync(logPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    try {
      chmodSync(logPath, 0o600);
    } catch {
      /* Windows: mode is advisory */
    }
  } catch (err) {
    process.stderr.write(
      `attest: warning: failed to append audit log at ${logPath}: ${err.message}\n`,
    );
  }
}

function runKeygen(args) {
  if (!args.signer) fail('--keygen requires --signer <signer-id>', 2);
  const outDir =
    args.keygenOut != null
      ? resolve(args.keygenOut)
      : resolve(process.cwd(), 'scripts', 'eval', '.attest-keys');
  ensureSecureDir(outDir);
  const privatePath = join(outDir, `${args.signer}.key`);
  if (existsSync(privatePath) && !args.forceReplace) {
    fail(`key already exists: ${privatePath} (pass --force-replace to overwrite)`);
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' });
  writeFileSync(privatePath, pem, { mode: 0o600 });
  ensureSecureFile(privatePath);
  const publicBase64 = exportEd25519PublicKeyBase64(publicKey);
  const publicPath = join(outDir, `${args.signer}.pub`);
  writeFileSync(publicPath, publicBase64 + '\n', 'utf8');

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          signer: args.signer,
          privateKeyPath: privatePath,
          publicKeyPath: publicPath,
          publicKeyBase64: publicBase64,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  process.stdout.write(
    `keygen OK: ${args.signer}\n  private=${privatePath} (0600)\n  public=${publicPath}\n  publicBase64=${publicBase64}\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.keygen) {
    runKeygen(args);
    return;
  }
  if (!args.bundle) fail('--bundle is required', 2);
  if (!args.signer) fail('--signer is required', 2);
  if (!args.key) fail('--key is required (or set PL_ATTEST_KEY_PATH)', 2);

  const bundleDir = resolve(args.bundle);
  if (!existsSync(bundleDir)) fail(`bundle not found: ${bundleDir}`);

  const keyPath = resolve(args.key);
  if (!existsSync(keyPath)) fail(`private key not found: ${keyPath}`);
  // NF2: warn loudly on insecure key file permissions before signing.
  warnIfWorldAccessible(keyPath, 'file');

  const attestationPath = join(bundleDir, 'attestation.json');
  if (existsSync(attestationPath) && !args.forceReplace) {
    fail(`attestation already exists: ${attestationPath} (pass --force-replace to overwrite)`);
  }

  const trustedRegistryPath = resolve(args.trustedSigners);
  const { signers } = loadTrustedSignerRegistry(trustedRegistryPath);
  const signer = signers.get(args.signer);
  if (!signer) {
    fail(`signer not found in trusted registry: ${args.signer}`);
  }

  const { payload } = buildBundlePayload({ bundleDir });
  const attestation = buildAttestationRecord({
    payload,
    signerId: args.signer,
    signerRole: signer.role,
    keyPath,
  });

  verifyAttestationAgainstBundle({
    attestation,
    bundlePayload: payload,
    trustedSignersPath: trustedRegistryPath,
    revokedSignersPath: DEFAULT_REVOKED_SIGNERS_PATH,
  });

  writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);

  // G2: audit log (defense-in-depth; never fatal).
  const payloadSha256 = createHash('sha256')
    .update(canonicalJSON(attestation.payload))
    .digest('hex');
  appendAuditLog({
    signerId: attestation.signer,
    bundleDir,
    payloadSha256,
    signedAt: attestation.signedAt,
  });

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          attestationPath,
          signer: attestation.signer,
          signerRole: attestation.signerRole,
          runId: attestation.payload.runId,
          payloadSha256,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stdout.write(
    `attest OK: ${attestationPath} signer=${attestation.signer} role=${attestation.signerRole} runId=${attestation.payload.runId}\n`,
  );
}

main().catch((err) => {
  fail(err.stack || err.message);
});
