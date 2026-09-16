# Conference Floor Plans

Standalone floor-plan **designer** and public **viewer** for Bitcoin conferences. Replaces ExpoFP. Embed the published viewer URL in btc-app (`events.venue_map_url`) — this repo does not share a database with btc-app.

## What you get

- Desktop-first designer: named plans, PDF/PNG/SVG underlay, two-click scale (m/ft), rectangles, polygons, amenity icons, **Plan / Hall** toggle, Airtable sponsor bind
- Public viewer: pan/zoom, search, booth sheets, 3D hall, logos when they fit. Query: `?booth=` / `?airtable=` highlight, `?view=3d` / `?view=2d`, `?floor=`, `?sizes=1`, plus hall flags (`ortho`, `fog`, `az`, `el`, …)
- **Sponsors, Agenda, Library**: sync Airtable caches and upload textures/GLB (files go into the existing `maps` store)

- Immutable publish snapshot + `GET /e/:slug/map.json` (native contract, version 1)
- iframe / WebView friendly (`frame-ancestors *`)

## Testing: local vs deployed

We will use **Supabase** (likely an existing org project) once someone can authorize it. Until then, **Vercel Blob** is the shared store: laptop `next dev` and the deployed app must use the same `BLOB_READ_WRITE_TOKEN` (pull Development env). Disk `.data/` is only an offline fallback.

| | Blob (now) | Supabase (later) |
| --- | --- | --- |
| **Login** | Work email + Node `scrypt` hash (16-byte salt, 64-byte key, stored `salt:hex`). Session cookie is the email, not the password. Protect the Vercel URL with Deployment Protection. | Magic link / password + `allowed_editors` |
| **Saves** | Shared `maps/db.json` in Blob | Postgres + `maps` bucket |
| **Overlap** | Banner if another email is in Designer | Same last-write-wins until locks |

In-app: `/docs` → **Local vs deploy**.

### Shared Blob (laptop + Vercel)

1. Create a Blob store on the `conference-maps` Vercel project (Production, Preview, **Development**).
2. `vercel env pull .env.local` (leave Supabase empty). Redeploy.
3. Open local or the Vercel URL → sign in with your work email → edit. Same Blob.

If Blob is empty and this machine still has `.data/db.json`, that JSON is uploaded once. Re-upload underlays that only lived on disk.

### Offline laptop only

```bash
npm install
npm run dev
```

No Blob token → gitignored `.data/db.json` on that machine only.

Viewer query params (override saved prefs): `view=3d|2d|hall|plan`, `floor=` (id or name), `sizes=1`, `grid=1`, `rulers=1`, `panel=1`, `booth=`, `airtable=`. Hall: `ortho`, `cuboids`, `fog`, `ao`, `shadows`, `env`, `pt`, `az`, `el`, `dist`, `sun`, `sunEl`, `light`, `fill`, `fogI`.

Paste a published viewer URL into btc-app admin → Venue Map.

## Production setup (operators, when Supabase is authorized)

1. Attach an **existing** Supabase project if possible. Run [`supabase/schema.sql`](supabase/schema.sql) and later files in `supabase/migrations/`.
2. Create a **public** Storage bucket named `maps`.
3. Auth: enable email. Redirect URL: `https://<host>/auth/callback` (and `http://localhost:3000/auth/callback`).
4. Insert editor emails into `allowed_editors`, or set `ALLOWED_EMAILS`.
5. Set the three Supabase env vars for Production, Preview, and Development. Redeploy. Blob mode stops when they are set.
6. Airtable: same `CONF_BITCOINASIA2026` JSON as conference-screens bitcoinAsia2026 (Vercel env + `.env.local`).

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
