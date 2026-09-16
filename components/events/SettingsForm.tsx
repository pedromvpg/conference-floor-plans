"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { MapEvent, Units } from "@/lib/types";
import { useUnits } from "@/lib/use-units";
import { StudioKicker, StudioPanel, StudioPills, studioFieldClass, studioPillClass } from "@/components/editor/studio-ui";

export function SettingsForm({
  event,
  envStatus,
}: {
  event: MapEvent;
  envStatus: { keys: string[]; loadedKey: string | null };
}) {
  const [name, setName] = useState(event.name);
  const [units, setUnits] = useUnits();
  const envLoaded = Boolean(envStatus.loadedKey);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/events/${event.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Could not save");
      return;
    }
    toast.success("Saved");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form className="lg:col-span-2" onSubmit={(e) => void save(e)}>
        <StudioPanel>
          <StudioKicker>Event</StudioKicker>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">Name and Airtable</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Airtable lives in env JSON, same as conference-screens. It is never stored on the event row.
          </p>
          <p className="mt-4 rounded-full border border-border bg-muted px-4 py-2 font-mono text-[12px] text-muted-foreground">
            {envLoaded
              ? `Loaded ${envStatus.loadedKey}`
              : `Missing ${envStatus.keys.join(" or ")} — add the screens JSON and restart`}
          </p>
          <div className="mt-6 max-w-xl">
            <Label htmlFor="event-name" className="text-muted-foreground">
              Name
            </Label>
            <Input
              id="event-name"
              className={`mt-2 ${studioFieldClass}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="inverse" size="lg">
              Save settings
            </Button>
          </div>
        </StudioPanel>
      </form>

      <StudioPanel>
        <StudioKicker>Display</StudioKicker>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">Units</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Lengths in the designer and viewer. Stored in this browser.
        </p>
        <div className="mt-6">
          <StudioPills label="Measurement units">
            {(["m", "ft"] as Units[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={units === u}
                className={studioPillClass(units === u)}
                onClick={() => setUnits(u)}
              >
                {u === "m" ? "Metres" : "Feet"}
              </button>
            ))}
          </StudioPills>
        </div>
      </StudioPanel>

      <StudioPanel>
        <StudioKicker>Access</StudioKicker>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">Editors</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Invites and per-map grants live on the Admin page.
        </p>
        <Button asChild variant="glass" size="lg" className="mt-6">
          <Link href="/admin">Open admin</Link>
        </Button>
      </StudioPanel>
    </div>
  );
}
