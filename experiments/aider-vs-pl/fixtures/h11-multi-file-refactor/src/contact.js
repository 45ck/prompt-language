class Contact {
  constructor(name, email, phone, company) {
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.company = company;
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      email: this.email,
      phone: this.phone,
      company: this.company,
      createdAt: this.createdAt,
    };
  }

  getDisplayName() {
    return this.company ? `${this.name} (${this.company})` : this.name;
  }
}

module.exports = { Contact };
