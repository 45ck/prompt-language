const { TaskQueue } = require('./app');
const assert = require('node:assert');

// Basic queue operations
const q = new TaskQueue();
q.add('task-a', 1);
q.add('task-b', 3);
q.add('task-c', 2);

// Higher priority should come first
const first = q.next();
assert.strictEqual(first.name, 'task-b', 'highest priority (3) should be first');
const second = q.next();
assert.strictEqual(second.name, 'task-c', 'priority 2 should be second');

// Complete a running task (not in queue)
// The task was already removed by next(), so complete should handle this
const q2 = new TaskQueue();
q2.add('x', 1);
q2.add('y', 2);
const running = q2.next();
assert.strictEqual(running.name, 'y');

// Complete a pending task (still in queue)
assert.strictEqual(q2.complete('x'), true, 'completing pending task should return true');
assert.strictEqual(q2.complete('nonexistent'), false);

// Stats
const q3 = new TaskQueue();
q3.add('a');
q3.add('b');
q3.add('c');
q3.next(); // removes 'a' (or first by priority)
q3.complete('b');
const stats = q3.stats();
assert.strictEqual(stats.pending, 1, 'one task still pending');
assert.strictEqual(stats.completed, 1, 'one task completed');
assert.strictEqual(stats.total, 3, 'total should be 3');

console.log('All tests passed');
