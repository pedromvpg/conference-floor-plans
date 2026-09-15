import assert from "node:assert/strict";
import { test } from "node:test";
import { cloneDesignerSnapshot, DesignerHistory, type DesignerSnapshot } from "./designer-history.ts";
import type { Floor, MapObject } from "./types.ts";

function snap(n: number): DesignerSnapshot {
  return cloneDesignerSnapshot(
    [{ id: "f1", eventId: "e", name: "L1", sortOrder: 0, underlayUrl: null, originalUrl: null, calibration: null, basemap: null, viewCenter: null, createdAt: "", updatedAt: "" }] as Floor[],
    [{ id: String(n) } as MapObject],
    { f1: `<svg>${n}</svg>` },
  );
}

test("each capture without a key is its own undo step", () => {
  const h = new DesignerHistory();
  h.capture(snap(0));
  h.capture(snap(1));
  const a = h.undo(snap(2));
  assert.equal(a?.objects[0].id, "1");
  const b = h.undo(snap(1));
  assert.equal(b?.objects[0].id, "0");
});

test("same coalesce key collapses until the window closes", () => {
  const h = new DesignerHistory();
  assert.equal(h.capture(snap(0), "obj:x:name"), true);
  assert.equal(h.capture(snap(1), "obj:x:name"), false);
  const prev = h.undo(snap(9));
  assert.equal(prev?.objects[0].id, "0");
  assert.equal(h.undo(snap(0)), null);
});

test("a different key always starts a new step", () => {
  const h = new DesignerHistory();
  h.capture(snap(0), "obj:x:name");
  h.capture(snap(1), "obj:x:booth");
  const prev = h.undo(snap(2));
  assert.equal(prev?.objects[0].id, "1");
});

test("redo restores the undone snapshot", () => {
  const h = new DesignerHistory();
  h.capture(snap(0));
  const undone = h.undo(snap(1));
  assert.equal(undone?.objects[0].id, "0");
  const redone = h.redo(snap(0));
  assert.equal(redone?.objects[0].id, "1");
});
