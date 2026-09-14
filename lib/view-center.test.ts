import assert from "node:assert/strict";
import { test } from "node:test";
import { frameAroundViewCenter, normalizeViewCenter, spanToFitBounds } from "./view-center.ts";

test("normalizeViewCenter rejects incomplete values", () => {
  assert.equal(normalizeViewCenter(null), null);
  assert.equal(normalizeViewCenter({ x: 1 }), null);
  assert.equal(normalizeViewCenter({ x: "a", y: 2 }), null);
});

test("normalizeViewCenter reads world metres", () => {
  assert.deepEqual(normalizeViewCenter({ x: 12.5, y: -3 }), { x: 12.5, y: -3 });
});

test("spanToFitBounds is at least the bounds size", () => {
  const bounds = { minX: 0, minY: 0, maxX: 40, maxY: 20 };
  assert.ok(spanToFitBounds(bounds, null) >= 40);
  assert.ok(spanToFitBounds(bounds, { x: 0, y: 0 }) > spanToFitBounds(bounds, null));
});

test("frameAroundViewCenter expands so original bounds stay inside", () => {
  const next = frameAroundViewCenter({ minX: 0, minY: 0, maxX: 40, maxY: 20 }, { x: 100, y: 50 });
  assert.ok(next.minX <= 0 && next.maxX >= 40);
  assert.ok(next.minY <= 0 && next.maxY >= 20);
  assert.equal((next.minX + next.maxX) / 2, 100);
  assert.equal((next.minY + next.maxY) / 2, 50);
});


