import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <Link href={`/e/${slug}/edit`} className="chrome-kicker hover:text-primary">
        Back to designer
      </Link>
      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="font-mono text-[11px] text-muted-foreground">/e/{slug}</p>
        </div>
        <ThemeToggle />
      </div>
      <SettingsForm event={{ ...event, airtableToken: event.airtableToken ? "set" : "" }} />
    </main>
  );
}
