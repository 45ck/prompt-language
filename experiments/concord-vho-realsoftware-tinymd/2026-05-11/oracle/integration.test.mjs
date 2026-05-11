// Integration tests: markdown → HTML on the assembled module.
// Usage: node oracle/integration.test.mjs <pathToTinymdMjs>
// Exit 0 on full pass, 1 on any failure.

import { resolve } from 'node:path';

const implPath = process.argv[2];
if (!implPath) {
  console.error('usage: integration.test.mjs <pathToTinymdMjs>');
  process.exit(2);
}

let convert;
try {
  const mod = await import(`file://${resolve(process.cwd(), implPath).replace(/\\/g, '/')}`);
  convert = mod.convert;
} catch (e) {
  console.error(`import failed: ${e.message}`);
  process.exit(1);
}

const cases = [
  // Headings
  ['# Hello', '<h1>Hello</h1>'],
  ['## Hello\n### World', '<h2>Hello</h2>\n<h3>World</h3>'],
  ['###### Six', '<h6>Six</h6>'],
  // Paragraphs
  ['This is a paragraph.', '<p>This is a paragraph.</p>'],
  ['Line one\nline two', '<p>Line one line two</p>'],
  // Bold + italic + code inline
  [
    '**bold** and *em* and `code`',
    '<p><strong>bold</strong> and <em>em</em> and <code>code</code></p>',
  ],
  // Link
  [
    'Visit [the site](https://example.com).',
    '<p>Visit <a href="https://example.com">the site</a>.</p>',
  ],
  // Code block
  ['```\nlet x = 1;\n```', '<pre><code>let x = 1;</code></pre>'],
  // Unordered list
  ['- one\n- two\n- three', '<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>'],
  // Mixed
  [
    '# Title\n\nintro paragraph.\n\n- a\n- b',
    '<h1>Title</h1>\n<p>intro paragraph.</p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>',
  ],
  // HTML escaping in paragraph
  ['use < and > and &', '<p>use &lt; and &gt; and &amp;</p>'],
  // HTML escaping in code block — verbatim per spec (only ampersand etc are escaped)
  ['```\n<b>raw</b>\n```', '<pre><code>&lt;b&gt;raw&lt;/b&gt;</code></pre>'],
  // Heading with inline formatting
  ['## **strong** title', '<h2><strong>strong</strong> title</h2>'],
];

let pass = 0;
const failures = [];
for (const [input, expected] of cases) {
  let actual;
  try {
    actual = convert(input);
  } catch (e) {
    failures.push(`convert(${JSON.stringify(input)}) threw: ${e.message}`);
    continue;
  }
  if (actual === expected) {
    pass++;
  } else {
    failures.push(
      `convert(${JSON.stringify(input)}):\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
  }
}

const total = cases.length;
console.log(JSON.stringify({ implPath, passed: pass, total, oraclePass: pass === total }));
if (failures.length) console.error(failures.join('\n\n'));
process.exit(pass === total ? 0 : 1);
