export function formatLogEntry(event, ctx) {
  const timestamp = new Date().toISOString();
  const level = event.level || 'info';
  const message = event.message || '';
  const context = Object.keys(ctx).map(key => `${key}=${ctx[key]}`).join(' ');
  return `${timestamp} level=${level} message="${message}" ${context}`.trim();
}