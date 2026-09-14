import type { ReactNode } from "react";

type Kind = "plan" | "hall" | "walk";

export function HallSchematic({
  className,
  kind = "hall",
}: {
  className?: string;
  kind?: Kind;
}) {
  if (kind === "walk") return <WalkSchematic className={className} />;
  if (kind === "plan") return <PlanSchematic className={className} />;
  return <BoothHallSchematic className={className} />;
}

function Grid({ w, h }: { w: number; h: number }) {
  const step = 24;
  const cols = Math.ceil(w / step);
  const rows = Math.ceil(h / step);
  return (
    <g stroke="#2a2a2a" strokeWidth="0.5" fill="none">
      {Array.from({ length: cols }, (_, i) => (
        <line key={`v${i}`} x1={i * step} y1="0" x2={i * step} y2={h} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i * step} x2={w} y2={i * step} />
      ))}
    </g>
  );
}

function BoothHallSchematic({ className }: { className?: string }) {
  const booths: [number, number][] = [
    [64, 108],
    [132, 108],
    [200, 108],
    [268, 108],
    [336, 108],
    [64, 176],
    [132, 176],
    [268, 176],
    [336, 176],
    [64, 244],
    [132, 244],
    [200, 244],
    [268, 244],
    [336, 244],
  ];
  return (
    <svg viewBox="0 0 480 360" className={className} role="img" aria-label="Hall schematic">
      <rect width="480" height="360" fill="#0a0a0a" />
      <Grid w={480} h={360} />
      <rect x="36" y="28" width="408" height="304" fill="none" stroke="#fcfcfc" strokeWidth="1.2" />
      <rect x="56" y="44" width="368" height="36" fill="none" stroke="#ff9500" strokeWidth="1.4" />
      <text x="240" y="67" textAnchor="middle" fill="#ff9500" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="0.14em">
        STAGE
      </text>
      {booths.map(([x, y], i) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="56" height="48" fill="none" stroke="#8a8a8a" strokeWidth="1" />
          <text x={x + 28} y={y + 28} textAnchor="middle" fill="#8a8a8a" fontSize="9" fontFamily="ui-monospace, monospace">
            {String(i + 1).padStart(2, "0")}
          </text>
        </g>
      ))}
      <rect x="200" y="176" width="56" height="48" fill="none" stroke="#ff9500" strokeWidth="1.4" strokeDasharray="4 3" />
      <text x="44" y="338" fill="#8a8a8a" fontSize="8" fontFamily="ui-monospace, monospace">
        0,0
      </text>
      <text x="436" y="338" textAnchor="end" fill="#8a8a8a" fontSize="8" fontFamily="ui-monospace, monospace">
        m
      </text>
    </svg>
  );
}

function Pin({ cx, cy, children }: { cx: number; cy: number; children: ReactNode }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r="13" fill="#fcfcfc" />
      <g fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </g>
  );
}

function Zone({
  x,
  y,
  w,
  h,
  fill,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  label?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} rx="1.5" />
      {label ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 3.5}
          textAnchor="middle"
          fill="#fcfcfc"
          fontSize="9"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="0.04em"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function PlanSchematic({ className }: { className?: string }) {
  const booths: [number, number, number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 && c > 2) continue;
      booths.push([248 + c * 18, 168 + r * 16, 15, 13]);
    }
  }
  return (
    <svg viewBox="0 0 480 360" className={className} role="img" aria-label="Floor plan schematic">
      <rect width="480" height="360" fill="#0a0a0a" />
      <path
        d="M130 8 L390 8 L470 175 L400 352 L80 352 L10 175 Z"
        fill="#141414"
        stroke="#3a3a3a"
        strokeWidth="1"
      />
      <path
        d="M70 40 C52 120 40 175 58 255 L88 340"
        fill="none"
        stroke="#2e2e2e"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <g stroke="#2c2c2c" strokeWidth="0.6" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <line key={`h${i}`} x1="40" y1={20 + i * 36} x2="440" y2={20 + i * 36} />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <line key={`v${i}`} x1={50 + i * 30} y1="12" x2={50 + i * 30} y2="350" />
        ))}
      </g>
      <rect x="214" y="78" width="214" height="236" fill="#111" stroke="#9a9a9a" strokeWidth="1.5" />
      <Zone x="222" y="86" w="198" h="40" fill="#8b5cf6" />
      <Zone x="222" y="132" w="78" h="48" fill="#1a1a1a" />
      <text
        x="261"
        y="154"
        textAnchor="middle"
        fill="#fcfcfc"
        fontSize="9"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
      >
        CARD EXPO
      </text>
      <Zone x="338" y="132" w="82" h="44" fill="#3b82f6" label="Press" />
      {booths.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="#1c1c1c" stroke="#5a5a5a" strokeWidth="0.6" />
      ))}
      <rect x="248" y="184" width="24" height="18" fill="#166534" />
      <rect x="274" y="184" width="24" height="18" fill="#166534" />
      <rect x="248" y="232" width="40" height="18" fill="#9a3412" />
      <Zone x="338" y="184" w="82" h="54" fill="#52525b" label="Whale" />
      <Zone x="232" y="254" w="70" h="40" fill="#2563eb" label="DEAL ZONE" />
      <Zone x="306" y="254" w="114" h="40" fill="#7c3aed" label="GENESIS STAGE" />
      <Pin cx="196" cy="128">
        <path d="M-3.5 -2.5 h7 v7 h-7 z" />
        <path d="M-1.5 1.5 h3" />
      </Pin>
      <Pin cx="178" cy="168">
        <path d="M0 -4 v8" />
        <path d="M-2.5 -1.5 l2.5 -2.5 2.5 2.5" />
        <path d="M-2.5 3.5 l2.5 -2.5 2.5 2.5" />
      </Pin>
      <Pin cx="164" cy="208">
        <path d="M-3.5 3.5 L-3.5 -1 0 -4 3.5 -1 3.5 3.5" />
        <path d="M-1.2 3.5 v-3 h2.4 v3" />
      </Pin>
      <Pin cx="156" cy="248">
        <circle cx="0" cy="0" r="4" />
        <path d="M0 -1.6 v3.4" />
        <circle cx="0" cy="-2.6" r="0.4" fill="#111" stroke="none" />
      </Pin>
      <Pin cx="176" cy="286">
        <path d="M-3.5 3 v-4.5 a3.5 3.5 0 0 1 7 0 V3" />
        <path d="M-3.5 3 h7" />
      </Pin>
      <Pin cx="214" cy="308">
        <path d="M-2.5 2.5 c0 -4 5 -4 5 0" />
        <circle cx="-1" cy="-1.5" r="1.4" />
      </Pin>
      <Pin cx="438" cy="176">
        <path d="M-4 2 h8 v-2.5 l-2 -3 h-4 l-2 3 z" />
        <path d="M-1.6 2 v2.4 h3.2 V2" />
      </Pin>
    </svg>
  );
}

type Box = { x: number; y: number; w: number; d: number; h: number; fill: string };

function project(x: number, y: number, z: number) {
  return [48 + x * 17.5 + y * 13, 292 - y * 11.2 + x * 2.4 - z * 24] as const;
}

function poly(pts: readonly (readonly [number, number])[]) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function shade(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function Extrude({ box }: { box: Box }) {
  const { x, y, w, d, h, fill } = box;
  const t00 = project(x, y, h);
  const t10 = project(x + w, y, h);
  const t11 = project(x + w, y + d, h);
  const t01 = project(x, y + d, h);
  const b00 = project(x, y, 0);
  const b10 = project(x + w, y, 0);
  const b11 = project(x + w, y + d, 0);
  return (
    <g stroke="#fcfcfc" strokeOpacity="0.28" strokeWidth="0.65" strokeLinejoin="round">
      <polygon points={poly([t10, t11, b11, b10])} fill={shade(fill, -38)} />
      <polygon points={poly([t00, t10, b10, b00])} fill={shade(fill, -70)} />
      <polygon points={poly([t00, t10, t11, t01])} fill={fill} />
    </g>
  );
}

function FloorPad({ x, y, w, d }: { x: number; y: number; w: number; d: number }) {
  const a = project(x, y, 0);
  const b = project(x + w, y, 0);
  const c = project(x + w, y + d, 0);
  const e = project(x, y + d, 0);
  return <polygon points={poly([a, b, c, e])} fill="none" stroke="#fcfcfc" strokeOpacity="0.28" strokeWidth="0.8" />;
}

function WalkSchematic({ className }: { className?: string }) {
  const orange = "#ea580c";
  const boxes: Box[] = [
    { x: -1.2, y: 11.4, w: 6.4, d: 3.1, h: 1.25, fill: "#6d28d9" },
    { x: 6.8, y: 10.6, w: 4.6, d: 2.7, h: 1.2, fill: "#1d4ed8" },
    { x: 12.6, y: 10.2, w: 7.4, d: 3.2, h: 1.15, fill: orange },
    { x: -0.4, y: 8.1, w: 3.4, d: 2.1, h: 1.15, fill: "#dc2626" },
    { x: 3.8, y: 8.0, w: 3.6, d: 2.2, h: 1.1, fill: "#16a34a" },
    { x: 8.2, y: 7.4, w: 2.0, d: 1.7, h: 1.05, fill: orange },
    { x: 10.3, y: 7.4, w: 2.0, d: 1.7, h: 1.05, fill: orange },
    { x: 13.8, y: 6.4, w: 6.8, d: 2.9, h: 1.2, fill: orange },
    { x: 2.6, y: 4.6, w: 6.8, d: 2.5, h: 1.08, fill: orange },
    { x: -1.6, y: 2.6, w: 2.0, d: 1.7, h: 1.02, fill: orange },
    { x: 0.5, y: 2.6, w: 2.0, d: 1.7, h: 1.02, fill: orange },
    { x: 5.4, y: 1.8, w: 6.6, d: 2.6, h: 1.08, fill: orange },
    { x: 13.2, y: 1.2, w: 6.6, d: 3.4, h: 1.45, fill: "#1d4ed8" },
    { x: 6.4, y: -0.5, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 8.4, y: -0.5, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 6.4, y: -2.25, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 8.4, y: -2.25, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 11.6, y: -1.8, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 13.6, y: -1.8, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 11.6, y: -3.55, w: 1.9, d: 1.65, h: 1.0, fill: orange },
    { x: 13.6, y: -3.55, w: 1.9, d: 1.65, h: 1.0, fill: orange },
  ].sort((a, b) => b.y + b.d * 0.5 + b.x * 0.15 - (a.y + a.d * 0.5 + a.x * 0.15));

  return (
    <svg viewBox="0 0 480 360" className={className} role="img" aria-label="Hall aisle schematic">
      <rect width="480" height="360" fill="#0a0a0a" />
      <FloorPad x={3.2} y={0.2} w={2.2} d={1.8} />
      <FloorPad x={10.2} y={3.4} w={2.4} d={2} />
      {boxes.map((box) => (
        <Extrude key={`${box.x}-${box.y}-${box.w}`} box={box} />
      ))}
    </svg>
  );
}
