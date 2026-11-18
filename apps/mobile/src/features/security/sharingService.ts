/**
 * Client boundary for UC-10 sharing (the diagrams' proposed FA2 `ISharingApplication`).
 * No FA2 sharing endpoint exists yet. The only implementation here is an explicitly
 * simulated, session-only adapter: it sends nothing, authorizes nothing and is not
 * account-isolated. A live adapter must enforce identity, ownership and sharing consent
 * on the server; client checks never substitute for that.
 */
export type ShareErrorCode = "UNAVAILABLE" | "CONFLICT" | "INVALID";
export interface ShareServiceRequest {
  /** Reused for an unchanged retry so a repeated request cannot create a duplicate. */
  readonly requestId: string;
  readonly recipientName: string;
  readonly content: readonly string[];
}
export type ShareServiceResult =
  | { readonly status: "complete"; readonly shareId: string; readonly executionMode: "simulated" }
  | { readonly status: "failed"; readonly error: ShareErrorCode };
export type RevokeServiceResult =
  | { readonly status: "complete"; readonly executionMode: "simulated" }
  | { readonly status: "failed"; readonly error: ShareErrorCode };
export interface SharingService {
  createShare(request: ShareServiceRequest): Promise<ShareServiceResult>;
  revokeShare(shareId: string, requestId: string): Promise<RevokeServiceResult>;
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
    setUnavailable(value) { unavailable = value; },
    async createShare(request) {
      await wait(delayMs);
      const payload = JSON.stringify([request.recipientName, request.content]);
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
