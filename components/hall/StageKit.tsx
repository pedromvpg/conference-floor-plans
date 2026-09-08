"use client";

import { facingObb, yawRad } from "@/lib/hall";
import { darkenHex } from "@/lib/colors";
import type { Ring } from "@/lib/types";
import { FrontChevron, PolygonSlab } from "./geom";

export function StageKit({
  ring,
  facingDeg,
  color,
  selected,
}: {
  ring: Ring;
  facingDeg: number;
  color: string;
  selected: boolean;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? 4.6 : 4.2;
  const wallColor = darkenHex(color, 0.4);
  const stepW = Math.min(1.8, obb.w / 3.2);
  return (
    <group>
      <PolygonSlab ring={ring} thickness={0.4} y={0} color={color} selected={selected} />
      <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[0, wallH / 2 + 0.4, -obb.d / 2 + 0.1]}>
          <boxGeometry args={[Math.max(0.6, obb.w - 0.1), wallH, 0.18]} />
          <meshStandardMaterial color={wallColor} roughness={0.65} />
        </mesh>
        {[-obb.w * 0.28, 0, obb.w * 0.28].map((x) => (
          <mesh key={x} position={[x, 0.12, obb.d / 2 - 0.28]}>
            <boxGeometry args={[stepW, 0.24, 0.55]} />
            <meshStandardMaterial color={darkenHex(color, 0.18)} roughness={0.8} />
          </mesh>
        ))}
        <FrontChevron depth={obb.d} selected={selected} />
      </group>
    </group>
  );
}
