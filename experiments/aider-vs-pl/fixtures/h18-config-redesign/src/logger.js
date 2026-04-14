// Logger module — reads LOG_LEVEL and LOG_FORMAT from env
const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'text';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level) {
  return (LEVELS[level] || 0) >= (LEVELS[logLevel] || 0);
}

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  if (logFormat === 'json') {
    return JSON.stringify({ timestamp, level, message });
  }
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
}

function log(level, message) {
  if (shouldLog(level)) {
    console.log(formatMessage(level, message));
  }
}

module.exports = {
  debug: (msg) => log('debug', msg),
  info: (msg) => log('info', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
};
