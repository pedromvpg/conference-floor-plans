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
  fillUrl,
  wallUrl,
  logoUrl,
  selected,
  cuboid = false,
}: {
  ring: Ring;
  facingDeg: number;
  rugColor: string;
  rugUrl?: string;
  fillUrl?: string;
  wallUrl?: string;
  logoUrl?: string;
  selected: boolean;
  cuboid?: boolean;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? 2.7 : 2.5;
  const wallColor = darkenHex(rugColor, 0.32);
  const floorUrl = fillUrl || rugUrl;
  const floorFit = fillUrl ? "cover" : "repeat";
  if (cuboid) {
    return (
      <Suspense fallback={<PolygonSlab ring={ring} thickness={wallH} y={0} color={rugColor} selected={selected} />}>
        <PolygonSlab
          ring={ring}
          thickness={wallH}
          y={0}
          color={rugColor}
          mapUrl={floorUrl}
          mapFit={floorFit}
          facingDeg={facingDeg}
          selected={selected}
        />
      </Suspense>
    );
  }
  return (
    <group>
      <Suspense fallback={<PolygonSlab ring={ring} thickness={0.05} y={0} color={rugColor} selected={selected} />}>
        <PolygonSlab
          ring={ring}
          thickness={0.05}
          y={0}
          color={rugColor}
          mapUrl={floorUrl}
          mapFit={floorFit}
          facingDeg={facingDeg}
          selected={selected}
        />
      </Suspense>
      <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[obb.backX, wallH / 2, obb.backZ + 0.06]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(0.4, obb.w - 0.08), wallH, 0.12]} />
          <Suspense fallback={<meshStandardMaterial color={wallColor} roughness={0.7} />}>
            <ColorOrMap color={wallColor} url={wallUrl} roughness={0.7} />
          </Suspense>
        </mesh>
        {logoUrl && obb.w >= 1.4 ? (
          <Suspense fallback={null}>
            <LogoDecal url={logoUrl} width={Math.min(1.6, obb.w * 0.55)} z={obb.backZ + 0.13} y={1.45} />
          </Suspense>
        ) : null}
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
