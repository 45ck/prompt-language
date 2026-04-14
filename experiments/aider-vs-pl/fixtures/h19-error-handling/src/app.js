const routes = require('./routes');

// Simple route dispatcher
function handleRequest(method, path, body) {
  try {
    if (method === 'GET' && path === '/contacts') {
      return routes.listContacts();
    }
    if (method === 'GET' && path.startsWith('/contacts/')) {
      const id = path.split('/')[2];
      return routes.getContact(id);
    }
    if (method === 'POST' && path === '/contacts') {
      return routes.createContact(body);
    }
    if (method === 'PUT' && path.startsWith('/contacts/')) {
      const id = path.split('/')[2];
      return routes.updateContact(id, body);
    }
    if (method === 'DELETE' && path.startsWith('/contacts/')) {
      const id = path.split('/')[2];
      return routes.deleteContact(id);
    }
    if (method === 'GET' && path === '/search') {
      return routes.searchContacts(body && body.query);
    }
    return { status: 404, body: { error: 'Route not found' } };
  } catch (e) {
    // BUG: generic catch-all, no structured error
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

// Smoke test
const result = handleRequest('GET', '/contacts');
if (result.status !== 200 || result.body.length < 1) {
  console.error('Init failed');
  process.exit(1);
}
console.log(`App initialized, ${result.body.length} contacts`);

module.exports = { handleRequest };
