"use client";

import { Suspense } from "react";
import { facingObb, yawRad } from "@/lib/hall";
import { darkenHex, FLOOR_PLATE_HEX } from "@/lib/colors";
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
  const wallColor = darkenHex(rugColor, 0.32);
  const floorUrl = fillUrl || rugUrl;
  const floorFit = fillUrl ? "cover" : "repeat";
  const tvs = wallTvs(obb.w, wallH);
  const logoY = tvs.length ? Math.max(0.55, tvs[0].y - tvs[0].h / 2 - 0.45) : 1.45;
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
      <Suspense fallback={<PolygonSlab ring={ring} thickness={0.05} y={0.04} color={FLOOR_PLATE_HEX} selected={selected} />}>
          <PolygonSlab
            ring={ring}
            thickness={0.05}
            y={0.04}
            color={FLOOR_PLATE_HEX}
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
        {tvs.map((tv) => (
          <WallTv key={tv.x} x={tv.x} y={tv.y} width={tv.w} height={tv.h} z={obb.backZ + 0.14} />
        ))}
        {logoUrl && obb.w >= 1.4 ? (
          <Suspense fallback={null}>
            <LogoDecal url={logoUrl} width={Math.min(1.2, obb.w * 0.32)} z={obb.backZ + 0.13} y={logoY} />
          </Suspense>
        ) : null}
        <FrontChevron depth={obb.d} selected={selected} />
      </group>
    </group>
  );
}

function wallTvs(width: number, wallH: number) {
  const count = width >= 5.5 ? 2 : 1;
  const gap = 0.28;
  const tvW = Math.min(2.15, Math.max(0.72, (width - 0.7 - gap * (count - 1)) / Math.max(count, 1) * 0.55));
  const tvH = tvW * (9 / 16);
  const y = Math.min(wallH - tvH / 2 - 0.18, Math.max(tvH / 2 + 0.85, wallH * 0.62));
  const span = (count - 1) * (tvW + gap);
  return Array.from({ length: count }, (_, i) => ({
    x: -span / 2 + i * (tvW + gap),
    y,
    w: tvW,
    h: tvH,
  }));
}

function WallTv({ x, y, z, width, height }: { x: number; y: number; z: number; width: number; height: number }) {
  const bezel = 0.045;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <boxGeometry args={[width + bezel * 2, height + bezel * 2, 0.04]} />
        <meshStandardMaterial color="#111111" roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#1a2330" emissive="#243044" emissiveIntensity={0.55} roughness={0.2} />
      </mesh>
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
