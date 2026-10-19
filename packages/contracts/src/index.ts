export type Emotion = "Calm" | "Tense" | "Low" | "Hopeful";
export type Retention = 7 | 30 | 90 | "manual" | null;
export type VoiceState =
  | "ready"
  | "listening"
  | "processing"
  | "speaking"
  | "muted"
  | "reconnecting"
  | "stopped"
  | "error";
export interface Preferences {
  saveHistory: boolean;
  retentionDays: Retention;
  saveVoiceTranscripts: boolean;
  reducedMotion: boolean;
  largerText: boolean;
}
export interface ConsentState {
  voice: boolean;
  tone: boolean;
  chatObservations: boolean;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode: "text" | "voice";
  createdAt: number;
}
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}
export interface Observation {
  id: string;
  conversationId?: string;
  source: "Chat" | "Voice tone";
  predictedLabel: Emotion;
  correctedLabel?: Emotion;
  confidence: number;
  status: "Estimated" | "Confirmed" | "Corrected";
  dismissed: boolean;
  createdAt: number;
}
export interface RememberedDetail {
  id: string;
  text: string;
  conversationId?: string;
  createdAt: number;
}
export interface SavedData {
  version: 1;
  preferences: Preferences;
  consent: ConsentState;
  conversations: Conversation[];
  observations: Observation[];
  memories: RememberedDetail[];
}
export interface ActiveConversation {
  id: string;
  createdAt: number;
  messages: Message[];
  temporary: boolean;
  saving: boolean;
  saveVoiceTranscripts: boolean;
  replyIndex: number;
  voiceIndex: number;
}
export interface SimulationEstimate {
  label: Emotion;
  confidence: number;
}
export interface ChatReply {
  text: string;
  delayMs: number;
  failOnce?: boolean;
  observation?: SimulationEstimate;
}
export interface ChatScript {
  id: string;
  name: string;
  replies: ChatReply[];
  fallback: ChatReply;
}
export interface VoiceStep {
  state:
    | "listening"
    | "processing"
    | "speaking"
    | "reconnecting"
    | "error"
    | "stopped";
  durationMs: number;
  transcript?: { user: string; assistant: string };
  observation?: SimulationEstimate;
}
export interface VoiceScript {
  id: string;
  name: string;
  steps: VoiceStep[];
}
export interface Recommendation {
  id: string;
  emotion: Emotion | null;
  format: "Videos" | "Guides";
  title: string;
  description: string;
  duration: string;
  artwork: "meadow" | "leaves" | "dunes" | "steps" | "dusk" | "sunrise";
  detail: string;
}
export interface Scenario {
  id: string;
  name: string;
  description: string;
  chatScriptId: string;
  voiceScriptId: string;
  initialChatState: "idle" | "processing" | "error";
  preferences: Preferences;
  consent: ConsentState;
  conversationIds: string[];
  observationIds: string[];
  memoryIds: string[];
}
export interface ObservationPort {
  observations: Observation[];
  confirmObservation(id: string): void;
  correctObservation(id: string, label: Emotion): void;
  dismissObservation(id: string): void;
}
export interface ConsentPort {
  consent: ConsentState;
  setConsent(key: keyof ConsentState, allowed: boolean): void;
}
export interface TextProvider {
  reply(scriptId: string, index: number): ChatReply;
}
export interface VoiceProvider {
  steps(scriptId: string): VoiceStep[];
}
export type ScreenId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24;
export interface ScreenDestination {
  id: ScreenId;
  title: string;
  route: string;
  owner: "Madushan" | "Zain" | "Munsif";
}
