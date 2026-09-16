import { requireStudio } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { grantAccess } from "@/lib/access";
import { withoutPasswordHash } from "@/lib/password";
import { EditorNav } from "@/components/editor/EditorNav";
import { StudioShell } from "@/components/editor/StudioShell";
import { EventUsersDesk } from "@/components/editor/EventUsersDesk";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event } = await requireStudio(slug);
  const store = getStore();
  const [users, grants] = await Promise.all([store.listUsers(), store.listEventEditors()]);
  const inherited = users
    .filter((u) => u.role === "admin" || u.allEvents)
    .map((u) => ({
      email: withoutPasswordHash(u).email,
      role: u.role,
      source: "inherited" as const,
      access: (u.role === "viewer" ? "viewer" : "editor") as "editor" | "viewer",
    }));
  const inheritedEmails = new Set(inherited.map((u) => u.email));
  const assigned = grants
    .filter((g) => g.eventId === event.id && !inheritedEmails.has(g.email))
    .map((g) => {
      const user = users.find((u) => u.email === g.email);
      return {
        email: g.email,
        role: user?.role ?? "editor",
        source: "grant" as const,
        access: grantAccess(g),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  if (!event) redirect("/events");

  return (
    <StudioShell>
      <EditorNav slug={slug} current="users" title="Users" />
      <EventUsersDesk slug={slug} initialPeople={[...inherited, ...assigned]} />
    </StudioShell>
  );
}
