const fs = require('node:fs');
const path = require('node:path');

const specs = [
  {
    label: 'user',
    file: 'src/user.ts',
    interfaceName: 'User',
    factoryName: 'createUser',
    fields: ['id: string', 'name: string', 'email: string', 'active: boolean'],
    defaults: [
      ['id', '""'],
      ['name', '""'],
      ['email', '""'],
      ['active', 'false'],
    ],
  },
  {
    label: 'product',
    file: 'src/product.ts',
    interfaceName: 'Product',
    factoryName: 'createProduct',
    fields: ['sku: string', 'title: string', 'price: number', 'inStock: boolean'],
    defaults: [
      ['sku', '""'],
      ['title', '""'],
      ['price', '0'],
      ['inStock', 'true'],
    ],
  },
  {
    label: 'order',
    file: 'src/order.ts',
    interfaceName: 'Order',
    factoryName: 'createOrder',
    fields: ['id: string', 'quantity: number', 'status: string', 'notes: string'],
    defaults: [
      ['id', '""'],
      ['quantity', '0'],
      ['status', '"draft"'],
      ['notes', '""'],
    ],
  },
  {
    label: 'invoice',
    file: 'src/invoice.ts',
    interfaceName: 'Invoice',
    factoryName: 'createInvoice',
    fields: ['id: string', 'amount: number', 'paid: boolean', 'memo: string'],
    defaults: [
      ['id', '""'],
      ['amount', '0'],
      ['paid', 'false'],
      ['memo', '""'],
    ],
  },
];

function normalize(source) {
  return source.replace(/\s+/g, ' ');
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message);
  }
}

function assertRegex(source, regex, message) {
  if (!regex.test(source)) {
    throw new Error(message);
  }
}

function defaultPattern(defaultValue) {
  if (defaultValue === '""') {
    return `(?:""|'')`;
  }
  if (defaultValue === '"draft"') {
    return `(?:"draft"|'draft')`;
  }
  return defaultValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkSpec(spec) {
  const fullPath = path.join(process.cwd(), spec.file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`${spec.file} not found`);
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  const flat = normalize(source);

  assertRegex(
    source,
    new RegExp(`export\\s+interface\\s+${spec.interfaceName}\\b`),
    `${spec.file} must export interface ${spec.interfaceName}`,
  );
  assertRegex(
    source,
    new RegExp(`export\\s+function\\s+${spec.factoryName}\\s*\\(`),
    `${spec.file} must export function ${spec.factoryName}`,
  );

  for (const field of spec.fields) {
    assertIncludes(flat, field, `${spec.file} missing field ${field}`);
  }

  if (source.includes('||')) {
    throw new Error(`${spec.file} uses ||; use ?? to preserve falsy values`);
  }

  for (const [field, defaultValue] of spec.defaults) {
    assertRegex(
      flat,
      new RegExp(
        `\\b${field}\\s*:\\s*input\\.${field}\\s*\\?\\?\\s*${defaultPattern(defaultValue)}`,
      ),
      `${spec.file} default for ${field} must be input.${field} ?? ${defaultValue}`,
    );
  }
}

let passed = 0;
let failed = 0;

for (const spec of specs) {
  try {
    checkSpec(spec);
    passed += 1;
    console.log(`PASS ${spec.label}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${spec.label}: ${error.message}`);
  }
}

console.log(`Results: ${passed}/${specs.length} passed`);

if (failed > 0) {
  process.exitCode = 1;
}
