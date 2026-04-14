// Contact Management API

const contacts = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    company: 'Acme Corp',
    role: 'Engineer',
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    phone: '555-0102',
    company: 'Globex Inc',
    role: 'Manager',
  },
  {
    id: 3,
    name: 'Carol Davis',
    email: 'carol@example.com',
    phone: '555-0103',
    company: 'Initech',
    role: 'Designer',
  },
];
let nextId = 4;

// Route: GET /api/contacts
// Returns all contacts. Supports optional query filters: company, role
function listContacts(query) {
  let result = [...contacts];
  if (query && query.company) {
    result = result.filter((c) => c.company === query.company);
  }
  if (query && query.role) {
    result = result.filter((c) => c.role === query.role);
  }
  return { status: 200, body: result };
}

// Route: GET /api/contacts/:id
// Returns a single contact by ID
function getContact(id) {
  const contact = contacts.find((c) => c.id === parseInt(id, 10));
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };
  return { status: 200, body: contact };
}

// Route: POST /api/contacts
// Creates a new contact. Required: name, email. Optional: phone, company, role
function createContact(body) {
  if (!body || !body.name || !body.email) {
    return { status: 400, body: { error: 'name and email are required' } };
  }
  const duplicate = contacts.find((c) => c.email === body.email);
  if (duplicate) {
    return { status: 409, body: { error: 'Email already exists' } };
  }
  const contact = {
    id: nextId++,
    name: body.name,
    email: body.email,
    phone: body.phone || null,
    company: body.company || null,
    role: body.role || null,
  };
  contacts.push(contact);
  return { status: 201, body: contact };
}

// Route: PUT /api/contacts/:id
// Full update of a contact. Required: name, email
function updateContact(id, body) {
  const index = contacts.findIndex((c) => c.id === parseInt(id, 10));
  if (index === -1) return { status: 404, body: { error: 'Contact not found' } };
  if (!body || !body.name || !body.email) {
    return { status: 400, body: { error: 'name and email are required' } };
  }
  contacts[index] = {
    id: contacts[index].id,
    name: body.name,
    email: body.email,
    phone: body.phone || null,
    company: body.company || null,
    role: body.role || null,
  };
  return { status: 200, body: contacts[index] };
}

// Route: DELETE /api/contacts/:id
// Deletes a contact by ID
function deleteContact(id) {
  const index = contacts.findIndex((c) => c.id === parseInt(id, 10));
  if (index === -1) return { status: 404, body: { error: 'Contact not found' } };
  contacts.splice(index, 1);
  return { status: 204, body: null };
}

// Route: GET /api/contacts/search?q=term
// Searches contacts by name or email (case-insensitive substring match)
function searchContacts(q) {
  if (!q) return { status: 400, body: { error: 'Search query "q" is required' } };
  const lower = q.toLowerCase();
  const matches = contacts.filter(
    (c) => c.name.toLowerCase().includes(lower) || c.email.toLowerCase().includes(lower),
  );
  return { status: 200, body: matches };
}

// Route: GET /api/stats
// Returns contact statistics: total count, contacts per company, contacts per role
function getStats() {
  const companies = {};
  const roles = {};
  for (const c of contacts) {
    if (c.company) companies[c.company] = (companies[c.company] || 0) + 1;
    if (c.role) roles[c.role] = (roles[c.role] || 0) + 1;
  }
  return {
    status: 200,
    body: { total: contacts.length, byCompany: companies, byRole: roles },
  };
}

// Smoke test
const list = listContacts();
if (list.body.length !== 3) {
  console.error('Init failed');
  process.exit(1);
}
console.log(`API ready with ${list.body.length} contacts and 7 routes`);

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  getStats,
};
