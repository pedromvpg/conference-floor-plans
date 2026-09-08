"use client";

import { Suspense } from "react";
import { facingObb, yawRad } from "@/lib/hall";
import { darkenHex } from "@/lib/colors";
import type { Ring } from "@/lib/types";
import { ColorOrMap, FrontChevron, PolygonSlab } from "./geom";

export function BoothKit({
  ring,
  facingDeg,
  rugColor,
  rugUrl,
  wallUrl,
  logoUrl,
  selected,
}: {
  ring: Ring;
  facingDeg: number;
  rugColor: string;
  rugUrl?: string;
  wallUrl?: string;
  logoUrl?: string;
  selected: boolean;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? 2.7 : 2.5;
  const wallColor = darkenHex(rugColor, 0.32);
  return (
    <group>
      <Suspense fallback={<PolygonSlab ring={ring} thickness={0.05} y={0} color={rugColor} selected={selected} />}>
        <PolygonSlab
          ring={ring}
          thickness={0.05}
          y={0}
          color={rugColor}
          mapUrl={rugUrl}
          selected={selected}
        />
      </Suspense>
      <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[0, wallH / 2, -obb.d / 2 + 0.06]}>
          <boxGeometry args={[Math.max(0.4, obb.w - 0.08), wallH, 0.12]} />
          <Suspense fallback={<meshStandardMaterial color={wallColor} roughness={0.7} />}>
            <ColorOrMap color={wallColor} url={wallUrl} roughness={0.7} />
          </Suspense>
        </mesh>
        {logoUrl && obb.w >= 1.4 ? (
          <Suspense fallback={null}>
            <LogoDecal url={logoUrl} width={Math.min(1.6, obb.w * 0.55)} z={-obb.d / 2 + 0.13} y={1.45} />
          </Suspense>
        ) : null}
        <FrontChevron depth={obb.d} selected={selected} />
      </group>
    </group>
  );
}

function LogoDecal({ url, width, z, y }: { url: string; width: number; z: number; y: number }) {
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[width, width * 0.45]} />
      <ColorOrMap color="#ffffff" url={url} roughness={0.55} />
    </mesh>
  );
}
