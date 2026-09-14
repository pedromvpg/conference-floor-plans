import Link from "next/link";
import { studioNavItems, type StudioSection } from "@/lib/studio-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export type EditorSection = StudioSection;

export function EditorNav({
  slug,
  current,
  title,
}: {
  slug: string;
  current: EditorSection;
  title: string;
}) {
  const items = studioNavItems(slug);
  return (
    <header className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            <Link href="/" className="hover:text-foreground">
              Floor plans
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <Link href="/events" className="hover:text-foreground">
              Events
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <Link href={`/e/${slug}/studio`} className="hover:text-foreground">
              {slug}
            </Link>
          </p>
          <h1 className="mt-3 text-[36px] leading-none font-semibold tracking-[-0.04em] sm:text-[44px]">{title}</h1>
        </div>
        <ThemeToggle />
      </div>
      <nav
        className="mt-6 inline-flex flex-wrap gap-1 rounded-full bg-muted p-1.5 text-[14px] font-medium text-muted-foreground"
        aria-label="Event sections"
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`rounded-full px-4 py-2 ${
              current === item.id ? "bg-foreground text-background" : "hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
