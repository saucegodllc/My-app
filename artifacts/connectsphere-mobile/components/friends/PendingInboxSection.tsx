import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FriendRequest } from "@/services/friendsApi";
import { firstName, personLocation, planVenue, requestKindLabel } from "./friendsLabels";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

type Props = {
  requests: FriendRequest[];
  isActing: (key: string) => boolean;
  onOpenProfile: (request: FriendRequest) => void;
  onAccept: (request: FriendRequest) => void;
  onIgnore: (request: FriendRequest) => void;
  onCancel: (request: FriendRequest) => void;
  onFindPeople: () => void;
};

function busyLabel(label: string, busy: boolean) {
  return busy ? "..." : label;
}

export default function PendingInboxSection({
  requests,
  isActing,
  onOpenProfile,
  onAccept,
  onIgnore,
  onCancel,
  onFindPeople,
}: Props) {
  if (!requests.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Pending inbox is clear</Text>
        <Text style={styles.emptyText}>Incoming requests, plan joins, replies, and sent waits will land here.</Text>
        <Pressable onPress={onFindPeople} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Find People</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {requests.map((request) => {
        const outgoing = request.direction === "outgoing";
        const displayUser = outgoing ? request.toUser ?? request.fromUser : request.fromUser;
        const isPlanJoin = request.requestType === "plan_join" || request.kind === "plan_join";
        const isPlanInvite = request.kind === "plan_invite";
        const title = outgoing ? `Sent to ${firstName(displayUser?.name)}` : displayUser?.name ?? "Someone";
        const message = outgoing
          ? isPlanJoin
            ? `Waiting on ${firstName(request.toUser?.name)} to approve ${request.plan?.title ?? "the plan"}.`
            : isPlanInvite
              ? `Plan invite sent for ${request.plan?.title ?? "your plan"}.`
              : "Friend request sent. They'll see it in Connect."
          : isPlanJoin
            ? `Wants to join ${request.plan?.title ?? "your plan"}`
            : request.message ?? "Wants to connect";
        const chips = (isPlanJoin
          ? [request.plan?.timeLabel ?? request.plan?.time ?? "Soon", request.plan ? planVenue(request.plan) : "Miami"]
          : request.sharedInterests ?? []).filter(Boolean).slice(0, 3);
        const acceptKey = `request:accept:${request.id}`;
        const ignoreKey = `request:ignore:${request.id}`;
        const cancelKey = `cancel:${request.id}`;

        return (
          <Pressable
            key={request.id}
            onPress={() => {
              if (displayUser) onOpenProfile(request);
            }}
            style={[styles.card, outgoing && styles.cardSent]}
          >
            <Image source={{ uri: displayUser?.photoUrl ?? FALLBACK_PHOTO }} style={styles.avatar} contentFit="cover" />
            <View style={styles.body}>
              <View style={styles.topRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {title}
                  {!outgoing && displayUser?.age ? `, ${displayUser.age}` : ""}
                </Text>
                <View style={[styles.badge, outgoing && styles.badgeSent]}>
                  <Text style={[styles.badgeText, outgoing && styles.badgeSentText]}>
                    {outgoing ? "Waiting" : requestKindLabel(request)}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{personLocation(displayUser ?? request.fromUser)}</Text>
              <Text style={styles.message} numberOfLines={2}>{message}</Text>
              <View style={styles.chipRow}>
                {chips.map((interest) => (
                  <View key={String(interest)} style={styles.chip}>
                    <Text style={styles.chipText}>{String(interest)}</Text>
                  </View>
                ))}
              </View>
              {displayUser ? (
                <View style={styles.profileCue}>
                  <Ionicons name="sparkles" size={13} color="#FF8BC4" />
                  <Text style={styles.profileCueText}>Open profile</Text>
                  <Ionicons name="chevron-forward" size={13} color="#FF8BC4" />
                </View>
              ) : null}
              {outgoing ? (
                <View style={styles.actions}>
                  <View style={styles.waitingPill}>
                    <Ionicons name="time-outline" size={15} color="#FF8BC4" />
                    <Text style={styles.waitingText}>Waiting</Text>
                  </View>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      onCancel(request);
                    }}
                    style={[styles.secondary, isActing(cancelKey) && styles.disabled]}
                    disabled={isActing(cancelKey)}
                  >
                    <Text style={styles.secondaryText}>
                      {busyLabel(isPlanJoin ? "Cancel Join" : "Cancel Request", isActing(cancelKey))}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      onAccept(request);
                    }}
                    style={[styles.primary, isActing(acceptKey) && styles.disabled]}
                    disabled={isActing(acceptKey) || isActing(ignoreKey)}
                  >
                    <Text style={styles.primaryText}>{busyLabel("Accept", isActing(acceptKey))}</Text>
                  </Pressable>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      onIgnore(request);
                    }}
                    style={[styles.secondary, isActing(ignoreKey) && styles.disabled]}
                    disabled={isActing(acceptKey) || isActing(ignoreKey)}
                  >
                    <Text style={styles.secondaryText}>{busyLabel(isPlanJoin ? "Decline" : "Ignore", isActing(ignoreKey))}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  cardSent: { borderColor: "rgba(255,45,168,0.18)" },
  avatar: { backgroundColor: "#17171D", borderRadius: 24, height: 48, width: 48 },
  body: { flex: 1, gap: 7, minWidth: 0 },
  topRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  name: { color: "#FFFFFF", flex: 1, fontSize: 17, fontWeight: "900" },
  badge: {
    backgroundColor: "rgba(255,45,168,0.14)",
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeSent: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  badgeText: { color: "#FF8BC4", fontSize: 11, fontWeight: "900" },
  badgeSentText: { color: "#EDEDF2" },
  meta: { color: "#D4D4D8", fontSize: 13, fontWeight: "600" },
  message: { color: "#E7E7EF", fontSize: 13, lineHeight: 18 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: { color: "#D7D7DE", fontSize: 11, fontWeight: "700" },
  profileCue: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,45,168,0.09)",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileCueText: { color: "#FFB6D9", fontSize: 11, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8, marginTop: 2 },
  primary: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  primaryText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
  secondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  secondaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  waitingPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.1)",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 7,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10,
  },
  waitingText: { color: "#FFB6D9", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  empty: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 190,
    padding: 22,
  },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  emptyText: {
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyAction: {
    backgroundColor: "#FF2D8D",
    borderRadius: 15,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
});
