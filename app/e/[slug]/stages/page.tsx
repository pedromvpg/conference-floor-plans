import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { BoothsKitsForm } from "@/components/assets/BoothsKitsForm";

export const dynamic = "force-dynamic";

export default async function StagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStudio(slug);
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="stages" title="Stages" />
      <BoothsKitsForm initial={draft.kits} group="stages" />
    </StudioShell>
  );
}
