import type { ReactNode } from "react";

type Kind = "plan" | "hall" | "walk";

const svgFill = {
  viewBox: "0 0 480 360",
  preserveAspectRatio: "xMidYMid meet",
} as const;

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
    <svg {...svgFill} className={className} role="img" aria-label="Hall schematic">
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
      <circle r="15" fill="#fcfcfc" />
      <circle r="15" fill="none" stroke="#000" strokeOpacity="0.12" />
      <g fill="none" stroke="#111" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
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
  size = 9,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  label?: string;
  size?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} rx="2" />
      {label ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + size * 0.35}
          textAnchor="middle"
          fill="#fcfcfc"
          fontSize={size}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
          letterSpacing="0.03em"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function MiniBooth({ x, y, w, h, fill = "#1c1c1c" }: { x: number; y: number; w: number; h: number; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#6b6b6b" strokeWidth="0.7" rx="0.6" />
      <rect x={x + 1.4} y={y + 1.2} width={w * 0.38} height={h * 0.28} fill="#2a2a2a" />
    </g>
  );
}

function PlanSchematic({ className }: { className?: string }) {
  const booths: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 && c > 2) continue;
      booths.push([248 + c * 18, 168 + r * 16]);
    }
  }
  return (
    <svg {...svgFill} className={className} role="img" aria-label="Floor plan schematic">
      <defs>
        <radialGradient id="planGlow" cx="62%" cy="58%" r="58%">
          <stop offset="0%" stopColor="#161616" />
          <stop offset="100%" stopColor="#070707" />
        </radialGradient>
        <pattern id="planGrid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#2c2c2c" strokeWidth="0.55" />
        </pattern>
      </defs>
      <rect width="480" height="360" fill="url(#planGlow)" />
      <rect width="480" height="360" fill="url(#planGrid)" opacity="0.55" />
      <path
        d="M118 4 L402 4 L478 178 L408 356 L72 356 L4 178 Z"
        fill="#101010"
        stroke="#3a3a3a"
        strokeWidth="1"
      />
      <path d="M58 36 C40 118 28 176 48 258 L80 348" fill="none" stroke="#232323" strokeWidth="14" strokeLinecap="round" />
      <rect x="208" y="72" width="228" height="248" fill="#0e0e0e" stroke="#d4d4d4" strokeWidth="1.8" rx="2" />
      <Zone x={216} y={80} w={212} h={42} fill="#7c3aed" />
      <rect x="216" y="80" width="212" height="7" fill="#c4b5fd" opacity="0.28" />
      <Zone x={216} y={128} w={82} h={50} fill="#171717" />
      <text
        x="257"
        y="157"
        textAnchor="middle"
        fill="#fcfcfc"
        fontSize="9.5"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="800"
      >
        CARD EXPO
      </text>
      <Zone x={336} y={128} w={92} h={46} fill="#2563eb" label="Press" size={10} />
      {booths.map(([x, y], i) => (
        <MiniBooth key={i} x={x} y={y} w={15} h={13} />
      ))}
      <rect x="248" y="184" width="24" height="18" fill="#15803d" rx="0.6" />
      <rect x="274" y="184" width="24" height="18" fill="#16a34a" rx="0.6" />
      <rect x="248" y="232" width="40" height="18" fill="#c2410c" rx="0.6" />
      <Zone x={336} y={182} w={92} h={56} fill="#52525b" label="Whale" size={10} />
      <Zone x={228} y={256} w={78} h={44} fill="#1d4ed8" label="DEAL ZONE" size={8} />
      <Zone x={310} y={256} w={118} h={44} fill="#6d28d9" label="GENESIS STAGE" size={8.5} />
      <rect x="336" y="128" width="92" height="46" fill="none" stroke="#93c5fd" strokeWidth="1.2" rx="2" />
      <Pin cx={186} cy={126}>
        <path d="M-3.5 -2.5 h7 v7 h-7 z" />
        <path d="M-1.5 1.5 h3" />
      </Pin>
      <Pin cx={168} cy={168}>
        <path d="M0 -4 v8" />
        <path d="M-2.5 -1.5 l2.5 -2.5 2.5 2.5" />
        <path d="M-2.5 3.5 l2.5 -2.5 2.5 2.5" />
      </Pin>
      <Pin cx={154} cy={210}>
        <path d="M-3.5 3.5 L-3.5 -1 0 -4 3.5 -1 3.5 3.5" />
        <path d="M-1.2 3.5 v-3 h2.4 v3" />
      </Pin>
      <Pin cx={146} cy={252}>
        <circle cx="0" cy="0" r="4" />
        <path d="M0 -1.6 v3.4" />
        <circle cx="0" cy="-2.6" r="0.4" fill="#111" stroke="none" />
      </Pin>
      <Pin cx={168} cy={292}>
        <path d="M-3.5 3 v-4.5 a3.5 3.5 0 0 1 7 0 V3" />
        <path d="M-3.5 3 h7" />
      </Pin>
      <Pin cx={208} cy={318}>
        <path d="M-2.5 2.5 c0 -4 5 -4 5 0" />
        <circle cx="-1" cy="-1.5" r="1.4" />
      </Pin>
      <Pin cx={448} cy={176}>
        <path d="M-4 2 h8 v-2.5 l-2 -3 h-4 l-2 3 z" />
        <path d="M-1.6 2 v2.4 h3.2 V2" />
      </Pin>
    </svg>
  );
}

type Box = { x: number; y: number; w: number; d: number; h: number; fill: string };

function project(x: number, y: number, z: number) {
  return [40 + x * 18.4 + y * 13.8, 286 - y * 11.6 + x * 2.2 - z * 26] as const;
}

function poly(pts: readonly (readonly [number, number])[]) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function shade(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function BoxShadow({ box }: { box: Box }) {
  const { x, y, w, d } = box;
  const s00 = project(x + 0.35, y + 0.2, 0);
  const s10 = project(x + w + 0.35, y + 0.2, 0);
  const s11 = project(x + w + 0.35, y + d + 0.2, 0);
  const s01 = project(x + 0.35, y + d + 0.2, 0);
  return <polygon points={poly([s00, s10, s11, s01])} fill="#000" opacity="0.28" />;
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
    <g stroke="#fff" strokeOpacity="0.18" strokeWidth="0.55" strokeLinejoin="round">
      <polygon points={poly([t10, t11, b11, b10])} fill={shade(fill, -42)} />
      <polygon points={poly([t00, t10, b10, b00])} fill={shade(fill, -78)} />
      <polygon points={poly([t00, t10, t11, t01])} fill={shade(fill, 18)} />
      <line x1={t00[0]} y1={t00[1]} x2={t11[0]} y2={t11[1]} stroke="#fff" strokeOpacity="0.12" />
    </g>
  );
}

/** SE camera: south and east are nearer. Draw far (north/west) first. */
function paintOrder(boxes: Box[]) {
  return [...boxes].sort((a, b) => {
    const near = (box: Box) => -box.y * 11.6 + (box.x + box.w) * 2.2;
    const d = near(a) - near(b);
    if (Math.abs(d) > 0.01) return d;
    return a.x + a.w - (b.x + b.w);
  });
}

function WalkSchematic({ className }: { className?: string }) {
  const orange = "#ea580c";
  const floor = [
    project(-2.2, -4.4, 0),
    project(22.4, -4.4, 0),
    project(22.4, 15.2, 0),
    project(-2.2, 15.2, 0),
  ];
  const boxes: Box[] = [
    { x: -0.6, y: 11.6, w: 7.2, d: 3.0, h: 1.35, fill: "#6d28d9" },
    { x: 7.4, y: 11.2, w: 5.2, d: 2.6, h: 1.22, fill: "#1d4ed8" },
    { x: 13.4, y: 10.6, w: 7.8, d: 3.3, h: 1.18, fill: orange },
    { x: -0.2, y: 8.2, w: 3.6, d: 2.2, h: 1.18, fill: "#dc2626" },
    { x: 4.0, y: 8.1, w: 3.8, d: 2.3, h: 1.12, fill: "#16a34a" },
    { x: 8.6, y: 7.6, w: 2.05, d: 1.75, h: 1.05, fill: orange },
    { x: 10.8, y: 7.6, w: 2.05, d: 1.75, h: 1.05, fill: orange },
    { x: 14.0, y: 6.6, w: 7.2, d: 3.0, h: 1.22, fill: orange },
    { x: 2.4, y: 4.6, w: 7.2, d: 2.55, h: 1.1, fill: orange },
    { x: -1.4, y: 2.5, w: 2.05, d: 1.75, h: 1.02, fill: orange },
    { x: 0.8, y: 2.5, w: 2.05, d: 1.75, h: 1.02, fill: orange },
    { x: 5.6, y: 1.7, w: 7.0, d: 2.7, h: 1.1, fill: orange },
    { x: 13.6, y: 1.1, w: 7.0, d: 3.5, h: 1.55, fill: "#1d4ed8" },
    { x: 6.6, y: -0.6, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 8.7, y: -0.6, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 6.6, y: -2.45, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 8.7, y: -2.45, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 12.0, y: -1.9, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 14.1, y: -1.9, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 12.0, y: -3.75, w: 2.0, d: 1.7, h: 1.0, fill: orange },
    { x: 14.1, y: -3.75, w: 2.0, d: 1.7, h: 1.0, fill: orange },
  ];
  const ordered = paintOrder(boxes);

  const tiles: [number, number][] = [];
  for (let y = -3; y < 14; y += 2.2) {
    for (let x = -1; x < 21; x += 2.4) tiles.push([x, y]);
  }

  return (
    <svg {...svgFill} className={className} role="img" aria-label="Hall aisle schematic">
      <defs>
        <linearGradient id="walkSky" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#121212" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#walkSky)" />
      <polygon points={poly(floor)} fill="#0c0c0c" />
      {tiles.map(([x, y], i) => {
        const a = project(x, y, 0);
        const b = project(x + 2.15, y, 0);
        const c = project(x + 2.15, y + 1.95, 0);
        const e = project(x, y + 1.95, 0);
        return (
          <polygon
            key={i}
            points={poly([a, b, c, e])}
            fill="none"
            stroke="#fcfcfc"
            strokeOpacity="0.06"
            strokeWidth="0.6"
          />
        );
      })}
      {ordered.map((box) => (
        <BoxShadow key={`s-${box.x}-${box.y}-${box.w}`} box={box} />
      ))}
      {ordered.map((box) => (
        <Extrude key={`${box.x}-${box.y}-${box.w}`} box={box} />
      ))}
    </svg>
  );
}
