"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { AgendaSession, AgendaSpeaker, MapEvent } from "@/lib/types";

export function AgendaAssetsForm({
  event,
  envStatus,
  initialSessions,
  initialSpeakers,
}: {
  event: MapEvent;
  envStatus: { keys: string[]; loadedKey: string | null };
  initialSessions: AgendaSession[];
  initialSpeakers: AgendaSpeaker[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [busy, setBusy] = useState(false);
  const [agendaAt, setAgendaAt] = useState(event.agendaSyncedAt);
  const [speakersAt, setSpeakersAt] = useState(event.speakersSyncedAt);

  async function syncAgenda() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/sync/agenda`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSessions(data.sessions as AgendaSession[]);
      setAgendaAt(new Date().toISOString());
      toast.success(`Synced ${data.sessions.length} sessions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncSpeakers() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/sync/speakers`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSpeakers(data.speakers as AgendaSpeaker[]);
      setSpeakersAt(new Date().toISOString());
      toast.success(`Synced ${data.speakers.length} speakers`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaSession[]>();
    for (const s of sessions) {
      const key = s.stage || "Unstaged";
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.airtableId, s])), [speakers]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <p className="chrome-kicker">Airtable</p>
          <CardTitle className="mt-1">Agenda & speakers</CardTitle>
          <CardDescription>
            Same <code className="font-mono text-[11px]">CONF_BITCOINASIA2026</code> as bitcoinAsia2026 screens
            (agendaBaseId / agendaTable / speakersTable). Field names match BA26.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="font-mono text-[11px] text-muted-foreground">
            {envStatus.loadedKey ? `Loaded ${envStatus.loadedKey}` : `Missing ${envStatus.keys.join(" or ")}`}
            {" · "}
            {agendaAt ? `Agenda ${new Date(agendaAt).toLocaleString()}` : "Agenda never synced"}
            {" · "}
            {speakersAt ? `Speakers ${new Date(speakersAt).toLocaleString()}` : "Speakers never synced"}
          </p>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void syncSpeakers()} disabled={busy}>
            Sync speakers
          </Button>
          <Button type="button" onClick={() => void syncAgenda()} disabled={busy}>
            Sync agenda
          </Button>
        </CardFooter>
      </Card>

      <div>
        <p className="chrome-kicker">Speakers</p>
        <div className="mt-2 space-y-1">
          {speakers.map((s) => (
            <div key={s.id} className="chrome-row px-2">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt="" className="h-8 w-8 object-cover" />
              ) : (
                <span className="h-8 w-8 bg-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
            </div>
          ))}
          {!speakers.length ? (
            <p className="text-sm text-muted-foreground">No speakers cached. Sync speakers to store durable headshots.</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="chrome-kicker">Sessions</p>
        <div className="mt-2 space-y-4">
          {grouped.map(([stage, items]) => (
            <div key={stage}>
              <p className="chrome-kicker pb-1">{stage}</p>
              {items.map((s) => (
                <div key={s.id} className="border-b border-border px-1 py-2 last:border-b-0">
                  <p className="text-[13px]">{s.title || "Untitled"}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {s.startUnix ? new Date(s.startUnix * 1000).toLocaleString() : "No start"}
                    {s.sessionType ? ` · ${s.sessionType}` : ""}
                  </p>
                  {s.speakerIds.length ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {s.speakerIds.map((id) => speakerById.get(id)?.name ?? id).join(", ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          {!sessions.length ? (
            <p className="text-sm text-muted-foreground">No sessions cached yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
