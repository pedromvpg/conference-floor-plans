"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { closeRing } from "@/lib/geometry";
import type { Ring } from "@/lib/types";
import { ColorOrMap } from "./materials";

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

export function PolygonSlab({
  ring,
  thickness,
  y,
  color,
  mapUrl,
  selected,
}: {
  ring: Ring;
  thickness: number;
  y: number;
  color: string;
  mapUrl?: string;
  selected?: boolean;
}) {
  const geom = useMemo(() => slabGeometry(ring, thickness), [ring, thickness]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geom), [geom]);
  return (
    <group>
      <mesh geometry={geom} position={[0, y, 0]}>
        <ColorOrMap color={color} url={mapUrl} />
      </mesh>
      {selected ? (
        <lineSegments geometry={edges} position={[0, y + thickness + 0.01, 0]}>
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
