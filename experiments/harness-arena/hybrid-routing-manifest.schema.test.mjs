import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readJson('hybrid-routing-manifest.schema.json');
const sample = readJson('hybrid-routing-manifest.v2.ollama-local.sample.json');

const routingMetadataFields = [
  'runner',
  'model',
  'providerClass',
  'routeDecision',
  'routeTrigger',
  'riskLevel',
  'ambiguityLevel',
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(here, relativePath), 'utf8'));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireFields(requiredFields, value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) {
      errors.push(`${path}.${field} is required by schema`);
    }
  }
}

function validateKnownFields(schemaNode, value, path, errors) {
  if (schemaNode.additionalProperties !== false || !isRecord(value)) {
    return;
  }

  const allowedFields = Object.keys(schemaNode.properties);

  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      errors.push(`${path}.${field} is not declared in schema`);
    }
  }
}

function validateEnum(schemaNode, value, path, errors) {
  if (!schemaNode.enum.includes(value)) {
    errors.push(`${path} must be one of ${schemaNode.enum.join(', ')}`);
  }
}

function validateSchemaVersion(manifest, errors) {
  const expectedVersion = schema.properties.schemaVersion.const;

  if (manifest.schemaVersion !== expectedVersion) {
    errors.push(`manifest.schemaVersion must be ${expectedVersion}`);
  }
}

function validateStep(step, path, errors) {
  const stepSchema = schema.properties.steps.items;
  const stepProperties = stepSchema.properties;

  requireFields(stepSchema.required, step, path, errors);
  validateKnownFields(stepSchema, step, path, errors);
  validateEnum(stepProperties.runner, step.runner, `${path}.runner`, errors);
  validateEnum(stepProperties.providerClass, step.providerClass, `${path}.providerClass`, errors);
  validateEnum(stepProperties.routeDecision, step.routeDecision, `${path}.routeDecision`, errors);
  validateEnum(stepProperties.riskLevel, step.riskLevel, `${path}.riskLevel`, errors);
  validateEnum(
    stepProperties.ambiguityLevel,
    step.ambiguityLevel,
    `${path}.ambiguityLevel`,
    errors,
  );
}

function validateSteps(steps, errors) {
  const stepsSchema = schema.properties.steps;

  if (!Array.isArray(steps)) {
    errors.push('manifest.steps must be an array');
    return;
  }

  if (steps.length < stepsSchema.minItems) {
    errors.push(`manifest.steps must contain at least ${stepsSchema.minItems} item`);
  }

  for (const [index, step] of steps.entries()) {
    validateStep(step, `manifest.steps[${index}]`, errors);
  }
}

function validateOracle(oracle, errors) {
  const oracleSchema = schema.properties.oracle;

  requireFields(oracleSchema.required, oracle, 'manifest.oracle', errors);
  validateKnownFields(oracleSchema, oracle, 'manifest.oracle', errors);
}

function validateOptionalObject(schemaNode, value, path, errors) {
  if (value === undefined) {
    return;
  }

  validateKnownFields(schemaNode, value, path, errors);
}

function validateManifestShape(manifest) {
  const errors = [];

  requireFields(schema.required, manifest, 'manifest', errors);
  validateKnownFields(schema, manifest, 'manifest', errors);
  validateSchemaVersion(manifest, errors);
  validateEnum(schema.properties.arm, manifest.arm, 'manifest.arm', errors);
  validateOptionalObject(schema.properties.budget, manifest.budget, 'manifest.budget', errors);
  validateSteps(manifest.steps, errors);
  validateOracle(manifest.oracle, errors);
  validateOptionalObject(
    schema.properties.classification,
    manifest.classification,
    'manifest.classification',
    errors,
  );

  return errors;
}

test('schema version 2 accepts a synthetic Ollama local lane', () => {
  const [step] = sample.steps;
  const stepSchema = schema.properties.steps.items.properties;

  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.equal(sample.schemaVersion, 2);
  assert.equal(step.runner, 'ollama');
  assert.equal(step.providerClass, 'local');
  assert.equal(step.routeDecision, 'local');
  assert.ok(stepSchema.runner.enum.includes('ollama'));
  assert.ok(stepSchema.providerClass.enum.includes('local'));
  assert.ok(stepSchema.routeDecision.enum.includes('local'));
  assert.deepEqual(validateManifestShape(sample), []);
});

test('schema requires routing metadata for every step', () => {
  const requiredFields = schema.properties.steps.items.required;

  for (const field of routingMetadataFields) {
    assert.ok(requiredFields.includes(field), `${field} must stay required`);
  }
});

test('rejects a manifest step missing routing metadata', () => {
  const invalidManifest = cloneJson(sample);

  delete invalidManifest.steps[0].routeTrigger;

  assert.deepEqual(validateManifestShape(invalidManifest), [
    'manifest.steps[0].routeTrigger is required by schema',
  ]);
});
