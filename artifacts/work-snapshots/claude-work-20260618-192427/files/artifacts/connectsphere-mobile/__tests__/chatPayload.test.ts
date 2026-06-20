import {
  encodeVoiceMemoPayload,
  formatChatPreview,
  parseChatPayload,
} from "@/lib/chatPayload";
import { encodePlanRequest, encodePlanResponse } from "@/lib/planRequestEnvelope";

describe("chatPayload", () => {
  it("parses plan request and response envelopes", () => {
    expect(parseChatPayload(encodePlanRequest({
      id: "plan-1",
      title: "Wynwood drinks",
      time: "Tonight 8 PM",
      location: "Dante's",
    }))).toEqual({
      kind: "plan_request",
      id: "plan-1",
      title: "Wynwood drinks",
      time: "Tonight 8 PM",
      location: "Dante's",
    });

    expect(parseChatPayload(encodePlanResponse({ id: "plan-1", status: "accepted" }))).toEqual({
      kind: "plan_response",
      id: "plan-1",
      status: "accepted",
    });
  });

  it("parses voice, gif, and image fallback payloads", () => {
    expect(parseChatPayload("[voice:https://cdn.example.com/memo.m4a:12]")).toEqual({
      kind: "voice",
      url: "https://cdn.example.com/memo.m4a",
      durationSeconds: 12,
    });
    expect(parseChatPayload("[gif:https://cdn.example.com/loop.gif]")).toEqual({
      kind: "gif",
      url: "https://cdn.example.com/loop.gif",
    });
    expect(parseChatPayload("[image:https://cdn.example.com/photo.jpg]")).toEqual({
      kind: "image",
      url: "https://cdn.example.com/photo.jpg",
    });
  });

  it("formats Connect previews for rich chat payloads", () => {
    expect(formatChatPreview(encodePlanRequest({ id: "plan-2", title: "Coffee" }))).toBe("Plan request pending");
    expect(formatChatPreview(encodePlanResponse({ id: "plan-2", status: "accepted" }))).toBe("Plan confirmed");
    expect(formatChatPreview(encodePlanResponse({ id: "plan-2", status: "declined" }))).toBe("Plan declined");
    expect(formatChatPreview(encodeVoiceMemoPayload("https://cdn.example.com/memo.m4a", 72))).toBe("Voice memo · 1:12");
    expect(formatChatPreview("[gif:https://cdn.example.com/loop.gif]")).toBe("GIF");
    expect(formatChatPreview("[image:https://cdn.example.com/photo.jpg]")).toBe("Photo");
    expect(formatChatPreview("See you there")).toBe("See you there");
  });
});
