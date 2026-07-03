/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "src/routes/stripe.ts",
    "src/lib/stripeClient.ts",
    "src/lib/revenueCatClient.ts",
  ],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      useESM: true,
      tsconfig: {
        module: "ESNext",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
