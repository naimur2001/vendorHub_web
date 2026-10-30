"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSessionUser, refreshSession, subscribeSession } from "@/lib/api/client";
import { ApiError, type SessionUser } from "@/lib/api/core";

// ---------- Session ----------

export type SessionStatus = "loading" | "authenticated" | "guest";
type SessionState = { status: SessionStatus; user: SessionUser | null };

const SessionContext = createContext<SessionState | null>(null);

function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeSession((user) => {
      const id = user?.id ?? null;
      // Someone else (or nobody) is logged in now: drop data cached for the previous user.
      if (lastUserId.current !== undefined && lastUserId.current !== id) {
        queryClient.clear();
      }
      lastUserId.current = id;
      setState({ status: user ? "authenticated" : "guest", user });
    });

    // Page load: turn the httpOnly cookie (if any) into an access token in memory.
    refreshSession().catch(() => {
      // API unreachable: continue as a guest; requests will show their own errors.
      setState({ status: "guest", user: getSessionUser() });
    });

    return unsubscribe;
  }, [queryClient]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <AppProviders>");
  return value;
}

// ---------- All client providers ----------

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Do not retry 4xx answers (not found, forbidden...): retrying will not change them.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}