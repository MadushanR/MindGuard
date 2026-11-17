import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocketServer, WebSocket } from "ws";
import { OpenAIConversationAdapter } from "../dist/realtime.js";

async function harness(t) {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(server, "listening");
  const events = [];
  let peer;
  server.on("connection", (socket) => {
    peer = socket;
    socket.on("message", (raw) => {
      const e = JSON.parse(raw);
      events.push(e);
      if (e.type === "session.update")
        socket.send(JSON.stringify({ type: "session.updated" }));
    });
    socket.send(JSON.stringify({ type: "session.created" }));
  });
  const provider = new OpenAIConversationAdapter(
    {
      key: "test-only",
      model: "test-model",
      transcriptionModel: "test-asr",
      voice: "test-voice",
      timeoutMs: 2000,
      maxAudioBytes: 1000,
    },
    (_url, options) =>
      new WebSocket(`ws://127.0.0.1:${server.address().port}`, options),
  );
  provider.on("failure", () => {});
  await provider.openControlledVoice();
  t.after(() => {
    provider.close();
    for (const s of server.clients) s.terminate();
    server.close();
  });
  const until = async (type) => {
    for (let i = 0; i < 50; i++) {
      const event = events.find((e) => e.type === type);
      if (event) return event;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("Expected " + type);
  };
  return { provider, events, send: (e) => peer.send(JSON.stringify(
    e.type.startsWith("response.output_") ? { item_id: "output-item", output_index: 0, content_index: 0, ...e } : e,
  )), until };
}
test("provider VAD does not automatically generate responses", async (t) => {
  const h = await harness(t);
  const config = (await h.until("session.update")).session;
  assert.equal(config.audio.input.turn_detection.create_response, false);
  assert.equal(config.audio.input.turn_detection.interrupt_response, false);
  assert.equal(
    h.events.some((e) => e.type === "response.create"),
    false,
  );
});

test("abort before response creation cancels the eventual out-of-band response by ID", async (t) => {
  const h = await harness(t);
  const abort = new AbortController();
  const result = h.provider.requestApprovedVoiceReply("checked input", [], abort.signal);
  const rejection = assert.rejects(result, /CANCELLED/);
  const request = await h.until("response.create");
  abort.abort();
  await rejection;
  assert.equal(h.events.some((event) => event.type === "response.cancel"), false);
  h.send({ type: "response.created", response: { id: "obsolete-response", metadata: request.response.metadata } });
  const cancellation = await h.until("response.cancel");
  assert.equal(cancellation.response_id, "obsolete-response");
});
test("candidate audio stays buffered until the matching response completes", async (t) => {
  const h = await harness(t);
  let resolved = false;
  const result = h.provider
    .requestApprovedVoiceReply(
      "checked transcript",
      [],
      new AbortController().signal,
    )
    .then((x) => {
      resolved = true;
      return x;
    });
  const request = await h.until("response.create");
  assert.equal(request.response.conversation, "none");
  assert.equal(request.response.input[0].content[0].text, "checked transcript");
  h.send({
    type: "response.created",
    response: { id: "r", metadata: request.response.metadata },
  });
  h.send({
    type: "response.output_audio.delta",
    response_id: "r",
    delta: Buffer.from([0, 0]).toString("base64"),
  });
  h.send({
    type: "response.output_audio_transcript.delta",
    response_id: "r",
    delta: "Checked reply",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(resolved, false);
  h.send({ type: "response.output_audio.done", response_id: "r" });
  h.send({ type: "response.output_audio_transcript.done", response_id: "r", transcript: "Checked reply" });
  h.send({ type: "response.done", response: { id: "r", status: "completed" } });
  assert.equal((await result).transcript, "Checked reply");
});
test("aborted generation rejects rather than releasing buffered audio", async (t) => {
  const h = await harness(t),
    abort = new AbortController();
  const request = h.provider.requestApprovedVoiceReply(
    "checked",
    [],
    abort.signal,
  );
  const rejected = assert.rejects(request, /CANCELLED/);
  await h.until("response.create");
  abort.abort();
  await rejected;
});

test("transcript deltas without a final matching transcript cannot authorize audio", async (t) => {
  const h = await harness(t);
  const result = h.provider.requestApprovedVoiceReply("checked", [], new AbortController().signal);
  const rejected = assert.rejects(result, /INVALID_PROVIDER_REPLY/);
  const request = await h.until("response.create");
  h.send({ type: "response.created", response: { id: "r", metadata: request.response.metadata } });
  h.send({ type: "response.output_audio.delta", response_id: "r", delta: "AAA=" });
  h.send({ type: "response.output_audio.done", response_id: "r" });
  h.send({ type: "response.output_audio_transcript.delta", response_id: "r", delta: "incomplete text" });
  h.send({ type: "response.done", response: { id: "r", status: "completed" } });
  await rejected;
});

test("audio from one output item cannot be approved with a different item's transcript", async (t) => {
  const h = await harness(t);
  const result = h.provider.requestApprovedVoiceReply("checked", [], new AbortController().signal);
  const rejected = assert.rejects(result, /INVALID_PROVIDER_REPLY/);
  const request = await h.until("response.create");
  h.send({ type: "response.created", response: { id: "r", metadata: request.response.metadata } });
  h.send({ type: "response.output_audio.delta", response_id: "r", item_id: "audio-item", delta: "AAA=" });
  h.send({ type: "response.output_audio_transcript.done", response_id: "r", item_id: "different-item", transcript: "checked text" });
  await rejected;
});
test("missing output transcript cannot produce a valid candidate", async (t) => {
  const h = await harness(t),
    request = h.provider.requestApprovedVoiceReply(
      "checked",
      [],
      new AbortController().signal,
    );
  const rejected = assert.rejects(request, /INVALID_PROVIDER_REPLY/),
    event = await h.until("response.create");
  h.send({
    type: "response.created",
    response: { id: "r", metadata: event.response.metadata },
  });
  h.send({
    type: "response.output_audio.delta",
    response_id: "r",
    delta: Buffer.from([0, 0]).toString("base64"),
  });
  h.send({ type: "response.done", response: { id: "r", status: "completed" } });
  await rejected;
});
