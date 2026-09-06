import assert from "node:assert/strict";
import test from "node:test";
import { isPastPickupTime } from "../app/lib/pickup-time.ts";

test("today disables pickup slots that have already started in Seoul", () => {
  const now = Date.parse("2026-09-06T04:15:00Z"); // 13:15 in Seoul

  assert.equal(isPastPickupTime("2026-09-06", "13:00", now), true);
  assert.equal(isPastPickupTime("2026-09-06", "13:30", now), false);
});

test("the current slot becomes unavailable as soon as it starts", () => {
  const now = Date.parse("2026-09-06T04:30:00Z"); // 13:30 in Seoul

  assert.equal(isPastPickupTime("2026-09-06", "13:30", now), true);
});

test("future pickup dates keep all operating times available", () => {
  const now = Date.parse("2026-09-06T12:30:00Z"); // 21:30 in Seoul

  assert.equal(isPastPickupTime("2026-09-07", "08:00", now), false);
});

test("incomplete pickup values are not treated as past", () => {
  const now = Date.parse("2026-09-06T04:15:00Z");

  assert.equal(isPastPickupTime("", "13:00", now), false);
  assert.equal(isPastPickupTime("2026-09-06", "", now), false);
});
