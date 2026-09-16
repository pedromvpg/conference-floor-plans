import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastingLabel } from "./paint.ts";
import { fitLabelInBox, worldTopLeftOfLocalBox, wrapLabelLines } from "./label-layout.ts";

test("wrapLabelLines breaks on words then characters", () => {
  assert.deepEqual(wrapLabelLines("GENESIS STAGE", 8), ["GENESIS", "STAGE"]);
  assert.deepEqual(wrapLabelLines("Open Source", 7), ["Open", "Source"]);
});

test("fitLabelInBox keeps text inside the box", () => {
  const { fontSize, lines } = fitLabelInBox("GENESIS STAGE", 6, 3, 2);
  assert.ok(lines.length >= 2);
  assert.ok(fontSize <= 2);
  assert.ok(lines.length * fontSize * 1.12 <= 3 + 1e-6);
});

test("worldTopLeftOfLocalBox stays on the visual top-left after rotation", () => {
  const local = { minX: -2, minY: -1, maxX: 2, maxY: 1 };
  const unrotated = worldTopLeftOfLocalBox(0, 0, 0, local);
  assert.equal(unrotated.x, -2);
  assert.equal(unrotated.y, -1);
  const quarter = worldTopLeftOfLocalBox(0, 0, 90, local);
  assert.ok(Math.abs(quarter.x - -1) < 1e-9);
  assert.ok(Math.abs(quarter.y - -2) < 1e-9);
});

test("contrastingLabel is white on dark fills and black on light fills", () => {
  assert.equal(contrastingLabel("#000000", 1, "light"), "#fcfcfc");
  assert.equal(contrastingLabel("#ffffff", 1, "dark"), "#0a0a0a");
  assert.equal(contrastingLabel("#f97316", 1, "light"), "#fcfcfc");
});

test("contrastingLabel uses map tone when the fill is transparent", () => {
  assert.equal(contrastingLabel("#000000", 0, "light"), "#0a0a0a");
  assert.equal(contrastingLabel("#ffffff", 0, "dark"), "#fcfcfc");
});
