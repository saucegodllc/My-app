import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import DatingChatScreen from "../app/chat/dating/[id]";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "chat-1" }),
}));

jest.mock("react-native-keyboard-controller", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    KeyboardAvoidingView: ({ children, ...props }: any) => React.createElement(View, props, children),
  };
});

jest.mock("@/components/MatchProfileSheet", () => ({
  MatchProfileSheet: () => null,
}));

jest.mock("@/contexts/DatingMatchContext", () => ({
  useDatingMatches: () => ({
    currentUserId: "me",
    sendMessage: jest.fn(),
    chats: [
      {
        id: "chat-1",
        messages: [],
      },
    ],
    matches: [
      {
        chatId: "chat-1",
        profile: {
          id: "profile-1",
          name: "Maya",
          photos: [],
          intent: "dating",
          interests: ["jazz"],
        },
      },
    ],
  }),
}));

describe("Dating chat Plan button", () => {
  it("prefills the composer with a plan opener on tap", () => {
    const { getByTestId, getByDisplayValue } = render(<DatingChatScreen />);

    fireEvent.press(getByTestId("dating-chat-plan-button"));

    expect(getByDisplayValue("Let's make a plan - what sounds good to you?")).toBeTruthy();
  });
});
