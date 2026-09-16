import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { eventCover } from "@/lib/event-cover";
import { SectionLabel } from "@/components/chrome/SectionLabel";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  const studio = user ? "/events" : "/login";
  const store = getStore();
  const events = await store.listEvents();
  const publicMaps = [];
  for (const event of events) {
    if (!event.isPublic) continue;
    const pub = await store.getPublicationBySlug(event.slug);
    if (pub) publicMaps.push(event);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        action={
          <Button asChild variant="inverse" size="lg">
            <Link href={studio}>{user ? "Open studio" : "Sign in"}</Link>
          </Button>
        }
      />

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-14 pb-16 text-center sm:pt-20">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[60px] sm:leading-[60px]">
            Public conference maps.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Only maps an admin marks public appear here. Studio, docs, and private halls need a signed-in
            account.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild variant="inverse" size="lg">
              <Link href={studio}>{user ? "Continue to events" : "Sign in to edit"}</Link>
            </Button>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-8">
          <SectionLabel trailing={`${publicMaps.length}`}>Gallery</SectionLabel>
          {publicMaps.length ? (
            <ul className="mt-6 grid gap-5 lg:grid-cols-1">
              {publicMaps.map((e) => (
                <li key={e.id}>
                  <PromoBanner
                    cover={eventCover(e.slug)}
                    shout={false}
                    title={e.name}
                    kicker={`/e/${e.slug}`}
                    href={`/e/${e.slug}`}
                    cta="Open map"
                    className="min-h-[260px] sm:min-h-[340px]"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-[15px] text-muted-foreground">
              No public maps yet. Editors publish in studio; admins toggle public in Admin.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
