import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { airtableEnvStatus } from "@/lib/airtable-conf";
import { EditorNav } from "@/components/editor/EditorNav";
import { EventHub } from "@/components/editor/EventHub";
import { StudioShell } from "@/components/editor/StudioShell";

export const dynamic = "force-dynamic";

export default async function EventStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="studio" title={draft.event.name} />
      <EventHub draft={draft} airtableLoaded={Boolean(airtableEnvStatus(slug).loadedKey)} />
    </StudioShell>
  );
}
