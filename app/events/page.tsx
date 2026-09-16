import Link from "next/link";
import { redirect } from "next/navigation";
import { eventsForUser, getSessionUser, canEditEvent } from "@/lib/auth";
import { eventCover } from "@/lib/event-cover";
import { eventStudioHref } from "@/lib/studio-nav";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { SectionLabel } from "@/components/chrome/SectionLabel";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const events = await eventsForUser(user.email);
  const canEdit = new Set(
    (await Promise.all(events.map(async (e) => ((await canEditEvent(user.email, e.id)) ? e.id : "")))).filter(Boolean),
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        action={
          user.role === "admin" ? (
            <Button asChild variant="inverse" size="lg">
              <Link href="/events/new">New event</Link>
            </Button>
          ) : undefined
        }
      />
      <main className="px-4 pb-20 sm:px-8">
        <section className="mx-auto max-w-4xl px-2 pt-10 pb-14 text-center">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[60px] sm:leading-[60px]">
            Events.
          </h1>
          <p className="mt-3 text-[16px] text-muted-foreground">{user.email}</p>
        </section>

        {events.length ? (
          <>
            <SectionLabel trailing={`${events.length} event${events.length === 1 ? "" : "s"}`}>
              Your maps
            </SectionLabel>
            <ul className="mt-6 grid gap-5 lg:grid-cols-1">
              {events.map((e) => (
                <li key={e.id}>
                  <PromoBanner
                    cover={eventCover(e.slug)}
                    shout={false}
                    title={e.name}
                    kicker={`/e/${e.slug}`}
                    href={canEdit.has(e.id) ? eventStudioHref(e.slug) : `/e/${e.slug}`}
                    cta={canEdit.has(e.id) ? "Open event" : "Viewer"}
                    secondaryHref={canEdit.has(e.id) ? `/e/${e.slug}` : undefined}
                    secondaryCta={canEdit.has(e.id) ? "Viewer" : undefined}
                    className="min-h-[260px] sm:min-h-[340px]"
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-10 rounded-[28px] border border-border px-6 py-20 text-center">
            <p className="text-[16px] text-muted-foreground">No events assigned to you yet.</p>
            {user.role === "admin" ? (
              <Button asChild variant="inverse" className="mt-6" size="lg">
                <Link href="/events/new">Create an event</Link>
              </Button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
