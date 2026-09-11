import { ringBounds, ringCentroid, rotateRing, translateRing } from "./geometry";
import { snap } from "./units";
import type { LibraryAsset, MapObject, Ring } from "./types";

export function worldToThree(x: number, y: number): [number, number, number] {
  return [x, 0, y];
}

export function threeToWorld(x: number, z: number): { x: number; y: number } {
  return { x, y: z };
}

export type FacingObb = {
  cx: number;
  cy: number;
  w: number;
  d: number;
  facingDeg: number;
  /** Local X of the back-edge midpoint (un-yawed AABB, relative to centroid). */
  backX: number;
  /** Local Z of the back-edge midpoint; 2D local −Y / Three.js −Z. */
  backZ: number;
};

export function facingObb(ring: Ring, facingDeg: number): FacingObb {
  const { x: cx, y: cy } = ringCentroid(ring);
  const local = rotateRing(ring, -facingDeg);
  const b = ringBounds(local);
  const w = Math.max(0.4, b.w);
  const d = Math.max(0.4, b.h);
  return {
    cx,
    cy,
    w,
    d,
    facingDeg,
    backX: (b.minX + b.maxX) / 2 - cx,
    backZ: b.minY - cy,
  };
}

export function rotatePlot(ring: Ring, facingDeg: number, delta: number): { polygon: Ring; facingDeg: number } {
  return {
    polygon: rotateRing(ring, delta),
    facingDeg: facingDeg + delta,
  };
}

export function yawRad(facingDeg: number): number {
  return (-facingDeg * Math.PI) / 180;
}

export function snapWorld(x: number, y: number, grid = 1): { x: number; y: number } {
  return { x: snap(x, grid), y: snap(y, grid) };
}

export function objectUrls(o: MapObject, assets: LibraryAsset[] = []) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  return {
    modelUrl: o.modelUrl || (o.modelAssetId ? byId.get(o.modelAssetId)?.url : "") || "",
    rugTextureUrl: o.rugTextureUrl || (o.rugTextureAssetId ? byId.get(o.rugTextureAssetId)?.url : "") || "",
    wallTextureUrl: o.wallTextureUrl || (o.wallTextureAssetId ? byId.get(o.wallTextureAssetId)?.url : "") || "",
    logoUrl: o.logoUrl || (o.logoAssetId ? byId.get(o.logoAssetId)?.url : "") || "",
    fillTextureUrl: o.fillTextureUrl || (o.fillTextureAssetId ? byId.get(o.fillTextureAssetId)?.url : "") || "",
  };
}

export function displayLogoUrl(
  o: MapObject,
  assets: LibraryAsset[] = [],
  sponsor?: { logoUrl?: string } | null,
) {
  return objectUrls(o, assets).logoUrl || sponsor?.logoUrl || "";
}

export function isometricPose(
  cx: number,
  cz: number,
  span: number,
  pose?: { azimuth?: number; elevation?: number; distance?: number },
) {
  const dist = Math.max(16, span * 0.85) * (pose?.distance ?? 1);
  const az = ((pose?.azimuth ?? 45) * Math.PI) / 180;
  const el = ((pose?.elevation ?? 32) * Math.PI) / 180;
  const horiz = dist * Math.cos(el);
  return {
    position: [cx + horiz * Math.sin(az), dist * Math.sin(el), cz + horiz * Math.cos(az)] as [
      number,
      number,
      number,
    ],
    target: [cx, 0, cz] as [number, number, number],
  };
}

export function sunPosition(
  cx: number,
  cz: number,
  span: number,
  light?: { azimuth?: number; elevation?: number; distance?: number },
) {
  const r = Math.max(24, span * 0.85) * (light?.distance ?? 1);
  const az = ((light?.azimuth ?? 62) * Math.PI) / 180;
  const el = ((light?.elevation ?? 56) * Math.PI) / 180;
  const horiz = r * Math.cos(el);
  return [
    cx + horiz * Math.sin(az),
    Math.max(12, r * Math.sin(el)),
    cz + horiz * Math.cos(az),
  ] as [number, number, number];
}

export { translateRing };
