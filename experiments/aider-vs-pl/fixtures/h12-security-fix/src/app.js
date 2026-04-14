const { Database } = require('./db');

const db = new Database();

// Initialize schema and seed data
db.createTable('contacts', ['name', 'email', 'phone', 'company']);
db.insert('contacts', {
  name: 'Alice Johnson',
  email: 'alice@example.com',
  phone: '555-0101',
  company: 'Acme Corp',
});
db.insert('contacts', {
  name: 'Bob Smith',
  email: 'bob@example.com',
  phone: '555-0102',
  company: 'Acme Corp',
});
db.insert('contacts', {
  name: 'Carol Davis',
  email: 'carol@example.com',
  phone: '555-0103',
  company: 'Globex Inc',
});
db.insert('contacts', {
  name: "Dan O'Brien",
  email: 'dan@example.com',
  phone: '555-0104',
  company: 'Initech',
});

// VULNERABLE: search uses string concatenation
function searchContacts(searchTerm) {
  const sql = "SELECT * FROM contacts WHERE name LIKE '%" + searchTerm + "%'";
  return db.query(sql);
}

// VULNERABLE: lookup by email uses string concatenation
function getContactByEmail(email) {
  const sql = "SELECT * FROM contacts WHERE email = '" + email + "'";
  return db.query(sql);
}

// VULNERABLE: lookup by company uses template literal
function getContactsByCompany(company) {
  const sql = `SELECT * FROM contacts WHERE company = '${company}'`;
  return db.query(sql);
}

// Route handlers
function handleSearch(query) {
  if (!query) return { status: 400, body: { error: 'Search query required' } };
  const results = searchContacts(query);
  return { status: 200, body: results };
}

function handleGetByEmail(email) {
  if (!email) return { status: 400, body: { error: 'Email required' } };
  const results = getContactByEmail(email);
  if (results.length === 0) return { status: 404, body: { error: 'Not found' } };
  return { status: 200, body: results[0] };
}

function handleGetByCompany(company) {
  if (!company) return { status: 400, body: { error: 'Company required' } };
  const results = getContactsByCompany(company);
  return { status: 200, body: results };
}

// Smoke test
const all = db.getAll('contacts');
if (all.length !== 4) {
  console.error('Seed data failed');
  process.exit(1);
}

const searchResult = handleSearch('Alice');
if (searchResult.body.length !== 1 || searchResult.body[0].name !== 'Alice Johnson') {
  console.error('Search failed');
  process.exit(1);
}

console.log(`Database initialized with ${all.length} contacts`);
console.log('Search working correctly');

module.exports = {
  handleSearch,
  handleGetByEmail,
  handleGetByCompany,
  db,
  searchContacts,
  getContactByEmail,
  getContactsByCompany,
};
