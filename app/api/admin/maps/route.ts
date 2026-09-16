import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/get-store";

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as { eventId?: string; isPublic?: boolean };
    if (!body.eventId || typeof body.isPublic !== "boolean") {
      return Response.json({ error: "eventId and isPublic required" }, { status: 400 });
    }
    const event = await getStore().setEventPublic(body.eventId, body.isPublic);
    return Response.json({ event });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
