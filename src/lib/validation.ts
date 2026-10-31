import { z } from "zod";

// Shared form rules, so sign-up and password reset can never drift apart.
// They match the backend's Zod schemas, a little stricter where noted.

export const BD_MOBILE = /^01\d{9}$/;

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "+880 1712-345678", "০১৭১২৩৪৫৬৭৮" -> "01712345678" (the format the backend expects). */
export function normalizePhone(value: string): string {
  let v = value.trim().replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
  v = v.replace(/[\s\-().]/g, "");
  if (v.startsWith("+880")) v = `0${v.slice(4)}`;
  else if (v.startsWith("880") && v.length === 13) v = `0${v.slice(3)}`;
  return v;
}

/** Email: trimmed, required, valid, at most 254 characters. */
export function emailField(messages: { required: string; invalid: string }) {
  return z
    .string()
    .trim()
    .min(1, { error: messages.required })
    .max(254, { error: messages.invalid })
    .pipe(z.email({ error: messages.invalid }));
}

/** Required Bangladesh mobile number in any common writing; validated after normalising. */
export function phoneField(messages: { required: string; invalid: string }) {
  return z
    .string()
    .max(25, { error: messages.invalid })
    .refine((v) => normalizePhone(v) !== "", { error: messages.required })
    .refine((v) => {
      const n = normalizePhone(v);
      return n === "" || BD_MOBILE.test(n);
    }, { error: messages.invalid });
}

/**
 * New password: 8+ characters, at most 72 bytes (bcrypt only uses the first 72 bytes; Bangla
 * letters and emoji take several bytes each), letters and numbers (stricter than the backend).
 */
export function newPasswordField(messages: { short: string; long: string; weak: string }) {
  return z
    .string()
    .min(8, { error: messages.short })
    .refine((v) => new TextEncoder().encode(v).length <= 72, { error: messages.long })
    .refine((v) => /\p{L}/u.test(v) && /\p{N}/u.test(v), { error: messages.weak });
}