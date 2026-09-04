import type {
  DraftBundle,
  DraftSlice,
  DraftVersionMeta,
  Floor,
  MapEvent,
  MapObject,
  Publication,
  Sponsor,
} from "./types";

export type NewEventInput = {
  name: string;
  slug: string;
  airtableBaseId?: string;
  airtableTable?: string;
  airtableToken?: string;
  airtableEventCode?: string;
};

export interface Store {
  listEvents(): Promise<MapEvent[]>;
  getEventBySlug(slug: string): Promise<MapEvent | null>;
  createEvent(input: NewEventInput): Promise<MapEvent>;
  updateEvent(id: string, patch: Partial<NewEventInput>): Promise<MapEvent>;
  getDraft(slug: string): Promise<DraftBundle | null>;
  listFloors(eventId: string): Promise<Floor[]>;
  getFloor(id: string): Promise<Floor | null>;
  createFloor(eventId: string, name: string): Promise<Floor>;
  updateFloor(id: string, patch: Partial<Floor>): Promise<Floor>;
  deleteFloor(id: string): Promise<void>;
  upsertObject(obj: MapObject): Promise<MapObject>;
  deleteObject(id: string): Promise<void>;
  replaceSponsors(eventId: string, sponsors: Omit<Sponsor, "id" | "eventId">[]): Promise<Sponsor[]>;
  listSponsors(eventId: string): Promise<Sponsor[]>;
  publish(eventId: string, publishedBy: string): Promise<Publication>;
  getPublicationBySlug(slug: string): Promise<Publication | null>;
  replaceDraft(eventId: string, slice: DraftSlice): Promise<DraftSlice>;
  listDraftVersions(eventId: string): Promise<DraftVersionMeta[]>;
  saveDraftVersion(eventId: string, createdBy: string): Promise<DraftVersionMeta | null>;
  restoreDraftVersion(eventId: string, versionId: string): Promise<DraftSlice>;
  isEditor(email: string): Promise<boolean>;
  addEditor(email: string): Promise<void>;
  putFile(path: string, body: Buffer, contentType: string): Promise<string>;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
