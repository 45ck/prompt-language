# H8 Foreach Copy Fixture

Create four TypeScript source files in `src/`:

- `src/user.ts`
- `src/product.ts`
- `src/order.ts`
- `src/invoice.ts`

Each file must export exactly one interface and one factory function. Do not add dependencies.

## Required Contracts

`src/user.ts`

- Export `interface User` with fields `id: string`, `name: string`, `email: string`, `active: boolean`.
- Export `function createUser(input: Partial<User> = {}): User`.
- Defaults: `id` empty string, `name` empty string, `email` empty string, `active` false.

`src/product.ts`

- Export `interface Product` with fields `sku: string`, `title: string`, `price: number`, `inStock: boolean`.
- Export `function createProduct(input: Partial<Product> = {}): Product`.
- Defaults: `sku` empty string, `title` empty string, `price` 0, `inStock` true.

`src/order.ts`

- Export `interface Order` with fields `id: string`, `quantity: number`, `status: string`, `notes: string`.
- Export `function createOrder(input: Partial<Order> = {}): Order`.
- Defaults: `id` empty string, `quantity` 0, `status` "draft", `notes` empty string.

`src/invoice.ts`

- Export `interface Invoice` with fields `id: string`, `amount: number`, `paid: boolean`, `memo: string`.
- Export `function createInvoice(input: Partial<Invoice> = {}): Invoice`.
- Defaults: `id` empty string, `amount` 0, `paid` false, `memo` empty string.

## Important

Use nullish coalescing (`??`) for all defaults. Do not use `||` for defaults. `||` is a real bug here because values like `0`, `false`, and `""` must be preserved when explicitly supplied.
