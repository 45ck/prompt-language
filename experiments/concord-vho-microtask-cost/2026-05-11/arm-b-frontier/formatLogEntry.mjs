export function formatLogEntry(event, ctx) {
  const base = `[${event.level.toUpperCase()}] ${ctx.service}@${ctx.host}: ${event.msg}`;
  const fields = event.fields;
  if (!fields || Object.keys(fields).length === 0) return base;
  const kv = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ');
  return `${base} | ${kv}`;
}
