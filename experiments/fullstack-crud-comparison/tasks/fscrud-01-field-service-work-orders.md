# FSCRUD-01: Field-Service Work Order Tracker

Build a full-stack CRUD app for a small field-service company.

## Domain

The company tracks customers, field assets, and work orders.

Customers own assets. Work orders are opened against one customer and one asset.
Technicians update work order status as jobs move through intake, scheduling, active
work, completion, or cancellation.

## Required Entities

### Customer

Fields:

- `id`
- `name`
- `email`
- `phone`
- `serviceAddress`
- `createdAt`

### Asset

Fields:

- `id`
- `customerId`
- `name`
- `serialNumber`
- `assetType`
- `installedAt`

### WorkOrder

Fields:

- `id`
- `customerId`
- `assetId`
- `title`
- `description`
- `priority`
- `status`
- `scheduledFor`
- `completedAt`

Valid priorities:

- `low`
- `normal`
- `urgent`

Valid statuses:

- `open`
- `scheduled`
- `in_progress`
- `completed`
- `cancelled`

## Required Behavior

- Users can list, create, read, update, and delete customers.
- Users can list, create, read, update, and delete assets.
- Users can list, create, read, update, and delete work orders.
- Asset create/update rejects unknown `customerId` values.
- Work order create/update rejects unknown `customerId` and `assetId` values.
- Work order create/update rejects an `assetId` that belongs to a different customer.
- `completedAt` is required when status is `completed`.
- `completedAt` must be empty unless status is `completed`.
- Delete behavior must not leave dangling work orders.
- The UI must expose list, create, edit, detail, and delete flows for each entity.
- The app must include seed data with at least two customers, three assets, and three
  work orders.

## Required Verification

The final workspace must include:

- a README with install, test, and run commands
- automated tests for domain validation
- at least one integration-style test for each entity family
- a machine-readable run manifest
- a verification report summarizing commands and outcomes

Do not read, modify, or depend on any hidden verifier file.
