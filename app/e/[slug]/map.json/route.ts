import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const pub = await getStore().getPublicationBySlug(slug);
  if (!pub) {
    return Response.json({ error: "Not published" }, { status: 404 });
  }
  return Response.json(pub.snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
