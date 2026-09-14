"use client";

import { Suspense } from "react";
import { facingObb, yawRad } from "@/lib/hall";
import type { Ring } from "@/lib/types";
import { FrontChevron, PolygonSlab } from "./geom";

export function KioskKit({
  ring,
  facingDeg,
  color,
  selected,
  cuboid = false,
  wallHeight = 2.2,
}: {
  ring: Ring;
  facingDeg: number;
  color: string;
  selected: boolean;
  cuboid?: boolean;
  wallHeight?: number;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? wallHeight + 0.12 : wallHeight;
  const plateY = 0.03;
  const plateThickness = 0.04;
  const plateTop = plateY + plateThickness;
  if (cuboid) {
    return (
      <PolygonSlab ring={ring} thickness={wallH} y={0} color={color} selected={selected} facingDeg={facingDeg} />
    );
  }
  const bodyW = Math.min(0.9, Math.max(0.45, obb.w * 0.42));
  const bodyD = Math.min(0.38, Math.max(0.22, obb.d * 0.22));
  const z = obb.backZ + bodyD / 2 + 0.06;
  return (
    <group>
      <Suspense fallback={<PolygonSlab ring={ring} thickness={plateThickness} y={plateY} color={color} selected={selected} />}>
        <PolygonSlab ring={ring} thickness={plateThickness} y={plateY} color={color} selected={selected} facingDeg={facingDeg} />
      </Suspense>
      <group position={[obb.cx, plateTop, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[0, wallH / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[bodyW, wallH, bodyD]} />
          <meshStandardMaterial color={color} roughness={0.62} />
        </mesh>
        <FrontChevron depth={obb.d} selected={selected} />
      </group>
    </group>
  );
}
