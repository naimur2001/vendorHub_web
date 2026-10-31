import { cn } from "@/lib/utils";

const RATIOS = {
  portrait: "aspect-[4/5]",
  tall: "aspect-[3/4]",
  square: "aspect-square",
} as const;

type Props = {
  children?: React.ReactNode;
  ratio?: keyof typeof RATIOS;
  className?: string;
};

/**
 * The signature shape: a shop window under an arch.
 * Put a photo (next/image with `fill`) or a placeholder inside; it is clipped to the arch.
 * Used for product photos, shop photos and hero images.
 */
export function ArchFrame({ children, ratio = "portrait", className }: Props) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-t-full rounded-b-sm bg-subtle", RATIOS[ratio], className)}>
      {children}
    </div>
  );
}