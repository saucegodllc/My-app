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

var mockDbWhere = jest.fn().mockResolvedValue(undefined);
var mockDbSet = jest.fn().mockReturnValue({ where: mockDbWhere });
var mockDbUpdate = jest.fn().mockReturnValue({ set: mockDbSet });
jest.mock("@workspace/db", () => {
  const actual = jest.requireActual("@workspace/db");
  return {
    ...actual,
    db: {
      ...actual.db,
      update: (...args: unknown[]) => mockDbUpdate(...args),
    },
  };
});

// ─── Mock Stripe client ───────────────────────────────────────────────────────

var mockConstructEvent = jest.fn();
jest.mock("../lib/stripeClient", () => ({
  ...jest.requireActual("../lib/stripeClient"),
  // The route handler calls getStripeClient() (async). The previous mock only
  // stubbed getDirectStripeClient, so getStripeClient ran for real and every
  // request 503'd — which is why this file sat in testPathIgnorePatterns.
  getStripeClient: jest.fn().mockResolvedValue({
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    customers: { update: jest.fn().mockResolvedValue({}) },
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue({
        metadata: { clerkUserId: "user_test_abc" },
        items: { data: [] },
      }),
    },
  }),
  getDirectStripeClient: jest.fn().mockReturnValue({
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    customers: { update: jest.fn().mockResolvedValue({}) },
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue({
        metadata: { clerkUserId: "user_test_abc" },
        items: { data: [] },
      }),
    },
  }),
}));

// Signature verification only runs when a webhook secret is configured. Set one
// so tests exercise the same constructEvent path as production.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

// ─── Mock RevenueCat client ───────────────────────────────────────────────────

var mockGrant  = jest.fn().mockResolvedValue(undefined);
var mockRevoke = jest.fn().mockResolvedValue(undefined);
jest.mock("../lib/revenueCatClient", () => ({
  grantRevenueCatEntitlement:  (...args: unknown[]) => mockGrant(...args),
  revokeRevenueCatEntitlement: (...args: unknown[]) => mockRevoke(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEvent(type: string, data: object) {
  return {
    type,
    data: {
      object: {
        id: "cs_test_123",
        client_reference_id: "user_test_abc",
        metadata: { clerkUserId: "user_test_abc", plan: "monthly" },
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

  // ── Regression: webhook signature bypass (fixed in 2c5402e) ───────────────
  // Before the fix, a request that simply omitted the stripe-signature header
  // fell through to an unverified JSON.parse and PROCESSED the event. An
  // attacker could forge checkout.session.completed to self-grant premium.
  it("does NOT process a forged event when the signature header is missing", async () => {
    const forged = buildEvent("checkout.session.completed", {
      payment_status: "paid",
      mode: "subscription",
    });

    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(forged))
      .expect(400);

    // The unverified branch must be unreachable: no parse, no entitlement.
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("returns 500 in production when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const savedNodeEnv = process.env.NODE_ENV;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "production";
    try {
      await postWebhook(buildEvent("checkout.session.completed", {})).expect(500);
      expect(mockGrant).not.toHaveBeenCalled();
    } finally {
      if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
      process.env.NODE_ENV = savedNodeEnv;
    }
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
