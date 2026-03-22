// Async data processing
async function fetchData(id) {
  // Simulate async fetch
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id, name: `Item ${id}`, price: id * 10 }), 10);
  });
}

async function getTotalPrice(ids) {
  let total = 0;
  for (const id of ids) {
    const item = fetchData(id);
    total += item.price;
  }
  return total;
}

async function getNames(ids) {
  const names = [];
  for (const id of ids) {
    const item = fetchData(id);
    names.push(item.name);
  }
  return names;
}

module.exports = { fetchData, getTotalPrice, getNames };
