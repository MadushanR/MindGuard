import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { wellnessRecords } from "@mindguard/fixtures";

// No wellness/security integration contracts exist yet. These demo models stay
// session-only and never enter the existing AI AsyncStorage profile.
export type Metric = "steps" | "sleep" | "heart";
export interface Recipient {
  id: string;
  name: string;
  email: string;
  relationship: string;
}
export const metricInfo: Record<
  Metric,
  { label: string; unit: string; values: number[] }
> = wellnessRecords;
export const metrics = Object.keys(metricInfo) as Metric[];
export function recipientErrors(
  name: string,
  email: string,
  relationship: string,
  recipients: Recipient[],
) {
  return {
    name: name.trim() ? "" : "Enter a full name.",
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Enter a valid email address."
      : recipients.some(
        (r) => r.email.toLowerCase() === email.trim().toLowerCase(),
      )
        ? "This email is already a recipient."
        : "",
    relationship: relationship.trim()
      ? ""
      : "Enter your relationship to this person.",
  };
}
function useController() {
  const [watch, setWatch] = useState<
    "disconnected" | "connecting" | "connected" | "failed"
  >("disconnected");
  const [device, setDevice] = useState("My smartwatch");
  const [permissions, setPermissions] = useState<Record<Metric, boolean>>({
    steps: false,
    sleep: false,
    heart: false,
  });
  const [paused, setPaused] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [simulateSyncFailure, setSimulateSyncFailure] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [destination, setDestination] = useState("export");
  const [selected, setSelected] = useState<Metric[]>([]);
  const [recipientOrigin, setRecipientOrigin] = useState<"share" | "settings">(
    "settings",
  );
  const available = (metric: Metric) =>
    watch === "connected" && !paused && synced && !syncFailed && permissions[metric];
  const sync = () => {
    if (watch !== "connected" || paused || !metrics.some((m) => permissions[m])) return;
    setSyncFailed(simulateSyncFailure);
    setSynced(!simulateSyncFailure);
  };
  const reset = () => {
    setWatch("disconnected");
    setDevice("My smartwatch");
    setPermissions({ steps: false, sleep: false, heart: false });
    setPaused(false);
    setSynced(false);
    setSyncFailed(false);
    setSimulateSyncFailure(false);
    setRecipients([]);
    setDestination("export");
    setSelected([]);
    setRecipientOrigin("settings");
  };
  return {
    watch,
    setWatch,
    device,
    setDevice,
    permissions,
    setPermissions,
    paused,
    setPaused,
    synced,
    setSynced,
    syncFailed,
    simulateSyncFailure,
    setSimulateSyncFailure,
    sync,
    recipients,
    setRecipients,
    destination,
    setDestination,
    selected,
    setSelected,
    recipientOrigin,
    setRecipientOrigin,
    available,
    reset,
  };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function WellnessProvider({ children }: PropsWithChildren) {
  const value = useController();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWellness() {
  const value = useContext(Context);
  if (!value) throw new Error("Mount WellnessProvider in root layout");
  return value;
}
