"use client";

import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useTheme } from "next-themes";
import { HALL_THEME, type MapTone } from "@/lib/colors";
import { isometricPose } from "@/lib/hall";
import type {
  AmenityType,
  Appearance,
  Floor,
  LibraryAsset,
  MapObject,
  PinKind,
  Sponsor,
  Tool,
  Units,
} from "@/lib/types";
import { HallScene, hallExtent, hallFocus, type HallSceneProps } from "./HallScene";

export type HallCanvasProps = {
  mode: "edit" | "view";
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  assets?: LibraryAsset[];
  selectedId: string | null;
  highlightId?: string | null;
  tool?: Tool;
  units?: Units;
  amenityStamp?: AmenityType;
  pinKind?: PinKind;
  presetMeters?: { w: number; d: number } | null;
  stampAppearance?: Appearance | null;
  stampModelAssetId?: string | null;
  onSelect?: (id: string | null) => void;
  onChangeObject?: (obj: MapObject) => void;
  onCreateObject?: (obj: MapObject) => void;
  frameNonce?: number;
  fitNonce?: number;
  showGrid?: boolean;
};

export function HallCanvas({
  mode,
  floor,
  objects,
  sponsors,
  assets = [],
  selectedId,
  highlightId,
  tool = "select",
  units = "m",
  amenityStamp = "info",
  pinKind = "amenity",
  presetMeters = null,
  stampAppearance = null,
  stampModelAssetId = null,
  onSelect,
  onChangeObject,
  onCreateObject,
  frameNonce = 0,
  fitNonce = 0,
  showGrid = mode === "edit",
}: HallCanvasProps) {
  const { resolvedTheme } = useTheme();
  const tone: MapTone = resolvedTheme === "light" ? "light" : "dark";
  const hall = HALL_THEME[tone];
  const [spacePan, setSpacePan] = useState(false);
  const [navLocked, setNavLocked] = useState(false);
  const placing = mode === "edit" && tool !== "select" && tool !== "calibrate";
  const extent = useMemo(() => hallExtent(floor, objects), [floor, objects]);
  const controlsRef = useRef<ComponentRef<typeof MapControls>>(null);

  const [camNonce, setCamNonce] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(highlightId ?? null);

  useEffect(() => {
    setFocusId(highlightId ?? null);
    if (highlightId) setCamNonce((n) => n + 1);
  }, [highlightId]);

  useEffect(() => {
    setFocusId(selectedId);
    setCamNonce((n) => n + 1);
  }, [frameNonce]);

  useEffect(() => {
    setFocusId(null);
    setCamNonce((n) => n + 1);
  }, [fitNonce]);

  useEffect(() => {
    if (mode !== "view" || !selectedId) return;
    setFocusId(selectedId);
    setCamNonce((n) => n + 1);
  }, [mode, selectedId]);

  const focus = useMemo(
    () => hallFocus(objects, focusId, extent),
    [objects, focusId, extent],
  );

  useEffect(() => {
    if (mode === "view") return;
    function typing(el: EventTarget | null) {
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    }
    function clearSpace() {
      setSpacePan(false);
    }
    function onDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat || typing(e.target)) return;
      e.preventDefault();
      setSpacePan(true);
    }
    function onUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      clearSpace();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clearSpace);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clearSpace);
    };
  }, [mode]);

  const sceneProps: HallSceneProps = {
    mode,
    floor,
    objects,
    sponsors,
    assets,
    selectedId,
    highlightId,
    tool,
    units,
    amenityStamp,
    pinKind,
    presetMeters,
    stampAppearance,
    stampModelAssetId,
    onSelect,
    onChangeObject,
    onCreateObject,
    onNavLock: setNavLocked,
    spacePan,
    tone,
    showGrid,
  };

  return (
    <div className="absolute inset-0 h-full w-full bg-[var(--map-bg)]">
      <Canvas
        gl={{ antialias: true }}
        camera={{ fov: 42, near: 0.08, far: 800, position: isometricPose(extent.cx, extent.cy, Math.max(extent.w, extent.h)).position }}
        onPointerMissed={() => {
          if (!placing && !spacePan) onSelect?.(null);
        }}
      >
        <color attach="background" args={[hall.bg]} />
        <fog attach="fog" args={[hall.bg, 55, 220]} />
        <hemisphereLight args={[hall.sky, hall.ground, 0.85]} />
        <ambientLight intensity={tone === "light" ? 0.45 : 0.22} />
        <directionalLight position={[48, 70, 28]} intensity={tone === "light" ? 0.95 : 1.15} />
        <HallScene {...sceneProps} />
        <MapControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.12}
          screenSpacePanning
          enablePan={mode === "view" || spacePan}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2 - 0.08}
          minDistance={6}
          maxDistance={280}
          enabled={!navLocked && !placing}
        />
        <CameraRig controlsRef={controlsRef} focus={focus} nonce={camNonce} />
      </Canvas>
    </div>
  );
}

function CameraRig({
  controlsRef,
  focus,
  nonce,
}: {
  controlsRef: RefObject<ComponentRef<typeof MapControls> | null>;
  focus: { cx: number; cz: number; span: number };
  nonce: number;
}) {
  const anim = useRef(0);
  const fromP = useRef(new THREE.Vector3());
  const fromT = useRef(new THREE.Vector3());
  const toP = useRef(new THREE.Vector3());
  const toT = useRef(new THREE.Vector3());

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const pose = isometricPose(focus.cx, focus.cz, focus.span);
    fromP.current.copy(c.object.position);
    fromT.current.copy(c.target);
    toP.current.set(...pose.position);
    toT.current.set(...pose.target);
    anim.current = 1;
    // Animate only when nonce changes (fit / frame / floor), not when the hall is dragged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useFrame((_, dt) => {
    if (anim.current <= 0) return;
    const c = controlsRef.current;
    if (!c) return;
    anim.current = Math.max(0, anim.current - dt / 0.45);
    const t = 1 - anim.current;
    const k = t * t * (3 - 2 * t);
    c.object.position.lerpVectors(fromP.current, toP.current, k);
    c.target.lerpVectors(fromT.current, toT.current, k);
    c.update();
  });
  return null;
}

export default HallCanvas;
