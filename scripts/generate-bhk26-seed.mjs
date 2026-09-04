/**
 * Build a compact schematic underlay + zone JSON from Asia XR hall coordinates.
 * XR world: x east (−39…+39 hall), +z south; stage at south, drawn at top of image.
 * Image CRS: origin top-left, y down, metres. px = metres * PPM.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PPM = 20;

const LOBBY_FLOOR_POLY = [
  [39.16, -26.5],
  [39.16, -16.43],
  [52.81, -16.43],
  [76.48, -16.43],
  [88.48, -18.33],
  [87.21, -25.79],
  [77.97, -43.01],
  [71.39, -51.9],
  [63.07, -52.0],
  [54.75, -60.07],
  [43.62, -60.43],
  [66.73, -66.16],
  [39.16, -60.43],
  [39.16, -21.5],
];

function wx(x) {
  return (x + 39) * PPM;
}
function wy(z) {
  return (53.5 - z) * PPM;
}

/** Axis-aligned booth from XR centre x,z and size w,d → image-metre polygon (y down). */
function boothPoly(x, z, w, d) {
  const x0 = x - w / 2 + 39;
  const x1 = x + w / 2 + 39;
  const yTop = 53.5 - (z + d / 2);
  const yBot = 53.5 - (z - d / 2);
  return [
    [x0, yTop],
    [x1, yTop],
    [x1, yBot],
    [x0, yBot],
  ];
}

const ZONES = [
  { name: "BITMAIN", x: 32.6, z: -14.0, w: 6.0, d: 8.9 },
  { name: "XL BOOTH", x: 22.1, z: -14.0, w: 9.1, d: 8.9 },
  { name: "STORE", x: 22.0, z: -0.7, w: 9.0, d: 6.0 },
  { name: "BMAG", x: 26.2, z: 13.5, w: 18.6, d: 18.1 },
  { name: "XL BOOTH 2", x: 32.6, z: -35.4, w: 6.0, d: 8.9 },
  { name: "M-BOOTH", x: 23.5, z: -23.3, w: 6.0, d: 3.0 },
  { name: "M-BOOTH", x: 23.5, z: -26.3, w: 6.0, d: 3.0 },
  { name: "L-BOOTH", x: 23.5, z: -34.0, w: 6.0, d: 6.0 },
  { name: "L-BOOTH", x: 23.5, z: -40.0, w: 6.0, d: 6.0 },
  { name: "M-BOOTH", x: 6.9, z: -3.5, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: 3.85, z: -3.5, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: -5.0, z: -3.5, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: -8.1, z: -3.5, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: 6.9, z: 14.2, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: 3.85, z: 14.2, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: -5.0, z: 14.2, w: 3.0, d: 6.0 },
  { name: "M-BOOTH", x: -8.1, z: 14.2, w: 3.0, d: 6.0 },
  { name: "S-BOOTH", x: 7.0, z: 6.8, w: 3.0, d: 3.0 },
  { name: "S-BOOTH", x: 3.9, z: 6.8, w: 3.0, d: 3.0 },
  { name: "S-BOOTH", x: -5.0, z: 6.8, w: 3.0, d: 3.0 },
  { name: "S-BOOTH", x: -8.1, z: 6.8, w: 3.0, d: 3.0 },
  { name: "PRESS", x: -27.0, z: 13.4, w: 18.1, d: 17.7 },
  { name: "DEAL ZONE", x: -27.0, z: -35.25, w: 18.1, d: 17.1 },
  { name: "BOH", x: -27.0, z: -46.4, w: 18.1, d: 4.7 },
  { name: "NEWS DESK", x: -0.6, z: -23.0, w: 18.1, d: 9.2 },
  { name: "METAPLANET", x: -0.6, z: -12.4, w: 18.1, d: 6.0 },
  { name: "MAIN STAGE", x: 0, z: 44.25, w: 22, d: 8.5 },
];

const AMENITIES = [
  { amenityType: "bathroom", x: -32, z: -50, label: "Restrooms" },
  { amenityType: "bathroom", x: 34, z: 48, label: "Restrooms" },
  { amenityType: "elevator", x: 44, z: -22, label: "Elevator" },
  { amenityType: "stairs", x: 46, z: -18, label: "Stairs" },
  { amenityType: "registration", x: 54.5, z: -34, label: "Tickets" },
  { amenityType: "exit", x: 42, z: -24, label: "Entrance" },
  { amenityType: "food", x: -27, z: -20, label: "Food" },
  { amenityType: "info", x: 0, z: 30, label: "Info" },
  { amenityType: "first_aid", x: -34, z: 40, label: "First aid" },
  { amenityType: "water", x: 30, z: 30, label: "Water" },
];

const widthPx = Math.ceil(wx(90));
const heightPx = Math.ceil(wy(-66.16));

const foyerPts = LOBBY_FLOOR_POLY.map(([x, z]) => `${wx(x).toFixed(1)},${wy(z).toFixed(1)}`).join(" ");

const grid = [];
for (let x = -31; x < 39; x += 8) {
  grid.push(`<line x1="${wx(x)}" y1="${wy(-53.5)}" x2="${wx(x)}" y2="${wy(53.5)}" />`);
}
for (let z = -45.5; z < 53.5; z += 8) {
  grid.push(`<line x1="${wx(-39)}" y1="${wy(z)}" x2="${wx(39)}" y2="${wy(z)}" />`);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">
  <rect width="100%" height="100%" fill="#f4f0e6"/>
  <rect x="${wx(-39)}" y="${wy(53.5)}" width="${78 * PPM}" height="${107 * PPM}" fill="#fffdf7" stroke="#1a1714" stroke-width="3"/>
  <g stroke="#1a1714" stroke-opacity="0.12" stroke-width="1" fill="none">${grid.join("")}</g>
  <polygon points="${foyerPts}" fill="#f7f1e4" stroke="#c4a574" stroke-width="2"/>
  <rect x="${wx(-11)}" y="${wy(48.5)}" width="${22 * PPM}" height="${8.5 * PPM}" fill="#ece4d4" stroke="#1a1714" stroke-width="2"/>
  <text x="${wx(0)}" y="${wy(44.25)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" fill="#6b5d4d">STAGE</text>
  <text x="${wx(0)}" y="${wy(0)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="36" fill="#8a7a68">HALL A &amp; B</text>
  <text x="${wx(62)}" y="${wy(-34)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" fill="#8a7a68">FOYER</text>
  <text x="${wx(0)}" y="${heightPx - 24}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="16" fill="#8a7a68">BHK26 schematic · 20 px/m · seed underlay</text>
</svg>
`;

const zones = {
  ppm: PPM,
  widthPx,
  heightPx,
  metersPerPixel: 1 / PPM,
  hall: { xMin: -39, xMax: 39, zMin: -53.5, zMax: 53.5 },
  booths: ZONES.map((z, i) => ({
    id: `bhk26-booth-${i + 1}`,
    name: z.name,
    boothNumber: z.name.match(/BOOTH|STAGE/) ? "" : z.name,
    polygon: boothPoly(z.x, z.z, z.w, z.d),
  })),
  amenities: AMENITIES.map((a, i) => ({
    id: `bhk26-amenity-${i + 1}`,
    amenityType: a.amenityType,
    label: a.label,
    x: a.x + 39,
    y: 53.5 - a.z,
  })),
};

writeFileSync(join(root, "public/seed/bhk26-hall.svg"), svg);
writeFileSync(join(root, "seed/bhk26-zones.json"), JSON.stringify(zones, null, 2));
console.log(`wrote underlay ${widthPx}×${heightPx} px, ${zones.booths.length} booths`);
