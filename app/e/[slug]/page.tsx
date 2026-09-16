import { notFound } from "next/navigation";
import { ViewerApp } from "@/components/viewer/ViewerApp";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { mayViewMap } from "@/lib/map-access";

export const dynamic = "force-dynamic";

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booth?: string; airtable?: string }>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const user = await getSessionUser();
  const access = await mayViewMap(slug, user);
  if (!access.ok) notFound();
  const pub = await getStore().getPublicationBySlug(slug);
  if (!pub || access.unpublished) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">
            <span className="text-primary">$</span> map unpublished
          </p>
          <h1 className="mt-2 text-xl font-semibold">Not published yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Production still needs to hit Publish in the designer.
          </p>
        </div>
      </main>
    );
  }
  return <ViewerApp doc={pub.snapshot} highlightBooth={q.booth} highlightAirtable={q.airtable} />;
}
