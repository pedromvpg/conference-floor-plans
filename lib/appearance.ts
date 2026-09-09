import type { Appearance, MapObject } from "./types";
import { tessellate } from "./bezier";

export function isStageObject(o: { name: string; boothNumber: string }): boolean {
  return /\bstage\b/i.test(`${o.name} ${o.boothNumber}`);
}

export function isBoothObject(o: MapObject): boolean {
  return o.kind === "booth" && !isStageObject(o);
}

export function resolveAppearance(o: MapObject): Appearance {
  if (o.appearance) return o.appearance;
  return isStageObject(o) ? "stage" : "booth";
}

export function hallDefaults(
  partial?: Partial<
    Pick<
      MapObject,
      | "appearance"
      | "facingDeg"
      | "modelAssetId"
      | "rugTextureAssetId"
      | "wallTextureAssetId"
      | "logoAssetId"
      | "fillTextureAssetId"
    >
  >,
) {
  return {
    appearance: partial?.appearance ?? null,
    facingDeg: partial?.facingDeg ?? 0,
    modelAssetId: partial?.modelAssetId ?? null,
    rugTextureAssetId: partial?.rugTextureAssetId ?? null,
    wallTextureAssetId: partial?.wallTextureAssetId ?? null,
    logoAssetId: partial?.logoAssetId ?? null,
    fillTextureAssetId: partial?.fillTextureAssetId ?? null,
  };
}

export function normalizeObject(o: MapObject): MapObject {
  const path = o.path?.length ? o.path : null;
  return {
    ...o,
    path,
    polygon: path ? tessellate(path, true) : o.polygon,
    appearance: o.appearance ?? null,
    facingDeg: o.facingDeg ?? 0,
    modelAssetId: o.modelAssetId ?? null,
    rugTextureAssetId: o.rugTextureAssetId ?? null,
    wallTextureAssetId: o.wallTextureAssetId ?? null,
    logoAssetId: o.logoAssetId ?? null,
    fillTextureAssetId: o.fillTextureAssetId ?? null,
    description: o.description ?? "",
    eventDate: o.eventDate ?? "",
  };
}

export const STAGE_PRESET_METERS = { w: 12, d: 8 };
