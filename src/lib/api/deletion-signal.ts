// Works on server and browser (no "client-only"): only signals in the browser.
export const DELETION_EVENT = "vh:deletion-pending";

/** Any 403 with code ACCOUNT_DELETION_PENDING opens the deletion notice. Returns the error unchanged. */
export function reportDeletion<E>(err: E): E {
  if (typeof window === "undefined") return err;
  const e = err as { status?: unknown; details?: { code?: unknown; deletionScheduledFor?: unknown } };
  if (e?.status === 403 && e.details?.code === "ACCOUNT_DELETION_PENDING") {
    const date = typeof e.details.deletionScheduledFor === "string" ? e.details.deletionScheduledFor : null;
    window.dispatchEvent(new CustomEvent<string | null>(DELETION_EVENT, { detail: date }));
  }
  return err;
}