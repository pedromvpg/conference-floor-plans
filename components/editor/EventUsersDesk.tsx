"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { EventAccess } from "@/lib/access";

export type EventPerson = {
  email: string;
  role: string;
  source: "inherited" | "grant";
  access: EventAccess;
};

export function EventUsersDesk({
  slug,
  initialPeople,
}: {
  slug: string;
  initialPeople: EventPerson[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<EventAccess>("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/events/${slug}/users`);
    const data = (await res.json()) as { people?: EventPerson[]; error?: string };
    if (res.ok && data.people) setPeople(data.people);
  }

  async function addPerson() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${slug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, access }),
      });
      const data = (await res.json()) as { error?: string; invited?: boolean; url?: string };
      if (!res.ok) {
        toast.error(data.error || "Could not add user");
        return;
      }
      setEmail("");
      if (data.invited && data.url) {
        setInviteUrl(data.url);
        toast.success("Invite created — copy the link");
      } else {
        setInviteUrl("");
        toast.success("Access saved");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeAccess(person: EventPerson, next: EventAccess) {
    const res = await fetch(`/api/events/${slug}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: person.email, access: next }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || "Could not update");
      return;
    }
    setPeople((list) => list.map((p) => (p.email === person.email ? { ...p, access: next } : p)));
    toast.success("Saved");
  }

  async function removePerson(person: EventPerson) {
    if (!window.confirm(`Remove ${person.email} from this event?`)) return;
    if (removingEmail) return;
    setRemovingEmail(person.email);
    try {
      const res = await fetch(`/api/events/${slug}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: person.email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Could not remove");
        return;
      }
      setPeople((list) => list.filter((p) => p.email !== person.email));
      toast.success("Removed");
    } finally {
      setRemovingEmail(null);
    }
  }

  async function copyUrl() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Copied");
  }

  const editors = people.filter((p) => p.access === "editor");
  const viewers = people.filter((p) => p.access === "viewer");

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-[22px] font-semibold tracking-[-0.04em]">Add someone</h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Editors can change this map. Viewers can open the published map even when it is private. New emails get a
          copy-link invite.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <div>
            <Label htmlFor="event-user-email">Email</Label>
            <Input
              id="event-user-email"
              className="mt-1.5"
              type="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="producer@company.com"
            />
          </div>
          <div>
            <Label htmlFor="event-user-access">Access</Label>
            <select
              id="event-user-access"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={access}
              disabled={busy}
              onChange={(e) => setAccess(e.target.value as EventAccess)}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <Button type="button" variant="inverse" size="lg" disabled={busy} onClick={() => void addPerson()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
        {inviteUrl ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="glass" size="lg" onClick={() => void copyUrl()}>
              Copy invite link
            </Button>
            <p className="break-all font-mono text-[12px] text-muted-foreground">{inviteUrl}</p>
          </div>
        ) : null}
      </section>

      <PersonList
        title="Can edit"
        empty="No editors yet besides inherited admins."
        people={editors}
        onAccess={changeAccess}
        onRemove={removePerson}
        removingEmail={removingEmail}
      />
      <PersonList
        title="Can view"
        empty="No view-only people yet."
        people={viewers}
        onAccess={changeAccess}
        onRemove={removePerson}
        removingEmail={removingEmail}
      />
    </div>
  );
}

function PersonList({
  title,
  empty,
  people,
  onAccess,
  onRemove,
  removingEmail,
}: {
  title: string;
  empty: string;
  people: EventPerson[];
  onAccess: (person: EventPerson, next: EventAccess) => void;
  onRemove: (person: EventPerson) => void;
  removingEmail: string | null;
}) {
  return (
    <section>
      <h2 className="text-[22px] font-semibold tracking-[-0.04em]">{title}</h2>
      {people.length ? (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {people.map((p) => (
            <li key={p.email} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.email}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {p.source === "inherited" ? `${p.role} · all events` : p.access}
                </p>
              </div>
              {p.source === "inherited" ? (
                <p className="text-[13px] text-muted-foreground">Managed on Admin</p>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={p.access}
                    onChange={(e) => onAccess(p, e.target.value as EventAccess)}
                    aria-label={`Access for ${p.email}`}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={removingEmail !== null}
                    onClick={() => onRemove(p)}
                  >
                    {removingEmail === p.email ? "Removing…" : "Remove"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
