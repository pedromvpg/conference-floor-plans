"use client";

import type { Units } from "@/lib/types";

export function UnitsToggle({
  units,
  onChange,
}: {
  units: Units;
  onChange: (units: Units) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-border p-0.5" role="group" aria-label="Measurement units">
      {(["m", "ft"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={units === u}
          title={u === "m" ? "Show metres" : "Show feet"}
          onClick={() => onChange(u)}
          className={`h-8 min-w-8 rounded-md px-2 text-[11px] font-medium ${
            units === u ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
