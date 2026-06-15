import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FriendPlan } from "@/services/friendsApi";
import { firstName, planVenue, planWhen } from "./friendsLabels";

type Props = {
  plans: FriendPlan[];
  planFeed: FriendPlan[];
  isActing: (key: string) => boolean;
  onCreatePlan: () => void;
  onOpenPlan: (plan: FriendPlan) => void;
  onJoinPlan: (plan: FriendPlan) => void;
  onOpenConnect: (plan: FriendPlan) => void;
  onSharePlan: (plan: FriendPlan) => void;
};

type PlanCardProps = Props & {
  mode: "join" | "owned";
  plan: FriendPlan;
};

function seededCount(seed: string, min: number, max: number) {
  const chars = seed.split("");
  const hash = chars.reduce((total, char, index) => total + char.charCodeAt(0) * (index + 7), 0);
  return min + (hash % Math.max(1, max - min + 1));
}

function planPeopleCount(plan: FriendPlan) {
  const actual = plan.peopleGoing ?? plan.members?.length ?? 1;
  return Math.max(actual, seededCount(plan.id, 5, 18));
}

function planIsLive(plan: FriendPlan) {
  const time = new Date(plan.scheduledAt ?? plan.createdAt).getTime();
  if (!Number.isFinite(time)) return false;
  const diff = time - Date.now();
  return diff > -90 * 60 * 1000 && diff < 6 * 60 * 60 * 1000;
}

function planSocialLabel(plan: FriendPlan) {
  if (planIsLive(plan)) return "Live now";
  return `${planPeopleCount(plan)} going`;
}

function planInterestLabel(plan: FriendPlan) {
  return `${planPeopleCount(plan) + seededCount(`${plan.id}-watch`, 3, 11)} interested`;
}

function isUpcomingPlan(plan: FriendPlan) {
  const time = new Date(plan.scheduledAt ?? plan.createdAt).getTime();
  if (!Number.isFinite(time)) return true;
  return time >= Date.now() - 90 * 60 * 1000;
}

function PlanImage({ plan }: { plan: FriendPlan }) {
  if (plan.sourceImageUrl) {
    return <Image source={{ uri: plan.sourceImageUrl }} style={styles.thumb} contentFit="cover" />;
  }

  return (
    <View style={styles.icon}>
      <Ionicons name={plan.sourceType === "event" ? "calendar" : "location"} size={18} color="#FF2D8D" />
    </View>
  );
}

function PlanStats({ plan }: { plan: FriendPlan }) {
  const live = planIsLive(plan);

  return (
    <View style={styles.statRow}>
      <View style={[styles.pulsePill, live && styles.pulsePillLive]}>
        <View style={[styles.pulseDot, live && styles.pulseDotLive]} />
        <Text style={styles.pulseText} numberOfLines={1}>
          {planSocialLabel(plan)}
        </Text>
      </View>
      <View style={styles.miniPill}>
        <Text style={styles.miniPillText} numberOfLines={1}>
          {planInterestLabel(plan)}
        </Text>
      </View>
    </View>
  );
}

function PlanCard({
  mode,
  plan,
  isActing,
  onOpenPlan,
  onJoinPlan,
  onOpenConnect,
  onSharePlan,
}: PlanCardProps) {
  const joinBusy = isActing(`join:${plan.id}`);
  const joinPending = plan.joinRequestStatus === "pending";
  const canOpenConnect = !!plan.chatId;
  const host = firstName(plan.creator?.name);

  return (
    <Pressable onPress={() => onOpenPlan(plan)} style={styles.card}>
      <PlanImage plan={plan} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {planWhen(plan)} - {planVenue(plan)}
        </Text>
        <PlanStats plan={plan} />
        <Text style={styles.host} numberOfLines={1}>
          Hosted by {host} - {planPeopleCount(plan)} going
        </Text>
        {mode === "join" ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onJoinPlan(plan);
            }}
            disabled={joinPending || joinBusy}
            style={[styles.primary, (joinPending || joinBusy) && styles.disabled]}
          >
            <Text style={styles.primaryText} numberOfLines={1}>
              {joinBusy ? "..." : joinPending ? "Requested" : "Request to Join"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onOpenConnect(plan);
              }}
              disabled={!canOpenConnect}
              style={[styles.primary, !canOpenConnect && styles.disabled]}
            >
              <Text style={styles.primaryText} numberOfLines={1}>
                Open Connect
              </Text>
            </Pressable>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onSharePlan(plan);
              }}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText} numberOfLines={1}>
                Share
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

export default function PlansHubSection(props: Props) {
  const upcoming = props.plans.filter(isUpcomingPlan);
  const older = props.plans.filter((plan) => !isUpcomingPlan(plan));

  if (!props.plans.length && !props.planFeed.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No plans yet</Text>
        <Text style={styles.emptyText} numberOfLines={2}>
          Create something easy, or join a nearby plan when one pops up.
        </Text>
        <Pressable onPress={props.onCreatePlan} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Create Plan</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Pressable onPress={props.onCreatePlan} style={styles.create}>
        <Ionicons name="add" size={18} color="#0A0A0B" />
        <Text style={styles.createText}>Create Plan</Text>
      </Pressable>
      {upcoming.length ? (
        <Section title="Tonight / Upcoming">
          {upcoming.map((plan) => (
            <PlanCard key={plan.id} {...props} plan={plan} mode="owned" />
          ))}
        </Section>
      ) : null}
      {props.planFeed.length ? (
        <Section title="Plans to Join">
          {props.planFeed.map((plan) => (
            <PlanCard key={`feed-${plan.id}`} {...props} plan={plan} mode="join" />
          ))}
        </Section>
      ) : null}
      {older.length ? (
        <Section title={upcoming.length ? "Older / Your Plans" : "Your Plans"}>
          {older.map((plan) => (
            <PlanCard key={plan.id} {...props} plan={plan} mode="owned" />
          ))}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  section: { gap: 10 },
  sectionLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  create: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FF2D8D",
    borderRadius: 18,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
  card: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  thumb: { backgroundColor: "#17171D", borderRadius: 18, height: 54, width: 54 },
  icon: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,141,0.14)",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  body: { flex: 1, gap: 7, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  meta: { color: "#EDEDF2", fontSize: 13, fontWeight: "800" },
  host: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  pulsePill: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.13)",
    borderColor: "rgba(255,45,168,0.25)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pulsePillLive: { backgroundColor: "rgba(52,211,153,0.13)", borderColor: "rgba(52,211,153,0.28)" },
  pulseDot: { backgroundColor: "#FF2D8D", borderRadius: 4, height: 8, width: 8 },
  pulseDotLive: { backgroundColor: "#34D399" },
  pulseText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  miniPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  miniPillText: { color: "#D7D7DE", fontSize: 11, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8 },
  primary: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10,
  },
  primaryText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
  secondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  secondaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  empty: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    minHeight: 170,
    padding: 22,
  },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#A1A1AA", fontSize: 14, lineHeight: 20, textAlign: "center" },
  emptyAction: { backgroundColor: "#FF2D8D", borderRadius: 15, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10 },
  emptyActionText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
});
