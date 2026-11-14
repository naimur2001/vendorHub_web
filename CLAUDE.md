# Vendors Hub frontend (Next.js)

@AGENTS.md

Multi-vendor marketplace for physical shops in Dhaka. Backend API: `../vendors-hub-api` (http://localhost:4000).

## Commands
- `npm run dev`: port 3000 only (the backend CORS allows only http://localhost:3000)
- `npm run lint`: must show 0 errors
- `npm run build`: must end with ✓ before every commit
- `npm run api:types`: after the backend changes
- Never run `npm audit fix --force`. Install packages only after asking, with exact versions (`npm i -E`).

## Stack (locked)
Next.js 16 (Turbopack, App Router, `cacheComponents: true`), TypeScript, Tailwind v4, shadcn/ui, TanStack Query, next-intl 4 (`en` default, `bn`), react-hook-form + Zod.

## Never break
- Tailwind runs as a Turbopack loader in `next.config.ts` (`turbopack.rules["*.css"]`). Never remove it.
- `src/proxy.ts` is the Next 16 name for middleware. Don't rename it.
- Anything reading time (`useNow`, `Date`) or searchParams goes inside `<Suspense>`.
- Admin pages and `[...rest]` keep `export const instant = false`.
- `useNow({ updateInterval: 60_000 })` for every `format.relativeTime()`.
- `html { overflow-y: scroll }` and `.scroll-row` in globals.css prevent page jumps.
- CSP blocks `fetch()` of `data:` URLs. Convert with `atob`.
- Fonts are self-hosted (`next/font/local`). No Google Fonts.

## Security (never break)
- Access token in memory only. No localStorage, sessionStorage or JS cookies.
- User text as plain text only. No dangerouslySetInnerHTML, eval or innerHTML.
- Images only through `safeMediaUrl()`. Private files only through `fetchPrivateFile`.
- Validate every URL param (slug, UUID, number) before use.
- Prices always come from the server.
- No secrets in `NEXT_PUBLIC_` variables. Never log tokens or personal data.

## Code conventions
- Every new text goes into BOTH `messages/en.json` and `messages/bn.json`. Check JSON validity afterwards.
- Design: bordeaux #7A1E2C, ivory #FAF6EF, gold #B08D57; Playfair Display headings, Jost body; arch motif. Use the existing classes (`type-body`, `type-h3`, `bg-action`…). No new colours.
- Every interactive element: keyboard, focus ring, accessible name, touch target at least 44px.
- Mobile first: check at 390px, no sideways page scroll.
- Handle loading, empty and error states.

## Animation rules
- CSS only (Tailwind `motion-safe:`). No animation library.
- Respect reduced motion always.
- Animate only `transform` and `opacity`, 150–300 ms, no layout shift.
- No looping animation except loading indicators.

## Git
- Branch `naimur`. After lint and build pass: `git add .`, `git commit -m "type(scope): message"`, `git push`.
- Never `--force`. Never commit `.env*`.
- "Could not resolve host" on push is a network drop: retry.

## Working style
- Short answers. Ask before big changes. At most 5 files per step. Say how to test.