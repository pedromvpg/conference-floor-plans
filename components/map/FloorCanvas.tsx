"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AmenityType,
  Appearance,
  Calibration,
  Floor,
  MapObject,
  Ring,
  Sponsor,
  Tool,
  Units,
} from "@/lib/types";
import { VENUE_ID } from "@/lib/types";

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
  snapToPixel,
  snapScalar,
  snapTranslation,
  squareRectRing,
  translateRing,
  venueWorldRect,
  type BoundsHandle,
} from "@/lib/geometry";
import { formatSize, gridSize } from "@/lib/units";
import { AMENITY_COLOR, amenityLabel } from "@/lib/amenities";
import { tierFill } from "@/lib/colors";
import { newId, nowIso } from "@/lib/store";
import { hallDefaults } from "@/lib/appearance";

type Props = {
  mode: "edit" | "view";
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  selectedId: string | null;
  highlightId?: string | null;
  tool?: Tool;
  units?: Units;
  amenityStamp?: AmenityType;
  presetId?: string | null;
  presetMeters?: { w: number; d: number } | null;
  stampAppearance?: Appearance | null;
  stampModelAssetId?: string | null;
  constrainProportions?: boolean;
  onSelect?: (id: string | null) => void;
  onChangeObject?: (obj: MapObject) => void;
  onCreateObject?: (obj: MapObject) => void;
  onCalibrated?: (cal: Calibration, previous: Calibration | null) => void;
  knownLengthMeters?: number;
  underlayOpacity?: number;
  /** Increment to animate the camera so `selectedId` fills the view. */
  frameNonce?: number;
  /** Increment to frame the drawing and all objects. */
  fitNonce?: number;
  /** Venue tab edits the drawing; objects tab edits booths and icons. */
  editLayer?: "objects" | "venue";
};

type Cam = { x: number; y: number; w: number; h: number };

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
  if (o.kind === "amenity" && o.x != null && o.y != null) {
    const r = 3;
    return { minX: o.x - r, minY: o.y - r, maxX: o.x + r, maxY: o.y + r };
  }
  if (o.polygon?.length) {
    const b = ringBounds(o.polygon);
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  }
  return null;
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

export function FloorCanvas({
  mode,
  floor,
  objects,
  sponsors,
  selectedId,
  highlightId,
  tool = "select",
  units = "m",
  amenityStamp = "bathroom",
  presetMeters = null,
  stampAppearance = null,
  stampModelAssetId = null,
  constrainProportions = true,
  onSelect,
  onChangeObject,
  onCreateObject,
  onCalibrated,
  knownLengthMeters = 10,
  underlayOpacity = 1,
  frameNonce = 0,
  fitNonce = 0,
  editLayer = "objects",
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
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
  const camAnim = useRef<number | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<Ring | null>(null);
  const [draftPoly, setDraftPoly] = useState<Ring>([]);
  const [calPts, setCalPts] = useState<{ x: number; y: number }[]>([]);
  const [calCursor, setCalCursor] = useState<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | "resize";
    handle?: BoundsHandle;
    ox: number;
    oy: number;
    polygon: Ring | null;
    x: number | null;
    y: number | null;
    startBounds?: ReturnType<typeof ringBounds>;
  } | null>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const calPress = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const altSnapOff = useRef(false);
  const [guides, setGuides] = useState<{ gx: number[]; gy: number[] }>({ gx: [], gy: [] });
  const [hoverHandle, setHoverHandle] = useState<BoundsHandle | null>(null);
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
    cancelCamAnim();
    setCam(fitSceneCam(floor.calibration));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id]);

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
    setImgNat(null);
    const href = floor.underlayUrl;
    if (!href || typeof Image === "undefined") return;
    const probe = new Image();
    probe.onload = () => setImgNat({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = href;
  }, [floor.underlayUrl]);

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
  const underlayW = venueRect?.w ?? (imgNat?.w ?? 0);
  const underlayH = venueRect?.h ?? (imgNat?.h ?? 0);
  const underlayX = venueRect?.minX ?? 0;
  const underlayY = venueRect?.minY ?? 0;

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

  const hitTest = useCallback(
    (x: number, y: number): MapObject | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (o.kind === "amenity" && o.x != null && o.y != null) {
          if (hypot(x - o.x, y - o.y) < 1.6) return o;
        } else if (o.polygon && pointInRing(x, y, o.polygon)) {
          return o;
        }
      }
      return null;
    },
    [objects],
  );

  function snapThreshNow() {
    const svg = svgRef.current;
    const ppm = svg ? svg.clientWidth / cam.w : 10;
    return 10 / Math.max(ppm, 0.001);
  }

  function snapPoint(x: number, y: number, skipId: string | null) {
    if (altSnapOff.current) return { x, y, gx: [] as number[], gy: [] as number[] };
    const pix = snapToPixel(x, y, cal);
    const { xs, ys } = alignmentTargets(objects, skipId, underlayW, underlayH, underlayX, underlayY);
    const thresh = snapThreshNow();
    const gx: number[] = [];
    const gy: number[] = [];
    const sx = snapScalar(pix.x, xs, thresh);
    const sy = snapScalar(pix.y, ys, thresh);
    if (sx != null) gx.push(sx);
    if (sy != null) gy.push(sy);
    return { x: sx ?? pix.x, y: sy ?? pix.y, gx, gy };
  }

  function zoomAt(wx: number, wy: number, factor: number) {
    cancelCamAnim();
    setCam((c) => {
      const scene = sceneBounds(liveCal, objects);
      const span = Math.max(
        size.w,
        size.h,
        scene.maxX - scene.minX,
        scene.maxY - scene.minY,
        50,
      );
      const nw = Math.max(8, Math.min(span * 8, c.w * factor));
      const nh = nw * (c.h / c.w);
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

    if (mode === "view" || tool === "select") {
      const ppm = svgRef.current ? svgRef.current.clientWidth / cam.w : 10;
      const hr = 7 / Math.max(ppm, 0.001);
      const venueSelected = selectedId === VENUE_ID;
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
      const selected = objects.find((o) => o.id === selectedId);
      if (canEditObjects && tool === "select" && selected?.polygon) {
        const b = ringBounds(selected.polygon);
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
            id: selected.id,
            mode: "resize",
            handle,
            ox: w.x,
            oy: w.y,
            polygon: selected.polygon.map((p) => [...p] as [number, number]),
            x: selected.x,
            y: selected.y,
            startBounds: b,
          };
          return;
        }
      }
      const hit = canEditObjects || mode === "view" ? hitTest(w.x, w.y) : null;
      if (hit) {
        onSelect?.(hit.id);
        if (canEditObjects && tool === "select") {
          drag.current = {
            id: hit.id,
            mode: "move",
            ox: w.x,
            oy: w.y,
            polygon: hit.polygon ? hit.polygon.map((p) => [...p] as [number, number]) : null,
            x: hit.x,
            y: hit.y,
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
        onSelect?.(VENUE_ID);
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
          return;
        }
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      onSelect?.(canEditVenue ? VENUE_ID : null);
      panLast.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (tool === "calibrate") {
      if (!canEditVenue) {
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      calPress.current = { x: e.clientX, y: e.clientY, moved: false };
      setCalCursor(w);
      return;
    }

    if (tool === "icon") {
      if (!canEditObjects) {
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const t = nowIso();
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      onCreateObject?.({
        id: newId(),
        floorId: floor.id,
        kind: "amenity",
        polygon: null,
        x: p.x,
        y: p.y,
        rotation: 0,
        boothNumber: "",
        name: amenityLabel(amenityStamp),
        sponsorId: null,
        amenityType: amenityStamp,
        color: null,
        ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelAssetId }),
        createdAt: t,
        updatedAt: t,
      });
      return;
    }

    if (tool === "rect") {
      if (!canEditObjects) {
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      if (presetMeters && e.detail === 1) {
        drawing.current = { x: p.x, y: p.y };
        setDraftRect(rectFromCenter(p.x, p.y, presetMeters.w, presetMeters.d, 0));
        return;
      }
      drawing.current = { x: p.x, y: p.y };
      setDraftRect(rectRing(p.x, p.y, p.x, p.y, 0));
      return;
    }

    if (tool === "polygon") {
      if (!canEditObjects) {
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      setDraftPoly((prev) => [...prev, [p.x, p.y]]);
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
    const w = toWorld(e.clientX, e.clientY);
    altSnapOff.current = e.altKey;
    if (!drag.current && tool === "select" && selectedId) {
      const ppm = svgRef.current ? svgRef.current.clientWidth / cam.w : 10;
      const hr = 7 / Math.max(ppm, 0.001);
      if (selectedId === VENUE_ID && venueRect && canEditVenue) {
        let handle: BoundsHandle | null = null;
        for (const h of HANDLES) {
          const [hx, hy] = handleXY(venueRect, h);
          if (hypot(w.x - hx, w.y - hy) <= hr * 1.6) handle = h;
        }
        setHoverHandle(handle);
      } else if (canEditObjects) {
        const selected = objects.find((o) => o.id === selectedId);
        if (selected?.polygon) {
          const b = ringBounds(selected.polygon);
          let handle: BoundsHandle | null = null;
          for (const h of HANDLES) {
            const [hx, hy] = handleXY(b, h);
            if (hypot(w.x - hx, w.y - hy) <= hr * 1.6) handle = h;
          }
          setHoverHandle(handle);
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
        if (!calPress.current.moved && dist > 8) {
          calPress.current.moved = true;
          panLast.current = { x: e.clientX, y: e.clientY };
        }
      }
    }
    if (drag.current) {
      const d = drag.current;
      if (d.id === VENUE_ID && d.startBounds && liveCal) {
        const lock = e.shiftKey ? !constrainProportions : constrainProportions;
        let nextB = d.startBounds;
        if (d.mode === "resize" && d.handle) {
          const cursor = altSnapOff.current ? w : snapToPixel(w.x, w.y, liveCal);
          nextB = { ...resizeBounds(d.startBounds, d.handle, cursor.x, cursor.y, 0, lock), w: 0, h: 0 };
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
        if (d.mode === "resize" && d.polygon && d.handle && d.startBounds) {
          const lock = e.shiftKey ? !constrainProportions : constrainProportions;
          const cursor = altSnapOff.current ? w : snapToPixel(w.x, w.y, cal);
          const nextB = resizeBounds(d.startBounds, d.handle, cursor.x, cursor.y, 0, lock);
          onChangeObject?.({ ...obj, polygon: applyBoundsToRing(d.polygon, nextB) });
          setGuides({ gx: [nextB.minX, nextB.maxX], gy: [nextB.minY, nextB.maxY] });
          return;
        }
        let dx = w.x - d.ox;
        let dy = w.y - d.oy;
        if (obj.kind === "amenity") {
          const rawX = (d.x ?? 0) + dx;
          const rawY = (d.y ?? 0) + dy;
          const p = snapPoint(rawX, rawY, obj.id);
          setGuides({ gx: p.gx, gy: p.gy });
          onChangeObject?.({ ...obj, x: p.x, y: p.y });
        } else if (d.polygon) {
          if (!altSnapOff.current) {
            const pix = snapToPixel((d.polygon[0]?.[0] ?? 0) + dx, (d.polygon[0]?.[1] ?? 0) + dy, cal);
            dx = pix.x - (d.polygon[0]?.[0] ?? 0);
            dy = pix.y - (d.polygon[0]?.[1] ?? 0);
            const b = ringBounds(d.polygon);
            const { xs, ys } = alignmentTargets(objects, obj.id, underlayW, underlayH, underlayX, underlayY);
            const mag = snapTranslation(b, dx, dy, xs, ys, snapThreshNow());
            dx = mag.dx;
            dy = mag.dy;
            setGuides({ gx: mag.gx, gy: mag.gy });
          } else {
            setGuides({ gx: [], gy: [] });
          }
          onChangeObject?.({ ...obj, polygon: translateRing(d.polygon, dx, dy) });
        }
      }
      return;
    }
    if (drawing.current && tool === "rect") {
      const p = snapPoint(w.x, w.y, null);
      setGuides({ gx: p.gx, gy: p.gy });
      if (presetMeters) {
        setDraftRect(rectFromCenter(p.x, p.y, presetMeters.w, presetMeters.d, 0));
      } else if (constrainProportions) {
        setDraftRect(squareRectRing(drawing.current.x, drawing.current.y, p.x, p.y, 0));
      } else {
        setDraftRect(rectRing(drawing.current.x, drawing.current.y, p.x, p.y, 0));
      }
      return;
    }
    if (panLast.current && pointers.current.size === 1) {
      const svg = svgRef.current;
      if (!svg) return;
      const dx = e.clientX - panLast.current.x;
      const dy = e.clientY - panLast.current.y;
      panLast.current = { x: e.clientX, y: e.clientY };
      const k = cam.w / svg.clientWidth;
      cancelCamAnim();
      setCam((c) => ({ ...c, x: c.x - dx * k, y: c.y - dy * k }));
    }
  }

  function commitRect(ring: Ring) {
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
      ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelAssetId }),
      createdAt: t,
      updatedAt: t,
    });
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const remaining = pointers.current.size - (pointers.current.has(e.pointerId) ? 1 : 0);
    pointers.current.delete(e.pointerId);
    pinch.current = null;
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
    drag.current = null;
    panLast.current = null;
    setGuides({ gx: [], gy: [] });
  }

  function closePolygon() {
    if (draftPoly.length < 3) {
      setDraftPoly([]);
      return;
    }
    const t = nowIso();
    onCreateObject?.({
      id: newId(),
      floorId: floor.id,
      kind: "booth",
      polygon: draftPoly,
      x: null,
      y: null,
      rotation: 0,
      boothNumber: "",
      name: stampAppearance === "stage" ? "Stage" : "",
      sponsorId: null,
      amenityType: null,
      color: null,
      ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelAssetId }),
      createdAt: t,
      updatedAt: t,
    });
    setDraftPoly([]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" && draftPoly.length) closePolygon();
      if (e.key === "Escape") {
        setDraftPoly([]);
        setDraftRect(null);
        setCalPts([]);
        onSelect?.(null);
      }
      if (mode === "edit" && selectedId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0) * px.x;
        const dy = (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) * px.y;
        if (selectedId === VENUE_ID && liveCal && venueRect) {
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
        const obj = objects.find((o) => o.id === selectedId);
        if (!obj || !canEditObjects) return;
        if (obj.kind === "amenity" && obj.x != null && obj.y != null) {
          const p = snapToPixel(obj.x + dx, obj.y + dy, cal);
          onChangeObject?.({ ...obj, x: p.x, y: p.y });
        } else if (obj.polygon) {
          onChangeObject?.({ ...obj, polygon: translateRing(obj.polygon, dx, dy) });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [pxPerMeterScreen, setPxPerMeterScreen] = useState(10);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => setPxPerMeterScreen(svg.clientWidth / cam.w);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [cam.w]);

  const handleR = 7 / Math.max(pxPerMeterScreen, 0.001);
  const meterGrid = gridSize(units);
  const showPixelGrid = Boolean(cal) && pxPerMeterScreen * px.x >= 6;

  const underlayHref = floor.underlayUrl;

  function points(ring: Ring) {
    return ring.map((p) => p.join(",")).join(" ");
  }

  return (
    <svg
      ref={svgRef}
      className={`h-full w-full touch-none bg-[var(--map-bg)] select-none ${tool === "calibrate" ? "cursor-crosshair" : ""}`}
      style={hoverHandle ? { cursor: handleCursor(hoverHandle) } : undefined}
      viewBox={`${cam.x} ${cam.y} ${cam.w} ${cam.h}`}
      onWheel={onWheel}
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
      </defs>
      {underlayHref ? (
        <image
          href={underlayHref}
          x={underlayX}
          y={underlayY}
          width={underlayW || size.w}
          height={underlayH || size.h}
          opacity={underlayOpacity}
          preserveAspectRatio="none"
          className="map-underlay"
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
      ) : (
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
        stroke={canEditVenue && selectedId === VENUE_ID ? "#f97316" : "var(--map-venue-stroke)"}
        strokeWidth={Math.max(size.w, size.h) * (canEditVenue && selectedId === VENUE_ID ? 0.0035 : 0.002)}
        strokeDasharray={canEditVenue && selectedId === VENUE_ID ? undefined : `${Math.max(size.w, size.h) * 0.012} ${Math.max(size.w, size.h) * 0.008}`}
        pointerEvents="none"
      />
      {mode === "edit" && cal ? <rect x={cam.x} y={cam.y} width={cam.w} height={cam.h} fill="url(#grid)" pointerEvents="none" /> : null}
      {mode === "edit" && showPixelGrid ? (
        <rect x={underlayX} y={underlayY} width={underlayW} height={underlayH} fill="url(#pixgrid)" pointerEvents="none" />
      ) : null}

      {objects.map((o) => {
        const sponsor = o.sponsorId ? sponsorById.get(o.sponsorId) : undefined;
        const selected = canEditObjects && o.id === selectedId;
        const highlighted = o.id === highlightId;
        const pulsing = o.id === pulseId;
        if (o.kind === "amenity" && o.x != null && o.y != null) {
          const color = AMENITY_COLOR[o.amenityType ?? "info"];
          return (
            <g key={o.id} transform={`translate(${o.x} ${o.y})`}>
              {pulsing ? (
                <circle r={2.4} fill="none" stroke="#f97316" strokeWidth={0.22} className="map-frame-pulse" />
              ) : null}
              <circle r={1.15} fill={color} stroke={selected || highlighted ? "#fff" : "var(--map-icon-ring)"} strokeWidth={selected ? 0.18 : 0.08} />
              <text
                textAnchor="middle"
                y={0.32}
                fontSize={0.7}
                fill="#fff"
                fontFamily="var(--font-sans), system-ui, sans-serif"
                fontWeight={700}
              >
                {(o.amenityType ?? "info").slice(0, 1).toUpperCase()}
              </text>
            </g>
          );
        }
        if (!o.polygon?.length) return null;
        const b = ringBounds(o.polygon);
        const c = ringCentroid(o.polygon);
        const screenW = b.w * pxPerMeterScreen;
        const screenH = b.h * pxPerMeterScreen;
        const showLogo = Boolean(sponsor?.logoUrl) && screenW > 56 && screenH > 32;
        const label = o.boothNumber || sponsor?.name || o.name;
        const sizeLabel = formatSize(b.w, b.h, units);
        const showSize = screenW > 44 && screenH > 22;
        return (
          <g key={o.id}>
            <polygon
              points={points(o.polygon)}
              fill={
                highlighted || pulsing
                  ? "rgba(249, 115, 22, 0.45)"
                  : o.color || tierFill(sponsor?.tier ?? "")
              }
              fillOpacity={mode === "edit" ? 0.36 : 0.9}
              stroke={selected || pulsing ? "#f97316" : highlighted ? "#f97316" : "var(--map-stroke)"}
              strokeWidth={selected || pulsing ? 0.22 : 0.08}
              className={pulsing ? "map-frame-pulse" : undefined}
            />
            {showLogo ? (
              <image
                href={sponsor!.logoUrl}
                x={b.minX + b.w * 0.12}
                y={b.minY + b.h * 0.12}
                width={b.w * 0.76}
                height={b.h * 0.5}
                preserveAspectRatio="xMidYMid meet"
                pointerEvents="none"
              />
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

      {draftRect ? (
        <g>
          <polygon points={points(draftRect)} fill="rgba(249,115,22,0.2)" stroke="#f97316" strokeWidth={0.12} strokeDasharray="0.4 0.2" />
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
      {draftPoly.length ? (
        <polyline
          points={points(draftPoly)}
          fill="none"
          stroke="#f97316"
          strokeWidth={0.12}
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
          strokeWidth={2 / Math.max(pxPerMeterScreen, 0.001)}
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
          strokeWidth={2 / Math.max(pxPerMeterScreen, 0.001)}
          strokeOpacity={0.85}
          pointerEvents="none"
        />
      ))}
      {mode === "edit" && tool === "select"
        ? (() => {
            const b =
              canEditVenue && selectedId === VENUE_ID && venueRect
                ? venueRect
                : canEditObjects
                  ? (() => {
                      const selected = objects.find((o) => o.id === selectedId);
                      return selected?.polygon ? ringBounds(selected.polygon) : null;
                    })()
                  : null;
            if (!b) return null;
            return HANDLES.map((h) => {
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
                  strokeWidth={handleR * 0.22}
                  style={{ cursor: handleCursor(h) }}
                />
              );
            });
          })()
        : null}
    </svg>
  );
}
