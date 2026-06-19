import { shouldShowConnectMatchMoment } from "@/lib/connectMatchMomentPolicy";

describe("Connect match moment policy", () => {
  it("does not auto-open the full-screen match moment for routine Connect list conversions", () => {
    expect(shouldShowConnectMatchMoment("accept_request")).toBe(false);
    expect(shouldShowConnectMatchMoment("like_back_reaction")).toBe(false);
  });

  it("keeps the designed match moment for explicit shot acceptance", () => {
    expect(shouldShowConnectMatchMoment("accept_shot")).toBe(true);
  });
});
