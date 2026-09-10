"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Grid, useTexture } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { AMENITY_COLOR } from "@/lib/amenities";
import { hallDefaults, resolveAppearance } from "@/lib/appearance";
import { boothFillHex, HALL_THEME, type MapTone } from "@/lib/colors";
import { angleDeg, rectFromCenter, rectRing, ringBounds, rotateHandlePos, snapDeg, venueWorldRect } from "@/lib/geometry";
import { displayLogoUrl, objectUrls, snapWorld, yawRad } from "@/lib/hall";
import { commitShape, objectShape, rotateBezier, translateBezier } from "@/lib/bezier";
import { stampPinObject, newMapObject } from "@/lib/new-object";
import { gridSize } from "@/lib/units";
import type {
  AmenityType,
  Appearance,
  Floor,
  LibraryAsset,
  MapObject,
  PinKind,
  Ring,
  Sponsor,
  Tool,
  Units,
} from "@/lib/types";
import { isPinObject, isMapPinObject, MAP_PIN_META } from "@/lib/types";
import { BoothKit } from "./BoothKit";
import { CustomModel } from "./CustomModel";
import { HallRulers } from "./HallRulers";
import { StageKit } from "./StageKit";

export type HallSceneProps = {
  mode: "edit" | "view";
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  assets: LibraryAsset[];
  selectedId: string | null;
  highlightId?: string | null;
  tool: Tool;
  units: Units;
  amenityStamp: AmenityType;
  pinKind: PinKind;
  presetMeters: { w: number; d: number } | null;
  stampAppearance: Appearance | null;
  stampModelAssetId: string | null;
  onSelect?: (id: string | null) => void;
  onChangeObject?: (obj: MapObject) => void;
  onCreateObject?: (obj: MapObject) => void;
  onNavLock?: (locked: boolean) => void;
  spacePan?: boolean;
  tone?: MapTone;
  showGrid?: boolean;
  showRulers?: boolean;
};

export type HallExtent = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

export function hallExtent(floor: Floor, objects: MapObject[]): HallExtent {
  if (floor.calibration) {
    const v = venueWorldRect(floor.calibration);
    return { ...v, cx: (v.minX + v.maxX) / 2, cy: (v.minY + v.maxY) / 2 };
  }
  let minX = 0;
  let minY = 0;
  let maxX = 40;
  let maxY = 40;
  for (const o of objects) {
    if (o.polygon?.length) {
      const b = ringBounds(o.polygon);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    } else if (o.x != null && o.y != null) {
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x);
      maxY = Math.max(maxY, o.y);
    }
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

export function hallFocus(
  objects: MapObject[],
  id: string | null,
  extent: HallExtent,
): { cx: number; cz: number; span: number } {
  if (id) {
    const o = objects.find((x) => x.id === id);
    if (o?.polygon?.length) {
      const b = ringBounds(o.polygon);
      return {
        cx: (b.minX + b.maxX) / 2,
        cz: (b.minY + b.maxY) / 2,
        span: Math.max(b.w, b.h, 6) * 2.2,
      };
    }
    if (o?.x != null && o.y != null) {
      return { cx: o.x, cz: o.y, span: 12 };
    }
  }
  return { cx: extent.cx, cz: extent.cy, span: Math.max(extent.w, extent.h, 20) };
}

function hitToWorld(point: THREE.Vector3, grid: number) {
  return snapWorld(point.x, point.z, grid);
}

function planeToWorld(point: THREE.Vector3) {
  return { x: point.x, y: point.z };
}

function objectFrame(o: MapObject) {
  if (isPinObject(o) && o.x != null && o.y != null) {
    return { minX: o.x - 0.55, minY: o.y - 0.55, maxX: o.x + 0.55, maxY: o.y + 0.55, w: 1.1, h: 1.1 };
  }
  if (o.polygon?.length) return ringBounds(o.polygon);
  return null;
}

export function HallScene({
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
  onNavLock,
  spacePan = false,
  tone = "dark",
  showGrid = true,
  showRulers = false,
}: HallSceneProps) {
  const hall = HALL_THEME[tone];
  const canEdit = mode === "edit";
  const placing = canEdit && tool !== "select" && tool !== "calibrate";
  const grid = gridSize(units);
  const extent = useMemo(() => hallExtent(floor, objects), [floor, objects]);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Ring | null>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | "rotate";
    ox: number;
    oy: number;
    polygon: Ring | null;
    path?: MapObject["path"];
    x: number | null;
    y: number | null;
    startAngle?: number;
    startRot?: number;
  } | null>(null);
  const pendingDrag = useRef<typeof drag.current>(null);
  const passThroughNav = useRef(false);
  const lastPtr = useRef({ x: Number.NaN, y: Number.NaN });
  const draw = useRef<{ x: number; y: number } | null>(null);
  const draftRef = useRef<Ring | null>(null);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const onChangeRef = useRef(onChangeObject);
  onChangeRef.current = onChangeObject;
  const onCreateRef = useRef(onCreateObject);
  onCreateRef.current = onCreateObject;
  const onNavLockRef = useRef(onNavLock);
  onNavLockRef.current = onNavLock;
  const { camera, gl } = useThree();

  function stampAt(x: number, y: number, ring?: Ring) {
    if (!canEdit) return;
    if (tool === "icon") {
      onCreateRef.current?.(
        stampPinObject({
          floorId: floor.id,
          pinKind,
          x,
          y,
          amenityType: amenityStamp,
        }),
      );
      return;
    }
    if (tool !== "rect") return;
    const poly = ring ?? (presetMeters ? rectFromCenter(x, y, presetMeters.w, presetMeters.d) : null);
    if (!poly) return;
    const b = ringBounds(poly);
    if (b.w < 0.3 || b.h < 0.3) return;
    onCreateObject?.(
      newMapObject({
        floorId: floor.id,
        kind: "booth",
        polygon: poly,
        name: stampAppearance === "stage" ? "Stage" : "",
        appearance: stampAppearance,
        modelAssetId: stampModelAssetId,
      }),
    );
  }

  const stampRef = useRef(stampAt);
  stampRef.current = stampAt;

  useEffect(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    function planeFromEvent(ev: PointerEvent) {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      return planeToWorld(hit);
    }

    function worldFromEvent(ev: PointerEvent) {
      const p = planeFromEvent(ev);
      if (!p) return null;
      return snapWorld(p.x, p.y, grid);
    }

    function onMove(ev: PointerEvent) {
      if (ev.clientX === lastPtr.current.x && ev.clientY === lastPtr.current.y) return;
      lastPtr.current = { x: ev.clientX, y: ev.clientY };
      const p = worldFromEvent(ev);
      if (!p) return;
      if (placing) setHover(p);
      if (draw.current && tool === "rect" && !presetMeters) {
        const ring = rectRing(draw.current.x, draw.current.y, p.x, p.y);
        draftRef.current = ring;
        setDraft(ring);
      }
      const pending = pendingDrag.current;
      if (pending && !drag.current) {
        const moved = Math.hypot(p.x - pending.ox, p.y - pending.oy);
        if (moved < 0.2) return;
        drag.current = pending;
        pendingDrag.current = null;
        onNavLockRef.current?.(true);
      }
      const d = drag.current;
      if (!d) return;
      const obj = objectsRef.current.find((o) => o.id === d.id);
      if (!obj) return;
      if (d.mode === "rotate" && d.startAngle != null && d.startRot != null) {
        const raw = planeFromEvent(ev);
        if (!raw) return;
        let nextDeg = d.startRot + (angleDeg(d.ox, d.oy, raw.x, raw.y) - d.startAngle);
        if (ev.shiftKey) nextDeg = snapDeg(nextDeg, 15);
        if (isPinObject(obj)) {
          onChangeRef.current?.({ ...obj, rotation: nextDeg, facingDeg: nextDeg });
          return;
        }
        const startPath = d.path?.length ? d.path : obj.polygon ? objectShape({ ...obj, polygon: d.polygon, path: d.path }) : [];
        const rotated = commitShape(rotateBezier(startPath, nextDeg - d.startRot));
        onChangeRef.current?.({
          ...obj,
          polygon: rotated.polygon,
          path: rotated.path,
          facingDeg: nextDeg,
          rotation: nextDeg,
        });
        return;
      }
      const dx = p.x - d.ox;
      const dy = p.y - d.oy;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
      if (isPinObject(obj)) {
        onChangeRef.current?.({ ...obj, x: (d.x ?? 0) + dx, y: (d.y ?? 0) + dy });
      } else if (d.polygon || d.path) {
        const path = translateBezier(d.path?.length ? d.path : objectShape({ polygon: d.polygon, path: d.path }), dx, dy);
        const next = commitShape(path);
        onChangeRef.current?.({ ...obj, polygon: next.polygon, path: next.path });
      }
    }

    function onUp() {
      if (draw.current && tool === "rect" && !presetMeters) {
        const ring = draftRef.current;
        if (ring) stampRef.current(0, 0, ring);
      }
      draw.current = null;
      draftRef.current = null;
      setDraft(null);
      pendingDrag.current = null;
      passThroughNav.current = false;
      if (drag.current) {
        drag.current = null;
        onNavLockRef.current?.(false);
      }
    }

    const el = gl.domElement;
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, grid, placing, tool, presetMeters]);

  const ghostRing =
    placing && hover && tool === "rect" && presetMeters
      ? rectFromCenter(hover.x, hover.y, presetMeters.w, presetMeters.d)
      : draft;

  function onGroundDown(e: ThreeEvent<PointerEvent>) {
    if (e.button !== 0) return;
    if (passThroughNav.current) {
      passThroughNav.current = false;
      return;
    }
    const p = hitToWorld(e.point, grid);
    setHover(p);
    if (!placing) {
      if (canEdit && !spacePan) onSelect?.(null);
      return;
    }
    e.stopPropagation();
    if (tool === "polygon") return;
    if (tool === "icon" || presetMeters) {
      stampAt(p.x, p.y);
      return;
    }
    if (tool === "rect") {
      draw.current = p;
      const ring = rectRing(p.x, p.y, p.x, p.y);
      draftRef.current = ring;
      setDraft(ring);
      onNavLock?.(true);
    }
  }

  function startDrag(obj: MapObject, e: ThreeEvent<PointerEvent>) {
    if (!canEdit || tool !== "select") return;
    const p = hitToWorld(e.point, grid);
    pendingDrag.current = {
      id: obj.id,
      mode: "move",
      ox: p.x,
      oy: p.y,
      polygon: obj.polygon,
      path: obj.path ?? objectShape(obj),
      x: obj.x,
      y: obj.y,
    };
  }

  function startRotate(obj: MapObject, e: ThreeEvent<PointerEvent>) {
    if (!canEdit || tool !== "select") return;
    const box = objectFrame(obj);
    if (!box) return;
    e.stopPropagation();
    const rh = rotateHandlePos(box, Math.max(1.1, Math.min(box.w, box.h) * 0.18));
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(plane, hit)) return;
    const p = planeToWorld(hit);
    drag.current = {
      id: obj.id,
      mode: "rotate",
      ox: rh.cx,
      oy: rh.cy,
      polygon: obj.polygon,
      path: obj.path ?? (obj.polygon ? objectShape(obj) : undefined),
      x: obj.x,
      y: obj.y,
      startAngle: angleDeg(rh.cx, rh.cy, p.x, p.y),
      startRot: isPinObject(obj) ? (obj.rotation ?? obj.facingDeg ?? 0) : (obj.facingDeg ?? obj.rotation ?? 0),
    };
    pendingDrag.current = null;
    onNavLock?.(true);
  }

  const selectedObj = selectedId ? objects.find((o) => o.id === selectedId) : undefined;

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[extent.cx, -0.04, extent.cy]}
        onPointerDown={onGroundDown}
        onPointerMove={(e) => setHover(hitToWorld(e.point, grid))}
      >
        <planeGeometry args={[Math.max(extent.w, 24) * 1.6, Math.max(extent.h, 24) * 1.6]} />
        <meshStandardMaterial color={hall.floor} roughness={1} />
      </mesh>
      {floor.underlayUrl ? (
        <Suspense fallback={null}>
          <UnderlayPlane
            url={floor.underlayUrl}
            extent={extent}
            invert={tone === "dark"}
            onPointerDown={onGroundDown}
          />
        </Suspense>
      ) : null}
      {showGrid ? (
        <Grid
          position={[extent.cx, 0.005, extent.cy]}
          args={[Math.max(extent.w, 20), Math.max(extent.h, 20)]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={hall.grid}
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#c2410c"
          fadeDistance={Math.max(80, Math.max(extent.w, extent.h) * 2)}
          fadeStrength={1.2}
          infiniteGrid
        />
      ) : null}
      {showRulers ? (
        <HallRulers extent={extent} units={units} color={tone === "light" ? "#6a6a64" : "#a8a8a0"} />
      ) : null}

      {objects
        .filter((o) => !isPinObject(o))
        .map((o) => {
          const sponsor = o.sponsorId ? sponsors.find((s) => s.id === o.sponsorId) : undefined;
          const selected = o.id === selectedId || o.id === highlightId;
          return (
            <group
              key={o.id}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (spacePan) return;
                const alreadySelected = o.id === selectedId;
                e.stopPropagation();
                onSelect?.(o.id);
                if (alreadySelected && canEdit && tool === "select") {
                  startDrag(o, e);
                  return;
                }
                passThroughNav.current = true;
              }}
            >
              <HallPlot object={o} sponsor={sponsor} assets={assets} selected={selected} tone={tone} />
            </group>
          );
        })}
      {objects
        .filter((o) => isPinObject(o) && !isMapPinObject(o))
        .map((o) => {
          const selected = o.id === selectedId || o.id === highlightId;
          return (
            <group
              key={o.id}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (spacePan) return;
                const alreadySelected = o.id === selectedId;
                e.stopPropagation();
                onSelect?.(o.id);
                if (alreadySelected && canEdit && tool === "select") {
                  startDrag(o, e);
                  return;
                }
                passThroughNav.current = true;
              }}
            >
              <HallPlot object={o} selected={selected} tone={tone} />
            </group>
          );
        })}

      {ghostRing ? (
        <HallPlot
          object={{
            id: "ghost",
            floorId: floor.id,
            kind: "booth",
            polygon: ghostRing,
            x: null,
            y: null,
            rotation: 0,
            boothNumber: "",
            name: "",
            sponsorId: null,
            amenityType: null,
            color: null,
            description: "",
            eventDate: "",
            ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelAssetId }),
            createdAt: "",
            updatedAt: "",
          }}
          assets={assets}
          selected={false}
          tone={tone}
        />
      ) : null}
      {canEdit && tool === "select" && selectedObj && !isMapPinObject(selectedObj) ? (
        <HallRotateGizmo
          object={selectedObj}
          onPointerDown={(e) => {
            if (e.button !== 0 || spacePan) return;
            startRotate(selectedObj, e);
          }}
        />
      ) : null}
      {placing && hover && tool === "icon" ? (
        pinKind === "side_event" || pinKind === "hotel" ? (
          <AmenityTotem x={hover.x} y={hover.y} color={MAP_PIN_META[pinKind].color} selected={false} ghost />
        ) : (
          <AmenityTotem x={hover.x} y={hover.y} type={amenityStamp} selected={false} ghost />
        )
      ) : null}
    </>
  );
}

function UnderlayPlane({
  url,
  extent,
  invert,
  onPointerDown,
}: {
  url: string;
  extent: HallExtent;
  invert: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return (
    <mesh
      key={invert ? "inv" : "raw"}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[extent.cx, -0.02, extent.cy]}
      onPointerDown={onPointerDown}
    >
      <planeGeometry args={[extent.w, extent.h]} />
      <meshStandardMaterial
        map={tex}
        roughness={1}
        metalness={0}
        onBeforeCompile={
          invert
            ? (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                  "#include <map_fragment>",
                  `#include <map_fragment>
                   diffuseColor.rgb = vec3(1.0) - diffuseColor.rgb;`,
                );
              }
            : undefined
        }
      />
    </mesh>
  );
}

function HallRotateGizmo({
  object,
  onPointerDown,
}: {
  object: MapObject;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const box = objectFrame(object);
  if (!box) return null;
  const offset = Math.max(1.1, Math.min(box.w, box.h) * 0.18);
  const rh = rotateHandlePos(box, offset);
  const y = isPinObject(object) ? 1.85 : 3.05;
  const from = new THREE.Vector3(rh.cx, isPinObject(object) ? 1.35 : 2.55, box.minY);
  const to = new THREE.Vector3(rh.hx, y, rh.hy);
  const mid = from.clone().lerp(to, 0.5);
  const stemLen = Math.max(from.distanceTo(to), 0.2);
  const stemQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  return (
    <group>
      <mesh position={mid} quaternion={stemQuat}>
        <cylinderGeometry args={[0.035, 0.035, stemLen, 8]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
      <mesh position={[rh.hx, y, rh.hy]} onPointerDown={onPointerDown}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[rh.hx, y, rh.hy]} rotation={[Math.PI / 2, 0, 0]} onPointerDown={onPointerDown}>
        <torusGeometry args={[0.38, 0.055, 8, 24]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
      <mesh position={[rh.hx, y, rh.hy]} onPointerDown={onPointerDown} visible={false}>
        <sphereGeometry args={[0.55, 12, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

function HallPlot({
  object,
  sponsor,
  assets = [],
  selected,
  tone = "dark",
}: {
  object: MapObject;
  sponsor?: Sponsor;
  assets?: LibraryAsset[];
  selected: boolean;
  tone?: MapTone;
}) {
  if (isPinObject(object) && object.x != null && object.y != null) {
    return (
      <AmenityTotem
        x={object.x}
        y={object.y}
        type={object.amenityType ?? "info"}
        color={isMapPinObject(object) ? MAP_PIN_META[object.kind].color : undefined}
        rotation={object.rotation ?? 0}
        selected={selected}
      />
    );
  }
  if (!object.polygon?.length) return null;
  const appearance = resolveAppearance(object);
  const urls = objectUrls(object, assets);
  const rug = boothFillHex(object.color, sponsor?.tier ?? "", tone);
  if (appearance === "custom" && urls.modelUrl) {
    return (
      <Suspense
        fallback={
          <BoothKit
            ring={object.polygon}
            facingDeg={object.facingDeg ?? 0}
            rugColor={rug}
            selected={selected}
          />
        }
      >
        <CustomModel
          url={urls.modelUrl}
          ring={object.polygon}
          facingDeg={object.facingDeg ?? 0}
          rugColor={rug}
          selected={selected}
        />
      </Suspense>
    );
  }
  const fillUrl = urls.fillTextureUrl || undefined;
  const logoUrl = displayLogoUrl(object, assets, sponsor) || undefined;
  if (appearance === "stage") {
    return (
      <StageKit
        ring={object.polygon}
        facingDeg={object.facingDeg ?? 0}
        color={rug}
        fillUrl={fillUrl}
        logoUrl={logoUrl}
        selected={selected}
      />
    );
  }
  return (
    <BoothKit
      ring={object.polygon}
      facingDeg={object.facingDeg ?? 0}
      rugColor={rug}
      rugUrl={urls.rugTextureUrl || undefined}
      fillUrl={fillUrl}
      wallUrl={urls.wallTextureUrl || undefined}
      logoUrl={logoUrl}
      selected={selected}
    />
  );
}

function AmenityTotem({
  x,
  y,
  type = "info",
  color,
  rotation = 0,
  selected,
  ghost,
}: {
  x: number;
  y: number;
  type?: AmenityType;
  color?: string;
  rotation?: number;
  selected: boolean;
  ghost?: boolean;
}) {
  const fill = color ?? AMENITY_COLOR[type];
  const h = selected ? 1.45 : 1.2;
  return (
    <group position={[x, 0, y]} rotation={[0, yawRad(rotation), 0]}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.28, 0.34, h, 10]} />
        <meshStandardMaterial color={fill} roughness={0.45} transparent={ghost} opacity={ghost ? 0.5 : 1} />
      </mesh>
      {selected ? (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.52, 20]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      ) : null}
    </group>
  );
}
