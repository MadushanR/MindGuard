import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseDemoPreferences, PRIVACY_STORAGE_KEY } from "./privacy";

/**
 * Public read of the existing Screen 16 "Sharing" demo preference. It reuses that store;
 * it does not create another one. This is a local device choice, not server consent:
 * a missing value means "not granted", and unreadable or malformed storage rejects so
 * callers fail closed instead of treating the error as approval.
 */
export async function readSharingConsent(): Promise<boolean> {
  return parseDemoPreferences(await AsyncStorage.getItem(PRIVACY_STORAGE_KEY)).sharing;
}
