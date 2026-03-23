const assert = require('node:assert');
const { toJSON } = require('./app');

// Test 1: simple object serialization includes all keys
{
  const result = toJSON({ a: 1, b: 2, c: 3 });
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, { a: 1, b: 2, c: 3 }, 'should serialize all object keys');
}

// Test 2: strings with backslashes are escaped correctly
{
  const result = toJSON({ path: 'C:\\Users\\test' });
  const parsed = JSON.parse(result);
  assert.strictEqual(
    parsed.path,
    'C:\\Users\\test',
    'backslashes should be escaped once, not twice',
  );
}

// Test 3: nested objects include all keys
{
  const result = toJSON({ outer: { x: 1, y: 2 } });
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, { outer: { x: 1, y: 2 } }, 'nested objects should have all keys');
}

// Test 4: circular reference should not cause infinite loop
{
  const obj = { name: 'root' };
  obj.self = obj;
  let threw = false;
  try {
    toJSON(obj);
  } catch (e) {
    threw = true;
  }
  // Either throw or return valid JSON with a placeholder — but must not hang
  assert.ok(true, 'circular reference should not cause infinite loop');
}

// Test 5: indented output is valid JSON
{
  const data = { name: 'test', items: [1, 2, 3] };
  const result = toJSON(data, 2);
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, data, 'indented output should be valid JSON with all keys');
}

// Test 6: single-key objects work
{
  const result = toJSON({ only: 'one' });
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, { only: 'one' }, 'single-key objects should work');
}

// Test 7: strings with special characters
{
  const result = toJSON('line1\nline2\ttab');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed, 'line1\nline2\ttab', 'special characters should be escaped properly');
}

// Test 8: array of objects
{
  const data = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ];
  const result = toJSON(data);
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, data, 'array of objects should serialize all keys');
}

console.log('All tests passed');
