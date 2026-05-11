export function formatLogEntry(event, ctx) {
  const timestamp = new Date().toISOString();
  const level = event.level || 'info';
  const message = event.message || '';
  const context = Object.keys(ctx).length > 0 ? JSON.stringify(ctx) : '';
  
  return `${timestamp} [${level}] ${message}${context ? ' ' + context : ''}`;
}