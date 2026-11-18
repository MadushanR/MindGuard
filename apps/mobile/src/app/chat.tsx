import { Platform } from "react-native";
import { LiveSignInPage } from "../features/ai/live/LiveAccountForm";
import { useLiveVoice } from "../features/ai/live/LiveVoiceProvider";
import { ChatScreen } from "../features/ai/screens/ChatScreen";

export default function ChatRoute() {
  const { signedIn } = useLiveVoice();
  if (Platform.OS === "web" && !signedIn) return <LiveSignInPage conversation="chat" />;
  return <ChatScreen />;
}
