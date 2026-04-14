// In-memory SQLite-like database simulation
// Uses a simple array store with SQL-like query interface

class Database {
  constructor() {
    this.tables = {};
  }

  createTable(name, columns) {
    this.tables[name] = { columns, rows: [] };
  }

  insert(table, values) {
    if (!this.tables[table]) throw new Error(`Table ${table} not found`);
    const id = this.tables[table].rows.length + 1;
    this.tables[table].rows.push({ id, ...values });
    return id;
  }

  // VULNERABLE: This method builds queries via string concatenation
  query(sql) {
    // Simple SQL parser for SELECT queries
    const selectMatch = sql.match(/SELECT \* FROM (\w+)(?: WHERE (.+))?/i);
    if (!selectMatch) return [];

    const tableName = selectMatch[1];
    const table = this.tables[tableName];
    if (!table) return [];

    if (!selectMatch[2]) return [...table.rows];

    const where = selectMatch[2];
    return table.rows.filter((row) => {
      // Evaluate simple conditions: column = 'value' or column LIKE '%value%'
      const likeMatch = where.match(/(\w+)\s+LIKE\s+'%(.+)%'/i);
      if (likeMatch) {
        const col = likeMatch[1];
        const val = likeMatch[2];
        return row[col] && String(row[col]).toLowerCase().includes(val.toLowerCase());
      }

      const eqMatch = where.match(/(\w+)\s*=\s*'(.+)'/i);
      if (eqMatch) {
        return String(row[eqMatch[1]]) === eqMatch[2];
      }

      return false;
    });
  }

  // SAFE: parameterized query method (exists but not used by app)
  queryParams(sql, params) {
    // Replace ? placeholders with escaped values
    let paramIndex = 0;
    const safeSql = sql.replace(/\?/g, () => {
      const val = params[paramIndex++];
      // Escape single quotes by doubling them
      const escaped = String(val).replace(/'/g, "''");
      return `'${escaped}'`;
    });
    return this.query(safeSql);
  }

  getAll(table) {
    if (!this.tables[table]) return [];
    return [...this.tables[table].rows];
  }
}

module.exports = { Database };
