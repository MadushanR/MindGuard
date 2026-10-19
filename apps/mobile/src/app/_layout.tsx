import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../features/ai/AIProvider";
import { AppShell } from "../shared/AppShell";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AIProvider>
        <StatusBar style="dark" />
        <AppShell>
          <Slot />
        </AppShell>
      </AIProvider>
    </SafeAreaProvider>
  );
}
