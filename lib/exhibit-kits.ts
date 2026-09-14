import { nowIso } from "./store";
import type { Appearance, ExhibitKit, ExhibitKitKind } from "./types";

export const EXHIBIT_KIT_KINDS: ExhibitKitKind[] = [
  "extra_large",
  "large",
  "medium",
  "small",
  "kiosk",
  "main_stage",
  "secondary_stage",
];

export const EXHIBIT_KIT_LABELS: Record<ExhibitKitKind, string> = {
  extra_large: "Extra Large Booth",
  large: "Large Booth",
  medium: "Medium Booth",
  small: "Small Booth",
  kiosk: "Kiosk",
  main_stage: "Main Stage",
  secondary_stage: "Secondary Stage",
};

export function isExhibitKitKind(value: string | null | undefined): value is ExhibitKitKind {
  return Boolean(value && (EXHIBIT_KIT_KINDS as string[]).includes(value));
}

export function kitAppearance(kind: ExhibitKitKind): Appearance {
  if (kind === "kiosk") return "kiosk";
  if (kind === "main_stage" || kind === "secondary_stage") return "stage";
  return "booth";
}

export function isStageKitKind(kind: ExhibitKitKind | null | undefined): boolean {
  return kind === "main_stage" || kind === "secondary_stage";
}

export const DEFAULT_EXHIBIT_KITS: Record<
  ExhibitKitKind,
  { widthM: number; depthM: number; wallHeightM: number; platformHeightM: number | null }
> = {
  kiosk: { widthM: 2, depthM: 2, wallHeightM: 2.2, platformHeightM: null },
  small: { widthM: 3, depthM: 3, wallHeightM: 2.5, platformHeightM: null },
  medium: { widthM: 6, depthM: 3, wallHeightM: 2.5, platformHeightM: null },
  large: { widthM: 6, depthM: 6, wallHeightM: 2.5, platformHeightM: null },
  extra_large: { widthM: 9, depthM: 9, wallHeightM: 3.5, platformHeightM: null },
  main_stage: { widthM: 18, depthM: 12, wallHeightM: 5, platformHeightM: 1.1 },
  secondary_stage: { widthM: 8, depthM: 5, wallHeightM: 3.5, platformHeightM: 0.8 },
};

const BHK26_KITS: Record<
  ExhibitKitKind,
  { widthM: number; depthM: number; wallHeightM: number; platformHeightM: number | null; instructions: string }
> = {
  kiosk: {
    widthM: 2,
    depthM: 2,
    wallHeightM: 2.2,
    platformHeightM: null,
    instructions: "Standing cabinet on a 2 × 2 m pad, 2.2 m tall.",
  },
  small: { widthM: 3, depthM: 3, wallHeightM: 2.5, platformHeightM: null, instructions: "S-BOOTH zone from Bitcoin Asia XR." },
  medium: { widthM: 3, depthM: 6, wallHeightM: 2.8, platformHeightM: null, instructions: "M-BOOTH zone: 3 × 6 m, wall 2.8 m." },
  large: { widthM: 6, depthM: 6, wallHeightM: 2.8, platformHeightM: null, instructions: "L-BOOTH zone from Bitcoin Asia XR." },
  extra_large: {
    widthM: 9.1,
    depthM: 8.9,
    wallHeightM: 3.5,
    platformHeightM: null,
    instructions: "XL BOOTH zone 9.1 × 8.9 m, wall 3.5 m.",
  },
  main_stage: {
    widthM: 22,
    depthM: 12,
    wallHeightM: 5,
    platformHeightM: 1.1,
    instructions:
      "Main stage: 22 × 12 m, 1.1 m platform, 5 m wall; aisle in front of the deck; chairs LOD at 30 m.",
  },
  secondary_stage: {
    widthM: 14,
    depthM: 5,
    wallHeightM: 3.5,
    platformHeightM: 0.75,
    instructions:
      "Genesis stage: 14 × 0.75 × 5 m orange platform, emissive LED wall, seats facing stage, LOD at 20 m.",
  },
};

export function defaultExhibitKits(eventId: string, slug?: string): ExhibitKit[] {
  const t = nowIso();
  const source = slug === "bhk26" ? BHK26_KITS : null;
  return EXHIBIT_KIT_KINDS.map((kind) => {
    const d = source?.[kind] ?? { ...DEFAULT_EXHIBIT_KITS[kind], instructions: "" };
    return {
      eventId,
      kind,
      widthM: d.widthM,
      depthM: d.depthM,
      wallHeightM: d.wallHeightM,
      platformHeightM: d.platformHeightM,
      instructions: "instructions" in d ? d.instructions : "",
      createdAt: t,
      updatedAt: t,
    };
  });
}

export function withCurrentKitDefaults(eventId: string, slug: string | undefined, kits: ExhibitKit[]): ExhibitKit[] {
  const fresh = defaultExhibitKits(eventId, slug);
  if (!kits.length) return fresh;
  const byKind = new Map(kits.map((k) => [k.kind, k]));
  return fresh.map((d) => {
    const old = byKind.get(d.kind);
    return old ? { ...old, widthM: d.widthM, depthM: d.depthM, wallHeightM: d.wallHeightM, platformHeightM: d.platformHeightM, instructions: d.instructions } : d;
  });
}

export function sortExhibitKits(kits: ExhibitKit[]): ExhibitKit[] {
  const order = new Map(EXHIBIT_KIT_KINDS.map((k, i) => [k, i]));
  return [...kits].sort((a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99));
}

export function kitByKind(kits: ExhibitKit[] | undefined, kind: ExhibitKitKind | null | undefined): ExhibitKit | null {
  if (!kind || !kits?.length) return null;
  return kits.find((k) => k.kind === kind) ?? null;
}

export function inferKitKindFromName(name: string, boothNumber = ""): ExhibitKitKind | null {
  const s = `${name} ${boothNumber}`.toLowerCase();
  if (/\bmain\s*stage\b/.test(s)) return "main_stage";
  if (/\b(secondary|genesis)\b/.test(s) && /\bstage\b/.test(s)) return "secondary_stage";
  if (/\bkiosk\b/.test(s)) return "kiosk";
  if (/\bxl\b/.test(s) || /extra\s*large/.test(s)) return "extra_large";
  if (/\bl-booth\b/.test(s) || /\blarge booth\b/.test(s)) return "large";
  if (/\bm-booth\b/.test(s) || /\bmedium booth\b/.test(s)) return "medium";
  if (/\bs-booth\b/.test(s) || /\bsmall booth\b/.test(s)) return "small";
  if (/\bstage\b/.test(s)) return "main_stage";
  return null;
}

export function chairLodDistance(kind: ExhibitKitKind | null | undefined): number {
  return kind === "secondary_stage" ? 20 : 30;
}

export function appendKitInstruction(existing: string, note: string): string {
  const line = note.trim();
  if (!line) return existing;
  const stamp = new Date().toISOString().slice(0, 10);
  const next = `${existing.trim()}${existing.trim() ? "\n" : ""}• ${stamp} ${line}`;
  return next;
}

export function kitStampName(kind: ExhibitKitKind): string {
  if (kind === "main_stage") return "Main Stage";
  if (kind === "secondary_stage") return "Secondary Stage";
  if (kind === "kiosk") return "Kiosk";
  return "";
}

export function rectRingFromKit(widthM: number, depthM: number): [number, number][] {
  const hw = widthM / 2;
  const hd = depthM / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
}
