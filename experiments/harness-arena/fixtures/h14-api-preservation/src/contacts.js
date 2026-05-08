// Contact management module.

function createContact(name, email, phone, company) {
  return {
    name: name || null,
    email,
    phone: phone || null,
    company: company || null,
    createdAt: Date.now(),
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

function mergeDuplicates(contacts) {
  // BUG: this keeps only the first contact for each email and drops later data.
  const byEmail = new Map();
  for (const contact of contacts) {
    if (!byEmail.has(contact.email)) byEmail.set(contact.email, contact);
  }
  return [...byEmail.values()];
}

module.exports = { createContact, findByEmail, addContact, removeContact, mergeDuplicates };
