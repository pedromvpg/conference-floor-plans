import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { DesignerApp } from "@/components/designer/DesignerApp";
import { isBlobConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStudio(slug);
  const draft = await getStore().getDraft(slug);
  if (!draft) redirect("/events");
  return <DesignerApp initial={draft} sharedBlob={isBlobConfigured()} />;
}
