"use client";

import { useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { BoothKit } from "./BoothKit";
import { KioskKit } from "./KioskKit";
import { StageKit } from "./StageKit";
import { useTheme } from "@/components/theme-provider";
import { boothFillHex, FLOOR_PLATE_HEX, HALL_THEME, type MapTone } from "@/lib/colors";
import { kitAppearance, rectRingFromKit } from "@/lib/exhibit-kits";
import { stageKitBreakdown } from "@/lib/stage-seating";
import type { ExhibitKit } from "@/lib/types";
import "@/lib/three-timer-clock";

function Aim({ y }: { y: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.lookAt(0, y, 0);
  }, [camera, y]);
  return null;
}

export function KitPreview({ kit }: { kit: ExhibitKit }) {
  const { resolvedTheme } = useTheme();
  const tone: MapTone = resolvedTheme === "light" ? "light" : "dark";
  const hall = HALL_THEME[tone];
  const ring = rectRingFromKit(kit.widthM, kit.depthM);
  const look = kitAppearance(kit.kind);
  const span = Math.max(
    look === "stage" ? stageKitBreakdown(kit).totalW * 1.05 : kit.widthM,
    kit.depthM,
    4,
  );
  const aimY = (kit.platformHeightM ?? 0) + kit.wallHeightM * 0.35;
  const kitColor = boothFillHex(null, "", tone, "stage");
  return (
    <div className="h-48 overflow-hidden rounded-2xl border border-border" style={{ background: hall.bg }}>
      <Canvas
        className="h-full w-full"
        camera={{ fov: 38, near: 0.1, far: 200, position: [-span * 1.15, span * 0.55, span * 0.95] }}
      >
        <Aim y={aimY} />
        <color attach="background" args={[hall.bg]} />
        <hemisphereLight args={[hall.sky, hall.ground, tone === "light" ? 0.85 : 0.7]} />
        <ambientLight intensity={tone === "light" ? 0.55 : 0.35} />
        <directionalLight position={[8, 12, 6]} intensity={tone === "light" ? 0.75 : 0.9} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[span * 4, span * 4]} />
          <meshBasicMaterial color={FLOOR_PLATE_HEX} toneMapped={false} />
        </mesh>
        {look === "stage" ? (
          <StageKit
            ring={ring}
            facingDeg={0}
            color={kitColor}
            selected={false}
            wallHeight={kit.wallHeightM}
            platformHeight={kit.platformHeightM ?? 0.9}
            kitKind={kit.kind}
          />
        ) : look === "kiosk" ? (
          <KioskKit ring={ring} facingDeg={0} color={kitColor} selected={false} wallHeight={kit.wallHeightM} />
        ) : (
          <BoothKit ring={ring} facingDeg={0} rugColor={kitColor} selected={false} wallHeight={kit.wallHeightM} />
        )}
        <MapControls makeDefault enablePan={false} target={[0, aimY, 0]} minDistance={4} maxDistance={80} />
      </Canvas>
    </div>
  );
}
