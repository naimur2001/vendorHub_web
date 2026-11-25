# Features still to build

Last updated: 2026-11-25. Everything not listed here is built and pushed on branch `naimur`.

## Next: courier delivery, step 3 (the rest)

For now every delivery goes through **Vendors Hub courier (Pathao)**. The shop's own delivery comes later.

### 1. Backend first (the prompt was sent on 2026-11-25)

The backend is still on commit `678e74b`. It does **not** have these yet:

1. `GET /shops/mine` (and the owner's shop settings data): add `deliveryMode` and `courierReady` (true when `courierStoreId` is set).
2. `GET /admin/shops`: add `deliveryMode`, `courierStoreId` and `courierStoreState` (NONE | PENDING_APPROVAL | READY), with filters for both. Save the PENDING_APPROVAL state, so "Check again" does not ask for the area again.
3. Delivery fee before ordering: `deliveryQuote: { zoneCode, zoneName, fee, etaText } | null` on each address in `GET /users/me/addresses`, plus `GET /delivery/quote?addressId=`.
4. Cart: `shop.courierDelivery` and `shop.deliveryAvailable` exist in `cart.service.js` but not in OpenAPI. For courier shops, `deliveryFee: null` until an address is chosen.
5. Make `PLATFORM_COURIER` the default for new shops and migrate existing shops to it (all 15 local shops are `OWN` now). Keep `OWN` in the code for later.

Already in the backend: checkout takes `addressId` and returns `ADDRESS_NEEDS_AREA`, `AREA_UNAVAILABLE` and `DELIVERY_UNAVAILABLE`.

Before building, check the backend: run `npm run api:types` and look for `deliveryQuote` and `courierStoreState` in `src/lib/api/schema.d.ts`.

### 2. Frontend once the backend is ready

- [ ] **Checkout:** for courier shops, choose a saved address with a delivery area, show the courier fee from the server before ordering, and send `addressId`. Explain the errors `ADDRESS_NEEDS_AREA`, `AREA_UNAVAILABLE` and `DELIVERY_UNAVAILABLE`.
- [ ] **Admin → Shops:** show the saved store state on each shop (none, waiting for approval, ready) and a filter for shops still waiting. The button itself is done.
- [ ] **Owner → Orders:** test the courier card and booking with a real courier order (none exist locally until item 5).

### 3. Your action (not code)

- [ ] Get **Pathao sandbox keys**, put them in the backend `.env`, run `node --env-file=.env scripts/check-pathao.mjs`, and send the output to the backend session. Keep `COURIER_MODE=mock` until it passes.

## Needs the backend or accounts first

| Feature | What is missing | Frontend work once ready |
|---|---|---|
| Real bKash / Nagad payments | The backend payment provider is a stub (returns 501). Merchant accounts are needed. | Replace the pay-mock button with `POST /orders/:id/payments`, then redirect to `redirectUrl`. Handle the success, failed and cancelled return pages. |
| Real SMS / WhatsApp sending | The provider is a stub. A provider account is needed. | No UI change needed. The opt-out and `/admin/messages` log are already done. Only test with real phones. |
| Shop's own delivery (later) | Decided 2026-11-24: build later. | Owner setting "My own delivery" vs "Vendors Hub courier". |
| Admin cancel at Pathao | Cancelling a booked order from the admin order monitor does not cancel it at Pathao. | Until then, admins cancel the shipment first in the Delivery monitor. |

## Frontend only (optional ideas)

- [x] To-Let: warn the owner before submitting a listing with no photos.
- [ ] Small home advert row: shrink the text if long advert titles look crowded at 390px.

## Recently built

- **Courier delivery, step 3 part 1 (2026-11-25):**
  - Owner → Orders: courier card (COD amount, paid or not, booking failed), "Ready for courier pickup" books the courier, "Book the courier again" while the booking is still pending, clear messages when the courier already manages the order.
  - Notification bell: `SHIPMENT_*` open Track order (customer), Owner → Orders (shop) or the Delivery monitor (admin, for problems).
  - Admin → Shops: "Courier store" panel creates or refreshes the shop's pickup store at the default courier, and asks for the pickup area only when needed.
  - Couriers & fees: courier zone picker inside a city, so Dhaka suburbs (for example Savar) get their own fee.
  - The City → Zone → Area picker is now shared: `src/components/delivery/area-picker.tsx`.
- **Courier delivery, steps 1, 2 and 4 (2026-11-24):**
  - Admin → Couriers & fees (`/admin/delivery/settings`): couriers on/off, default, sandbox; zone fees, delivery time and cities.
  - Addresses: City → Zone → Area picker.
  - Track order: courier card; the courier name appears only after pickup.
  - Admin → Delivery monitor (`/admin/delivery`): tiles, deliveries and profit per day, by courier and by shop, shipments with COD and shop payout actions.
- **My orders redesign:** journey status filter, receipt-style tickets with a progress track, arch doorway empty state.
- **Product deletion:** shop owners request it (hidden at once, deleted after 12 hours unless an admin rejects). Shared or catalog products delete only the owner's listing. Admins have `/admin/deletion-requests` and "Delete permanently" on products. Anything with orders is only switched off.
- **Home page:** the shops-to-let row and the product shelves always show, with an empty note when there is nothing yet.
- **Admin sidebar:** wider, scrolls on short screens.

## Decided not to do

- Bangla text for the 13 old admin namespaces. The owner said "no translate". New admin pages are English only too.
- Bangla CSV import row errors (server messages stay English). The owner said not needed.
