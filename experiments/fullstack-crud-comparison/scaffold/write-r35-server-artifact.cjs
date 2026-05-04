#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';

mkdirSync(join(workspace, 'src'), { recursive: true });

writeFileSync(
  join(workspace, 'src', 'server.js'),
  [
    "const http = require('node:http');",
    "const { readFileSync } = require('node:fs');",
    "const { join } = require('node:path');",
    "const domain = require('./domain.js');",
    '',
    'const port = Number(process.env.PORT || 3000);',
    "const publicIndex = join(__dirname, '..', 'public', 'index.html');",
    '',
    'function sendJson(response, status, body) {',
    "  response.writeHead(status, { 'content-type': 'application/json' });",
    '  response.end(JSON.stringify(body));',
    '}',
    '',
    'function routeRead(url) {',
    "  if (url.pathname === '/api/customers') return domain.listCustomers();",
    "  if (url.pathname === '/api/assets') return domain.listAssets();",
    "  if (url.pathname === '/api/work_orders') return domain.listWorkOrders();",
    "  if (url.pathname.startsWith('/api/customers/')) return domain.detailCustomer(url.pathname.split('/').at(-1));",
    "  if (url.pathname.startsWith('/api/assets/')) return domain.detailAsset(url.pathname.split('/').at(-1));",
    "  if (url.pathname.startsWith('/api/work_orders/')) return domain.detailWorkOrder(url.pathname.split('/').at(-1));",
    '  return null;',
    '}',
    '',
    'const server = http.createServer((request, response) => {',
    '  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);',
    '  try {',
    "    if (request.method === 'GET' && url.pathname === '/') {",
    "      response.writeHead(200, { 'content-type': 'text/html' });",
    "      response.end(readFileSync(publicIndex, 'utf8'));",
    '      return;',
    '    }',
    '',
    "    if (request.method === 'GET') {",
    '      const payload = routeRead(url);',
    '      if (payload) {',
    '        sendJson(response, 200, payload);',
    '        return;',
    '      }',
    '    }',
    '',
    "    sendJson(response, 404, { error: 'not_found' });",
    '  } catch (error) {',
    '    sendJson(response, 400, { error: error.message });',
    '  }',
    '});',
    '',
    'if (require.main === module) {',
    '  server.listen(port, () => {',
    '    console.log(`FSCRUD-01 server listening on ${port}`);',
    '  });',
    '}',
    '',
    'module.exports = { server, domain, customers: true, assets: true, work_orders: true };',
    '',
  ].join('\n'),
);

console.log(`wrote R35 deterministic server artifact to ${workspace}`);
