import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchVenueSvgMarkup, nestedVenuePlacement, shouldSkipVenueSvgFetch, skipAfterVenueSvgPersist } from "./venue-svg-load.ts";

test("does not fetch raster underlays", async () => {
  assert.equal(await fetchVenueSvgMarkup("https://cdn/hall.png"), null);
  assert.equal(await fetchVenueSvgMarkup(null), null);
});

test("nested venue placement keeps calibration mapping for overflow geometry", () => {
  const placed = nestedVenuePlacement(
    { x: 0, y: 0, w: 1000, h: 1000 },
    { x: -500, y: 900, w: 1400, h: 1000 },
    { x: 0, y: 0, w: 100, h: 100 },
  );
  assert.equal(placed.x, -50);
  assert.equal(placed.y, 90);
  assert.equal(placed.w, 140);
  assert.equal(placed.h, 100);
});

test("does not skip fetch when switching floors, even if skip matches the saved URL", () => {
  const skip = { floorId: "l2", url: "https://cdn/l2.svg" };
  assert.equal(
    shouldSkipVenueSvgFetch({ floorChanged: true, floorId: "l2", underlayUrl: skip.url, skip }),
    false,
  );
});

test("skips fetch when the same floor’s underlay URL is the one we just saved", () => {
  const skip = { floorId: "l2", url: "https://cdn/l2.svg" };
  assert.equal(
    shouldSkipVenueSvgFetch({ floorChanged: false, floorId: "l2", underlayUrl: skip.url, skip }),
    true,
  );
});

test("persist skip is not set if the user already switched away", () => {
  assert.equal(
    skipAfterVenueSvgPersist({
      viewingFloorId: "l1",
      targetFloorId: "l2",
      hasLocalSvg: true,
      underlayUrl: "https://cdn/l2.svg",
    }),
    null,
  );
});

test("persist skip is not set if local markup was cleared", () => {
  assert.equal(
    skipAfterVenueSvgPersist({
      viewingFloorId: "l2",
      targetFloorId: "l2",
      hasLocalSvg: false,
      underlayUrl: "https://cdn/l2.svg",
    }),
    null,
  );
});
