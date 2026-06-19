import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildIncomingActionCards } from "./connectIncoming.ts";
import type { CsReaction, CsRequest } from "./connectApi.ts";

describe("buildIncomingActionCards", () => {
  it("combines spark, reactions, and requests while excluding pass-like actions", () => {
    const reactions = [
      {
        id: "reaction-spark",
        senderId: "user_sarah",
        receiverId: "user_self",
        type: "spark",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: "2026-05-01T12:00:00.000Z",
        senderName: "Sarah",
        senderPhotoUrl: "https://example.com/sarah.jpg",
      },
      {
        id: "reaction-pass",
        senderId: "user_skip",
        receiverId: "user_self",
        type: "pass",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: "2026-05-01T12:01:00.000Z",
      },
      {
        id: "reaction-shot",
        senderId: "user_marcus",
        receiverId: "user_self",
        type: "shot_reaction",
        sourceType: "shot",
        status: "pending",
        isBlurredForReceiver: true,
        createdAt: "2026-05-01T12:02:00.000Z",
        senderName: "Marcus",
      },
    ] as unknown as CsReaction[];

    const requests = [
      {
        id: "request-plan",
        senderId: "user_elena",
        receiverId: "user_self",
        type: "plan_request",
        sourceType: "plan",
        status: "pending",
        createdAt: "2026-05-01T12:03:00.000Z",
        senderName: "Elena",
        planTitle: "Rooftop drinks",
      },
    ] as CsRequest[];

    const cards = buildIncomingActionCards({ reactions, requests, isPremium: false });

    assert.deepEqual(cards.map((card) => card.id), [
      "request:request-plan",
      "reaction:reaction-shot",
      "reaction:reaction-spark",
    ]);
    assert.deepEqual(cards.map((card) => card.actionType), ["plan", "shot", "spark"]);
    assert.equal(cards.some((card) => String(card.actionType) === "pass"), false);
    assert.equal(cards[0]?.senderId, "user_elena");
    assert.equal(cards[0]?.isLocked, true);
    assert.equal(cards[2]?.isLocked, false);
  });

  it("reveals every incoming action for premium users", () => {
    const reactions = [
      {
        id: "reaction-like",
        senderId: "user_ana",
        receiverId: "user_self",
        type: "like",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: true,
        createdAt: "2026-05-01T12:00:00.000Z",
        senderName: "Ana",
      },
    ] as CsReaction[];

    const cards = buildIncomingActionCards({ reactions, requests: [], isPremium: true });

    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.isLocked, false);
  });
});
