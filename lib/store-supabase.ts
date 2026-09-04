import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Calibration,
  DraftBundle,
  DraftSlice,
  Floor,
  MapEvent,
  MapObject,
  Publication,
  Sponsor,
} from "./types";
import { MAX_DRAFT_VERSIONS, sliceKey } from "./draft-versions";
import { buildMapDocument } from "./map-document";
import type { NewEventInput, Store } from "./store";
import { nowIso } from "./store";

type EventRow = {
  id: string;
  slug: string;
  name: string;
  airtable_base_id: string;
  airtable_table: string;
  airtable_token: string;
  airtable_event_code: string;
  created_at: string;
  updated_at: string;
};

type FloorRow = {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  underlay_url: string | null;
  original_url: string | null;
  calibration: Calibration | null;
  created_at: string;
  updated_at: string;
};

type ObjectRow = {
  id: string;
  floor_id: string;
  kind: MapObject["kind"];
  polygon: [number, number][] | null;
  x: number | null;
  y: number | null;
  rotation: number;
  booth_number: string;
  name: string;
  sponsor_id: string | null;
  amenity_type: MapObject["amenityType"];
  color: string | null;
  created_at: string;
  updated_at: string;
};

type SponsorRow = {
  id: string;
  event_id: string;
  airtable_id: string;
  name: string;
  tier: string;
  booth_number: string;
  logo_url: string;
  logo_white_url: string;
};

function eventFrom(r: EventRow): MapEvent {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    airtableBaseId: r.airtable_base_id ?? "",
    airtableTable: r.airtable_table ?? "",
    airtableToken: r.airtable_token ?? "",
    airtableEventCode: r.airtable_event_code ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function floorFrom(r: FloorRow): Floor {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    sortOrder: r.sort_order,
    underlayUrl: r.underlay_url,
    originalUrl: r.original_url,
    calibration: r.calibration,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function objectFrom(r: ObjectRow): MapObject {
  return {
    id: r.id,
    floorId: r.floor_id,
    kind: r.kind,
    polygon: r.polygon,
    x: r.x,
    y: r.y,
    rotation: r.rotation ?? 0,
    boothNumber: r.booth_number ?? "",
    name: r.name ?? "",
    sponsorId: r.sponsor_id,
    amenityType: r.amenity_type,
    color: r.color ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function sponsorFrom(r: SponsorRow): Sponsor {
  return {
    id: r.id,
    eventId: r.event_id,
    airtableId: r.airtable_id,
    name: r.name,
    tier: r.tier ?? "",
    boothNumber: r.booth_number ?? "",
    logoUrl: r.logo_url ?? "",
    logoWhiteUrl: r.logo_white_url ?? "",
  };
}

export class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}

  async listEvents() {
    const { data, error } = await this.sb.from("events").select("*").order("created_at");
    if (error) throw error;
    return (data as EventRow[]).map(eventFrom);
  }

  async getEventBySlug(slug: string) {
    const { data, error } = await this.sb.from("events").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? eventFrom(data as EventRow) : null;
  }

  async createEvent(input: NewEventInput) {
    const { data, error } = await this.sb
      .from("events")
      .insert({
        name: input.name,
        slug: input.slug,
        airtable_base_id: input.airtableBaseId ?? "",
        airtable_table: input.airtableTable ?? "",
        airtable_token: input.airtableToken ?? "",
        airtable_event_code: input.airtableEventCode ?? "",
      })
      .select("*")
      .single();
    if (error) throw error;
    return eventFrom(data as EventRow);
  }

  async updateEvent(id: string, patch: Partial<NewEventInput>) {
    const row: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.name != null) row.name = patch.name;
    if (patch.slug != null) row.slug = patch.slug;
    if (patch.airtableBaseId != null) row.airtable_base_id = patch.airtableBaseId;
    if (patch.airtableTable != null) row.airtable_table = patch.airtableTable;
    if (patch.airtableToken != null) row.airtable_token = patch.airtableToken;
    if (patch.airtableEventCode != null) row.airtable_event_code = patch.airtableEventCode;
    const { data, error } = await this.sb.from("events").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return eventFrom(data as EventRow);
  }

  async getDraft(slug: string): Promise<DraftBundle | null> {
    const event = await this.getEventBySlug(slug);
    if (!event) return null;
    const floors = await this.listFloors(event.id);
    const floorIds = floors.map((f) => f.id);
    let objects: MapObject[] = [];
    if (floorIds.length) {
      const { data, error } = await this.sb.from("objects").select("*").in("floor_id", floorIds);
      if (error) throw error;
      objects = (data as ObjectRow[]).map(objectFrom);
    }
    const sponsors = await this.listSponsors(event.id);
    const publication = await this.getPublicationBySlug(slug);
    return { event, floors, objects, sponsors, publication };
  }

  async getFloor(id: string) {
    const { data, error } = await this.sb.from("floors").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? floorFrom(data as FloorRow) : null;
  }

  async listFloors(eventId: string) {
    const { data, error } = await this.sb
      .from("floors")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order");
    if (error) throw error;
    return (data as FloorRow[]).map(floorFrom);
  }

  async createFloor(eventId: string, name: string) {
    const existing = await this.listFloors(eventId);
    const { data, error } = await this.sb
      .from("floors")
      .insert({ event_id: eventId, name, sort_order: existing.length })
      .select("*")
      .single();
    if (error) throw error;
    return floorFrom(data as FloorRow);
  }

  async updateFloor(id: string, patch: Partial<Floor>) {
    const row: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.name != null) row.name = patch.name;
    if (patch.sortOrder != null) row.sort_order = patch.sortOrder;
    if (patch.underlayUrl !== undefined) row.underlay_url = patch.underlayUrl;
    if (patch.originalUrl !== undefined) row.original_url = patch.originalUrl;
    if (patch.calibration !== undefined) row.calibration = patch.calibration;
    const { data, error } = await this.sb.from("floors").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return floorFrom(data as FloorRow);
  }

  async deleteFloor(id: string) {
    const { error } = await this.sb.from("floors").delete().eq("id", id);
    if (error) throw error;
  }

  async upsertObject(obj: MapObject) {
    const { data, error } = await this.sb
      .from("objects")
      .upsert({
        id: obj.id,
        floor_id: obj.floorId,
        kind: obj.kind,
        polygon: obj.polygon,
        x: obj.x,
        y: obj.y,
        rotation: obj.rotation,
        booth_number: obj.boothNumber,
        name: obj.name,
        sponsor_id: obj.sponsorId,
        amenity_type: obj.amenityType,
        color: obj.color,
        created_at: obj.createdAt,
        updated_at: nowIso(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return objectFrom(data as ObjectRow);
  }

  async deleteObject(id: string) {
    const { error } = await this.sb.from("objects").delete().eq("id", id);
    if (error) throw error;
  }

  async replaceSponsors(eventId: string, sponsors: Omit<Sponsor, "id" | "eventId">[]) {
    await this.sb.from("sponsors").delete().eq("event_id", eventId);
    if (!sponsors.length) return [];
    const { data, error } = await this.sb
      .from("sponsors")
      .insert(
        sponsors.map((s) => ({
          event_id: eventId,
          airtable_id: s.airtableId,
          name: s.name,
          tier: s.tier,
          booth_number: s.boothNumber,
          logo_url: s.logoUrl,
          logo_white_url: s.logoWhiteUrl,
        })),
      )
      .select("*");
    if (error) throw error;
    return (data as SponsorRow[]).map(sponsorFrom);
  }

  async listSponsors(eventId: string) {
    const { data, error } = await this.sb.from("sponsors").select("*").eq("event_id", eventId).order("name");
    if (error) throw error;
    return (data as SponsorRow[]).map(sponsorFrom);
  }

  async publish(eventId: string, publishedBy: string) {
    const { data: eventRow, error: e1 } = await this.sb.from("events").select("*").eq("id", eventId).single();
    if (e1) throw e1;
    const event = eventFrom(eventRow as EventRow);
    const floors = await this.listFloors(eventId);
    const floorIds = floors.map((f) => f.id);
    let objects: MapObject[] = [];
    if (floorIds.length) {
      const { data, error } = await this.sb.from("objects").select("*").in("floor_id", floorIds);
      if (error) throw error;
      objects = (data as ObjectRow[]).map(objectFrom);
    }
    const sponsors = await this.listSponsors(eventId);
    const publishedAt = nowIso();
    const snapshot = buildMapDocument({ event, floors, objects, sponsors, publishedAt });
    await this.sb.from("publications").delete().eq("event_id", eventId);
    const { data, error } = await this.sb
      .from("publications")
      .insert({ event_id: eventId, snapshot, published_at: publishedAt, published_by: publishedBy })
      .select("*")
      .single();
    if (error) throw error;
    const json = JSON.stringify(snapshot);
    const path = `published/${event.slug}/map.json`;
    await this.sb.storage.from("maps").upload(path, json, {
      contentType: "application/json",
      upsert: true,
    });
    return {
      id: data.id,
      eventId,
      snapshot,
      publishedAt,
      publishedBy,
    } satisfies Publication;
  }

  async getPublicationBySlug(slug: string) {
    const event = await this.getEventBySlug(slug);
    if (!event) return null;
    const { data, error } = await this.sb
      .from("publications")
      .select("*")
      .eq("event_id", event.id)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      eventId: data.event_id,
      snapshot: data.snapshot,
      publishedAt: data.published_at,
      publishedBy: data.published_by,
    } satisfies Publication;
  }

  async replaceDraft(eventId: string, slice: DraftSlice) {
    const existing = await this.listFloors(eventId);
    const keep = new Set(slice.floors.map((f) => f.id));
    for (const floor of existing) {
      if (!keep.has(floor.id)) await this.deleteFloor(floor.id);
    }
    for (const floor of slice.floors) {
      const found = existing.find((f) => f.id === floor.id);
      if (found) {
        await this.updateFloor(floor.id, floor);
      } else {
        const { error } = await this.sb.from("floors").insert({
          id: floor.id,
          event_id: eventId,
          name: floor.name,
          sort_order: floor.sortOrder,
          underlay_url: floor.underlayUrl,
          original_url: floor.originalUrl,
          calibration: floor.calibration,
          created_at: floor.createdAt,
          updated_at: nowIso(),
        });
        if (error) throw error;
      }
    }
    const floors = await this.listFloors(eventId);
    const floorIds = floors.map((f) => f.id);
    if (floorIds.length) {
      const { error } = await this.sb.from("objects").delete().in("floor_id", floorIds);
      if (error) throw error;
    }
    for (const obj of slice.objects) {
      await this.upsertObject(obj);
    }
    const objects: MapObject[] = [];
    if (floorIds.length) {
      const { data, error } = await this.sb.from("objects").select("*").in("floor_id", floorIds);
      if (error) throw error;
      objects.push(...(data as ObjectRow[]).map(objectFrom));
    }
    return { floors, objects };
  }

  async listDraftVersions(eventId: string) {
    const { data, error } = await this.sb
      .from("draft_versions")
      .select("id, event_id, created_at, created_by")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(MAX_DRAFT_VERSIONS);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      eventId: r.event_id as string,
      createdAt: r.created_at as string,
      createdBy: r.created_by as string,
    }));
  }

  async saveDraftVersion(eventId: string, createdBy: string) {
    const floors = await this.listFloors(eventId);
    const floorIds = floors.map((f) => f.id);
    let objects: MapObject[] = [];
    if (floorIds.length) {
      const { data, error } = await this.sb.from("objects").select("*").in("floor_id", floorIds);
      if (error) throw error;
      objects = (data as ObjectRow[]).map(objectFrom);
    }
    const snapshot = { floors, objects };
    const { data: latest, error: latestErr } = await this.sb
      .from("draft_versions")
      .select("snapshot")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw latestErr;
    if (latest && sliceKey(latest.snapshot as DraftSlice) === sliceKey(snapshot)) return null;
    const { data, error } = await this.sb
      .from("draft_versions")
      .insert({ event_id: eventId, snapshot, created_by: createdBy })
      .select("id, event_id, created_at, created_by")
      .single();
    if (error) throw error;
    const { data: extras } = await this.sb
      .from("draft_versions")
      .select("id")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .range(MAX_DRAFT_VERSIONS, 1000);
    if (extras?.length) {
      await this.sb.from("draft_versions").delete().in(
        "id",
        extras.map((r) => r.id),
      );
    }
    return {
      id: data.id as string,
      eventId: data.event_id as string,
      createdAt: data.created_at as string,
      createdBy: data.created_by as string,
    };
  }

  async restoreDraftVersion(eventId: string, versionId: string) {
    const { data, error } = await this.sb
      .from("draft_versions")
      .select("*")
      .eq("id", versionId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Version not found");
    return this.replaceDraft(eventId, data.snapshot as DraftSlice);
  }

  async isEditor(email: string) {
    const { data, error } = await this.sb
      .from("allowed_editors")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (data) return true;
    const { count } = await this.sb.from("allowed_editors").select("*", { count: "exact", head: true });
    if (count === 0) {
      const allow = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (allow.includes(email.toLowerCase()) || allow.length === 0) {
        await this.addEditor(email);
        return true;
      }
    }
    return false;
  }

  async addEditor(email: string) {
    const { error } = await this.sb
      .from("allowed_editors")
      .upsert({ email: email.toLowerCase() }, { onConflict: "email" });
    if (error) throw error;
  }

  async putFile(filePath: string, body: Buffer, contentType: string) {
    const { error } = await this.sb.storage.from("maps").upload(filePath, body, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = this.sb.storage.from("maps").getPublicUrl(filePath);
    return data.publicUrl;
  }
}
