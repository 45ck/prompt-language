// Simple in-memory database with query counting

class Database {
  constructor() {
    this.tables = {};
    this.queryCount = 0;
  }

  createTable(name) {
    this.tables[name] = [];
  }

  insert(table, record) {
    const id = this.tables[table].length + 1;
    this.tables[table].push({ id, ...record });
    return id;
  }

  findAll(table) {
    this.queryCount++;
    return [...this.tables[table]];
  }

  findById(table, id) {
    this.queryCount++;
    return this.tables[table].find((r) => r.id === id) || null;
  }

  findByIds(table, ids) {
    this.queryCount++;
    return this.tables[table].filter((r) => ids.includes(r.id));
  }

  findWhere(table, key, value) {
    this.queryCount++;
    return this.tables[table].filter((r) => r[key] === value);
  }

  resetQueryCount() {
    this.queryCount = 0;
  }

  getQueryCount() {
    return this.queryCount;
  }
}

module.exports = { Database };
