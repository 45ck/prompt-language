const { Contact } = require('./contact');

class ContactStore {
  constructor() {
    this.contacts = [];
  }

  add(data) {
    const contact = new Contact(data.name, data.email, data.phone, data.company);
    this.contacts.push(contact);
    return contact;
  }

  findByEmail(email) {
    return this.contacts.find((c) => c.email === email) || null;
  }

  findByCompany(company) {
    return this.contacts.filter((c) => c.company === company);
  }

  getAll() {
    return this.contacts.map((c) => c.toJSON());
  }

  remove(email) {
    const index = this.contacts.findIndex((c) => c.email === email);
    if (index === -1) return false;
    this.contacts.splice(index, 1);
    return true;
  }

  count() {
    return this.contacts.length;
  }
}

module.exports = { ContactStore };
