"use client";

import { Suspense } from "react";
import { chairLodDistance } from "@/lib/exhibit-kits";
import type { ExhibitKitKind } from "@/lib/types";
import { facingObb, yawRad } from "@/lib/hall";
import type { Ring } from "@/lib/types";
import { ColorOrMap, FrontChevron } from "./geom";
import { StageSeating } from "./StageSeating";

export function StageKit({
  ring,
  facingDeg,
  color,
  fillUrl: _fillUrl,
  logoUrl,
  selected,
  cuboid = false,
  wallHeight = 4.2,
  platformHeight = 0.9,
  kitKind = "main_stage",
}: {
  ring: Ring;
  facingDeg: number;
  color: string;
  fillUrl?: string;
  logoUrl?: string;
  selected: boolean;
  cuboid?: boolean;
  wallHeight?: number;
  platformHeight?: number;
  kitKind?: ExhibitKitKind | null;
}) {
  const obb = facingObb(ring, facingDeg);
  const wallH = selected ? wallHeight + 0.4 : wallHeight;
  const deck = Math.max(0.85, platformHeight);
  const isMain = kitKind !== "secondary_stage";
  const platformD = isMain
    ? Math.max(3.8, Math.min(6.8, obb.d * 0.5))
    : Math.max(1.6, Math.min(3.2, obb.d * 0.36));
  const aisle = isMain ? 2.2 : 1.2;
  const rugD = Math.max(2.8, obb.d - platformD);
  const platformZ = obb.backZ + platformD / 2;
  const rugZ = obb.backZ + platformD + rugD / 2;
  const seatStartZ = obb.backZ + platformD + aisle;
  if (cuboid) {
    const height = wallH + deck;
    return (
      <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[obb.w, height, obb.d]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
      <mesh position={[0, deck / 2, platformZ]} castShadow receiveShadow>
        <boxGeometry args={[obb.w, deck, platformD]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.03, rugZ]} receiveShadow>
        <boxGeometry args={[obb.w * 0.98, 0.06, rugD]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[obb.backX, deck + wallH / 2, obb.backZ + 0.09]} castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.6, obb.w - 0.08), wallH, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {logoUrl && obb.w >= 2 ? (
        <Suspense fallback={null}>
          <LogoDecal url={logoUrl} width={Math.min(3.2, obb.w * 0.45)} z={obb.backZ + 0.2} y={deck + wallH * 0.55} />
        </Suspense>
      ) : null}
      <StageSeating
        width={obb.w * 0.9}
        startZ={seatStartZ}
        depth={Math.max(2.2, rugD - aisle - 0.25)}
        lodDistance={chairLodDistance(kitKind)}
        color={color}
        enabled
      />
      <FrontChevron depth={obb.d} selected={selected} />
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
