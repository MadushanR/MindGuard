import { Redirect, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { CreateAccountScreen } from "../features/security/screens/CreateAccountScreen";
import { useSecuritySession } from "../features/security/SecuritySessionProvider";

export default function CreateAccountRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { identity } = useSecuritySession();
  if (Platform.OS === "web" && identity) return <Redirect href="/home" />;
  const returnTo = from === "voice" || from === "chat" ? `/${from}` as const : "/sign-in";
  return <CreateAccountScreen returnTo={returnTo} />;
}
