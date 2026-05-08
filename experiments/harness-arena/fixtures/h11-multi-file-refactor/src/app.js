const { ContactStore } = require('./contact-store');
const { createRoutes } = require('./routes');
const { loadSeedData } = require('./seed');

// Initialize store and load seed data
const store = new ContactStore();
const count = loadSeedData(store);

// Create route handlers
const routes = createRoutes(store);

// Smoke test: verify the Contact system works
const allContacts = routes.listContacts();
if (allContacts.status !== 200) {
  console.error('Failed to list contacts');
  process.exit(1);
}

const alice = routes.getContact('alice@example.com');
if (alice.status !== 200 || alice.body.name !== 'Alice Johnson') {
  console.error('Failed to get contact');
  process.exit(1);
}

console.log(`Contact system initialized with ${count} records`);
console.log(`All ${allContacts.body.length} contacts loaded successfully`);
process.exit(0);
