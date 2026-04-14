const { startServer } = require('./server');
const { connect } = require('./database');
const { createToken } = require('./auth');
const logger = require('./logger');
const { sendMail } = require('./mailer');

// Initialize
const server = startServer();
const db = connect();
logger.info(`Server running on ${server.host}:${server.port}`);
logger.info(`Database: ${db.name}`);

// Test auth
const token = createToken({ userId: 1, role: 'admin' });
logger.debug(`Token: ${token}`);

// Test mailer
sendMail('test@example.com', 'Test', 'Hello');

console.log('App initialized successfully');
