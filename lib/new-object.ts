import { hallDefaults } from "./appearance";
import { nowIso, newId } from "./store";
import type { AmenityType, Appearance, MapObject, Ring } from "./types";

export function newMapObject(input: {
  floorId: string;
  kind: MapObject["kind"];
  polygon?: Ring | null;
  x?: number | null;
  y?: number | null;
  name?: string;
  boothNumber?: string;
  description?: string;
  eventDate?: string;
  amenityType?: AmenityType | null;
  appearance?: Appearance | null;
  modelAssetId?: string | null;
}): MapObject {
  const t = nowIso();
  return {
    id: newId(),
    floorId: input.floorId,
    kind: input.kind,
    polygon: input.polygon ?? null,
    x: input.x ?? null,
    y: input.y ?? null,
    rotation: 0,
    boothNumber: input.boothNumber ?? "",
    name: input.name ?? "",
    description: input.description ?? "",
    eventDate: input.eventDate ?? "",
    sponsorId: null,
    amenityType: input.amenityType ?? null,
    color: null,
    ...hallDefaults({
      appearance: input.appearance ?? null,
      modelAssetId: input.modelAssetId ?? null,
    }),
    createdAt: t,
    updatedAt: t,
  };
}
