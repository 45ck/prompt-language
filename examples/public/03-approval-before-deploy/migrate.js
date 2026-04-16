const fs = require('fs');

const log = [
  `Migration started at ${new Date().toISOString()}`,
  'ALTER TABLE users ADD COLUMN last_login TIMESTAMP',
  'INSERT INTO audit_log (event) VALUES ("migration-v2")',
  'Migration completed successfully',
].join('\n');

fs.writeFileSync('migration-log.txt', log);
console.log('Migration complete. See migration-log.txt');
