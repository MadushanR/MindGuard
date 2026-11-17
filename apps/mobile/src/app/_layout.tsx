import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../features/ai/AIProvider";
import { LiveVoiceProvider } from "../features/ai/live/LiveVoiceProvider";
import { AppShell } from "../shared/AppShell";
import { WellnessProvider } from "../features/wellness";
import { RecipientsProvider, SavedInformationProvider, SharedInformationProvider } from "../features/security";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AIProvider>
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
