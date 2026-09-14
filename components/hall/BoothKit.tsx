"use client";

import { Suspense } from "react";
import { facingObb, yawRad } from "@/lib/hall";
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
  wallHeight = 2.5,
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
  wallHeight?: number;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? wallHeight + 0.2 : wallHeight;
  const plateY = 0.04;
  const plateThickness = 0.05;
  const plateTop = plateY + plateThickness;
  const wallDepth = 0.22;
  const wallFront = obb.backZ + wallDepth;
  const floorUrl = fillUrl || rugUrl;
  const floorFit = fillUrl ? "cover" : "repeat";
  const logoY = wallH * 0.55;
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
      <Suspense fallback={<PolygonSlab ring={ring} thickness={plateThickness} y={plateY} color={rugColor} selected={selected} />}>
          <PolygonSlab
            ring={ring}
            thickness={plateThickness}
            y={plateY}
            color={rugColor}
            mapUrl={floorUrl}
            mapFit={floorFit}
            facingDeg={facingDeg}
            selected={selected}
          />
      </Suspense>
      <group position={[obb.cx, plateTop, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[obb.backX, wallH / 2, obb.backZ + wallDepth / 2]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(0.4, obb.w - 0.08), wallH, wallDepth]} />
          <Suspense fallback={<meshStandardMaterial color={rugColor} roughness={0.65} />}>
            <ColorOrMap color={rugColor} url={wallUrl} roughness={0.65} />
          </Suspense>
        </mesh>
        {logoUrl && obb.w >= 1.4 ? (
          <Suspense fallback={null}>
            <LogoDecal url={logoUrl} width={Math.min(1.2, obb.w * 0.32)} z={wallFront + 0.01} y={logoY} />
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
