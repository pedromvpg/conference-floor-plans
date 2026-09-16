import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Docs — Conference Floor Plans",
  description: "Studio workflow, viewer, embed, Blob vs Supabase, and how to migrate when the existing project is authorized.",
};

export const dynamic = "force-dynamic";

const toc = [
  ["#studio", "Studio"],
  ["#tools", "Tools"],
  ["#viewer", "Viewer"],
  ["#embed", "Embed"],
  ["#json", "map.json"],
  ["#hall", "Hall space"],
  ["#run", "Local vs deploy"],
  ["#migrate", "Blob → Supabase"],
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
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground/80">
      {children}
    </code>
  );
}

export default async function DocsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const studio = "/events";

  return (
    <div className="min-h-dvh bg-background text-foreground">
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
            <p className="mb-3 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              On this page
            </p>
            {toc.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
            Editor routes, keyboard tools, viewer query strings, iframe embed, GeoJSON, hall axes, and how to
            run the app locally versus on Vercel. This studio does not share a database with the attendee app —
            publish a snapshot, then embed or fetch map.json.
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
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Studio
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Chrome is Event · Sponsors · Agenda · Library · Settings · Designer. Opening an event lands on the
              hub: what is unpublished, unscaled, or unsynced. Work stays on the draft until Publish. The public
              viewer stays at /e/:slug.
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[36rem] text-left text-[14px]">
                <thead className="bg-muted text-[12px] tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Section</th>
                    <th className="px-4 py-3 font-medium">Path</th>
                    <th className="px-4 py-3 font-medium">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {studioNav.map(([name, path, note]) => (
                    <tr key={name} className="align-top">
                      <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                      <td className="px-4 py-3">
                        <Code>{path}</Code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ol className="mt-10 space-y-0">
              {workflow.map((step, i) => (
                <li
                  key={step.n}
                  className={`relative grid gap-4 border-l-2 border-border pl-6 sm:grid-cols-[5.5rem_minmax(0,1fr)] ${
                    i === workflow.length - 1 ? "pb-0" : "pb-8"
                  }`}
                >
                  <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-primary" aria-hidden />
                  <span className="font-mono text-[12px] tracking-wide text-primary">{step.n}</span>
                  <div>
                    <h3 className="text-[17px] font-medium tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="tools" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Tools
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Plan-only: two-click Scale plus a known length. Size presets live on the inspector for booths.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {tools.map((t) => (
                <li
                  key={t.name}
                  className="flex items-start gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3.5"
                >
                  <span className="flex gap-1">
                    {t.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{t.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section id="viewer" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Viewer
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Public URL is <Code>/e/:slug</Code>. Search matches name, booth number, sponsor, and amenity. Query
              params override saved prefs (they are written back into the URL as you change the camera).
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[40rem] text-left text-[14px]">
                <thead className="bg-muted text-[12px] tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Param</th>
                    <th className="px-4 py-3 font-medium">Values</th>
                    <th className="px-4 py-3 font-medium">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queryParams.map((row) => (
                    <tr key={row.param} className="align-top">
                      <td className="px-4 py-3">
                        <Code>{row.param}</Code>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12.5px] text-muted-foreground">{row.values}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-8 text-[15px] font-medium">Hall flags</h3>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Booleans accept <Code>1</Code> / <Code>0</Code>, <Code>true</Code> / <Code>false</Code>. Numbers are
              floats.
            </p>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {hallParams.map((row) => (
                <div key={row.param} className="flex gap-3 border-b border-border pb-3">
                  <dt className="w-28 shrink-0">
                    <Code>{row.param}</Code>
                  </dt>
                  <dd className="text-[14px] text-muted-foreground">{row.meaning}</dd>
                </div>
              ))}
            </dl>
            <pre className="mt-6 overflow-x-auto rounded-xl border border-border bg-muted p-4 font-mono text-[12.5px] leading-relaxed text-foreground/80">
              {`/e/bhk26?view=3d&floor=hall-a&booth=412&sizes=1
/e/bhk26?airtable=recXXXXXXXX&view=2d
/e/bhk26?view=3d&ortho=1&fog=1&az=40&el=35`}
            </pre>
          </section>

          <section id="embed" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Embed
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              CSP allows <Code>frame-ancestors *</Code>, so iframe and WebView work. In btc-app admin, paste the
              viewer URL into <Code>events.venue_map_url</Code>. Deep-link a booth from native by appending{" "}
              <Code>?booth=</Code> or <Code>?airtable=</Code>.
            </p>
            <pre className="mt-6 overflow-x-auto rounded-xl border border-border bg-muted p-4 font-mono text-[12.5px] leading-relaxed text-foreground/80">
              {`<iframe
  src="https://maps.example/e/bhk26?view=2d"
  title="Venue map"
  style="width:100%;height:100%;border:0"
  allow="fullscreen"
/>`}
            </pre>
          </section>

          <section id="json" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Native contract
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              <Code>GET /e/:slug/map.json</Code> is a versioned GeoJSON document.{" "}
              <Code>MapDocument.version</Code> is <Code>1</Code>. Coordinates are floor-local metres, origin at the
              top-left of the underlay, y down. A later Expo viewer can render it without joining this database.
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Publish copies optional <Code>appearance</Code>, <Code>facingDeg</Code>, <Code>modelUrl</Code>,{" "}
              <Code>rugTextureUrl</Code>, and <Code>wallTextureUrl</Code> onto each feature.
            </p>
          </section>

          <section id="hall" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Hall space
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Plan", "x right, y down", "Same axes as the underlay pixels after scale."],
                ["three.js", "x = worldX, z = worldY", "y is up. Do not invert x."],
                ["Facing 0°", "back wall → −Z", "Open front of a custom GLB is +Z."],
              ].map(([title, kicker, note]) => (
                <div key={title} className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-[12px] tracking-[0.14em] text-primary uppercase">{title}</p>
                  <p className="mt-2 font-mono text-[13px] text-foreground">{kicker}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="run" className="mt-16 scroll-mt-28">
            <h2 className="border-b border-border pb-3 text-[13px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
              Local vs deploy
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Target backend is <strong>Supabase</strong> (Postgres + Auth + Storage), most likely an{" "}
              <strong>existing org project</strong> once someone can authorize it — we are not creating a new paid
              database until then. Until that lands, laptop and Vercel share one <strong>Vercel Blob</strong> store
              so testers save on the hosted URL and stay in sync with <Code>next dev</Code>.
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Access: the public internet only sees maps an admin marks <strong>public</strong> (home gallery +{" "}
              <Code>/e/:slug</Code> + <Code>map.json</Code>, after publish). Everything else needs a signed-in
              account. Admins invite teammates with a <strong>copy-link</strong> URL (no email product). Bootstrap
              admins are <Code>ADMIN_EMAILS</Code> or <Code>ALLOWED_EMAILS</Code>. Per-event editor grants and
              roles are managed at <Code>/admin</Code>. Your maps are listed on <Code>/account</Code>. Passwords
              are hashed with Node <Code>scrypt</Code> (64-byte key, random 16-byte salt, stored as{" "}
              <Code>salt:hex</Code>) and checked with a timing-safe compare — the plaintext never goes in Blob.
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[36rem] text-left text-[14px]">
                <thead className="bg-muted text-[12px] tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium"> </th>
                    <th className="px-4 py-3 font-medium">Now (Blob)</th>
                    <th className="px-4 py-3 font-medium">Later (Supabase)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  <tr className="align-top">
                    <td className="px-4 py-3 font-medium text-foreground">Who can edit</td>
                    <td className="px-4 py-3">
                      Work email + <Code>scrypt</Code> password hash (salted, not reversible). Session is still an
                      httpOnly email cookie. First login for a bootstrap admin (<Code>ADMIN_EMAILS</Code>) sets
                      the password; everyone else needs an invite. Gate the deployment with Vercel Authentication
                      as well.
                    </td>
                    <td className="px-4 py-3">
                      Magic link / password against GoTrue. Email must be in <Code>allowed_editors</Code> or{" "}
                      <Code>ALLOWED_EMAILS</Code>.
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td className="px-4 py-3 font-medium text-foreground">Where drafts live</td>
                    <td className="px-4 py-3">
                      One Blob object (<Code>maps/db.json</Code>) plus files under <Code>maps/files/</Code>. Local
                      and Vercel use the same token from <Code>vercel env pull</Code>. Disk <Code>.data/</Code>{" "}
                      only if Blob env is missing (laptop sandbox).
                    </td>
                    <td className="px-4 py-3">Shared Postgres. Uploads in the public <Code>maps</Code> bucket.</td>
                  </tr>
                  <tr className="align-top">
                    <td className="px-4 py-3 font-medium text-foreground">Overlap</td>
                    <td className="px-4 py-3">
                      Designer shows a banner if another email is in the same event. Last save still wins — not a
                      merge.
                    </td>
                    <td className="px-4 py-3">Same last-write-wins until exclusive locks ship.</td>
                  </tr>
                  <tr className="align-top">
                    <td className="px-4 py-3 font-medium text-foreground">Public viewer</td>
                    <td className="px-4 py-3">
                      <Code>/e/:slug</Code> and <Code>map.json</Code> without login. Prefer Deployment Protection
                      so unpublished drafts are not world-writable.
                    </td>
                    <td className="px-4 py-3">Same public viewer paths; editors use Auth.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="mt-10 text-[16px] font-medium">Blob auth (now)</h3>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              There is no Supabase user table yet. Sign-in stores your work email in an httpOnly cookie and treats
              you as an editor. That email is what the concurrent-edit banner shows. It is <strong>not</strong> a
              password or identity provider. Protect Preview/Production in the Vercel project (Deployment
              Protection → Vercel Authentication) so only the team can reach login. Viewer routes can stay public
              if you need embed tests; studio/API should sit behind that protection.
            </p>

            <h3 className="mt-10 text-[16px] font-medium">Share one Blob (laptop + Vercel)</h3>
            <ol className="mt-3 max-w-2xl list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-muted-foreground">
              <li>
                Vercel → Storage → create a Blob store on <Code>conference-maps</Code>. Include Production,
                Preview, <strong>and Development</strong> so <Code>BLOB_READ_WRITE_TOKEN</Code> exists for{" "}
                <Code>vercel env pull</Code>.
              </li>
              <li>
                <Code>vercel env pull .env.local --yes</Code> (keep Airtable <Code>CONF_*</Code> if pull overwrites).
                Leave Supabase keys empty.
              </li>
              <li>
                Redeploy. First Blob write: if the pulling machine still has <Code>.data/db.json</Code>, that file
                is uploaded once when the Blob is empty. Underlays already only on disk must be re-uploaded.
              </li>
              <li>
                Teammates clone, pull the same env, <Code>npm run dev</Code>, sign in with their email. Saves hit
                the same Blob as production.
              </li>
            </ol>

            <h3 className="mt-10 text-[16px] font-medium">Offline laptop only</h3>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              No Blob token → <Code>.data/db.json</Code> on that machine. Do not expect that folder to appear on
              Vercel.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-muted p-4 font-mono text-[12.5px] leading-relaxed text-foreground/80">
              {`npm install
npm run dev`}
            </pre>

            <h3 id="migrate" className="mt-10 scroll-mt-28 text-[16px] font-medium">
              Switching to Supabase later
            </h3>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              The running app is already dual-backend: <Code>getStore()</Code> uses Postgres the moment the three
              Supabase env vars are set, and Blob/disk drop out. That cutover is easy. <strong>Data does not move
              by itself.</strong> There is no migrate script yet; Blob is one JSON file plus files, Supabase is
              tables + a public <Code>maps</Code> bucket. Flip env without a load and the hosted app looks empty.
            </p>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Prefer an <strong>existing org project</strong> once someone can authorize it. Confirm it is empty
              (or a dedicated schema) so event slugs/UUIDs do not collide.
            </p>
            <ol className="mt-3 max-w-2xl list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-muted-foreground">
              <li>
                Apply <Code>supabase/schema.sql</Code> <strong>and</strong> every file in{" "}
                <Code>supabase/migrations/</Code> so columns match the app (<Code>view_center</Code>, kits, object
                media, …). Create or reuse a public Storage bucket named <Code>maps</Code>. Enable Email auth;
                redirect <Code>/auth/callback</Code> on the Vercel host and localhost.
              </li>
              <li>
                Freeze Designer saves (or accept the last Blob write). Download <Code>maps/db.json</Code> and list{" "}
                <Code>maps/files/</Code>.
              </li>
              <li>
                Load rows in FK order, keeping the same UUIDs: <Code>allowed_editors</Code> → <Code>events</Code> →{" "}
                <Code>floors</Code> → sponsors / sessions / speakers / library assets / kits → <Code>objects</Code>{" "}
                → draft versions → publications.
              </li>
              <li>
                Copy each Blob file into Storage at the same path. Rewrite <Code>/api/files/…</Code> to the public
                Storage URL on floor underlays, library assets, and JSON inside <Code>publications.snapshot</Code>{" "}
                and draft-version snapshots. Skip this and underlays break after cutover.
              </li>
              <li>
                Create Auth users for the editor emails (<Code>createUser</Code> + confirm). Blob stored scrypt
                hashes, not GoTrue passwords — do not copy hashes; have people set a new password.
              </li>
              <li>
                Set <Code>NEXT_PUBLIC_SUPABASE_URL</Code>, <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code>, and{" "}
                <Code>SUPABASE_SERVICE_ROLE_KEY</Code> on Production, Preview, and Development. Redeploy.{" "}
                <Code>vercel env pull</Code> locally. Smoke: designer save, publish, <Code>/e/:slug/map.json</Code>.
                Airtable <Code>CONF_*</Code> stays in env, not copied from old event rows.
              </li>
              <li>Keep Blob read-only for a week as backup, then delete.</li>
            </ol>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Concurrent-edit banner is Blob-only until exclusive locks exist on Postgres. When you have project
              URL + service role, add a one-shot ETL (for example <Code>scripts/migrate-blob-to-supabase</Code>) and
              dry-run before cutover.
            </p>
            <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
              Stack: Next.js 16 (App Router, proxy.ts), React 19, Vercel Fluid Compute, Vercel Blob (interim) then
              Supabase Postgres + Storage, Airtable caches, three.js + R3F, optional MapLibre, shadcn/ui + Tailwind
              4, pdfjs + sharp.
            </p>
          </section>

          <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-border pt-8">
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
