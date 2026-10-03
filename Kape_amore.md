# Coffee Shop POS

A coffee shop Point-of-Sale (POS) system built for dine-in, takeout, and delivery operations.

## Tech Stack

* **Backend:** Laravel
* **Frontend:** React.js
* **Styling:** Tailwind CSS 4 through the `@tailwindcss/vite` Vite plugin
* **Database:** MySQL
* **API:** Laravel REST API
* **Authentication:** Laravel Sanctum
* **ORM:** Laravel Eloquent
* **Package Manager:** Composer + NPM
* **Version Control:** Git / GitHub

## Features

### POS / Sales

* Product/menu management
* Product categories
* Product variants/sizes
* Add-ons/customizations
* Dine-in orders
* Takeout orders
* Delivery orders
* Add items to cart
* Order quantity adjustment
* Order notes
* Discount handling
* Tax/service charge
* Order total calculation
* Hold/resume orders
* Order cancellation
* Receipt generation
* Order history

### Table / Dine-in Management

* Table management
* Table status

  * Available
  * Occupied
  * Reserved
* Assign order to table
* Transfer order to another table
* Merge tables
* Table capacity
* Table layout

### Payment

* Cash payment
* Card payment
* E-wallet payment
* Multiple payment methods
* Payment confirmation
* Change calculation
* Payment history
* Refund/void transaction

### Inventory

* Ingredient management
* Stock management
* Stock-in / stock-out
* Stock adjustment
* Low-stock alerts
* Inventory history
* Ingredient usage tracking
* Product-to-ingredient mapping
* Automatic ingredient deduction after sale

### Delivery

* Customer information
* Delivery address
* Delivery fee
* Delivery status
* Assign delivery order
* Delivery order tracking

  * Pending
  * Preparing
  * Ready
  * Out for delivery
  * Delivered
  * Cancelled

### Customer Management

* Customer registration
* Customer profiles
* Contact information
* Order history
* Customer purchase history
* Loyalty points
* Customer discounts

### Employee / User Management

* User accounts
* Role-based access
* Admin
* Manager
* Cashier
* Staff
* Login/logout
* Password management
* Permission management
* Activity logs

### Dashboard / Reports

* Daily sales
* Weekly sales
* Monthly sales
* Total orders
* Average order value
* Best-selling products
* Sales by category
* Sales by payment method
* Inventory status
* Low-stock products
* Employee sales
* Delivery sales
* Dine-in vs takeout vs delivery

### Settings

* Shop information
* Tax settings
* Service charge
* Receipt settings
* Payment settings
* Delivery fee settings
* User/role settings
* POS configuration

## System Architecture

```text
React.js
    ↓
Tailwind CSS
    ↓
Laravel REST API
    ↓
Laravel Controllers
    ↓
Eloquent ORM
    ↓
MySQL
```

## Development Priority

### Phase 1 — Core POS

* Authentication
* User roles
* Product management
* Categories
* POS/cart
* Orders
* Payments
* Receipts

### Phase 2 — Inventory

* Ingredients
* Stock management
* Product ingredients
* Automatic stock deduction
* Low-stock alerts

### Phase 3 — Dine-in

* Table management
* Table status
* Assign orders to tables
* Transfer/merge tables

### Phase 4 — Delivery

* Customer management
* Delivery orders
* Delivery addresses
* Delivery fees
* Delivery status

### Phase 5 — Reports

* Sales dashboard
* Sales reports
* Product performance
* Inventory reports
* Employee reports

### Phase 6 — Additional Features

* Loyalty points
* Customer discounts
* Advanced permissions
* Activity logs
* Advanced POS settings

## Laravel Backend MVC Structure

The Laravel application will live in `backend/`. Keep Eloquent models in `app/Models`, REST API controllers in `app/Http/Controllers/Api`, and route-specific validation and response formatting in Form Requests and API Resources. Put multi-step business workflows in Services rather than making controllers responsible for all business logic.

```text
backend/
├── app/
│   ├── Enums/                         # Order, payment, table, and delivery statuses
│   ├── Events/                        # Order and inventory events
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   │   ├── Auth/
│   │   │   ├── Catalog/               # Categories, products, variants, add-ons
│   │   │   ├── Customers/
│   │   │   ├── Delivery/
│   │   │   ├── Inventory/
│   │   │   ├── Orders/
│   │   │   ├── Payments/
│   │   │   ├── Reports/
│   │   │   ├── Settings/
│   │   │   ├── Tables/
│   │   │   └── Users/
│   │   ├── Requests/Api/              # Validated API input, grouped by feature
│   │   └── Resources/Api/             # Consistent JSON responses
│   ├── Listeners/
│   ├── Models/                        # Eloquent entities and relationships
│   ├── Notifications/
│   ├── Policies/                      # Authorization rules
│   └── Services/
│       ├── Delivery/
│       ├── Inventory/
│       ├── Orders/
│       ├── Payments/
│       └── Reports/
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── resources/views/receipts/           # Printable receipt templates
├── routes/                            # API endpoint definitions
└── tests/
    ├── Feature/Api/
    └── Unit/
```

Suggested model groups include users/roles, categories/products/variants/add-ons, orders/order items, payments, tables, customers/addresses, deliveries, ingredients/recipes, inventory transactions, and shop settings. Add concrete model, controller, migration, and test files as each feature is implemented; Laravel's standard project files should be generated by Composer rather than handwritten.

## Database Design

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the proposed MySQL tables, columns, relationships, deletion rules, and implementation order.

## Customer Landing Page

The React frontend includes a responsive customer-facing café homepage in `frontend/`, using the supplied logo at `frontend/public/images/kape-amore-logo.png` and a matching espresso-brown, cream, and caramel palette. It features a split-photo hero, prominent menu calls to action, three featured product cards, and café story/visit sections. Featured items, prices, and photography are presentation examples until connected to the catalog and confirmed shop data. The current "Order now" call to action navigates to the featured menu; online checkout is not implemented yet.

Tailwind CSS 4 is integrated through Vite's `@tailwindcss/vite` plugin. The shared theme defines the café palette and DM Sans font, and the landing, authentication, and account dashboard interfaces use Tailwind utility classes. Global base styles and bespoke CSS are limited to shared browser defaults, complex photo backgrounds, and the hero overlay.

## Authentication

The frontend contains login, customer registration, forgot/reset-password forms, and role- and permission-aware account/admin routes. The admin workspace reuses the dashboard sidebar and connects its POS and sales, menu/catalog, tables, payments, inventory, delivery, customers, team/access, reports, and settings sections to Laravel APIs and MySQL records. Orders and payment totals are calculated server-side; stock changes are ledgered, refunds are capped at the unrefunded balance, and assigned role permissions are enforced by the API. Card and e-wallet entries are recorded but are not charged through a payment provider. See [AUTHENTICATION.md](./AUTHENTICATION.md) for local setup and access-control details and [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the implemented business schema.
