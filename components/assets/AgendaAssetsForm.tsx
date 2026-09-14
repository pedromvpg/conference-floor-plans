"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AgendaSession, AgendaSpeaker, MapEvent } from "@/lib/types";
import { StudioKicker, StudioPanel } from "@/components/editor/studio-ui";

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
    <div className="space-y-8">
      <StudioPanel className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <StudioKicker>Cache</StudioKicker>
          <p className="mt-3 text-[40px] leading-none font-semibold tracking-[-0.05em]">{sessions.length}</p>
          <p className="mt-2 max-w-lg text-[14px] text-muted-foreground">
            sessions · {speakers.length} speakers
            {" · "}
            {envStatus.loadedKey ? envStatus.loadedKey : `Missing ${envStatus.keys.join(" or ")}`}
            {" · "}
            {agendaAt ? `agenda ${new Date(agendaAt).toLocaleString("en-GB")}` : "agenda never synced"}
            {" · "}
            {speakersAt ? `speakers ${new Date(speakersAt).toLocaleString("en-GB")}` : "speakers never synced"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="glass" size="lg" onClick={() => void syncSpeakers()} disabled={busy}>
            Sync speakers
          </Button>
          <Button type="button" variant="inverse" size="lg" onClick={() => void syncAgenda()} disabled={busy}>
            Sync agenda
          </Button>
        </div>
      </StudioPanel>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div>
          <StudioKicker>Speakers</StudioKicker>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {speakers.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <span className="size-10 rounded-full bg-muted" />
                )}
                <span className="min-w-0 flex-1 truncate text-[14px]">{s.name}</span>
              </li>
            ))}
          </ul>
          {!speakers.length ? (
            <p className="mt-3 text-[14px] text-muted-foreground">No speakers cached. Sync speakers to store headshots.</p>
          ) : null}
        </div>

        <div>
          <StudioKicker>Sessions</StudioKicker>
          <div className="mt-4 space-y-8">
            {grouped.map(([stage, items]) => (
              <div key={stage}>
                <p className="font-mono text-[12px] tracking-wide text-muted-foreground uppercase">{stage}</p>
                <ul className="mt-2 divide-y divide-border border-y border-border">
                  {items.map((s) => (
                    <li key={s.id} className="py-3">
                      <p className="text-[15px] tracking-[-0.02em]">{s.title || "Untitled"}</p>
                      <p className="mt-1 font-mono text-[12px] text-muted-foreground">
                        {s.startUnix ? new Date(s.startUnix * 1000).toLocaleString("en-GB") : "No start"}
                        {s.sessionType ? ` · ${s.sessionType}` : ""}
                      </p>
                      {s.speakerIds.length ? (
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {s.speakerIds.map((id) => speakerById.get(id)?.name ?? id).join(", ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!sessions.length ? <p className="text-[14px] text-muted-foreground">No sessions cached yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
