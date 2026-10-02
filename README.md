# Kitchen Orders Board

### Overview

A kitchen orders Kanban board with 4 columns (`new → preparing → ready → served`), an order details page, a create-order page, and full Arabic/English support.

### Tech Stack

- **Angular** (standalone components, Signals, OnPush)
- **TypeScript**, **RxJS**
- **Reactive Forms**
- **Tailwind CSS** + **animate.css** + **SCSS**
- **ngx-translate** (AR/EN)
- **ngx-toastr** (notifications)

### Features

- Kanban board with 4 statuses: `new → preparing → ready → served`
- Search by order or table number, and filter by type (`dine-in`, `takeaway`, `delivery`)
- Auto-refresh every 15 seconds
- "Late" flag for orders older than 20 minutes
- Create an order with dynamic item rows and automatic totals
- Totals include service charge (12%, dine-in only) and VAT (14%), calculated in one shared util
- Arabic / English switch, saved in `localStorage`

### Getting Started

```bash
npm install
ng serve
```

Then open `http://localhost:4200`.

Other commands:

```bash
ng build   # production build
ng test    # unit tests
```

### Configuration

The API base URL is read from `src/environments/environment.ts` (`baseUrl`).
The app expects these endpoints:

| Method | Endpoint      | Purpose             |
| ------ | ------------- | ------------------- |
| GET    | `/orders`     | List orders         |
| GET    | `/orders/:id` | Get one order       |
| POST   | `/orders`     | Create an order     |
| PATCH  | `/orders/:id` | Update order status |
| GET    | `/menu`       | List menu items     |

### Routes

| Path                 | Page          |
| -------------------- | ------------- |
| `/order-list`        | Kanban board  |
| `/new-order`         | Create order  |
| `/order-details/:id` | Order details |

### Tech Used and Why

| Decision                                                       | Reason                                                                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signals** instead of plain fields                            | Automatic dependency tracking, and works naturally with OnPush without `markForCheck`.                                                                                        |
| **`OnPush`**                                                   | Fewer change-detection cycles, which matters with 15s polling and a periodic "now" tick.                                                                                      |
| **`computed()`** (`byStatus`, `filteredOrders`, `typeOptions`) | Derived state is memoized and only recalculated when its dependencies change.                                                                                                 |
| **New control flow** (`@if`, `@for`, `@empty`)                 | Faster and cleaner than structural directives, and needs no imports.                                                                                                          |
| **Reactive Forms + `FormArray`**                               | Dynamic item rows, each with its own validation and total calculation.                                                                                                        |
| **Form built once + `patchValue`**                             | The next order number arrives async, so it is patched into the existing form instead of rebuilding it (a rebuild would wipe whatever the user already entered).               |
| **`getRawValue()`** on submit                                  | `price` and `total` are disabled controls, so they're missing from `form.value`.                                                                                              |
| **`timer(0, 15000)` + `exhaustMap` + `takeUntil`**             | 15s polling. `exhaustMap` prevents overlapping requests on a slow API, and `takeUntil` cleans up on destroy.                                                                  |
| **Optimistic update** in `moveToNextStep`                      | Instant UI feedback, with rollback and a toast if the API fails.                                                                                                              |
| **400ms search debounce**                                      | Avoids navigating and filtering on every keystroke.                                                                                                                           |
| **Query params** (`search`, `type`)                            | Filters survive refresh, are shareable, and work with the back button.                                                                                                        |
| **`ngx-translate`** + `dir`/`lang` on `<html>`                 | Arabic RTL / English LTR, with the language persisted in `localStorage`.                                                                                                      |
| **`ngx-toastr`**                                               | Success and error notifications.                                                                                                                                              |
| **Tailwind + animate.css**                                     | Fast, consistent styling and light card animations.                                                                                                                           |
| **Dedicated `OrdersService`**                                  | All HTTP lives in one place, so components don't know about URLs.                                                                                                             |
| **Shared pricing util** (`utils/order-pricing.ts`)             | One source of truth for subtotal, 12% service (dine-in only) and 14% VAT on (subtotal + service). Used by the list, details and new-order pages, so totals can't drift apart. |
| **`isLate()`**                                                 | Orders older than 20 minutes that aren't `ready`/`served` get flagged. The "now" signal ticks every 60s, which is precise enough for a minutes-scale threshold.               |

### Improvement Notes (with more time)

1. **Order number is generated client-side**, so it can collide with multiple users. Generate it on the backend.

2. **`createdAt`** is set when the form is built, not when the order is submitted.

### Left Unfinished

- No pagination on the orders list.
- No popup should appear when incorrectly exiting the form while adding an order.
- No edits can be made to an order.
