"use client";

import { useEffect } from "react";

// Production: register /sw.js (offline page, cached build files).
// Development: remove any worker and caches left over from a production test on the same
// address (localhost:3000). In dev, file names stay the same while their content changes, so a
// worker from `npm run start` would keep serving old code and cause hydration errors.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {});
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith("vh-")).map((key) => caches.delete(key))))
          .catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);

  return null;
}