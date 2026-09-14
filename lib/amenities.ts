import type { AmenityType, MapObject } from "./types";
import { MAP_PIN_META } from "./types";

export const AMENITIES: {
  type: AmenityType;
  label: string;
  short: string;
}[] = [
  { type: "bathroom", label: "Bathroom", short: "WC" },
  { type: "elevator", label: "Elevator", short: "Elv" },
  { type: "stairs", label: "Stairs", short: "St" },
  { type: "food", label: "Food", short: "Food" },
  { type: "registration", label: "Registration", short: "Reg" },
  { type: "exit", label: "Exit", short: "Exit" },
  { type: "info", label: "Info", short: "i" },
  { type: "first_aid", label: "First aid", short: "+" },
  { type: "water", label: "Water", short: "H2O" },
];

export function amenityLabel(type: AmenityType): string {
  return AMENITIES.find((a) => a.type === type)?.label ?? type;
}

export type IconType = AmenityType | "side_event" | "hotel";

export const ICON_TYPES: { type: IconType; label: string }[] = [
  ...AMENITIES.map((a) => ({ type: a.type as IconType, label: a.label })),
  { type: "side_event", label: MAP_PIN_META.side_event.label },
  { type: "hotel", label: MAP_PIN_META.hotel.label },
];

export function iconTypeOf(o: Pick<MapObject, "kind" | "amenityType">): IconType {
  if (o.kind === "hotel" || o.kind === "side_event") return o.kind;
  return o.amenityType ?? "info";
}

export function iconTypeLabel(type: IconType): string {
  return ICON_TYPES.find((t) => t.type === type)?.label ?? type;
}

export function applyIconType<T extends Pick<MapObject, "kind" | "amenityType" | "name">>(
  o: T,
  next: IconType,
): T {
  const prev = iconTypeLabel(iconTypeOf(o));
  const rename = !o.name.trim() || o.name === prev;
  if (next === "hotel" || next === "side_event") {
    return {
      ...o,
      kind: next,
      amenityType: null,
      name: rename ? MAP_PIN_META[next].label : o.name,
    };
  }
  return {
    ...o,
    kind: "amenity",
    amenityType: next as AmenityType,
    name: rename ? amenityLabel(next as AmenityType) : o.name,
  };
}

export const AMENITY_COLOR: Record<AmenityType, string> = {
  bathroom: "#3b82f6",
  elevator: "#8b5cf6",
  stairs: "#6366f1",
  food: "#f59e0b",
  registration: "#10b981",
  exit: "#ef4444",
  info: "#0ea5e9",
  first_aid: "#dc2626",
  water: "#06b6d4",
};
