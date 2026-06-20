import { hasPremiumAccess } from "../lib/premiumAccess";

test("unlocks premium content when the entitlement returns isPremium", () => {
  expect(hasPremiumAccess({ isPremium: true })).toBe(true);
});

test("does not treat legacy isActive as the premium entitlement source", () => {
  expect(hasPremiumAccess({ isActive: true })).toBe(false);
});
