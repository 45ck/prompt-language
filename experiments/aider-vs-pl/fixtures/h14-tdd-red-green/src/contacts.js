// Contact management module

function createContact(name, email, phone, company) {
  return {
    name: name || null,
    email: email,
    phone: phone || null,
    company: company || null,
    createdAt: Date.now(),
  };
}

function findByEmail(contacts, email) {
  return contacts.filter((c) => c.email === email);
}

function addContact(contacts, contact) {
  return [...contacts, contact];
}

function removeContact(contacts, email) {
  return contacts.filter((c) => c.email !== email);
}

// TODO: mergeDuplicates() — not yet implemented

module.exports = { createContact, findByEmail, addContact, removeContact };
