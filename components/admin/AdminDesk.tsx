"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { grantAccess, type AppUser, type EventEditorGrant, type InviteClient, type UserRole } from "@/lib/access";

type EventRow = { id: string; slug: string; name: string; isPublic: boolean };
type InviteRow = InviteClient;

function inviteStatus(invite: InviteRow): "redeemed" | "expired" | "pending" {
  if (invite.usedAt) return "redeemed";
  if (Date.parse(invite.expiresAt) < Date.now()) return "expired";
  return "pending";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const checkClass =
  "mt-0.5 size-4 shrink-0 rounded-[3px] border border-input bg-background accent-foreground";

function CheckLine({
  checked,
  onChange,
  children,
  disabled,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-start gap-3 py-1.5 text-sm leading-5 select-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        className={checkClass}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block">{children}</span>
        {hint ? <span className="mt-0.5 block font-mono text-[12px] font-normal text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function AdminDesk({
  sessionEmail,
  initialUsers,
  initialGrants,
  initialInvites,
  events,
}: {
  sessionEmail: string;
  initialUsers: AppUser[];
  initialGrants: EventEditorGrant[];
  initialInvites: InviteRow[];
  events: EventRow[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [grants, setGrants] = useState(initialGrants);
  const [invites, setInvites] = useState(initialInvites);
  const [maps, setMaps] = useState(events);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [allEvents, setAllEvents] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const grantsByEmail = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of grants) {
      if (grantAccess(g) !== "editor") continue;
      const list = map.get(g.email) ?? [];
      list.push(g.eventId);
      map.set(g.email, list);
    }
    return map;
  }, [grants]);

  const inviteAllMaps = allEvents || role === "admin";

  async function createInvite() {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          eventIds: inviteAllMaps ? "all" : selected,
        }),
      });
      const data = (await res.json()) as InviteRow & { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Invite failed");
        return;
      }
      setInviteUrl(data.url ?? "");
      if (data.id && data.email) {
        const { error: _e, ...row } = data;
        setInvites((list) => [row, ...list.filter((i) => i.id !== row.id)]);
      }
      toast.success("Invite created — copy the link");
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInviteUrl(url: string) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Copied");
  }

  async function revokeInvite(invite: InviteRow) {
    if (!window.confirm(`Revoke invite for ${invite.email}? The link will stop working.`)) return;
    if (revokingId) return;
    setRevokingId(invite.id);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invite.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Could not revoke invite");
        return;
      }
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      if (invite.url && invite.url === inviteUrl) setInviteUrl("");
      toast.success("Invite revoked");
    } finally {
      setRevokingId(null);
    }
  }

  async function saveUser(u: AppUser, next: { role?: UserRole; eventIds?: string[]; allEvents?: boolean }) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: u.email, ...next }),
    });
    const data = (await res.json()) as { error?: string; user?: AppUser };
    if (!res.ok) {
      toast.error(data.error || "Save failed");
      return;
    }
    if (data.user) {
      setUsers((list) => list.map((row) => (row.email === data.user!.email ? data.user! : row)));
    }
    if (next.eventIds) {
      setGrants((list) => [
        ...list.filter((g) => g.email !== u.email || grantAccess(g) === "viewer"),
        ...next.eventIds!.map((eventId) => ({ eventId, email: u.email, access: "editor" as const })),
      ]);
    }
    toast.success("Saved");
  }

  async function removeUser(u: AppUser) {
    if (u.email === sessionEmail) {
      toast.error("You cannot delete your own account.");
      return;
    }
    if (u.role === "admin" && users.filter((row) => row.role === "admin").length <= 1) {
      toast.error("Cannot delete the last admin.");
      return;
    }
    if (!window.confirm(`Delete ${u.email}? They will lose studio access until invited again.`)) return;
    if (deletingEmail) return;
    setDeletingEmail(u.email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u.email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      setUsers((list) => list.filter((row) => row.email !== u.email));
      setGrants((list) => list.filter((g) => g.email !== u.email));
      toast.success("Deleted");
    } finally {
      setDeletingEmail(null);
    }
  }

  async function togglePublic(eventId: string, isPublic: boolean) {
    const res = await fetch("/api/admin/maps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, isPublic }),
    });
    if (!res.ok) {
      toast.error("Could not update visibility");
      return;
    }
    setMaps((list) => list.map((e) => (e.id === eventId ? { ...e, isPublic } : e)));
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-20">
      <Tabs defaultValue="invite" className="gap-8">
        <TabsList variant="line" className="h-auto w-full justify-start gap-0 rounded-none border-b border-border p-0">
          <TabsTrigger value="invite" className="rounded-none px-4 py-2.5">
            Invite
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-none px-4 py-2.5">
            Users
          </TabsTrigger>
          <TabsTrigger value="maps" className="rounded-none px-4 py-2.5">
            Map visibility
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invite">
      <section>
        <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Copy-link only. The teammate opens the URL and confirms their email. Links expire in 7 days.
        </p>
        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              className="mt-1.5"
              type="email"
              value={email}
              disabled={inviteBusy}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="producer@company.com"
            />
          </div>
          <div className="max-w-xs">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={role}
              disabled={inviteBusy}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <CheckLine
            checked={inviteAllMaps}
            disabled={role === "admin"}
            onChange={setAllEvents}
          >
            All current and future events
          </CheckLine>
          {role !== "admin" && !allEvents ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <p className="border-b border-border px-4 py-2.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                Events
              </p>
              <ul className="divide-y divide-border px-4">
                {maps.map((e) => (
                  <li key={e.id}>
                    <CheckLine
                      checked={selected.includes(e.id)}
                      disabled={inviteBusy}
                      hint={`/e/${e.slug}`}
                      onChange={(on) => {
                        setSelected((ids) => (on ? [...ids, e.id] : ids.filter((id) => id !== e.id)));
                      }}
                    >
                      {e.name}
                    </CheckLine>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button type="button" variant="inverse" size="lg" disabled={inviteBusy} onClick={() => void createInvite()}>
            {inviteBusy ? "Creating invite…" : "Create invite link"}
          </Button>
          {inviteUrl ? (
            <Button type="button" variant="glass" size="lg" onClick={() => void copyInviteUrl(inviteUrl)}>
              Copy link
            </Button>
          ) : null}
        </div>
        {inviteUrl ? <p className="mt-3 break-all font-mono text-[12px] leading-relaxed text-muted-foreground">{inviteUrl}</p> : null}
        <h3 className="mt-10 text-[16px] font-medium">Invite status</h3>
        {invites.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              const mapsLabel =
                invite.eventIds === "all"
                  ? "all events"
                  : invite.eventIds
                      .map((id) => maps.find((m) => m.id === id)?.name ?? id)
                      .join(", ");
              return (
                <li key={invite.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invite.email}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {invite.role}
                      {mapsLabel ? ` · ${mapsLabel}` : ""}
                      {invite.createdBy ? ` · by ${invite.createdBy}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Sent {formatWhen(invite.createdAt)}
                      {status === "redeemed" && invite.usedAt ? ` · redeemed ${formatWhen(invite.usedAt)}` : ""}
                      {status === "expired" ? ` · expired ${formatWhen(invite.expiresAt)}` : ""}
                      {status === "pending" ? ` · expires ${formatWhen(invite.expiresAt)}` : ""}
                    </p>
                    {invite.url ? (
                      <p className="mt-2 break-all font-mono text-[12px] leading-relaxed text-muted-foreground">
                        {invite.url}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <p
                      className={`text-[13px] font-medium capitalize ${
                        status === "redeemed"
                          ? "text-foreground"
                          : status === "expired"
                            ? "text-muted-foreground"
                            : "text-primary"
                      }`}
                    >
                      {status}
                    </p>
                    {invite.url ? (
                      <Button type="button" variant="glass" size="sm" onClick={() => void copyInviteUrl(invite.url!)}>
                        Copy link
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={revokingId !== null}
                      onClick={() => void revokeInvite(invite)}
                    >
                      {revokingId === invite.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-[14px] text-muted-foreground">No invites yet.</p>
        )}
      </section>
        </TabsContent>

        <TabsContent value="users">
      <section>
        <ul className="divide-y divide-border border-y border-border">
          {users.map((u) => {
            const ids = grantsByEmail.get(u.email) ?? [];
            return (
              <li key={u.email} className="py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.email}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {u.role}
                      {u.allEvents ? " · all events" : ""}
                      {u.email === sessionEmail ? " · you" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-36"
                      value={u.role}
                      onChange={(e) => void saveUser(u, { role: e.target.value as UserRole })}
                      aria-label={`Role for ${u.email}`}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={u.email === sessionEmail || deletingEmail !== null}
                      onClick={() => void removeUser(u)}
                    >
                      {deletingEmail === u.email ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
                {u.role === "editor" || u.role === "viewer" ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border">
                    <div className="px-4">
                      <CheckLine
                        checked={u.allEvents}
                        onChange={(on) => void saveUser(u, { allEvents: on })}
                      >
                        All current and future events
                      </CheckLine>
                    </div>
                    {!u.allEvents ? (
                      <ul className="divide-y divide-border border-t border-border px-4">
                        {maps.map((e) => (
                          <li key={e.id}>
                            <CheckLine
                              checked={ids.includes(e.id)}
                              hint={`/e/${e.slug}`}
                              onChange={(on) => {
                                const next = on ? [...ids, e.id] : ids.filter((id) => id !== e.id);
                                void saveUser(u, { eventIds: next });
                              }}
                            >
                              {e.name}
                            </CheckLine>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
        </TabsContent>

        <TabsContent value="maps">
      <section>
        <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Public maps appear on the home gallery and at /e/:slug without login (once published).
        </p>
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {maps.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-6 py-3.5">
              <div className="min-w-0">
                <p className="font-medium">{e.name}</p>
                <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">/e/{e.slug}</p>
              </div>
              <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm leading-none select-none">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 rounded-[3px] border border-input bg-background accent-foreground"
                  checked={e.isPublic}
                  onChange={(ev) => void togglePublic(e.id, ev.target.checked)}
                />
                Public
              </label>
            </li>
          ))}
        </ul>
      </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
