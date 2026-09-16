import { getStore } from "@/lib/get-store";
import { requireEventEditor } from "@/lib/auth";
import type { MapObject } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const objs = (Array.isArray(body) ? body : [body]) as MapObject[];
    if (!objs.length || objs.some((obj) => !obj?.id || !obj.floorId)) {
      return Response.json({ error: "id and floorId required" }, { status: 400 });
    }
    const store = getStore();
    const floorIds = [...new Set(objs.map((obj) => obj.floorId))];
    const floors = await Promise.all(floorIds.map((id) => store.getFloor(id)));
    if (floors.some((floor) => !floor)) {
      return Response.json({ error: "Floor not found" }, { status: 404 });
    }
    const eventIds = [...new Set(floors.map((floor) => floor!.eventId))];
    for (const eventId of eventIds) await requireEventEditor(eventId);
    const saved = await store.upsertObjects(objs);
    return Response.json(saved.length === 1 ? saved[0] : saved);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
