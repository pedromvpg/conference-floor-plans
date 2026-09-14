import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { eventStudioHref } from "@/lib/studio-nav";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { SectionLabel } from "@/components/chrome/SectionLabel";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function eventCover(slug: string) {
  if (slug.includes("amsterdam")) return "/marketing/amsterdam-cover.png";
  if (slug === "bitcoin-2027") return "/marketing/bitcoin-2027-cover.png";
  if (slug === "bhk26") return "/marketing/bhk26-cover.png";
  return undefined;
}

export default async function EventsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const events = await getStore().listEvents();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        action={
          <Button asChild variant="inverse" size="lg">
            <Link href="/events/new">New event</Link>
          </Button>
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
              Studio
            </SectionLabel>
            <ul className="mt-6 grid gap-5 lg:grid-cols-1">
              {events.map((e) => (
                <li key={e.id}>
                  <PromoBanner
                    cover={eventCover(e.slug)}
                    shout={false}
                    title={e.name}
                    kicker={`/e/${e.slug}`}
                    href={eventStudioHref(e.slug)}
                    cta="Open event"
                    secondaryHref={`/e/${e.slug}`}
                    secondaryCta="Viewer"
                    className="min-h-[260px] sm:min-h-[340px]"
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-10 rounded-[28px] border border-border px-6 py-20 text-center">
            <p className="text-[16px] text-muted-foreground">No events yet.</p>
            <Button asChild variant="inverse" className="mt-6" size="lg">
              <Link href="/events/new">Create an event</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
