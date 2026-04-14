// Database module — reads DB_HOST, DB_PORT, DB_NAME from env
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbName = process.env.DB_NAME || 'contacts_dev';
const dbPool = parseInt(process.env.DB_POOL_SIZE || '5', 10);

function getConnectionString() {
  return `postgresql://${dbHost}:${dbPort}/${dbName}?pool=${dbPool}`;
}

function connect() {
  const connStr = getConnectionString();
  console.log(`Connecting to database: ${connStr}`);
  return { connected: true, host: dbHost, port: dbPort, name: dbName };
}

module.exports = { connect, getConnectionString };
