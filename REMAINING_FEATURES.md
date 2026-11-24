# Features still to build

Last updated: 2026-11-24. Everything not listed here is built and pushed on branch `naimur`.

## Tomorrow (2026-11-25): courier delivery, step 3

For now every delivery goes through **Vendors Hub courier (Pathao)**. The shop's own delivery comes later.

### 1. Backend first (send this to the backend session)

The backend commit `678e74b` does not have these yet:

1. `GET /shops/mine` (and the owner's shop settings data): add `deliveryMode` and `courierReady` (true when `courierStoreId` is set).
2. `GET /admin/shops`: add `deliveryMode`, `courierStoreId` and `courierStoreState` (NONE | PENDING_APPROVAL | READY), with filters for both.
3. Delivery fee before ordering: `deliveryQuote: { zoneCode, zoneName, fee, etaText } | null` on each address in `GET /users/me/addresses`, plus `GET /delivery/quote?addressId=`.
4. Cart: for courier shops (`courierDelivery: true`), delivery needs `addressId` (a saved address with an area); `deliveryFee: null` until an address is chosen.
5. Make `PLATFORM_COURIER` the default for new shops and migrate existing shops to it. Keep `OWN` in the code for later.

Before building, check the backend: run `npm run api:types` and look for `deliveryQuote` and `courierStoreState` in `src/lib/api/schema.d.ts`.

### 2. Frontend once the backend is ready

- [ ] **Admin → Shops:** a "Create Pathao store" button on each shop (`POST /admin/shops/:shopId/courier-store`), its state (none, waiting for Pathao approval, ready), and a filter for shops still waiting.
- [ ] **Shop owner → Orders:** the courier status card (`CourierStatus` with the shop extras: COD amount, paid or not, booking failed) and a **Ready for pickup** button (`POST /shops/:shopId/orders/:orderId/ship`).
- [ ] **Checkout:** for courier shops, choose a saved address with a delivery area, show the courier fee from the server before ordering, and send `addressId`. Explain the errors `ADDRESS_NEEDS_AREA`, `AREA_UNAVAILABLE` and `DELIVERY_UNAVAILABLE`.
- [ ] **Notification bell:** link `SHIPMENT_*` notifications to Track order (customer) or Owner → Orders (shop).

### 3. Optional, frontend only

- [ ] **Zone picker in Couriers & fees:** the zone editor picks cities only. Add the courier zones inside a city, so Dhaka suburbs get their own fee instead of the outside-Dhaka fee (৳150).

### 4. Your action (not code)

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
