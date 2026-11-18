import { DarkTheme, DefaultTheme, Slot, Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { useMemo } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../features/ai/AIProvider";
import { LiveVoiceProvider } from "../features/ai/live/LiveVoiceProvider";
import { AppShell } from "../shared/AppShell";
import { destinations } from "../shared/navigation";
import { ThemeProvider } from "../shared/ThemeProvider";
import { useTheme } from "../shared/theme";
import { WellnessProvider } from "../features/wellness";
import { RecipientsProvider, SavedInformationProvider, SharedInformationProvider } from "../features/security";
import { SecuritySessionProvider, useSecuritySession } from "../features/security/SecuritySessionProvider";

const publicWebRoutes = new Set(["/", "/sign-in", "/create-account", "/account-recovery", "/privacy", "/resources", "/chat", "/voice"]);
const memberScreens = destinations
  .filter(({ route }) => !publicWebRoutes.has(route))
  .map(({ route }) => route.slice(1));

function AppNavigator() {
  const { identity } = useSecuritySession();
  const { mode, colors } = useTheme();
  const navigationTheme = useMemo(() => ({
    ...(mode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      primary: colors.teal,
      background: colors.paper,
      card: colors.card,
      text: colors.ink,
      border: colors.line,
      notification: colors["danger-text"],
    },
  }), [mode, colors]);
  if (Platform.OS !== "web") return <Slot />;
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!!identity}>
          {memberScreens.map((name) => <Stack.Screen key={name} name={name} />)}
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return <SecuritySessionProvider persistent><AccountLayout /></SecuritySessionProvider>;
}
function AccountLayout() {
  const { identity } = useSecuritySession();
  return (
    <SafeAreaProvider>
      <AIProvider storageKey={identity ? `mindguard.account.${identity.owner}.ai.v1` : undefined}>
        <LiveVoiceProvider>
          <WellnessProvider>
            <RecipientsProvider>
              <SharedInformationProvider>
                <SavedInformationProvider>
                  <ThemeProvider>
                    <AppShell>
                      <AppNavigator />
                    </AppShell>
                  </ThemeProvider>
                </SavedInformationProvider>
              </SharedInformationProvider>
            </RecipientsProvider>
          </WellnessProvider>
        </LiveVoiceProvider>
      </AIProvider>
    </SafeAreaProvider>
  );
}
