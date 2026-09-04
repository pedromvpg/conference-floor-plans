import type {
  Floor,
  MapDocument,
  MapEvent,
  MapObject,
  Sponsor,
} from "./types";
import { closeRing } from "./geometry";

export function buildMapDocument(input: {
  event: MapEvent;
  floors: Floor[];
  objects: MapObject[];
  sponsors: Sponsor[];
  publishedAt: string;
}): MapDocument {
  const sponsorById = new Map(input.sponsors.map((s) => [s.id, s]));
  const floors = [...input.floors].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    version: 1,
    event: { slug: input.event.slug, name: input.event.name },
    publishedAt: input.publishedAt,
    floors: floors.map((floor) => {
      const cal = floor.calibration;
      const features: GeoJSON.Feature[] = input.objects
        .filter((o) => o.floorId === floor.id)
        .map((o) => objectToFeature(o, sponsorById));
      return {
        id: floor.id,
        name: floor.name,
        order: floor.sortOrder,
        underlay: {
          url: floor.underlayUrl,
          widthPx: cal?.widthPx ?? 0,
          heightPx: cal?.heightPx ?? 0,
          metersPerPixel: cal?.metersPerPixel ?? 0.1,
          metersPerPixelY: cal?.metersPerPixelY ?? cal?.metersPerPixel ?? 0.1,
          originX: cal?.originX ?? 0,
          originY: cal?.originY ?? 0,
          rotationDeg: cal?.rotationDeg ?? 0,
        },
        features: { type: "FeatureCollection", features },
      };
    }),
    sponsors: input.sponsors.map((s) => ({
      airtableId: s.airtableId,
      name: s.name,
      tier: s.tier,
      boothNumber: s.boothNumber,
      logoUrl: s.logoUrl,
      logoWhiteUrl: s.logoWhiteUrl,
    })),
  };
}

function objectToFeature(
  o: MapObject,
  sponsorById: Map<string, Sponsor>,
): GeoJSON.Feature {
  const sponsor = o.sponsorId ? sponsorById.get(o.sponsorId) : undefined;
  const properties: Record<string, unknown> = {
    kind: o.kind,
    boothNumber: o.boothNumber || sponsor?.boothNumber || "",
    name: o.name || sponsor?.name || o.boothNumber,
    airtableId: sponsor?.airtableId ?? null,
    tier: sponsor?.tier ?? "",
    logoUrl: sponsor?.logoUrl ?? "",
    amenityType: o.amenityType,
    color: o.color,
    rotation: o.rotation,
  };

  if (o.kind === "amenity" && o.x != null && o.y != null) {
    return {
      type: "Feature",
      id: o.id,
      geometry: { type: "Point", coordinates: [o.x, o.y] },
      properties,
    };
  }

  const ring = closeRing(o.polygon ?? []);
  return {
    type: "Feature",
    id: o.id,
    geometry: {
      type: "Polygon",
      coordinates: [ring.length ? ring : []],
    },
    properties,
  };
}
