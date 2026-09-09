"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibraryAsset, MapObject } from "@/lib/types";
import { objectUrls } from "@/lib/hall";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export function ObjectMediaFields({
  slug,
  object,
  assets,
  sponsorLogoUrl,
  onPatch,
  onAsset,
}: {
  slug: string;
  object: MapObject;
  assets: LibraryAsset[];
  sponsorLogoUrl?: string;
  onPatch: (obj: MapObject) => void;
  onAsset: (asset: LibraryAsset) => void;
}) {
  const textures = assets.filter((a) => a.kind === "texture");
  const urls = objectUrls(object, assets);
  return (
    <div className="space-y-3">
      <MediaPicker
        label="Logo"
        hint={
          object.logoAssetId
            ? "Custom logo on the plan and hall wall."
            : sponsorLogoUrl
              ? "Using the bound sponsor logo. Upload to override."
              : "Shown on the plan and hall wall."
        }
        accept={IMAGE_ACCEPT}
        slug={slug}
        valueId={object.logoAssetId}
        previewUrl={urls.logoUrl || sponsorLogoUrl}
        textures={textures}
        onSelect={(id) => onPatch({ ...object, logoAssetId: id })}
        onAsset={(asset) => {
          onAsset(asset);
          onPatch({ ...object, logoAssetId: asset.id });
        }}
      />
      <MediaPicker
        label="Background"
        hint="Covers the booth or stage shape on the plan and hall floor."
        accept={IMAGE_ACCEPT}
        slug={slug}
        valueId={object.fillTextureAssetId}
        previewUrl={urls.fillTextureUrl}
        textures={textures}
        cover
        onSelect={(id) => onPatch({ ...object, fillTextureAssetId: id })}
        onAsset={(asset) => {
          onAsset(asset);
          onPatch({ ...object, fillTextureAssetId: asset.id });
        }}
      />
    </div>
  );
}

function MediaPicker({
  label,
  hint,
  accept,
  slug,
  valueId,
  previewUrl,
  textures,
  cover,
  onSelect,
  onAsset,
}: {
  label: string;
  hint: string;
  accept: string;
  slug: string;
  valueId: string | null;
  previewUrl?: string;
  textures: LibraryAsset[];
  cover?: boolean;
  onSelect: (id: string | null) => void;
  onAsset: (asset: LibraryAsset) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", "texture");
      fd.set("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch(`/api/events/${slug}/assets`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onAsset(data as LibraryAsset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/40">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className={cover ? "size-full object-cover" : "max-h-full max-w-full object-contain bg-white p-0.5"}
            />
          ) : (
            <span className="font-mono text-[9px] text-muted-foreground">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Select value={valueId ?? "none"} onValueChange={(v) => onSelect(v === "none" ? null : v)}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {textures.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload"}
            </Button>
            {valueId ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onSelect(null)}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
