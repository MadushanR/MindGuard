import { useEffect, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../../ai";
import {
  SharedInformationProvider, useSharedInformation,
  type RevokeServiceResult, type ShareServiceResult, type SharingService,
} from "..";
import { SharedInformationScreen } from "../screens/SharedInformationScreen";
import copy from "../../../../../../packages/fixtures/security/shared-information.json";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));

function revokeService(results: (() => Promise<RevokeServiceResult>)[]) {
  const service: SharingService = {
    createShare: jest.fn(() => Promise.resolve({ status: "complete", shareId: "s1", executionMode: "simulated" } as const)),
    revokeShare: jest.fn(() => (results.shift() ?? (() => Promise.resolve({ status: "complete", executionMode: "simulated" } as const)))()),
  };
  return service;
}
let shares: ReturnType<typeof useSharedInformation>;
function Capture({ children }: PropsWithChildren) {
  const value = useSharedInformation();
  useEffect(() => { shares = value; }, [value]);
  return children;
}
async function renderHistory(service: SharingService, timeoutMs?: number) {
  await render(<SharedInformationScreen />, {
    wrapper: ({ children }: PropsWithChildren) => (
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AIProvider><SharedInformationProvider service={service} timeoutMs={timeoutMs}>
          <Capture>{children}</Capture>
        </SharedInformationProvider></AIProvider>
      </SafeAreaProvider>
    ),
  });
  await act(async () => {
    await shares.submitShare({ requestId: "r1", recipientName: "Alex Demo", content: ["Synthetic steps"] });
  });
}
const openRevoke = () => fireEvent.press(screen.getByLabelText("Revoke access for Alex Demo"));
afterEach(async () => { await cleanup(); });

test("cancelling the revoke dialog keeps the share and calls nothing", async () => {
  const service = revokeService([]);
  await renderHistory(service);
  await openRevoke();
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(service.revokeShare).not.toHaveBeenCalled();
  expect(shares.records).toHaveLength(1);
});

test("revocation stays pending until confirmed and ignores repeated requests", async () => {
  let finish!: (value: RevokeServiceResult) => void;
  const service = revokeService([() => new Promise((resolve) => { finish = resolve; })]);
  await renderHistory(service);
  await openRevoke();
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  expect(screen.getByText(copy.revokePending)).toBeTruthy();
  expect(screen.getByText(copy.revokePendingLabel)).toBeTruthy();
  await act(async () => { await shares.revokeShare(shares.records[0].id); });
  expect(service.revokeShare).toHaveBeenCalledTimes(1);
  expect(shares.records).toHaveLength(1);
  expect(screen.queryByText(copy.revokedNotice)).toBeNull();
  await act(async () => finish({ status: "complete", executionMode: "simulated" }));
  await waitFor(() => expect(shares.records).toEqual([]));
  expect(screen.getByText(copy.revokedNotice)).toBeTruthy();
});

test("a failed revocation keeps the share with an explicit state, and retry reuses the request", async () => {
  const service = revokeService([() => Promise.resolve({ status: "failed", error: "UNAVAILABLE" })]);
  await renderHistory(service);
  await openRevoke();
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  expect(await screen.findByText(copy.revokeFailed)).toBeTruthy();
  expect(screen.getByText(copy.revokeFailedLabel)).toBeTruthy();
  expect(shares.records).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Try revoking again"));
  await waitFor(() => expect(shares.records).toEqual([]));
  const calls = jest.mocked(service.revokeShare).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[0][0]).toBe("s1");
});

test("no response is reported as unknown, never as revoked", async () => {
  const service = revokeService([() => new Promise(() => undefined)]);
  await renderHistory(service, 30);
  await openRevoke();
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  expect(await screen.findByText(copy.revokeUnknown)).toBeTruthy();
  expect(shares.records).toHaveLength(1);
  expect(shares.records[0].revocation).toBe("unknown");
  expect(screen.getByText(copy.revokeUnknownLabel)).toBeTruthy();
  // Unknown must not be presented as a definite failure ("access unchanged").
  expect(screen.queryByText(copy.revokeFailedLabel)).toBeNull();
  expect(screen.queryByText(copy.revokedNotice)).toBeNull();
  // Reopening the dialog keeps the unknown state and offers a safe retry.
  await fireEvent.press(screen.getByLabelText("Cancel"));
  await openRevoke();
  expect(screen.getByText(copy.revokeUnknown)).toBeTruthy();
  expect(screen.getByLabelText("Try revoking again")).toBeTruthy();
});

test("a late confirmation after an unknown revocation outcome removes the share once", async () => {
  let finish!: (value: RevokeServiceResult) => void;
  const service = revokeService([() => new Promise((resolve) => { finish = resolve; })]);
  await renderHistory(service, 30);
  await openRevoke();
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  await screen.findByText(copy.revokeUnknownLabel);
  await act(async () => finish({ status: "complete", executionMode: "simulated" }));
  await waitFor(() => expect(shares.records).toEqual([]));
  expect(service.revokeShare).toHaveBeenCalledTimes(1);
});

test.each(["rejection", "synchronous error"])("a revocation %s stays unknown and retries the same operation", async (failure) => {
  const service = revokeService([() => {
    if (failure === "synchronous error") throw new Error("Connection closed");
    return Promise.reject(new Error("Response lost"));
  }]);
  await renderHistory(service);
  await openRevoke();
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  expect(await screen.findByText(copy.revokeUnknown)).toBeTruthy();
  expect(shares.records[0].revocation).toBe("unknown");
  expect(screen.queryByText(copy.revokeFailedLabel)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Try revoking again"));
  await waitFor(() => expect(shares.records).toEqual([]));
  const calls = jest.mocked(service.revokeShare).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
});

test.each(["rejection", "synchronous error"])("a create %s stays unknown and retains its payload binding", async (failure) => {
  const service = revokeService([]);
  await renderHistory(service);
  jest.mocked(service.createShare).mockImplementationOnce(() => {
    if (failure === "synchronous error") throw new Error("Connection closed");
    return Promise.reject(new Error("Response lost"));
  });
  const request = { requestId: "ambiguous", recipientName: "Sam Example", content: ["Synthetic sleep"] };
  await act(async () => {
    expect(await shares.submitShare(request)).toEqual({ status: "unknown" });
  });
  expect(shares.records).toHaveLength(1);
  await act(async () => {
    expect(await shares.submitShare({ ...request, recipientName: "Another recipient" })).toEqual({ status: "failed", error: "CONFLICT" });
    expect(await shares.submitShare({ ...request, content: ["Different content"] })).toEqual({ status: "failed", error: "CONFLICT" });
    expect((await shares.submitShare(request)).status).toBe("complete");
  });
  expect(service.createShare).toHaveBeenCalledTimes(3);
  const calls = jest.mocked(service.createShare).mock.calls;
  expect(calls[2]).toEqual(calls[1]);
  expect(shares.records).toHaveLength(2);
});

describe("request ID and payload checks", () => {
  const share = { requestId: "r1", recipientName: "Alex Demo", content: ["Synthetic steps"] };
  test("an identical retry returns the existing share; a different payload is a conflict", async () => {
    const service = revokeService([]);
    await renderHistory(service);
    await act(async () => {
      expect((await shares.submitShare(share)).status).toBe("complete");
      expect(await shares.submitShare({ ...share, content: ["Synthetic sleep"] })).toEqual({ status: "failed", error: "CONFLICT" });
      expect(await shares.submitShare({ ...share, recipientName: "Sam Example" })).toEqual({ status: "failed", error: "CONFLICT" });
    });
    expect(service.createShare).toHaveBeenCalledTimes(1);
    expect(shares.records).toHaveLength(1);
    expect(shares.records[0].content).toEqual(["Synthetic steps"]);
  });
  test("a different payload under an in-flight requestId is rejected and never recorded", async () => {
    let finish!: (value: ShareServiceResult) => void;
    const service: SharingService = {
      createShare: jest.fn(() => new Promise<ShareServiceResult>((resolve) => { finish = resolve; })),
      revokeShare: jest.fn(),
    };
    await render(<SharedInformationScreen />, {
      wrapper: ({ children }: PropsWithChildren) => (
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <AIProvider><SharedInformationProvider service={service}><Capture>{children}</Capture></SharedInformationProvider></AIProvider>
        </SafeAreaProvider>
      ),
    });
    let first!: Promise<unknown>;
    await act(async () => {
      first = shares.submitShare(share);
      expect(await shares.submitShare({ ...share, content: ["Synthetic sleep"] })).toEqual({ status: "failed", error: "CONFLICT" });
    });
    await act(async () => { finish({ status: "complete", shareId: "s1", executionMode: "simulated" }); await first; });
    expect(service.createShare).toHaveBeenCalledTimes(1);
    expect(shares.records).toHaveLength(1);
    expect(shares.records[0].content).toEqual(["Synthetic steps"]);
  });
});
