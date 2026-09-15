import type {
  AgendaSession,
  AgendaSpeaker,
  DraftBundle,
  DraftSlice,
  DraftVersionMeta,
  ExhibitKit,
  Floor,
  LibraryAsset,
  LibraryAssetKind,
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
  airtableAgendaTable?: string;
  airtableSpeakersTable?: string;
  sponsorsSyncedAt?: string | null;
  agendaSyncedAt?: string | null;
  speakersSyncedAt?: string | null;
};

export type NewLibraryAsset = {
  eventId: string;
  kind: LibraryAssetKind;
  name: string;
  url: string;
  contentType: string;
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
  replaceSessions(eventId: string, sessions: Omit<AgendaSession, "id" | "eventId">[]): Promise<AgendaSession[]>;
  listSessions(eventId: string): Promise<AgendaSession[]>;
  replaceSpeakers(eventId: string, speakers: Omit<AgendaSpeaker, "id" | "eventId">[]): Promise<AgendaSpeaker[]>;
  listSpeakers(eventId: string): Promise<AgendaSpeaker[]>;
  listAssets(eventId: string): Promise<LibraryAsset[]>;
  createAsset(input: NewLibraryAsset): Promise<LibraryAsset>;
  deleteAsset(id: string): Promise<void>;
  listKits(eventId: string): Promise<ExhibitKit[]>;
  upsertKit(kit: ExhibitKit): Promise<ExhibitKit>;
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

const SUPABASE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function missingSupabaseEnv(): string[] {
  return SUPABASE_ENV.filter((name) => !envPresent(name));
}

export function isSupabaseConfigured(): boolean {
  return missingSupabaseEnv().length === 0;
}

/** File-backed `.data/` store. Never on Vercel — the function FS is read-only. */
export function canUseDemoStore(): boolean {
  return !process.env.VERCEL && !isSupabaseConfigured();
}

export function supabaseRequiredError(): Error {
  const missing = missingSupabaseEnv();
  return new Error(
    missing.length
      ? `Supabase is not configured on this deployment (missing ${missing.join(", ")}). Set those Vercel env vars for Production/Preview and redeploy. Local .data/ storage cannot save on Vercel.`
      : "Supabase client could not be created.",
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
