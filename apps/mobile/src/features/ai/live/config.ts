import { Platform } from "react-native";

export function voiceRelayUrl() {
  const value = process.env.EXPO_PUBLIC_VOICE_RELAY_URL || (Platform.OS === "web" ?
    (__DEV__ ? "http://localhost:3001" : window.location.origin) : "");
  if (!value) throw new Error("VOICE_RELAY_NOT_CONFIGURED");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !["http:", "https:"].includes(url.protocol))
    throw new Error("VOICE_RELAY_NOT_CONFIGURED");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!__DEV__ && url.protocol !== "https:" && !loopback) throw new Error("SECURE_RELAY_REQUIRED");
  return value.replace(/\/+$/, "");
}
