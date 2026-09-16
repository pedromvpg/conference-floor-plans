"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="hidden items-center gap-1 rounded-full border border-border bg-muted/70 px-2 py-1.5 text-[14px] font-medium text-muted-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-xl lg:flex"
      aria-label="Primary"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            isActive(pathname, item.href)
              ? "rounded-full bg-background px-3 py-1 text-foreground shadow-sm"
              : "rounded-full px-3 py-1 hover:bg-background/70 hover:text-foreground"
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative lg:hidden">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu strokeWidth={1.5} />
      </Button>
      {open ? (
        <nav
          className="absolute top-full right-0 z-50 mt-2 min-w-40 rounded-lg border border-border bg-popover p-1.5 text-[13px] font-medium text-popover-foreground shadow-md"
          aria-label="Primary"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(pathname, item.href)
                  ? "block rounded-md bg-muted px-2.5 py-2 text-foreground"
                  : "block rounded-md px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
