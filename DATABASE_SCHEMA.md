# Kape Amore POS Database Schema

## 1. Purpose and conventions

This document describes the MySQL 8 schema for the Kape Amore Laravel REST API and React POS. The authentication and business tables described below are implemented as migrations in `backend/database/migrations`.

- Use InnoDB and `utf8mb4`.
- Use Laravel `BIGINT UNSIGNED` auto-increment primary keys (`id`) and matching foreign keys.
- Use `DECIMAL`, never floating-point types, for money and measured inventory quantities.
- Store timestamps in UTC; convert to the shop's configured timezone for display and reports.
- Use `created_at` and `updated_at` on mutable business records. Add `deleted_at` only where soft deletion is useful; do not soft-delete financial or inventory ledger records.
- Keep changing statuses as strings backed by PHP enums. Validate allowed transitions in the application.
- Use foreign keys and indexes for relationships and common POS/report filters.
- Preserve product, price, tax, discount, and customer/address snapshots on completed orders so later edits do not rewrite transaction history.

## 2. Relationship overview

```text
users ──< orders >── customers ──< customer_addresses
  │         │  │
  │         │  ├──< order_items >── products / product_variations
  │         │  │         └──< order_item_modifiers
  │         │  ├──< payments ──< refunds
  │         │  ├──< order_status_history
  │         │  ├──< order_table_assignments >── dining_tables
  │         │  └──── delivery ── users (rider), customer_addresses
  │
  └── role_user >── roles ── permission_role >── permissions

categories ──< products ──< product_variations
                       ├── product_modifier_group >── modifier_groups ──< modifier_options
                       └──< recipes ──< recipe_items >── ingredients ──< inventory_transactions

discounts ──< order_discounts >── orders
users ──< activity_logs
```

## 3. Authentication and access control

Use Laravel's standard `users` and `password_reset_tokens` tables plus the database-backed `sessions` table. Sanctum is installed for stateful SPA authentication; personal access tokens are not used for the browser login flow.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `name` | VARCHAR(150) | Employee name |
| `email` | VARCHAR(255) UNIQUE NOT NULL | Current required login identifier |
| `password` | VARCHAR(255) | Hashed by Laravel |
| `is_active` | BOOLEAN | Default true |
| `email_verified_at` | TIMESTAMP NULL | Laravel-compatible |
| `remember_token` | VARCHAR(100) NULL | Laravel-compatible |
| `created_at`, `updated_at` | TIMESTAMP | |

The current login flow uses a required, unique email address as its login identifier. Phone-based login is not implemented.

### `roles`, `permissions`, `role_user`, `permission_role`

- `roles`: `id`, `name` VARCHAR(80) UNIQUE, `display_name` VARCHAR(120), timestamps. Implemented roles are seeded as `customer`, `admin`, `manager`, `cashier`, and `staff`. Public registration assigns only `customer`; administrative roles must be provisioned securely by the backend.
- `permissions`: `id`, `name` VARCHAR(120) UNIQUE, `display_name` VARCHAR(160), timestamps.
- `role_user`: `role_id`, `user_id`, timestamps; composite primary key (`role_id`, `user_id`).
- `permission_role`: `permission_id`, `role_id`; composite primary key (`permission_id`, `role_id`).

Both role pivots have cascading foreign keys. The API returns effective permission names with the authenticated user; backend endpoints enforce permissions independently of frontend navigation. Administrators are superusers. The default manager role has operational permissions but not `admin.manage`, which controls staff, permissions, and settings. Do not store comma-separated roles or permissions on `users`.

## 4. Menu and product catalog

### `categories`

`id`; `name` VARCHAR(120); `slug` VARCHAR(140) UNIQUE; `description` TEXT NULL; `sort_order` SMALLINT UNSIGNED DEFAULT 0; `is_active` BOOLEAN DEFAULT true; timestamps; optional `deleted_at`.

### `products`

`id`; `category_id` FK to `categories` (RESTRICT); `name` VARCHAR(160); `sku` VARCHAR(80) NULL UNIQUE; `description` TEXT NULL; `image_path` VARCHAR(500) NULL; `base_price` DECIMAL(12,2); `is_available` BOOLEAN DEFAULT true; `sort_order` SMALLINT UNSIGNED DEFAULT 0; timestamps; optional `deleted_at`.

### `product_variations`

`id`; `product_id` FK (CASCADE); `name` VARCHAR(100) (e.g. size); `sku` VARCHAR(80) NULL; `price` DECIMAL(12,2); `is_available` BOOLEAN DEFAULT true; `sort_order` SMALLINT UNSIGNED DEFAULT 0; timestamps. Add unique (`product_id`, `name`) and optional unique (`sku`).

Represent an un-sized product with no variation rows. An order item may have a null `product_variation_id` for that case.

In the admin product form, single-price products (such as food) use `base_price`, while size-priced products (such as drinks) define their size names and prices inline. For size-priced products, `base_price` stores the lowest available size price for POS listing and backward compatibility; checkout requires a selected size. Removed sizes are marked unavailable rather than deleted so historical recipe/variation links are preserved.

### `modifier_groups`, `modifier_options`, `product_modifier_group`

- `modifier_groups`: `id`, `name` VARCHAR(120), `min_select` TINYINT UNSIGNED DEFAULT 0, `max_select` TINYINT UNSIGNED DEFAULT 1, `is_required` BOOLEAN DEFAULT false, `is_active` BOOLEAN DEFAULT true, timestamps.
- `modifier_options`: `id`, `modifier_group_id` FK (CASCADE), `name` VARCHAR(120), `price_adjustment` DECIMAL(12,2) DEFAULT 0, `is_available` BOOLEAN DEFAULT true, `sort_order` SMALLINT UNSIGNED DEFAULT 0, timestamps; unique (`modifier_group_id`, `name`).
- `product_modifier_group`: `product_id` FK (CASCADE), `modifier_group_id` FK (CASCADE), `sort_order` SMALLINT UNSIGNED DEFAULT 0; composite primary key (`product_id`, `modifier_group_id`).

## 5. Customers and dine-in tables

### `customers`

`id`; `name` VARCHAR(160); `phone` VARCHAR(30) NULL INDEX; `email` VARCHAR(255) NULL; `notes` TEXT NULL; `loyalty_points` INT UNSIGNED DEFAULT 0; timestamps; optional `deleted_at`.

### `customer_addresses`

`id`; `customer_id` FK (CASCADE); `label` VARCHAR(80) NULL; `recipient_name` VARCHAR(160); `phone` VARCHAR(30); `address_line` VARCHAR(255); `address_line_2` VARCHAR(255) NULL; `city` VARCHAR(120); `region` VARCHAR(120) NULL; `postal_code` VARCHAR(20) NULL; `latitude` DECIMAL(10,7) NULL; `longitude` DECIMAL(10,7) NULL; `delivery_notes` TEXT NULL; `is_default` BOOLEAN DEFAULT false; timestamps. Index `customer_id`.

### `dining_tables`

`id`; `name` VARCHAR(80) UNIQUE; `capacity` TINYINT UNSIGNED; `status` VARCHAR(20) (available, occupied, reserved); `area` VARCHAR(100) NULL; `layout_x` DECIMAL(8,2) NULL; `layout_y` DECIMAL(8,2) NULL; `is_active` BOOLEAN DEFAULT true; timestamps.

### `order_table_assignments`

`id`; `order_id` FK (CASCADE); `dining_table_id` FK (RESTRICT); `assigned_by` FK to `users` (SET NULL); `assigned_at` TIMESTAMP; `released_at` TIMESTAMP NULL. Index (`dining_table_id`, `released_at`) for current table assignments. This history-capable pivot supports table transfer; merging tables assigns the order to multiple tables. Enforce at most one active order per table in the order/table service using a transaction and row locks.

## 6. Orders, items, and discounts

### `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `order_number` | VARCHAR(40) UNIQUE | Human-readable receipt/order identifier |
| `order_type` | VARCHAR(20) | `dine_in`, `takeout`, `delivery` |
| `status` | VARCHAR(24) INDEX | draft, held, confirmed, preparing, ready, served, completed, cancelled |
| `customer_id` | BIGINT UNSIGNED NULL FK | SET NULL |
| `created_by` | BIGINT UNSIGNED FK | User who opened the sale |
| `subtotal` | DECIMAL(12,2) | Item totals before order-level adjustments |
| `discount_total` | DECIMAL(12,2) DEFAULT 0 | Snapshot total |
| `tax_total` | DECIMAL(12,2) DEFAULT 0 | Snapshot total |
| `service_charge_total` | DECIMAL(12,2) DEFAULT 0 | Snapshot total |
| `delivery_fee` | DECIMAL(12,2) DEFAULT 0 | Snapshot total |
| `total` | DECIMAL(12,2) | Amount due |
| `notes` | TEXT NULL | Order-level notes |
| `placed_at` | TIMESTAMP NULL | When submitted to kitchen |
| `completed_at` | TIMESTAMP NULL | When sale completed |
| `cancelled_at` | TIMESTAMP NULL | |
| `cancellation_reason` | VARCHAR(500) NULL | |
| `created_at`, `updated_at` | TIMESTAMP | |

Index (`status`, `created_at`), (`order_type`, `created_at`), and `customer_id`. Totals are calculated and validated server-side. A held order stays an order with `held` status; do not represent the POS cart only in the browser.

### `order_items`

`id`; `order_id` FK (CASCADE); `product_id` FK (SET NULL); `product_variation_id` FK (SET NULL); `product_name` VARCHAR(160); `variation_name` VARCHAR(100) NULL; `sku` VARCHAR(80) NULL; `quantity` DECIMAL(10,3); `unit_price` DECIMAL(12,2); `line_discount` DECIMAL(12,2) DEFAULT 0; `tax_rate` DECIMAL(7,4) DEFAULT 0; `tax_amount` DECIMAL(12,2) DEFAULT 0; `line_total` DECIMAL(12,2); `notes` VARCHAR(500) NULL; timestamps. Index `order_id`; product and variation names/prices are snapshots.

### `order_item_modifiers`

`id`; `order_item_id` FK (CASCADE); `modifier_option_id` FK (SET NULL); `modifier_group_name` VARCHAR(120); `option_name` VARCHAR(120); `price_adjustment` DECIMAL(12,2); `quantity` DECIMAL(8,3) DEFAULT 1; timestamps. Snapshot names and price so catalog changes do not alter old receipts.

### `discounts`, `order_discounts`

- `discounts`: `id`, `name` VARCHAR(120), `code` VARCHAR(60) NULL UNIQUE, `type` VARCHAR(20) (`fixed`, `percentage`), `value` DECIMAL(12,2), `starts_at` TIMESTAMP NULL, `ends_at` TIMESTAMP NULL, `is_active` BOOLEAN DEFAULT true, `created_by` FK to `users` (SET NULL), timestamps.
- `order_discounts`: `id`, `order_id` FK (CASCADE), `discount_id` FK (SET NULL), `name` VARCHAR(120) snapshot, `type` VARCHAR(20) snapshot, `value` DECIMAL(12,2) snapshot, `amount` DECIMAL(12,2), `applied_by` FK to `users` (SET NULL), timestamps.

## 7. Payments and refunds

### `payments`

`id`; `order_id` FK (CASCADE); `method` VARCHAR(24) (cash, card, e_wallet, bank_transfer, other); `status` VARCHAR(20) (pending, completed, failed, voided, partially_refunded, refunded); `amount` DECIMAL(12,2); `tendered_amount` DECIMAL(12,2) NULL; `change_amount` DECIMAL(12,2) DEFAULT 0; `reference_number` VARCHAR(120) NULL; `processed_by` FK to `users` (SET NULL); `paid_at` TIMESTAMP NULL; timestamps. Index (`order_id`, `status`).

Allow multiple payment rows per order for split tender. For cash, `tendered_amount` is what the customer handed over and `change_amount` is computed by the server. Never store card security codes or full card numbers.

### `refunds`

`id`; `payment_id` FK (RESTRICT); `amount` DECIMAL(12,2); `reason` VARCHAR(500); `reference_number` VARCHAR(120) NULL; `status` VARCHAR(20) (pending, completed, failed); `processed_by` FK to `users` (SET NULL); `refunded_at` TIMESTAMP NULL; timestamps. Refunds are separate immutable records, not edits to the original payment amount.

## 8. Delivery

### `deliveries`

One-to-one with a delivery order. Fields: `id`; `order_id` FK UNIQUE (CASCADE); `customer_address_id` FK (SET NULL); `rider_id` FK to `users` (SET NULL); `status` VARCHAR(24) (pending, preparing, ready, assigned, out_for_delivery, delivered, cancelled); `delivery_fee` DECIMAL(12,2); `recipient_name` VARCHAR(160); `recipient_phone` VARCHAR(30); `address_snapshot` TEXT; `delivery_notes` TEXT NULL; `assigned_at`, `picked_up_at`, `delivered_at` TIMESTAMP NULL; timestamps. Store recipient/address snapshots because saved customer addresses may change.

## 9. Inventory and recipes

### `ingredients`

`id`; `name` VARCHAR(160); `sku` VARCHAR(80) NULL UNIQUE; `unit` VARCHAR(24) (g, kg, ml, l, each); `quantity_on_hand` DECIMAL(14,3) DEFAULT 0; `low_stock_threshold` DECIMAL(14,3) DEFAULT 0; `cost_per_unit` DECIMAL(12,4) DEFAULT 0; `is_active` BOOLEAN DEFAULT true; timestamps; optional `deleted_at`.

Use one consistent base unit per ingredient (e.g. grams rather than mixing grams and kilograms). Convert purchase units before posting stock movements.

### `recipes`, `recipe_items`

- `recipes`: `id`, `product_id` FK (CASCADE), `product_variation_id` FK (CASCADE, NULL for shared/default recipe), `name` VARCHAR(120) NULL, timestamps. Add appropriate unique constraints to prevent duplicate default or variation recipes.
- `recipe_items`: `id`, `recipe_id` FK (CASCADE), `ingredient_id` FK (RESTRICT), `quantity` DECIMAL(14,3), timestamps; unique (`recipe_id`, `ingredient_id`).

### `inventory_transactions`

`id`; `ingredient_id` FK (RESTRICT); `type` VARCHAR(20) (stock_in, sale, waste, adjustment, return); `quantity_change` DECIMAL(14,3) signed; `quantity_after` DECIMAL(14,3); `unit_cost` DECIMAL(12,4) NULL; `order_id` FK (SET NULL); `user_id` FK to `users` (SET NULL); `reference` VARCHAR(120) NULL; `notes` VARCHAR(500) NULL; `created_at` TIMESTAMP. Index (`ingredient_id`, `created_at`) and (`order_id`, `type`).

Treat this as an append-only stock ledger. Update `ingredients.quantity_on_hand` and insert the ledger row in the same database transaction while locking the ingredient row. Deduct recipe quantities once per completed order (or at the explicitly chosen sale-finalization point), and make the operation idempotent to prevent duplicate deductions on retries.

## 10. Order history, activity, loyalty, and settings

### `order_status_history`

`id`; `order_id` FK (CASCADE); `from_status` VARCHAR(24) NULL; `to_status` VARCHAR(24); `changed_by` FK to `users` (SET NULL); `notes` VARCHAR(500) NULL; `created_at` TIMESTAMP. Index (`order_id`, `created_at`).

### `activity_logs`

`id`; `user_id` FK (SET NULL); `action` VARCHAR(120); `subject_type` VARCHAR(160) NULL; `subject_id` BIGINT UNSIGNED NULL; `properties` JSON NULL; `ip_address` VARCHAR(45) NULL; `created_at` TIMESTAMP. Index (`user_id`, `created_at`) and (`subject_type`, `subject_id`). Avoid putting secrets, passwords, or payment credentials in `properties`.

### `loyalty_transactions` (Phase 6)

`id`; `customer_id` FK (RESTRICT); `order_id` FK (SET NULL); `points_change` INT signed; `type` VARCHAR(20) (earned, redeemed, adjustment, expired); `notes` VARCHAR(500) NULL; `created_by` FK to `users` (SET NULL); `created_at` TIMESTAMP. Keep this ledger as the audit source; `customers.loyalty_points` may be maintained as a transactional balance.

### `settings`

`id`; `key` VARCHAR(120) UNIQUE; `value` JSON; `group` VARCHAR(80); `updated_by` FK to `users` (SET NULL); timestamps. Store shop profile, currency/timezone, tax/service-charge settings, receipt preferences, and default delivery fee. Do not store secrets in general settings; use environment variables or a secrets manager.

## 11. Foreign-key deletion policy

- Use `CASCADE` for dependent catalog pivots and child rows that have no meaning without their parent.
- Use `RESTRICT` for financial, recipe, and inventory references where deletion could damage history.
- Use `SET NULL` for optional references to users, products, addresses, or discount definitions when snapshots preserve the historical record.
- Prefer deactivation or soft deletion over deleting products, users, customers, and ingredients referenced by completed transactions.

## 12. Implementation order

1. **Core POS:** users/roles/permissions, categories, products, variations, modifier groups/options, customers, dining tables, orders, items/modifiers, order status history, payments, discounts, settings.
2. **Inventory:** ingredients, recipes, recipe items, inventory transactions.
3. **Dine-in improvements:** order-table assignments and table lifecycle rules.
4. **Delivery:** customer addresses and deliveries.
5. **Reports and auditing:** activity logs and reporting indexes.
6. **Loyalty:** loyalty transactions and redemption rules.

Create each table with Laravel migrations, seed only safe reference data (roles and permissions), and cover foreign keys, totals, status transitions, split payments, refunds, and inventory idempotency with database-backed feature tests.
