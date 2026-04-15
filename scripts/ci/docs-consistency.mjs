#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROADMAP_PATH = 'docs/roadmap.md';

function readText(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function fail(message) {
  console.error(`[docs-consistency] FAIL - ${message}`);
  process.exit(1);
}

function syntaxEvidence({
  reference,
  runtime = ['src/application/advance-flow.ts'],
  tests = ['src/application/parse-flow.test.ts', 'src/application/advance-flow.test.ts'],
  roundtrip = [
    'src/application/render-node-to-dsl.ts',
    'src/application/render-node-to-dsl.test.ts',
  ],
} = {}) {
  return {
    reference,
    parser: ['src/application/parse-flow.ts'],
    runtime,
    roundtrip,
    tests,
  };
}

const shippedFeatureMatrix = [
  {
    claim: 'persistent state and context re-injection',
    required: ['reference', 'runtime', 'tests'],
    evidence: {
      reference: ['docs/reference/program-structure.md'],
      runtime: [
        'src/application/inject-context.ts',
        'src/infrastructure/adapters/file-state-store.ts',
      ],
      tests: [
        'src/application/inject-context.test.ts',
        'src/infrastructure/adapters/file-state-store.test.ts',
      ],
    },
  },
  {
    claim: '`prompt`, `run`, `let` / `var`',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/prompt.md', 'docs/reference/run.md', 'docs/reference/let-var.md'],
    }),
  },
  {
    claim: '`if`, `while`, `until`, `retry`, `foreach`, `break`, `continue`',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: [
        'docs/reference/if.md',
        'docs/reference/while.md',
        'docs/reference/until.md',
        'docs/reference/retry.md',
        'docs/reference/foreach.md',
        'docs/reference/break.md',
        'docs/reference/continue.md',
      ],
    }),
  },
  {
    claim: '`spawn` / `await`',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/spawn.md', 'docs/reference/await.md'],
      runtime: ['src/application/advance-flow.ts', 'src/application/terminate-spawned-children.ts'],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow.test.ts',
        'src/application/terminate-spawned-children.test.ts',
      ],
    }),
  },
  {
    claim: '`done when:` gates and built-in predicates',
    required: ['reference', 'parser', 'runtime', 'tests'],
    evidence: {
      reference: ['docs/reference/gates.md'],
      parser: ['src/application/parse-flow.ts'],
      runtime: ['src/application/evaluate-completion.ts'],
      tests: ['src/application/parse-flow.test.ts', 'src/application/evaluate-completion.test.ts'],
    },
  },
  {
    claim: '`approve "message"` and `approve "message" timeout N` — hard human approval checkpoint',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/approve.md'],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow-new-nodes.test.ts',
      ],
    }),
  },
  {
    claim: '`let x = prompt "..." as json { schema }` — structured JSON capture',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/let-var.md'],
    }),
  },
  {
    claim: '`import "file.flow"` and `import "file.flow" as ns` — flow composition',
    required: ['reference', 'parser', 'roundtrip', 'tests'],
    evidence: {
      reference: ['docs/reference/import.md'],
      parser: ['src/application/parse-flow.ts'],
      roundtrip: ['src/application/render-node-to-dsl.ts'],
      tests: ['src/application/parse-flow.test.ts', 'src/application/render-node-to-dsl.test.ts'],
    },
  },
  {
    claim: 'export/use prompt library system — namespaced reusable flows, prompts, and gates',
    required: ['reference', 'parser', 'roundtrip', 'tests'],
    evidence: {
      reference: ['docs/reference/prompt-libraries.md'],
      parser: ['src/application/parse-flow.ts'],
      roundtrip: ['src/application/render-node-to-dsl.ts'],
      tests: ['src/application/parse-flow.test.ts', 'src/application/render-node-to-dsl.test.ts'],
    },
  },
  {
    claim: '`spawn "name" if condition` — conditional spawn',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/spawn.md'],
    }),
  },
  {
    claim: '`spawn "name" model "model-id"` — per-spawn model selection',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/spawn.md'],
      runtime: [
        'src/application/advance-flow.ts',
        'src/infrastructure/adapters/claude-process-spawner.ts',
      ],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow.test.ts',
        'src/infrastructure/adapters/claude-process-spawner.test.ts',
      ],
    }),
  },
  {
    claim: '`grounded-by "cmd"` on `while`, `until`, `if` — deterministic exit-code condition',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/if.md', 'docs/reference/while.md', 'docs/reference/until.md'],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow.test.ts',
        'src/application/render-node-to-dsl.test.ts',
      ],
    }),
  },
  {
    claim: '`review max N` block with optional `criteria:` and `grounded-by` — critique loop',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/review.md'],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow-new-nodes.test.ts',
        'src/domain/review-judge-capture.test.ts',
      ],
    }),
  },
  {
    claim: '`race` block — competitive parallel execution, first success wins',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/race.md'],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow-new-nodes.test.ts',
        'src/domain/render-flow-new-nodes.test.ts',
      ],
    }),
  },
  {
    claim: '`foreach-spawn item in list max N` — parallel fan-out',
    required: ['reference', 'parser', 'runtime', 'roundtrip', 'tests'],
    evidence: syntaxEvidence({
      reference: ['docs/reference/foreach-spawn.md'],
      tests: [
        'src/application/parse-flow.test.ts',
        'src/application/advance-flow-new-nodes.test.ts',
        'src/domain/render-flow-new-nodes.test.ts',
      ],
    }),
  },
  {
    claim: '`remember "text"` and `remember key="k" value="v"` — persistent memory',
    required: ['reference', 'parser', 'runtime', 'tests'],
    evidence: {
      reference: ['docs/reference/remember.md'],
      parser: ['src/application/parse-flow.ts'],
      runtime: [
        'src/application/advance-flow.ts',
        'src/infrastructure/adapters/file-memory-store.ts',
      ],
      tests: [
        'src/application/parse-flow-memory-messaging.test.ts',
        'src/domain/flow-node-memory-messaging.test.ts',
        'src/infrastructure/adapters/file-memory-store.test.ts',
      ],
    },
  },
  {
    claim: '`memory:` section — prefetch keys from memory store',
    required: ['reference', 'parser', 'runtime', 'tests'],
    evidence: {
      reference: ['docs/reference/remember.md'],
      parser: ['src/application/parse-flow.ts'],
      runtime: [
        'src/application/run-flow-headless.ts',
        'src/infrastructure/adapters/file-memory-store.ts',
      ],
      tests: [
        'src/application/parse-flow-memory-messaging.test.ts',
        'src/domain/render-flow-memory-messaging.test.ts',
        'src/infrastructure/adapters/file-memory-store.test.ts',
      ],
    },
  },
  {
    claim: '`send "target" "msg"` / `receive varName` — inter-agent messaging',
    required: ['reference', 'parser', 'runtime', 'tests'],
    evidence: {
      reference: ['docs/reference/send-receive.md'],
      parser: ['src/application/parse-flow.ts'],
      runtime: [
        'src/application/advance-flow.ts',
        'src/infrastructure/adapters/file-message-store.ts',
      ],
      tests: [
        'src/application/parse-flow-memory-messaging.test.ts',
        'src/domain/render-flow-memory-messaging.test.ts',
        'src/infrastructure/adapters/file-message-store.test.ts',
      ],
    },
  },
  {
    claim:
      'public SDK from the root package and `./sdk` subpath — stable programmatic API for integrations',
    required: ['reference', 'implementation', 'tests'],
    evidence: {
      reference: ['docs/reference/sdk.md'],
      implementation: ['src/sdk.ts'],
      tests: ['src/sdk.test.ts'],
    },
  },
  {
    claim: 'VS Code extension (basic syntax highlighting in `vscode-extension/`)',
    required: ['reference', 'implementation'],
    evidence: {
      reference: ['docs/wip/tooling/vscode-extension.md'],
      implementation: [
        'vscode-extension/package.json',
        'vscode-extension/syntaxes/flow.tmLanguage.json',
      ],
    },
  },
  {
    claim: 'GitHub Actions integration (`action/action.yml` — `45ck/prompt-language-action`)',
    required: ['reference', 'implementation'],
    evidence: {
      reference: ['docs/wip/tooling/github-action.md'],
      implementation: ['action/action.yml'],
    },
  },
];

const boundaryAssertions = [
  {
    path: 'README.md',
    snippets: [
      'verification-first supervision runtime for coding agents',
      '~85% of execution is deterministic; ~15% is AI',
      '`npx @45ck/prompt-language run`       | Execute a flow via Claude or headless runner |',
    ],
  },
  {
    path: 'docs/index.md',
    snippets: ['Start here for shipped usage', 'Public shipped-vs-WIP boundary backed by `.beads`'],
  },
  {
    path: 'docs/guides/index.md',
    snippets: [
      'Guides are the product-first onboarding path',
      'If a topic appears only in the [Roadmap]',
    ],
  },
  {
    path: 'docs/evaluation/index.md',
    snippets: [
      'Evaluation measures the current product and its caveats.',
      'The shipped product contract',
    ],
  },
  {
    path: 'docs/research/README.md',
    snippets: ['they are not the product contract', 'Near-term tracked product work'],
  },
  {
    path: 'docs/strategy/index.md',
    snippets: [
      'not the source of truth for shipped behavior',
      'Backlog status and near-term tracking',
    ],
  },
  {
    path: 'docs/reference/cli-reference.md',
    snippets: [
      '~/.claude/plugins/cache/prompt-language-local/prompt-language/<version>/',
      '`run --runner claude --json` returns a blocked profile report and exits `2`',
      '`ci --runner claude --json` returns a blocked profile report and exits `2`',
    ],
  },
  {
    path: 'docs/wip/tooling/vscode-extension.md',
    snippets: ['Status: basic package shipped; richer editor tooling remains WIP.'],
  },
  {
    path: 'docs/wip/tooling/github-action.md',
    snippets: ['Status: shipped integration, retained here as transition context.'],
  },
  {
    path: 'docs/wip/index.md',
    snippets: ['[artifacts/](artifacts/README.md)', 'Artifact protocol planning'],
  },
  {
    path: 'docs/documentation-governance.md',
    snippets: ['The shipped list there is CI-checked against an evidence matrix.'],
  },
];

function extractShippedClaims(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'The runtime already ships:');
  if (start < 0) {
    fail(`could not find shipped-claims section in ${ROADMAP_PATH}`);
  }

  const claims = [];
  let index = start + 1;
  while (index < lines.length && lines[index].trim().length === 0) {
    index += 1;
  }
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0) {
      break;
    }
    if (!line.startsWith('- ')) {
      fail(`unexpected line inside shipped-claims section: "${lines[index]}"`);
    }
    claims.push(line.slice(2));
  }
  return claims;
}

function assertPathsExist(paths, label, claim) {
  for (const path of paths) {
    if (!existsSync(join(ROOT, path))) {
      fail(`missing ${label} evidence for "${claim}": ${path}`);
    }
  }
}

function validateMatrix() {
  const roadmapClaims = extractShippedClaims(readText(ROADMAP_PATH));
  const matrixClaims = shippedFeatureMatrix.map((entry) => entry.claim);

  if (roadmapClaims.length !== matrixClaims.length) {
    fail(
      `roadmap shipped-claim count (${roadmapClaims.length}) does not match evidence matrix (${matrixClaims.length})`,
    );
  }

  for (let index = 0; index < roadmapClaims.length; index += 1) {
    if (roadmapClaims[index] !== matrixClaims[index]) {
      fail(
        `roadmap claim mismatch at item ${index + 1}: expected "${matrixClaims[index]}", found "${roadmapClaims[index]}"`,
      );
    }
  }

  for (const entry of shippedFeatureMatrix) {
    for (const category of entry.required) {
      const paths = entry.evidence[category];
      if (!Array.isArray(paths) || paths.length === 0) {
        fail(`"${entry.claim}" is missing required ${category} evidence`);
      }
      assertPathsExist(paths, category, entry.claim);
    }
  }
}

function validateBoundaryAssertions() {
  for (const assertion of boundaryAssertions) {
    const text = readText(assertion.path);
    for (const snippet of assertion.snippets) {
      if (!text.includes(snippet)) {
        fail(`missing expected docs boundary snippet in ${assertion.path}: ${snippet}`);
      }
    }
  }
}

validateMatrix();
validateBoundaryAssertions();

console.log(
  `[docs-consistency] PASS - validated ${shippedFeatureMatrix.length} shipped claims and ${boundaryAssertions.length} docs-boundary assertions.`,
);
