import type {
  AgendaSession,
  AgendaSpeaker,
  Floor,
  LibraryAsset,
  MapDocument,
  MapEvent,
  MapGeo,
  MapObject,
  Sponsor,
} from "./types";
import { closeRing } from "./geometry";
import { resolveAppearance } from "./appearance";
import { normalizeFloorBasemap } from "./basemap";

export function buildMapDocument(input: {
  event: MapEvent;
  floors: Floor[];
  objects: MapObject[];
  sponsors: Sponsor[];
  sessions?: AgendaSession[];
  speakers?: AgendaSpeaker[];
  assets?: LibraryAsset[];
  publishedAt: string;
}): MapDocument {
  const sponsorById = new Map(input.sponsors.map((s) => [s.id, s]));
  const assetById = new Map((input.assets ?? []).map((a) => [a.id, a]));
  const floors = [...input.floors].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    version: 1,
    event: { slug: input.event.slug, name: input.event.name },
    publishedAt: input.publishedAt,
    floors: floors.map((floor) => {
      const cal = floor.calibration;
      const features: MapGeo.Feature[] = input.objects
        .filter((o) => o.floorId === floor.id)
        .map((o) => objectToFeature(o, sponsorById, assetById));
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
        basemap: normalizeFloorBasemap(floor.basemap),
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
    sessions: (input.sessions ?? []).map((s) => ({
      airtableId: s.airtableId,
      title: s.title,
      stage: s.stage,
      startUnix: s.startUnix,
      endUnix: s.endUnix,
      speakerIds: s.speakerIds,
      sessionType: s.sessionType,
    })),
    speakers: (input.speakers ?? []).map((s) => ({
      airtableId: s.airtableId,
      name: s.name,
      photoUrl: s.photoUrl,
    })),
  };
}

function objectToFeature(
  o: MapObject,
  sponsorById: Map<string, Sponsor>,
  assetById: Map<string, LibraryAsset>,
): MapGeo.Feature {
  const sponsor = o.sponsorId ? sponsorById.get(o.sponsorId) : undefined;
  const model = o.modelAssetId ? assetById.get(o.modelAssetId) : undefined;
  const rug = o.rugTextureAssetId ? assetById.get(o.rugTextureAssetId) : undefined;
  const wall = o.wallTextureAssetId ? assetById.get(o.wallTextureAssetId) : undefined;
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
    appearance: resolveAppearance(o),
    facingDeg: o.facingDeg ?? 0,
    modelUrl: model?.url ?? "",
    rugTextureUrl: rug?.url ?? "",
    wallTextureUrl: wall?.url ?? "",
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
