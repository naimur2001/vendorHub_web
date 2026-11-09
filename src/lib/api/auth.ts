import "client-only";
import { api, refreshSession, setSession } from "./client";
import { ApiError, type Role, type Session, type SessionUser } from "./core";

// Inputs match the backend's auth.schema.js
export type LoginInput = { email: string; password: string };

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string; // 01XXXXXXXXX
  role?: Extract<Role, "CUSTOMER" | "SHOP_OWNER">; // ADMIN can never self-register
};

export type ResetPasswordInput = { token: string; newPassword: string };

type Message = { message: string };

export async function login(input: LoginInput): Promise<SessionUser> {
  const session = await api.post<Session>("/auth/login", input, { auth: false, cookieMode: true });
  setSession(session);
  return session.user;
}

export async function register(input: RegisterInput): Promise<SessionUser> {
  const session = await api.post<Session>("/auth/register", input, { auth: false, cookieMode: true });
  setSession(session);
  return session.user;
}

// Clears the cookie on the server, then forgets the token here (even if the network call fails).
export async function logout(): Promise<void> {
  try {
    await api.post<Message>("/auth/logout", undefined, { auth: false, cookieMode: true });
  } finally {
    setSession(null);
  }
}

// Always the same answer, whether or not the email exists.
export function forgotPassword(email: string): Promise<Message> {
  return api.post<Message>("/auth/forgot-password", { email }, { auth: false });
}

export function resetPassword(input: ResetPasswordInput): Promise<Message> {
  return api.post<Message>("/auth/reset-password", input, { auth: false });
}

export function getMe(): Promise<SessionUser> {
  return api.get<SessionUser>("/auth/me");
}

// The backend revokes every session and clears the cookie, so the user must log in again.
export async function changePassword(oldPassword: string, newPassword: string): Promise<Message> {
  const result = await api.post<Message>("/auth/change-password", { oldPassword, newPassword });
  setSession(null);
  return result;
}

export { refreshSession };



// ---------- Email verification ----------

export function verifyEmail(token: string): Promise<Message> {
  return api.post<Message>("/auth/verify-email", { token }, { auth: false });
}

export function resendVerification(): Promise<{ alreadyVerified?: boolean }> {
  return api.post<{ alreadyVerified?: boolean }>("/auth/resend-verification");
}

/** The backend's 403 for actions that need a verified email (orders, offers, shops). */
export function isEmailNotVerified(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && (err.details as { code?: unknown } | undefined)?.code === "EMAIL_NOT_VERIFIED";
}


// ---------- Profile ----------

export function updateProfile(patch: { name?: string; phone?: string | null }): Promise<unknown> {
  return api.patch<unknown>("/users/me", patch);
}

export function changePassword(currentPassword: string, newPassword: string): Promise<unknown> {
  return api.post<unknown>("/auth/change-password", { currentPassword, newPassword });
}