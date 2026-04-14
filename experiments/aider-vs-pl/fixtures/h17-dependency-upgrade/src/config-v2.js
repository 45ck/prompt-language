// Config library v2 — modern sync/async API
const fs = require('fs');

class ConfigV2 {
  constructor() {
    this.data = {};
  }

  async load(path) {
    const raw = fs.readFileSync(path, 'utf8');
    this.data = JSON.parse(raw);
    return this.data;
  }

  get(key) {
    const value = this.data[key];
    if (value === undefined) {
      throw new Error(`Key "${key}" not found`);
    }
    return value;
  }

  set(key, value) {
    this.data[key] = value;
  }

  async save(path) {
    fs.writeFileSync(path, JSON.stringify(this.data, null, 2));
  }

  entries() {
    return Object.entries(this.data);
  }
}

module.exports = { ConfigV2 };
