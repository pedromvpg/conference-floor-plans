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
