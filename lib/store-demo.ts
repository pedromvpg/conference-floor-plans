import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  AgendaSession,
  AgendaSpeaker,
  DraftBundle,
  DraftSlice,
  DraftVersion,
  Floor,
  LibraryAsset,
  MapEvent,
  MapObject,
  Publication,
  Sponsor,
} from "./types";
import { MAX_DRAFT_VERSIONS, sliceKey } from "./draft-versions";
import { buildMapDocument } from "./map-document";
import { hallDefaults, normalizeObject } from "./appearance";
import { newId, nowIso, type NewEventInput, type NewLibraryAsset, type Store } from "./store";
import zones from "../seed/bhk26-zones.json";

type Db = {
  events: MapEvent[];
  floors: Floor[];
  objects: MapObject[];
  sponsors: Sponsor[];
  sessions?: AgendaSession[];
  speakers?: AgendaSpeaker[];
  assets?: LibraryAsset[];
  publications: Publication[];
  draftVersions?: DraftVersion[];
  editors: string[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const DB_TMP_PATH = path.join(DATA_DIR, "db.json.tmp");
const FILES_DIR = path.join(DATA_DIR, "files");

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(() => undefined, () => undefined);
  return run;
}

function parseDbJson(raw: string): Db {
  try {
    return JSON.parse(raw) as Db;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    const db = parseFirstJsonObject(raw);
    if (!db) throw err;
    return db;
  }
}

function parseFirstJsonObject(raw: string): Db | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === "\"") inString = false;
      continue;
    }
    if (c === "\"") {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(raw.slice(start, i + 1)) as Db;
      }
    }
  }
  return null;
}

async function emptyDb(): Promise<Db> {
  return {
    events: [],
    floors: [],
    objects: [],
    sponsors: [],
    sessions: [],
    speakers: [],
    assets: [],
    publications: [],
    draftVersions: [],
    editors: ["demo@local"],
  };
}

async function loadDbUnlocked(): Promise<Db> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(FILES_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    const db = await seedBhk26(await emptyDb());
    await saveDbUnlocked(db);
    return db;
  }
  const raw = await readFile(DB_PATH, "utf8");
  const db = parseDbJson(raw);
  db.draftVersions ??= [];
  db.sessions ??= [];
  db.speakers ??= [];
  db.assets ??= [];
  try {
    JSON.parse(raw);
  } catch {
    await saveDbUnlocked(db);
  }
  return db;
}

async function saveDbUnlocked(db: Db): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_TMP_PATH, JSON.stringify(db, null, 2));
  await rename(DB_TMP_PATH, DB_PATH);
}

function useDb<T>(write: boolean, fn: (db: Db) => Promise<T> | T): Promise<T> {
  return withLock(async () => {
    const db = await loadDbUnlocked();
    const result = await fn(db);
    if (write) await saveDbUnlocked(db);
    return result;
  });
}

function normalizeEvent(e: MapEvent): MapEvent {
  return {
    ...e,
    airtableAgendaTable: e.airtableAgendaTable ?? "",
    airtableSpeakersTable: e.airtableSpeakersTable ?? "",
    sponsorsSyncedAt: e.sponsorsSyncedAt ?? null,
    agendaSyncedAt: e.agendaSyncedAt ?? null,
    speakersSyncedAt: e.speakersSyncedAt ?? null,
  };
}

function applyDraftSlice(db: Db, eventId: string, slice: DraftSlice) {
  const keepFloorIds = new Set(slice.floors.map((f) => f.id));
  db.floors = db.floors.filter((f) => f.eventId !== eventId || keepFloorIds.has(f.id));
  for (const floor of slice.floors) {
    const i = db.floors.findIndex((f) => f.id === floor.id);
    const next = { ...floor, eventId, updatedAt: nowIso() };
    if (i >= 0) db.floors[i] = next;
    else db.floors.push(next);
  }
  const eventFloorIds = new Set(db.floors.filter((f) => f.eventId === eventId).map((f) => f.id));
  db.objects = db.objects.filter((o) => !eventFloorIds.has(o.floorId));
  db.objects.push(...slice.objects.map((o) => normalizeObject({ ...o, updatedAt: nowIso() })));
  return {
    floors: db.floors.filter((f) => f.eventId === eventId).sort((a, b) => a.sortOrder - b.sortOrder),
    objects: db.objects.filter((o) => eventFloorIds.has(o.floorId)),
  };
}

async function seedBhk26(db: Db): Promise<Db> {
  const t = nowIso();
  const event: MapEvent = {
    id: newId(),
    slug: "bhk26",
    name: "Bitcoin Asia 2026",
    airtableBaseId: "",
    airtableTable: "",
    airtableToken: "",
    airtableEventCode: "BHK26",
    airtableAgendaTable: "",
    airtableSpeakersTable: "",
    sponsorsSyncedAt: null,
    agendaSyncedAt: null,
    speakersSyncedAt: null,
    createdAt: t,
    updatedAt: t,
  };
  const floor: Floor = {
    id: newId(),
    eventId: event.id,
    name: "Expo Hall",
    sortOrder: 0,
    underlayUrl: "/seed/bhk26-hall.svg",
    originalUrl: "/seed/bhk26-hall.svg",
    calibration: {
      originX: 0,
      originY: 0,
      metersPerPixel: zones.metersPerPixel,
      rotationDeg: 0,
      widthPx: zones.widthPx,
      heightPx: zones.heightPx,
    },
    createdAt: t,
    updatedAt: t,
  };
  const objects: MapObject[] = [
    ...zones.booths.map((b) => ({
      id: b.id,
      floorId: floor.id,
      kind: "booth" as const,
      polygon: b.polygon as [number, number][],
      x: null,
      y: null,
      rotation: 0,
      boothNumber: b.boothNumber || "",
      name: b.name,
      sponsorId: null,
      amenityType: null,
      color: null,
      ...hallDefaults(),
      createdAt: t,
      updatedAt: t,
    })),
    ...zones.amenities.map((a) => ({
      id: a.id,
      floorId: floor.id,
      kind: "amenity" as const,
      polygon: null,
      x: a.x,
      y: a.y,
      rotation: 0,
      boothNumber: "",
      name: a.label,
      sponsorId: null,
      amenityType: a.amenityType as MapObject["amenityType"],
      color: null,
      ...hallDefaults(),
      createdAt: t,
      updatedAt: t,
    })),
  ];
  db.events.push(event);
  db.floors.push(floor);
  db.objects.push(...objects);
  const snapshot = buildMapDocument({
    event,
    floors: [floor],
    objects,
    sponsors: [],
    publishedAt: t,
  });
  db.publications.push({
    id: newId(),
    eventId: event.id,
    snapshot,
    publishedAt: t,
    publishedBy: "seed",
  });
  return db;
}

export class DemoStore implements Store {
  async listEvents() {
    return useDb(false, (db) => db.events.map(normalizeEvent));
  }

  async getEventBySlug(slug: string) {
    return useDb(false, (db) => {
      const event = db.events.find((e) => e.slug === slug);
      return event ? normalizeEvent(event) : null;
    });
  }

  async createEvent(input: NewEventInput) {
    return useDb(true, (db) => {
      if (db.events.some((e) => e.slug === input.slug)) {
        throw new Error("Slug already exists");
      }
      const t = nowIso();
      const event: MapEvent = {
        id: newId(),
        slug: input.slug,
        name: input.name,
        airtableBaseId: input.airtableBaseId ?? "",
        airtableTable: input.airtableTable ?? "",
        airtableToken: input.airtableToken ?? "",
        airtableEventCode: input.airtableEventCode ?? "",
        airtableAgendaTable: input.airtableAgendaTable ?? "",
        airtableSpeakersTable: input.airtableSpeakersTable ?? "",
        sponsorsSyncedAt: null,
        agendaSyncedAt: null,
        speakersSyncedAt: null,
        createdAt: t,
        updatedAt: t,
      };
      db.events.push(event);
      return event;
    });
  }

  async updateEvent(id: string, patch: Partial<NewEventInput>) {
    return useDb(true, (db) => {
      const event = db.events.find((e) => e.id === id);
      if (!event) throw new Error("Event not found");
      Object.assign(event, {
        ...patch,
        updatedAt: nowIso(),
      });
      return event;
    });
  }

  async getDraft(slug: string): Promise<DraftBundle | null> {
    return useDb(false, (db) => {
      const event = db.events.find((e) => e.slug === slug);
      if (!event) return null;
      const floors = db.floors.filter((f) => f.eventId === event.id);
      const floorIds = new Set(floors.map((f) => f.id));
      return {
        event: normalizeEvent(event),
        floors,
        objects: db.objects.filter((o) => floorIds.has(o.floorId)).map(normalizeObject),
        sponsors: db.sponsors.filter((s) => s.eventId === event.id),
        sessions: (db.sessions ?? []).filter((s) => s.eventId === event.id),
        speakers: (db.speakers ?? []).filter((s) => s.eventId === event.id),
        assets: (db.assets ?? []).filter((a) => a.eventId === event.id),
        publication: db.publications.filter((p) => p.eventId === event.id).at(-1) ?? null,
      };
    });
  }

  async listFloors(eventId: string) {
    return useDb(false, (db) =>
      db.floors.filter((f) => f.eventId === eventId).sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  async getFloor(id: string) {
    return useDb(false, (db) => db.floors.find((f) => f.id === id) ?? null);
  }

  async createFloor(eventId: string, name: string) {
    return useDb(true, (db) => {
      const t = nowIso();
      const sortOrder = db.floors.filter((f) => f.eventId === eventId).length;
      const floor: Floor = {
        id: newId(),
        eventId,
        name,
        sortOrder,
        underlayUrl: null,
        originalUrl: null,
        calibration: null,
        createdAt: t,
        updatedAt: t,
      };
      db.floors.push(floor);
      return floor;
    });
  }

  async updateFloor(id: string, patch: Partial<Floor>) {
    return useDb(true, (db) => {
      const floor = db.floors.find((f) => f.id === id);
      if (!floor) throw new Error("Floor not found");
      Object.assign(floor, patch, { updatedAt: nowIso() });
      return floor;
    });
  }

  async deleteFloor(id: string) {
    await useDb(true, (db) => {
      db.floors = db.floors.filter((f) => f.id !== id);
      db.objects = db.objects.filter((o) => o.floorId !== id);
    });
  }

  async upsertObject(obj: MapObject) {
    return useDb(true, (db) => {
      const i = db.objects.findIndex((o) => o.id === obj.id);
      const next = normalizeObject({ ...obj, updatedAt: nowIso() });
      if (i >= 0) db.objects[i] = next;
      else db.objects.push(next);
      return next;
    });
  }

  async deleteObject(id: string) {
    await useDb(true, (db) => {
      db.objects = db.objects.filter((o) => o.id !== id);
    });
  }

  async replaceSponsors(eventId: string, sponsors: Omit<Sponsor, "id" | "eventId">[]) {
    return useDb(true, (db) => {
      db.sponsors = db.sponsors.filter((s) => s.eventId !== eventId);
      const rows: Sponsor[] = sponsors.map((s) => ({
        ...s,
        id: newId(),
        eventId,
      }));
      db.sponsors.push(...rows);
      const event = db.events.find((e) => e.id === eventId);
      if (event) event.sponsorsSyncedAt = nowIso();
      return rows;
    });
  }

  async listSponsors(eventId: string) {
    return useDb(false, (db) => db.sponsors.filter((s) => s.eventId === eventId));
  }

  async replaceSessions(eventId: string, sessions: Omit<AgendaSession, "id" | "eventId">[]) {
    return useDb(true, (db) => {
      db.sessions = (db.sessions ?? []).filter((s) => s.eventId !== eventId);
      const rows: AgendaSession[] = sessions.map((s) => ({ ...s, id: newId(), eventId }));
      db.sessions.push(...rows);
      const event = db.events.find((e) => e.id === eventId);
      if (event) event.agendaSyncedAt = nowIso();
      return rows;
    });
  }

  async listSessions(eventId: string) {
    return useDb(false, (db) => (db.sessions ?? []).filter((s) => s.eventId === eventId));
  }

  async replaceSpeakers(eventId: string, speakers: Omit<AgendaSpeaker, "id" | "eventId">[]) {
    return useDb(true, (db) => {
      db.speakers = (db.speakers ?? []).filter((s) => s.eventId !== eventId);
      const rows: AgendaSpeaker[] = speakers.map((s) => ({ ...s, id: newId(), eventId }));
      db.speakers.push(...rows);
      const event = db.events.find((e) => e.id === eventId);
      if (event) event.speakersSyncedAt = nowIso();
      return rows;
    });
  }

  async listSpeakers(eventId: string) {
    return useDb(false, (db) => (db.speakers ?? []).filter((s) => s.eventId === eventId));
  }

  async listAssets(eventId: string) {
    return useDb(false, (db) => (db.assets ?? []).filter((a) => a.eventId === eventId));
  }

  async createAsset(input: NewLibraryAsset) {
    return useDb(true, (db) => {
      const row: LibraryAsset = {
        id: newId(),
        eventId: input.eventId,
        kind: input.kind,
        name: input.name,
        url: input.url,
        contentType: input.contentType,
        createdAt: nowIso(),
      };
      db.assets = db.assets ?? [];
      db.assets.push(row);
      return row;
    });
  }

  async deleteAsset(id: string) {
    await useDb(true, (db) => {
      db.assets = (db.assets ?? []).filter((a) => a.id !== id);
      db.objects = db.objects.map((o) => ({
        ...o,
        modelAssetId: o.modelAssetId === id ? null : o.modelAssetId,
        rugTextureAssetId: o.rugTextureAssetId === id ? null : o.rugTextureAssetId,
        wallTextureAssetId: o.wallTextureAssetId === id ? null : o.wallTextureAssetId,
      }));
    });
  }

  async publish(eventId: string, publishedBy: string) {
    return useDb(true, (db) => {
      const event = db.events.find((e) => e.id === eventId);
      if (!event) throw new Error("Event not found");
      const floors = db.floors.filter((f) => f.eventId === eventId);
      const floorIds = new Set(floors.map((f) => f.id));
      const objects = db.objects.filter((o) => floorIds.has(o.floorId)).map(normalizeObject);
      const sponsors = db.sponsors.filter((s) => s.eventId === eventId);
      const sessions = (db.sessions ?? []).filter((s) => s.eventId === eventId);
      const speakers = (db.speakers ?? []).filter((s) => s.eventId === eventId);
      const assets = (db.assets ?? []).filter((a) => a.eventId === eventId);
      const publishedAt = nowIso();
      const snapshot = buildMapDocument({
        event,
        floors,
        objects,
        sponsors,
        sessions,
        speakers,
        assets,
        publishedAt,
      });
      const pub: Publication = {
        id: newId(),
        eventId,
        snapshot,
        publishedAt,
        publishedBy,
      };
      db.publications = db.publications.filter((p) => p.eventId !== eventId);
      db.publications.push(pub);
      return pub;
    });
  }

  async getPublicationBySlug(slug: string) {
    return useDb(false, (db) => {
      const event = db.events.find((e) => e.slug === slug);
      if (!event) return null;
      return db.publications.filter((p) => p.eventId === event.id).at(-1) ?? null;
    });
  }

  async replaceDraft(eventId: string, slice: DraftSlice) {
    return useDb(true, (db) => applyDraftSlice(db, eventId, slice));
  }

  async listDraftVersions(eventId: string) {
    return useDb(false, (db) =>
      (db.draftVersions ?? [])
        .filter((v) => v.eventId === eventId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(({ snapshot: _s, ...meta }) => meta),
    );
  }

  async saveDraftVersion(eventId: string, createdBy: string) {
    return useDb(true, (db) => {
      const floors = db.floors.filter((f) => f.eventId === eventId).sort((a, b) => a.sortOrder - b.sortOrder);
      const floorIds = new Set(floors.map((f) => f.id));
      const objects = db.objects.filter((o) => floorIds.has(o.floorId));
      const snapshot = { floors, objects };
      const others = (db.draftVersions ?? []).filter((v) => v.eventId !== eventId);
      const existing = (db.draftVersions ?? [])
        .filter((v) => v.eventId === eventId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const latest = existing[0];
      if (latest && sliceKey(latest.snapshot) === sliceKey(snapshot)) return null;
      const version: DraftVersion = {
        id: newId(),
        eventId,
        createdAt: nowIso(),
        createdBy,
        snapshot,
      };
      db.draftVersions = [...others, version, ...existing].slice(0, others.length + MAX_DRAFT_VERSIONS);
      const { snapshot: _s, ...meta } = version;
      return meta;
    });
  }

  async restoreDraftVersion(eventId: string, versionId: string) {
    return useDb(true, (db) => {
      const version = (db.draftVersions ?? []).find((v) => v.id === versionId && v.eventId === eventId);
      if (!version) throw new Error("Version not found");
      return applyDraftSlice(db, eventId, version.snapshot);
    });
  }

  async isEditor(email: string) {
    return useDb(false, (db) => db.editors.includes(email.toLowerCase()));
  }

  async addEditor(email: string) {
    await useDb(true, (db) => {
      const e = email.toLowerCase();
      if (!db.editors.includes(e)) db.editors.push(e);
    });
  }

  async putFile(filePath: string, body: Buffer, _contentType: string) {
    const dest = path.join(FILES_DIR, filePath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return `/api/files/${filePath}`;
  }
}
