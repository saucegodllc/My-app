import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { randomUUID } from "crypto";

const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const opsPath = join(workspaceRoot, "artifacts", "api-server", "ops-store.json");

export type AccountDeletionRecord = {
  id: string;
  userId: string;
  status: "queued" | "processing" | "completed" | "cancelled";
  confirmation: string;
  reason?: string;
  retainedData: string[];
  createdAt: string;
  updatedAt: string;
};

export type DataExportRecord = {
  id: string;
  userId: string;
  status: "queued" | "processing" | "ready" | "failed";
  requestedAt: string;
  updatedAt: string;
  downloadUrl?: string;
};

export type ModerationRecord = {
  id: string;
  reportId?: string;
  reporterUserId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
  context?: string;
  targetType?: "profile" | "chat" | "plan" | "message" | "other";
  targetId?: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
};

export type AbuseEvent = {
  id: string;
  userId?: string;
  ip?: string;
  action: string;
  targetId?: string;
  reason?: string;
  createdAt: string;
};

export type PremiumEntitlementRecord = {
  userId: string;
  isPremium: boolean;
  source: "revenuecat" | "manual" | "none";
  tier: "plus" | "free";
  entitlementId: string;
  productId?: string;
  trialEligible?: boolean;
  renewalDate?: string;
  managementUrl?: string;
  revenueCatAppUserId?: string;
  lastSyncedAt: string;
};

export type ChatControlRecord = {
  id: string;
  chatId: string;
  userId: string;
  action: "archive" | "mute" | "clear" | "read" | "unmatch" | "still_interested" | "dismiss_nudge";
  value?: boolean;
  reason?: string;
  createdAt: string;
};

export type AdminAuditEvent = {
  id: string;
  adminId: string;
  action: string;
  targetType: "report" | "user" | "chat" | "message" | "system";
  targetId: string;
  reason?: string;
  requestId?: string;
  createdAt: string;
};

export type SuspendedUserRecord = {
  userId: string;
  status: "suspended" | "banned";
  reason?: string;
  adminId: string;
  createdAt: string;
};

type OpsStore = {
  accountDeletionRequests: AccountDeletionRecord[];
  dataExportRequests: DataExportRecord[];
  moderationQueue: ModerationRecord[];
  abuseEvents: AbuseEvent[];
  premiumEntitlements: PremiumEntitlementRecord[];
  chatControls: ChatControlRecord[];
  adminAuditLog: AdminAuditEvent[];
  suspendedUsers: SuspendedUserRecord[];
};

function emptyStore(): OpsStore {
  return {
    accountDeletionRequests: [],
    dataExportRequests: [],
    moderationQueue: [],
    abuseEvents: [],
    premiumEntitlements: [],
    chatControls: [],
    adminAuditLog: [],
    suspendedUsers: [],
  };
}

export function readOpsStore(): OpsStore {
  if (!existsSync(opsPath)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(opsPath, "utf8")) as Partial<OpsStore>;
    return {
      ...emptyStore(),
      ...parsed,
      accountDeletionRequests: parsed.accountDeletionRequests ?? [],
      dataExportRequests: parsed.dataExportRequests ?? [],
      moderationQueue: parsed.moderationQueue ?? [],
      abuseEvents: parsed.abuseEvents ?? [],
      premiumEntitlements: parsed.premiumEntitlements ?? [],
      chatControls: parsed.chatControls ?? [],
      adminAuditLog: parsed.adminAuditLog ?? [],
      suspendedUsers: parsed.suspendedUsers ?? [],
    };
  } catch {
    return emptyStore();
  }
}

export function writeOpsStore(store: OpsStore): void {
  mkdirSync(dirname(opsPath), { recursive: true });
  writeFileSync(opsPath, `${JSON.stringify(store, null, 2)}\n`);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createOpsId(): string {
  return randomUUID();
}
