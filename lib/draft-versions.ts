import type { DraftSlice } from "./types";

export const MAX_DRAFT_VERSIONS = 30;

export function sliceKey(slice: DraftSlice): string {
  return JSON.stringify({
    floors: slice.floors.map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sortOrder,
      underlayUrl: f.underlayUrl,
      originalUrl: f.originalUrl,
      calibration: f.calibration,
    })),
    objects: slice.objects.map((o) => ({
      id: o.id,
      floorId: o.floorId,
      kind: o.kind,
      polygon: o.polygon,
      x: o.x,
      y: o.y,
      rotation: o.rotation,
      boothNumber: o.boothNumber,
      name: o.name,
      sponsorId: o.sponsorId,
      amenityType: o.amenityType,
      color: o.color,
      appearance: o.appearance,
      facingDeg: o.facingDeg,
      modelAssetId: o.modelAssetId,
      rugTextureAssetId: o.rugTextureAssetId,
      wallTextureAssetId: o.wallTextureAssetId,
    })),
  });
}
