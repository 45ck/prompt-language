// Simple API framework (no Express dependency)
const contacts = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    company: 'Acme Corp',
  },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', phone: '555-0102', company: 'Globex Inc' },
  { id: 3, name: 'Carol Davis', email: 'carol@example.com', phone: '555-0103', company: null },
];

let nextId = 4;

// GET /api/contacts
function listContacts() {
  return { status: 200, body: contacts };
}

// GET /api/contacts/:id
function getContact(id) {
  const contact = contacts.find((c) => c.id === id);
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };
  return { status: 200, body: contact };
}

// POST /api/contacts
function createContact(data) {
  if (!data.name || !data.email) {
    return { status: 400, body: { error: 'Name and email are required' } };
  }
  const contact = {
    id: nextId++,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    company: data.company || null,
  };
  contacts.push(contact);
  return { status: 201, body: contact };
}

// DELETE /api/contacts/:id
function deleteContact(id) {
  const index = contacts.findIndex((c) => c.id === id);
  if (index === -1) return { status: 404, body: { error: 'Contact not found' } };
  contacts.splice(index, 1);
  return { status: 204, body: null };
}

// TODO: PATCH /api/contacts/:id — not yet implemented

// Smoke test
const all = listContacts();
if (all.body.length !== 3) {
  console.error('Init failed');
  process.exit(1);
}
console.log(`API initialized with ${all.body.length} contacts`);

module.exports = { listContacts, getContact, createContact, deleteContact, contacts };
