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
    <div className="inline-flex rounded-none border border-border p-0.5" role="group" aria-label="Measurement units">
      {(["m", "ft"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={units === u}
          title={u === "m" ? "Show metres" : "Show feet"}
          onClick={() => onChange(u)}
          className={`min-w-7 rounded-none px-1.5 py-1 font-mono text-[10px] ${
            units === u ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
