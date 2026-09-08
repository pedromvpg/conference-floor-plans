import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { EditorNav } from "@/components/editor/EditorNav";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function when(iso: string | null): string {
  if (!iso) return "Never synced";
  return `Last sync ${new Date(iso).toLocaleString()}`;
}

export default async function AssetsHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  const { event, sponsors, sessions, speakers, assets } = draft;
  const textures = assets.filter((a) => a.kind === "texture").length;
  const models = assets.filter((a) => a.kind === "model").length;

  const cards = [
    {
      href: `/e/${slug}/assets/sponsors`,
      kicker: "Airtable",
      title: "Sponsors",
      description: `${sponsors.length} cached · ${when(event.sponsorsSyncedAt)}`,
    },
    {
      href: `/e/${slug}/assets/agenda`,
      kicker: "Airtable",
      title: "Agenda",
      description: `${sessions.length} sessions · ${speakers.length} speakers · ${when(event.agendaSyncedAt)}`,
    },
    {
      href: `/e/${slug}/assets/library`,
      kicker: "Hall",
      title: "Library",
      description: `${textures} textures · ${models} models`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <EditorNav slug={slug} current="assets" title="Assets" />
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full hover:border-primary">
              <CardHeader>
                <p className="chrome-kicker">{c.kicker}</p>
                <CardTitle className="mt-1">{c.title}</CardTitle>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
