"use client";

import { Suspense } from "react";
import { chairLodDistance } from "@/lib/exhibit-kits";
import { stageSeatPlan } from "@/lib/stage-seating";
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
  const { platformD, aisle, rugD, seatW, rugW, seatDepth, banks, platformW, wallW } = stageSeatPlan(
    kitKind,
    obb.w,
    obb.d,
  );
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
          <boxGeometry args={[platformW, deck, platformD]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.03, rugZ]} receiveShadow>
        <boxGeometry args={[rugW, 0.06, rugD]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[obb.backX, deck + wallH / 2, obb.backZ + 0.09]} castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.6, wallW - 0.08), wallH, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {logoUrl && obb.w >= 2 ? (
        <Suspense fallback={null}>
          <LogoDecal url={logoUrl} width={Math.min(3.2, wallW * 0.45)} z={obb.backZ + 0.2} y={deck + wallH * 0.55} />
        </Suspense>
      ) : null}
      <StageSeating
        width={seatW}
        startZ={seatStartZ}
        depth={seatDepth}
        lodDistance={chairLodDistance(kitKind)}
        color={color}
        enabled
        banks={banks}
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
