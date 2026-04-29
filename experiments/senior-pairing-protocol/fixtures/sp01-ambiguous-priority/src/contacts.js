function normalizeValue(value) {
  return value === undefined || value === '' ? null : value;
}

function createContact(name, email, phone, company, createdAt) {
  return {
    name: normalizeValue(name),
    email,
    phone: normalizeValue(phone),
    company: normalizeValue(company),
    createdAt: createdAt ?? Date.now(),
  };
}

function findByEmail(contacts, email) {
  return contacts.filter((contact) => contact.email === email);
}

function addContact(contacts, contact) {
  return [...contacts, contact];
}

function removeContact(contacts, email) {
  return contacts.filter((contact) => contact.email !== email);
}

// TODO: implement mergeContacts(records)

module.exports = { createContact, findByEmail, addContact, removeContact };
