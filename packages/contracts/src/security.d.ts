/** Account-owned application data; never contains Cognito credentials or live transcripts. */
export interface AccountPreferences {
  wellnessData: boolean;
  saveSummaries: boolean;
  sharing: boolean;
  contactNotifications: boolean;
}
export interface ShareDestination {
  id: string;
  name: string;
  email: string;
  relationship: string;
}
export interface AccountShare {
  id: string;
  requestId: string;
  recipientName: string;
  /** Cognito subject resolved by the server from the reviewed verified email. */
  recipientAccountId: string;
  destination: ShareDestination;
  content: readonly string[];
  createdAt: number;
  revoked: boolean;
  executionMode: "live";
}
export interface AccountContact { id: string; name: string; relationship: string }
export interface AccountSavedCategory {
  id: "weekly-summary" | "wellness-records";
  label: string;
  weekLabel: string;
  content: readonly string[];
}
export interface AccountAlert {
  id: string;
  sender: string;
  message: string;
  createdAt: number;
}
export interface SecuritySnapshot {
  accountDeletionAvailable?: boolean;
  preferences: AccountPreferences;
  contacts: AccountContact[];
  saved: AccountSavedCategory[];
  outgoing: AccountShare[];
  incoming: (AccountShare & { sender: string })[];
  alerts: AccountAlert[];
  alertSenders: string[];
}
