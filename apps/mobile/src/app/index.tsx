import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { WelcomeScreen } from "../features/ai/screens/WelcomeScreen";
import { useSecuritySession } from "../features/security/SecuritySessionProvider";

export default function WelcomeRoute() {
  const { identity } = useSecuritySession();
  if (Platform.OS === "web" && identity) return <Redirect href="/home" />;
  return <WelcomeScreen />;
}
