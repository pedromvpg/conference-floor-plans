import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function EditorNav({
  slug,
  current,
  title,
  kicker,
}: {
  slug: string;
  current: "designer" | "assets" | "settings";
  title: string;
  kicker?: string;
}) {
  const items = [
    { id: "designer" as const, href: `/e/${slug}/edit`, label: "Designer" },
    { id: "assets" as const, href: `/e/${slug}/assets`, label: "Assets" },
    { id: "settings" as const, href: `/e/${slug}/settings`, label: "Settings" },
  ];
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="chrome-kicker">{kicker ?? `/e/${slug}`}</p>
          <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`px-2.5 py-1.5 text-[11px] font-medium ${
                current === item.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
