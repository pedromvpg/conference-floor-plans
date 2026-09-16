import { getStore } from "@/lib/get-store";
import { requireEventEditor } from "@/lib/auth";
import type { MapObject } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const obj = (await req.json()) as MapObject;
    if (!obj?.id || !obj.floorId) {
      return Response.json({ error: "id and floorId required" }, { status: 400 });
    }
    const floor = await getStore().getFloor(obj.floorId);
    if (!floor) return Response.json({ error: "Floor not found" }, { status: 404 });
    await requireEventEditor(floor.eventId);
    const saved = await getStore().upsertObject(obj);
    return Response.json(saved);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
