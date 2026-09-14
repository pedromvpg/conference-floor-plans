import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/chrome/BrandMark";
import { SiteNav } from "@/components/chrome/SiteNav";
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_NAV = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader({
  action,
  nav = DEFAULT_NAV,
}: {
  action?: ReactNode;
  nav?: { href: string; label: string }[];
}) {
  return (
    <header className="sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-background/55 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <Link href="/" className="justify-self-start">
        <BrandLockup size="sm" />
      </Link>
      <SiteNav items={nav} />
      <div className="flex items-center justify-end gap-2">
        <ThemeToggle />
        {action}
      </div>
    </header>
  );
}
