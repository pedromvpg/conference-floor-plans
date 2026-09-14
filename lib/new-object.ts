import { hallDefaults } from "./appearance";
import { amenityLabel } from "./amenities";
import { DEFAULT_SHAPE_PAINT } from "./paint";
import { nowIso, newId } from "./store";
import type { AmenityType, Appearance, BezierNode, MapObject, PinKind, Ring } from "./types";
import { MAP_PIN_META } from "./types";

export function newMapObject(input: {
  floorId: string;
  kind: MapObject["kind"];
  polygon?: Ring | null;
  path?: BezierNode[] | null;
  x?: number | null;
  y?: number | null;
  name?: string;
  boothNumber?: string;
  description?: string;
  eventDate?: string;
  amenityType?: AmenityType | null;
  appearance?: Appearance | null;
  kitKind?: MapObject["kitKind"];
  modelAssetId?: string | null;
}): MapObject {
  const t = nowIso();
  return {
    id: newId(),
    floorId: input.floorId,
    kind: input.kind,
    polygon: input.polygon ?? null,
    path: input.path ?? null,
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
    paint: { ...DEFAULT_SHAPE_PAINT },
    ...hallDefaults({
      appearance: input.appearance ?? null,
      kitKind: input.kitKind ?? null,
      modelAssetId: input.modelAssetId ?? null,
    }),
    createdAt: t,
    updatedAt: t,
  };
}

export function stampPinObject(input: {
  floorId: string;
  pinKind: PinKind;
  x: number;
  y: number;
  amenityType?: AmenityType;
  appearance?: Appearance | null;
  modelAssetId?: string | null;
}): MapObject {
  if (input.pinKind === "side_event" || input.pinKind === "hotel") {
    return newMapObject({
      floorId: input.floorId,
      kind: input.pinKind,
      x: input.x,
      y: input.y,
      name: MAP_PIN_META[input.pinKind].label,
    });
  }
  const amenityType = input.amenityType ?? "info";
  return newMapObject({
    floorId: input.floorId,
    kind: "amenity",
    x: input.x,
    y: input.y,
    name: amenityLabel(amenityType),
    amenityType,
    appearance: input.appearance,
    modelAssetId: input.modelAssetId,
  });
}
