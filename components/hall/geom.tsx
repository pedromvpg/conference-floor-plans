"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { closeRing, ringBounds, ringCentroid, rotateRing } from "@/lib/geometry";
import type { Ring } from "@/lib/types";
import { ColorOrMap, type MapFit } from "./materials";

export { ColorOrMap } from "./materials";

export function slabGeometry(ring: Ring, thickness: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const closed = closeRing(ring);
  const pts = closed.length > 1 ? closed.slice(0, -1) : closed;
  // Extrude in XY, then rotateX(-90°) maps (x, y, z) → (x, z, -y). Flip shape Y
  // (and reverse winding) so map Y becomes +Z, matching worldToThree / kits.
  const xz = [...pts].reverse().map(([x, y]) => [x, -y] as [number, number]);
  xz.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  if (xz.length) shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function applyCoverUvs(geom: THREE.BufferGeometry, ring: Ring, facingDeg: number) {
  const local = rotateRing(ring, -facingDeg);
  const b = ringBounds(local);
  const pos = geom.getAttribute("position");
  if (!pos || !(b.w > 0) || !(b.h > 0)) return;
  const uv = new Float32Array(pos.count * 2);
  const rad = (-facingDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const { x: cx, y: cy } = ringCentroid(ring);
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - cx;
    const dy = pos.getZ(i) - cy;
    const lx = cx + dx * cos - dy * sin;
    const ly = cy + dx * sin + dy * cos;
    uv[i * 2] = (lx - b.minX) / b.w;
    uv[i * 2 + 1] = 1 - (ly - b.minY) / b.h;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export function PolygonSlab({
  ring,
  thickness,
  y,
  color,
  mapUrl,
  mapFit = "repeat",
  facingDeg = 0,
  selected,
}: {
  ring: Ring;
  thickness: number;
  y: number;
  color: string;
  mapUrl?: string;
  mapFit?: MapFit;
  facingDeg?: number;
  selected?: boolean;
}) {
  const shadowMode = thickness < 0.5 ? "receive" : "both";
  const geom = useMemo(() => {
    const g = slabGeometry(ring, thickness);
    if (mapFit === "cover") applyCoverUvs(g, ring, facingDeg);
    return g;
  }, [ring, thickness, mapFit, facingDeg]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geom), [geom]);
  const aspect = useMemo(() => {
    const local = rotateRing(ring, -facingDeg);
    const b = ringBounds(local);
    return b.h > 0 ? b.w / b.h : 1;
  }, [ring, facingDeg]);
  return (
    <group>
      <mesh geometry={geom} position={[0, y, 0]} userData={{ shadowMode }} castShadow={shadowMode === "both"} receiveShadow>
        <ColorOrMap color={color} url={mapUrl} fit={mapFit} aspect={aspect} />
      </mesh>
      {selected ? (
        <lineSegments geometry={edges} position={[0, y, 0]}>
          <lineBasicMaterial color="#f97316" />
        </lineSegments>
      ) : null}
    </group>
  );
}

export function FrontChevron({ depth, selected }: { depth: number; selected: boolean }) {
  if (!selected) return null;
  return (
    <mesh position={[0, 0.08, depth * 0.18]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.32, 0.78, 3]} />
      <meshBasicMaterial color="#f97316" />
    </mesh>
  );
}
