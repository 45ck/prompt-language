const assert = require('node:assert');
const { EventEmitter } = require('./app');

// Basic on/emit
{
  const ee = new EventEmitter();
  let called = false;
  ee.on('test', () => {
    called = true;
  });
  ee.emit('test');
  assert.strictEqual(called, true, 'listener should be called');
}

// Emit returns false for no listeners
{
  const ee = new EventEmitter();
  assert.strictEqual(ee.emit('nope'), false);
}

// off removes the correct listener (Bug 1)
{
  const ee = new EventEmitter();
  const results = [];
  const fn1 = () => results.push('fn1');
  const fn2 = () => results.push('fn2');
  ee.on('data', fn1);
  ee.on('data', fn2);
  ee.off('data', fn1);
  ee.emit('data');
  assert.deepStrictEqual(results, ['fn2'], 'only fn2 should remain after removing fn1');
}

// Emit fires in insertion order (Bug 2)
{
  const ee = new EventEmitter();
  const order = [];
  ee.on('seq', () => order.push('first'));
  ee.on('seq', () => order.push('second'));
  ee.on('seq', () => order.push('third'));
  ee.emit('seq');
  assert.deepStrictEqual(
    order,
    ['first', 'second', 'third'],
    'listeners must fire in insertion order',
  );
}

// once fires exactly once (Bug 3)
{
  const ee = new EventEmitter();
  let count = 0;
  ee.once('ping', () => count++);
  ee.emit('ping');
  ee.emit('ping');
  assert.strictEqual(count, 1, 'once listener should fire exactly once');
}

// Chaining
{
  const ee = new EventEmitter();
  const result = ee.on('a', () => {}).on('b', () => {});
  assert.ok(result instanceof EventEmitter, 'on should return this for chaining');
}

console.log('All tests passed');
