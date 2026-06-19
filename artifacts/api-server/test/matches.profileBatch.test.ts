import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildProfilesByUserId,
  getOtherUserIdsForMatches,
  withProfileAge,
} from "../src/routes/matchesBatching";

test("getOtherUserIdsForMatches returns unique other users from either match side", () => {
  const matches = [
    { id: "m1", userId1: "viewer", userId2: "a" },
    { id: "m2", userId1: "b", userId2: "viewer" },
    { id: "m3", userId1: "viewer", userId2: "a" },
  ];

  assert.deepEqual(getOtherUserIdsForMatches("viewer", matches), ["a", "b"]);
});

test("buildProfilesByUserId keeps profiles keyed by user id and preserves missing lookups", () => {
  const profileA = withProfileAge({
    userId: "a",
    displayName: "A",
    birthDate: "2000-01-01",
  });
  const profileB = withProfileAge({
    userId: "b",
    displayName: "B",
    birthDate: null,
  });

  const profilesByUserId = buildProfilesByUserId([profileA, profileB]);

  assert.equal(profilesByUserId.get("a")?.displayName, "A");
  assert.equal(typeof profilesByUserId.get("a")?.age, "number");
  assert.equal(profilesByUserId.get("b")?.age, undefined);
  assert.equal(profilesByUserId.get("missing"), undefined);
});
