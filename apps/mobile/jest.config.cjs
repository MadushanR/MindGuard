module.exports = {
  preset: "jest-expo",
  // Expo's first native-component transform can exceed Jest's 5s default on Windows.
  testTimeout: 30000,
  roots: ["<rootDir>/src"],
  modulePathIgnorePatterns: [
    "<rootDir>/android/",
    "<rootDir>/ios/",
    "<rootDir>/dist/",
  ],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  moduleNameMapper: {
    "^@mindguard/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
    "^@mindguard/fixtures$": "<rootDir>/../../packages/fixtures/src/index.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/test-setup.cjs"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo.*|@expo/.*|@react-navigation/.*|react-native-svg|@react-native-async-storage)/)",
  ],
};
