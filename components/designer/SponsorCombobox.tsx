"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Sponsor } from "@/lib/types";
import { cn } from "@/lib/utils";

function SponsorLogo({
  url,
  size = "md",
}: {
  url?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-6" : "size-8";
  if (!url) {
    return <span className={cn(box, "shrink-0 bg-muted")} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn(box, "shrink-0 bg-white object-contain p-0.5")}
    />
  );
}

export function SponsorCombobox({
  sponsors,
  value,
  onChange,
}: {
  sponsors: Sponsor[];
  value: string | null;
  onChange: (sponsor: Sponsor | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? sponsors.find((s) => s.id === value) : undefined;

  function pick(next: Sponsor | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Sponsor"
          className="mt-1 flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-none border border-input bg-background py-1 pr-2 pl-1.5 text-[11px] outline-none select-none focus-visible:border-primary"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {selected ? <SponsorLogo url={selected.logoUrl} size="sm" /> : null}
            <span
              className={cn(
                "truncate",
                selected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {selected?.name ?? "None"}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="w-72 rounded-none p-0"
      >
        <Command loop>
          <CommandInput placeholder="Search name or booth" />
          <CommandList>
            <CommandEmpty>No sponsors match.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="none unbound" onSelect={() => pick(null)}>
                <span className="size-8 shrink-0 bg-muted" />
                <span className="flex-1 truncate text-muted-foreground">None</span>
                <Check
                  className={cn(
                    "ml-auto size-3.5 shrink-0",
                    selected ? "opacity-0" : "opacity-100",
                  )}
                />
              </CommandItem>
              {sponsors.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.boothNumber} ${s.tier} ${s.id}`}
                  keywords={[s.name, s.boothNumber, s.tier]}
                  onSelect={() => pick(s)}
                >
                  <SponsorLogo url={s.logoUrl} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.boothNumber ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {s.boothNumber}
                    </span>
                  ) : null}
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      selected?.id === s.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
