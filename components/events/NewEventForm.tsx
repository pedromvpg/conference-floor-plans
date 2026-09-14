"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eventStudioHref } from "@/lib/studio-nav";
import { slugify } from "@/lib/store";

export function NewEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: slug || slugify(name) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create");
      return;
    }
    router.push(eventStudioHref(data.slug));
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-md space-y-4">
      <div>
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          className="mt-1"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSlug(slugify(e.target.value));
          }}
          placeholder="Bitcoin Conference 2027"
          required
        />
      </div>
      <div>
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" className="mt-1 font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <p className="mt-1 text-xs text-muted-foreground">Viewer URL will be /e/{slug || "…"}</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        Create event
      </Button>
    </form>
  );
}
