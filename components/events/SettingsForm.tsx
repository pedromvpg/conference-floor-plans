"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { MapEvent } from "@/lib/types";
import { useUnits } from "@/lib/use-units";
import { UnitsToggle } from "@/components/units-toggle";

export function SettingsForm({ event }: { event: MapEvent }) {
  const [name, setName] = useState(event.name);
  const [baseId, setBaseId] = useState(event.airtableBaseId);
  const [table, setTable] = useState(event.airtableTable);
  const [token, setToken] = useState("");
  const [code, setCode] = useState(event.airtableEventCode);
  const [invite, setInvite] = useState("");
  const [units, setUnits] = useUnits();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/events/${event.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        airtableBaseId: baseId,
        airtableTable: table,
        airtableEventCode: code,
        ...(token ? { airtableToken: token } : {}),
      }),
    });
    if (!res.ok) {
      toast.error("Could not save");
      return;
    }
    toast.success("Saved");
  }

  async function addEditor() {
    const res = await fetch("/api/auth/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: invite }),
    });
    if (!res.ok) {
      toast.error("Invite failed");
      return;
    }
    toast.success(`Added ${invite}`);
    setInvite("");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void save(e)}>
        <Card>
          <CardHeader className="border-b">
            <p className="chrome-kicker">Event</p>
            <CardTitle className="mt-1">Details & Airtable</CardTitle>
            <CardDescription>
              Name the map and connect the sponsors table used for sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="event-name">Name</Label>
              <Input
                id="event-name"
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="airtable-base">Airtable base ID</Label>
              <Input
                id="airtable-base"
                className="mt-1 font-mono"
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="airtable-table">Sponsors table</Label>
              <Input
                id="airtable-table"
                className="mt-1 font-mono"
                value={table}
                onChange={(e) => setTable(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="airtable-code">Event-code column</Label>
              <Input
                id="airtable-code"
                className="mt-1 font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BHK26"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Optional filter on the sponsors table.</p>
            </div>
            <div>
              <Label htmlFor="airtable-token">Airtable token</Label>
              <Input
                id="airtable-token"
                className="mt-1 font-mono"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={event.airtableToken ? "•••• leave blank to keep" : "pat…"}
                autoComplete="off"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Save settings</Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader className="border-b">
          <p className="chrome-kicker">Display</p>
          <CardTitle className="mt-1">Units</CardTitle>
          <CardDescription>
            Lengths in the designer and viewer. Stored in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-4">
            <Label>Metres or feet</Label>
            <UnitsToggle units={units} onChange={setUnits} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <p className="chrome-kicker">Access</p>
          <CardTitle className="mt-1">Invite editor</CardTitle>
          <CardDescription>Editors can open the designer and publish maps.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="invite-email"
              type="email"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="producer@company.com"
              aria-label="Editor email"
            />
            <Button type="button" variant="outline" onClick={() => void addEditor()}>
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
