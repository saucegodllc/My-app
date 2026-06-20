/**
 * Integration tests — Stripe webhook handler
 * POST /api/stripe/webhook
 *
 * Tests signature verification, subscription lifecycle events,
 * and RevenueCat entitlement grant/revoke.
 *
 * Run with: pnpm test --testPathPattern=stripe.webhook
 */
import request from "supertest";
import app from "../app";

// ─── Mock Stripe client ───────────────────────────────────────────────────────

const mockConstructEvent = jest.fn();
jest.mock("../lib/stripeClient", () => ({
  getDirectStripeClient: jest.fn().mockReturnValue({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }),
}));

// ─── Mock RevenueCat client ───────────────────────────────────────────────────

const mockGrant  = jest.fn().mockResolvedValue(undefined);
const mockRevoke = jest.fn().mockResolvedValue(undefined);
jest.mock("../lib/revenueCatClient", () => ({
  grantRevenueCatEntitlement:  mockGrant,
  revokeRevenueCatEntitlement: mockRevoke,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEvent(type: string, data: object) {
  return {
    type,
    data: {
      object: {
        id: "cs_test_123",
        metadata: { userId: "user_test_abc", plan: "monthly" },
        subscription: "sub_test_123",
        customer: "cus_test_123",
        ...data,
      },
    },
  };
}

function postWebhook(event: object) {
  return request(app)
    .post("/api/stripe/webhook")
    .set("stripe-signature", "t=123,v1=sig")
    .set("Content-Type", "application/json")
    .send(JSON.stringify(event));
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    await request(app)
      .post("/api/stripe/webhook")
      .send({})
      .expect(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    await postWebhook({}).expect(400);
  });

  describe("checkout.session.completed", () => {
    it("grants RevenueCat entitlement with correct userId", async () => {
      const event = buildEvent("checkout.session.completed", {
        payment_status: "paid",
        mode: "subscription",
      });
      mockConstructEvent.mockReturnValue(event);

      await postWebhook(event).expect(200);

      expect(mockGrant).toHaveBeenCalledWith("user_test_abc", 1);
    });

    it("does NOT grant for non-paid sessions", async () => {
      const event = buildEvent("checkout.session.completed", {
        payment_status: "unpaid",
        mode: "subscription",
      });
      mockConstructEvent.mockReturnValue(event);

      await postWebhook(event).expect(200);
      expect(mockGrant).not.toHaveBeenCalled();
    });

    it("grants 12 months for yearly plan", async () => {
      const event = buildEvent("checkout.session.completed", {
        payment_status: "paid",
        mode: "subscription",
        metadata: { userId: "user_test_abc", plan: "yearly" },
      });
      // Mutate event object's metadata
      (event.data.object as any).metadata.plan = "yearly";
      mockConstructEvent.mockReturnValue(event);

      await postWebhook(event).expect(200);
      expect(mockGrant).toHaveBeenCalledWith("user_test_abc", 12);
    });
  });

  describe("customer.subscription.deleted", () => {
    it("revokes RevenueCat entitlement", async () => {
      const event = buildEvent("customer.subscription.deleted", {
        metadata: { userId: "user_test_abc" },
      });
      mockConstructEvent.mockReturnValue(event);

      await postWebhook(event).expect(200);
      expect(mockRevoke).toHaveBeenCalledWith("user_test_abc");
    });
  });

  describe("invoice.payment_failed", () => {
    it("responds 200 without crashing", async () => {
      const event = buildEvent("invoice.payment_failed", {});
      mockConstructEvent.mockReturnValue(event);

      await postWebhook(event).expect(200);
    });
  });

  describe("unknown event type", () => {
    it("responds 200 and ignores the event", async () => {
      const event = buildEvent("some.unknown.event", {});
      mockConstructEvent.mockReturnValue(event);

      await postWebhook(event).expect(200);
      expect(mockGrant).not.toHaveBeenCalled();
      expect(mockRevoke).not.toHaveBeenCalled();
    });
  });
});
