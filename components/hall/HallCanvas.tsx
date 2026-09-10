"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useTheme } from "@/components/theme-provider";
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
  showRulers?: boolean;
  orthographic?: boolean;
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
  showRulers = false,
  orthographic = false,
}: HallCanvasProps) {
  const { resolvedTheme } = useTheme();
  const tone: MapTone = resolvedTheme === "light" ? "light" : "dark";
  const hall = HALL_THEME[tone];
  const [spacePan, setSpacePan] = useState(false);
  const [navLocked, setNavLocked] = useState(false);
  const placing = mode === "edit" && tool !== "select" && tool !== "calibrate";
  const extent = useMemo(() => hallExtent(floor, objects), [floor, objects]);
  const controlsRef = useRef<ComponentRef<typeof MapControls>>(null);
  const orbitTarget = useRef(new THREE.Vector3(extent.cx, 0, extent.cy));

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
    showRulers,
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
        <HallCamera orthographic={orthographic} targetRef={orbitTarget} />
        <OrbitTargetKeep controlsRef={controlsRef} targetRef={orbitTarget} />
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
          minZoom={0.15}
          maxZoom={80}
          enabled={!navLocked && !placing}
        />
        <CameraRig controlsRef={controlsRef} focus={focus} nonce={camNonce} orthographic={orthographic} />
        <RestoreOrbitTarget controlsRef={controlsRef} targetRef={orbitTarget} />
      </Canvas>
    </div>
  );
}

const HALL_FOV = 42;
const HALL_NEAR = 0.08;
const HALL_FAR = 800;
const HALL_MIN_DIST = 6;
const HALL_MAX_DIST = 280;

function halfFovTan() {
  return Math.tan((HALL_FOV * Math.PI) / 360);
}

function orthoZoomForSpan(span: number, viewH: number) {
  return viewH / Math.max(span * 1.15, 8);
}

function applyOrthoFrustum(cam: THREE.OrthographicCamera, width: number, height: number) {
  cam.left = width / -2;
  cam.right = width / 2;
  cam.top = height / 2;
  cam.bottom = height / -2;
  cam.near = HALL_NEAR;
  cam.far = HALL_FAR;
  cam.updateProjectionMatrix();
}

function matchProjection(
  from: THREE.Camera,
  to: THREE.Camera,
  target: THREE.Vector3,
  viewH: number,
) {
  to.position.copy(from.position);
  to.quaternion.copy(from.quaternion);
  to.up.copy(from.up);
  const dist = Math.max(from.position.distanceTo(target), 0.01);
  if (to instanceof THREE.OrthographicCamera && from instanceof THREE.PerspectiveCamera) {
    to.zoom = viewH / Math.max(2 * halfFovTan() * dist, 1);
    to.updateProjectionMatrix();
    return;
  }
  if (to instanceof THREE.PerspectiveCamera && from instanceof THREE.OrthographicCamera) {
    const visibleH = viewH / Math.max(from.zoom, 0.001);
    const nextDist = THREE.MathUtils.clamp(visibleH / (2 * halfFovTan()), HALL_MIN_DIST, HALL_MAX_DIST);
    const dir = from.position.clone().sub(target);
    if (dir.lengthSq() > 1e-8) {
      dir.setLength(nextDist);
      to.position.copy(target).add(dir);
    }
    to.updateProjectionMatrix();
  }
}

function OrbitTargetKeep({
  controlsRef,
  targetRef,
}: {
  controlsRef: RefObject<ComponentRef<typeof MapControls> | null>;
  targetRef: RefObject<THREE.Vector3>;
}) {
  useFrame(() => {
    const c = controlsRef.current;
    if (c) targetRef.current.copy(c.target);
  });
  return null;
}

function RestoreOrbitTarget({
  controlsRef,
  targetRef,
}: {
  controlsRef: RefObject<ComponentRef<typeof MapControls> | null>;
  targetRef: RefObject<THREE.Vector3>;
}) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.target.copy(targetRef.current);
    c.update();
  }, [camera, controlsRef, targetRef]);
  return null;
}

function HallCamera({
  orthographic,
  targetRef,
}: {
  orthographic: boolean;
  targetRef: RefObject<THREE.Vector3>;
}) {
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const persp = useRef<THREE.PerspectiveCamera | null>(null);
  const ortho = useRef<THREE.OrthographicCamera | null>(null);
  const lastOrtho = useRef<boolean | null>(null);

  if (!persp.current) persp.current = new THREE.PerspectiveCamera(HALL_FOV, 1, HALL_NEAR, HALL_FAR);
  if (!ortho.current) ortho.current = new THREE.OrthographicCamera(-1, 1, 1, -1, HALL_NEAR, HALL_FAR);

  useLayoutEffect(() => {
    const p = persp.current!;
    const o = ortho.current!;
    p.aspect = size.width / Math.max(size.height, 1);
    p.updateProjectionMatrix();
    applyOrthoFrustum(o, size.width, size.height);

    const current = get().camera;
    const next = orthographic ? o : p;
    const swapped = lastOrtho.current !== null && lastOrtho.current !== orthographic;

    if (lastOrtho.current === null) {
      if (!orthographic && current instanceof THREE.PerspectiveCamera) {
        persp.current = current;
        lastOrtho.current = false;
        current.fov = HALL_FOV;
        current.near = HALL_NEAR;
        current.far = HALL_FAR;
        current.aspect = size.width / Math.max(size.height, 1);
        current.updateProjectionMatrix();
        return;
      }
      next.position.copy(current.position);
      next.quaternion.copy(current.quaternion);
      next.up.copy(current.up);
      if (orthographic && current instanceof THREE.PerspectiveCamera) {
        matchProjection(current, next, targetRef.current, size.height);
      }
    } else if (swapped && current !== next) {
      matchProjection(current, next, targetRef.current, size.height);
    }

    lastOrtho.current = orthographic;
    if (get().camera !== next) set({ camera: next });
  }, [get, orthographic, set, size.height, size.width, targetRef]);

  return null;
}

function CameraRig({
  controlsRef,
  focus,
  nonce,
  orthographic,
}: {
  controlsRef: RefObject<ComponentRef<typeof MapControls> | null>;
  focus: { cx: number; cz: number; span: number };
  nonce: number;
  orthographic: boolean;
}) {
  const size = useThree((s) => s.size);
  const anim = useRef(0);
  const fromP = useRef(new THREE.Vector3());
  const fromT = useRef(new THREE.Vector3());
  const toP = useRef(new THREE.Vector3());
  const toT = useRef(new THREE.Vector3());
  const fromZoom = useRef(1);
  const toZoom = useRef(1);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const pose = isometricPose(focus.cx, focus.cz, focus.span);
    fromP.current.copy(c.object.position);
    fromT.current.copy(c.target);
    toP.current.set(...pose.position);
    toT.current.set(...pose.target);
    if (c.object instanceof THREE.OrthographicCamera) {
      fromZoom.current = c.object.zoom;
      toZoom.current = orthoZoomForSpan(focus.span, size.height);
    }
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
    if (orthographic && c.object instanceof THREE.OrthographicCamera) {
      c.object.zoom = fromZoom.current + (toZoom.current - fromZoom.current) * k;
      c.object.updateProjectionMatrix();
    }
    c.update();
  });
  return null;
}

export default HallCanvas;
