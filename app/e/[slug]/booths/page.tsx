import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { BoothsKitsForm } from "@/components/assets/BoothsKitsForm";

export const dynamic = "force-dynamic";

export default async function BoothsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="booths" title="Booths" />
      <BoothsKitsForm initial={draft.kits} group="booths" />
    </StudioShell>
  );
}
