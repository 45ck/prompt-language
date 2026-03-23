const assert = require('node:assert');
const { TaskRunner } = require('./app');

// Test 1: tasks run in insertion order
{
  const runner = new TaskRunner();
  const order = [];
  runner.addTask('first', () => {
    order.push('first');
    return 1;
  });
  runner.addTask('second', () => {
    order.push('second');
    return 2;
  });
  runner.addTask('third', () => {
    order.push('third');
    return 3;
  });
  runner.runAll();
  assert.deepStrictEqual(order, ['first', 'second', 'third'], 'tasks must run in insertion order');
}

// Test 2: results include task names
{
  const runner = new TaskRunner();
  runner.addTask('alpha', () => 10);
  runner.addTask('beta', () => 20);
  const results = runner.runAll();
  assert.strictEqual(results[0].name, 'alpha', 'first result should have name alpha');
  assert.strictEqual(results[1].name, 'beta', 'second result should have name beta');
}

// Test 3: failed tasks are recorded with error info
{
  const runner = new TaskRunner();
  runner.addTask('good', () => 'ok');
  runner.addTask('bad', () => {
    throw new Error('task failed');
  });
  runner.addTask('also-good', () => 'fine');
  const results = runner.runAll();
  assert.strictEqual(results.length, 3, 'all tasks should have results even if they fail');
  assert.strictEqual(results[1].status, 'error', 'failed task should have status error');
  assert.ok(results[1].error, 'failed task should have error message');
}

// Test 4: successful task result format
{
  const runner = new TaskRunner();
  runner.addTask('compute', () => 42);
  const results = runner.runAll();
  assert.deepStrictEqual(
    results[0],
    { name: 'compute', status: 'ok', value: 42 },
    'success result should have name, status, and value',
  );
}

// Test 5: getResults returns same as runAll
{
  const runner = new TaskRunner();
  runner.addTask('x', () => 1);
  const fromRun = runner.runAll();
  const fromGet = runner.getResults();
  assert.deepStrictEqual(fromRun, fromGet, 'getResults should return the same results');
}

// Test 6: empty runner returns empty results
{
  const runner = new TaskRunner();
  const results = runner.runAll();
  assert.deepStrictEqual(results, [], 'no tasks should give empty results');
}

// Test 7: error result includes error message string
{
  const runner = new TaskRunner();
  runner.addTask('fail-task', () => {
    throw new Error('broken');
  });
  const results = runner.runAll();
  assert.strictEqual(results[0].name, 'fail-task');
  assert.strictEqual(results[0].status, 'error');
  assert.strictEqual(typeof results[0].error, 'string', 'error should be a string message');
  assert.ok(results[0].error.includes('broken'), 'error message should contain the thrown message');
}

console.log('All tests passed');
