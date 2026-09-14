export type VenueSvgFetchSkip = { floorId: string; url: string };

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
