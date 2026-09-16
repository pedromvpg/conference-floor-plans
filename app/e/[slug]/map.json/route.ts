import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { mayViewMap } from "@/lib/map-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const user = await getSessionUser();
  const access = await mayViewMap(slug, user);
  if (!access.ok || access.unpublished) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const pub = await getStore().getPublicationBySlug(slug);
  if (!pub) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const event = await getStore().getEventBySlug(slug);
  const publicMap = event?.isPublic === true;
  const headers: Record<string, string> = {
    "Cache-Control": publicMap ? "public, s-maxage=30, stale-while-revalidate=300" : "private, no-store",
  };
  if (publicMap) headers["Access-Control-Allow-Origin"] = "*";
  return Response.json(pub.snapshot, { headers });
}
