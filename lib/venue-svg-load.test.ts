import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldSkipVenueSvgFetch, skipAfterVenueSvgPersist } from "./venue-svg-load.ts";

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
