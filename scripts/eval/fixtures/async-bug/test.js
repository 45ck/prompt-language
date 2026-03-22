const { fetchData, getTotalPrice, getNames } = require('./app');
const assert = require('node:assert');

async function runTests() {
  const item = await fetchData(3);
  assert.deepStrictEqual(item, { id: 3, name: 'Item 3', price: 30 });

  const total = await getTotalPrice([1, 2, 3]);
  assert.strictEqual(total, 60, `total should be 60, got ${total}`);

  const names = await getNames([1, 2]);
  assert.deepStrictEqual(
    names,
    ['Item 1', 'Item 2'],
    `names should be ['Item 1', 'Item 2'], got ${JSON.stringify(names)}`,
  );

  console.log('All tests passed');
}

runTests().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
