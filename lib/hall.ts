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
};

export function facingObb(ring: Ring, facingDeg: number): FacingObb {
  const { x: cx, y: cy } = ringCentroid(ring);
  const local = rotateRing(ring, -facingDeg);
  const b = ringBounds(local);
  return { cx, cy, w: Math.max(0.4, b.w), d: Math.max(0.4, b.h), facingDeg };
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
  };
}

export function isometricPose(cx: number, cz: number, span: number) {
  const dist = Math.max(16, span * 0.85);
  return {
    position: [cx + dist * 0.72, dist * 0.62, cz + dist * 0.72] as [number, number, number],
    target: [cx, 0, cz] as [number, number, number],
  };
}

export { translateRing };
