// Task scheduler
class TaskQueue {
  constructor() {
    this.tasks = [];
    this.completed = [];
  }

  add(name, priority = 0) {
    this.tasks.push({ name, priority, status: 'pending' });
    // Sort by priority (higher first)
    this.tasks.sort((a, b) => a.priority - b.priority);
  }

  next() {
    if (this.tasks.length === 0) return null;
    const task = this.tasks.shift();
    task.status = 'running';
    return task;
  }

  complete(name) {
    const idx = this.tasks.findIndex((t) => t.name === name);
    if (idx >= 0) {
      const task = this.tasks.splice(idx, 1)[0];
      task.status = 'done';
      this.completed.push(task);
      return true;
    }
    return false;
  }

  pending() {
    return this.tasks.filter((t) => t.status === 'pending').length;
  }

  stats() {
    return {
      pending: this.pending(),
      completed: this.completed.length,
      total: this.tasks.length + this.completed.length,
    };
  }
}

module.exports = { TaskQueue };
