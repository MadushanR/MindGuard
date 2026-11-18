import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../features/ai/AIProvider";
import { LiveVoiceProvider } from "../features/ai/live/LiveVoiceProvider";
import { AppShell } from "../shared/AppShell";
import { WellnessProvider } from "../features/wellness";
import { RecipientsProvider, SavedInformationProvider, SharedInformationProvider } from "../features/security";
import { SecuritySessionProvider, useSecuritySession } from "../features/security/SecuritySessionProvider";
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
                  <StatusBar style="dark" />
                  <AppShell>
                    <Slot />
                  </AppShell>
                </SavedInformationProvider>
              </SharedInformationProvider>
            </RecipientsProvider>
          </WellnessProvider>
        </LiveVoiceProvider>
      </AIProvider>
    </SafeAreaProvider>
  );
}
