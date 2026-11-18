import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSharingConsent, useSharedInformation, type ShareErrorCode } from "../security";
import { buildSharePreview, type SharePreview } from "./sharing";
import { useWellness } from "./state";
import { useSecuritySessionOptional } from "../security/SecuritySessionProvider";

/**
 * UC-10 client workflow (diagram role: ShareWorkflowController). It coordinates the
 * preview, consent re-checks and submission; the security module owns history and the
 * sharing service boundary. Consent here is the local Screen 16 demo preference, a
 * client-side check only — a live FA2 service must enforce authorization itself.
 */
export type SharePhase =
  | { readonly kind: "draft" }
  | { readonly kind: "checking" }
  | { readonly kind: "ready"; readonly preview: SharePreview; readonly requestId: string }
  | { readonly kind: "submitting"; readonly preview: SharePreview; readonly requestId: string }
  | { readonly kind: "succeeded"; readonly preview: SharePreview }
  | { readonly kind: "failed"; readonly preview: SharePreview; readonly requestId: string; readonly error: ShareErrorCode }
  | { readonly kind: "unknown"; readonly preview: SharePreview; readonly requestId: string }
  | { readonly kind: "denied"; readonly reason: "consent" | "consent-unavailable" }
  | { readonly kind: "invalidated" };

const newRequestId = () => `share-request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const reviewable = (phase: SharePhase) =>
  phase.kind === "ready" || phase.kind === "failed" || phase.kind === "unknown";

export function useShareWorkflow() {
  const w = useWellness();
  const shares = useSharedInformation();
  const account = useSecuritySessionOptional();
  const readConsent = useCallback(async () => account ? (await account.refresh()).preferences.sharing : readSharingConsent(), [account]);
  const current = useMemo(() => buildSharePreview({
    destinationId: w.destination, recipients: w.recipients, selected: w.selected,
    available: w.available, device: w.device,
  }), [w.destination, w.recipients, w.selected, w.available, w.device]);
  const [phase, setPhaseState] = useState<SharePhase>({ kind: "draft" });
  /** The user stopped waiting locally; the simulated request may still complete. */
  const [detached, setDetached] = useState(false);
  const phaseRef = useRef(phase);
  const currentRef = useRef(current);
  const setPhase = useCallback((next: SharePhase) => { phaseRef.current = next; setPhaseState(next); }, []);
  const attempt = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; attempt.current += 1; };
  }, []);
  // Late results after unmount, a local "stop waiting", or a newer attempt are ignored.
  const live = useCallback((token: number) => mounted.current && attempt.current === token, []);

  // Any change to the selection, destination, recipient or source availability makes an
  // open preview stale; the user must review the new content before confirming.
  useEffect(() => {
    currentRef.current = current;
    const p = phaseRef.current;
    if (reviewable(p) && "preview" in p && p.preview.key !== current?.key) setPhase({ kind: "invalidated" });
  }, [current, setPhase]);

  const preview = useCallback(async () => {
    if (busy.current) return;
    const snapshot = currentRef.current;
    setDetached(false);
    if (!snapshot) { setPhase({ kind: "invalidated" }); return; }
    if (snapshot.destination.kind === "export") {
      setPhase({ kind: "ready", preview: snapshot, requestId: newRequestId() });
      return;
    }
    const token = ++attempt.current;
    busy.current = true;
    setPhase({ kind: "checking" });
    try {
      let allowed: boolean;
      try { allowed = await readConsent(); } catch {
        if (live(token)) setPhase({ kind: "denied", reason: "consent-unavailable" });
        return;
      }
      if (!live(token)) return;
      if (!allowed) { setPhase({ kind: "denied", reason: "consent" }); return; }
      const latest = currentRef.current;
      if (!latest || latest.key !== snapshot.key) { setPhase({ kind: "invalidated" }); return; }
      setPhase({ kind: "ready", preview: snapshot, requestId: newRequestId() });
    } finally {
      if (live(token)) busy.current = false;
    }
  }, [live, setPhase, readConsent]);

  const confirm = useCallback(async () => {
    const p = phaseRef.current;
    if (busy.current || !reviewable(p) || !("requestId" in p)) return;
    const { preview: snapshot, requestId } = p;
    if (currentRef.current?.key !== snapshot.key) { setPhase({ kind: "invalidated" }); return; }
    // Export remains a local preview: nothing is created, sent, recorded or downloaded.
    if (snapshot.destination.kind === "export") { setPhase({ kind: "succeeded", preview: snapshot }); return; }
    const recipient = snapshot.destination.recipient;
    const token = ++attempt.current;
    busy.current = true;
    setPhase({ kind: "submitting", preview: snapshot, requestId });
    try {
      let allowed: boolean;
      try { allowed = await readConsent(); } catch {
        if (live(token)) setPhase({ kind: "denied", reason: "consent-unavailable" });
        return;
      }
      if (!live(token)) return;
      if (!allowed) { setPhase({ kind: "denied", reason: "consent" }); return; }
      if (currentRef.current?.key !== snapshot.key) { setPhase({ kind: "invalidated" }); return; }
      const result = await shares.submitShare({ requestId, recipientName: recipient.name, content: snapshot.content,
        ...(account ? { destination: { ...recipient } } : {}),
      });
      if (!live(token)) return;
      if (result.status === "complete") setPhase({ kind: "succeeded", preview: snapshot });
      else if (result.status === "failed") setPhase({ kind: "failed", preview: snapshot, requestId, error: result.error });
      else if (result.status === "unknown") setPhase({ kind: "unknown", preview: snapshot, requestId });
      else setPhase({ kind: "draft" });
    } finally {
      if (live(token)) busy.current = false;
    }
  }, [live, setPhase, shares, readConsent, account]);

  const close = useCallback(() => {
    const p = phaseRef.current;
    if (p.kind === "submitting" || p.kind === "checking") {
      // Stops only the local wait. A request already handed to the service may still complete.
      attempt.current += 1;
      busy.current = false;
      if (p.kind === "submitting") setDetached(true);
    }
    setPhase({ kind: "draft" });
  }, [setPhase]);
  const dismissResult = useCallback(() => {
    if (phaseRef.current.kind === "succeeded") setPhase({ kind: "draft" });
    setDetached(false);
  }, [setPhase]);

  return { phase, current, detached, preview, confirm, close, dismissResult };
}
