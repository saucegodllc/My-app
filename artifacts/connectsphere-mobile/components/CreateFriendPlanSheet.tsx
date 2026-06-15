import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createFriendPlan,
  getFriendPeople,
  getPlanLocationOptions,
  type FriendPerson,
  type PlanLocationOption,
} from "@/services/friendsApi";
import { useFeedback } from "@/components/ActionFeedback";

type SourceTab = "map" | "event";
type TimeOption = {
  value: string;
  label: string;
  helper?: string;
};

export type PlanDraft = {
  title: string;
  timeLabel: string;
  location: string;
};

type Props = {
  visible: boolean;
  userId: string;
  friends?: FriendPerson[];
  initialSource?: PlanLocationOption | null;
  initialSourceTab?: SourceTab;
  initialInviteIds?: string[];
  initialTitle?: string;
  onClose: () => void;
  onCreated?: (result: Awaited<ReturnType<typeof createFriendPlan>>) => void;
  /**
   * Request-only mode (spec 2.1): when set, the sheet does NOT create a plan
   * or navigate — it hands the composed draft back so the caller can send it
   * as a plan_request into the conversation. The plan is only created when
   * the other person accepts.
   */
  onDraft?: (draft: PlanDraft) => void;
};

const EMPTY_INVITE_IDS: string[] = [];
const TIME_SLOTS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
  "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM",
  "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
];
const DEFAULT_TIME_OPTIONS: TimeOption[] = TIME_SLOTS.map((slot) => ({ value: slot, label: slot }));

function firstName(name?: string) {
  return (name ?? "Friend").split(" ")[0] || "Friend";
}

function dateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date();
  date.setFullYear(year, (month || 1) - 1, day || 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function dateKeyFromValue(value?: string) {
  const stableKey = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (stableKey) return stableKey;
  const parsed = parseValidDate(value);
  return parsed ? dateKey(parsed) : null;
}

function formatDateChip(date: Date) {
  const today = dateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateKey(tomorrowDate);
  if (dateKey(date) === today) return "Today";
  if (dateKey(date) === tomorrow) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function parseValidDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function buildDateOptions(initialStartDate?: string, lockToEventDate = false) {
  const initialKey = dateKeyFromValue(initialStartDate);
  const initial = initialKey ? dateFromKey(initialKey) : null;
  if (lockToEventDate && initial) {
    return [{ key: initialKey!, label: formatDateChip(initial) }];
  }

  const dates: Date[] = [];
  const now = new Date();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    date.setHours(12, 0, 0, 0);
    dates.push(date);
  }

  if (initial && initialKey && !dates.some((date) => dateKey(date) === initialKey)) {
    dates.unshift(initial);
  }

  return dates.map((date) => ({ key: dateKey(date), label: formatDateChip(date) }));
}

function optionDateKey(option?: PlanLocationOption | null) {
  if (option?.sourceType !== "event") return null;
  return dateKeyFromValue(option.startDate);
}

function timeLabelFromDate(value?: string) {
  const date = parseValidDate(value);
  if (!date) return "7:00 PM";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function buildEventTimeOptions(startDate?: string): TimeOption[] {
  const start = parseValidDate(startDate);
  if (!start) return DEFAULT_TIME_OPTIONS;
  const now = Date.now();
  const candidates = [
    { date: addMinutes(start, -120), helper: "2 hr before" },
    { date: addMinutes(start, -60), helper: "1 hr before" },
    { date: addMinutes(start, -30), helper: "30 min before" },
    { date: start, helper: "Event start" },
  ];

  const seen = new Set<string>();
  const futureOptions = candidates
    .filter((candidate) => candidate.date.getTime() >= now - 60_000)
    .map((candidate) => ({
      value: timeLabelFromDate(candidate.date.toISOString()),
      label: timeLabelFromDate(candidate.date.toISOString()),
      helper: candidate.helper,
    }))
    .filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });

  if (futureOptions.length) return futureOptions;
  const nowLabel = timeLabelFromDate(new Date().toISOString());
  return [{ value: nowLabel, label: nowLabel, helper: "Event is live" }];
}

function defaultTimeForEvent(startDate?: string) {
  const start = parseValidDate(startDate);
  if (!start) return "7:00 PM";
  if (start.getTime() >= Date.now() - 60_000) return timeLabelFromDate(startDate);
  return buildEventTimeOptions(startDate)[0]?.value ?? timeLabelFromDate(startDate);
}

function scheduledAtFor(dateValue: string, timeLabel: string) {
  const [timePart, period] = timeLabel.split(" ");
  const [rawHour, rawMinute] = (timePart ?? "7:00").split(":").map(Number);
  let hour = Number.isFinite(rawHour) ? rawHour : 19;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const date = new Date(`${dateValue}T00:00:00`);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function planInviteMessage(planTitle: string, timeLabel: string, locationName: string, planId?: string) {
  const link = planId ? `connectsphere://plans/${planId}` : "Open ConnectSphere to join.";
  return `Join my ConnectSphere plan: ${planTitle}\n${timeLabel}\n${locationName}\n${link}`;
}

export default function CreateFriendPlanSheet({
  visible,
  userId,
  friends = [],
  initialSource = null,
  initialSourceTab = "event",
  initialInviteIds = EMPTY_INVITE_IDS,
  initialTitle,
  onClose,
  onCreated,
  onDraft,
}: Props) {
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [selectedTime, setSelectedTime] = useState("7:00 PM");
  const [sourceTab, setSourceTab] = useState<SourceTab>("event");
  const [selectedSource, setSelectedSource] = useState<PlanLocationOption | null>(null);
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const [loadedFriends, setLoadedFriends] = useState<FriendPerson[]>([]);
  const [venues, setVenues] = useState<PlanLocationOption[]>([]);
  const [events, setEvents] = useState<PlanLocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trigger: triggerPlanFeedback } = useFeedback("plan");

  useEffect(() => {
    if (!visible) return;
    setTitle(initialTitle ?? "");
    setSelectedInviteIds(initialInviteIds);
    setSelectedSource(initialSource);
    setError(null);
    setSourceTab(initialSource?.sourceType === "map" ? "map" : initialSourceTab);
    const eventStart = initialSource?.sourceType === "event" ? parseValidDate(initialSource.startDate) : null;
    const eventDateKey = initialSource?.sourceType === "event" ? dateKeyFromValue(initialSource.startDate) : null;
    setSelectedDate(eventDateKey ?? (eventStart ? dateKey(eventStart) : dateKey(new Date())));
    setSelectedTime(eventStart ? defaultTimeForEvent(initialSource?.startDate) : "7:00 PM");
  }, [initialInviteIds, initialSource, initialSourceTab, initialTitle, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoadingLocations(true);
    getPlanLocationOptions()
      .then((result) => {
        if (cancelled) return;
        setVenues(result.venues);
        setEvents(result.events);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLocations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || friends.length > 0 || !userId) return;
    let cancelled = false;
    setLoadingFriends(true);
    getFriendPeople(userId)
      .then((result: { people?: FriendPerson[] }) => {
        if (cancelled) return;
        const friendResults = (result.people ?? []).filter((person: FriendPerson) => person.relationshipStatus === "friends");
        setLoadedFriends(friendResults);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingFriends(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friends.length, userId, visible]);

  const selectedEventStart = selectedSource?.sourceType === "event" ? selectedSource.startDate : undefined;
  const eventTimeLocked = !!parseValidDate(selectedEventStart);
  const dateOptions = useMemo(
    () => buildDateOptions(selectedEventStart ?? initialSource?.startDate, eventTimeLocked),
    [eventTimeLocked, initialSource?.startDate, selectedEventStart],
  );
  const timeOptions = useMemo(
    () => (eventTimeLocked ? buildEventTimeOptions(selectedEventStart) : DEFAULT_TIME_OPTIONS),
    [eventTimeLocked, selectedEventStart],
  );
  const inviteFriends = friends.length ? friends : loadedFriends;
  const selectedDateLabel = useMemo(
    () => dateOptions.find((date) => date.key === selectedDate)?.label ?? formatDateChip(dateFromKey(selectedDate)),
    [dateOptions, selectedDate],
  );
  const visibleEvents = useMemo(() => {
    const matchingEvents = events.filter((event) => optionDateKey(event) === selectedDate);

    // Always prepend the currently-selected event so it's never hidden after picking
    const withSelected =
      selectedSource?.sourceType === "event" &&
      !matchingEvents.some((e) => e.id === selectedSource.id && e.sourceType === selectedSource.sourceType)
        ? [selectedSource, ...matchingEvents]
        : matchingEvents;

    // If there are matches for this date, return them
    if (withSelected.length > 0) return withSelected.slice(0, 12);

    // No events on the selected date — fall back to ALL upcoming events sorted by date
    // (keeps Ticketmaster working even when mock events don't perfectly match the calendar)
    const upcoming = [...events].sort((a, b) => {
      const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
      const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
      return ta - tb;
    });
    return upcoming.slice(0, 12);
  }, [events, selectedDate, selectedSource]);
  // A map spot always matches; an event matches when its date aligns OR when it has no date (allows any day)
  const selectedSourceMatchesDate =
    !selectedSource ||
    selectedSource.sourceType !== "event" ||
    !selectedSource.startDate ||
    optionDateKey(selectedSource) === selectedDate;
  const selectedTimeText = `${selectedDateLabel} at ${selectedTime}`;
  const locationName = useMemo(() => {
    if (selectedSource) return selectedSource.name;
    return "Pick a Maps spot or event";
  }, [selectedSource]);
  const canCreate = !!selectedSource && selectedSourceMatchesDate && !saving;
  const sourcePlanType = selectedSource?.sourceType === "event" ? "Ticketmaster Event" : "Map Spot";

  const toggleInvite = useCallback((personId: string) => {
    setSelectedInviteIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  }, []);

  const selectSource = useCallback((option: PlanLocationOption) => {
    setSelectedSource(option);
    if (option.sourceType !== "event") return;
    const eventStart = parseValidDate(option.startDate);
    const eventDateKey = dateKeyFromValue(option.startDate);
    if (!eventStart || !eventDateKey) return;
    setSelectedDate(eventDateKey);
    setSelectedTime(defaultTimeForEvent(option.startDate));
  }, []);

  useEffect(() => {
    if (!eventTimeLocked) return;
    const eventStart = parseValidDate(selectedEventStart);
    const eventDateKey = dateKeyFromValue(selectedEventStart);
    if (eventStart && eventDateKey && selectedDate !== eventDateKey) {
      setSelectedDate(eventDateKey);
    }
    if (!timeOptions.some((option) => option.value === selectedTime)) {
      setSelectedTime(defaultTimeForEvent(selectedEventStart));
    }
  }, [eventTimeLocked, selectedDate, selectedEventStart, selectedTime, timeOptions]);

  const handleCreate = useCallback(async (shareAfterCreate = false) => {
    if (!selectedSource || !selectedSourceMatchesDate) return;
    setSaving(true);
    setError(null);
    try {
      const planTitle = title.trim() || locationName;

      // Request-only mode — hand the draft back, create nothing (spec 2.1).
      if (onDraft) {
        onDraft({
          title: planTitle,
          timeLabel: selectedTimeText,
          location: selectedSource?.subtitle || locationName,
        });
        triggerPlanFeedback();
        onClose();
        return;
      }

      const result = await createFriendPlan({
        creatorId: userId,
        title: planTitle,
        type: sourcePlanType,
        time: selectedTimeText,
        timeLabel: selectedTimeText,
        scheduledAt: scheduledAtFor(selectedDate, selectedTime),
        location: selectedSource?.subtitle || locationName,
        sourceType: selectedSource.sourceType,
        sourceId: selectedSource?.id,
        sourceName: selectedSource?.name ?? locationName,
        sourceImageUrl: selectedSource?.imageUrl,
        latitude: selectedSource?.latitude,
        longitude: selectedSource?.longitude,
        invitedUserIds: selectedInviteIds,
      });
      if (shareAfterCreate) {
        await Share.share({
          message: planInviteMessage(planTitle, selectedTimeText, selectedSource?.subtitle || locationName, result.plan.id),
        });
      }
      triggerPlanFeedback();
      onCreated?.(result);
      onClose();
      // Route sender to Connect > Matches so they can see the pending request
      // and confirm it was sent. The receiver will see an accept/decline card
      // in the same segment via getInboxRequests → buildIncomingActionCards.
      router.push({ pathname: "/(tabs)/matches", params: { segment: "matches" } } as never);
    } catch (createError: any) {
      const message =
        createError?.data?.message ??
        createError?.message ??
        "Could not send that plan request. Try again.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [locationName, onClose, onCreated, onDraft, selectedDate, selectedInviteIds, selectedSource, selectedSourceMatchesDate, selectedTime, selectedTimeText, sourcePlanType, title, userId, triggerPlanFeedback]);

  const locationOptions = sourceTab === "map" ? venues : visibleEvents;
  // Show a date-aware hint only when there's truly nothing available at all
  const noEventsAtAll = events.length === 0;
  const emptyLocationText =
    sourceTab === "event"
      ? noEventsAtAll
        ? "No events loaded yet. Try again in a moment or use a Map Spot."
        : `No events on ${selectedDateLabel}. Showing all upcoming events below — pick one to lock the date.`
      : "No map spots loaded yet.";

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Create Plan</Text>
              <Text style={styles.subtitle}>One plan request a day. They accept before it opens in Connect.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <TextInput value={title} onChangeText={setTitle} placeholder="Plan title" placeholderTextColor="#777783" style={styles.field} />

            <View style={styles.timeHeader}>
              <Text style={styles.label}>Time</Text>
              <Text style={styles.timeValue}>{selectedTimeText}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
              {dateOptions.map((option) => (
                <Pressable key={option.key} onPress={() => setSelectedDate(option.key)} style={[styles.dateChip, selectedDate === option.key && styles.dateChipActive]}>
                  <Text style={[styles.dateChipText, selectedDate === option.key && styles.dateChipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotRow}>
              {timeOptions.map((slot) => (
                <Pressable key={`${slot.value}-${slot.helper ?? "open"}`} onPress={() => setSelectedTime(slot.value)} style={[styles.timeSlot, selectedTime === slot.value && styles.timeSlotActive]}>
                  <Text style={[styles.timeSlotText, selectedTime === slot.value && styles.timeSlotTextActive]}>{slot.label}</Text>
                  {slot.helper ? (
                    <Text style={[styles.timeSlotHelper, selectedTime === slot.value && styles.timeSlotHelperActive]}>{slot.helper}</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.timeHeader}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.timeValue} numberOfLines={1}>{locationName}</Text>
            </View>
            <View style={styles.sourceTabs}>
              {(["event", "map"] as SourceTab[]).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => {
                    setSourceTab(tab);
                    if (selectedSource?.sourceType !== tab) setSelectedSource(null);
                  }}
                  style={[styles.sourceTab, sourceTab === tab && styles.sourceTabActive]}
                >
                  <Text style={[styles.sourceTabText, sourceTab === tab && styles.sourceTabTextActive]}>
                    {tab === "map" ? "Map Spots" : "Ticketmaster"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {loadingLocations ? (
              <View style={styles.loadingLocations}>
                <ActivityIndicator color="#FF2D8D" />
                <Text style={styles.muted}>Loading options...</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationRow}>
                {locationOptions.length ? locationOptions.map((option) => {
                  const active = selectedSource?.id === option.id && selectedSource?.sourceType === option.sourceType;
                  const optionMeta = option.sourceType === "event" && option.startDate
                    ? `${timeLabelFromDate(option.startDate)} - ${option.subtitle ?? "Miami"}`
                    : option.subtitle ?? "Miami";
                  return (
                    <Pressable key={`${option.sourceType}-${option.id}`} onPress={() => selectSource(option)} style={[styles.locationCard, active && styles.locationCardActive]}>
                      {option.imageUrl ? (
                        <Image source={{ uri: option.imageUrl }} style={styles.locationImage} contentFit="cover" />
                      ) : (
                        <View style={styles.locationImageFallback}>
                          <Ionicons name={option.sourceType === "event" ? "calendar" : "location"} size={20} color="#FF8BC4" />
                        </View>
                      )}
                      <Text style={styles.locationName} numberOfLines={2}>{option.name}</Text>
                      <Text style={styles.locationSub} numberOfLines={1}>{optionMeta}</Text>
                    </Pressable>
                  );
                }) : (
                  <View style={styles.emptyLocationCard}>
                    <Ionicons name={sourceTab === "event" ? "calendar-outline" : "map-outline"} size={22} color="#FF8BC4" />
                    <Text style={[styles.muted, styles.emptyLocationText]}>{emptyLocationText}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {sourceTab === "map" && !loadingLocations ? (
              <Pressable
                style={styles.browseMapBtn}
                onPress={() => {
                  onClose();
                  router.push({ pathname: "/(tabs)/map", params: { pickSpot: "1" } } as never);
                }}
              >
                <Ionicons name="map" size={16} color="#FF2DA8" />
                <Text style={styles.browseMapText}>Browse on Map — find spots in Miami & Broward</Text>
                <Ionicons name="chevron-forward" size={15} color="#FF2DA8" />
              </Pressable>
            ) : null}

            <View style={styles.timeHeader}>
              <Text style={styles.label}>Ask friends</Text>
              <Text style={styles.timeValue}>{selectedInviteIds.length ? `${selectedInviteIds.length} request${selectedInviteIds.length === 1 ? "" : "s"}` : "Optional"}</Text>
            </View>
            <Pressable
              onPress={() => handleCreate(true)}
              disabled={!canCreate}
              style={[styles.shareInviteButton, !canCreate && styles.disabledButton]}
            >
              <Ionicons name="share-social-outline" size={17} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.shareInviteTitle}>Create & share invite link</Text>
                <Text style={styles.shareInviteSub}>Adds it to Connect, then opens your phone share sheet.</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#777783" />
            </Pressable>
            <View style={styles.inviteList}>
              {loadingFriends ? (
                <Text style={styles.muted}>Loading friends...</Text>
              ) : inviteFriends.length ? (
                inviteFriends.map((friend) => (
                  <Pressable key={friend.id} onPress={() => toggleInvite(friend.id)} style={[styles.inviteChip, selectedInviteIds.includes(friend.id) && styles.inviteChipActive]}>
                    {friend.photoUrl ? (
                      <Image source={{ uri: friend.photoUrl }} style={styles.inviteAvatar} contentFit="cover" />
                    ) : (
                      <View style={styles.inviteAvatarFallback}>
                        <Text style={styles.inviteAvatarText}>{firstName(friend.name).slice(0, 1)}</Text>
                      </View>
                    )}
                    <Text style={[styles.inviteText, selectedInviteIds.includes(friend.id) && styles.inviteTextActive]}>{firstName(friend.name)}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.muted}>Pick someone to ask. They will see it in Requests and must accept first.</Text>
              )}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <Pressable onPress={() => handleCreate(false)} disabled={!canCreate} style={[styles.createButton, !canCreate && { opacity: 0.55 }]}>
            <Text style={styles.createButtonText}>{saving ? "Sending..." : selectedSource ? "Send Plan Request" : "Pick a location first"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#101014",
    borderColor: "rgba(255,45,141,0.24)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "90%",
    padding: 18,
    paddingBottom: 26,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    height: 44,
    justifyContent: "center",
    width: 44,
    flexShrink: 0,
  },
  body: {
    gap: 13,
    paddingBottom: 14,
  },
  field: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#FFFFFF",
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  timeHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeValue: {
    color: "#FF8BC4",
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900",
    maxWidth: 190,
  },
  timeTrack: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  timeStep: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  timeDot: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  timeDotActive: {
    backgroundColor: "#FF2D8D",
  },
  timeLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "800",
  },
  timeLabelActive: {
    color: "#FFFFFF",
  },
  dateRow: {
    gap: 8,
    paddingRight: 4,
  },
  dateChip: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  dateChipActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  dateChipText: {
    color: "#EDEDF2",
    fontSize: 12,
    fontWeight: "900",
  },
  dateChipTextActive: {
    color: "#0A0A0B",
  },
  timeSlotRow: {
    gap: 8,
    paddingRight: 4,
  },
  timeSlot: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 82,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  timeSlotActive: {
    backgroundColor: "#FF2D8D",
    borderColor: "#FF2D8D",
  },
  timeSlotText: {
    color: "#EDEDF2",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  timeSlotTextActive: {
    color: "#0A0A0B",
  },
  timeSlotHelper: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },
  timeSlotHelperActive: {
    color: "#FFFFFF",
  },
  sourceTabs: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    flexDirection: "row",
    padding: 4,
  },
  sourceTab: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 9,
  },
  sourceTabActive: {
    backgroundColor: "#FF2D8D",
  },
  sourceTabText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "900",
  },
  sourceTabTextActive: {
    color: "#0A0A0B",
  },
  loadingLocations: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 18,
    gap: 8,
    minHeight: 120,
    justifyContent: "center",
  },
  muted: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  errorText: {
    color: "#FDA4AF",
    fontSize: 12,
    fontWeight: "800",
  },
  locationRow: {
    gap: 10,
    paddingRight: 4,
  },
  locationCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 9,
    width: 142,
  },
  locationCardActive: {
    borderColor: "#FF2D8D",
  },
  emptyLocationCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 112,
    padding: 16,
    width: 220,
  },
  emptyLocationText: {
    textAlign: "center",
  },
  // "Browse on Map" row — Map Spots tab only
  browseMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.35)",
    backgroundColor: "rgba(255,45,168,0.09)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  browseMapText: {
    flex: 1,
    color: "#FF8BC4",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  locationImage: {
    backgroundColor: "#17171D",
    borderRadius: 13,
    height: 78,
    marginBottom: 8,
    width: "100%",
  },
  locationImageFallback: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,141,0.12)",
    borderRadius: 13,
    height: 78,
    justifyContent: "center",
    marginBottom: 8,
    width: "100%",
  },
  locationName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    minHeight: 34,
  },
  locationSub: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  inviteList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shareInviteButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,141,0.12)",
    borderColor: "rgba(255,45,141,0.35)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  shareInviteTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  shareInviteSub: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  inviteChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inviteChipActive: {
    backgroundColor: "#FF2D8D",
    borderColor: "#FF2D8D",
  },
  inviteText: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "800",
  },
  inviteTextActive: {
    color: "#0A0A0B",
  },
  inviteAvatar: {
    borderRadius: 13,
    height: 26,
    width: 26,
  },
  inviteAvatarFallback: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,141,0.18)",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  inviteAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  createButton: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 52,
  },
  createButtonText: {
    color: "#0A0A0B",
    fontSize: 15,
    fontWeight: "900",
  },
});
