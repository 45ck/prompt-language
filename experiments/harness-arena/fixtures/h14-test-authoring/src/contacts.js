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
  const byEmail = new Map();
  for (const contact of contacts) {
    const existing = byEmail.get(contact.email);
    if (!existing) {
      byEmail.set(contact.email, { ...contact });
      continue;
    }
    byEmail.set(contact.email, {
      ...existing,
      name: contact.name || existing.name,
      phone: contact.phone || existing.phone,
      company: contact.company || existing.company,
    });
  }
  return [...byEmail.values()];
}

module.exports = { createContact, findByEmail, addContact, removeContact, mergeDuplicates };
