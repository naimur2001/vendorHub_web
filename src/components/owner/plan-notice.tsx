"use client";

import { ArrowRight, Lock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { planProblem } from "@/lib/api/subscriptions";

// Once subscriptions are switched on, any owner action can answer 402 PLAN_REQUIRED or 409 PLAN_LIMIT.
// The query client reports those here (app-providers), and one notice explains them on every owner page.
type Problem = NonNullable<ReturnType<typeof planProblem>>;
let current: Problem | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called for every failed query or mutation; ignores everything that is not a plan problem. */
export function reportPlanProblem(err: unknown): void {
  if (!(err instanceof ApiError) || (err.status !== 402 && err.status !== 409)) return;
  const p = planProblem(err.details);
  if (!p) return;
  current = p;
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
const read = () => current;
const readServer = () => null;

const LIMIT_NAMES = ["maxProducts", "maxStaff", "maxActiveDeals"];

export function PlanNotice() {
  const t = useTranslations("PlanNotice");
  const tM = useTranslations("OwnerPlan.module");
  const tL = useTranslations("OwnerPlan.limit");
  const problem = useSyncExternalStore(subscribe, read, readServer);
  if (!problem) return null;

  const moduleKnown = problem.kind === "required" && /^[A-Z_]{2,40}$/.test(problem.module);
  const limitKnown = problem.kind === "limit" && LIMIT_NAMES.includes(problem.name);
  const text =
    problem.kind === "required"
      ? moduleKnown
        ? t("required", { feature: tM(problem.module as "ANALYTICS") })
        : t("requiredAny")
      : t("limit", { limit: problem.limit, used: problem.used, what: limitKnown ? tL(problem.name as "maxProducts").toLowerCase() : t("items") });

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-highlight bg-highlight-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="type-body flex items-start gap-2 text-ink">
        <Lock className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
        {text}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Link href="/owner/plan" onClick={() => { current = null; emit(); }} className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
          {t("seePlans")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <button type="button" onClick={() => { current = null; emit(); }} aria-label={t("dismiss")} className="flex size-11 items-center justify-center rounded-full text-ink-secondary hover:bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
