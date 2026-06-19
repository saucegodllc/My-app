import { isFutureOrLiveEvent, type MappedEvent } from "./events";

function eventWithDates(input: Partial<Pick<MappedEvent, "startDate" | "endDate">>): MappedEvent {
  return {
    id: "event-test",
    name: "Test Event",
    description: "",
    startDate: "",
    endDate: "",
    url: "https://example.com/tickets",
    imageUrl: "",
    venueName: "Test Venue",
    venueAddress: "100 Test St, Miami, FL",
    neighborhood: "Miami",
    isFree: false,
    price: "Check tickets",
    category: "Music",
    source: "ticketmaster",
    sourceId: "tm-test",
    sourceLabel: "Ticketmaster",
    ...input,
  };
}

describe("isFutureOrLiveEvent", () => {
  const realNow = Date.now;

  beforeEach(() => {
    Date.now = jest.fn(() => new Date("2026-06-13T18:00:00.000Z").getTime());
  });

  afterEach(() => {
    Date.now = realNow;
  });

  it("keeps future Ticketmaster events visible", () => {
    expect(isFutureOrLiveEvent(eventWithDates({ startDate: "2026-06-13T22:00:00.000Z" }))).toBe(true);
  });

  it("keeps live events when the end date is still ahead", () => {
    expect(
      isFutureOrLiveEvent(
        eventWithDates({
          startDate: "2026-06-13T16:00:00.000Z",
          endDate: "2026-06-13T20:00:00.000Z",
        }),
      ),
    ).toBe(true);
  });

  it("filters events that ended more than one hour ago", () => {
    expect(
      isFutureOrLiveEvent(
        eventWithDates({
          startDate: "2026-06-13T12:00:00.000Z",
          endDate: "2026-06-13T16:30:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  it("keeps invalid or missing dates instead of emptying the feed", () => {
    expect(isFutureOrLiveEvent(eventWithDates({ startDate: "" }))).toBe(true);
    expect(isFutureOrLiveEvent(eventWithDates({ startDate: "not-a-date" }))).toBe(true);
  });
});
