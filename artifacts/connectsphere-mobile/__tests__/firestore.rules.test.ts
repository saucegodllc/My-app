/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const describeRules = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeRules("Firestore security rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "connectsphere-rules-test",
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  function authedDb(uid: string) {
    return testEnv.authenticatedContext(uid).firestore();
  }

  function anonDb() {
    return testEnv.unauthenticatedContext().firestore();
  }

  async function seed(pathName: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), pathName), data);
    });
  }

  it("denies signed-out access to user profiles", async () => {
    await assertFails(getDoc(doc(anonDb(), "users/alex")));
    await assertFails(setDoc(doc(anonDb(), "users/alex"), { displayName: "Alex" }));
  });

  it("allows owners to create and update their own user document", async () => {
    const db = authedDb("alex");

    await assertSucceeds(setDoc(doc(db, "users/alex"), { displayName: "Alex" }));
    await assertSucceeds(updateDoc(doc(db, "users/alex"), { blockedUsers: ["sam"] }));
  });

  it("blocks non-owners from sensitive user fields but allows lastSeenAt only", async () => {
    await seed("users/alex", { displayName: "Alex", lastSeenAt: "2026-06-04T00:00:00.000Z" });
    const db = authedDb("sam");

    await assertFails(updateDoc(doc(db, "users/alex"), { blockedUsers: ["sam"] }));
    await assertSucceeds(updateDoc(doc(db, "users/alex"), { lastSeenAt: "2026-06-05T00:00:00.000Z" }));
  });

  it("enforces reaction sender identity", async () => {
    const db = authedDb("sam");

    await assertSucceeds(setDoc(doc(db, "reactions/alex/received/sam"), {
      fromUserId: "sam",
      action: "like",
      createdAt: "2026-06-05T00:00:00.000Z",
    }));
    await assertFails(setDoc(doc(db, "reactions/alex/received/spoof"), {
      fromUserId: "mallory",
      action: "like",
      createdAt: "2026-06-05T00:00:00.000Z",
    }));
  });

  it("allows only match participants to read and create messages", async () => {
    await seed("messages/alex_sam/msgs/msg1", {
      senderId: "alex",
      text: "hey",
      createdAt: "2026-06-05T00:00:00.000Z",
    });

    await assertSucceeds(getDoc(doc(authedDb("alex"), "messages/alex_sam/msgs/msg1")));
    await assertFails(getDoc(doc(authedDb("mallory"), "messages/alex_sam/msgs/msg1")));
    await assertSucceeds(setDoc(doc(authedDb("sam"), "messages/alex_sam/msgs/msg2"), {
      senderId: "sam",
      text: "hi",
      createdAt: "2026-06-05T00:00:00.000Z",
    }));
    await assertFails(setDoc(doc(authedDb("sam"), "messages/alex_sam/msgs/msg3"), {
      senderId: "mallory",
      text: "spoofed",
      createdAt: "2026-06-05T00:00:00.000Z",
    }));
  });

  it("allows signed-in users to create their own report shape and blocks reads", async () => {
    const db = authedDb("alex");

    await assertSucceeds(setDoc(doc(db, "reports/report1"), {
      reporterId: "alex",
      reportedId: "sam",
      reason: "spam",
      createdAt: "2026-06-05T00:00:00.000Z",
    }));
    await assertFails(setDoc(doc(db, "reports/report2"), {
      reporterId: "mallory",
      reportedId: "sam",
      reason: "spam",
      createdAt: "2026-06-05T00:00:00.000Z",
    }));
    await assertFails(getDoc(doc(db, "reports/report1")));
  });

  it("allows profile view reads only for the viewed profile owner", async () => {
    await seed("profileViews/alex/visitors/sam", {
      viewerName: "Sam",
      viewedAt: "2026-06-05T00:00:00.000Z",
    });

    await assertSucceeds(getDoc(doc(authedDb("alex"), "profileViews/alex/visitors/sam")));
    await assertFails(getDoc(doc(authedDb("sam"), "profileViews/alex/visitors/sam")));
  });

  it("denies unknown collections by default", async () => {
    await assertFails(setDoc(doc(authedDb("alex"), "unknown/doc"), { ok: true }));
    await assertFails(deleteDoc(doc(authedDb("alex"), "unknown/doc")));
  });
});

