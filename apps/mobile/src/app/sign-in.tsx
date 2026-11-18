import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { SignInScreen } from "../features/security/screens/SignInScreen";
import { useSecuritySession } from "../features/security/SecuritySessionProvider";

export default function SignInRoute() {
  const { identity } = useSecuritySession();
  return Platform.OS === "web" && identity ? <Redirect href="/home" /> : <SignInScreen />;
}
