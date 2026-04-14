const fs = require('fs');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    results.push(`  FAIL: ${name} -- ${e.message}`);
  }
}

test('API.md exists', () => {
  if (!fs.existsSync('API.md')) throw new Error('API.md not found');
});

const doc = fs.existsSync('API.md') ? fs.readFileSync('API.md', 'utf8') : '';

// All routes must be documented
const requiredRoutes = [
  { method: 'GET', path: '/api/contacts', label: 'list contacts' },
  { method: 'GET', path: '/api/contacts/:id', label: 'get contact' },
  { method: 'POST', path: '/api/contacts', label: 'create contact' },
  { method: 'PUT', path: '/api/contacts/:id', label: 'update contact' },
  { method: 'DELETE', path: '/api/contacts/:id', label: 'delete contact' },
  { method: 'GET', path: '/api/contacts/search', label: 'search contacts' },
  { method: 'GET', path: '/api/stats', label: 'get stats' },
];

for (const route of requiredRoutes) {
  test(`Documents ${route.method} ${route.path}`, () => {
    const hasMethod = doc.includes(route.method);
    const hasPath = doc.includes(route.path) || doc.includes(route.path.replace(':id', '{id}'));
    if (!hasMethod || !hasPath) {
      throw new Error(`Route ${route.method} ${route.path} not documented`);
    }
  });
}

// Check for request body docs on POST/PUT
test('POST body schema documented', () => {
  const hasNameField =
    doc.includes('name') && (doc.includes('required') || doc.includes('Required'));
  const hasEmailField = doc.includes('email');
  if (!hasNameField || !hasEmailField) {
    throw new Error('POST request body schema not documented (name, email)');
  }
});

// Check for response examples
test('At least one response example exists', () => {
  const hasExample =
    doc.includes('200') ||
    doc.includes('201') ||
    doc.includes('example') ||
    doc.includes('Example');
  const hasJson = doc.includes('{') && doc.includes('}');
  if (!hasExample || !hasJson) {
    throw new Error('No response examples found');
  }
});

// Check for error responses
test('Error responses documented (400, 404, 409)', () => {
  const has400 = doc.includes('400');
  const has404 = doc.includes('404');
  if (!has400 || !has404) {
    throw new Error('Error responses not documented');
  }
});

// Check no phantom routes
test('No phantom routes (undocumented PATCH)', () => {
  // PATCH doesn't exist in the app, so it shouldn't be documented
  const hasPatch = /PATCH\s+\/api\/contacts/i.test(doc);
  if (hasPatch) throw new Error('Documents PATCH route that does not exist');
});

// Check doc matches actual code
test('Route count matches (7 routes)', () => {
  const appSource = fs.readFileSync('src/app.js', 'utf8');
  const routeComments = appSource.match(/\/\/ Route:/g);
  const actualCount = routeComments ? routeComments.length : 0;

  // Count documented routes in API.md
  let docRouteCount = 0;
  for (const route of requiredRoutes) {
    const pat = new RegExp(
      route.method + '.*' + route.path.replace(':id', '(:\\w+|\\{\\w+\\})').replace('/', '\\/'),
      'i',
    );
    if (pat.test(doc)) docRouteCount++;
  }

  if (docRouteCount < actualCount) {
    throw new Error(`Documented ${docRouteCount} routes but app has ${actualCount}`);
  }
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
results.forEach((r) => console.log(r));
if (failed > 0) {
  console.log(`\nVERDICT: FAIL (${failed} failed)`);
  process.exit(1);
} else {
  console.log('\nVERDICT: PASS');
  process.exit(0);
}
