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
  {
    label: 'shipment',
    file: 'src/shipment.ts',
    interfaceName: 'Shipment',
    factoryName: 'createShipment',
    fields: ['id: string', 'carrier: string', 'tracking: string', 'delivered: boolean'],
    defaults: [
      ['id', '""'],
      ['carrier', '""'],
      ['tracking', '""'],
      ['delivered', 'false'],
    ],
  },
  {
    label: 'payment',
    file: 'src/payment.ts',
    interfaceName: 'Payment',
    factoryName: 'createPayment',
    fields: ['id: string', 'method: string', 'amount: number', 'captured: boolean'],
    defaults: [
      ['id', '""'],
      ['method', '"card"'],
      ['amount', '0'],
      ['captured', 'false'],
    ],
  },
  {
    label: 'coupon',
    file: 'src/coupon.ts',
    interfaceName: 'Coupon',
    factoryName: 'createCoupon',
    fields: ['code: string', 'percentOff: number', 'enabled: boolean', 'label: string'],
    defaults: [
      ['code', '""'],
      ['percentOff', '0'],
      ['enabled', 'true'],
      ['label', '""'],
    ],
  },
  {
    label: 'review',
    file: 'src/review.ts',
    interfaceName: 'Review',
    factoryName: 'createReview',
    fields: ['id: string', 'rating: number', 'published: boolean', 'body: string'],
    defaults: [
      ['id', '""'],
      ['rating', '0'],
      ['published', 'false'],
      ['body', '""'],
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
  if (/^".*"$/.test(defaultValue)) {
    const unquoted = defaultValue.slice(1, -1);
    return `(?:"${unquoted}"|'${unquoted}')`;
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
