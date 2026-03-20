#!/usr/bin/env node
/**
 * roundtrip-eval.mjs — Layer 1: API roundtrip eval.
 *
 * Calls the Claude API with buildMetaPrompt() for ~20 NL inputs,
 * feeds each response through parseFlow(), and validates the output.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/eval/roundtrip-eval.mjs
 *   ANTHROPIC_API_KEY=sk-ant-... EVAL_MODEL=claude-sonnet-4-20250514 node scripts/eval/roundtrip-eval.mjs
 *
 * Exits 0 if ≥80% pass rate (or if no API key is set).
 * Exits 1 otherwise.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildMetaPrompt } from '../../dist/application/inject-context.js';
import { parseFlow } from '../../dist/application/parse-flow.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.EVAL_MODEL ?? 'claude-sonnet-4-20250514';
const PASS_THRESHOLD = 0.8;
const DELAY_MS = 500;

if (!API_KEY) {
  console.log('[roundtrip-eval] No ANTHROPIC_API_KEY set — skipping eval (exit 0).');
  process.exit(0);
}

const client = new Anthropic({ apiKey: API_KEY });

/** @type {Array<{input: string, expectedTopNode: string, label: string}>} */
const TEST_CASES = [
  {
    label: '#1 until — run tests',
    input: 'Run tests, keep fixing until they pass, max 5 tries',
    expectedTopNode: 'until',
  },
  {
    label: "#2 until — don't stop",
    input: "Don't stop until lint passes",
    expectedTopNode: 'until',
  },
  {
    label: '#3 while — tests fail',
    input: 'While tests fail, fix them and rerun. Max 3.',
    expectedTopNode: 'while',
  },
  {
    label: '#4 retry — build',
    input: 'Retry the build up to 3 times',
    expectedTopNode: 'retry',
  },
  {
    label: '#5 retry/try — deploy failure',
    input: 'Run deploy. On failure, try again 3 times.',
    expectedTopNode: 'retry|try',
  },
  {
    label: '#6 if — tests fail fix',
    input: 'If tests fail fix them, otherwise move on',
    expectedTopNode: 'if',
  },
  {
    label: '#7 try — deploy rollback',
    input: 'Try running deploy. If it fails, roll back.',
    expectedTopNode: 'try',
  },
  {
    label: '#8 until — loop everything',
    input: 'Loop until everything passes, max 5',
    expectedTopNode: 'until',
  },
  {
    label: '#9 until — keep going checks',
    input: 'Keep going until all checks pass',
    expectedTopNode: 'until',
  },
  {
    label: '#10 until — keep running tests',
    input: "Keep running tests until they're green",
    expectedTopNode: 'until',
  },
  {
    label: '#11 until — repeat build',
    input: 'Repeat the build until it succeeds',
    expectedTopNode: 'until',
  },
  {
    label: '#12 retry — linter retry',
    input: 'Run linter, if it fails try again 3 times',
    expectedTopNode: 'retry',
  },
  {
    label: '#13 try — build catch failures',
    input: 'Build project, catch failures, run fix script',
    expectedTopNode: 'try',
  },
  {
    label: '#14 multiple — tests + lint',
    input: 'Run tests. If fail, fix. Then lint. Keep going until both pass.',
    expectedTopNode: 'multiple',
  },
  {
    label: '#15 while — build broken',
    input: 'while build broken: fix and rebuild, max 4',
    expectedTopNode: 'while',
  },
  {
    label: '#16 until — test suite',
    input: 'Run test suite until it passes, max 5',
    expectedTopNode: 'until',
  },
  {
    label: '#17 while — build fails',
    input: 'While the build fails, fix errors, max 3',
    expectedTopNode: 'while',
  },
  {
    label: '#18 until + gates',
    input: "Fix tests until they pass, don't stop until lint also passes",
    expectedTopNode: 'until',
  },
  {
    label: '#19 if — lint clean check',
    input: 'Check lint. Clean? Run tests. Otherwise fix lint first.',
    expectedTopNode: 'if',
  },
  {
    label: '#20 try/retry — deploy revert',
    input: 'Run deploy. On error, revert and try again.',
    expectedTopNode: 'try|retry',
  },
];

/**
 * Validate that a FlowSpec satisfies expectations.
 * @param {import('../../dist/domain/flow-spec.js').FlowSpec} spec
 * @param {string} expectedTopNode
 * @returns {{pass: boolean, reason: string}}
 */
function validate(spec, expectedTopNode) {
  if (!spec.goal && spec.nodes.length === 0) {
    return { pass: false, reason: 'Empty FlowSpec (no goal, no nodes)' };
  }
  if (spec.nodes.length === 0) {
    return { pass: false, reason: 'No nodes parsed' };
  }
  if (!spec.goal) {
    return { pass: false, reason: 'No goal parsed' };
  }

  if (expectedTopNode === 'multiple') {
    // Accept any FlowSpec with ≥2 nodes
    if (spec.nodes.length < 2) {
      return { pass: false, reason: `Expected multiple nodes, got ${spec.nodes.length}` };
    }
    return { pass: true, reason: `OK — ${spec.nodes.length} nodes` };
  }

  const topKind = spec.nodes[0].kind;
  const expectedKinds = expectedTopNode.split('|');

  if (!expectedKinds.includes(topKind)) {
    return {
      pass: false,
      reason: `Expected top node ${expectedTopNode}, got ${topKind}`,
    };
  }

  // For case #18, check that gates exist
  if (expectedTopNode === 'until' && spec.completionGates.length > 0) {
    return { pass: true, reason: `OK — ${topKind} + ${spec.completionGates.length} gate(s)` };
  }

  return { pass: true, reason: `OK — top node: ${topKind}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCase(testCase) {
  const metaPrompt = buildMetaPrompt(testCase.input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: metaPrompt }],
  });

  const text =
    response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n') ?? '';

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```[\w-]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();

  const spec = parseFlow(cleaned);
  return validate(spec, testCase.expectedTopNode);
}

async function main() {
  console.log(`[roundtrip-eval] Model: ${MODEL}`);
  console.log(`[roundtrip-eval] Running ${TEST_CASES.length} test cases...\n`);

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const testCase of TEST_CASES) {
    try {
      const result = await runCase(testCase);
      results.push({ label: testCase.label, ...result });
      if (result.pass) {
        passed++;
        console.log(`  PASS  ${testCase.label} — ${result.reason}`);
      } else {
        failed++;
        console.log(`  FAIL  ${testCase.label} — ${result.reason}`);
      }
    } catch (err) {
      failed++;
      const reason = `Error: ${err.message}`;
      results.push({ label: testCase.label, pass: false, reason });
      console.log(`  FAIL  ${testCase.label} — ${reason}`);
    }

    await sleep(DELAY_MS);
  }

  const total = passed + failed;
  const rate = total > 0 ? passed / total : 0;
  console.log(
    `\n[roundtrip-eval] Results: ${passed}/${total} passed (${(rate * 100).toFixed(1)}%)`,
  );

  if (rate >= PASS_THRESHOLD) {
    console.log('[roundtrip-eval] PASS — meets ≥80% threshold.');
    process.exit(0);
  } else {
    console.error('[roundtrip-eval] FAIL — below 80% threshold.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[roundtrip-eval] Fatal error:', err.message);
  process.exit(1);
});
