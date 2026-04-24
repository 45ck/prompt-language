const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const contract = JSON.parse(fs.readFileSync('contract.json', 'utf8'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sampleValue(type, field) {
  if (type === 'string') {
    return `${field}-value`;
  }
  if (type === 'number') {
    return 7;
  }
  if (type === 'boolean') {
    return true;
  }
  throw new Error(`unsupported type ${type}`);
}

function falsyValue(type) {
  if (type === 'string') {
    return '';
  }
  if (type === 'number') {
    return 0;
  }
  if (type === 'boolean') {
    return false;
  }
  throw new Error(`unsupported type ${type}`);
}

function loadModule(file) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: file,
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(output, sandbox, { filename: file });
  return { source, exports: sandbox.module.exports };
}

function checkNamedExports(moduleSpec, loaded) {
  assert(
    new RegExp(`export\\s+interface\\s+${moduleSpec.interfaceName}\\b`).test(loaded.source),
    `missing exported interface ${moduleSpec.interfaceName}`,
  );
  assert(
    typeof loaded.exports[moduleSpec.factoryName] === 'function',
    `missing exported factory ${moduleSpec.factoryName}`,
  );
}

function checkPropertySet(moduleSpec, factory) {
  const result = factory({});
  assert(result && typeof result === 'object', 'factory must return object');
  const expected = Object.keys(moduleSpec.fields).sort();
  const actual = Object.keys(result).sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `wrong property set: expected ${expected.join(', ')}, got ${actual.join(', ')}`,
  );
}

function checkDefaults(moduleSpec, factory) {
  const result = factory({});
  for (const [field, rule] of Object.entries(moduleSpec.fields)) {
    assert(
      Object.is(result[field], rule.default),
      `${field} default expected ${JSON.stringify(rule.default)}, got ${JSON.stringify(result[field])}`,
    );
  }
}

function checkPartialOverride(moduleSpec, factory) {
  const input = {};
  const expected = {};
  for (const [field, rule] of Object.entries(moduleSpec.fields)) {
    input[field] = sampleValue(rule.type, field);
    expected[field] = input[field];
  }
  const result = factory(input);
  for (const [field, value] of Object.entries(expected)) {
    assert(
      Object.is(result[field], value),
      `${field} override expected ${JSON.stringify(value)}, got ${JSON.stringify(result[field])}`,
    );
  }
}

function checkFalsyPreservation(moduleSpec, factory) {
  const input = {};
  for (const [field, rule] of Object.entries(moduleSpec.fields)) {
    input[field] = falsyValue(rule.type);
  }
  const result = factory(input);
  for (const [field, rule] of Object.entries(moduleSpec.fields)) {
    const expected = falsyValue(rule.type);
    assert(
      Object.is(result[field], expected),
      `${field} falsy value expected ${JSON.stringify(expected)}, got ${JSON.stringify(result[field])}`,
    );
  }
}

const checks = [
  ['named exports', checkNamedExports],
  [
    'property set',
    (moduleSpec, loaded) => checkPropertySet(moduleSpec, loaded.exports[moduleSpec.factoryName]),
  ],
  [
    'defaults',
    (moduleSpec, loaded) => checkDefaults(moduleSpec, loaded.exports[moduleSpec.factoryName]),
  ],
  [
    'partial overrides',
    (moduleSpec, loaded) =>
      checkPartialOverride(moduleSpec, loaded.exports[moduleSpec.factoryName]),
  ],
  [
    'falsy preservation',
    (moduleSpec, loaded) =>
      checkFalsyPreservation(moduleSpec, loaded.exports[moduleSpec.factoryName]),
  ],
];

let passed = 0;
let failed = 0;

for (const moduleSpec of contract.modules) {
  let loaded;
  try {
    loaded = loadModule(path.join(process.cwd(), moduleSpec.file));
  } catch (error) {
    failed += checks.length;
    console.log(`FAIL ${moduleSpec.file} load: ${error.message}`);
    continue;
  }

  for (const [label, check] of checks) {
    try {
      check(moduleSpec, loaded);
      passed += 1;
      console.log(`PASS ${moduleSpec.file} ${label}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${moduleSpec.file} ${label}: ${error.message}`);
    }
  }
}

console.log(`Results: ${passed}/${passed + failed} passed`);

if (failed > 0) {
  process.exitCode = 1;
}
