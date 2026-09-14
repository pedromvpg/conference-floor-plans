"use client";

import { useState } from "react";
import { toast } from "sonner";

export function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const origin = window.location.origin;
    await navigator.clipboard.writeText(`${origin}${path}`);
    setCopied(true);
    toast.success("Copied URL");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
