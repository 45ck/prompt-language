// Simple in-memory database
const data = {
  contacts: [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
    { id: 3, name: 'Carol', email: 'carol@test.com' },
  ],
};

let nextId = 4;

function findAll() {
  return [...data.contacts];
}

function findById(id) {
  return data.contacts.find((c) => c.id === id) || null;
}

function create(record) {
  if (!record.name) throw new Error('name is required');
  const contact = { id: nextId++, ...record };
  data.contacts.push(contact);
  return contact;
}

function update(id, fields) {
  const index = data.contacts.findIndex((c) => c.id === id);
  if (index === -1) return null;
  data.contacts[index] = { ...data.contacts[index], ...fields };
  return data.contacts[index];
}

function remove(id) {
  const index = data.contacts.findIndex((c) => c.id === id);
  if (index === -1) return false;
  data.contacts.splice(index, 1);
  return true;
}

module.exports = { findAll, findById, create, update, remove };
