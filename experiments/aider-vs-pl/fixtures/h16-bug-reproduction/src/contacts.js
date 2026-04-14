// Contact analytics module

function createContact(name, email, age, company) {
  return { name, email, age, company };
}

function filterByCompany(contacts, company) {
  return contacts.filter((c) => c.company === company);
}

function filterByAge(contacts, minAge, maxAge) {
  return contacts.filter((c) => c.age >= minAge && c.age <= maxAge);
}

function sortByName(contacts) {
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
}

// BUG: crashes when contacts array is empty
function getStatistics(contacts) {
  const sorted = sortByName(contacts);

  const avgAge = contacts.reduce((sum, c) => sum + c.age, 0) / contacts.length;

  const companies = {};
  for (const c of contacts) {
    companies[c.company] = (companies[c.company] || 0) + 1;
  }

  const topCompany = Object.entries(companies).sort((a, b) => b[1] - a[1])[0][0];

  const youngest = sorted[0].name;
  const oldest = sorted[sorted.length - 1].name;

  return {
    total: contacts.length,
    averageAge: Math.round(avgAge),
    topCompany,
    youngest,
    oldest,
    companyCounts: companies,
  };
}

// Get a summary string
function getSummary(contacts) {
  const stats = getStatistics(contacts);
  return `${stats.total} contacts, avg age ${stats.averageAge}, top company: ${stats.topCompany}`;
}

module.exports = {
  createContact,
  filterByCompany,
  filterByAge,
  sortByName,
  getStatistics,
  getSummary,
};
