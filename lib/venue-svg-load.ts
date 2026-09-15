export type VenueSvgFetchSkip = { floorId: string; url: string };

function isSvgUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.split("?")[0].toLowerCase().endsWith(".svg");
}

/** Load published venue markup so overflow past the SVG viewBox still draws. */
export async function fetchVenueSvgMarkup(url: string | null | undefined): Promise<string | null> {
  if (!isSvgUrl(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return /<svg[\s>]/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

/** Skip the underlay GET only when this floor’s URL changed because we just PUT it. */
export function shouldSkipVenueSvgFetch(args: {
  floorChanged: boolean;
  floorId: string;
  underlayUrl: string;
  skip: VenueSvgFetchSkip | null;
}): boolean {
  if (args.floorChanged) return false;
  return args.skip?.floorId === args.floorId && args.skip.url === args.underlayUrl;
}

export function skipAfterVenueSvgPersist(args: {
  viewingFloorId: string;
  targetFloorId: string;
  hasLocalSvg: boolean;
  underlayUrl: string;
}): VenueSvgFetchSkip | null {
  if (args.viewingFloorId !== args.targetFloorId || !args.hasLocalSvg) return null;
  return { floorId: args.targetFloorId, url: args.underlayUrl };
}

type Box = { x: number; y: number; w: number; h: number };

/** Map an expanded SVG drawing box into world metres without changing calibration. */
export function nestedVenuePlacement(viewBox: Box, drawingBox: Box, underlay: Box): Box {
  if (!(viewBox.w > 0) || !(viewBox.h > 0)) return underlay;
  const sx = underlay.w / viewBox.w;
  const sy = underlay.h / viewBox.h;
  return {
    x: underlay.x + (drawingBox.x - viewBox.x) * sx,
    y: underlay.y + (drawingBox.y - viewBox.y) * sy,
    w: drawingBox.w * sx,
    h: drawingBox.h * sy,
  };
}
