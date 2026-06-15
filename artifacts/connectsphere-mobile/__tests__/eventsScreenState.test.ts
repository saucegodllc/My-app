import { EMPTY_EVENTS, eventContextIdsChanged, getEventsForScreen } from "@/lib/eventsScreenState";

describe("events screen state helpers", () => {
  it("reuses the same empty events array while Ticketmaster data is still missing", () => {
    expect(getEventsForScreen(undefined)).toBe(EMPTY_EVENTS);
    expect(getEventsForScreen({})).toBe(EMPTY_EVENTS);
    expect(getEventsForScreen({ events: undefined })).toBe(EMPTY_EVENTS);
  });

  it("detects context id changes by ordered content instead of array identity", () => {
    expect(eventContextIdsChanged(["tm-1"], ["tm-1"])).toBe(false);
    expect(eventContextIdsChanged(["tm-1"], ["tm-2"])).toBe(true);
    expect(eventContextIdsChanged(["tm-1"], ["tm-1", "tm-2"])).toBe(true);
  });
});
