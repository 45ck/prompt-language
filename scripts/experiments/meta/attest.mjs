#!/usr/bin/env node

import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildAttestationRecord,
  buildBundlePayload,
  DEFAULT_REVOKED_SIGNERS_PATH,
  DEFAULT_TRUSTED_SIGNERS_PATH,
  loadTrustedSignerRegistry,
  verifyAttestationAgainstBundle,
} from './attestation-lib.mjs';

function parseArgs(argv) {
  const out = {
    bundle: null,
    signer: null,
    key: process.env.PL_ATTEST_KEY_PATH?.trim() || null,
    trustedSigners: DEFAULT_TRUSTED_SIGNERS_PATH,
    forceReplace: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bundle') out.bundle = argv[++i];
    else if (arg === '--signer') out.signer = argv[++i];
    else if (arg === '--key') out.key = argv[++i];
    else if (arg === '--trusted-signers') out.trustedSigners = argv[++i];
    else if (arg === '--force-replace') out.forceReplace = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Usage: node scripts/experiments/meta/attest.mjs --bundle <dir> --signer <signer-id> --key <private-key>\n' +
          `       [--trusted-signers <file>] [--force-replace] [--json]\n` +
          `Defaults:\n` +
          `  --trusted-signers ${DEFAULT_TRUSTED_SIGNERS_PATH}\n` +
          '  --key may also be supplied via PL_ATTEST_KEY_PATH\n',
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.bundle) fail('--bundle is required', 2);
  if (!args.signer) fail('--signer is required', 2);
  if (!args.key) fail('--key is required (or set PL_ATTEST_KEY_PATH)', 2);

  const bundleDir = resolve(args.bundle);
  if (!existsSync(bundleDir)) fail(`bundle not found: ${bundleDir}`);

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
    keyPath: resolve(args.key),
  });

  verifyAttestationAgainstBundle({
    attestation,
    bundlePayload: payload,
    trustedSignersPath: trustedRegistryPath,
    revokedSignersPath: DEFAULT_REVOKED_SIGNERS_PATH,
  });

  writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          attestationPath,
          signer: attestation.signer,
          signerRole: attestation.signerRole,
          runId: attestation.payload.runId,
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
