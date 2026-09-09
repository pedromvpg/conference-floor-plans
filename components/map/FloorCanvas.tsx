"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  AmenityType,
  Appearance,
  BezierNode,
  Calibration,
  Floor,
  FloorBasemap,
  LibraryAsset,
  MapObject,
  PinKind,
  Ring,
  Sponsor,
  Tool,
  Units,
} from "@/lib/types";
import { isPinObject, isMapPinObject, MAP_PIN_META, VENUE_ID } from "@/lib/types";
import { PlanStage } from "@/components/map/PlanStage";
import { leafletViewFromPlan, floorDeltaToEnu, offsetLatLng, roundBasemapCoord } from "@/lib/basemap";

function calibrationNearlyEqual(a: Calibration, b: Calibration): boolean {
  const ay = a.metersPerPixelY ?? a.metersPerPixel;
  const by = b.metersPerPixelY ?? b.metersPerPixel;
  return (
    Math.abs(a.metersPerPixel - b.metersPerPixel) < 1e-12 &&
    Math.abs(ay - by) < 1e-12 &&
    Math.abs(a.originX - b.originX) < 1e-6 &&
    Math.abs(a.originY - b.originY) < 1e-6
  );
}
import {
  alignmentTargets,
  angleDeg,
  applyBoundsToRing,
  axisScale,
  calibrationFromTwoClicks,
  calibrationFromWorldRect,
  floorSizeMeters,
  handleCursor,
  hypot,
  pointInRing,
  pixelsFromMeters,
  rectFromCenter,
  rectRing,
  resizeBounds,
  ringBounds,
  ringCentroid,
  rotateHandlePos,
  rotateRing,
  snapDeg,
  snapToPixel,
  snapScalar,
  snapTranslation,
  squareRectRing,
  translateRing,
  venueWorldRect,
  type BoundsHandle,
} from "@/lib/geometry";
import { formatSize, gridSize, snap } from "@/lib/units";
import { MapRulers } from "@/components/map/MapRulers";
import { AMENITY_COLOR } from "@/lib/amenities";
import { tierFill } from "@/lib/colors";
import { newId, nowIso } from "@/lib/store";
import { stampPinObject } from "@/lib/new-object";
import { hallDefaults } from "@/lib/appearance";
import { displayLogoUrl, objectUrls } from "@/lib/hall";
import {
  applyBoundsToBezier,
  closestOnPath,
  commitShape,
  corner,
  dragHandle,
  insertNode,
  isRectangleShape,
  objectShape,
  resizeRectangleCorner,
  rotateBezier,
  setMirroredHandles,
  svgPathD,
  tessellate,
  toggleSmooth,
  translateBezier,
} from "@/lib/bezier";
import {
  LAYER_ATTR,
  LOCK_ATTR,
  appendSvgBezier,
  appendSvgRect,
  lastSvgLayerId,
  layerAttrSelector,
  setSvgElementBezier,
  setSvgElementPoint,
  setSvgElementRotation,
  svgElementBezier,
  svgElementRotation,
  svgInnerMarkup,
  svgViewBox,
  translateSvgElement,
} from "@/lib/svg-layers";

type Props = {
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
  presetId?: string | null;
  presetMeters?: { w: number; d: number } | null;
  stampAppearance?: Appearance | null;
  stampModelAssetId?: string | null;
  constrainProportions?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string | null) => void;
  onSelectIds?: (ids: string[]) => void;
  onChangeObject?: (obj: MapObject) => void;
  onChangeObjects?: (objs: MapObject[]) => void;
  onCreateObject?: (obj: MapObject) => void;
  onCalibrated?: (cal: Calibration, previous: Calibration | null) => void;
  knownLengthMeters?: number;
  underlayOpacity?: number;
  showGrid?: boolean;
  showRulers?: boolean;
  snapToObjects?: boolean;
  snapToUnits?: boolean;
  /** Increment to animate the camera so `selectedId` fills the view. */
  frameNonce?: number;
  /** Increment to frame the drawing and all objects. */
  fitNonce?: number;
  /** Venue tab edits the drawing; objects tab edits booths and icons. */
  editLayer?: "objects" | "venue";
  canvasInteractive?: boolean;
  basemapInteractive?: boolean;
  /** Slide the hall on Earth (lat/lng) instead of panning the shared camera. */
  basemapAlignMode?: boolean;
  onBasemapAnchorChange?: (next: Pick<FloorBasemap, "lat" | "lng">) => void;
  onBasemapDerivedZoom?: (zoom: number) => void;
  basemapZoomTo?: { zoom: number; nonce: number } | null;
  /** Inline SVG markup so venue layers can be hidden/reordered live. */
  underlaySvg?: string | null;
  underlayHoverLayerId?: string | null;
  editVenueElements?: boolean;
  selectedVenueElementId?: string | null;
  onHoverVenueElement?: (id: string | null) => void;
  onSelectVenueElement?: (id: string | null) => void;
  onPreviewVenueSvg?: (svg: string) => void;
  onCommitVenueSvg?: (svg: string) => void;
  showUnderlay?: boolean;
};

type Cam = { x: number; y: number; w: number; h: number };

const HANDLE_HALF_PX = 5;
const VERTEX_HIT_PX = 12;
const STROKE_HIT_PX = 10;
const STROKE_SELECTED_PX = 2;
const STROKE_DEFAULT_PX = 1;

function svgUserToScreen(svg: SVGSVGElement | null, camW: number, camH: number): number {
  if (svg) {
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    if (w > 0 && h > 0) return Math.min(w / Math.max(camW, 1e-6), h / Math.max(camH, 1e-6));
  }
  return 10;
}

function screenPx(px: number, ppm: number): number {
  return px / Math.max(ppm, 1e-6);
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function lerpCam(a: Cam, b: Cam, t: number): Cam {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function objectFrameBounds(o: MapObject): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (isPinObject(o) && o.x != null && o.y != null) {
    const r = 3;
    return { minX: o.x - r, minY: o.y - r, maxX: o.x + r, maxY: o.y + r };
  }
  if (o.polygon?.length) {
    const b = ringBounds(o.polygon);
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  }
  return null;
}

function boundsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function marqueeBounds(x0: number, y0: number, x1: number, y1: number) {
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}

function expandBounds(
  acc: { minX: number; minY: number; maxX: number; maxY: number } | null,
  b: { minX: number; minY: number; maxX: number; maxY: number } | null,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!b) return acc;
  if (!acc) return { ...b };
  return {
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  };
}

function sceneBounds(
  cal: Calibration | null,
  objects: MapObject[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  let acc: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  if (cal) {
    const v = venueWorldRect(cal);
    acc = expandBounds(acc, { minX: v.minX, minY: v.minY, maxX: v.maxX, maxY: v.maxY });
  }
  for (const o of objects) acc = expandBounds(acc, objectFrameBounds(o));
  if (!acc) return { minX: -4, minY: -4, maxX: 76, maxY: 76 };
  return acc;
}

function camToFrame(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  aspect: number,
): Cam {
  const bw = Math.max(0.5, bounds.maxX - bounds.minX);
  const bh = Math.max(0.5, bounds.maxY - bounds.minY);
  const pad = Math.max(2, Math.max(bw, bh) * 0.12);
  let w = bw + pad * 2;
  let h = bh + pad * 2;
  const a = Math.max(aspect, 0.2);
  if (w / h > a) h = w / a;
  else w = h * a;
  w = Math.max(8, w);
  h = w / a;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

const HANDLES: BoundsHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function handleXY(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  handle: BoundsHandle,
): [number, number] {
  const mx = (b.minX + b.maxX) / 2;
  const my = (b.minY + b.maxY) / 2;
  const x = handle.includes("w") ? b.minX : handle.includes("e") ? b.maxX : mx;
  const y = handle.includes("n") ? b.minY : handle.includes("s") ? b.maxY : my;
  return [x, y];
}

function amenityBounds(o: MapObject): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  const r = 1.15;
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  return { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r, w: r * 2, h: r * 2 };
}

function RotateKnob({
  box,
  handleR,
}: {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  handleR: number;
}) {
  const rh = rotateHandlePos(box, handleR * 3.2);
  const mx = (box.minX + box.maxX) / 2;
  return (
    <g pointerEvents="none">
      <line x1={mx} y1={box.minY} x2={rh.hx} y2={rh.hy} stroke="#f97316" strokeWidth={handleR * 0.25} />
      <circle cx={rh.hx} cy={rh.hy} r={handleR} fill="#fff" stroke="#f97316" strokeWidth={handleR * 0.3} />
    </g>
  );
}

export function FloorCanvas({
  mode,
  floor,
  objects,
  sponsors,
  assets = [],
  selectedId,
  selectedIds,
  highlightId,
  tool = "select",
  units = "m",
  amenityStamp = "bathroom",
  pinKind = "amenity",
  presetMeters = null,
  stampAppearance = null,
  stampModelAssetId = null,
  constrainProportions = true,
  onSelect,
  onSelectIds,
  onChangeObject,
  onChangeObjects,
  onCreateObject,
  onCalibrated,
  knownLengthMeters = 10,
  underlayOpacity = 1,
  showGrid = mode === "edit",
  showRulers = mode === "edit",
  snapToObjects = true,
  snapToUnits = false,
  frameNonce = 0,
  fitNonce = 0,
  editLayer = "objects",
  canvasInteractive = true,
  basemapInteractive = false,
  basemapAlignMode = false,
  onBasemapAnchorChange,
  onBasemapDerivedZoom,
  basemapZoomTo = null,
  underlaySvg,
  underlayHoverLayerId,
  editVenueElements = false,
  selectedVenueElementId = null,
  onHoverVenueElement,
  onSelectVenueElement,
  onPreviewVenueSvg,
  onCommitVenueSvg,
  showUnderlay = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nestRef = useRef<SVGSVGElement>(null);
  const lastVenuePreview = useRef<string | null>(null);
  const svgElDrag = useRef<{
    id: string;
    mode: "move" | "vertex" | "handle-in" | "handle-out" | "rotate";
    vertex?: number;
    startMarkup: string;
    ox: number;
    oy: number;
    nodes?: BezierNode[];
    closed?: boolean;
    startAngle?: number;
    startRot?: number;
  } | null>(null);
  const svgElPending = useRef<{
    id: string;
    startMarkup: string;
    ox: number;
    oy: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const cal = floor.calibration;
  const [imgNat, setImgNat] = useState<{ w: number; h: number } | null>(null);
  const size = cal
    ? floorSizeMeters(cal)
    : imgNat
      ? { w: imgNat.w, h: imgNat.h }
      : { w: 80, h: 80 };
  const [cam, setCam] = useState<Cam>({ x: -4, y: -4, w: size.w + 8, h: size.h + 8 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const basemapRef = useRef(floor.basemap);
  basemapRef.current = floor.basemap;
  const camAnim = useRef<number | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<Ring | null>(null);
  const [draftNodes, setDraftNodes] = useState<BezierNode[]>([]);
  const [draftCursor, setDraftCursor] = useState<{ x: number; y: number } | null>(null);
  const [editAnchor, setEditAnchor] = useState<number | null>(null);
  const [venueAnchor, setVenueAnchor] = useState<number | null>(null);
  const penPress = useRef<{ index: number; x: number; y: number } | null>(null);
  const [calPts, setCalPts] = useState<{ x: number; y: number }[]>([]);
  const [calCursor, setCalCursor] = useState<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const viewPress = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const drag = useRef<{
    id: string;
    ids?: string[];
    starts?: { id: string; polygon: Ring | null; path: BezierNode[] | null; x: number | null; y: number | null }[];
    mode: "move" | "resize" | "vertex" | "handle-in" | "handle-out" | "rotate";
    handle?: BoundsHandle;
    ox: number;
    oy: number;
    polygon: Ring | null;
    path?: BezierNode[] | null;
    vertex?: number;
    x: number | null;
    y: number | null;
    startBounds?: ReturnType<typeof ringBounds>;
    startAngle?: number;
    startRot?: number;
  } | null>(null);
  const pendingMove = useRef<{
    clientX: number;
    clientY: number;
    ox: number;
    oy: number;
    ids: string[];
  } | null>(null);
  const marquee = useRef<{ x0: number; y0: number; additive: boolean } | null>(null);
  const [marqueeNow, setMarqueeNow] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const spaceHeld = useRef(false);
  const [spacePan, setSpacePan] = useState(false);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const calPress = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const altSnapOff = useRef(false);
  const [guides, setGuides] = useState<{ gx: number[]; gy: number[] }>({ gx: [], gy: [] });
  const [hoverHandle, setHoverHandle] = useState<BoundsHandle | "rotate" | null>(null);
  const [previewCal, setPreviewCal] = useState<Calibration | null>(null);

  function cancelCamAnim() {
    if (camAnim.current != null) {
      cancelAnimationFrame(camAnim.current);
      camAnim.current = null;
    }
  }

  function animateCam(to: Cam, duration = 420) {
    cancelCamAnim();
    const from = camRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCam(lerpCam(from, to, easeOutCubic(t)));
      if (t < 1) camAnim.current = requestAnimationFrame(tick);
      else camAnim.current = null;
    };
    camAnim.current = requestAnimationFrame(tick);
  }

  function viewAspect(): number {
    const svg = svgRef.current;
    if (svg && svg.clientHeight > 0) return svg.clientWidth / svg.clientHeight;
    return camRef.current.w / camRef.current.h;
  }

  function fitSceneCam(calNow: Calibration | null): Cam {
    return camToFrame(sceneBounds(calNow, objects), viewAspect());
  }

  useEffect(() => {
    if (!fitNonce) return;
    animateCam(fitSceneCam(floor.calibration));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  useEffect(() => {
    if (!frameNonce) return;
    if (selectedId === VENUE_ID && floor.calibration) {
      const v = venueWorldRect(floor.calibration);
      animateCam(camToFrame({ minX: v.minX, minY: v.minY, maxX: v.maxX, maxY: v.maxY }, viewAspect()));
      return;
    }
    if (!selectedId) return;
    const o = objects.find((obj) => obj.id === selectedId);
    if (!o) return;
    const bounds = objectFrameBounds(o);
    if (!bounds) return;
    animateCam(camToFrame(bounds, viewAspect()));
    setPulseId(o.id);
    const t = window.setTimeout(() => setPulseId((id) => (id === o.id ? null : id)), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameNonce]);

  useEffect(() => () => cancelCamAnim(), []);

  useEffect(() => {
    if (underlaySvg) {
      try {
        const vb = svgViewBox(underlaySvg);
        if (vb) {
          setImgNat({ w: vb.w, h: vb.h });
          return;
        }
      } catch {
        /* fall through to image probe */
      }
    }
    setImgNat(null);
    const href = floor.underlayUrl;
    if (!href || typeof Image === "undefined") return;
    const probe = new Image();
    probe.onload = () => setImgNat({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = href;
  }, [floor.underlayUrl, underlaySvg]);

  useEffect(() => {
    if (tool !== "calibrate") {
      setCalPts([]);
      setCalCursor(null);
    }
  }, [tool]);

  const sponsorById = useMemo(() => new Map(sponsors.map((s) => [s.id, s])), [sponsors]);
  const liveCal = previewCal ?? cal;
  const px = liveCal ? axisScale(liveCal) : { x: 0.01, y: 0.01 };
  const venueRect = liveCal ? venueWorldRect(liveCal) : null;
  const canEditVenue = mode === "edit" && editLayer === "venue";
  const canEditObjects = mode === "edit" && editLayer === "objects";
  const drawVenueShapes = canEditVenue && Boolean(underlaySvg);
  const activeIds = selectedIds?.length ? selectedIds : selectedId ? [selectedId] : [];
  const selectedSet = useMemo(() => new Set(activeIds), [activeIds.join("|")]);

  function emitSelect(ids: string[]) {
    if (onSelectIds) {
      onSelectIds(ids);
      return;
    }
    onSelect?.(ids.length ? ids[ids.length - 1] : null);
  }

  function objectsInMarquee(box: { minX: number; minY: number; maxX: number; maxY: number }) {
    return objects.filter((o) => {
      const b = objectFrameBounds(o);
      return b ? boundsOverlap(b, box) : false;
    });
  }

  function commitGroupMove(
    starts: { id: string; polygon: Ring | null; path?: BezierNode[] | null; x: number | null; y: number | null }[],
    dx: number,
    dy: number,
  ) {
    let usedDx = dx;
    let usedDy = dy;
    const primary = starts[0];
    if (primary?.polygon && !altSnapOff.current) {
      const pix = snapBase((primary.polygon[0]?.[0] ?? 0) + dx, (primary.polygon[0]?.[1] ?? 0) + dy);
      usedDx = pix.x - (primary.polygon[0]?.[0] ?? 0);
      usedDy = pix.y - (primary.polygon[0]?.[1] ?? 0);
      const b = ringBounds(primary.polygon);
      const { xs, ys } = objectAlignTargets(primary.id);
      if (xs.length || ys.length) {
        const mag = snapTranslation(b, usedDx, usedDy, xs, ys, snapThreshNow());
        usedDx = mag.dx;
        usedDy = mag.dy;
        setGuides({ gx: mag.gx, gy: mag.gy });
      } else {
        setGuides({ gx: [], gy: [] });
      }
    } else if (primary && primary.x != null && primary.y != null) {
      const p = snapPoint(primary.x + dx, primary.y + dy, primary.id);
      usedDx = p.x - primary.x;
      usedDy = p.y - primary.y;
      setGuides({ gx: p.gx, gy: p.gy });
    } else {
      setGuides({ gx: [], gy: [] });
    }
    const next: MapObject[] = [];
    for (const s of starts) {
      const obj = objects.find((o) => o.id === s.id);
      if (!obj) continue;
      if (isPinObject(obj) && s.x != null && s.y != null) {
        next.push({ ...obj, x: s.x + usedDx, y: s.y + usedDy });
      } else if (s.polygon || s.path) {
        const path = s.path?.length ? translateBezier(s.path, usedDx, usedDy) : null;
        next.push({
          ...obj,
          polygon: path ? tessellate(path, true) : s.polygon ? translateRing(s.polygon, usedDx, usedDy) : obj.polygon,
          path,
        });
      }
    }
    if (!next.length) return;
    if (onChangeObjects) onChangeObjects(next);
    else next.forEach((o) => onChangeObject?.(o));
  }
  const underlayW = venueRect?.w ?? (imgNat?.w ?? 0);
  const underlayH = venueRect?.h ?? (imgNat?.h ?? 0);
  const underlayX = venueRect?.minX ?? 0;
  const underlayY = venueRect?.minY ?? 0;

  function worldToSvgPt(wx: number, wy: number): { x: number; y: number } | null {
    if (!underlaySvg || underlayW <= 0 || underlayH <= 0) return null;
    const vb = svgViewBox(underlaySvg);
    if (!vb) return null;
    return {
      x: vb.x + ((wx - underlayX) / underlayW) * vb.w,
      y: vb.y + ((wy - underlayY) / underlayH) * vb.h,
    };
  }

  function worldNodesToSvg(nodes: BezierNode[]): BezierNode[] | null {
    const out: BezierNode[] = [];
    for (const n of nodes) {
      const p = worldToSvgPt(n.x, n.y);
      const hin = worldToSvgPt(n.x + n.inDx, n.y + n.inDy);
      const hout = worldToSvgPt(n.x + n.outDx, n.y + n.outDy);
      if (!p || !hin || !hout) return null;
      out.push({
        ...n,
        x: p.x,
        y: p.y,
        inDx: hin.x - p.x,
        inDy: hin.y - p.y,
        outDx: hout.x - p.x,
        outDy: hout.y - p.y,
      });
    }
    return out;
  }

  function commitVenueRing(ring: Ring, kind: "rect" | "polygon") {
    if (kind === "polygon") return commitVenuePath(ring.map(([x, y]) => corner(x, y)));
    if (!underlaySvg) return false;
    const pts = ring.map(([x, y]) => worldToSvgPt(x, y)).filter((p): p is { x: number; y: number } => Boolean(p));
    if (pts.length < 3) return false;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    if (maxX - minX < 1 && maxY - minY < 1) return false;
    const next = appendSvgRect(underlaySvg, minX, minY, maxX - minX, maxY - minY);
    onCommitVenueSvg?.(next);
    onSelectVenueElement?.(lastSvgLayerId(next));
    return true;
  }

  function commitVenuePath(nodes: BezierNode[]) {
    if (!underlaySvg) return false;
    const svgNodes = worldNodesToSvg(nodes);
    if (!svgNodes || svgNodes.length < 3) return false;
    const next = appendSvgBezier(underlaySvg, svgNodes, true);
    onCommitVenueSvg?.(next);
    onSelectVenueElement?.(lastSvgLayerId(next));
    return true;
  }

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  function clientToSvgEl(el: SVGGraphicsElement, clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = el.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function venueElFromEvent(e: React.PointerEvent): string | null {
    let node: Element | null = e.target instanceof Element ? e.target : null;
    while (node) {
      const hit = node.closest(`[${LAYER_ATTR}]`);
      if (!hit) return null;
      if (hit.getAttribute(LOCK_ATTR) === "1") {
        node = hit.parentElement;
        continue;
      }
      return hit.getAttribute(LAYER_ATTR);
    }
    return null;
  }

  function nestLayerEl(id: string): SVGGraphicsElement | null {
    const el = nestRef.current?.querySelector(layerAttrSelector(id));
    return el instanceof SVGGraphicsElement ? el : null;
  }

  const hitTest = useCallback(
    (x: number, y: number): MapObject | null => {
      const ppm = svgUserToScreen(svgRef.current, cam.w, cam.h);
      const pinSlop = Math.max(1.6, screenPx(16, ppm));
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (isPinObject(o) && o.x != null && o.y != null) {
          if (hypot(x - o.x, y - o.y) < pinSlop) return o;
        } else if (o.polygon && pointInRing(x, y, o.polygon)) {
          return o;
        }
      }
      return null;
    },
    [objects, cam.w, cam.h],
  );

  useEffect(() => {
    function typing(el: EventTarget | null) {
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      );
    }
    function clearSpace() {
      spaceHeld.current = false;
      setSpacePan(false);
    }
    function onDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (typing(e.target)) return;
      e.preventDefault();
      spaceHeld.current = true;
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
  }, []);

  function snapshotsFor(ids: string[]) {
    return ids
      .map((id) => objects.find((o) => o.id === id))
      .filter((o): o is MapObject => Boolean(o))
      .map((o) => ({
        id: o.id,
        polygon: o.polygon ? o.polygon.map((p) => [...p] as [number, number]) : null,
        path: o.path ? o.path.map((n) => ({ ...n })) : objectShape(o),
        x: o.x,
        y: o.y,
      }));
  }

  function snapThreshNow() {
    const svg = svgRef.current;
    const ppm = svgUserToScreen(svg, cam.w, cam.h);
    return screenPx(10, ppm);
  }

  function snapBase(x: number, y: number) {
    if (altSnapOff.current) return { x, y };
    if (snapToUnits) {
      const g = gridSize(units);
      return { x: snap(x, g), y: snap(y, g) };
    }
    return snapToPixel(x, y, cal);
  }

  function objectAlignTargets(skipId: string | null) {
    if (!snapToObjects) return { xs: [] as number[], ys: [] as number[] };
    return alignmentTargets(objects, skipId, underlayW, underlayH, underlayX, underlayY, {
      objects: true,
      underlay: false,
    });
  }

  function snapPoint(x: number, y: number, skipId: string | null) {
    if (altSnapOff.current) return { x, y, gx: [] as number[], gy: [] as number[] };
    const pix = snapBase(x, y);
    const { xs, ys } = objectAlignTargets(skipId);
    const thresh = snapThreshNow();
    const gx: number[] = [];
    const gy: number[] = [];
    const sx = xs.length ? snapScalar(pix.x, xs, thresh) : null;
    const sy = ys.length ? snapScalar(pix.y, ys, thresh) : null;
    if (sx != null) gx.push(sx);
    if (sy != null) gy.push(sy);
    return { x: sx ?? pix.x, y: sy ?? pix.y, gx, gy };
  }

  function zoomAt(wx: number, wy: number, factor: number) {
    if (!Number.isFinite(factor) || factor === 1) return;
    cancelCamAnim();
    setCam((c) => {
      const svg = svgRef.current;
      const aspect =
        svg && svg.clientHeight > 0 ? svg.clientWidth / svg.clientHeight : c.w / Math.max(c.h, 1e-9);
      const scene = sceneBounds(liveCal, objects);
      const span = Math.max(
        size.w,
        size.h,
        scene.maxX - scene.minX,
        scene.maxY - scene.minY,
        50,
      );
      const nw = Math.max(8, Math.min(span * 8, c.w * factor));
      const nh = nw / aspect;
      if (Math.abs(nw - c.w) < 1e-9 && Math.abs(nh - c.h) < 1e-9) return c;
      const sx = (wx - c.x) / c.w;
      const sy = (wy - c.y) / c.h;
      return { x: wx - sx * nw, y: wy - sy * nh, w: nw, h: nh };
    });
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    zoomAt(w.x, w.y, e.deltaY > 0 ? 1.08 : 0.92);
  }

  function worldToImagePx(p: { x: number; y: number }) {
    const use = liveCal;
    if (!use) return { x: p.x, y: p.y };
    const r = pixelsFromMeters(p.x, p.y, use);
    return { x: r.px, y: r.py };
  }

  function finishCalibrate(p2: { x: number; y: number }) {
    const p1 = calPts[0];
    if (!p1) return;
    if (!Number.isFinite(knownLengthMeters) || knownLengthMeters <= 0) {
      setCalPts([]);
      return;
    }
    const a = worldToImagePx(p1);
    const b = worldToImagePx(p2);
    if (hypot(b.x - a.x, b.y - a.y) < 2) {
      setCalPts([p1]);
      return;
    }
    const widthPx = imgNat?.w ?? cal?.widthPx ?? 1000;
    const heightPx = imgNat?.h ?? cal?.heightPx ?? 1000;
    const next = calibrationFromTwoClicks(a, b, knownLengthMeters, widthPx, heightPx);
    onCalibrated?.(next, cal);
    setCalPts([]);
    setCalCursor(null);
  }

  function placeCalibratePoint(w: { x: number; y: number }) {
    if (calPts.length === 0) setCalPts([w]);
    else finishCalibrate(w);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const w = toWorld(e.clientX, e.clientY);
    altSnapOff.current = e.altKey;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinch.current = {
        dist: hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mid: toWorld((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
      };
      return;
    }

    const placingPin = tool === "icon";
    if (canEditObjects && e.button === 0 && !spaceHeld.current) {
      const ppmPin = svgUserToScreen(svgRef.current, cam.w, cam.h);
      const hrV = screenPx(HANDLE_HALF_PX, ppmPin);
      const solePin =
        selectedSet.size === 1 ? objects.find((o) => selectedSet.has(o.id) && isMapPinObject(o)) : undefined;
      if (solePin && solePin.x != null && solePin.y != null) {
        const rh = rotateHandlePos(amenityBounds(solePin), hrV * 3.2);
        if (hypot(w.x - rh.hx, w.y - rh.hy) <= hrV * 1.8) {
          drag.current = {
            id: solePin.id,
            mode: "rotate",
            ox: rh.cx,
            oy: rh.cy,
            polygon: null,
            x: solePin.x,
            y: solePin.y,
            startAngle: angleDeg(rh.cx, rh.cy, w.x, w.y),
            startRot: solePin.rotation ?? solePin.facingDeg ?? 0,
          };
          return;
        }
      }
      const pinHit = hitTest(w.x, w.y);
      if (pinHit && isMapPinObject(pinHit)) {
        let ids = [...selectedSet].filter((id) => id !== VENUE_ID);
        if (e.shiftKey) {
          ids = ids.includes(pinHit.id) ? ids.filter((id) => id !== pinHit.id) : [...ids, pinHit.id];
        } else if (!ids.includes(pinHit.id)) {
          ids = [pinHit.id];
        }
        emitSelect(ids);
        if (ids.includes(pinHit.id)) {
          pendingMove.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            ox: w.x,
            oy: w.y,
            ids,
          };
        }
        return;
      }
    }
    const panNow = mode === "view" || spaceHeld.current || e.button === 1 || (basemapInteractive && !placingPin);
    if (panNow) {
      panLast.current = { x: e.clientX, y: e.clientY };
      if (mode === "view" && e.button === 0 && !spaceHeld.current) {
        viewPress.current = { x: e.clientX, y: e.clientY, moved: false };
      }
      return;
    }

    if (tool === "select") {
      const ppm = svgUserToScreen(svgRef.current, cam.w, cam.h);
      const hr = screenPx(HANDLE_HALF_PX, ppm);
      const venueSelected = selectedSet.has(VENUE_ID) && selectedSet.size === 1;
      if (canEditVenue && tool === "select" && venueSelected && venueRect && liveCal) {
        let handle: BoundsHandle | null = null;
        for (const h of HANDLES) {
          const [hx, hy] = handleXY(venueRect, h);
          if (hypot(w.x - hx, w.y - hy) <= hr * 1.6) {
            handle = h;
            break;
          }
        }
        if (handle) {
          drag.current = {
            id: VENUE_ID,
            mode: "resize",
            handle,
            ox: w.x,
            oy: w.y,
            polygon: null,
            x: null,
            y: null,
            startBounds: venueRect,
          };
          return;
        }
      }
      if (canEditVenue && editVenueElements && tool === "select" && underlaySvg && !e.shiftKey) {
        const ppm = svgUserToScreen(svgRef.current, cam.w, cam.h);
        const hrEl = screenPx(HANDLE_HALF_PX, ppm);
        if (selectedVenueElementId && elFrameRef.current) {
          const live = nestLayerEl(selectedVenueElementId);
          const selectedLocked = live?.getAttribute(LOCK_ATTR) === "1";
          if (!selectedLocked) {
            const rh = rotateHandlePos(elFrameRef.current, hrEl * 3.2);
            if (hypot(w.x - rh.hx, w.y - rh.hy) <= hrEl * 1.8) {
              svgElDrag.current = {
                id: selectedVenueElementId,
                mode: "rotate",
                startMarkup: underlaySvg,
                ox: rh.cx,
                oy: rh.cy,
                startAngle: angleDeg(rh.cx, rh.cy, w.x, w.y),
                startRot: svgElementRotation(underlaySvg, selectedVenueElementId),
              };
              lastVenuePreview.current = underlaySvg;
              return;
            }
          }
        }
        if (selectedVenueElementId) {
          const live = nestLayerEl(selectedVenueElementId);
          const selectedLocked = live?.getAttribute(LOCK_ATTR) === "1";
          const parsed = !selectedLocked ? svgElementBezier(underlaySvg, selectedVenueElementId) : null;
          const svg = svgRef.current;
          if (live && parsed && svg) {
            const toW = (x: number, y: number) => {
              const pt = svg.createSVGPoint();
              pt.x = x;
              pt.y = y;
              const ctm = live.getScreenCTM();
              if (!ctm) return { x: 0, y: 0 };
              const screen = pt.matrixTransform(ctm);
              return toWorld(screen.x, screen.y);
            };
            if (venueAnchor != null && parsed.nodes[venueAnchor] && e.detail !== 2) {
              const n = parsed.nodes[venueAnchor];
              for (const which of ["out", "in"] as const) {
                const hx = n.x + (which === "out" ? n.outDx : n.inDx);
                const hy = n.y + (which === "out" ? n.outDy : n.inDy);
                const world = toW(hx, hy);
                if (hypot(w.x - world.x, w.y - world.y) <= hrEl * 1.8) {
                  svgElDrag.current = {
                    id: selectedVenueElementId,
                    mode: which === "out" ? "handle-out" : "handle-in",
                    vertex: venueAnchor,
                    startMarkup: underlaySvg,
                    ox: n.x,
                    oy: n.y,
                    nodes: parsed.nodes,
                    closed: parsed.closed,
                  };
                  lastVenuePreview.current = underlaySvg;
                  return;
                }
              }
            }
            const vertexSlop = screenPx(VERTEX_HIT_PX, ppm);
            const strokeSlop = screenPx(STROKE_HIT_PX, ppm);
            for (let i = 0; i < parsed.nodes.length; i++) {
              const world = toW(parsed.nodes[i].x, parsed.nodes[i].y);
              if (hypot(w.x - world.x, w.y - world.y) <= vertexSlop) {
                setVenueAnchor(i);
                if (e.detail === 2) {
                  const nextNodes = toggleSmooth(parsed.nodes, i, parsed.closed);
                  const next = setSvgElementBezier(underlaySvg, selectedVenueElementId, nextNodes, parsed.closed);
                  onCommitVenueSvg?.(next);
                  return;
                }
                const local = clientToSvgEl(live, e.clientX, e.clientY);
                svgElDrag.current = {
                  id: selectedVenueElementId,
                  mode: "vertex",
                  vertex: i,
                  startMarkup: underlaySvg,
                  ox: local.x,
                  oy: local.y,
                  nodes: parsed.nodes,
                  closed: parsed.closed,
                };
                lastVenuePreview.current = underlaySvg;
                return;
              }
            }
            if (e.detail !== 2) {
              const local = clientToSvgEl(live, e.clientX, e.clientY);
              const near = closestOnPath(parsed.nodes, local.x, local.y, parsed.closed);
              if (near && near.t > 0.04 && near.t < 0.96) {
                const worldHit = toW(near.x, near.y);
                if (hypot(w.x - worldHit.x, w.y - worldHit.y) <= strokeSlop) {
                  if (isRectangleShape(parsed.nodes) && !e.altKey) return;
                  const nextNodes = insertNode(parsed.nodes, near.index, near.t, parsed.closed);
                  const next = setSvgElementBezier(underlaySvg, selectedVenueElementId, nextNodes, parsed.closed);
                  onCommitVenueSvg?.(next);
                  setVenueAnchor(near.index + 1);
                  return;
                }
              }
            }
          }
        }
        const elId = venueElFromEvent(e);
        if (elId) {
          onSelectVenueElement?.(elId);
          setVenueAnchor(null);
          const live = nestLayerEl(elId);
          const parent =
            live?.parentNode instanceof SVGGraphicsElement ? live.parentNode : nestRef.current;
          const origin = parent ? clientToSvgEl(parent, e.clientX, e.clientY) : { x: 0, y: 0 };
          svgElPending.current = {
            id: elId,
            startMarkup: underlaySvg,
            ox: origin.x,
            oy: origin.y,
            clientX: e.clientX,
            clientY: e.clientY,
          };
          lastVenuePreview.current = underlaySvg;
          return;
        }
        onSelectVenueElement?.(null);
        setVenueAnchor(null);
      }
      const sole =
        selectedSet.size === 1 ? objects.find((o) => selectedSet.has(o.id)) : undefined;
      if (canEditObjects && tool === "select" && sole) {
        const ppmObj = svgUserToScreen(svgRef.current, cam.w, cam.h);
        const hrV = screenPx(HANDLE_HALF_PX, ppmObj);
        if (isPinObject(sole) && sole.x != null && sole.y != null) {
          const rh = rotateHandlePos(amenityBounds(sole), hrV * 3.2);
          if (hypot(w.x - rh.hx, w.y - rh.hy) <= hrV * 1.8) {
            drag.current = {
              id: sole.id,
              mode: "rotate",
              ox: rh.cx,
              oy: rh.cy,
              polygon: null,
              x: sole.x,
              y: sole.y,
              startAngle: angleDeg(rh.cx, rh.cy, w.x, w.y),
              startRot: sole.rotation ?? sole.facingDeg ?? 0,
            };
            return;
          }
        }
      }
      if (canEditObjects && tool === "select" && sole?.polygon) {
        const shape = objectShape(sole);
        const ppmObj = svgUserToScreen(svgRef.current, cam.w, cam.h);
        const hrV = screenPx(HANDLE_HALF_PX, ppmObj);
        const vertexSlop = screenPx(VERTEX_HIT_PX, ppmObj);
        const strokeSlop = screenPx(STROKE_HIT_PX, ppmObj);
        const rb = ringBounds(sole.polygon);
        const rh = rotateHandlePos(rb, hrV * 3.2);
        if (hypot(w.x - rh.hx, w.y - rh.hy) <= hrV * 1.8) {
          drag.current = {
            id: sole.id,
            mode: "rotate",
            ox: rh.cx,
            oy: rh.cy,
            polygon: sole.polygon.map((p) => [...p] as [number, number]),
            path: shape.map((node) => ({ ...node })),
            x: sole.x,
            y: sole.y,
            startAngle: angleDeg(rh.cx, rh.cy, w.x, w.y),
            startRot: sole.facingDeg ?? sole.rotation ?? 0,
          };
          return;
        }
        if (editAnchor != null && shape[editAnchor] && e.detail !== 2) {
          const n = shape[editAnchor];
          for (const which of ["out", "in"] as const) {
            const hx = n.x + (which === "out" ? n.outDx : n.inDx);
            const hy = n.y + (which === "out" ? n.outDy : n.inDy);
            if (hypot(w.x - hx, w.y - hy) <= hrV * 1.8) {
              drag.current = {
                id: sole.id,
                mode: which === "out" ? "handle-out" : "handle-in",
                vertex: editAnchor,
                ox: w.x,
                oy: w.y,
                polygon: sole.polygon,
                path: shape.map((node) => ({ ...node })),
                x: sole.x,
                y: sole.y,
              };
              return;
            }
          }
        }
        for (let i = 0; i < shape.length; i++) {
          if (hypot(w.x - shape[i].x, w.y - shape[i].y) <= vertexSlop) {
            setEditAnchor(i);
            if (e.detail === 2) {
              const next = commitShape(toggleSmooth(shape, i, true));
              onChangeObject?.({ ...sole, ...next });
              return;
            }
            drag.current = {
              id: sole.id,
              mode: "vertex",
              vertex: i,
              ox: w.x,
              oy: w.y,
              polygon: sole.polygon,
              path: shape.map((node) => ({ ...node })),
              x: sole.x,
              y: sole.y,
            };
            return;
          }
        }
        if (e.detail !== 2) {
          const near = closestOnPath(shape, w.x, w.y, true);
          if (near && near.t > 0.04 && near.t < 0.96 && near.dist <= strokeSlop) {
            if (isRectangleShape(shape) && !e.altKey) return;
            const nextPath = insertNode(shape, near.index, near.t, true);
            const next = commitShape(nextPath);
            onChangeObject?.({ ...sole, ...next });
            setEditAnchor(near.index + 1);
            return;
          }
        }
        const b = ringBounds(sole.polygon);
        let handle: BoundsHandle | null = null;
        for (const h of HANDLES) {
          const [hx, hy] = handleXY(b, h);
          if (hypot(w.x - hx, w.y - hy) <= hr * 1.6) {
            handle = h;
            break;
          }
        }
        if (handle) {
          drag.current = {
            id: sole.id,
            mode: "resize",
            handle,
            ox: w.x,
            oy: w.y,
            polygon: sole.polygon.map((p) => [...p] as [number, number]),
            path: shape.map((node) => ({ ...node })),
            x: sole.x,
            y: sole.y,
            startBounds: b,
          };
          return;
        }
      }
      const hit = canEditObjects ? hitTest(w.x, w.y) : null;
      if (hit) {
        let ids = [...selectedSet].filter((id) => id !== VENUE_ID);
        if (e.shiftKey) {
          ids = ids.includes(hit.id) ? ids.filter((id) => id !== hit.id) : [...ids, hit.id];
        } else if (!ids.includes(hit.id)) {
          ids = [hit.id];
        }
        emitSelect(ids);
        if (canEditObjects && tool === "select" && ids.includes(hit.id)) {
          pendingMove.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            ox: w.x,
            oy: w.y,
            ids,
          };
        }
        return;
      }
      const onVenue =
        venueRect &&
        w.x >= venueRect.minX &&
        w.x <= venueRect.maxX &&
        w.y >= venueRect.minY &&
        w.y <= venueRect.maxY;
      if (canEditVenue && tool === "select" && onVenue && liveCal) {
        emitSelect([VENUE_ID]);
        if (e.shiftKey) {
          drag.current = {
            id: VENUE_ID,
            mode: "move",
            ox: w.x,
            oy: w.y,
            polygon: null,
            x: null,
            y: null,
            startBounds: venueRect,
          };
        }
        return;
      }
      if (canEditObjects && tool === "select") {
        marquee.current = { x0: w.x, y0: w.y, additive: e.shiftKey };
        setMarqueeNow({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
        if (!e.shiftKey) emitSelect([]);
        return;
      }
      emitSelect(canEditVenue ? [VENUE_ID] : []);
      return;
    }

    if (tool === "calibrate") {
      if (!canEditVenue) return;
      calPress.current = { x: e.clientX, y: e.clientY, moved: false };
      setCalCursor(w);
      return;
    }

    if (tool === "icon") {
      if (!canEditObjects) return;
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      onCreateObject?.(
        stampPinObject({
          floorId: floor.id,
          pinKind,
          x: p.x,
          y: p.y,
          amenityType: amenityStamp,
          appearance: stampAppearance,
          modelAssetId: stampModelAssetId,
        }),
      );
      return;
    }

    if (tool === "rect") {
      if (!canEditObjects && !drawVenueShapes) return;
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      if (!drawVenueShapes && presetMeters && e.detail === 1) {
        drawing.current = { x: p.x, y: p.y };
        setDraftRect(rectFromCenter(p.x, p.y, presetMeters.w, presetMeters.d, 0));
        return;
      }
      drawing.current = { x: p.x, y: p.y };
      setDraftRect(rectRing(p.x, p.y, p.x, p.y, 0));
      return;
    }

    if (tool === "polygon") {
      if (!canEditObjects && !drawVenueShapes) return;
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      const first = draftNodes[0];
      const ppm = svgUserToScreen(svgRef.current, cam.w, cam.h);
      const closeR = screenPx(10, ppm);
      if (first && draftNodes.length >= 3 && hypot(p.x - first.x, p.y - first.y) <= closeR) {
        closePolygon();
        return;
      }
      const node = corner(p.x, p.y);
      setDraftNodes((prev) => [...prev, node]);
      penPress.current = { index: draftNodes.length, x: p.x, y: p.y };
      return;
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const factor = pinch.current.dist / Math.max(1, dist);
      zoomAt(pinch.current.mid.x, pinch.current.mid.y, factor);
      pinch.current = { dist, mid: pinch.current.mid };
      return;
    }
    if (svgElPending.current && !svgElDrag.current) {
      const p = svgElPending.current;
      if (hypot(e.clientX - p.clientX, e.clientY - p.clientY) > 4) {
        svgElDrag.current = {
          id: p.id,
          mode: "move",
          startMarkup: p.startMarkup,
          ox: p.ox,
          oy: p.oy,
        };
        svgElPending.current = null;
      }
    }
    if (svgElDrag.current) {
      const d = svgElDrag.current;
      const live = nestLayerEl(d.id);
      if (d.mode === "move") {
        const parent =
          live?.parentNode instanceof SVGGraphicsElement ? live.parentNode : nestRef.current;
        if (parent) {
          const cur = clientToSvgEl(parent, e.clientX, e.clientY);
          const next = translateSvgElement(d.startMarkup, d.id, cur.x - d.ox, cur.y - d.oy);
          lastVenuePreview.current = next;
          onPreviewVenueSvg?.(next);
        }
      } else if (d.mode === "vertex" && d.vertex != null && live) {
        const local = clientToSvgEl(live, e.clientX, e.clientY);
        const lock = e.shiftKey ? !constrainProportions : constrainProportions;
        const next = setSvgElementPoint(d.startMarkup, d.id, d.vertex, local, {
          constrain: lock,
          keepRectangle: !e.altKey,
        });
        lastVenuePreview.current = next;
        onPreviewVenueSvg?.(next);
      } else if ((d.mode === "handle-in" || d.mode === "handle-out") && d.vertex != null && live && d.nodes) {
        const local = clientToSvgEl(live, e.clientX, e.clientY);
        const nextNodes = dragHandle(
          d.nodes,
          d.vertex,
          d.mode === "handle-out" ? "out" : "in",
          local.x,
          local.y,
          e.altKey,
        );
        const next = setSvgElementBezier(d.startMarkup, d.id, nextNodes, d.closed ?? true);
        lastVenuePreview.current = next;
        onPreviewVenueSvg?.(next);
      } else if (d.mode === "rotate" && d.startAngle != null && d.startRot != null) {
        const cur = toWorld(e.clientX, e.clientY);
        let nextDeg = d.startRot + (angleDeg(d.ox, d.oy, cur.x, cur.y) - d.startAngle);
        if (e.shiftKey) nextDeg = snapDeg(nextDeg, 15);
        const next = setSvgElementRotation(d.startMarkup, d.id, nextDeg);
        lastVenuePreview.current = next;
        onPreviewVenueSvg?.(next);
      }
      return;
    }
    if (editVenueElements && canEditVenue) {
      onHoverVenueElement?.(venueElFromEvent(e));
    }
    const w = toWorld(e.clientX, e.clientY);
    altSnapOff.current = e.altKey;
    if (marquee.current) {
      setMarqueeNow({ x0: marquee.current.x0, y0: marquee.current.y0, x1: w.x, y1: w.y });
      return;
    }
    if (pendingMove.current && !drag.current) {
      const p = pendingMove.current;
      if (hypot(e.clientX - p.clientX, e.clientY - p.clientY) > 4) {
        drag.current = {
          id: p.ids[0],
          ids: p.ids,
          starts: snapshotsFor(p.ids),
          mode: "move",
          ox: p.ox,
          oy: p.oy,
          polygon: null,
          x: null,
          y: null,
        };
        pendingMove.current = null;
      }
    }
    if (!drag.current && tool === "select") {
      const ppm = svgUserToScreen(svgRef.current, cam.w, cam.h);
      const hr = screenPx(HANDLE_HALF_PX, ppm);
      if (editVenueElements && selectedVenueElementId && elFrameRef.current) {
        const rh = rotateHandlePos(elFrameRef.current, hr * 3.2);
        setHoverHandle(hypot(w.x - rh.hx, w.y - rh.hy) <= hr * 1.8 ? "rotate" : null);
      } else if (selectedSet.size === 1 && selectedSet.has(VENUE_ID) && venueRect && canEditVenue) {
        let handle: BoundsHandle | null = null;
        for (const h of HANDLES) {
          const [hx, hy] = handleXY(venueRect, h);
          if (hypot(w.x - hx, w.y - hy) <= hr * 1.6) handle = h;
        }
        setHoverHandle(handle);
      } else if (canEditObjects && selectedSet.size === 1) {
        const selected = objects.find((o) => selectedSet.has(o.id));
        if (selected?.polygon) {
          const b = ringBounds(selected.polygon);
          const ppmH = svgUserToScreen(svgRef.current, cam.w, cam.h);
          const hrH = screenPx(HANDLE_HALF_PX, ppmH);
          const rh = rotateHandlePos(b, hrH * 3.2);
          if (hypot(w.x - rh.hx, w.y - rh.hy) <= hrH * 1.8) {
            setHoverHandle("rotate");
          } else {
            let handle: BoundsHandle | null = null;
            for (const h of HANDLES) {
              const [hx, hy] = handleXY(b, h);
              if (hypot(w.x - hx, w.y - hy) <= hr * 1.6) handle = h;
            }
            setHoverHandle(handle);
          }
        } else if (selected && isPinObject(selected) && selected.x != null && selected.y != null) {
          const ppmH = svgUserToScreen(svgRef.current, cam.w, cam.h);
          const hrH = screenPx(HANDLE_HALF_PX, ppmH);
          const rh = rotateHandlePos(amenityBounds(selected), hrH * 3.2);
          setHoverHandle(hypot(w.x - rh.hx, w.y - rh.hy) <= hrH * 1.8 ? "rotate" : null);
        } else {
          setHoverHandle(null);
        }
      } else {
        setHoverHandle(null);
      }
    }
    if (tool === "calibrate") {
      setCalCursor(w);
      if (calPress.current && pointers.current.size === 1) {
        const dist = hypot(e.clientX - calPress.current.x, e.clientY - calPress.current.y);
        if (!calPress.current.moved && dist > 8) calPress.current.moved = true;
      }
    }
    if (drag.current) {
      const d = drag.current;
      if (d.starts?.length && d.mode === "move") {
        commitGroupMove(d.starts, w.x - d.ox, w.y - d.oy);
        return;
      }
      if (d.id === VENUE_ID && d.startBounds && liveCal) {
        const lock = e.shiftKey ? !constrainProportions : constrainProportions;
        let nextB = d.startBounds;
        if (d.mode === "resize" && d.handle) {
          const cursor = snapBase(w.x, w.y);
          nextB = { ...resizeBounds(d.startBounds, d.handle, cursor.x, cursor.y, snapToUnits ? gridSize(units) : 0, lock), w: 0, h: 0 };
          nextB = {
            minX: nextB.minX,
            minY: nextB.minY,
            maxX: nextB.maxX,
            maxY: nextB.maxY,
            w: nextB.maxX - nextB.minX,
            h: nextB.maxY - nextB.minY,
          };
        } else {
          const dx = w.x - d.ox;
          const dy = w.y - d.oy;
          nextB = {
            minX: d.startBounds.minX + dx,
            minY: d.startBounds.minY + dy,
            maxX: d.startBounds.maxX + dx,
            maxY: d.startBounds.maxY + dy,
            w: d.startBounds.w,
            h: d.startBounds.h,
          };
        }
        const src = cal ?? liveCal;
        setPreviewCal(
          calibrationFromWorldRect(nextB, src.widthPx, src.heightPx, src.rotationDeg),
        );
        setGuides({ gx: [nextB.minX, nextB.maxX], gy: [nextB.minY, nextB.maxY] });
        return;
      }
      const obj = objects.find((o) => o.id === d.id);
      if (obj) {
        if (d.mode === "rotate" && d.startAngle != null && d.startRot != null) {
          let nextDeg = d.startRot + (angleDeg(d.ox, d.oy, w.x, w.y) - d.startAngle);
          if (e.shiftKey) nextDeg = snapDeg(nextDeg, 15);
          if (isPinObject(obj)) {
            onChangeObject?.({ ...obj, rotation: nextDeg, facingDeg: nextDeg });
            return;
          }
          const startPath = d.path?.length ? d.path : obj.polygon ? objectShape({ ...obj, polygon: d.polygon, path: d.path }) : [];
          const rotated = commitShape(rotateBezier(startPath, nextDeg - d.startRot));
          onChangeObject?.({
            ...obj,
            polygon: rotated.polygon,
            path: rotated.path,
            facingDeg: nextDeg,
            rotation: nextDeg,
          });
          return;
        }
        if ((d.mode === "vertex" || d.mode === "handle-in" || d.mode === "handle-out") && d.path && d.vertex != null) {
          const cursor = snapBase(w.x, w.y);
          let nextPath = d.path;
          if (d.mode === "vertex") {
            const lock = e.shiftKey ? !constrainProportions : constrainProportions;
            nextPath =
              isRectangleShape(d.path) && !e.altKey
                ? resizeRectangleCorner(d.path, d.vertex, cursor.x, cursor.y, lock)
                : d.path.map((n, i) => (i === d.vertex ? { ...n, x: cursor.x, y: cursor.y } : n));
          } else {
            nextPath = dragHandle(d.path, d.vertex, d.mode === "handle-out" ? "out" : "in", cursor.x, cursor.y, e.altKey);
          }
          const next = commitShape(nextPath);
          onChangeObject?.({ ...obj, ...next });
          return;
        }
        if (d.mode === "resize" && d.polygon && d.handle && d.startBounds) {
          const lock = e.shiftKey ? !constrainProportions : constrainProportions;
          const cursor = snapBase(w.x, w.y);
          const nextB = resizeBounds(
            d.startBounds,
            d.handle,
            cursor.x,
            cursor.y,
            snapToUnits ? gridSize(units) : 0,
            lock,
          );
          const path = d.path?.length
            ? applyBoundsToBezier(d.path, d.startBounds, nextB)
            : null;
          onChangeObject?.({
            ...obj,
            polygon: path ? tessellate(path, true) : applyBoundsToRing(d.polygon, nextB),
            path,
          });
          setGuides({ gx: [nextB.minX, nextB.maxX], gy: [nextB.minY, nextB.maxY] });
          return;
        }
        let dx = w.x - d.ox;
        let dy = w.y - d.oy;
        if (isPinObject(obj)) {
          const rawX = (d.x ?? 0) + dx;
          const rawY = (d.y ?? 0) + dy;
          const p = snapPoint(rawX, rawY, obj.id);
          setGuides({ gx: p.gx, gy: p.gy });
          onChangeObject?.({ ...obj, x: p.x, y: p.y });
        } else if (d.polygon) {
          if (!altSnapOff.current) {
            const pix = snapBase((d.polygon[0]?.[0] ?? 0) + dx, (d.polygon[0]?.[1] ?? 0) + dy);
            dx = pix.x - (d.polygon[0]?.[0] ?? 0);
            dy = pix.y - (d.polygon[0]?.[1] ?? 0);
            const b = ringBounds(d.polygon);
            const { xs, ys } = objectAlignTargets(obj.id);
            if (xs.length || ys.length) {
              const mag = snapTranslation(b, dx, dy, xs, ys, snapThreshNow());
              dx = mag.dx;
              dy = mag.dy;
              setGuides({ gx: mag.gx, gy: mag.gy });
            } else {
              setGuides({ gx: [], gy: [] });
            }
          } else {
            setGuides({ gx: [], gy: [] });
          }
          onChangeObject?.({
            ...obj,
            polygon: translateRing(d.polygon, dx, dy),
            path: d.path?.length ? translateBezier(d.path, dx, dy) : obj.path ? translateBezier(objectShape(obj), dx, dy) : null,
          });
        }
      }
      return;
    }
    if (drawing.current && tool === "rect") {
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      if (!drawVenueShapes && presetMeters) {
        setDraftRect(rectFromCenter(p.x, p.y, presetMeters.w, presetMeters.d, 0));
      } else if (constrainProportions) {
        setDraftRect(squareRectRing(drawing.current.x, drawing.current.y, p.x, p.y, 0));
      } else {
        setDraftRect(rectRing(drawing.current.x, drawing.current.y, p.x, p.y, 0));
      }
      return;
    }
    if (tool === "polygon" && (draftNodes.length || penPress.current)) {
      const p = snapPoint(w.x, w.y, null);
      setDraftCursor({ x: p.x, y: p.y });
      setGuides({ gx: p.gx, gy: p.gy });
      if (penPress.current) {
        const dx = p.x - penPress.current.x;
        const dy = p.y - penPress.current.y;
        const ppm = svgUserToScreen(svgRef.current, cam.w, cam.h);
        if (hypot(dx, dy) > screenPx(3, ppm)) {
          const idx = penPress.current.index;
          setDraftNodes((nodes) => setMirroredHandles(nodes, idx, dx, dy));
        }
      }
      return;
    }
    if (panLast.current && pointers.current.size === 1) {
      const svg = svgRef.current;
      if (!svg) return;
      const dx = e.clientX - panLast.current.x;
      const dy = e.clientY - panLast.current.y;
      if (viewPress.current && hypot(e.clientX - viewPress.current.x, e.clientY - viewPress.current.y) > 6) {
        viewPress.current.moved = true;
      }
      panLast.current = { x: e.clientX, y: e.clientY };
      const ppm = svgUserToScreen(svg, cam.w, cam.h);
      cancelCamAnim();
      if (basemapAlignMode && onBasemapAnchorChange) {
        const bm = basemapRef.current;
        if (!bm?.enabled) return;
        const dxm = dx / ppm;
        const dym = dy / ppm;
        const { east, north } = floorDeltaToEnu(dxm, dym, bm.bearing ?? 0);
        const next = offsetLatLng(bm.lat, bm.lng, east, north);
        const lat = roundBasemapCoord(next.lat);
        const lng = roundBasemapCoord(next.lng);
        basemapRef.current = { ...bm, lat, lng };
        onBasemapAnchorChange({ lat, lng });
        return;
      }
      setCam((c) => ({ ...c, x: c.x - dx / ppm, y: c.y - dy / ppm }));
    }
  }

  function commitRect(ring: Ring) {
    if (drawVenueShapes) {
      commitVenueRing(ring, "rect");
      return;
    }
    const b = ringBounds(ring);
    if (b.w < 0.3 || b.h < 0.3) return;
    const t = nowIso();
    onCreateObject?.({
      id: newId(),
      floorId: floor.id,
      kind: "booth",
      polygon: ring,
      x: null,
      y: null,
      rotation: 0,
      boothNumber: "",
      name: stampAppearance === "stage" ? "Stage" : "",
      sponsorId: null,
      amenityType: null,
      color: null,
      description: "",
      eventDate: "",
      ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelAssetId }),
      createdAt: t,
      updatedAt: t,
    });
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const remaining = pointers.current.size - (pointers.current.has(e.pointerId) ? 1 : 0);
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (svgElDrag.current) {
      const d = svgElDrag.current;
      if (lastVenuePreview.current && lastVenuePreview.current !== d.startMarkup) {
        onCommitVenueSvg?.(lastVenuePreview.current);
      }
      svgElDrag.current = null;
    }
    svgElPending.current = null;
    if (marquee.current && remaining === 0) {
      const w = toWorld(e.clientX, e.clientY);
      const box = marqueeBounds(marquee.current.x0, marquee.current.y0, w.x, w.y);
      const tiny = hypot(w.x - marquee.current.x0, w.y - marquee.current.y0) < screenPx(4, svgUserToScreen(svgRef.current, cam.w, cam.h));
      if (!tiny) {
        const hits = objectsInMarquee(box).map((o) => o.id);
        const ids = marquee.current.additive
          ? [...new Set([...selectedSet, ...hits].filter((id) => id !== VENUE_ID))]
          : hits;
        emitSelect(ids);
      }
      marquee.current = null;
      setMarqueeNow(null);
    }
    pendingMove.current = null;
    if (tool === "calibrate" && calPress.current && !calPress.current.moved && remaining === 0) {
      placeCalibratePoint(toWorld(e.clientX, e.clientY));
    }
    calPress.current = null;
    if (drawing.current && draftRect && tool === "rect") {
      commitRect(draftRect);
    }
    if (previewCal && cal && !calibrationNearlyEqual(previewCal, cal)) {
      onCalibrated?.(previewCal, cal);
      setPreviewCal(null);
    } else if (previewCal) {
      setPreviewCal(null);
    }
    drawing.current = null;
    setDraftRect(null);
    penPress.current = null;
    drag.current = null;
    panLast.current = null;
    if (mode === "view" && viewPress.current && !viewPress.current.moved && remaining === 0) {
      const w = toWorld(e.clientX, e.clientY);
      const hit = hitTest(w.x, w.y);
      emitSelect(hit ? [hit.id] : []);
    }
    viewPress.current = null;
    setGuides({ gx: [], gy: [] });
  }

  function closePolygon() {
    if (draftNodes.length < 3) {
      setDraftNodes([]);
      setDraftCursor(null);
      return;
    }
    if (drawVenueShapes) {
      commitVenuePath(draftNodes);
      setDraftNodes([]);
      setDraftCursor(null);
      return;
    }
    const t = nowIso();
    const shape = commitShape(draftNodes);
    onCreateObject?.({
      id: newId(),
      floorId: floor.id,
      kind: "booth",
      polygon: shape.polygon,
      path: shape.path,
      x: null,
      y: null,
      rotation: 0,
      boothNumber: "",
      name: stampAppearance === "stage" ? "Stage" : "",
      sponsorId: null,
      amenityType: null,
      color: null,
      description: "",
      eventDate: "",
      ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelAssetId }),
      createdAt: t,
      updatedAt: t,
    });
    setDraftNodes([]);
    setDraftCursor(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" && draftNodes.length) closePolygon();
      if ((e.key === "Backspace" || e.key === "Delete") && tool === "polygon" && draftNodes.length) {
        e.preventDefault();
        setDraftNodes((n) => n.slice(0, -1));
        return;
      }
      if (e.key === "Escape") {
        setDraftNodes([]);
        setDraftCursor(null);
        setDraftRect(null);
        setCalPts([]);
        emitSelect([]);
      }
      const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key);
      if (mode === "edit" && arrows) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0) * px.x;
        const dy = (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) * px.y;
        if (selectedSet.has(VENUE_ID) && selectedSet.size === 1 && liveCal && venueRect) {
          if (!canEditVenue) return;
          const next = {
            minX: venueRect.minX + dx,
            minY: venueRect.minY + dy,
            maxX: venueRect.maxX + dx,
            maxY: venueRect.maxY + dy,
          };
          onCalibrated?.(
            calibrationFromWorldRect(next, liveCal.widthPx, liveCal.heightPx, liveCal.rotationDeg),
            cal,
          );
          return;
        }
        const moveIds = [...selectedSet].filter((id) => id !== VENUE_ID);
        if (!moveIds.length || !canEditObjects) return;
        commitGroupMove(snapshotsFor(moveIds), dx, dy);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [viewportTick, setViewportTick] = useState(0);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const bump = () => setViewportTick((n) => n + 1);
    bump();
    const ro = new ResizeObserver(bump);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  const pxPerMeterScreen = svgUserToScreen(svgRef.current, cam.w, cam.h);
  void viewportTick;
  const handleR = screenPx(HANDLE_HALF_PX, pxPerMeterScreen);
  const strokeSelected = screenPx(STROKE_SELECTED_PX, pxPerMeterScreen);
  const strokeDefault = screenPx(STROKE_DEFAULT_PX, pxPerMeterScreen);
  const meterGrid = gridSize(units);
  const showPixelGrid = Boolean(cal) && pxPerMeterScreen * px.x >= 6;
  const [elHandles, setElHandles] = useState<{ x: number; y: number; kind: "anchor" | "in" | "out"; i: number }[]>([]);
  const [elFrame, setElFrame] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const elFrameRef = useRef(elFrame);
  elFrameRef.current = elFrame;
  useLayoutEffect(() => {
    if (!editVenueElements || !selectedVenueElementId || !underlaySvg) {
      setElHandles([]);
      setElFrame(null);
      return;
    }
    const live = nestLayerEl(selectedVenueElementId);
    if (live?.getAttribute(LOCK_ATTR) === "1") {
      setElHandles([]);
      setElFrame(null);
      return;
    }
    const svg = svgRef.current;
    if (!live || !svg) {
      setElHandles([]);
      setElFrame(null);
      return;
    }
    const toW = (x: number, y: number) => {
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const ctm = live.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const screen = pt.matrixTransform(ctm);
      return toWorld(screen.x, screen.y);
    };
    const b = live.getBBox();
    const corners = [
      toW(b.x, b.y),
      toW(b.x + b.width, b.y),
      toW(b.x + b.width, b.y + b.height),
      toW(b.x, b.y + b.height),
    ];
    setElFrame({
      minX: Math.min(...corners.map((p) => p.x)),
      minY: Math.min(...corners.map((p) => p.y)),
      maxX: Math.max(...corners.map((p) => p.x)),
      maxY: Math.max(...corners.map((p) => p.y)),
    });
    const parsed = svgElementBezier(underlaySvg, selectedVenueElementId);
    if (!parsed) {
      setElHandles([]);
      return;
    }
    const next: { x: number; y: number; kind: "anchor" | "in" | "out"; i: number }[] = [];
    parsed.nodes.forEach((n, i) => {
      const a = toW(n.x, n.y);
      next.push({ ...a, kind: "anchor", i });
      if (venueAnchor === i) {
        next.push({ ...toW(n.x + n.inDx, n.y + n.inDy), kind: "in", i });
        next.push({ ...toW(n.x + n.outDx, n.y + n.outDy), kind: "out", i });
      }
    });
    setElHandles(next);
  }, [editVenueElements, selectedVenueElementId, underlaySvg, cam, underlayW, underlayH, viewportTick, venueAnchor]);

  const hallX = underlayX + (underlayW || size.w) / 2;
  const hallY = underlayY + (underlayH || size.h) / 2;
  const leafletCam = useMemo(() => {
    const bm = floor.basemap;
    if (!bm?.enabled) return null;
    return leafletViewFromPlan({
      anchorLat: bm.lat,
      anchorLng: bm.lng,
      anchorX: hallX,
      anchorY: hallY,
      cam,
      metersPerPx: 1 / Math.max(pxPerMeterScreen, 1e-9),
      bearingDeg: bm.bearing ?? 0,
    });
  }, [
    floor.basemap,
    cam,
    hallX,
    hallY,
    pxPerMeterScreen,
  ]);
  const leafletCamRef = useRef(leafletCam);
  leafletCamRef.current = leafletCam;
  const onBasemapDerivedZoomRef = useRef(onBasemapDerivedZoom);
  onBasemapDerivedZoomRef.current = onBasemapDerivedZoom;
  const lastDerivedZoom = useRef<number | null>(null);

  useEffect(() => {
    if (!leafletCam || !Number.isFinite(leafletCam.zoom)) return;
    const z = Math.round(leafletCam.zoom * 100) / 100;
    if (lastDerivedZoom.current === z) return;
    lastDerivedZoom.current = z;
    onBasemapDerivedZoomRef.current?.(z);
  }, [leafletCam]);

  const zoomToNonce = useRef(0);
  useEffect(() => {
    if (!basemapZoomTo || basemapZoomTo.nonce === zoomToNonce.current) return;
    zoomToNonce.current = basemapZoomTo.nonce;
    const currentZ = leafletCamRef.current?.zoom;
    if (currentZ == null || !Number.isFinite(basemapZoomTo.zoom)) return;
    const factor = 2 ** (currentZ - basemapZoomTo.zoom);
    if (!Number.isFinite(factor) || Math.abs(factor - 1) < 1e-6) return;
    const c = camRef.current;
    zoomAt(c.x + c.w / 2, c.y + c.h / 2, factor);
  }, [basemapZoomTo]);

  const underlayHref = floor.underlayUrl;
  let underlayVb: { x: number; y: number; w: number; h: number } | null = null;
  let underlayInner: string | null = null;
  if (underlaySvg) {
    try {
      underlayVb = svgViewBox(underlaySvg);
      underlayInner = svgInnerMarkup(underlaySvg, {
        hoverId: underlayHoverLayerId,
        selectedId: selectedVenueElementId,
      });
    } catch {
      underlayInner = null;
    }
  }

  function points(ring: Ring) {
    return ring.map((p) => p.join(",")).join(" ");
  }

  const osmOn = Boolean(floor.basemap?.enabled);
  const hallLock = {
    x: hallX,
    y: hallY,
    lat: floor.basemap?.lat ?? 0,
    lng: floor.basemap?.lng ?? 0,
  };

  return (
    <PlanStage
      basemap={floor.basemap}
      leafletCam={leafletCam}
      svgRef={svgRef}
      hall={hallLock}
      onWheel={onWheel}
    >
    <svg
      ref={svgRef}
      className={`h-full w-full touch-none select-none ${osmOn ? "bg-transparent" : "bg-[var(--map-bg)]"} ${
        !canvasInteractive && !basemapInteractive ? "pointer-events-none" : ""
      } ${
        tool === "calibrate" || tool === "icon"
          ? "cursor-crosshair"
          : spacePan || basemapInteractive
            ? "cursor-grab"
            : marqueeNow
              ? "cursor-crosshair"
              : ""
      }`}
      style={
        hoverHandle
          ? { cursor: handleCursor(hoverHandle) }
          : panLast.current || spacePan
            ? { cursor: spacePan || panLast.current ? "grabbing" : undefined }
            : undefined
      }
      preserveAspectRatio="xMidYMid meet"
      viewBox={`${cam.x} ${cam.y} ${cam.w} ${cam.h}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => {
        if (tool === "polygon") closePolygon();
      }}
    >
      <defs>
        <pattern id="grid" width={meterGrid} height={meterGrid} patternUnits="userSpaceOnUse">
          <path d={`M ${meterGrid} 0 L 0 0 0 ${meterGrid}`} fill="none" stroke="var(--map-grid)" strokeOpacity="0.28" strokeWidth={meterGrid * 0.012} />
        </pattern>
        {showPixelGrid ? (
          <pattern id="pixgrid" width={px.x} height={px.y} patternUnits="userSpaceOnUse">
            <path d={`M ${px.x} 0 L 0 0 0 ${px.y}`} fill="none" stroke="var(--map-grid)" strokeOpacity="0.45" strokeWidth={px.x * 0.08} />
          </pattern>
        ) : null}
        {objects.map((o) => {
          if (isPinObject(o) || !o.polygon?.length) return null;
          const fillUrl = objectUrls(o, assets).fillTextureUrl;
          if (!fillUrl) return null;
          return (
            <clipPath key={`clip-fill-${o.id}`} id={`clip-fill-${o.id}`}>
              <path d={svgPathD(objectShape(o), true)} />
            </clipPath>
          );
        })}
      </defs>
      {showUnderlay && underlayInner && underlayVb ? (
        <g
          className="map-underlay"
          opacity={underlayOpacity}
          pointerEvents={editVenueElements && canEditVenue && tool === "select" ? "auto" : "none"}
        >
          <svg
            ref={nestRef}
            x={underlayX}
            y={underlayY}
            width={underlayW || size.w}
            height={underlayH || size.h}
            viewBox={`${underlayVb.x} ${underlayVb.y} ${underlayVb.w} ${underlayVb.h}`}
            preserveAspectRatio="none"
            overflow="visible"
            pointerEvents={editVenueElements && canEditVenue && tool === "select" ? "all" : "none"}
          >
            <style>{`
            [data-cm-hover="1"] { outline: 3px solid #ff6a00; outline-offset: 2px; }
            [data-cm-selected="1"] { outline: 2px solid #ff6a00; outline-offset: 1px; }
          `}</style>
            <g dangerouslySetInnerHTML={{ __html: underlayInner }} />
          </svg>
        </g>
      ) : showUnderlay && underlayHref ? (
        <g className="map-underlay" opacity={underlayOpacity} pointerEvents="none">
          <image
            href={underlayHref}
            x={underlayX}
            y={underlayY}
            width={underlayW || size.w}
            height={underlayH || size.h}
            preserveAspectRatio="none"
            pointerEvents="none"
            onLoad={(ev) => {
              const img = ev.currentTarget as unknown as SVGImageElement;
              const w = (img as SVGImageElement).getBBox?.();
              if (!imgNat && typeof Image !== "undefined") {
                const probe = new Image();
                probe.onload = () => setImgNat({ w: probe.naturalWidth, h: probe.naturalHeight });
                probe.src = underlayHref;
              }
              void w;
            }}
          />
        </g>
      ) : osmOn ? null : (
        <rect
          x={underlayX}
          y={underlayY}
          width={underlayW || size.w}
          height={underlayH || size.h}
          fill="var(--map-void)"
        />
      )}
      <rect
        x={underlayX}
        y={underlayY}
        width={underlayW || size.w}
        height={underlayH || size.h}
        fill="none"
        stroke={canEditVenue && selectedSet.has(VENUE_ID) ? "#f97316" : "var(--map-venue-stroke)"}
        strokeWidth={canEditVenue && selectedSet.has(VENUE_ID) ? strokeSelected : strokeDefault}
        strokeDasharray={
          canEditVenue && selectedSet.has(VENUE_ID)
            ? undefined
            : `${screenPx(8, pxPerMeterScreen)} ${screenPx(6, pxPerMeterScreen)}`
        }
        pointerEvents="none"
      />
      {editVenueElements &&
        elHandles.map((p) =>
          p.kind === "anchor" ? (
            <rect
              key={`vh-${p.i}`}
              x={p.x - handleR}
              y={p.y - handleR}
              width={handleR * 2}
              height={handleR * 2}
              fill={venueAnchor === p.i ? "#f97316" : "#fff"}
              stroke="#f97316"
              strokeWidth={handleR * 0.35}
              pointerEvents="none"
            />
          ) : (
            <g key={`vh-${p.kind}-${p.i}`} pointerEvents="none">
              <line
                x1={elHandles.find((h) => h.kind === "anchor" && h.i === p.i)?.x}
                y1={elHandles.find((h) => h.kind === "anchor" && h.i === p.i)?.y}
                x2={p.x}
                y2={p.y}
                stroke="#f97316"
                strokeWidth={handleR * 0.25}
              />
              <circle cx={p.x} cy={p.y} r={handleR * 0.85} fill="#fff" stroke="#f97316" strokeWidth={handleR * 0.3} />
            </g>
          ),
        )}
      {editVenueElements && elFrame ? <RotateKnob box={elFrame} handleR={handleR} /> : null}
      {showGrid && cal ? <rect x={cam.x} y={cam.y} width={cam.w} height={cam.h} fill="url(#grid)" pointerEvents="none" /> : null}
      {showGrid && showPixelGrid ? (
        <rect x={underlayX} y={underlayY} width={underlayW} height={underlayH} fill="url(#pixgrid)" pointerEvents="none" />
      ) : null}

      {objects.map((o) => {
        if (isPinObject(o)) return null;
        const sponsor = o.sponsorId ? sponsorById.get(o.sponsorId) : undefined;
        const selected = selectedSet.has(o.id);
        const highlighted = o.id === highlightId;
        const pulsing = o.id === pulseId;
        if (!o.polygon?.length) return null;
        const b = ringBounds(o.polygon);
        const c = ringCentroid(o.polygon);
        const screenW = b.w * pxPerMeterScreen;
        const screenH = b.h * pxPerMeterScreen;
        const media = objectUrls(o, assets);
        const logoUrl = displayLogoUrl(o, assets, sponsor);
        const fillUrl = media.fillTextureUrl;
        const showLogo = Boolean(logoUrl) && !fillUrl && screenW > 56 && screenH > 32;
        const label = o.boothNumber || sponsor?.name || o.name;
        const sizeLabel = formatSize(b.w, b.h, units);
        const showSize = screenW > 44 && screenH > 22;
        const local = rotateRing(o.polygon, -(o.facingDeg ?? 0));
        const lb = ringBounds(local);
        return (
          <g key={o.id} pointerEvents={canEditVenue ? "none" : undefined}>
            <path
              d={svgPathD(objectShape(o), true)}
              fill={
                highlighted || pulsing
                  ? "rgba(249, 115, 22, 0.45)"
                  : fillUrl
                    ? "transparent"
                    : o.color || tierFill(sponsor?.tier ?? "")
              }
              fillOpacity={mode === "edit" && !fillUrl ? 0.36 : 0.9}
              stroke={selected || pulsing ? "#f97316" : highlighted ? "#f97316" : "var(--map-stroke)"}
              strokeWidth={selected || pulsing ? strokeSelected : strokeDefault}
              className={pulsing ? "map-frame-pulse" : undefined}
            />
            {fillUrl ? (
              <g clipPath={`url(#clip-fill-${o.id})`} pointerEvents="none">
                <image
                  href={fillUrl}
                  x={lb.minX}
                  y={lb.minY}
                  width={lb.w}
                  height={lb.h}
                  transform={`rotate(${o.facingDeg ?? 0} ${c.x} ${c.y})`}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={mode === "edit" ? 0.88 : 1}
                />
                {highlighted || pulsing ? (
                  <path d={svgPathD(objectShape(o), true)} fill="rgba(249, 115, 22, 0.28)" />
                ) : null}
              </g>
            ) : null}
            {showLogo ? (
              <>
                <rect
                  x={b.minX + b.w * 0.12}
                  y={b.minY + b.h * 0.12}
                  width={b.w * 0.76}
                  height={b.h * 0.5}
                  fill="#ffffff"
                  pointerEvents="none"
                />
                <image
                  href={logoUrl}
                  x={b.minX + b.w * 0.12}
                  y={b.minY + b.h * 0.12}
                  width={b.w * 0.76}
                  height={b.h * 0.5}
                  preserveAspectRatio="xMidYMid meet"
                  pointerEvents="none"
                />
              </>
            ) : null}
            {label && (mode === "view" || selected) ? (
              <text
                x={c.x}
                y={showLogo ? b.maxY - b.h * 0.22 : showSize ? c.y - b.h * 0.08 : c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(b.w, b.h) * (showLogo ? 0.16 : 0.2)}
                fill="var(--map-label)"
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fontWeight={700}
                pointerEvents="none"
              >
                {label}
              </text>
            ) : null}
            {showSize ? (
              <text
                x={c.x}
                y={label ? (showLogo ? b.maxY - b.h * 0.08 : c.y + b.h * 0.14) : c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(b.w, b.h) * 0.12}
                fill="var(--map-label-muted)"
                fontFamily="var(--font-mono), ui-monospace, monospace"
                pointerEvents="none"
              >
                {sizeLabel}
              </text>
            ) : null}
          </g>
        );
      })}
      {objects.map((o) => {
        if (!isPinObject(o) || o.x == null || o.y == null) return null;
        const selected = selectedSet.has(o.id);
        const highlighted = o.id === highlightId;
        const pulsing = o.id === pulseId;
        const mapPin = isMapPinObject(o);
        const color = mapPin ? MAP_PIN_META[o.kind].color : AMENITY_COLOR[o.amenityType ?? "info"];
        const mark = mapPin ? MAP_PIN_META[o.kind].mark : (o.amenityType ?? "info").slice(0, 1).toUpperCase();
        return (
          <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rotation ?? 0})`} pointerEvents={canEditVenue ? "none" : undefined}>
            {pulsing ? (
              <circle r={2.4} fill="none" stroke="#f97316" strokeWidth={strokeSelected} className="map-frame-pulse" />
            ) : null}
            {mapPin ? (
              <path
                d="M0 -1.85 C1.15 -1.85 1.7 -0.85 1.7 0.05 C1.7 0.95 0 2.15 0 2.15 C0 2.15 -1.7 0.95 -1.7 0.05 C-1.7 -0.85 -1.15 -1.85 0 -1.85 Z"
                fill={color}
                stroke={selected || highlighted ? "#fff" : "var(--map-icon-ring)"}
                strokeWidth={selected ? strokeSelected : strokeDefault}
              />
            ) : (
              <circle r={1.15} fill={color} stroke={selected || highlighted ? "#fff" : "var(--map-icon-ring)"} strokeWidth={selected ? strokeSelected : strokeDefault} />
            )}
            <text
              textAnchor="middle"
              y={mapPin ? -0.15 : 0.32}
              fontSize={0.7}
              fill="#fff"
              fontFamily="var(--font-sans), system-ui, sans-serif"
              fontWeight={700}
            >
              {mark}
            </text>
          </g>
        );
      })}

      {draftRect ? (
        <g>
          <polygon points={points(draftRect)} fill="rgba(249,115,22,0.2)" stroke="#f97316" strokeWidth={strokeSelected} strokeDasharray={`${screenPx(8, pxPerMeterScreen)} ${screenPx(4, pxPerMeterScreen)}`} />
          {(() => {
            const b = ringBounds(draftRect);
            const c = ringCentroid(draftRect);
            return (
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(0.4, Math.min(b.w, b.h) * 0.16)}
                fill="#f97316"
                fontFamily="var(--font-mono), ui-monospace, monospace"
                pointerEvents="none"
              >
                {formatSize(b.w, b.h, units)}
              </text>
            );
          })()}
        </g>
      ) : null}
      {draftNodes.length ? (
        <g pointerEvents="none">
          <path
            d={svgPathD(
              draftCursor ? [...draftNodes, corner(draftCursor.x, draftCursor.y)] : draftNodes,
              false,
            )}
            fill={draftNodes.length >= 3 ? "rgba(249,115,22,0.12)" : "none"}
            stroke="#f97316"
            strokeWidth={strokeSelected}
          />
          {draftNodes.map((n, i) => (
            <g key={`dn-${i}`}>
              {(n.outDx || n.outDy || n.inDx || n.inDy) && i === draftNodes.length - 1 ? (
                <>
                  <line x1={n.x} y1={n.y} x2={n.x + n.outDx} y2={n.y + n.outDy} stroke="#f97316" strokeWidth={handleR * 0.25} />
                  <line x1={n.x} y1={n.y} x2={n.x + n.inDx} y2={n.y + n.inDy} stroke="#f97316" strokeWidth={handleR * 0.25} />
                  <circle cx={n.x + n.outDx} cy={n.y + n.outDy} r={handleR * 0.75} fill="#fff" stroke="#f97316" strokeWidth={handleR * 0.25} />
                  <circle cx={n.x + n.inDx} cy={n.y + n.inDy} r={handleR * 0.75} fill="#fff" stroke="#f97316" strokeWidth={handleR * 0.25} />
                </>
              ) : null}
              <circle cx={n.x} cy={n.y} r={handleR} fill={i === 0 ? "#f97316" : "#fff"} stroke="#f97316" strokeWidth={handleR * 0.3} />
            </g>
          ))}
        </g>
      ) : null}
      {marqueeNow ? (
        <rect
          x={Math.min(marqueeNow.x0, marqueeNow.x1)}
          y={Math.min(marqueeNow.y0, marqueeNow.y1)}
          width={Math.abs(marqueeNow.x1 - marqueeNow.x0)}
          height={Math.abs(marqueeNow.y1 - marqueeNow.y0)}
          fill="rgba(249,115,22,0.12)"
          stroke="#f97316"
          strokeWidth={strokeSelected}
          strokeDasharray={`${screenPx(8, pxPerMeterScreen)} ${screenPx(4, pxPerMeterScreen)}`}
          pointerEvents="none"
        />
      ) : null}
      {calPts[0] && calCursor ? (
        <line
          x1={calPts[0].x}
          y1={calPts[0].y}
          x2={calCursor.x}
          y2={calCursor.y}
          stroke="#f97316"
          strokeWidth={handleR * 0.35}
          strokeDasharray={`${handleR * 1.2} ${handleR * 0.8}`}
        />
      ) : null}
      {calPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={handleR} fill="#f97316" stroke="#fff" strokeWidth={handleR * 0.25} />
      ))}
      {guides.gx.map((x) => (
        <line
          key={`gx-${x}`}
          x1={x}
          y1={cam.y}
          x2={x}
          y2={cam.y + cam.h}
          stroke="#f97316"
          strokeWidth={strokeSelected}
          strokeOpacity={0.85}
          pointerEvents="none"
        />
      ))}
      {guides.gy.map((y) => (
        <line
          key={`gy-${y}`}
          x1={cam.x}
          y1={y}
          x2={cam.x + cam.w}
          y2={y}
          stroke="#f97316"
          strokeWidth={strokeSelected}
          strokeOpacity={0.85}
          pointerEvents="none"
        />
      ))}
      {mode === "edit" && tool === "select"
        ? (() => {
            if (selectedSet.size !== 1) return null;
            const selected = objects.find((o) => selectedSet.has(o.id));
            const b =
              canEditVenue && selectedSet.has(VENUE_ID) && venueRect
                ? venueRect
                : canEditObjects && selected?.polygon
                  ? ringBounds(selected.polygon)
                  : canEditObjects && selected && isPinObject(selected)
                    ? amenityBounds(selected)
                    : null;
            const shape = canEditObjects && selected?.polygon ? objectShape(selected) : [];
            return (
              <g pointerEvents="none">
                {b && selected && !isPinObject(selected)
                  ? HANDLES.map((h) => {
                      const [x, y] = handleXY(b, h);
                      return (
                        <rect
                          key={h}
                          x={x - handleR}
                          y={y - handleR}
                          width={handleR * 2}
                          height={handleR * 2}
                          fill="#fff"
                          stroke="#f97316"
                          strokeWidth={screenPx(1.5, pxPerMeterScreen)}
                          style={{ cursor: handleCursor(h) }}
                        />
                      );
                    })
                  : null}
                {b && canEditObjects && selected && (selected.polygon || isPinObject(selected)) ? (
                  <RotateKnob box={b} handleR={handleR} />
                ) : null}
                {shape.map((n, i) => (
                  <g key={`an-${i}`}>
                    {editAnchor === i ? (
                      <>
                        <line x1={n.x} y1={n.y} x2={n.x + n.inDx} y2={n.y + n.inDy} stroke="#f97316" strokeWidth={handleR * 0.25} />
                        <line x1={n.x} y1={n.y} x2={n.x + n.outDx} y2={n.y + n.outDy} stroke="#f97316" strokeWidth={handleR * 0.25} />
                        <circle cx={n.x + n.inDx} cy={n.y + n.inDy} r={handleR * 0.85} fill="#fff" stroke="#f97316" strokeWidth={handleR * 0.3} />
                        <circle cx={n.x + n.outDx} cy={n.y + n.outDy} r={handleR * 0.85} fill="#fff" stroke="#f97316" strokeWidth={handleR * 0.3} />
                      </>
                    ) : null}
                    <rect
                      x={n.x - handleR}
                      y={n.y - handleR}
                      width={handleR * 2}
                      height={handleR * 2}
                      fill={editAnchor === i ? "#f97316" : "#fff"}
                      stroke="#f97316"
                      strokeWidth={handleR * 0.35}
                    />
                  </g>
                ))}
              </g>
            );
          })()
        : null}
      {showRulers ? <MapRulers cam={cam} units={units} pxPerMeter={pxPerMeterScreen} /> : null}
    </svg>
    </PlanStage>
  );
}
