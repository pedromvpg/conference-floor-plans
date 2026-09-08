import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { EditorNav } from "@/components/editor/EditorNav";
import { SponsorsAssetsForm } from "@/components/assets/SponsorsAssetsForm";

export const dynamic = "force-dynamic";

export default async function SponsorsAssetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <EditorNav slug={slug} current="assets" title="Sponsors" kicker="Assets" />
      <SponsorsAssetsForm
        event={{ ...draft.event, airtableToken: draft.event.airtableToken ? "set" : "" }}
        initialSponsors={draft.sponsors}
      />
    </main>
  );
}
