// Per-task oracle for tinymd. Loads the workspace and runs ONLY the
// test slice for the named task. Tests are written in dependency
// order so each test exercises only functions that have already been
// routed (or the function under test itself).
//
// Usage: node oracle/run-task.mjs <taskId> <workspacePath>
// Exit 0 on full pass, 1 on any failure.

import { resolve } from 'node:path';

const taskId = process.argv[2];
const workspacePath = process.argv[3];
if (!taskId || !workspacePath) {
  console.error('usage: run-task.mjs <taskId> <workspacePath>');
  process.exit(2);
}

let mod;
try {
  const abs = resolve(process.cwd(), workspacePath);
  mod = await import(`file://${abs.replace(/\\/g, '/')}`);
} catch (e) {
  console.error(`import failed: ${e.message}`);
  process.exit(1);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

function runCases(fn, cases, eq = deepEqual) {
  let pass = 0;
  const failures = [];
  for (const [args, expected] of cases) {
    let actual;
    try {
      actual = fn(...args);
    } catch (e) {
      failures.push(`fn(${JSON.stringify(args)}) threw: ${e.message}`);
      continue;
    }
    if (eq(actual, expected)) pass++;
    else failures.push(`fn(${JSON.stringify(args)}) = ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
  }
  return { passed: pass, total: cases.length, failures };
}

const TASKS = {
  escapeHtml: () => runCases(mod.escapeHtml, [
    [['hello'], 'hello'],
    [['<b>'], '&lt;b&gt;'],
    [['a & b'], 'a &amp; b'],
    [['"quoted"'], '&quot;quoted&quot;'],
    [["it's"], 'it&#39;s'],
    [['a<b>c&d"e\'f'], 'a&lt;b&gt;c&amp;d&quot;e&#39;f'],
    [[''], ''],
    [['no special'], 'no special'],
    [['&amp;'], '&amp;amp;'], // adversarial: pre-encoded entity should re-escape
  ]),
  parseHeading: () => runCases(mod.parseHeading, [
    [['# Hello'], { level: 1, text: 'Hello' }],
    [['## Hello'], { level: 2, text: 'Hello' }],
    [['###### Six'], { level: 6, text: 'Six' }],
    [['####### TooMany'], null], // 7 # is not a valid heading
    [['Not a heading'], null],
    [['#NoSpace'], null],
    [['# '], { level: 1, text: '' }],
    [[''], null],
    [['### multi word title'], { level: 3, text: 'multi word title' }],
  ]),
  parseListItem: () => runCases(mod.parseListItem, [
    [['- item'], 'item'],
    [['- multi word item'], 'multi word item'],
    [['Not a list'], null],
    [['-item'], null], // no space after -
    [['  - indented'], null], // indentation not supported in this subset
    [['- '], ''],
    [[''], null],
  ]),
  isFenceLine: () => runCases(mod.isFenceLine, [
    [['```'], true],
    [['```js'], true],
    [['``'], false],
    [['plain text'], false],
    [[''], false],
    [['  ```'], false], // leading whitespace doesn't count
    [['``` '], true],
  ]),
  parseInline: () => runCases(mod.parseInline, [
    [['plain text'], 'plain text'],
    [['**bold**'], '<strong>bold</strong>'],
    [['*em*'], '<em>em</em>'],
    [['`code`'], '<code>code</code>'],
    [['[link](url)'], '<a href="url">link</a>'],
    [['mix **b** and *e* and `c`'], 'mix <strong>b</strong> and <em>e</em> and <code>c</code>'],
    [['<b>raw</b>'], '&lt;b&gt;raw&lt;/b&gt;'], // HTML escape happens
    [['Visit [GitHub](https://github.com).'], 'Visit <a href="https://github.com">GitHub</a>.'],
    [[''], ''],
  ]),
  tokenize: () => runCases(mod.tokenize, [
    [['# Hello'], [{ type: 'heading', level: 1, text: 'Hello' }]],
    [['plain'], [{ type: 'paragraph', text: 'plain' }]],
    [['- a\n- b'], [{ type: 'list-item', text: 'a' }, { type: 'list-item', text: 'b' }]],
    [['```\ncode\n```'], [{ type: 'codeblock', text: 'code' }]],
    [[''], []],
    [['\n\n'], []],
    [['# h\n\npara'], [{ type: 'heading', level: 1, text: 'h' }, { type: 'paragraph', text: 'para' }]],
    [['line one\nline two'], [{ type: 'paragraph', text: 'line one line two' }]],
  ]),
  renderToken: () => runCases(mod.renderToken, [
    [[{ type: 'heading', level: 1, text: 'x' }], '<h1>x</h1>'],
    [[{ type: 'heading', level: 6, text: 'six' }], '<h6>six</h6>'],
    [[{ type: 'paragraph', text: 'p' }], '<p>p</p>'],
    [[{ type: 'codeblock', text: '<b>raw</b>' }], '<pre><code>&lt;b&gt;raw&lt;/b&gt;</code></pre>'],
    [[{ type: 'list-item', text: 'item' }], '<li>item</li>'],
    [[{ type: 'unknown', text: 'x' }], ''],
  ]),
  groupListTokens: () => runCases(mod.groupListTokens, [
    [[[]], []],
    [[[{ type: 'paragraph', text: 'p' }]], [{ type: 'paragraph', text: 'p' }]],
    [
      [[{ type: 'list-item', text: 'a' }, { type: 'list-item', text: 'b' }]],
      [{ type: 'list', items: [{ type: 'list-item', text: 'a' }, { type: 'list-item', text: 'b' }] }],
    ],
    [
      [[{ type: 'heading', level: 1, text: 'h' }, { type: 'list-item', text: 'a' }, { type: 'paragraph', text: 'p' }]],
      [{ type: 'heading', level: 1, text: 'h' }, { type: 'list', items: [{ type: 'list-item', text: 'a' }] }, { type: 'paragraph', text: 'p' }],
    ],
  ]),
};

const tester = TASKS[taskId];
if (!tester) { console.error(`unknown task: ${taskId}`); process.exit(2); }
const r = tester();
const status = { taskId, passed: r.passed, total: r.total, oraclePass: r.passed === r.total, failures: r.failures };
process.stdout.write(JSON.stringify(status));
process.exit(status.oraclePass ? 0 : 1);
