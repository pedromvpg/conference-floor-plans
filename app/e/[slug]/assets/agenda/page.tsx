import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { airtableEnvStatus } from "@/lib/airtable-conf";
import { EditorNav } from "@/components/editor/EditorNav";
import { AgendaAssetsForm } from "@/components/assets/AgendaAssetsForm";

export const dynamic = "force-dynamic";

export default async function AgendaAssetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <EditorNav slug={slug} current="assets" title="Agenda" kicker="Assets" />
      <AgendaAssetsForm
        event={draft.event}
        envStatus={airtableEnvStatus(slug)}
        initialSessions={draft.sessions}
        initialSpeakers={draft.speakers}
      />
    </main>
  );
}
