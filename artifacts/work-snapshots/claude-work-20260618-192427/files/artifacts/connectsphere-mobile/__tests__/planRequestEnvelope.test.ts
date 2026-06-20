/**
 * Plan request envelope round-trip + state folding (spec 2.2).
 * Requests and responses travel as persisted chat messages; these tests pin
 * the wire format so older messages keep parsing after future changes.
 */
import {
  encodePlanRequest,
  encodePlanResponse,
  parsePlanEnvelope,
} from "@/lib/planRequestEnvelope";

describe("planRequestEnvelope", () => {
  it("round-trips a plan request", () => {
    const content = encodePlanRequest({
      id: "req-1",
      title: "Rooftop drinks",
      time: "Fri 7:00 PM",
      location: "Sugar, Brickell",
    });
    const parsed = parsePlanEnvelope(content);
    expect(parsed).toEqual({
      kind: "request",
      request: {
        id: "req-1",
        title: "Rooftop drinks",
        time: "Fri 7:00 PM",
        location: "Sugar, Brickell",
      },
    });
  });

  it("round-trips a request without optional fields", () => {
    const parsed = parsePlanEnvelope(encodePlanRequest({ id: "req-2", title: "Coffee" }));
    expect(parsed?.kind).toBe("request");
    if (parsed?.kind === "request") {
      expect(parsed.request.time).toBeUndefined();
      expect(parsed.request.location).toBeUndefined();
    }
  });

  it("round-trips accept and decline responses", () => {
    expect(parsePlanEnvelope(encodePlanResponse({ id: "req-1", status: "accepted" }))).toEqual({
      kind: "response",
      response: { id: "req-1", status: "accepted" },
    });
    expect(parsePlanEnvelope(encodePlanResponse({ id: "req-1", status: "declined" }))).toEqual({
      kind: "response",
      response: { id: "req-1", status: "declined" },
    });
  });

  it("treats plain text and malformed envelopes as non-envelopes", () => {
    expect(parsePlanEnvelope("hey, want to grab dinner?")).toBeNull();
    expect(parsePlanEnvelope("")).toBeNull();
    expect(parsePlanEnvelope(undefined)).toBeNull();
    expect(parsePlanEnvelope("::cs_plan_request::v1::not-json")).toBeNull();
    expect(parsePlanEnvelope('::cs_plan_request::v1::{"id":1}')).toBeNull(); // wrong types
    expect(parsePlanEnvelope('::cs_plan_response::v1::{"id":"x","status":"maybe"}')).toBeNull();
  });

  it("folds the latest response status onto its request (pending → accepted)", () => {
    // Simulates the chat screen's fold: collect response statuses by id.
    const thread = [
      encodePlanRequest({ id: "req-9", title: "Padel" }),
      "sounds fun!",
      encodePlanResponse({ id: "req-9", status: "accepted" }),
    ];
    const statuses: Record<string, string> = {};
    for (const content of thread) {
      const env = parsePlanEnvelope(content);
      if (env?.kind === "response") statuses[env.response.id] = env.response.status;
    }
    expect(statuses["req-9"]).toBe("accepted");
  });
});
