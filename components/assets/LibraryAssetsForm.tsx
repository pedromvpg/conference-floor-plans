"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/types";

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
    <div className="space-y-6">
      <UploadCard
        title="Textures"
        description="PNG, JPG, WebP, or SVG for logos, booth backgrounds, rugs, walls, and decals."
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        kind="texture"
        busy={busy}
        onUpload={upload}
      />
      <UploadCard
        title="Models"
        description="GLB or GLTF for custom booths and stages. +Z is the open front. 15 MB max."
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        kind="model"
        busy={busy}
        onUpload={upload}
      />

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
    <Card>
      <CardHeader className="border-b">
        <p className="chrome-kicker">Library</p>
        <CardTitle className="mt-1">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>Name</Label>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </div>
        <Input
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(kind, file, name);
            e.target.value = "";
          }}
        />
      </CardContent>
    </Card>
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
      <p className="chrome-kicker">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {items.map((a) => (
          <div key={a.id} className="border border-border p-2">
            <div className="flex h-20 items-center justify-center bg-muted/40">
              {a.kind === "texture" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="max-h-20 max-w-full object-contain" />
              ) : (
                <span className="font-mono text-[10px] text-muted-foreground">GLB</span>
              )}
            </div>
            <p className="mt-2 truncate text-[12px]">{a.name}</p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-1"
              disabled={busy}
              onClick={() => onDelete(a.id)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
      {!items.length ? <p className="mt-2 text-sm text-muted-foreground">Nothing uploaded yet.</p> : null}
    </div>
  );
}
