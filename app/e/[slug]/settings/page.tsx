import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { airtableEnvStatus } from "@/lib/airtable-conf";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { SettingsForm } from "@/components/events/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStudio(slug);
  const event = await getStore().getEventBySlug(slug);
  if (!event) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="settings" title="Settings" />
      <SettingsForm
        event={{ ...event, airtableToken: event.airtableToken ? "set" : "" }}
        envStatus={airtableEnvStatus(event.slug)}
      />
    </StudioShell>
  );
}
