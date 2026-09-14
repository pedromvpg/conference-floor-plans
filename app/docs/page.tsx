import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Docs — Conference Floor Plans",
  description: "Studio workflow, viewer query params, embed contract, and hall coordinates.",
};

export const dynamic = "force-dynamic";

const toc = [
  ["#studio", "Studio"],
  ["#tools", "Tools"],
  ["#viewer", "Viewer"],
  ["#embed", "Embed"],
  ["#json", "map.json"],
  ["#hall", "Hall space"],
  ["#run", "Run it"],
] as const;

const studioNav = [
  ["Event", "/e/:slug/studio", "Draft vs live snapshot, floor readiness, caches, public URLs."],
  ["Sponsors", "/e/:slug/sponsors", "Pull Airtable logos; bind a record to a booth."],
  ["Agenda", "/e/:slug/agenda", "Cache sessions and speakers for the booth sheet."],
  ["Library", "/e/:slug/library", "Textures and GLB models for hall furniture."],
  ["Settings", "/e/:slug/settings", "Name, slug, units, Airtable event code."],
  ["Designer", "/e/:slug/edit", "Floors, underlay, scale, drawing, Plan / Hall."],
];

const workflow = [
  {
    n: "01",
    title: "Event",
    body: "Create an event with a public slug. That slug is the viewer path (/e/bhk26) and the JSON path (/e/bhk26/map.json). The event owns floors, objects, caches, library files, and the published snapshot. Drafts never leak to attendees until you publish.",
  },
  {
    n: "02",
    title: "Floors",
    body: "Add named plans (Hall A, Mezzanine). Import a PDF, PNG, or SVG underlay. Use two-click Scale with a known length so drawing units are metres or feet. Optional MapLibre OSM basemap sits behind a calibrated floor.",
  },
  {
    n: "03",
    title: "Venue",
    body: "Trace the hall: rectangles, ellipses, polygons, labels, images. Pathfinder unions and subtracts shapes. Reference layers stay in the editor and are omitted from the published map.",
  },
  {
    n: "04",
    title: "Plots",
    body: "Booths and stages get numbers, sponsor binds, size presets (3×3 m, 6×6 m, 10×10 m, 10×10 ft, 20×20 ft), and rotation. Amenities, hotels, and side events drop as pins. Inspector paint sets fill, stroke, and opacity.",
  },
  {
    n: "05",
    title: "Hall furniture",
    body: "Switch to Hall. Stage booths in 3D: facing, rugs, walls, logos, optional GLB from the library. Facing 0° puts the back wall toward −Z (top of the 2D plan). Author custom models with +Z as the open front.",
  },
  {
    n: "06",
    title: "Publish",
    body: "Writes an immutable snapshot. Attendees hit the viewer URL. Native apps hit GET /e/:slug/map.json. Re-publish to replace the snapshot; older embeds keep working until you change the URL.",
  },
];

const tools: { keys: string[]; name: string; note: string }[] = [
  { keys: ["V"], name: "Select", note: "Move, inspect, bind sponsor, paint." },
  { keys: ["R"], name: "Rectangle", note: "In Hall with a booth selected: rotate +45°." },
  { keys: ["E"], name: "Ellipse", note: "Round plots and stages." },
  { keys: ["P"], name: "Polygon", note: "Trace irregular halls and islands." },
  { keys: ["I"], name: "Amenity", note: "Bathroom, food, exit, and other pins." },
  { keys: ["Esc"], name: "Cancel", note: "Drop the current tool without committing." },
];

const queryParams: { param: string; values: string; meaning: string }[] = [
  { param: "view", values: "2d · 3d · plan · hall", meaning: "Plan is 2D; hall is 3D. Aliases: 2d=plan, 3d=hall." },
  { param: "floor", values: "id or name", meaning: "Match floor id, display name, or slugified name." },
  { param: "booth", values: "number", meaning: "Highlight that plot and open its sheet." },
  { param: "airtable", values: "record id", meaning: "Same highlight via the bound sponsor record." },
  { param: "sizes", values: "1 / 0", meaning: "Show booth dimensions on the plan." },
  { param: "grid", values: "1 / 0", meaning: "Drawing grid. Default on." },
  { param: "rulers", values: "1 / 0", meaning: "Edge rulers. Default off." },
  { param: "underlay", values: "1 / 0", meaning: "PDF/PNG/SVG plate. Default on." },
  { param: "panel", values: "1", meaning: "Open the hall settings panel." },
];

const hallParams: { param: string; meaning: string }[] = [
  { param: "ortho", meaning: "Orthographic camera" },
  { param: "cuboids", meaning: "Simple booth boxes instead of models" },
  { param: "fog", meaning: "Distance fog" },
  { param: "ao", meaning: "Ambient occlusion" },
  { param: "shadows", meaning: "Sun shadows" },
  { param: "env", meaning: "Environment lighting" },
  { param: "pt", meaning: "GPU path tracer (heavy)" },
  { param: "az / el / dist", meaning: "Orbit azimuth, elevation, distance" },
  { param: "sun / sunEl / sunDist", meaning: "Key light direction" },
  { param: "light / fill / fogI", meaning: "Key intensity, fill, fog amount" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-medium text-white/85">
      {children}
    </kbd>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[12.5px] text-white/80">
      {children}
    </code>
  );
}

export default async function DocsPage() {
  const user = await getSessionUser();
  const studio = user ? "/events" : "/login";

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-[#fcfcfc]">
      <SiteHeader
        action={
          <Button asChild variant="inverse" size="lg">
            <Link href={studio}>{user ? "Open studio" : "Sign in"}</Link>
          </Button>
        }
      />

      <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-12 pb-24 sm:px-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:pt-16">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1" aria-label="On this page">
            <p className="mb-3 text-[11px] font-medium tracking-[0.18em] text-white/35 uppercase">On this page</p>
            {toc.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="block rounded-md px-2 py-1.5 text-[13px] text-white/45 transition-colors hover:bg-white/5 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <p className="text-[13px] font-medium tracking-[0.16em] text-primary uppercase">Reference</p>
          <h1 className="mt-3 text-[36px] leading-[1.08] font-semibold tracking-[-0.04em] sm:text-[48px]">
            How to draw, publish, and embed a map.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/55">
            Editor routes, keyboard tools, viewer query strings, iframe embed, GeoJSON, and hall axes. This
            studio does not share a database with the attendee app — publish a snapshot, then embed or fetch
            map.json.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="inverse" size="sm">
              <Link href="/e/bhk26">Live viewer</Link>
            </Button>
            <Button asChild variant="glass" size="sm">
              <Link href="/e/bhk26?view=3d">Hall 3D</Link>
            </Button>
            <Button asChild variant="glass" size="sm">
              <Link href="/e/bhk26/map.json">map.json</Link>
            </Button>
          </div>

          <section id="studio" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Studio
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/50">
              Chrome is Event · Sponsors · Agenda · Library · Settings · Designer. Opening an event lands on the
              hub: what is unpublished, unscaled, or unsynced. Work stays on the draft until Publish. The public
              viewer stays at /e/:slug.
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[36rem] text-left text-[14px]">
                <thead className="bg-white/[0.04] text-[12px] tracking-wide text-white/40 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Section</th>
                    <th className="px-4 py-3 font-medium">Path</th>
                    <th className="px-4 py-3 font-medium">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {studioNav.map(([name, path, note]) => (
                    <tr key={name} className="align-top">
                      <td className="px-4 py-3 font-medium text-white/90">{name}</td>
                      <td className="px-4 py-3">
                        <Code>{path}</Code>
                      </td>
                      <td className="px-4 py-3 text-white/50">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ol className="mt-10 space-y-0">
              {workflow.map((step, i) => (
                <li
                  key={step.n}
                  className={`relative grid gap-4 border-l-2 border-white/10 pl-6 sm:grid-cols-[5.5rem_minmax(0,1fr)] ${
                    i === workflow.length - 1 ? "pb-0" : "pb-8"
                  }`}
                >
                  <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-primary" aria-hidden />
                  <span className="font-mono text-[12px] tracking-wide text-primary">{step.n}</span>
                  <div>
                    <h3 className="text-[17px] font-medium tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/50">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="tools" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Tools
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/50">
              Plan-only: two-click Scale plus a known length. Size presets live on the inspector for booths.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {tools.map((t) => (
                <li
                  key={t.name}
                  className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
                >
                  <span className="flex gap-1">
                    {t.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-white/45">{t.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section id="viewer" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Viewer
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/50">
              Public URL is <Code>/e/:slug</Code>. Search matches name, booth number, sponsor, and amenity. Query
              params override saved prefs (they are written back into the URL as you change the camera).
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[40rem] text-left text-[14px]">
                <thead className="bg-white/[0.04] text-[12px] tracking-wide text-white/40 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Param</th>
                    <th className="px-4 py-3 font-medium">Values</th>
                    <th className="px-4 py-3 font-medium">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {queryParams.map((row) => (
                    <tr key={row.param} className="align-top">
                      <td className="px-4 py-3">
                        <Code>{row.param}</Code>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12.5px] text-white/55">{row.values}</td>
                      <td className="px-4 py-3 text-white/50">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-8 text-[15px] font-medium">Hall flags</h3>
            <p className="mt-2 text-[14px] text-white/45">
              Booleans accept <Code>1</Code> / <Code>0</Code>, <Code>true</Code> / <Code>false</Code>. Numbers are
              floats.
            </p>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {hallParams.map((row) => (
                <div key={row.param} className="flex gap-3 border-b border-white/8 pb-3">
                  <dt className="w-28 shrink-0">
                    <Code>{row.param}</Code>
                  </dt>
                  <dd className="text-[14px] text-white/50">{row.meaning}</dd>
                </div>
              ))}
            </dl>
            <pre className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-[#111] p-4 font-mono text-[12.5px] leading-relaxed text-white/70">
              {`/e/bhk26?view=3d&floor=hall-a&booth=412&sizes=1
/e/bhk26?airtable=recXXXXXXXX&view=2d
/e/bhk26?view=3d&ortho=1&fog=1&az=40&el=35`}
            </pre>
          </section>

          <section id="embed" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Embed
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/50">
              CSP allows <Code>frame-ancestors *</Code>, so iframe and WebView work. In btc-app admin, paste the
              viewer URL into <Code>events.venue_map_url</Code>. Deep-link a booth from native by appending{" "}
              <Code>?booth=</Code> or <Code>?airtable=</Code>.
            </p>
            <pre className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-[#111] p-4 font-mono text-[12.5px] leading-relaxed text-white/70">
              {`<iframe
  src="https://maps.example/e/bhk26?view=2d"
  title="Venue map"
  style="width:100%;height:100%;border:0"
  allow="fullscreen"
/>`}
            </pre>
          </section>

          <section id="json" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Native contract
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/50">
              <Code>GET /e/:slug/map.json</Code> is a versioned GeoJSON document.{" "}
              <Code>MapDocument.version</Code> is <Code>1</Code>. Coordinates are floor-local metres, origin at the
              top-left of the underlay, y down. A later Expo viewer can render it without joining this database.
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/50">
              Publish copies optional <Code>appearance</Code>, <Code>facingDeg</Code>, <Code>modelUrl</Code>,{" "}
              <Code>rugTextureUrl</Code>, and <Code>wallTextureUrl</Code> onto each feature.
            </p>
          </section>

          <section id="hall" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Hall space
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Plan", "x right, y down", "Same axes as the underlay pixels after scale."],
                ["three.js", "x = worldX, z = worldY", "y is up. Do not invert x."],
                ["Facing 0°", "back wall → −Z", "Open front of a custom GLB is +Z."],
              ].map(([title, kicker, note]) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[12px] tracking-[0.14em] text-primary uppercase">{title}</p>
                  <p className="mt-2 font-mono text-[13px] text-white/85">{kicker}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/45">{note}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="run" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-white/10 pb-3 text-[13px] font-medium tracking-[0.16em] text-white/70 uppercase">
              Run it
            </h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 p-5">
                <h3 className="text-[16px] font-medium">Local demo</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/50">
                  No Supabase. Draft lives in <Code>.data/</Code>. Bitcoin Asia 2026 is seeded at{" "}
                  <Code>/e/bhk26</Code>.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-lg bg-[#111] p-3 font-mono text-[12.5px] text-white/70">
                  {`npm install
npm run dev`}
                </pre>
              </div>
              <div className="rounded-xl border border-white/10 p-5">
                <h3 className="text-[16px] font-medium">Production</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/50">
                  Vercel + your Supabase project. Run <Code>supabase/schema.sql</Code>, public Storage bucket{" "}
                  <Code>maps</Code>, magic-link redirect <Code>/auth/callback</Code>, allowlist via{" "}
                  <Code>allowed_editors</Code> or <Code>ALLOWED_EMAILS</Code>. Airtable tokens stay in env, not on
                  the event row.
                </p>
              </div>
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-white/35">
              Stack: Next.js 16 (App Router, proxy.ts), React 19, Vercel Fluid Compute, Supabase Postgres + Storage,
              Airtable caches, three.js + R3F, optional MapLibre, shadcn/ui + Tailwind 4, pdfjs + sharp.
            </p>
          </section>

          <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-white/10 pt-8">
            <Button asChild variant="inverse" size="lg">
              <Link href={studio}>Open studio</Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link href="/e/bhk26">Preview BHK26</Link>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
