#!/usr/bin/env node
/**
 * smoke-ci.mjs — CI-safe smoke tests that verify plugin machinery
 * without requiring a Claude CLI or API key.
 *
 * Tests the plugin pipeline: parse -> state -> advance -> render
 * plus plugin installation artifacts.
 *
 * Usage:
 *   node scripts/eval/smoke-ci.mjs
 *   npm run eval:smoke:ci
 */

import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..', '..');

/** Convert an absolute file path to a file:// URL for cross-platform dynamic import. */
function distUrl(relativePath) {
  return pathToFileURL(join(ROOT, 'dist', relativePath)).href;
}

// ── Dynamic imports from dist/ ──────────────────────────────────────

const { parseFlow } = await import(distUrl('application/parse-flow.js'));
const {
  createSessionState,
  advanceNode,
  updateVariable,
  markCompleted,
  isFlowComplete,
  allGatesPassing,
} = await import(distUrl('domain/session-state.js'));
const { renderFlow } = await import(distUrl('domain/render-flow.js'));
const { interpolate } = await import(distUrl('domain/interpolate.js'));
const { splitIterable } = await import(distUrl('domain/split-iterable.js'));
const { resolveCurrentNode, advancePath } = await import(distUrl('application/advance-flow.js'));
const { evaluateCondition } = await import(distUrl('domain/evaluate-condition.js'));
const { lintFlow } = await import(distUrl('domain/lint-flow.js'));
const { flowComplexityScore } = await import(distUrl('domain/flow-complexity.js'));

// ── Test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Test 1: Parse all 12 node kinds ─────────────────────────────────
// Each block-level kind is parsed separately because while/until/retry
// consume the "end" keyword, terminating the parent block.

console.log('\n1. Parse: all 12 node kinds');

// Leaf nodes in one flow
const leafDsl = `Goal: Leaf nodes

flow:
  let greeting = "hello"
  var count = run "echo 5"
  prompt: Say hello
  run: echo done
  await "worker"

done when:
  tests_pass
`;
const leafSpec = parseFlow(leafDsl);
assert('1a: goal parsed', leafSpec.goal === 'Leaf nodes');
assert('1b: leaf nodes count', leafSpec.nodes.length === 5, `${leafSpec.nodes.length} nodes`);
assert('1c: has gates', leafSpec.completionGates.length > 0);

// Block-level nodes parsed individually
const blockFlows = {
  while: 'Goal: g\n\nflow:\n  while tests_fail max 3\n    prompt: Fix it\n  end',
  until: 'Goal: g\n\nflow:\n  until tests_pass max 3\n    prompt: Try again\n  end',
  retry: 'Goal: g\n\nflow:\n  retry max 2\n    run: npm test\n  end',
  if: 'Goal: g\n\nflow:\n  if command_succeeded\n    prompt: Great\n  else\n    prompt: Fallback\n  end',
  try: 'Goal: g\n\nflow:\n  try\n    run: risky\n  catch\n    prompt: Handle error\n  finally\n    run: cleanup\n  end',
  foreach: 'Goal: g\n\nflow:\n  foreach item in "a b c"\n    prompt: Process item\n  end',
  spawn: 'Goal: g\n\nflow:\n  spawn "worker"\n    prompt: Do work\n  end',
  break: 'Goal: g\n\nflow:\n  while true max 2\n    break\n  end',
};

// Collect all kinds
const allKinds = new Set();
function collectKinds(nodes) {
  for (const n of nodes) {
    allKinds.add(n.kind);
    if ('body' in n && Array.isArray(n.body)) collectKinds(n.body);
    if ('thenBranch' in n && Array.isArray(n.thenBranch)) collectKinds(n.thenBranch);
    if ('elseBranch' in n && Array.isArray(n.elseBranch)) collectKinds(n.elseBranch);
    if ('catchBody' in n && Array.isArray(n.catchBody)) collectKinds(n.catchBody);
    if ('finallyBody' in n && Array.isArray(n.finallyBody)) collectKinds(n.finallyBody);
  }
}

collectKinds(leafSpec.nodes);
for (const [kind, dsl] of Object.entries(blockFlows)) {
  const spec = parseFlow(dsl);
  assert(`1d: "${kind}" flow parsed`, spec.nodes.length > 0);
  collectKinds(spec.nodes);
}

const expectedKinds = [
  'let',
  'prompt',
  'run',
  'while',
  'until',
  'retry',
  'if',
  'try',
  'foreach',
  'spawn',
  'await',
  'break',
];
for (const kind of expectedKinds) {
  assert(`1e: node kind "${kind}" found`, allKinds.has(kind));
}

// Use the leaf spec for subsequent tests
const spec = leafSpec;

// ── Test 2: State creation and serialization ────────────────────────

console.log('\n2. State: creation and serialization');

const state = createSessionState('ci-test-session', spec);
assert('2a: state created', state !== null && state !== undefined);
assert('2b: sessionId', state.sessionId === 'ci-test-session');
assert('2c: status is active', state.status === 'active');
assert('2d: path starts at [0]', JSON.stringify(state.currentNodePath) === '[0]');
assert('2e: variables empty', Object.keys(state.variables).length === 0);

// Round-trip through JSON
const serialized = JSON.stringify(state);
const deserialized = JSON.parse(serialized);
assert('2f: JSON round-trip preserves sessionId', deserialized.sessionId === state.sessionId);
assert('2g: JSON round-trip preserves status', deserialized.status === state.status);
assert(
  '2h: JSON round-trip preserves path',
  JSON.stringify(deserialized.currentNodePath) === JSON.stringify(state.currentNodePath),
);

// ── Test 3: Node resolution and path advancement ────────────────────

console.log('\n3. Advance: node resolution and path operations');

const currentNode = resolveCurrentNode(spec.nodes, state.currentNodePath);
assert('3a: resolve first node', currentNode !== null);
assert('3b: first node is let', currentNode?.kind === 'let');

// Advance path
const nextPath = advancePath(state.currentNodePath);
assert(
  '3c: advance path increments',
  JSON.stringify(nextPath) === '[1]',
  `got ${JSON.stringify(nextPath)}`,
);

// advanceNode creates new state
const advancedState = advanceNode(state, nextPath);
assert('3d: advanceNode returns new state', advancedState !== state, 'immutable');
assert('3e: advanced path is [1]', JSON.stringify(advancedState.currentNodePath) === '[1]');

// Update variable
const withVar = updateVariable(advancedState, 'greeting', 'hello');
assert('3f: variable set', withVar.variables.greeting === 'hello');
assert('3g: original unchanged', advancedState.variables.greeting === undefined);

// ── Test 4: Render flow visualization ───────────────────────────────

console.log('\n4. Render: flow visualization');

const rendered = renderFlow(state);
assert('4a: render returns string', typeof rendered === 'string');
assert('4b: render non-empty', rendered.length > 0);
assert('4c: render contains prompt', rendered.includes('prompt') || rendered.includes('Say hello'));
assert('4d: render contains current marker', rendered.includes('<-- current'));

// Render at advanced position
const rendered2 = renderFlow(advancedState);
assert('4e: render at different position', rendered2 !== rendered);

// ── Test 5: Interpolation ───────────────────────────────────────────

console.log('\n5. Interpolation: variable substitution');

const vars = { name: 'world', count: '42' };
assert('5a: basic interpolation', interpolate('Hello ${name}!', vars) === 'Hello world!');
assert('5b: multiple vars', interpolate('${name} ${count}', vars) === 'world 42');
assert('5c: unknown var unchanged', interpolate('${missing}', vars) === '${missing}');
assert('5d: no vars passthrough', interpolate('plain text', vars) === 'plain text');

// ── Test 6: Split iterable ──────────────────────────────────────────

console.log('\n6. Split iterable: input parsing');

assert('6a: JSON array', JSON.stringify(splitIterable('["a","b","c"]')) === '["a","b","c"]');
assert('6b: whitespace split', JSON.stringify(splitIterable('a b c')) === '["a","b","c"]');
assert('6c: newline split', JSON.stringify(splitIterable('a\nb\nc')) === '["a","b","c"]');

// ── Test 7: Condition evaluation ────────────────────────────────────

console.log('\n7. Condition evaluation');

const condVars = {
  command_failed: true,
  command_succeeded: false,
  count: '5',
  status: 'ready',
};

assert('7a: boolean true', evaluateCondition('command_failed', condVars) === true);
assert('7b: boolean false', evaluateCondition('command_succeeded', condVars) === false);
assert('7c: not prefix', evaluateCondition('not command_succeeded', condVars) === true);
assert('7d: comparison ==', evaluateCondition('${count} == 5', condVars) === true);
assert('7e: comparison >', evaluateCondition('${count} > 3', condVars) === true);
assert(
  '7f: and operator',
  evaluateCondition('command_failed and not command_succeeded', condVars) === true,
);
assert(
  '7g: or operator',
  evaluateCondition('command_succeeded or command_failed', condVars) === true,
);
assert('7h: unknown var returns null', evaluateCondition('unknown_predicate', condVars) === null);

// ── Test 8: Lint and complexity ─────────────────────────────────────

console.log('\n8. Lint and complexity analysis');

const lintResult = lintFlow(spec);
assert('8a: lintFlow returns array', Array.isArray(lintResult));

const complexity = flowComplexityScore(spec);
assert('8b: complexity is number', typeof complexity === 'number');
assert('8c: complexity in range [1..5]', complexity >= 1 && complexity <= 5, `score=${complexity}`);

// ── Test 9: Gate and completion ─────────────────────────────────────

console.log('\n9. Gate and completion checks');

assert('9a: not complete initially', !isFlowComplete(state));
assert('9b: gates not passing initially', !allGatesPassing(state));

const completedState = markCompleted(state);
assert('9c: markCompleted sets status', completedState.status === 'completed');
assert('9d: completed state is flow-complete', isFlowComplete(completedState));

// ── Test 10: Plugin artifacts ───────────────────────────────────────

console.log('\n10. Plugin artifacts');

const pluginJsonPath = join(ROOT, '.claude-plugin', 'plugin.json');
const hooksJsonPath = join(ROOT, 'hooks', 'hooks.json');

assert('10a: plugin.json exists', existsSync(pluginJsonPath));
assert('10b: hooks.json exists', existsSync(hooksJsonPath));

if (existsSync(pluginJsonPath)) {
  const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));
  assert('10c: plugin.json has name', pluginJson.name === 'prompt-language');
  assert(
    '10d: plugin.json author is object',
    typeof pluginJson.author === 'object' && pluginJson.author.name,
  );
}

if (existsSync(hooksJsonPath)) {
  const hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));
  assert('10e: hooks.json has hooks', hooksJson.hooks !== undefined);
  const hookNames = Object.keys(hooksJson.hooks);
  assert('10f: has UserPromptSubmit hook', hookNames.includes('UserPromptSubmit'));
  assert('10g: has Stop hook', hookNames.includes('Stop'));
  assert('10h: has PostToolUse hook', hookNames.includes('PostToolUse'));
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`CI Smoke: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
