import type { ReactNode } from "react";
import { cn } from "cn";

export function StudioKicker({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{children}</p>;
}

export function StudioPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[22px] border border-border bg-muted/40 p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function StudioPills({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn("inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-1", className)}
    >
      {children}
    </div>
  );
}

export function studioPillClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium",
    active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export const studioFieldClass =
  "h-10 rounded-full border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground md:text-[14px] focus-visible:border-ring";
