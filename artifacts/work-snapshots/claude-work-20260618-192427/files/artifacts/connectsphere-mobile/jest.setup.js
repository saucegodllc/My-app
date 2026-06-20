jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  const identity = (value, _config, callback) => {
    if (typeof callback === "function") callback(true);
    return value;
  };
  const Reanimated = {
    View,
    Text,
    createAnimatedComponent: (component) => component,
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (factory) => factory(),
    useAnimatedProps: (factory) => factory(),
    withTiming: identity,
    withSpring: identity,
    withDelay: (_delay, value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: jest.fn(),
    runOnJS: (fn) => fn,
    interpolate: (value, input, output) => {
      if (value <= input[0]) return output[0];
      if (value >= input[input.length - 1]) return output[output.length - 1];
      return output[0];
    },
    Extrapolation: { CLAMP: "clamp" },
    FadeIn: {},
    FadeOut: {},
    FadeInDown: {},
    FadeInUp: {},
    SlideInDown: {},
    SlideOutDown: {},
  };
  return {
    __esModule: true,
    default: Reanimated,
    ...Reanimated,
  };
});

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@clerk/clerk-expo", () => ({
  useUser: () => ({
    user: {
      id: "user_test_me",
      imageUrl: "https://example.com/me.jpg",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name, testID }) => React.createElement(Text, { testID }, name ?? "icon");
  return {
    Ionicons: Icon,
    MaterialCommunityIcons: Icon,
  };
});

jest.mock("expo-image", () => {
  const React = require("react");
  const { Image } = require("react-native");
  return {
    Image: (props) => React.createElement(Image, props),
  };
});

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }) => React.createElement(View, props, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children }) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
  NotificationFeedbackType: { Warning: "Warning", Success: "Success", Error: "Error" },
}));

jest.mock("@/lib/sounds", () => ({
  playSound: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/analytics", () => ({
  Analytics: {
    chatOpened: jest.fn(),
    paywallSeen: jest.fn(),
    swipeLimitHit: jest.fn(),
  },
}));
