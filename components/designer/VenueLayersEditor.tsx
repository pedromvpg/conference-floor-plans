"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Eye, EyeOff, Group, GripVertical, Lock, LockOpen, Trash2, Ungroup } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SvgLayer } from "@/lib/svg-layers";
import { cn } from "@/lib/utils";

type Props = {
  layers: SvgLayer[];
  hoverId: string | null;
  selectedIds: string[];
  onHover: (id: string | null) => void;
  onSelect: (id: string, additive?: boolean) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
  onDelete: (id: string) => void;
  onReorder: (parentId: string | null, frontToBackIds: string[]) => void;
  onReparent: (id: string, newParentId: string | null, beforeId: string | null) => void;
  onRename: (id: string, name: string) => void;
  onRenameText: (id: string, text: string) => void;
  onGroup: () => void;
  onUngroup: (id: string) => void;
};

function isNestable(kind: string) {
  return kind === "g" || kind === "a";
}

function layerContains(root: SvgLayer, id: string): boolean {
  if (root.id === id) return true;
  return root.children.some((c) => layerContains(c, id));
}

function findLayer(nodes: SvgLayer[], id: string): SvgLayer | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const c = findLayer(n.children, id);
    if (c) return c;
  }
  return null;
}

function LayerRows({
  layers,
  allLayers,
  parentId,
  depth,
  hoverId,
  selectedIds,
  expanded,
  setExpanded,
  dragId,
  setDragId,
  overId,
  setOverId,
  editingId,
  setEditingId,
  draftName,
  setDraftName,
  onHover,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onDelete,
  onReorder,
  onReparent,
  onRename,
}: {
  layers: SvgLayer[];
  allLayers: SvgLayer[];
  parentId: string | null;
  depth: number;
  hoverId: string | null;
  selectedIds: string[];
  expanded: Set<string>;
  setExpanded: (next: Set<string>) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  overId: string | null;
  setOverId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  draftName: string;
  setDraftName: (name: string) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string, additive?: boolean) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
  onDelete: (id: string) => void;
  onReorder: (parentId: string | null, frontToBackIds: string[]) => void;
  onReparent: (id: string, newParentId: string | null, beforeId: string | null) => void;
  onRename: (id: string, name: string) => void;
}) {
  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    const ids = layers.map((l) => l.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(parentId, next);
  }

  function commitName(id: string) {
    const name = draftName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
  }

  return (
    <>
      {layers.map((layer) => {
        const open = expanded.has(layer.id);
        const hasKids = layer.children.length > 0 || isNestable(layer.kind);
        const selected = selectedIds.includes(layer.id);
        const editing = editingId === layer.id;
        return (
          <li
            key={layer.id}
            className="list-none"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const t = e.target as HTMLElement;
              if (t.closest("button, input")) return;
              onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
            }}
          >
            <div
              draggable={!editing}
              onDragStart={(e) => {
                setDragId(layer.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", layer.id);
                e.dataTransfer.setData("text/parent", parentId ?? "");
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOverId(layer.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const from = e.dataTransfer.getData("text/plain") || dragId;
                if (!from || from === layer.id) {
                  setDragId(null);
                  setOverId(null);
                  return;
                }
                const dragged = findLayer(allLayers, from);
                if (dragged && layerContains(dragged, layer.id)) {
                  setDragId(null);
                  setOverId(null);
                  return;
                }
                if (isNestable(layer.kind)) {
                  onReparent(from, layer.id, null);
                  setExpanded(new Set([...expanded, layer.id]));
                } else {
                  const fromParent = e.dataTransfer.getData("text/parent");
                  if (fromParent === (parentId ?? "")) move(from, layer.id);
                  else onReparent(from, parentId, layer.id);
                }
                setDragId(null);
                setOverId(null);
              }}
              onMouseEnter={() => onHover(layer.id)}
              onMouseLeave={() => onHover(null)}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                const t = e.target as HTMLElement;
                if (t.closest("button, input")) return;
                onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-0.5 rounded-sm border border-transparent py-0.5 pr-0.5",
                hoverId === layer.id && "border-border bg-muted/60",
                selected && "border-primary bg-muted",
                overId === layer.id && dragId && dragId !== layer.id && "border-primary",
                layer.hidden && "opacity-50",
                layer.locked && !layer.hidden && "opacity-70",
              )}
              style={{ paddingLeft: 2 + depth * 8 }}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="flex size-4 items-center justify-center text-muted-foreground"
                  aria-label={open ? "Collapse" : "Expand"}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = new Set(expanded);
                    if (open) next.delete(layer.id);
                    else next.add(layer.id);
                    setExpanded(next);
                  }}
                >
                  <ChevronRight className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} strokeWidth={1.5} />
                </button>
              ) : (
                <span className="size-4" />
              )}
              <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
                <GripVertical className="size-4 shrink-0" strokeWidth={1.5} />
              </span>
              {editing ? (
                <Input
                  autoFocus
                  className="h-6 min-w-0 flex-1 px-1 text-[11px]"
                  value={draftName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitName(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitName(layer.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-[11px]"
                  title={`${layer.kind}: ${layer.name}`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(layer.id);
                    setDraftName(layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLocked(layer.id, !layer.locked);
                }}
              >
                {layer.locked ? <Lock strokeWidth={1.5} /> : <LockOpen strokeWidth={1.5} />}
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={layer.hidden ? `Show ${layer.name}` : `Hide ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(layer.id, !layer.hidden);
                }}
              >
                {layer.hidden ? <EyeOff strokeWidth={1.5} /> : <Eye strokeWidth={1.5} />}
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Delete ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete “${layer.name}” from the drawing?`)) onDelete(layer.id);
                }}
              >
                <Trash2 strokeWidth={1.5} />
              </Button>
            </div>
            {hasKids && open ? (
              <ul>
                <LayerRows
                  layers={layer.children}
                  allLayers={allLayers}
                  parentId={layer.id}
                  depth={depth + 1}
                  hoverId={hoverId}
                  selectedIds={selectedIds}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  dragId={dragId}
                  setDragId={setDragId}
                  overId={overId}
                  setOverId={setOverId}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  draftName={draftName}
                  setDraftName={setDraftName}
                  onHover={onHover}
                  onSelect={onSelect}
                  onToggleHidden={onToggleHidden}
                  onToggleLocked={onToggleLocked}
                  onDelete={onDelete}
                  onReorder={onReorder}
                  onReparent={onReparent}
                  onRename={onRename}
                />
              </ul>
            ) : null}
          </li>
        );
      })}
    </>
  );
}

export function VenueLayersEditor({
  layers,
  hoverId,
  selectedIds,
  onHover,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onDelete,
  onReorder,
  onReparent,
  onRename,
  onRenameText,
  onGroup,
  onUngroup,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const selected = selectedId ? findLayer(layers, selectedId) : null;
  const canUngroup = selected ? isNestable(selected.kind) : false;

  useEffect(() => {
    if (!selectedId) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      function walk(nodes: SvgLayer[], trail: string[]): boolean {
        for (const n of nodes) {
          if (n.id === selectedId) {
            trail.forEach((t) => next.add(t));
            return true;
          }
          if (walk(n.children, [...trail, n.id])) return true;
        }
        return false;
      }
      walk(layers, []);
      return next;
    });
  }, [selectedId, layers]);

  if (!layers.length) {
    return <p className="text-[11px] text-muted-foreground">This drawing has no editable layers.</p>;
  }

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={selectedIds.length < 1} onClick={onGroup}>
          <Group strokeWidth={1.5} />
          Group
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canUngroup}
          onClick={() => selected && onUngroup(selected.id)}
        >
          <Ungroup strokeWidth={1.5} />
          Ungroup
        </Button>
      </div>
      <ul className="space-y-0.5" aria-label="Venue drawing layers">
        <LayerRows
          layers={layers}
          allLayers={layers}
          parentId={null}
          depth={0}
          hoverId={hoverId}
          selectedIds={selectedIds}
          expanded={expanded}
          setExpanded={setExpanded}
          dragId={dragId}
          setDragId={setDragId}
          overId={overId}
          setOverId={setOverId}
          editingId={editingId}
          setEditingId={setEditingId}
          draftName={draftName}
          setDraftName={setDraftName}
          onHover={onHover}
          onSelect={onSelect}
          onToggleHidden={onToggleHidden}
          onToggleLocked={onToggleLocked}
          onDelete={onDelete}
          onReorder={onReorder}
          onReparent={onReparent}
          onRename={onRename}
        />
      </ul>
      {selected ? (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{selected.kind}</p>
          <div>
            <label className="text-[10px] text-muted-foreground" htmlFor="venue-layer-name">
              Name
            </label>
            <Input
              id="venue-layer-name"
              className="mt-0.5"
              value={selected.name}
              onChange={(e) => onRename(selected.id, e.target.value)}
            />
          </div>
          {selected.text != null ? (
            <div>
              <label className="text-[10px] text-muted-foreground" htmlFor="venue-layer-text">
                Label
              </label>
              <Input
                id="venue-layer-text"
                className="mt-0.5"
                value={selected.text}
                onChange={(e) => onRenameText(selected.id, e.target.value)}
              />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Shift-click to select several layers. Drag onto a group to nest. Double-click a name to rename.
            </p>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="mt-1"
            onClick={() => onDelete(selected.id)}
          >
            Delete
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Click a layer or an element on the drawing to edit it.</p>
      )}
    </div>
  );
}
