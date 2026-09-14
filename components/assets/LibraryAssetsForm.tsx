"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/types";
import { StudioKicker, StudioPanel, studioFieldClass } from "@/components/editor/studio-ui";

export function LibraryAssetsForm({ slug, initial }: { slug: string; initial: LibraryAsset[] }) {
  const [assets, setAssets] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function upload(kind: LibraryAssetKind, file: File, name: string) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      fd.set("name", name);
      const res = await fetch(`/api/events/${slug}/assets`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAssets((list) => [...list, data as LibraryAsset]);
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setAssets((list) => list.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const textures = assets.filter((a) => a.kind === "texture");
  const models = assets.filter((a) => a.kind === "model");

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <UploadCard
          title="Textures"
          description="PNG, JPG, WebP, or SVG for logos, rugs, walls, and decals."
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          kind="texture"
          busy={busy}
          onUpload={upload}
        />
        <UploadCard
          title="Models"
          description="GLB or GLTF. +Z is the open front. 15 MB max."
          accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
          kind="model"
          busy={busy}
          onUpload={upload}
        />
      </div>
      <Grid title="Textures" items={textures} onDelete={remove} busy={busy} />
      <Grid title="Models" items={models} onDelete={remove} busy={busy} />
    </div>
  );
}

function UploadCard({
  title,
  description,
  accept,
  kind,
  busy,
  onUpload,
}: {
  title: string;
  description: string;
  accept: string;
  kind: LibraryAssetKind;
  busy: boolean;
  onUpload: (kind: LibraryAssetKind, file: File, name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <StudioPanel>
      <StudioKicker>Upload</StudioKicker>
      <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">{title}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label className="text-muted-foreground">Name</Label>
          <Input
            className={`mt-2 ${studioFieldClass}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90">
          Choose file
          <input
            type="file"
            className="sr-only"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(kind, file, name);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </StudioPanel>
  );
}

function Grid({
  title,
  items,
  onDelete,
  busy,
}: {
  title: string;
  items: LibraryAsset[];
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div>
      <StudioKicker>{title}</StudioKicker>
      {items.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-[18px] border border-border">
              <div className="flex h-28 items-center justify-center bg-[#fcfcfc]">
                {a.kind === "texture" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <span className="font-mono text-[12px] text-black/40">GLB</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="min-w-0 truncate text-[13px]">{a.name}</p>
                <Button size="xs" variant="ghost" className="text-muted-foreground hover:text-foreground" disabled={busy} onClick={() => onDelete(a.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-muted-foreground">Nothing uploaded yet.</p>
      )}
    </div>
  );
}
