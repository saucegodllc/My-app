import { getDiscoverRailActions } from "../lib/discoverActionRail";

describe("getDiscoverRailActions", () => {
  it("maps every dating rail button to the existing action semantics", () => {
    expect(getDiscoverRailActions("dating").map(({ label, action }) => ({ label, action }))).toEqual([
      { label: "LIKE", action: "vibe" },
      { label: "SHOOT", action: "shot" },
      { label: "SPARK", action: "spark" },
      { label: "PASS", action: "pass" },
    ]);
  });

  it("maps every friends rail button to the existing action semantics", () => {
    expect(getDiscoverRailActions("friends").map(({ label, action }) => ({ label, action }))).toEqual([
      { label: "LIKE", action: "vibe" },
      { label: "PLAN", action: "create_plan" },
      { label: "BESTIES", action: "best_friend" },
      { label: "PASS", action: "pass" },
    ]);
  });

  it("keeps the dating side rail label as SHOOT while preserving shot routing", () => {
    const shoot = getDiscoverRailActions("dating").find((item) => item.label === "SHOOT");
    expect(shoot).toMatchObject({ action: "shot", color: "shot", icon: "send" });
  });
});

