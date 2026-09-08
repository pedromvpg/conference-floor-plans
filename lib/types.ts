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

export type ObjectKind = "booth" | "amenity";

export type Appearance = "booth" | "stage" | "custom";

export type LibraryAssetKind = "texture" | "model";

export type ViewMode = "plan" | "hall";

export type Tool = "select" | "rect" | "polygon" | "icon" | "calibrate";

export type Ring = [number, number][];

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
  createdAt: string;
  updatedAt: string;
};

export type MapObject = {
  id: string;
  floorId: string;
  kind: ObjectKind;
  polygon: Ring | null;
  x: number | null;
  y: number | null;
  rotation: number;
  boothNumber: string;
  name: string;
  sponsorId: string | null;
  amenityType: AmenityType | null;
  color: string | null;
  appearance: Appearance | null;
  facingDeg: number;
  modelAssetId: string | null;
  rugTextureAssetId: string | null;
  wallTextureAssetId: string | null;
  /** Resolved onto the published snapshot; not stored on draft rows. */
  modelUrl?: string;
  rugTextureUrl?: string;
  wallTextureUrl?: string;
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
  features: GeoJSON.FeatureCollection;
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace GeoJSON {
    type Position = [number, number];
    type Polygon = { type: "Polygon"; coordinates: Position[][] };
    type Point = { type: "Point"; coordinates: Position };
    type Geometry = Polygon | Point;
    type Feature = {
      type: "Feature";
      id?: string;
      geometry: Geometry;
      properties: Record<string, unknown>;
    };
    type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
  }
}
