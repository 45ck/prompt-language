const assert = require('node:assert');
const { extractFields, generateValidator } = require('./app');

// Test 1: Flat object extraction
const schema1 = extractFields({ name: 'Alice', age: 30, active: true });
assert.deepStrictEqual(
  schema1,
  [
    { path: 'name', type: 'string' },
    { path: 'age', type: 'number' },
    { path: 'active', type: 'boolean' },
  ],
  'Flat object should produce three fields with correct types',
);

// Test 2: Nested object extraction — must recurse
const schema2 = extractFields({ user: { name: 'Bob', email: 'bob@test.com' } });
const paths2 = schema2.map((f) => f.path);
assert.ok(
  paths2.includes('user.name'),
  'Expected nested field "user.name" in schema, got paths: ' + paths2.join(', '),
);
assert.ok(
  paths2.includes('user.email'),
  'Expected nested field "user.email" in schema, got paths: ' + paths2.join(', '),
);

// Test 3: Deeply nested extraction
const schema3 = extractFields({ a: { b: { c: 42 } } });
const paths3 = schema3.map((f) => f.path);
assert.ok(
  paths3.includes('a.b.c'),
  'Expected deeply nested field "a.b.c" in schema, got paths: ' + paths3.join(', '),
);
const fieldC = schema3.find((f) => f.path === 'a.b.c');
assert.strictEqual(
  fieldC.type,
  'number',
  'Expected "a.b.c" to have type "number", got "' + (fieldC && fieldC.type) + '"',
);

// Test 4: Pipeline end-to-end — validator catches missing nested fields
const rawData = { server: { host: 'localhost', port: 8080 }, debug: false };
const schema4 = extractFields(rawData);
const validate4 = generateValidator(schema4);

// Valid data should pass
const result4a = validate4({ server: { host: 'localhost', port: 8080 }, debug: false });
assert.strictEqual(
  result4a.valid,
  true,
  'Valid data should pass validation, got errors: ' + result4a.errors.join('; '),
);

// Missing nested field should fail
const result4b = validate4({ server: { host: 'localhost' }, debug: false });
assert.strictEqual(result4b.valid, false, 'Data missing "server.port" should fail validation');

// Test 5: Array fields are detected correctly
const schema5 = extractFields({ items: [1, 2, 3], label: 'test' });
const arrayField = schema5.find((f) => f.path === 'items');
assert.strictEqual(arrayField.type, 'array', 'Array field should have type "array"');

console.log('All tests passed');
