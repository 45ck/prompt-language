const { seedContacts, loadSeedData } = require('./src/seed');

if (!Array.isArray(seedContacts)) {
  throw new Error('seedContacts must be an array');
}

const seen = [];
const fakeStore = {
  add(record) {
    seen.push(record);
  },
  count() {
    return seen.length;
  },
};

const count = loadSeedData(fakeStore);

if (count !== seedContacts.length) {
  throw new Error(`seed count mismatch: expected ${seedContacts.length}, got ${count}`);
}

if (seen.length !== seedContacts.length) {
  throw new Error(`store.add mismatch: expected ${seedContacts.length}, got ${seen.length}`);
}

console.log('seed contract ok');
