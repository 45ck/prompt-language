// Main server file — reads PORT and HOST from env
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || 'localhost';

function startServer() {
  console.log(`Server starting on ${host}:${port}`);
  return { host, port };
}

module.exports = { startServer };
