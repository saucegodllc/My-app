import { fireEvent, render } from "@testing-library/react-native";

import { DatingMatchModal, type DopamineMatch } from "../components/DatingMatchModal";

const mockOpenChat = jest.fn();
const mockOpenConnectChat = jest.fn();

jest.mock("@/lib/routes", () => ({
  openChat: (...args: unknown[]) => mockOpenChat(...args),
  openConnectChat: (...args: unknown[]) => mockOpenConnectChat(...args),
}));

jest.mock("../components/VibeBreakdown", () => ({
  VibeBreakdownFull: () => null,
}));

const match: DopamineMatch = {
  chatId: "local-chat-1",
  serverMatchId: "server-match-1",
  source: "server",
  profile: {
    id: "profile-1",
    name: "Maya",
    intent: "dating",
    photos: ["https://example.com/maya.jpg"],
    interests: ["Salsa", "Rooftops"],
  },
};

describe("DatingMatchModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders nothing when match is null", () => {
    const { queryByTestId } = render(<DatingMatchModal match={null} onClose={jest.fn()} />);

    expect(queryByTestId("dating-match-modal")).toBeNull();
  });

  it("renders the match title and core CTAs", () => {
    const { getByText, getByTestId } = render(<DatingMatchModal match={match} onClose={jest.fn()} />);

    expect(getByText("clicked.")).toBeTruthy();
    expect(getByTestId("dating-match-start-chat")).toBeTruthy();
    expect(getByTestId("dating-match-keep-exploring")).toBeTruthy();
    expect(getByTestId("dating-match-view-connect")).toBeTruthy();
  });

  it("closes from the close and keep exploring controls", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<DatingMatchModal match={match} onClose={onClose} />);

    fireEvent.press(getByTestId("dating-match-close"));
    fireEvent.press(getByTestId("dating-match-keep-exploring"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("starts chat through the existing server match route helper", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<DatingMatchModal match={match} onClose={onClose} />);

    fireEvent.press(getByTestId("dating-match-start-chat"));
    jest.runOnlyPendingTimers();

    expect(onClose).toHaveBeenCalled();
    expect(mockOpenChat).toHaveBeenCalledWith("server-match-1", { wave: true });
  });

  it("opens Make a Plan through the existing server match route helper", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<DatingMatchModal match={match} onClose={onClose} />);

    fireEvent.press(getByTestId("dating-match-make-plan"));
    jest.runOnlyPendingTimers();

    expect(onClose).toHaveBeenCalled();
    expect(mockOpenChat).toHaveBeenCalledWith("server-match-1", { openPlan: true });
  });

  it("opens the Connect thread through the existing route helper", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<DatingMatchModal match={match} onClose={onClose} />);

    fireEvent.press(getByTestId("dating-match-view-connect"));
    jest.advanceTimersByTime(80);

    expect(onClose).toHaveBeenCalled();
    expect(mockOpenConnectChat).toHaveBeenCalledWith("server-match-1");
  });
});
