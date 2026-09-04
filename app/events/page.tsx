import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const events = await getStore().listEvents();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="chrome-kicker">Studio</p>
          <h1 className="mt-2 text-xl font-semibold">Events</h1>
          <p className="font-mono text-[11px] text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild>
            <Link href="/events/new">New event</Link>
          </Button>
        </div>
      </div>
      <div className="border border-border">
        {events.map((e) => (
          <Link key={e.id} href={`/e/${e.slug}/edit`} className="chrome-row border-b border-border last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-[13px]">{e.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">/e/{e.slug}</span>
          </Link>
        ))}
        {!events.length ? (
          <p className="px-4 py-8 text-[12px] text-muted-foreground">No events yet. Create one to import a floor plan.</p>
        ) : null}
      </div>
    </main>
  );
}
