// Simple API framework (no Express dependency).
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

function listContacts() {
  return { status: 200, body: contacts };
}

function getContact(id) {
  const contact = contacts.find((candidate) => candidate.id === id);
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };
  return { status: 200, body: contact };
}

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

function deleteContact(id) {
  const index = contacts.findIndex((candidate) => candidate.id === id);
  if (index === -1) return { status: 404, body: { error: 'Contact not found' } };
  contacts.splice(index, 1);
  return { status: 204, body: null };
}

function hasValidEmailShape(email) {
  if (typeof email !== 'string') return false;
  const atIndex = email.indexOf('@');
  return atIndex > 0 && email.indexOf('.', atIndex + 1) > atIndex + 1;
}

function hasValidPhoneShape(phone) {
  return typeof phone === 'string' && /^\+?[\d\s-]{7,20}$/.test(phone);
}

function patchContact(id, data) {
  const contact = contacts.find((candidate) => candidate.id === id);
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.length < 2 || data.name.length > 100) {
      return { status: 400, body: { error: 'Invalid name' } };
    }
  }
  if (data.email !== undefined && !hasValidEmailShape(data.email)) {
    return { status: 400, body: { error: 'Invalid email' } };
  }
  if (data.phone !== undefined && !hasValidPhoneShape(data.phone)) {
    return { status: 400, body: { error: 'Invalid phone' } };
  }
  if (
    data.company !== undefined &&
    data.company !== null &&
    (typeof data.company !== 'string' || data.company.length < 1 || data.company.length > 200)
  ) {
    return { status: 400, body: { error: 'Invalid company' } };
  }

  for (const field of ['name', 'email', 'phone', 'company']) {
    if (data[field] !== undefined) contact[field] = data[field];
  }

  return { status: 200, body: contact };
}

module.exports = { listContacts, getContact, createContact, deleteContact, patchContact, contacts };
