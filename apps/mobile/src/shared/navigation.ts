import type { Href } from "expo-router";
import type { ScreenDestination, ScreenId } from "@mindguard/contracts";
export const destinations: ScreenDestination[] = [
  [1, "Welcome", "/", "Madushan"],
  [2, "Create Account", "/create-account", "Munsif"],
  [3, "Sign In", "/sign-in", "Munsif"],
  [4, "Account Recovery", "/account-recovery", "Munsif"],
  [5, "Home", "/home", "Zain"],
  [6, "Text Chat", "/chat", "Madushan"],
  [7, "Voice Conversation", "/voice", "Madushan"],
  [8, "Voice Tone Settings", "/voice-tone", "Madushan"],
  [9, "Wellness Dashboard and Trends", "/trends", "Zain"],
  [10, "Wellness Data Sources", "/data-sources", "Zain"],
  [11, "Wellness and Crisis Resources", "/resources", "Zain"],
  [12, "Trusted Contacts", "/trusted-contacts", "Munsif"],
  [13, "Export and Share Preview", "/export-share", "Zain"],
  [14, "Shared Information", "/shared-information", "Munsif"],
  [15, "Contact Alert Review", "/contact-alert", "Munsif"],
  [16, "Privacy and Consent", "/privacy", "Munsif"],
  [17, "Saved Information and Deletion", "/saved-information", "Munsif"],
  [18, "Settings and Account", "/settings", "Zain"],
  [19, "Connect Smartwatch", "/connect-smartwatch", "Zain"],
  [20, "Add Recipient", "/add-recipient", "Zain"],
  [21, "Personalized Recommendations", "/for-you", "Madushan"],
  [22, "Conversation History", "/history", "Madushan"],
  [
    23,
    "Conversation Preferences and Auto-delete",
    "/conversation-preferences",
    "Madushan",
  ],
  [24, "Remembered Details", "/remembered-details", "Madushan"],
].map(([id, title, route, owner]) => ({
  id,
  title,
  route,
  owner,
})) as ScreenDestination[];
export function destination(id: ScreenId) {
  return destinations.find((d) => d.id === id)!;
}
export function route(id: ScreenId) {
  return destination(id).route as Href;
}
