# Conference Floor Plans

Standalone floor-plan **designer** and public **viewer** for Bitcoin conferences. Replaces ExpoFP. Embed the published viewer URL in btc-app (`events.venue_map_url`) — this repo does not share a database with btc-app.

## What you get

- Desktop-first designer: named plans, PDF/PNG/SVG underlay, two-click scale (m/ft), rectangles, polygons, amenity icons, **Plan / Hall** toggle, Airtable sponsor bind
- Public viewer: pan/zoom, search, booth sheets, 3D hall, logos when they fit. Query: `?booth=` / `?airtable=` highlight, `?view=3d` / `?view=2d`, `?floor=`, `?sizes=1`, plus hall flags (`ortho`, `fog`, `az`, `el`, …)
- **Sponsors, Agenda, Library**: sync Airtable caches and upload textures/GLB (files go into the existing `maps` store)

- Immutable publish snapshot + `GET /e/:slug/map.json` (native contract, version 1)
- iframe / WebView friendly (`frame-ancestors *`)

## Testing: local vs deployed

The UI is the same. Persistence is not.

| | Your laptop (`npm run dev`) | Vercel preview / production |
| --- | --- | --- |
| **Login** | Sign in → **Continue as editor**. No email. | Magic link to an allowlisted work email. Demo login is off. |
| **Saves** | Gitignored `.data/db.json` on disk | Shared Supabase (Postgres + `maps` storage bucket) |
| **Seed** | Bitcoin Asia 2026 at `/e/bhk26` | Only events already in that database |
| **Viewer** | `/e/:slug` after local publish | Same paths on the Vercel host; no login to view |

Vercel functions have a **read-only** filesystem. Writing `.data/` there fails with `EROFS`. Do not expect “Continue as editor” on the hosted URL.

In-app copy of this: `/docs` → **Local vs deploy**.

### Try it locally (any teammate)

```bash
git clone <this-repo>
cd conference-floor-plans
npm install
npm run dev
```

Leave `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` empty (see `.env.example`). Open [http://localhost:3000](http://localhost:3000), continue as editor, open **bhk26**, draw in Designer, publish, then check:

- Viewer: [http://localhost:3000/e/bhk26](http://localhost:3000/e/bhk26)
- 3D: [http://localhost:3000/e/bhk26?view=3d](http://localhost:3000/e/bhk26?view=3d)
- JSON: [http://localhost:3000/e/bhk26/map.json](http://localhost:3000/e/bhk26/map.json)

Your draft is only on that machine. Delete `.data/` to reset.

Viewer query params (override saved prefs): `view=3d|2d|hall|plan`, `floor=` (id or name), `sizes=1`, `grid=1`, `rulers=1`, `panel=1`, `booth=`, `airtable=`. Hall: `ortho`, `cuboids`, `fog`, `ao`, `shadows`, `env`, `pt`, `az`, `el`, `dist`, `sun`, `sunEl`, `light`, `fill`, `fogI`.

Paste a published viewer URL into btc-app admin → Venue Map.

### Try the Vercel app (shared data)

1. Ask an operator to add your email to `allowed_editors` or `ALLOWED_EMAILS`.
2. Open the deployment URL → Sign in → magic link.
3. Edit and publish against the shared database. Anyone can still open `/e/:slug` without an account.

To point **local** at that same database, copy `.env.example` → `.env.local`, fill the three Supabase keys, restart `npm run dev`. Login then matches production (magic link, not demo).

## Production setup (operators)

1. Create a Supabase project. Run [`supabase/schema.sql`](supabase/schema.sql).
2. Create a **public** Storage bucket named `maps`.
3. Auth: enable email magic links. Redirect URL: `https://<host>/auth/callback` (and `http://localhost:3000/auth/callback` if developing against the same project).
4. Insert editor emails into `allowed_editors`, or set `ALLOWED_EMAILS`.
5. `vercel link` this repo. Set env from `.env.example` for Production **and** Preview — including `SUPABASE_SERVICE_ROLE_KEY`. Redeploy.
6. Airtable: same `CONF_BITCOINASIA2026` JSON as conference-screens bitcoinAsia2026 (Vercel env + `.env.local`). Tokens and table ids are not stored on the event.

The app uses the service role on the server. RLS still protects the tables from the anon key.

## Designer shortcuts

- `V` select · `R` rectangle (in Hall with a booth selected: rotate +45°) · `P` polygon · `I` amenity icon
- Two-click **Scale** + known length (Plan only)
- Size presets: 3×3 m, 6×6 m, 10×10 m, 10×10 ft, 20×20 ft
- Editor chrome: Event · Sponsors · Agenda · Library · Settings · Designer (`/e/:slug/studio` is the hub)

## Hall coordinates

Floor units are metres. Origin is the top-left of the underlay (same as the 2D plan, y down on the drawing).

In three.js: `x = worldX`, `z = worldY`, `y` is up. Facing `0°` puts the booth back wall toward −Z (top of the 2D plan). Custom library models should be authored with **+Z as the open front**.

Publish copies optional `appearance`, `facingDeg`, `modelUrl`, `rugTextureUrl`, and `wallTextureUrl` onto each GeoJSON feature. `MapDocument.version` stays `1`.

## Native contract

`GET /e/:slug/map.json` is a versioned GeoJSON document in floor-local metres (origin top-left of the underlay, y down). A later Expo viewer can render it without joining this database.
