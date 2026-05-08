import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h11-multi-file-refactor-oracle.mjs');

function tempWorkspace() {
  return join(tmpdir(), `ha-h11-refactor-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
}

function writeWorkspace(workspace, files = passingFiles()) {
  mkdirSync(join(workspace, 'src'), { recursive: true });
  for (const [relativePath, source] of Object.entries(files)) {
    writeFileSync(join(workspace, ...relativePath.split('/')), source);
  }
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  });
}

function passingFiles() {
  return {
    'README.md': '# Client Manager\n\nA simple Client management system.\n',
    'package.json': JSON.stringify({
      private: true,
      type: 'commonjs',
      scripts: { test: 'node src/test.js' },
    }),
    'src/client.js': `
class Client {
  constructor(name, email, phone, company) {
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.company = company;
    this.createdAt = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, email: this.email, phone: this.phone, company: this.company, createdAt: this.createdAt };
  }
  getDisplayName() {
    return this.company ? \`\${this.name} (\${this.company})\` : this.name;
  }
}
module.exports = { Client };
`,
    'src/client-store.js': `
const { Client } = require('./client');
class ClientStore {
  constructor() { this.clients = []; }
  add(data) {
    const client = new Client(data.name, data.email, data.phone, data.company);
    this.clients.push(client);
    return client;
  }
  findByEmail(email) { return this.clients.find((client) => client.email === email) || null; }
  findByCompany(company) { return this.clients.filter((client) => client.company === company); }
  getAll() { return this.clients.map((client) => client.toJSON()); }
  remove(email) {
    const index = this.clients.findIndex((client) => client.email === email);
    if (index === -1) return false;
    this.clients.splice(index, 1);
    return true;
  }
  count() { return this.clients.length; }
}
module.exports = { ClientStore };
`,
    'src/seed.js': `
const seedClients = [
  { name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101', company: 'Acme Corp' },
  { name: 'Bob Smith', email: 'bob@example.com', phone: '555-0102', company: 'Acme Corp' },
  { name: 'Carol Davis', email: 'carol@example.com', phone: '555-0103', company: 'Globex Inc' },
  { name: 'Dan Wilson', email: 'dan@example.com', phone: '555-0104', company: null },
  { name: 'Eve Brown', email: 'eve@example.com', phone: '555-0105', company: 'Initech' },
];
function loadSeedData(store) {
  for (const client of seedClients) store.add(client);
  return store.count();
}
module.exports = { seedClients, loadSeedData };
`,
    'src/routes.js': `
function createRoutes(store) {
  return {
    listClients() { return { status: 200, body: store.getAll() }; },
    getClient(email) {
      const client = store.findByEmail(email);
      if (!client) return { status: 404, body: { error: 'Client not found' } };
      return { status: 200, body: client.toJSON() };
    },
    createClient(data) {
      if (!data.name || !data.email) return { status: 400, body: { error: 'Name and email are required' } };
      if (store.findByEmail(data.email)) return { status: 409, body: { error: 'Client already exists' } };
      return { status: 201, body: store.add(data).toJSON() };
    },
    deleteClient(email) {
      if (!store.remove(email)) return { status: 404, body: { error: 'Client not found' } };
      return { status: 204, body: null };
    },
  };
}
module.exports = { createRoutes };
`,
    'src/app.js': `
const { ClientStore } = require('./client-store');
const { createRoutes } = require('./routes');
const { loadSeedData } = require('./seed');
const store = new ClientStore();
const count = loadSeedData(store);
const routes = createRoutes(store);
const allClients = routes.listClients();
if (allClients.status !== 200) process.exit(1);
const alice = routes.getClient('alice@example.com');
if (alice.status !== 200 || alice.body.name !== 'Alice Johnson') process.exit(1);
console.log(\`Client system initialized with \${count} records\`);
`,
    'src/test.js': `
const { Client } = require('./client');
const { ClientStore } = require('./client-store');
function test(name, fn) { fn(); console.log(name); }
function assert(condition, message) { if (!condition) throw new Error(message); }
test('Client constructor sets fields', () => assert(new Client('A', 'a@x', '1', null).email === 'a@x'));
test('Client toJSON returns object', () => assert(new Client('A', 'a@x', '1', null).toJSON().name === 'A'));
test('Client getDisplayName with company', () => assert(new Client('A', 'a@x', '1', 'Co').getDisplayName() === 'A (Co)'));
test('ClientStore add and count', () => { const s = new ClientStore(); s.add({ name: 'A', email: 'a@x' }); assert(s.count() === 1); });
test('ClientStore findByEmail', () => { const s = new ClientStore(); s.add({ name: 'A', email: 'a@x' }); assert(s.findByEmail('a@x').name === 'A'); });
`,
  };
}

test('H11 multi-file refactor oracle passes a complete Client rename', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace);
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS: rename structure is complete/);
    assert.match(result.stdout, /PASS: hidden Client route checks pass/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H11 multi-file refactor oracle rejects Contact terminology stragglers', () => {
  const workspace = tempWorkspace();
  try {
    const files = passingFiles();
    files['README.md'] += '\nOld Contact docs.\n';
    writeWorkspace(workspace, files);
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Contact terminology remains/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H11 multi-file refactor oracle rejects old route names', () => {
  const workspace = tempWorkspace();
  try {
    const files = passingFiles();
    files['src/routes.js'] = files['src/routes.js'].replaceAll('listClients', 'listContacts');
    writeWorkspace(workspace, files);
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Contact terminology remains|route names changed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
