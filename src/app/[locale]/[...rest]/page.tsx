import { notFound } from "next/navigation";

// Any address that matches no page (like /auth/auth/register/shop) ends here,
// so it shows our own not-found page instead of the plain default one.

// This page always shows "not found", so it can't be pre-checked for instant navigation.
export const instant = false;

export default function CatchAll() {
  notFound();
}