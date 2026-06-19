/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Run tests from __tests__ in the app root
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  // Exclude Cloud Function tests (they have their own Jest config in /functions)
  testPathIgnorePatterns: ["/node_modules/", "/functions/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(?:((jest-)?react-native|@react-native(?:-community)?|expo(?:nent)?|expo-.*|@expo(?:nent)?|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg)(?:@|\\+)))",
    "node_modules/(?!\\.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@workspace/api-client-react$": "<rootDir>/__mocks__/@workspace/api-client-react.ts",
  },
};
