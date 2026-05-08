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
  // TODO: implement from the public tests in src/test.js.
  return contacts;
}

module.exports = { createContact, findByEmail, addContact, removeContact, mergeDuplicates };
