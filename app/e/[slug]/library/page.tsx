import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { LibraryAssetsForm } from "@/components/assets/LibraryAssetsForm";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStudio(slug);
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return (
    <StudioShell>
      <EditorNav slug={slug} current="library" title="Library" />
      <LibraryAssetsForm slug={slug} initial={draft.assets} />
    </StudioShell>
  );
}
