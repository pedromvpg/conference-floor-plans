import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { SponsorsAssetsForm } from "@/components/assets/SponsorsAssetsForm";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStudio(slug);
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="sponsors" title="Sponsors" />
      <SponsorsAssetsForm
        event={{ ...draft.event, airtableToken: draft.event.airtableToken ? "set" : "" }}
        initialSponsors={draft.sponsors}
      />
    </StudioShell>
  );
}
