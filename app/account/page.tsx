import { redirect } from "next/navigation";
import { eventsForUser, getSessionUser, canEditEvent } from "@/lib/auth";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { eventStudioHref } from "@/lib/studio-nav";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { canUseDemoStore } from "@/lib/store";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const events = await eventsForUser(user.email);
  const canEdit = new Set(
    (await Promise.all(events.map(async (e) => ((await canEditEvent(user.email, e.id)) ? e.id : "")))).filter(Boolean),
  );
  const record = await getStore().getUser(user.email);
  const demo = canUseDemoStore();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em]">Account.</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-[14px] uppercase tracking-[0.16em] text-muted-foreground">{user.role}</p>
        <h2 className="mt-12 text-[16px] font-medium">Password</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Used with your work email on the sign-in page. We never store the password itself — Node{" "}
          <code className="font-mono text-[13px]">scrypt</code> derives a 64-byte hash with a random 16-byte salt
          (<code className="font-mono text-[13px]">salt:hex</code> in the store). Sign-in checks with a timing-safe
          compare. Change it here anytime.
        </p>
        <ChangePasswordForm demo={demo} hasPassword={Boolean(record?.passwordHash)} />
        <h2 className="mt-12 text-[16px] font-medium">Events you can access</h2>
        {events.length ? (
          <ul className="mt-4 divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="font-mono text-[12px] text-muted-foreground">/e/{e.slug}</p>
                </div>
                <Button asChild variant="glass" size="lg">
                  <Link href={canEdit.has(e.id) ? eventStudioHref(e.slug) : `/e/${e.slug}`}>
                    {canEdit.has(e.id) ? "Studio" : "Viewer"}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-muted-foreground">None yet. Ask an admin to invite you to a map.</p>
        )}
      </main>
    </div>
  );
}
