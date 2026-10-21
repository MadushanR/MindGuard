import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../features/ai/AIProvider";
import { AppShell } from "../shared/AppShell";
import { WellnessProvider } from "../features/wellness";
import { RecipientsProvider, SavedInformationProvider, SharedInformationProvider } from "../features/security";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AIProvider>
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
      </AIProvider>
    </SafeAreaProvider>
  );
}
