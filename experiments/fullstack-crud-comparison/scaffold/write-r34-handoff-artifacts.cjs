#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';

mkdirSync(workspace, { recursive: true });

writeFileSync(
  join(workspace, 'README.md'),
  [
    '# FSCRUD-01 R34 Server Integration',
    '',
    'This workspace is a deterministic local-only diagnostic.',
    '',
    'Run public checks with:',
    '',
    '- `npm test`',
    '- `npm start`',
    '- `npm run check:domain:exports`',
    '- `npm run check:domain:customer`',
    '- `npm run check:domain:assets`',
    '- `npm run check:domain:work-orders`',
    '',
    'The domain kernel and UI skeleton are deterministic protected artifacts.',
    'The local model owns only `src/server.js` in this arm.',
    '',
  ].join('\n'),
);

writeFileSync(
  join(workspace, 'run-manifest.json'),
  `${JSON.stringify(
    {
      experimentArm: 'r34-pl-server-only-integration',
      provider: 'local-only',
      deterministicArtifacts: [
        'deterministic-domain-kernel',
        'deterministic-ui-skeleton',
        'deterministic-handoff-docs',
      ],
      protectedArtifacts: [
        'src/domain.js',
        'public/index.html',
        'package.json',
        'CONTRACT.md',
        'DOMAIN_API.md',
        'contracts/domain-exports.json',
        '__tests__/domain.contract.test.js',
        'data/seed.json',
        'scripts/check-domain-exports.cjs',
        'scripts/check-domain-customer.cjs',
        'scripts/check-domain-assets.cjs',
        'scripts/check-domain-work-orders.cjs',
        'README.md',
        'run-manifest.json',
        'verification-report.md',
      ],
      modelOwnedFiles: ['src/server.js'],
      claimBoundary:
        'R34 tests local-model server integration around deterministic domain, UI, and handoff artifacts.',
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(workspace, 'verification-report.md'),
  [
    '# R34 Verification Report',
    '',
    'Public checks run by the flow:',
    '',
    '- `npm run check:domain:exports`',
    '- `npm run check:domain:customer`',
    '- `npm run check:domain:assets`',
    '- `npm run check:domain:work-orders`',
    '- `npm test`',
    '',
    'The hidden verifier is run only by the harness after the local-only flow finishes.',
    'The deterministic domain kernel, UI skeleton, and handoff artifacts are protected.',
    '',
  ].join('\n'),
);

console.log(`wrote R34 handoff artifacts to ${workspace}`);
