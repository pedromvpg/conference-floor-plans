"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { Grid, Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { pinLucideIcon } from "@/lib/pin-icons";
import { resolvedIconPaint } from "@/lib/paint";
import { hallDefaults, resolveAppearance } from "@/lib/appearance";
import { kitByKind, kitStampName } from "@/lib/exhibit-kits";
import { boothFillHex, HALL_THEME, type MapTone } from "@/lib/colors";
import { angleDeg, rectFromCenter, rectRing, ringBounds, ringCentroid, rotateHandlePos, rotateRing, snapDeg, squareRectRing, venueWorldRect } from "@/lib/geometry";
import { displayLogoUrl, objectUrls, snapWorld } from "@/lib/hall";
import { commitShape, ellipseFromCorners, objectShape, rotateBezier, tessellate, translateBezier } from "@/lib/bezier";
import { stampPinObject, newMapObject } from "@/lib/new-object";
import { formatLength, gridSize } from "@/lib/units";
import { svgVenueWorldLabels, svgVenueWorldPolylines, type SvgTextWeight } from "@/lib/svg-layers";
import type {
  AmenityType,
  Appearance,
  Floor,
  LibraryAsset,
  ExhibitKit,
  MapObject,
  ObjectKind,
  PinKind,
  Ring,
  Sponsor,
  Tool,
  Units,
  Calibration,
} from "@/lib/types";
import { isPinObject, isMapPinObject } from "@/lib/types";
import type { ViewCenter } from "@/lib/view-center";
import { BoothKit } from "./BoothKit";
import { CustomModel } from "./CustomModel";
import { HallRulers } from "./HallRulers";
import { KioskKit } from "./KioskKit";
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
  stampKitKind?: MapObject["kitKind"];
  kits?: ExhibitKit[];
  onSelect?: (id: string | null) => void;
  onChangeObject?: (obj: MapObject) => void;
  onCreateObject?: (obj: MapObject) => void;
  onNavLock?: (locked: boolean) => void;
  spacePan?: boolean;
  tone?: MapTone;
  showGrid?: boolean;
  showRulers?: boolean;
  cuboids?: boolean;
  venueSvg?: string | null;
  showGround?: boolean;
  showObjectSizes?: boolean;
  onSetViewCenter?: (center: { x: number; y: number }) => void;
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

export function plotsExtent(objects: MapObject[]): HallExtent | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objects) {
    if (isMapPinObject(o)) continue;
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
  if (!Number.isFinite(minX)) return null;
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

export function hallExtent(floor: Floor, objects: MapObject[]): HallExtent {
  const plots = plotsExtent(objects);
  if (floor.calibration) {
    const v = venueWorldRect(floor.calibration);
    if (plots && (v.w > plots.w * 3.5 || v.h > plots.h * 3.5)) {
      const pad = Math.max(plots.w, plots.h, 12) * 0.35;
      const minX = plots.minX - pad;
      const minY = plots.minY - pad;
      const maxX = plots.maxX + pad;
      const maxY = plots.maxY + pad;
      return {
        minX,
        minY,
        maxX,
        maxY,
        w: maxX - minX,
        h: maxY - minY,
        cx: plots.cx,
        cy: plots.cy,
      };
    }
    return { ...v, cx: (v.minX + v.maxX) / 2, cy: (v.minY + v.maxY) / 2 };
  }
  return (
    plots ?? {
      minX: 0,
      minY: 0,
      maxX: 40,
      maxY: 40,
      w: 40,
      h: 40,
      cx: 20,
      cy: 20,
    }
  );
}

export function hallFocus(
  objects: MapObject[],
  id: string | null,
  extent: HallExtent,
  viewCenter?: ViewCenter | null,
): { cx: number; cz: number; span: number } {
  if (id) {
    const o = objects.find((x) => x.id === id);
    if (o) {
      if (o.polygon?.length && !isMapPinObject(o)) {
        const b = ringBounds(o.polygon);
        return {
          cx: (b.minX + b.maxX) / 2,
          cz: (b.minY + b.maxY) / 2,
          span: Math.max(b.w, b.h, 6) * 2.2,
        };
      }
      if (o.x != null && o.y != null) {
        return { cx: o.x, cz: o.y, span: 12 };
      }
    }
  }
  if (viewCenter) {
    return { cx: viewCenter.x, cz: viewCenter.y, span: Math.max(extent.w, extent.h, 20) };
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
  stampKitKind = null,
  kits = [],
  onSelect,
  onChangeObject,
  onCreateObject,
  onNavLock,
  spacePan = false,
  tone = "dark",
  showGrid = true,
  showRulers = false,
  cuboids = false,
  venueSvg = null,
  showGround = false,
  showObjectSizes = false,
  onSetViewCenter,
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

  function clientOnFloor(clientX: number, clientY: number) {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return planeToWorld(hit);
  }

  function stampAt(x: number, y: number, ring?: Ring) {
    if (!canEdit) return;
    if (tool === "viewCenter") {
      onSetViewCenter?.({ x, y });
      return;
    }
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
    if (tool !== "rect" && tool !== "ellipse") return;
    if (tool === "ellipse") {
      const b = ring ? ringBounds(ring) : null;
      if (!b || b.w < 0.3 || b.h < 0.3) return;
      const shape = commitShape(ellipseFromCorners(b.minX, b.minY, b.maxX, b.maxY));
      onCreateObject?.(
        newMapObject({
          floorId: floor.id,
          kind: "booth",
          polygon: shape.polygon,
          path: shape.path,
          name: stampAppearance === "stage" ? kitStampName(stampKitKind ?? "main_stage") || "Stage" : kitStampName(stampKitKind ?? "small"),
          appearance: stampAppearance,
          kitKind: stampKitKind,
          modelAssetId: stampModelAssetId,
        }),
      );
      return;
    }
    const poly = ring ?? (presetMeters ? rectFromCenter(x, y, presetMeters.w, presetMeters.d) : null);
    if (!poly) return;
    const b = ringBounds(poly);
    if (b.w < 0.3 || b.h < 0.3) return;
    onCreateObject?.(
      newMapObject({
        floorId: floor.id,
        kind: "booth",
        polygon: poly,
        name: kitStampName(stampKitKind ?? "small") || (stampAppearance === "stage" ? "Stage" : ""),
        appearance: stampAppearance,
        kitKind: stampKitKind,
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
      if (draw.current && (tool === "rect" || tool === "ellipse") && !presetMeters) {
        const box = ev.shiftKey
          ? squareRectRing(draw.current.x, draw.current.y, p.x, p.y)
          : rectRing(draw.current.x, draw.current.y, p.x, p.y);
        const ring = tool === "ellipse" ? tessellate(ellipseFromCorners(box[0][0], box[0][1], box[2][0], box[2][1]), true) : box;
        draftRef.current = tool === "ellipse" ? box : ring;
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
      if (draw.current && (tool === "rect" || tool === "ellipse") && !presetMeters) {
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
    if (tool === "viewCenter" || tool === "icon" || presetMeters) {
      stampAt(p.x, p.y);
      return;
    }
    if (tool === "rect" || tool === "ellipse") {
      draw.current = p;
      const ring = rectRing(p.x, p.y, p.x, p.y);
      draftRef.current = ring;
      setDraft(ring);
      onNavLock?.(true);
    }
  }

  function startDragAt(obj: MapObject, x: number, y: number) {
    if (!canEdit || tool !== "select") return;
    pendingDrag.current = {
      id: obj.id,
      mode: "move",
      ox: x,
      oy: y,
      polygon: obj.polygon,
      path: obj.path ?? objectShape(obj),
      x: obj.x,
      y: obj.y,
    };
  }

  function startDrag(obj: MapObject, e: ThreeEvent<PointerEvent>) {
    const p = hitToWorld(e.point, grid);
    startDragAt(obj, p.x, p.y);
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
        position={[extent.cx, 0, extent.cy]}
        userData={{ shadowMode: "none" }}
        onPointerDown={onGroundDown}
        onPointerMove={(e) => setHover(hitToWorld(e.point, grid))}
      >
        <planeGeometry args={[Math.max(extent.w, 24) * 1.6, Math.max(extent.h, 24) * 1.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {canEdit && floor.viewCenter ? (
        <group position={[floor.viewCenter.x, 0.04, floor.viewCenter.y]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ shadowMode: "none" }}>
            <ringGeometry args={[0.55, 0.78, 32]} />
            <meshBasicMaterial color="#f97316" depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ shadowMode: "none" }}>
            <circleGeometry args={[0.16, 20]} />
            <meshBasicMaterial color="#f97316" depthWrite={false} />
          </mesh>
        </group>
      ) : null}
      {floor.calibration && venueSvg ? (
        <HallVenuePaths
          markup={venueSvg}
          calibration={floor.calibration}
          color={tone === "light" ? "#3f3f3a" : "#e8e8e0"}
          outline={tone === "light" ? "#ffffff" : "#141414"}
        />
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
              <HallPlot
                object={o}
                sponsor={sponsor}
                assets={assets}
                kits={kits}
                selected={selected}
                tone={tone}
                cuboid={cuboids}
                showSizes={showObjectSizes}
                units={units}
              />
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
              <HallPlot
                object={o}
                selected={selected}
                tone={tone}
                cuboid={cuboids}
                largePins={mode === "view"}
                onPinPointerDown={(ev) => {
                  if (ev.button !== 0) return;
                  if (spacePan) return;
                  const alreadySelected = o.id === selectedId;
                  ev.stopPropagation();
                  onSelect?.(o.id);
                  if (alreadySelected && canEdit && tool === "select") {
                    const p = clientOnFloor(ev.clientX, ev.clientY);
                    if (p) startDragAt(o, p.x, p.y);
                  }
                }}
              />
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
            ...hallDefaults({ appearance: stampAppearance, kitKind: stampKitKind, modelAssetId: stampModelAssetId }),
            createdAt: "",
            updatedAt: "",
          }}
          assets={assets}
          kits={kits}
          selected={false}
          tone={tone}
          cuboid={cuboids}
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
          <AmenityTotem x={hover.x} y={hover.y} kind={pinKind} selected={false} ghost tone={tone} />
        ) : (
          <AmenityTotem x={hover.x} y={hover.y} kind="amenity" type={amenityStamp} selected={false} ghost tone={tone} />
        )
      ) : null}
    </>
  );
}

function HallShadowFloor({
  tone,
  cx,
  cz,
  span,
}: {
  tone: MapTone;
  cx: number;
  cz: number;
  span: number;
}) {
  const size = Math.max(span * 8, 160);
  return (
    <group position={[cx, 0, cz]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        renderOrder={-2}
        frustumCulled={false}
        userData={{ shadowMode: "none" }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={tone === "light" ? "#ffffff" : "#3a3a3a"} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.11, 0]}
        renderOrder={-1}
        frustumCulled={false}
        userData={{ shadowMode: "receive" }}
        receiveShadow
        castShadow={false}
      >
        <planeGeometry args={[size, size]} />
        <meshLambertMaterial
          color={new THREE.Color(2.4, 2.4, 2.4)}
          toneMapped={false}
          transparent
          premultipliedAlpha
          depthWrite={false}
          blending={THREE.MultiplyBlending}
        />
      </mesh>
    </group>
  );
}

function simplifyStroke(points: Ring, minStep: number): Ring {
  if (points.length < 3) return points;
  const out: Ring = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) >= minStep) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

function HallVenuePaths({
  markup,
  calibration,
  color,
  outline,
}: {
  markup: string;
  calibration: Calibration;
  color: string;
  outline: string;
}) {
  const geom = useMemo(() => {
    const strokes = svgVenueWorldPolylines(markup, calibration);
    const positions: number[] = [];
    const maxSeg = 24000;
    for (const stroke of strokes) {
      const raw =
        stroke.closed && stroke.points.length > 2 ? [...stroke.points, stroke.points[0]] : stroke.points;
      const pts = simplifyStroke(raw, 0.35);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (!Number.isFinite(a[0] + a[1] + b[0] + b[1])) continue;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.04) continue;
        positions.push(a[0], 0.03, a[1], b[0], 0.03, b[1]);
        if (positions.length / 6 >= maxSeg) break;
      }
      if (positions.length / 6 >= maxSeg) break;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [markup, calibration]);
  const labels = useMemo(() => svgVenueWorldLabels(markup, calibration), [markup, calibration]);
  useEffect(() => () => geom.dispose(), [geom]);
  const hasLines = (geom.getAttribute("position")?.count ?? 0) > 0;
  if (!hasLines && !labels.length) return null;
  return (
    <group>
      {hasLines ? (
        <lineSegments geometry={geom} frustumCulled={false}>
          <lineBasicMaterial color={color} />
        </lineSegments>
      ) : null}
      {labels.map((label, i) => (
        <VenueFloorLabel
          key={`${i}:${label.text}`}
          text={label.text}
          x={label.x}
          z={label.y}
          fontSize={Math.min(5.5, Math.max(0.7, label.fontSize))}
          color={color}
          outline={outline}
          align={label.align}
          weight={label.weight}
          rotation={label.rotation}
        />
      ))}
    </group>
  );
}

function interFontStack(): string {
  if (typeof document === "undefined") return "Inter, ui-sans-serif, system-ui, sans-serif";
  const fromVar = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
  const fromBody = getComputedStyle(document.body).fontFamily.trim();
  const family = fromVar || fromBody || "Inter";
  return `${family}, Inter, ui-sans-serif, system-ui, sans-serif`;
}

function interWeight(weight: SvgTextWeight): string {
  if (weight === "regular") return "400";
  return "700";
}

function VenueFloorLabel({
  text,
  x,
  z,
  fontSize,
  color,
  outline,
  align,
  weight,
  rotation,
}: {
  text: string;
  x: number;
  z: number;
  fontSize: number;
  color: string;
  outline: string;
  align: "left" | "center" | "right";
  weight: SvgTextWeight;
  rotation: number;
}) {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    const css = `${interWeight(weight)} 64px ${interFontStack()}`;
    let cancelled = false;
    void document.fonts.load(css).finally(() => {
      if (!cancelled) setFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [weight]);
  const { map, w, h } = useMemo(() => {
    const lines = text.split("\n");
    const fs = 64;
    const padX = 20;
    const padY = 12;
    const lineH = fs * 1.05;
    const stack = interFontStack();
    const font = `${interWeight(weight)} ${fs}px ${stack}`;
    const canvas = document.createElement("canvas");
    const probe = canvas.getContext("2d");
    if (!probe) return { map: null as THREE.CanvasTexture | null, w: 1, h: 1 };
    probe.font = font;
    const textW = Math.max(1, ...lines.map((line) => probe.measureText(line).width));
    canvas.width = Math.ceil(textW + padX * 2);
    canvas.height = Math.ceil(lineH * lines.length + padY * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { map: null as THREE.CanvasTexture | null, w: 1, h: 1 };
    ctx.font = font;
    ctx.textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 10;
    ctx.strokeStyle = outline;
    ctx.fillStyle = color;
    const ax = align === "left" ? padX : align === "right" ? canvas.width - padX : canvas.width / 2;
    lines.forEach((line, i) => {
      const y = padY + lineH * i + lineH / 2;
      ctx.strokeText(line, ax, y);
      ctx.fillText(line, ax, y);
    });
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    const h = fontSize * Math.max(1, lines.length);
    const w = h * (canvas.width / canvas.height);
    return { map, w, h };
  }, [text, fontSize, color, outline, align, weight, fontReady]);
  useEffect(() => () => map?.dispose(), [map]);
  if (!map) return null;
  const ox = align === "left" ? w / 2 : align === "right" ? -w / 2 : 0;
  return (
    <group position={[x, 0.14, z]} rotation={[0, -rotation, 0]}>
      <mesh position={[ox, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={8} frustumCulled={false}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={map} transparent toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
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
  const y = isPinObject(object) ? 0.55 : 3.05;
  const from = new THREE.Vector3(rh.cx, isPinObject(object) ? 0.12 : 2.55, box.minY);
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

function HallObjectEdgeSizes({
  ring,
  facingDeg,
  units,
  y,
  color,
}: {
  ring: Ring;
  facingDeg: number;
  units: Units;
  y: number;
  color: string;
}) {
  const local = rotateRing(ring, -facingDeg);
  const b = ringBounds(local);
  if (!(b.w > 0.35 && b.h > 0.35)) return null;
  const { x: cx, y: cy } = ringCentroid(ring);
  const pad = 0.32;
  const rad = (facingDeg * Math.PI) / 180;
  const rot = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)] as const;
  };
  const [wx, wz] = rot((b.minX + b.maxX) / 2, b.maxY + pad);
  const [hx, hz] = rot(b.maxX + pad, (b.minY + b.maxY) / 2);
  const halo = color === "#3a3a36" || color === "#6a6a64" ? "#f4f4f1" : "#12110f";
  const label = (text: string) => (
    <div
      style={{
        fontSize: 9,
        lineHeight: 1,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontWeight: 600,
        color,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        textShadow: `0 0 2px ${halo}, 0 0 2px ${halo}, 0 1px 0 ${halo}`,
      }}
    >
      {text}
    </div>
  );
  return (
    <group>
      <Html center position={[wx, y, wz]} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        {label(formatLength(b.w, units))}
      </Html>
      <Html center position={[hx, y, hz]} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        {label(formatLength(b.h, units))}
      </Html>
    </group>
  );
}

function HallPlot({
  object,
  sponsor,
  assets = [],
  kits = [],
  selected,
  tone = "dark",
  cuboid = false,
  largePins = false,
  showSizes = false,
  units = "m",
  onPinPointerDown,
}: {
  object: MapObject;
  sponsor?: Sponsor;
  assets?: LibraryAsset[];
  kits?: ExhibitKit[];
  selected: boolean;
  tone?: MapTone;
  cuboid?: boolean;
  largePins?: boolean;
  showSizes?: boolean;
  units?: Units;
  onPinPointerDown?: (e: ReactPointerEvent) => void;
}) {
  if (isPinObject(object) && object.x != null && object.y != null) {
    return (
      <AmenityTotem
        x={object.x}
        y={object.y}
        kind={object.kind}
        type={object.amenityType ?? "info"}
        paint={object.paint}
        color={object.color}
        selected={selected}
        tone={tone}
        large={largePins}
        onPointerDown={onPinPointerDown}
      />
    );
  }
  if (!object.polygon?.length) return null;
  const appearance = resolveAppearance(object);
  const urls = objectUrls(object, assets);
  const rug = boothFillHex(object.color, sponsor?.tier ?? "", tone, appearance === "stage" ? "stage" : "booth");
  const kit = kitByKind(kits, object.kitKind);
  const wallH = kit?.wallHeightM;
  const deck = kit?.platformHeightM ?? 0.9;
  const sizeY = cuboid ? (appearance === "stage" ? wallH ?? 4.75 : wallH ?? 2.65) : appearance === "stage" ? (deck + 0.15) : 0.22;
  const sizeColor = tone === "light" ? "#3a3a36" : "#c8c8c0";
  const sizes = showSizes ? (
    <HallObjectEdgeSizes ring={object.polygon} facingDeg={object.facingDeg ?? 0} units={units} y={sizeY} color={sizeColor} />
  ) : null;
  if (appearance === "custom" && urls.modelUrl && !cuboid) {
    return (
      <group>
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
        {sizes}
      </group>
    );
  }
  const fillUrl = urls.fillTextureUrl || undefined;
  const logoUrl = displayLogoUrl(object, assets, sponsor) || undefined;
  if (appearance === "stage") {
    return (
      <group>
        <StageKit
          ring={object.polygon}
          facingDeg={object.facingDeg ?? 0}
          color={rug}
          fillUrl={fillUrl}
          logoUrl={logoUrl}
          selected={selected}
          cuboid={cuboid}
          wallHeight={wallH ?? 4.2}
          platformHeight={deck}
          kitKind={object.kitKind === "secondary_stage" ? "secondary_stage" : "main_stage"}
        />
        {sizes}
      </group>
    );
  }
  if (appearance === "kiosk") {
    return (
      <group>
        <KioskKit
          ring={object.polygon}
          facingDeg={object.facingDeg ?? 0}
          color={rug}
          selected={selected}
          cuboid={cuboid}
          wallHeight={wallH ?? 2.2}
        />
        {sizes}
      </group>
    );
  }
  return (
    <group>
      <BoothKit
        ring={object.polygon}
        facingDeg={object.facingDeg ?? 0}
        rugColor={rug}
        rugUrl={urls.rugTextureUrl || undefined}
        fillUrl={fillUrl}
        wallUrl={urls.wallTextureUrl || undefined}
        logoUrl={logoUrl}
        selected={selected}
        cuboid={cuboid}
        wallHeight={wallH ?? 2.5}
      />
      {sizes}
    </group>
  );
}

function AmenityTotem({
  x,
  y,
  kind = "amenity",
  type = "info",
  paint,
  color,
  selected,
  ghost,
  tone = "dark",
  large = false,
  onPointerDown,
}: {
  x: number;
  y: number;
  kind?: ObjectKind;
  type?: AmenityType;
  paint?: MapObject["paint"];
  color?: string | null;
  selected: boolean;
  ghost?: boolean;
  tone?: MapTone;
  large?: boolean;
  onPointerDown?: (e: ReactPointerEvent) => void;
}) {
  const look = resolvedIconPaint(paint, color, tone);
  const Icon = pinLucideIcon(kind, type);
  const fill = look.fillNone ? "none" : look.fillHex;
  const w = large ? 38 : 28;
  const h = large ? 52 : 38;
  const glyph = large ? 19 : 14;
  const glyphTop = large ? 8 : 6;
  return (
    <group position={[x, 0, y]}>
      <mesh position={[0, 0.08, 0]} visible={false}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
      <Html position={[0, 0.02, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <div
          onPointerDown={ghost ? undefined : onPointerDown}
          style={{
            position: "relative",
            transform: "translate(-50%, -100%)",
            pointerEvents: ghost ? "none" : "auto",
            opacity: ghost ? 0.55 : look.opacity,
            filter: selected ? "drop-shadow(0 0 3px #f97316)" : "drop-shadow(0 1px 2px rgb(0 0 0 / 0.45))",
            cursor: onPointerDown ? "pointer" : "default",
          }}
        >
          <svg width={w} height={h} viewBox="0 0 28 38" aria-hidden>
            <path
              d="M14 1.4C20.3 1.4 25.2 6.5 25.2 12.8C25.2 20.2 14 36.4 14 36.4C14 36.4 2.8 20.2 2.8 12.8C2.8 6.5 7.7 1.4 14 1.4Z"
              fill={fill}
              fillOpacity={look.fillOpacity}
              stroke={look.strokeNone ? "none" : look.strokeHex}
              strokeOpacity={look.strokeOpacity}
              strokeWidth={look.strokeNone ? 0 : 1.5}
            />
            {selected ? (
              <path
                d="M14 1.4C20.3 1.4 25.2 6.5 25.2 12.8C25.2 20.2 14 36.4 14 36.4C14 36.4 2.8 20.2 2.8 12.8C2.8 6.5 7.7 1.4 14 1.4Z"
                fill="none"
                stroke="#fff"
                strokeWidth={1.15}
              />
            ) : null}
          </svg>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: glyphTop,
              transform: "translateX(-50%)",
              display: "flex",
            }}
          >
            <Icon size={glyph} color={look.glyphHex} strokeWidth={2.4} aria-hidden />
          </div>
        </div>
      </Html>
    </group>
  );
}
