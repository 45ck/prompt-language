const { Database } = require('./db');

const db = new Database();

// Schema: contacts and companies
db.createTable('contacts');
db.createTable('companies');

// Seed companies
db.insert('companies', { name: 'Acme Corp', industry: 'Technology', city: 'San Francisco' });
db.insert('companies', { name: 'Globex Inc', industry: 'Manufacturing', city: 'Chicago' });
db.insert('companies', { name: 'Initech', industry: 'Consulting', city: 'Austin' });
db.insert('companies', { name: 'Umbrella LLC', industry: 'Biotech', city: 'Boston' });
db.insert('companies', { name: 'Weyland Corp', industry: 'Aerospace', city: 'Houston' });

// Seed contacts (20 contacts across 5 companies)
const names = [
  'Alice',
  'Bob',
  'Carol',
  'Dan',
  'Eve',
  'Frank',
  'Grace',
  'Hank',
  'Iris',
  'Jack',
  'Karen',
  'Leo',
  'Mona',
  'Nick',
  'Olivia',
  'Pat',
  'Quinn',
  'Rosa',
  'Sam',
  'Tina',
];
for (let i = 0; i < 20; i++) {
  db.insert('contacts', {
    name: `${names[i]} ${names[i]}son`,
    email: `${names[i].toLowerCase()}@example.com`,
    companyId: (i % 5) + 1,
  });
}

// N+1 QUERY PROBLEM: fetches each company individually per contact
function getContactsWithCompanies() {
  const contacts = db.findAll('contacts'); // 1 query

  // N queries: one per contact to get company
  const result = contacts.map((contact) => {
    const company = db.findById('companies', contact.companyId); // 1 query each
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      company: company ? company.name : null,
      industry: company ? company.industry : null,
      city: company ? company.city : null,
    };
  });

  return result;
}

// Also has N+1: filters by industry then looks up each contact's company
function getContactsByIndustry(industry) {
  const companies = db.findWhere('companies', 'industry', industry); // 1 query
  const allContacts = [];

  for (const company of companies) {
    const contacts = db.findWhere('contacts', 'companyId', company.id); // 1 query per company
    for (const contact of contacts) {
      allContacts.push({
        name: contact.name,
        email: contact.email,
        company: company.name,
      });
    }
  }

  return allContacts;
}

// Smoke test
db.resetQueryCount();
const all = getContactsWithCompanies();
const queryCount = db.getQueryCount();
console.log(`getContactsWithCompanies: ${all.length} results, ${queryCount} queries`);

db.resetQueryCount();
const techContacts = getContactsByIndustry('Technology');
const queryCount2 = db.getQueryCount();
console.log(
  `getContactsByIndustry('Technology'): ${techContacts.length} results, ${queryCount2} queries`,
);

module.exports = { getContactsWithCompanies, getContactsByIndustry, db };
