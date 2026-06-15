import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { RefreshControl } from "react-native";

import EventsScreen from "../app/(tabs)/events";

const tmFixture = require("../../api-server/tests/fixtures/tm-response.json");

const mockRefetch = jest.fn();
const mockGetEventContexts = jest.fn(async () => ({ bySourceId: {} }));
const mockOpenChat = jest.fn();

function mockMapTicketmasterFixtureEvent(raw: any) {
  const venue = raw._embedded?.venues?.[0] ?? {};
  const classification = raw.classifications?.[0] ?? {};
  const priceRange = raw.priceRanges?.[0];
  const isFree = priceRange?.min === 0 && priceRange?.max === 0;

  return {
    id: `ticketmaster-${raw.id}`,
    sourceId: raw.id,
    source: "ticketmaster",
    sourceLabel: "Ticketmaster",
    name: raw.name,
    description: raw.description ?? raw.info ?? "",
    startDate: `${raw.dates?.start?.localDate}T${raw.dates?.start?.localTime ?? "00:00:00"}`,
    endDate: `${raw.dates?.end?.localDate}T${raw.dates?.end?.localTime ?? "00:00:00"}`,
    url: raw.url,
    imageUrl: raw.images?.[0]?.url ?? "",
    venueName: venue.name ?? "",
    venueAddress: [venue.address?.line1, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(", "),
    neighborhood: venue.city?.name ?? "",
    latitude: Number(venue.location?.latitude),
    longitude: Number(venue.location?.longitude),
    isFree,
    price: isFree ? "Free" : `From $${priceRange?.min ?? 0}`,
    category: classification.segment?.name ?? "Other",
  };
}

const mockFixtureEvents = tmFixture._embedded.events.map(mockMapTicketmasterFixtureEvent);

async function renderEventsScreen() {
  const screen = render(<EventsScreen />);
  await act(async () => {});
  return screen;
}

function mockEventsForQuery(queryParams: { category?: string } = {}) {
  const events = queryParams.category
    ? mockFixtureEvents.filter((event: any) => event.category === queryParams.category)
    : mockFixtureEvents;

  return {
    configured: true,
    loading: false,
    stale: false,
    refreshedAt: "2026-06-13T18:00:00.000Z",
    events,
    providers: [
      { name: "ticketmaster", label: "Ticketmaster", configured: true, status: "live", count: events.length },
      { name: "mlb", label: "Marlins Games", configured: true, status: "live", count: 0 },
    ],
  };
}

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
  useFocusEffect: jest.fn(),
}));

jest.mock("@/lib/routes", () => ({
  openChat: (...args: unknown[]) => mockOpenChat(...args),
}));

jest.mock("@workspace/api-client-react", () => ({
  useGetEvents: jest.fn((queryParams) => ({
    data: mockEventsForQuery(queryParams),
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
  })),
}));

jest.mock("@/services/eventsApi", () => ({
  getEventContexts: (...args: unknown[]) => mockGetEventContexts(...args),
  toggleEventInterest: jest.fn(async () => ({ interested: true })),
}));

jest.mock("@/services/friendsApi", () => ({
  requestJoinFriendPlan: jest.fn(async () => ({})),
}));

jest.mock("@/hooks/useSessionState", () => ({
  useSessionState: () => ({ userId: "user-test" }),
}));

jest.mock("@/components/ActionFeedback", () => ({
  useFeedback: () => ({ trigger: jest.fn() }),
}));

jest.mock("@/components/CreateFriendPlanSheet", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return function MockCreateFriendPlanSheet({ visible, initialSource, onCreated }: any) {
    if (!visible) return null;
    return (
      <View testID="create-friend-plan-sheet">
        <Text>{initialSource?.name}</Text>
        <Pressable
          testID="mock-create-event-plan"
          onPress={() => onCreated({ chat: { id: "chat-event-plan" } })}
        >
          <Text>Create event plan</Text>
        </Pressable>
      </View>
    );
  };
});

describe("EventsScreen critical flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders real fixture-backed events instead of an error state", async () => {
    const { getByText, queryByText } = await renderEventsScreen();

    expect(getByText("Miami Summer Concert")).toBeTruthy();
    expect(getByText("Florida Panthers Watch Party")).toBeTruthy();
    expect(queryByText("Couldn't reach the server")).toBeNull();
  });

  it("opens the event detail sheet and shows the Get Tickets link", async () => {
    const { getByText } = await renderEventsScreen();

    fireEvent.press(getByText("Miami Summer Concert"));

    await waitFor(() => {
      expect(getByText("Get Tickets")).toBeTruthy();
      expect(getByText("About this event")).toBeTruthy();
    });
  });

  it("starts a plan from an event and navigates to the created plan chat", async () => {
    const { getAllByText, getByTestId } = await renderEventsScreen();

    fireEvent.press(getAllByText("Start a Plan")[0]);

    await waitFor(() => expect(getByTestId("create-friend-plan-sheet")).toBeTruthy());
    fireEvent.press(getByTestId("mock-create-event-plan"));

    expect(mockOpenChat).toHaveBeenCalledWith("chat-event-plan");
  });

  it("supports pull-to-refresh without throwing", async () => {
    const screen = await renderEventsScreen();
    const refreshControl = screen.UNSAFE_getByType(RefreshControl);

    act(() => {
      refreshControl.props.onRefresh();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it("filter pills narrow results while keeping matching events visible", async () => {
    const { getByTestId, getByText, queryByText } = await renderEventsScreen();

    fireEvent.press(getByTestId("event-filter-sports"));

    await waitFor(() => {
      expect(getByText("Florida Panthers Watch Party")).toBeTruthy();
      expect(queryByText("Miami Summer Concert")).toBeNull();
    });
  });
});
