const { ContactStore } = require('./contact-store');

function createRoutes(store) {
  return {
    listContacts() {
      return { status: 200, body: store.getAll() };
    },

    getContact(email) {
      const contact = store.findByEmail(email);
      if (!contact) return { status: 404, body: { error: 'Contact not found' } };
      return { status: 200, body: contact.toJSON() };
    },

    createContact(data) {
      if (!data.name || !data.email) {
        return { status: 400, body: { error: 'Name and email are required' } };
      }
      const existing = store.findByEmail(data.email);
      if (existing) {
        return { status: 409, body: { error: 'Contact already exists' } };
      }
      const contact = store.add(data);
      return { status: 201, body: contact.toJSON() };
    },

    deleteContact(email) {
      const removed = store.remove(email);
      if (!removed) return { status: 404, body: { error: 'Contact not found' } };
      return { status: 204, body: null };
    },
  };
}

module.exports = { createRoutes };
