import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { airtableEnvStatus } from "@/lib/airtable-conf";
import { EditorNav } from "@/components/editor/EditorNav";
import { SettingsForm } from "@/components/events/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const event = await getStore().getEventBySlug(slug);
  if (!event) redirect("/events");
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <EditorNav slug={slug} current="settings" title="Settings" />
      <SettingsForm
        event={{ ...event, airtableToken: event.airtableToken ? "set" : "" }}
        envStatus={airtableEnvStatus(event.slug)}
      />
    </main>
  );
}
