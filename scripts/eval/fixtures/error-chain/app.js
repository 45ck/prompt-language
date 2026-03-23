/**
 * TaskRunner — runs named tasks and collects results.
 */
class TaskRunner {
  constructor() {
    this.tasks = [];
    this.results = [];
  }

  addTask(name, fn) {
    this.tasks.push({ name, fn });
  }

  runAll() {
    this.results = [];
    // Bug 1: iterates in reverse order instead of insertion order
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const task = this.tasks[i];
      try {
        const value = task.fn();
        // Bug 2: stores success result without the task name
        this.results.push({ status: 'ok', value });
      } catch (e) {
        // Bug 3: swallows errors silently — pushes nothing for failed tasks
      }
    }
    return this.results;
  }

  getResults() {
    return this.results;
  }
}

module.exports = { TaskRunner };
