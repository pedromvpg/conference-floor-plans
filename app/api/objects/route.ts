import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import type { MapObject } from "@/lib/types";

export async function POST(req: Request) {
  try {
    await requireEditor();
    const obj = (await req.json()) as MapObject;
    if (!obj?.id || !obj.floorId) {
      return Response.json({ error: "id and floorId required" }, { status: 400 });
    }
    const saved = await getStore().upsertObject(obj);
    return Response.json(saved);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
