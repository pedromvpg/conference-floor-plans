import { requireEventEditorBySlug } from "@/lib/auth";
import { heartbeatPresence, othersEditing } from "@/lib/presence";
import { isBlobConfigured } from "@/lib/store";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const user = await requireEventEditorBySlug(slug);
    if (!isBlobConfigured()) {
      return Response.json({ others: [] as string[], shared: false });
    }
    const body = (await req.json()) as { tabId?: string };
    const tabId = body.tabId?.trim();
    if (!tabId) return Response.json({ error: "tabId required" }, { status: 400 });
    const peers = await heartbeatPresence(slug, user.email, tabId);
    return Response.json({ others: othersEditing(peers, user.email, tabId), shared: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
