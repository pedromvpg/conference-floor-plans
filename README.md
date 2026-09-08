# Conference Maps

Standalone floor-plan **designer** and public **viewer** for Bitcoin conferences. Replaces ExpoFP. Embed the published viewer URL in btc-app (`events.venue_map_url`) — this repo does not share a database with btc-app.

## What you get

- Desktop-first designer: named plans, PDF/PNG/SVG underlay, two-click scale (m/ft), rectangles, polygons, amenity icons, **Plan / Hall** toggle, Airtable sponsor bind
- Public viewer: pan/zoom, search, booth sheets, 3D hall, logos when they fit, `?booth=` / `?airtable=` highlight
- **Assets** area: Sponsors, Agenda, and a texture/GLB library (sync caches Airtable attachments into the existing `maps` file store)
- Immutable publish snapshot + `GET /e/:slug/map.json` (native contract, version 1)
- iframe / WebView friendly (`frame-ancestors *`)

## Local demo (no Supabase)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), continue as editor. **Bitcoin Asia 2026** (`/e/bhk26`) is seeded from the XR hall coordinates (schematic underlay + booth rectangles + amenities). Draft lives in `.data/`.

Viewer: [http://localhost:3000/e/bhk26](http://localhost:3000/e/bhk26)  
JSON: [http://localhost:3000/e/bhk26/map.json](http://localhost:3000/e/bhk26/map.json)

Paste that viewer URL into btc-app admin → Venue Map.

## Production (Vercel + own Supabase)

1. Create a Supabase project. Run [`supabase/schema.sql`](supabase/schema.sql).
2. Create a **public** Storage bucket named `maps`.
3. Auth: enable email magic links. Redirect URL: `https://<host>/auth/callback`.
4. Insert your production emails into `allowed_editors`, or set `ALLOWED_EMAILS`.
5. `vercel link` this repo, set env from `.env.example`, deploy.
6. Airtable: same `CONF_BITCOINASIA2026` JSON as conference-screens bitcoinAsia2026 (Vercel env + `.env.local`). Tokens and table ids are not stored on the event.

The app uses the service role on the server. RLS still protects the tables from the anon key.

## Designer shortcuts

- `V` select · `R` rectangle (in Hall with a booth selected: rotate +45°) · `P` polygon · `I` amenity icon
- Two-click **Scale** + known length (Plan only)
- Size presets: 3×3 m, 6×6 m, 10×10 m, 10×10 ft, 20×20 ft
- Editor chrome: Designer · Assets · Settings

## Hall coordinates

Floor units are metres. Origin is the top-left of the underlay (same as the 2D plan, y down on the drawing).

In three.js: `x = worldX`, `z = worldY`, `y` is up. Facing `0°` puts the booth back wall toward −Z (top of the 2D plan). Custom library models should be authored with **+Z as the open front**.

Publish copies optional `appearance`, `facingDeg`, `modelUrl`, `rugTextureUrl`, and `wallTextureUrl` onto each GeoJSON feature. `MapDocument.version` stays `1`.

## Native contract

`GET /e/:slug/map.json` is a versioned GeoJSON document in floor-local metres (origin top-left of the underlay, y down). A later Expo viewer can render it without joining this database.
