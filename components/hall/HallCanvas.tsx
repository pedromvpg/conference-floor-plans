"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useTheme } from "@/components/theme-provider";
import { HALL_THEME, type MapTone } from "@/lib/colors";
import { isometricPose, sunPosition } from "@/lib/hall";
import { DEFAULT_HALL_VIEW, fogRange } from "@/lib/hall-view";
import { ApplyMeshShadows, HallAO, HallEnvironment, HallPathTrace } from "./HallLook";
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
  venueNonce?: number;
  showGrid?: boolean;
  showRulers?: boolean;
  orthographic?: boolean;
  cuboids?: boolean;
  fog?: boolean;
  fogIntensity?: number;
  ao?: boolean;
  shadows?: boolean;
  environment?: boolean;
  pathTracing?: boolean;
  azimuth?: number;
  elevation?: number;
  distance?: number;
  lightAzimuth?: number;
  lightElevation?: number;
  lightDistance?: number;
  lightIntensity?: number;
  fill?: number;
  venueSvg?: string | null;
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
  venueNonce = 0,
  showGrid = mode === "edit",
  showRulers = false,
  orthographic = false,
  cuboids = false,
  fog = DEFAULT_HALL_VIEW.fog,
  fogIntensity = DEFAULT_HALL_VIEW.fogIntensity,
  ao = false,
  shadows = false,
  environment = false,
  pathTracing = false,
  azimuth = DEFAULT_HALL_VIEW.azimuth,
  elevation = DEFAULT_HALL_VIEW.elevation,
  distance = DEFAULT_HALL_VIEW.distance,
  lightAzimuth = DEFAULT_HALL_VIEW.lightAzimuth,
  lightElevation = DEFAULT_HALL_VIEW.lightElevation,
  lightDistance = DEFAULT_HALL_VIEW.lightDistance,
  lightIntensity = DEFAULT_HALL_VIEW.lightIntensity,
  fill = DEFAULT_HALL_VIEW.fill,
  venueSvg,
}: HallCanvasProps) {
  const { resolvedTheme } = useTheme();
  const tone: MapTone = resolvedTheme === "light" ? "light" : "dark";
  const hall = HALL_THEME[tone];
  const [fetchedSvg, setFetchedSvg] = useState<string | null>(null);
  useEffect(() => {
    if (venueSvg !== undefined) return;
    const url = floor.underlayUrl;
    if (!url) {
      setFetchedSvg(null);
      return;
    }
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("drawing"))))
      .then((text) => {
        if (cancelled || !text.includes("<svg")) return;
        setFetchedSvg(text);
      })
      .catch(() => {
        if (!cancelled) setFetchedSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [venueSvg, floor.underlayUrl]);

  const [spacePan, setSpacePan] = useState(false);
  const [navLocked, setNavLocked] = useState(false);
  const placing = mode === "edit" && tool !== "select" && tool !== "calibrate";
  const extent = useMemo(() => hallExtent(floor, objects), [floor, objects]);
  const controlsRef = useRef<ComponentRef<typeof MapControls>>(null);
  const orbitTarget = useRef(new THREE.Vector3(extent.cx, 0, extent.cy));

  const [camNonce, setCamNonce] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const prevSelectedId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setFocusId(highlightId ?? null);
    if (highlightId) setCamNonce((n) => n + 1);
  }, [highlightId]);

  const seenFrameNonce = useRef(frameNonce);
  const seenFitNonce = useRef(fitNonce);

  useEffect(() => {
    if (frameNonce === seenFrameNonce.current) return;
    seenFrameNonce.current = frameNonce;
    if (!frameNonce) return;
    setFocusId(selectedId);
    setCamNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameNonce]);

  useEffect(() => {
    if (fitNonce === seenFitNonce.current) return;
    seenFitNonce.current = fitNonce;
    if (!fitNonce) return;
    setFocusId(null);
    setCamNonce((n) => n + 1);
  }, [fitNonce]);

  useEffect(() => {
    if (!venueNonce) return;
    setFocusId(null);
    setCamNonce((n) => n + 1);
  }, [venueNonce]);

  useEffect(() => {
    const prev = prevSelectedId.current;
    prevSelectedId.current = selectedId;
    if (mode !== "view" || !selectedId) return;
    if (prev === undefined || prev === selectedId) return;
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
    cuboids,
    venueSvg: venueSvg !== undefined ? venueSvg : fetchedSvg,
  };

  const span = Math.max(extent.w, extent.h, 24);
  const shaded = shadows && !pathTracing;
  const occlude = ao && !pathTracing;
  const envLit = environment || pathTracing;
  const pose = { azimuth, elevation, distance };
  const startPose = isometricPose(extent.cx, extent.cy, Math.max(extent.w, extent.h), pose);
  const sun = sunPosition(extent.cx, extent.cy, span, {
    azimuth: lightAzimuth,
    elevation: lightElevation,
    distance: lightDistance,
  });
  const haze = fogRange(span, fogIntensity);
  const fillMul = Math.max(0, fill);
  const sunMul = Math.max(0, lightIntensity);

  return (
    <div className="absolute inset-0 h-full w-full bg-[var(--map-bg)]">
      <Canvas
        shadows={shaded ? "percentage" : false}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: envLit ? 0.95 : 1 }}
        camera={{ fov: 42, near: 0.08, far: 800, position: startPose.position }}
        onPointerMissed={() => {
          if (!placing && !spacePan) onSelect?.(null);
        }}
      >
        <HallPathTrace
          enabled={pathTracing}
          sceneKey={`${floor.id}:${cuboids ? "c" : "w"}:${orthographic ? "o" : "p"}:${objects.length}`}
        >
          <color attach="background" args={[hall.bg]} />
          <HallFog enabled={fog && !pathTracing} color={hall.bg} near={haze.near} far={haze.far} />
          <HallEnvironment enabled={envLit} />
          <hemisphereLight args={[hall.sky, hall.ground, (shaded || envLit ? 0.28 : 0.85) * fillMul]} />
          <ambientLight intensity={(tone === "light" ? (shaded || envLit ? 0.16 : 0.45) : shaded || envLit ? 0.08 : 0.22) * fillMul} />
          <directionalLight
            castShadow={shaded}
            position={sun}
            intensity={(tone === "light" ? (shaded ? 1.35 : 0.95) : shaded ? 1.55 : 1.15) * sunMul}
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0002}
            shadow-normalBias={0.035}
            shadow-camera-near={1}
            shadow-camera-far={span * 4}
            shadow-camera-left={-span * 0.9}
            shadow-camera-right={span * 0.9}
            shadow-camera-top={span * 0.9}
            shadow-camera-bottom={-span * 0.9}
          />
          <HallScene {...sceneProps} />
          <ApplyMeshShadows enabled={shaded} revision={objects.length} />
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
          <CameraRig
            controlsRef={controlsRef}
            focus={focus}
            nonce={camNonce}
            orthographic={orthographic}
            pose={pose}
          />
          <RestoreOrbitTarget controlsRef={controlsRef} targetRef={orbitTarget} />
          <HallAO enabled={occlude} />
        </HallPathTrace>
      </Canvas>
    </div>
  );
}

function HallFog({
  enabled,
  color,
  near,
  far,
}: {
  enabled: boolean;
  color: string;
  near: number;
  far: number;
}) {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    if (!enabled) scene.fog = null;
  }, [enabled, scene]);
  if (!enabled) return null;
  return <fog attach="fog" args={[color, near, far]} />;
}

const HALL_FOV = 42;
const HALL_NEAR = 0.08;
const HALL_ORTHO_NEAR = -800;
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
  cam.near = HALL_ORTHO_NEAR;
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
  if (!ortho.current) ortho.current = new THREE.OrthographicCamera(-1, 1, 1, -1, HALL_ORTHO_NEAR, HALL_FAR);

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
  pose,
}: {
  controlsRef: RefObject<ComponentRef<typeof MapControls> | null>;
  focus: { cx: number; cz: number; span: number };
  nonce: number;
  orthographic: boolean;
  pose: { azimuth: number; elevation: number; distance: number };
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
    const next = isometricPose(focus.cx, focus.cz, focus.span, pose);
    fromP.current.copy(c.object.position);
    fromT.current.copy(c.target);
    toP.current.set(...next.position);
    toT.current.set(...next.target);
    if (c.object instanceof THREE.OrthographicCamera) {
      fromZoom.current = c.object.zoom;
      toZoom.current = orthoZoomForSpan(focus.span, size.height);
    }
    anim.current = 1;
    // Animate only when nonce changes (fit / frame / floor), not when the hall is dragged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useLayoutEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const next = isometricPose(focus.cx, focus.cz, focus.span, pose);
    c.object.position.set(...next.position);
    c.target.set(...next.target);
    if (orthographic && c.object instanceof THREE.OrthographicCamera) {
      c.object.zoom = orthoZoomForSpan(focus.span, size.height);
      c.object.updateProjectionMatrix();
    }
    c.update();
    anim.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose.azimuth, pose.elevation, pose.distance]);

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
