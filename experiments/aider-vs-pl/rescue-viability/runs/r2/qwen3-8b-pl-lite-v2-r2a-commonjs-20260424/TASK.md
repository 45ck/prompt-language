# H8 Foreach Copy Fixture V2

Create eight TypeScript source files in `src/`:

- `src/user.ts`
- `src/product.ts`
- `src/order.ts`
- `src/invoice.ts`
- `src/shipment.ts`
- `src/payment.ts`
- `src/coupon.ts`
- `src/review.ts`

Each file must export exactly one interface and one factory function. Do not add dependencies.

## Required Contracts

| File              | Interface  | Factory          | Fields                                                                    | Defaults                     |
| ----------------- | ---------- | ---------------- | ------------------------------------------------------------------------- | ---------------------------- |
| `src/user.ts`     | `User`     | `createUser`     | `id: string`, `name: string`, `email: string`, `active: boolean`          | `""`, `""`, `""`, `false`    |
| `src/product.ts`  | `Product`  | `createProduct`  | `sku: string`, `title: string`, `price: number`, `inStock: boolean`       | `""`, `""`, `0`, `true`      |
| `src/order.ts`    | `Order`    | `createOrder`    | `id: string`, `quantity: number`, `status: string`, `notes: string`       | `""`, `0`, `"draft"`, `""`   |
| `src/invoice.ts`  | `Invoice`  | `createInvoice`  | `id: string`, `amount: number`, `paid: boolean`, `memo: string`           | `""`, `0`, `false`, `""`     |
| `src/shipment.ts` | `Shipment` | `createShipment` | `id: string`, `carrier: string`, `tracking: string`, `delivered: boolean` | `""`, `""`, `""`, `false`    |
| `src/payment.ts`  | `Payment`  | `createPayment`  | `id: string`, `method: string`, `amount: number`, `captured: boolean`     | `""`, `"card"`, `0`, `false` |
| `src/coupon.ts`   | `Coupon`   | `createCoupon`   | `code: string`, `percentOff: number`, `enabled: boolean`, `label: string` | `""`, `0`, `true`, `""`      |
| `src/review.ts`   | `Review`   | `createReview`   | `id: string`, `rating: number`, `published: boolean`, `body: string`      | `""`, `0`, `false`, `""`     |

For each factory, accept `input: Partial<InterfaceName> = {}` and return a complete object with every field.

Use nullish coalescing (`??`) for every default. Do not use `||` for defaults. `||` is a real bug here because values like `0`, `false`, and `""` must be preserved when explicitly supplied.
