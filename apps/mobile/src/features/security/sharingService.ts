/**
 * Client boundary for UC-10 sharing (the diagrams' proposed FA2 `ISharingApplication`).
 * The configured app uses createLiveSharingService with authenticated status/history
 * and owner-only revocation. The explicit simulated adapter remains for standalone
 * prototype/tests. Client checks never substitute for server authorization.
 */
import type { AccountShare, ShareDestination } from "@mindguard/contracts";
import type { SecuritySession } from "./SecuritySessionProvider";
export type ShareErrorCode = "UNAVAILABLE" | "CONFLICT" | "INVALID" | "AUTH_REQUIRED" | "CONSENT_REQUIRED" | "RECIPIENT_UNAVAILABLE" | "CAPACITY";
export interface ShareServiceRequest {
  /** Reused for an unchanged retry so a repeated request cannot create a duplicate. */
  readonly requestId: string;
  readonly recipientName: string;
  readonly content: readonly string[];
  readonly destination?: ShareDestination;
}
export type ShareServiceResult =
  | { readonly status: "complete"; readonly shareId: string; readonly executionMode: "simulated" | "live"; readonly record?: AccountShare }
  | { readonly status: "failed"; readonly error: ShareErrorCode };
export type RevokeServiceResult =
  | { readonly status: "complete"; readonly executionMode: "simulated" | "live" }
  | { readonly status: "failed"; readonly error: ShareErrorCode };
export interface SharingService {
  readonly executionMode?: "simulated" | "live";
  createShare(request: ShareServiceRequest): Promise<ShareServiceResult>;
  revokeShare(shareId: string, requestId: string): Promise<RevokeServiceResult>;
}
export interface LiveSharingService extends SharingService {
  readonly executionMode: "live";
  getStatus(requestId: string): Promise<AccountShare | null>;
  history(): Promise<readonly AccountShare[]>;
}
/** Authenticated adapter mounted by the root provider. Transport errors propagate;
 * they can never become mock success. The session boundary rejects obsolete results. */
export function createLiveSharingService(session: Pick<SecuritySession, "request" | "refresh">): LiveSharingService {
  return {
    executionMode: "live",
    async createShare(request) {
      if (!request.destination) return { status: "failed", error: "INVALID" };
      const record = await session.request<AccountShare>("/shares", "POST", {
        requestId: request.requestId, destination: request.destination, content: request.content,
      });
      return { status: "complete", shareId: record.id, record, executionMode: "live" };
    },
    async revokeShare(id, _requestId) {
      // DELETE identifies an owner-scoped immutable share; setting revoked=true is idempotent.
      await session.request(`/shares/${encodeURIComponent(id)}`, "DELETE");
      return { status: "complete", executionMode: "live" };
    },
    async getStatus(requestId) {
      return (await session.request<{ share: AccountShare | null }>(`/shares/status/${encodeURIComponent(requestId)}`)).share;
    },
    async history() { return (await session.refresh()).outgoing; },
  };
}
export interface SimulatedSharingService extends SharingService {
  /** Demo control: while true, new shares and revocations report the service is unavailable. */
  setUnavailable(value: boolean): void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `delayMs` is visible processing time only; the result still describes a simulation. */
export function createSimulatedSharingService(
  { delayMs = 400 }: { readonly delayMs?: number } = {},
): SimulatedSharingService {
  // requestId -> payload fingerprint and the first completed result (owner-agnostic: demo only).
  const created = new Map<string, { payload: string; result: ShareServiceResult }>();
  const revoked = new Map<string, RevokeServiceResult>();
  let sequence = 0;
  let unavailable = false;
  const shouldFail = () => unavailable;
  return {
    executionMode: "simulated",
    setUnavailable(value) { unavailable = value; },
    async createShare(request) {
      await wait(delayMs);
      const d = request.destination;
      const payload = JSON.stringify([request.recipientName, request.content, d ? [d.id, d.name, d.email, d.relationship] : null]);
      const previous = created.get(request.requestId);
      if (previous) {
        return previous.payload === payload ? previous.result : { status: "failed", error: "CONFLICT" };
      }
      if (shouldFail()) return { status: "failed", error: "UNAVAILABLE" };
      const result: ShareServiceResult = {
        status: "complete", shareId: `simulated-share-${++sequence}`, executionMode: "simulated",
      };
      created.set(request.requestId, { payload, result });
      return result;
    },
    async revokeShare(shareId, requestId) {
      await wait(delayMs);
      const key = `${shareId}:${requestId}`;
      const previous = revoked.get(key);
      if (previous) return previous;
      if (shouldFail()) return { status: "failed", error: "UNAVAILABLE" };
      const result: RevokeServiceResult = { status: "complete", executionMode: "simulated" };
      revoked.set(key, result);
      return result;
    },
  };
}
