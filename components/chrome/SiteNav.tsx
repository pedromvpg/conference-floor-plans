"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="hidden items-center gap-1 rounded-full border border-border bg-muted/70 px-2 py-1.5 text-[14px] font-medium text-muted-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:flex"
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-full bg-background px-3 py-1 text-foreground shadow-sm"
                : "rounded-full px-3 py-1 hover:bg-background/70 hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
