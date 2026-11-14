/**
 * Grey placeholders shaped like the coming content, so owner pages keep their size while loading.
 * Screen readers hear the label instead of the shapes.
 */
export function OwnerSkeleton({ label, variant = "list" }: { label: string; variant?: "list" | "dashboard" }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {variant === "dashboard" ? (
        <>
          <div className="h-9 w-1/2 skeleton rounded-sm" aria-hidden />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-28 skeleton rounded-md" />
            ))}
          </div>
          <div className="h-44 skeleton rounded-md" aria-hidden />
          <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
            <div className="h-56 skeleton rounded-md" />
            <div className="h-56 skeleton rounded-md" />
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-10 w-24 skeleton rounded-full" />
            ))}
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 skeleton rounded-md" aria-hidden />
          ))}
        </>
      )}
    </div>
  );
}