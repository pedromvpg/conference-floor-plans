import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { airtableEnvStatus } from "@/lib/airtable-conf";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { AgendaAssetsForm } from "@/components/assets/AgendaAssetsForm";

export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStudio(slug);
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="agenda" title="Agenda" />
      <AgendaAssetsForm
        event={draft.event}
        envStatus={airtableEnvStatus(slug)}
        initialSessions={draft.sessions}
        initialSpeakers={draft.speakers}
      />
    </StudioShell>
  );
}
