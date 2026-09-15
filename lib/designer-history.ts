import type { DraftSlice, Floor, MapObject } from "./types";

export type DesignerSnapshot = DraftSlice & {
  venueSvgByFloor: Record<string, string>;
};

const LIMIT = 80;
const COALESCE_MS = 450;

export function cloneDesignerSnapshot(
  floors: Floor[],
  objects: MapObject[],
  venueSvgByFloor: Map<string, string> | Record<string, string>,
): DesignerSnapshot {
  const venue =
    venueSvgByFloor instanceof Map
      ? Object.fromEntries(venueSvgByFloor)
      : { ...venueSvgByFloor };
  return {
    floors: structuredClone(floors),
    objects: structuredClone(objects),
    venueSvgByFloor: { ...venue },
  };
}

export class DesignerHistory {
  private past: DesignerSnapshot[] = [];
  private future: DesignerSnapshot[] = [];
  private lastCoalesceKey: string | null = null;
  private coalesceOpen = false;
  private coalesceTimer: ReturnType<typeof setTimeout> | null = null;

  capture(current: DesignerSnapshot, coalesceKey?: string | null) {
    const key = coalesceKey ?? null;
    if (key && this.coalesceOpen && key === this.lastCoalesceKey) {
      this.armCoalesce();
      return false;
    }
    this.past.push(current);
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
    this.lastCoalesceKey = key;
    this.coalesceOpen = Boolean(key);
    if (key) this.armCoalesce();
    else this.clearCoalesceTimer();
    return true;
  }

  clearCoalesce() {
    this.lastCoalesceKey = null;
    this.coalesceOpen = false;
    this.clearCoalesceTimer();
  }

  undo(current: DesignerSnapshot): DesignerSnapshot | null {
    this.clearCoalesce();
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    if (this.future.length > LIMIT) this.future.shift();
    return prev;
  }

  redo(current: DesignerSnapshot): DesignerSnapshot | null {
    this.clearCoalesce();
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    if (this.past.length > LIMIT) this.past.shift();
    return next;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  private armCoalesce() {
    this.clearCoalesceTimer();
    this.coalesceTimer = setTimeout(() => {
      this.coalesceTimer = null;
      this.coalesceOpen = false;
      this.lastCoalesceKey = null;
    }, COALESCE_MS);
  }

  private clearCoalesceTimer() {
    if (this.coalesceTimer) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = null;
    }
  }
}
