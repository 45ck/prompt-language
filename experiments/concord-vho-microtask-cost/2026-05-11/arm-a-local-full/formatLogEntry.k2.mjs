export function formatLogEntry(event, ctx) {
  const level = event.level.toUpperCase();
  const service = ctx.service;
  const host = ctx.host;
  const msg = event.msg;

  let result = `[${level}] ${service}@${host}: ${msg}`;

  if (event.fields && Object.keys(event.fields).length > 0) {
    const fields = Object.entries(event.fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    result += ` | ${fields}`;
  }

  return result;
}
