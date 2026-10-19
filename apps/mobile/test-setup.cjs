jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  usePathname: () => "/chat",
}));
