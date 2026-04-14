// Config library v1 — callback-based API (DEPRECATED)
const fs = require('fs');

class ConfigV1 {
  constructor() {
    this.data = {};
  }

  load(path, callback) {
    try {
      const raw = fs.readFileSync(path, 'utf8');
      this.data = JSON.parse(raw);
      callback(null, this.data);
    } catch (err) {
      callback(err, null);
    }
  }

  get(key, callback) {
    const value = this.data[key];
    if (value === undefined) {
      callback(new Error(`Key "${key}" not found`), null);
    } else {
      callback(null, value);
    }
  }

  set(key, value, callback) {
    this.data[key] = value;
    callback(null);
  }

  save(path, callback) {
    try {
      fs.writeFileSync(path, JSON.stringify(this.data, null, 2));
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  getAll() {
    return { ...this.data };
  }
}

module.exports = { ConfigV1 };
