#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const EXPECTED_EXPORTS = [
  'reset',
  'listCustomers',
  'createCustomer',
  'readCustomer',
  'detailCustomer',
  'editCustomer',
  'deleteCustomer',
  'listAssets',
  'createAsset',
  'readAsset',
  'detailAsset',
  'editAsset',
  'deleteAsset',
  'listWorkOrders',
  'createWorkOrder',
  'readWorkOrder',
  'detailWorkOrder',
  'editWorkOrder',
  'deleteWorkOrder',
];

function stubModule() {
  const functionBodies = EXPECTED_EXPORTS.map(
    (name) => `function ${name}() { return notImplemented('${name}'); }`,
  ).join('\n');
  return `${[
    "'use strict';",
    '',
    "function notImplemented(name) { throw new Error(name + ' not implemented'); }",
    '',
    functionBodies,
    '',
    'module.exports = {',
    ...EXPECTED_EXPORTS.map((name) => `  ${name},`),
    '};',
  ].join('\n')}\n`;
}

function wrapperAppendix() {
  const exportLines = EXPECTED_EXPORTS.map(
    (name) =>
      `  ${name}: typeof ${name} === 'function' ? ${name} : (typeof __plExportSurfaceCurrent.${name} === 'function' ? __plExportSurfaceCurrent.${name} : __plMissingExport('${name}')),`,
  ).join('\n');

  return `\n// PL_EXPORT_SURFACE_NORMALIZED\n(() => {\n  const __plExportSurfaceCurrent = module.exports && typeof module.exports === 'object' ? module.exports : {};\n  const __plMissingExport = (name) => function missingExport() { throw new Error(name + ' not implemented'); };\n  module.exports = {\n${exportLines}\n  };\n})();\n`;
}

function inspectExports(domainPath) {
  try {
    delete require.cache[require.resolve(domainPath)];
    const exportsObject = require(domainPath);
    const missing = EXPECTED_EXPORTS.filter((name) => !(name in exportsObject));
    const nonFunctions = EXPECTED_EXPORTS.filter(
      (name) => name in exportsObject && typeof exportsObject[name] !== 'function',
    );
    const extras = Object.keys(exportsObject).filter((name) => !EXPECTED_EXPORTS.includes(name));
    return {
      loadError: null,
      missing,
      nonFunctions,
      extras,
      exact:
        missing.length === 0 &&
        nonFunctions.length === 0 &&
        extras.length === 0 &&
        Object.keys(exportsObject).length === EXPECTED_EXPORTS.length,
    };
  } catch (error) {
    return {
      loadError: error instanceof Error ? error.message : String(error),
      missing: EXPECTED_EXPORTS,
      nonFunctions: [],
      extras: [],
      exact: false,
    };
  }
}

function normalizeDomainExportSurface(workspacePath) {
  const workspace = resolve(workspacePath);
  const domainPath = join(workspace, 'src', 'domain.js');
  mkdirSync(join(workspace, 'src'), { recursive: true });

  if (!existsSync(domainPath)) {
    writeFileSync(domainPath, stubModule(), 'utf8');
    return {
      changed: true,
      mode: 'stubbed-missing-file',
      path: domainPath,
      before: null,
      after: inspectExports(domainPath),
    };
  }

  const before = inspectExports(domainPath);
  if (before.exact) {
    return { changed: false, mode: 'already-exact', path: domainPath, before, after: before };
  }

  if (before.loadError) {
    writeFileSync(domainPath, stubModule(), 'utf8');
    return {
      changed: true,
      mode: 'stubbed-unloadable-module',
      path: domainPath,
      before,
      after: inspectExports(domainPath),
    };
  }

  const current = readFileSync(domainPath, 'utf8');
  writeFileSync(domainPath, `${current.replace(/\s*$/, '')}${wrapperAppendix()}`, 'utf8');
  return {
    changed: true,
    mode: 'appended-export-wrapper',
    path: domainPath,
    before,
    after: inspectExports(domainPath),
  };
}

if (require.main === module) {
  const result = normalizeDomainExportSurface(process.argv[2] ?? 'workspace/fscrud-01');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.after?.exact ? 0 : 1);
}

module.exports = {
  EXPECTED_EXPORTS,
  normalizeDomainExportSurface,
};
