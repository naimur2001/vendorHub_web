"use client";

import { useEffect } from "react";

// Registers /sw.js in production builds only.
// In development a service worker would keep serving old files while you code.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);

  return null;
}