import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16: this file replaces middleware.ts.
// Only handles the language prefix. Login is NOT checked here: the access token lives
// in browser memory and the refresh cookie belongs to the API host, so auth guards
// run in the browser (step 1c).
export default createMiddleware(routing);

export const config = {
  // Everything except Next internals and files with a dot (sw.js, manifest, icons, images).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};