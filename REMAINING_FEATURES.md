# Features still to build

Last updated: 2026-11-24. Everything else is built and pushed on branch `naimur`.

## Needs the backend first

| Feature | What is missing | Frontend work once ready |
|---|---|---|
| Real bKash / Nagad payments | The backend payment provider is a stub (returns 501). Merchant accounts are needed. | Replace the pay-mock button with `POST /orders/:id/payments`, then redirect to `redirectUrl`. Handle the success, failed and cancelled return pages. |
| Real SMS / WhatsApp sending | The provider is a stub. A provider account is needed. | No UI change needed. The opt-out and `/admin/messages` log are already done. Only test with real phones. |

## Frontend only (optional ideas)

- [x] To-Let: warn the owner before submitting a listing with no photos.
- [ ] Small home advert row: shrink the text if long advert titles look crowded at 390px.

## Recently built

- Product deletion: shop owners request it (hidden at once, deleted after 12 hours unless an admin rejects). Shared or catalog products delete only the owner's listing. Admins have `/admin/deletion-requests` and "Delete permanently" on products. Anything with orders is only switched off.
- Home page: the shops-to-let row and the product shelves always show, with an empty note when there is nothing yet.

## Decided not to do

- Bangla text for the 13 old admin namespaces. The owner said "no translate".
- Bangla CSV import row errors (server messages stay English). The owner said not needed.
