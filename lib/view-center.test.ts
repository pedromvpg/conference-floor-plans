import assert from "node:assert/strict";
import { test } from "node:test";
import { frameAroundViewCenter, normalizeViewCenter } from "./view-center.ts";

test("normalizeViewCenter rejects incomplete values", () => {
  assert.equal(normalizeViewCenter(null), null);
  assert.equal(normalizeViewCenter({ x: 1 }), null);
  assert.equal(normalizeViewCenter({ x: "a", y: 2 }), null);
});

test("normalizeViewCenter reads world metres", () => {
  assert.deepEqual(normalizeViewCenter({ x: 12.5, y: -3 }), { x: 12.5, y: -3 });
});

test("frameAroundViewCenter keeps span and moves the box", () => {
  const next = frameAroundViewCenter({ minX: 0, minY: 0, maxX: 40, maxY: 20 }, { x: 100, y: 50 });
  assert.equal(next.maxX - next.minX, 40);
  assert.equal(next.maxY - next.minY, 20);
  assert.equal((next.minX + next.maxX) / 2, 100);
  assert.equal((next.minY + next.maxY) / 2, 50);
});
