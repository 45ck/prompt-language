// Seed data for initial Contact records
const seedContacts = [
  { name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101', company: 'Acme Corp' },
  { name: 'Bob Smith', email: 'bob@example.com', phone: '555-0102', company: 'Acme Corp' },
  { name: 'Carol Davis', email: 'carol@example.com', phone: '555-0103', company: 'Globex Inc' },
  { name: 'Dan Wilson', email: 'dan@example.com', phone: '555-0104', company: null },
  { name: 'Eve Brown', email: 'eve@example.com', phone: '555-0105', company: 'Initech' },
];

function loadSeedData(store) {
  for (const contact of seedContacts) {
    store.add(contact);
  }
  return store.count();
}

module.exports = { seedContacts, loadSeedData };
