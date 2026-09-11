"use client";

import { Suspense } from "react";
import { facingObb, yawRad } from "@/lib/hall";
import { darkenHex } from "@/lib/colors";
import type { Ring } from "@/lib/types";
import { ColorOrMap, FrontChevron, PolygonSlab } from "./geom";

export function StageKit({
  ring,
  facingDeg,
  color,
  fillUrl,
  logoUrl,
  selected,
  cuboid = false,
}: {
  ring: Ring;
  facingDeg: number;
  color: string;
  fillUrl?: string;
  logoUrl?: string;
  selected: boolean;
  cuboid?: boolean;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? 4.6 : 4.2;
  const wallColor = darkenHex(color, 0.4);
  const stepW = Math.min(1.8, obb.w / 3.2);
  if (cuboid) {
    const height = wallH + 0.4;
    return (
      <Suspense fallback={<PolygonSlab ring={ring} thickness={height} y={0} color={color} selected={selected} />}>
        <PolygonSlab
          ring={ring}
          thickness={height}
          y={0}
          color={color}
          mapUrl={fillUrl}
          mapFit={fillUrl ? "cover" : "repeat"}
          facingDeg={facingDeg}
          selected={selected}
        />
      </Suspense>
    );
  }
  return (
    <group>
      <Suspense fallback={<PolygonSlab ring={ring} thickness={0.4} y={0.04} color={color} selected={selected} />}>
        <PolygonSlab
          ring={ring}
          thickness={0.4}
          y={0.04}
          color={color}
          mapUrl={fillUrl}
          mapFit={fillUrl ? "cover" : "repeat"}
          facingDeg={facingDeg}
          selected={selected}
        />
      </Suspense>
      <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[obb.backX, wallH / 2 + 0.4, obb.backZ + 0.1]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(0.6, obb.w - 0.1), wallH, 0.18]} />
          <meshStandardMaterial color={wallColor} roughness={0.65} />
        </mesh>
        {logoUrl && obb.w >= 2 ? (
          <Suspense fallback={null}>
            <LogoDecal url={logoUrl} width={Math.min(3.2, obb.w * 0.45)} z={obb.backZ + 0.22} y={2.4} />
          </Suspense>
        ) : null}
        {[-obb.w * 0.28, 0, obb.w * 0.28].map((x) => (
          <mesh key={x} position={[x, 0.12, obb.d / 2 - 0.28]} castShadow receiveShadow>
            <boxGeometry args={[stepW, 0.24, 0.55]} />
            <meshStandardMaterial color={darkenHex(color, 0.18)} roughness={0.8} />
          </mesh>
        ))}
        <FrontChevron depth={obb.d} selected={selected} />
      </group>
    </group>
  );
}

function LogoDecal({ url, width, z, y }: { url: string; width: number; z: number; y: number }) {
  const h = width * 0.45;
  return (
    <group position={[0, y, z]}>
      <mesh>
        <planeGeometry args={[width, h]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[width * 0.92, h * 0.88]} />
        <ColorOrMap color="#ffffff" url={url} roughness={0.55} />
      </mesh>
    </group>
  );
}
