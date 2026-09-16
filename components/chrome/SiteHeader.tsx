import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/chrome/BrandMark";
import { SiteMenu, SiteNav } from "@/components/chrome/SiteNav";
import { SignOutButton } from "@/components/chrome/SignOutButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function SiteHeader({
  action,
  nav,
}: {
  action?: ReactNode;
  nav?: { href: string; label: string }[];
}) {
  const user = await getSessionUser();
  const items =
    nav ??
    (user
      ? [
          { href: "/", label: "Home" },
          { href: "/events", label: "Events" },
          { href: "/docs", label: "Docs" },
          { href: "/account", label: "Account" },
          ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
        ]
      : [
          { href: "/", label: "Home" },
          { href: "/login", label: "Sign in" },
        ]);
  return (
    <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/55 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-8">
      <Link href="/" className="min-w-0 justify-self-start">
        <BrandLockup size="sm" className="max-w-full [&_img]:max-h-8 [&_img]:max-w-[min(100%,11.5rem)] sm:[&_img]:max-h-9 sm:[&_img]:max-w-none" />
      </Link>
      <SiteNav items={items} />
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:col-start-3">
        <SiteMenu items={items} />
        <ThemeToggle />
        {action ? (
          <div className="[&_[data-slot=button]]:max-sm:h-8 [&_[data-slot=button]]:max-sm:px-3 [&_[data-slot=button]]:max-sm:text-[12px]">
            {action}
          </div>
        ) : user ? (
          <SignOutButton />
        ) : (
          <Button asChild variant="inverse" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
