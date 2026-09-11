import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowUpDown,
  Bath,
  Building2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  Droplets,
  Info,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import type { AmenityType, ObjectKind } from "@/lib/types";

function StairsIcon({ size = 24, color = "currentColor", strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M4 21h5v-5h5v-5h5V6h1" />
      <path d="M4 21V16" />
      <path d="M9 16V11" />
      <path d="M14 11V6" />
    </svg>
  );
}

const ICON_INNER: Record<AmenityType | "hotel" | "side_event", string> = {
  bathroom:
    '<path d="M10 4a2 2 0 1 1 4 0"/><path d="M4 10h16"/><path d="M6 10v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/><path d="M8 22v-2"/><path d="M16 22v-2"/>',
  elevator:
    '<path d="m11 17-4-4 4-4"/><path d="m13 7 4 4-4 4"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  stairs:
    '<path d="M4 21h5v-5h5v-5h5V6h1"/><path d="M4 21V16"/><path d="M9 16V11"/><path d="M14 11V6"/>',
  food: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  registration:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  exit: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12H2l3-3"/><path d="m5 15-3-3"/><path d="M10 4v16"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  first_aid: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  water: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7z"/>',
  hotel:
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  side_event:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
};

const AMENITY_ICONS: Record<AmenityType, LucideIcon> = {
  bathroom: Bath,
  elevator: ArrowUpDown,
  stairs: StairsIcon as LucideIcon,
  food: UtensilsCrossed,
  registration: ClipboardList,
  exit: DoorOpen,
  info: Info,
  first_aid: Plus,
  water: Droplets,
};

export function pinLucideIcon(kind: ObjectKind, amenityType?: AmenityType | null): LucideIcon {
  if (kind === "hotel") return Building2;
  if (kind === "side_event") return CalendarDays;
  return AMENITY_ICONS[amenityType ?? "info"] ?? Info;
}

export function pinIconSvgMarkup(
  kind: ObjectKind,
  amenityType: AmenityType | null | undefined,
  x: number,
  y: number,
  size: number,
): string {
  const key = kind === "hotel" || kind === "side_event" ? kind : (amenityType ?? "info");
  const inner = ICON_INNER[key] ?? ICON_INNER.info;
  const half = size / 2;
  return `<svg x="${x - half}" y="${y - half}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
