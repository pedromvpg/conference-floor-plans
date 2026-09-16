import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { AdminDesk } from "@/components/admin/AdminDesk";
import { inviteToClient } from "@/lib/access";
import { withoutPasswordHash } from "@/lib/password";

function originFromHeaders(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/events");
  const store = getStore();
  const h = await headers();
  const [users, grants, events, invites] = await Promise.all([
    store.listUsers(),
    store.listEventEditors(),
    store.listEvents(),
    store.listInvites(),
  ]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="pt-12">
        <div className="mx-auto max-w-4xl px-6 pb-8">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em]">Admin.</h1>
          <p className="mt-3 max-w-xl text-[16px] text-muted-foreground">
            Users, copy-link invites, and which published maps the world can open.
          </p>
        </div>
        <AdminDesk
          sessionEmail={user.email}
          initialUsers={users.map(withoutPasswordHash)}
          initialGrants={grants}
          initialInvites={invites.map((invite) => inviteToClient(invite, originFromHeaders(h)))}
          events={events.map((e) => ({ id: e.id, slug: e.slug, name: e.name, isPublic: e.isPublic }))}
        />
      </main>
    </div>
  );
}
