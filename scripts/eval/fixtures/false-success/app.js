class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this.listeners[event]) return this;
    // Bug 1: uses indexOf which compares by reference, but then splices at wrong index
    const idx = this.listeners[event].indexOf(callback);
    if (idx >= 0) {
      // Bug: removes idx+1 instead of idx
      this.listeners[event].splice(idx + 1, 1);
    }
    return this;
  }

  emit(event, ...args) {
    if (!this.listeners[event]) return false;
    // Bug 2: iterates in reverse order instead of insertion order
    const fns = this.listeners[event];
    for (let i = fns.length - 1; i >= 0; i--) {
      fns[i](...args);
    }
    return true;
  }

  once(event, callback) {
    const wrapper = (...args) => {
      // Bug 3: removes the original callback instead of the wrapper
      this.off(event, callback);
      callback(...args);
    };
    this.on(event, wrapper);
    return this;
  }
}

module.exports = { EventEmitter };
