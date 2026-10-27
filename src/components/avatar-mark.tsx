import { cn, initials } from "@/lib/utils";
import type { ClassAccent } from "@/lib/types";

const ACCENT: Record<ClassAccent, string> = {
  teal: "bg-accent-teal text-primary-foreground",
  olive: "bg-accent-olive text-primary-foreground",
  ink: "bg-accent-ink text-primary-foreground",
};

export function AvatarMark({
  first,
  last,
  accent = "teal",
  className,
}: {
  first: string;
  last: string;
  accent?: ClassAccent;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold tracking-wide",
        ACCENT[accent],
        className,
      )}
      aria-hidden
    >
      {initials(first, last)}
    </span>
  );
}
