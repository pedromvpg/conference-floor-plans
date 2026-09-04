import type { AmenityType } from "./types";

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
