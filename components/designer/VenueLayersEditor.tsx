"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SvgLayer } from "@/lib/svg-layers";
import { cn } from "@/lib/utils";

type Props = {
  layers: SvgLayer[];
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  onReorder: (parentId: string | null, frontToBackIds: string[]) => void;
  onRenameText: (id: string, text: string) => void;
};

function LayerRows({
  layers,
  parentId,
  depth,
  hoverId,
  selectedId,
  expanded,
  setExpanded,
  dragId,
  setDragId,
  overId,
  setOverId,
  onHover,
  onSelect,
  onToggleHidden,
  onDelete,
  onReorder,
}: {
  layers: SvgLayer[];
  parentId: string | null;
  depth: number;
  hoverId: string | null;
  selectedId: string | null;
  expanded: Set<string>;
  setExpanded: (next: Set<string>) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  overId: string | null;
  setOverId: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  onReorder: (parentId: string | null, frontToBackIds: string[]) => void;
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

  return (
    <>
      {layers.map((layer) => {
        const open = expanded.has(layer.id);
        const hasKids = layer.children.length > 0;
        return (
          <li key={layer.id} className="list-none">
            <div
              draggable
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
                setOverId(layer.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromParent = e.dataTransfer.getData("text/parent");
                if (fromParent !== (parentId ?? "")) return;
                const from = e.dataTransfer.getData("text/plain") || dragId;
                if (from) move(from, layer.id);
                setDragId(null);
                setOverId(null);
              }}
              onMouseEnter={() => onHover(layer.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(layer.id)}
              className={cn(
                "flex cursor-pointer items-center gap-0.5 rounded-sm border border-transparent py-0.5 pr-0.5",
                hoverId === layer.id && "border-border bg-muted/60",
                selectedId === layer.id && "border-primary bg-muted",
                overId === layer.id && dragId && dragId !== layer.id && "border-primary",
                layer.hidden && "opacity-50",
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
                  <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
                </button>
              ) : (
                <span className="size-4" />
              )}
              <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
                <GripVertical className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]" title={`${layer.kind}: ${layer.name}`}>
                {layer.name}
              </span>
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
                {layer.hidden ? <EyeOff /> : <Eye />}
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
                <Trash2 />
              </Button>
            </div>
            {hasKids && open ? (
              <ul>
                <LayerRows
                  layers={layer.children}
                  parentId={layer.id}
                  depth={depth + 1}
                  hoverId={hoverId}
                  selectedId={selectedId}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  dragId={dragId}
                  setDragId={setDragId}
                  overId={overId}
                  setOverId={setOverId}
                  onHover={onHover}
                  onSelect={onSelect}
                  onToggleHidden={onToggleHidden}
                  onDelete={onDelete}
                  onReorder={onReorder}
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
  selectedId,
  onHover,
  onSelect,
  onToggleHidden,
  onDelete,
  onReorder,
  onRenameText,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selected = selectedId
    ? (function find(nodes: SvgLayer[]): SvgLayer | null {
        for (const n of nodes) {
          if (n.id === selectedId) return n;
          const c = find(n.children);
          if (c) return c;
        }
        return null;
      })(layers)
    : null;

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
      <ul className="space-y-0.5" aria-label="Venue drawing layers">
        <LayerRows
          layers={layers}
          parentId={null}
          depth={0}
          hoverId={hoverId}
          selectedId={selectedId}
          expanded={expanded}
          setExpanded={setExpanded}
          dragId={dragId}
          setDragId={setDragId}
          overId={overId}
          setOverId={setOverId}
          onHover={onHover}
          onSelect={onSelect}
          onToggleHidden={onToggleHidden}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      </ul>
      {selected ? (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{selected.kind}</p>
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
              Drag to move. Rectangles have resize handles; polygons have vertex handles.
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
