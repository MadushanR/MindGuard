import {
  VoiceSessionController,
  type VoiceSocket,
  type VoiceAudioPort,
  type VoiceUpdate,
} from "../live/VoiceSessionController";

function setup(permission = true) {
  const sent: Record<string, unknown>[] = [];
  const socket: VoiceSocket = {
    readyState: 1,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: (value) => sent.push(JSON.parse(value)),
    close: jest.fn(),
  };
  const audio: VoiceAudioPort = {
    requestPermission: jest.fn(async () => permission),
    startCapture: jest.fn(async () => {}),
    stopCapture: jest.fn(),
    stopPlayback: jest.fn(),
    playApprovedReply: jest.fn(async () => {}),
  };
  const updates: VoiceUpdate[] = [];
  const request = jest.fn(async () => ({
    ok: true,
    json: async () => ({ sessionId: "session-1" }),
  })) as unknown as typeof fetch;
  const client = new VoiceSessionController(
    "https://example.invalid",
    "test-token",
    audio,
    (u) => updates.push(u),
    request,
    () => socket,
  );
  const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  const event = async (value: unknown) => {
    socket.onmessage?.({ data: JSON.stringify(value) });
    await tick();
  };
  const start = async () => {
    const starting = client.start();
    await tick();
    socket.onopen?.();
    await event({ type: "session.ready", sessionId: "session-1" });
    await starting;
  };
  return { client, audio, socket, updates, sent, request, tick, event, start };
}
test("permission denial never starts capture or creates a backend session", async () => {
  const h = setup(false);
  await h.client.start();
  expect(h.request).not.toHaveBeenCalled();
  expect(h.audio.startCapture).not.toHaveBeenCalled();
  expect(h.updates.at(-1)?.error).toBe("MICROPHONE_PERMISSION_REQUIRED");
});
test("authentication is sent as a first socket event, never in its URL", async () => {
  const h = setup();
  await h.start();
  expect(h.sent[0]).toEqual({
    type: "authenticate",
    token: "test-token",
    sessionId: "session-1",
  });
  expect(h.audio.startCapture).toHaveBeenCalledTimes(1);
  h.client.stop();
});
test("wrong-turn output is discarded and a matching checked reply is played", async () => {
  const h = setup();
  await h.start();
  await h.event({
    type: "turn.started",
    sessionId: "session-1",
    turnId: "turn-2",
    generation: 2,
  });
  await h.event({
    type: "reply.approved",
    sessionId: "session-1",
    turnId: "turn-1",
    generation: 1,
    audio: "AAA=",
    format: "pcm16",
    sampleRate: 24000,
  });
  expect(h.audio.playApprovedReply).not.toHaveBeenCalled();
  await h.event({
    type: "reply.approved",
    sessionId: "session-1",
    turnId: "turn-2",
    generation: 2,
    audio: "AAA=",
    format: "pcm16",
    sampleRate: 24000,
  });
  expect(h.audio.playApprovedReply).toHaveBeenCalledTimes(1);
  h.client.stop();
});
test("stop suppresses late events and immediately stops capture and playback", async () => {
  const h = setup();
  await h.start();
  const oldHandler = h.socket.onmessage;
  h.client.stop();
  oldHandler?.({
    data: JSON.stringify({
      type: "reply.approved",
      sessionId: "session-1",
      turnId: "turn",
      generation: 1,
      audio: "AAA=",
      format: "pcm16",
      sampleRate: 24000,
    }),
  });
  await h.tick();
  expect(h.audio.playApprovedReply).not.toHaveBeenCalled();
  expect(h.audio.stopCapture).toHaveBeenCalled();
  expect(h.audio.stopPlayback).toHaveBeenCalled();
  expect(h.updates.at(-1)?.state).toBe("stopped");
});
test("unmute waits for server authorization before resuming capture", async () => {
  const h = setup();
  await h.start();
  await h.client.setMuted(true);
  await h.client.setMuted(false);
  expect(h.audio.startCapture).toHaveBeenCalledTimes(1);
  await h.event({ type: "state", state: "listening" });
  expect(h.audio.startCapture).toHaveBeenCalledTimes(2);
  h.client.stop();
});
test("stop during recovery prevents a second attempt or microphone restart", async () => {
  const h = setup();
  let finishPermission: (allowed: boolean) => void = () => {};
  h.audio.requestPermission = jest.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finishPermission = resolve;
      }),
  );
  const recovery = h.client.reconnect();
  await h.tick();
  h.client.stop();
  finishPermission(false);
  await recovery;
  expect(h.audio.requestPermission).toHaveBeenCalledTimes(1);
  expect(h.audio.startCapture).not.toHaveBeenCalled();
  expect(h.updates.at(-1)?.state).toBe("stopped");
});
test("interrupted playback is never acknowledged as a fully heard reply", async () => {
  const h = setup();
  await h.start();
  let finishPlayback: () => void = () => {};
  h.audio.playApprovedReply = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finishPlayback = resolve;
      }),
  );
  await h.event({
    type: "turn.started",
    sessionId: "session-1",
    turnId: "turn-1",
    generation: 1,
  });
  await h.event({
    type: "reply.approved",
    sessionId: "session-1",
    turnId: "turn-1",
    generation: 1,
    audio: "AAA=",
    format: "pcm16",
    sampleRate: 24000,
  });
  h.client.interrupt();
  finishPlayback();
  await h.tick();
  expect(h.sent.some((event) => event.type === "playback.completed")).toBe(
    false,
  );
  h.client.stop();
});

test("duplicate approval and older turn-start events cannot replay a heard reply", async () => {
  const h = setup();
  await h.start();
  await h.event({ type: "turn.started", sessionId: "session-1", turnId: "t", generation: 3 });
  const reply = { type: "reply.approved", sessionId: "session-1", turnId: "t", generation: 3, audio: "AAA=", format: "pcm16", sampleRate: 24000 };
  await h.event(reply);
  await h.event(reply);
  await h.event({ type: "turn.started", sessionId: "session-1", turnId: "old", generation: 2 });
  await h.event({ ...reply, turnId: "old", generation: 2 });
  expect(h.audio.playApprovedReply).toHaveBeenCalledTimes(1);
  h.client.stop();
});

test("a rejected obsolete playback cannot fail the stopped session", async () => {
  const h = setup();
  await h.start();
  let rejectPlayback: (error: Error) => void = () => {};
  h.audio.playApprovedReply = jest.fn(() => new Promise<void>((_resolve, reject) => { rejectPlayback = reject; }));
  await h.event({ type: "turn.started", sessionId: "session-1", turnId: "t", generation: 1 });
  await h.event({ type: "reply.approved", sessionId: "session-1", turnId: "t", generation: 1, audio: "AAA=", format: "pcm16", sampleRate: 24000 });
  h.client.stop();
  rejectPlayback(new Error("late playback failure"));
  await h.tick();
  expect(h.updates.at(-1)?.state).toBe("stopped");
});

test("text transfer stops local capture before the remote request completes", async () => {
  const h = setup();
  await h.start();
  let finish: (response: Response) => void = () => {};
  (h.request as jest.Mock).mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
  const transfer = h.client.handoff();
  expect(h.audio.stopCapture).toHaveBeenCalled();
  expect(h.audio.stopPlayback).toHaveBeenCalled();
  finish({ ok: true, json: async () => ({ sessionId: "text-1", messages: [], expiresAt: Date.now() + 10000 }) } as Response);
  expect((await transfer).sessionId).toBe("text-1");
  expect(h.updates.at(-1)?.state).toBe("stopped");
});

test("stopping cancels an automatically scheduled recovery", async () => {
  const h = setup();
  await h.start();
  jest.useFakeTimers();
  try {
    h.socket.onclose?.();
    expect(h.updates.at(-1)?.state).toBe("reconnecting");
    h.client.stop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.audio.startCapture).toHaveBeenCalledTimes(1);
    expect(h.updates.at(-1)?.state).toBe("stopped");
  } finally { jest.useRealTimers(); }
});
