export const VENUE_ID = "__venue__";

export type Units = "m" | "ft";

export type AmenityType =
  | "bathroom"
  | "elevator"
  | "stairs"
  | "food"
  | "registration"
  | "exit"
  | "info"
  | "first_aid"
  | "water";

export type ObjectKind = "booth" | "amenity" | "side_event" | "hotel";

export type PinKind = "amenity" | "side_event" | "hotel";

export function isMapPinObject<T extends { kind: ObjectKind }>(
  o: T,
): o is T & { kind: "side_event" | "hotel" } {
  return o.kind === "side_event" || o.kind === "hotel";
}

export function isPinObject(o: { kind: ObjectKind }): boolean {
  return o.kind === "amenity" || isMapPinObject(o);
}

export const MAP_PIN_META = {
  side_event: { label: "Side event", color: "#ea580c", mark: "E" },
  hotel: { label: "Hotel", color: "#0f766e", mark: "H" },
} as const;

export type Appearance = "booth" | "stage" | "custom";

export type LibraryAssetKind = "texture" | "model";

export type ViewMode = "plan" | "hall";

export type Tool = "select" | "rect" | "ellipse" | "polygon" | "icon" | "calibrate" | "label" | "image";

export type Ring = [number, number][];

export type BezierMode = "none" | "mirrored" | "independent";

export type BezierNode = {
  x: number;
  y: number;
  inDx: number;
  inDy: number;
  outDx: number;
  outDy: number;
  mode: BezierMode;
};

export type Calibration = {
  originX: number;
  originY: number;
  metersPerPixel: number;
  /** Vertical metres per image pixel. Falls back to `metersPerPixel` when omitted. */
  metersPerPixelY?: number;
  rotationDeg: number;
  widthPx: number;
  heightPx: number;
};

export type FloorBasemap = {
  enabled: boolean;
  lat: number;
  lng: number;
  zoom: number;
  opacity: number;
  /** MapLibre bearing: 0 = north up, 90 = east up (clockwise from north). */
  bearing: number;
};

export type MapEvent = {
  id: string;
  slug: string;
  name: string;
  airtableBaseId: string;
  airtableTable: string;
  airtableToken: string;
  airtableEventCode: string;
  airtableAgendaTable: string;
  airtableSpeakersTable: string;
  sponsorsSyncedAt: string | null;
  agendaSyncedAt: string | null;
  speakersSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Floor = {
  id: string;
  eventId: string;
  name: string;
  sortOrder: number;
  underlayUrl: string | null;
  originalUrl: string | null;
  calibration: Calibration | null;
  basemap: FloorBasemap | null;
  createdAt: string;
  updatedAt: string;
};

export type MapObject = {
  id: string;
  floorId: string;
  kind: ObjectKind;
  polygon: Ring | null;
  /** Cubic Bézier controls; tessellated into `polygon` for hit-test and 3D. */
  path?: BezierNode[] | null;
  x: number | null;
  y: number | null;
  rotation: number;
  boothNumber: string;
  name: string;
  description: string;
  eventDate: string;
  sponsorId: string | null;
  amenityType: AmenityType | null;
  color: string | null;
  appearance: Appearance | null;
  facingDeg: number;
  modelAssetId: string | null;
  rugTextureAssetId: string | null;
  wallTextureAssetId: string | null;
  logoAssetId: string | null;
  fillTextureAssetId: string | null;
  /** Resolved onto the published snapshot; not stored on draft rows. */
  modelUrl?: string;
  rugTextureUrl?: string;
  wallTextureUrl?: string;
  logoUrl?: string;
  fillTextureUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type LibraryAsset = {
  id: string;
  eventId: string;
  kind: LibraryAssetKind;
  name: string;
  url: string;
  contentType: string;
  createdAt: string;
};

export type AgendaSession = {
  id: string;
  eventId: string;
  airtableId: string;
  title: string;
  stage: string;
  startUnix: number | null;
  endUnix: number | null;
  speakerIds: string[];
  sessionType: string;
};

export type AgendaSpeaker = {
  id: string;
  eventId: string;
  airtableId: string;
  name: string;
  photoUrl: string;
};

export type Sponsor = {
  id: string;
  eventId: string;
  airtableId: string;
  name: string;
  tier: string;
  boothNumber: string;
  logoUrl: string;
  logoWhiteUrl: string;
};

export type Publication = {
  id: string;
  eventId: string;
  snapshot: MapDocument;
  publishedAt: string;
  publishedBy: string;
};

export type MapDocument = {
  version: 1;
  event: { slug: string; name: string };
  publishedAt: string;
  floors: MapDocumentFloor[];
  sponsors: MapDocumentSponsor[];
  sessions?: MapDocumentSession[];
  speakers?: MapDocumentSpeaker[];
};

export type MapDocumentFloor = {
  id: string;
  name: string;
  order: number;
  underlay: {
    url: string | null;
    widthPx: number;
    heightPx: number;
    metersPerPixel: number;
    metersPerPixelY?: number;
    originX: number;
    originY: number;
    rotationDeg: number;
  };
  /** Present when an OSM background was enabled at publish time. */
  basemap?: FloorBasemap | null;
  features: MapGeo.FeatureCollection;
};

export type MapDocumentSponsor = {
  airtableId: string;
  name: string;
  tier: string;
  boothNumber: string;
  logoUrl: string;
  logoWhiteUrl: string;
};

export type MapDocumentSession = {
  airtableId: string;
  title: string;
  stage: string;
  startUnix: number | null;
  endUnix: number | null;
  speakerIds: string[];
  sessionType: string;
};

export type MapDocumentSpeaker = {
  airtableId: string;
  name: string;
  photoUrl: string;
};

export type DraftSlice = {
  floors: Floor[];
  objects: MapObject[];
};

export type DraftVersion = {
  id: string;
  eventId: string;
  createdAt: string;
  createdBy: string;
  snapshot: DraftSlice;
};

export type DraftVersionMeta = Omit<DraftVersion, "snapshot">;

export type DraftBundle = {
  event: MapEvent;
  floors: Floor[];
  objects: MapObject[];
  sponsors: Sponsor[];
  sessions: AgendaSession[];
  speakers: AgendaSpeaker[];
  assets: LibraryAsset[];
  publication: Publication | null;
};

export namespace MapGeo {
  export type Position = [number, number];
  export type Polygon = { type: "Polygon"; coordinates: Position[][] };
  export type Point = { type: "Point"; coordinates: Position };
  export type Geometry = Polygon | Point;
  export type Feature = {
    type: "Feature";
    id?: string;
    geometry: Geometry;
    properties: Record<string, unknown>;
  };
  export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
}
