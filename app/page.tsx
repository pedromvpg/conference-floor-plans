import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { SectionLabel } from "@/components/chrome/SectionLabel";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const legend = [
  ["Designer", "Trace halls on PDF, PNG, or SVG. Rectangles, polygons, amenities, two-click scale."],
  ["Hall", "Stage booths in 3D with facing, rugs, walls, and custom GLB models."],
  ["Sponsors", "Cache Airtable logos and bind them to booths on the public map."],
  ["Agenda", "Sync sessions and speakers so the viewer can show what is on next."],
  ["Library", "Upload textures and models once; reuse them across booths and stages."],
  ["Viewer", "Pan, zoom, search, booth sheets. Embed in an iframe or WebView."],
  ["Publish", "Immutable snapshot plus GET /e/:slug/map.json for native apps."],
];

export default async function Home() {
  const user = await getSessionUser();
  const studio = user ? "/events" : "/login";

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
            The floor plan for the world&apos;s largest Bitcoin conferences.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Built for BTC Inc events. This studio does not share a database with the attendee app.
          </p>
          <p className="mx-auto mt-8 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
            Draw in 2D or 3D. Sync sponsors and sessions. Publish a map the attendee app can embed.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild variant="inverse" size="lg">
              <Link href={studio}>{user ? "Continue to events" : "Open the designer"}</Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link href="/e/bhk26">Preview a live map</Link>
            </Button>
          </div>
        </section>

        <section className="px-4 pb-8 sm:px-8">
          <SectionLabel trailing="2">Editor and viewer</SectionLabel>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <PromoBanner
              kind="plan"
              title="Plan"
              kicker="Editor"
              href={user ? "/e/bhk26/studio" : studio}
              cta={user ? "Open event" : "Open studio"}
              className="min-h-[280px] sm:min-h-[380px]"
            />
            <PromoBanner
              kind="walk"
              title="Walk"
              kicker="Viewer"
              href="/e/bhk26"
              cta="Open map"
              className="min-h-[280px] sm:min-h-[380px]"
            />
          </div>
        </section>

        <section className="px-4 py-10 sm:px-8">
          <SectionLabel trailing={`${legend.length} tools`}>Studio</SectionLabel>
          <ul className="mt-8 divide-y divide-border">
            {legend.map(([name, body]) => (
              <li key={name} className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline sm:gap-10">
                <span className="text-[14px] font-medium text-primary">{name}</span>
                <span className="text-[15px] leading-relaxed text-muted-foreground">{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="px-4 pt-8 pb-20 text-center sm:px-8">
          <h2 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[60px] sm:leading-[60px]">
            Let&apos;s draw.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] text-muted-foreground">
            Want a hall traced, a sponsor bound, or a map published? Open the studio and pick an event.
          </p>
          <Button asChild variant="inverse" size="lg" className="mt-8">
            <Link href={studio}>Get started</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
