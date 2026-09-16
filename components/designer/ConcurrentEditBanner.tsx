"use client";

import { useEffect, useRef, useState } from "react";

function tabId(): string {
  const key = "maps_editor_tab";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function ConcurrentEditBanner({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [others, setOthers] = useState<string[]>([]);
  const idRef = useRef("");

  useEffect(() => {
    if (!enabled) return;
    idRef.current = tabId();
    let cancelled = false;
    async function beat() {
      try {
        const res = await fetch(`/api/events/${slug}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabId: idRef.current }),
        });
        const data = (await res.json()) as { others?: string[] };
        if (!cancelled) setOthers(data.others ?? []);
      } catch {
        if (!cancelled) setOthers([]);
      }
    }
    void beat();
    const timer = window.setInterval(() => void beat(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, slug]);

  if (!enabled || others.length === 0) return null;
  const who = others.join(", ");
  const verb = others.length === 1 ? "is" : "are";
  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-500/15 px-3 py-2 text-center text-[13px] leading-snug text-amber-950 dark:text-amber-50"
    >
      <strong>{who}</strong> {verb} also editing this event. Saves last-write-wins — talk before publishing.
    </div>
  );
}
