import { Platform } from "react-native";
import { LiveSignInPage } from "../features/ai/live/LiveAccountForm";
import { useLiveVoice } from "../features/ai/live/LiveVoiceProvider";
import { VoiceScreen } from "../features/ai/screens/VoiceScreen";

export default function VoiceRoute() {
  const { signedIn } = useLiveVoice();
  if (Platform.OS === "web" && !signedIn) return <LiveSignInPage conversation="voice" />;
  return <VoiceScreen />;
}
