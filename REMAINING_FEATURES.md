# Features still to build

Last updated: 2026-11-23. Everything else is built and pushed on branch `naimur`.

## Needs the backend first

| Feature | What is missing | Frontend work once ready |
|---|---|---|
| Real bKash / Nagad payments | The backend payment provider is a stub (returns 501). Merchant accounts are needed. | Replace the pay-mock button with `POST /orders/:id/payments`, then redirect to `redirectUrl`. Handle the success, failed and cancelled return pages. |
| Real SMS / WhatsApp sending | The provider is a stub. A provider account is needed. | No UI change needed. The opt-out and `/admin/messages` log are already done. Only test with real phones. |
| Bangla CSV import errors | The server returns row errors in English only. | Show the translated message if the backend sends an error code per row. |

## Frontend only (optional ideas)

- [ ] To-Let: warn the owner before submitting a listing with no photos.
- [ ] Small home advert row: shrink the text if long advert titles look crowded at 390px.

## Decided not to do

- Bangla text for the 13 old admin namespaces. The owner said "no translate".
