import { customFetch } from "@workspace/api-client-react";

export type BlockedUser = {
  id: string;
  userId?: string;
  name: string;
  photoUrl: string;
  blockedAt?: string;
};

export type BlockedUsersResponse = {
  blockedUsers?: Array<{
    id?: string;
    userId: string;
    name?: string;
    photoUrl?: string;
    blockedAt?: string;
  }>;
};

export function normalizeBlockedUsersResponse(data: BlockedUsersResponse): BlockedUser[] {
  return (data.blockedUsers ?? []).map((blocked) => ({
    id: blocked.id ?? blocked.userId,
    userId: blocked.userId,
    name: blocked.name ?? "Unknown",
    photoUrl: blocked.photoUrl ?? "",
    blockedAt: blocked.blockedAt,
  }));
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const data = await customFetch<BlockedUsersResponse>("/api/reports/blocked");
  return normalizeBlockedUsersResponse(data);
}

export async function unblockUser(blockedId: string): Promise<void> {
  await customFetch(`/api/reports/blocked/${encodeURIComponent(blockedId)}`, {
    method: "DELETE",
  });
}
