// Run from the repository root, or pipe into Node inside the configured local relay.
// This probe sends no microphone audio or conversation and never prints credentials.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const required = ["OPENAI_API_KEY", "OPENAI_REALTIME_MODEL", "OPENAI_TRANSCRIPTION_MODEL"];
if (required.some((key) => !process.env[key])) {
  console.error("PROVIDER_CONFIGURATION_MISSING");
  process.exitCode = 1;
} else {
  let adapter;
  let closed = false;
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`MODEL_LIST_HTTP_${response.status}`);
    const models = await response.json();
    const available = new Set(models.data?.map((model) => model.id));
    for (const key of required.slice(1)) {
      if (!available.has(process.env[key])) throw new Error(`MODEL_UNAVAILABLE_${key}`);
    }
    console.log("Configured model IDs are listed for this API project.");
    const { OpenAIConversationAdapter } = await import(
      pathToFileURL(resolve("apps/voice-relay/dist/realtime.js")).href
    );
    adapter = new OpenAIConversationAdapter({
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_REALTIME_MODEL,
      transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL,
      voice: process.env.OPENAI_VOICE ?? "marin",
      timeoutMs: 15000,
      maxAudioBytes: 1440000,
    });
    adapter.on("failure", () => {
      if (!closed) process.exitCode = 1;
    });
    await adapter.openControlledVoice();
    console.log("Realtime session configuration was acknowledged; automatic generation is disabled.");
    console.log("No audio or conversation was sent. Transcription, spoken replies and device behavior remain unverified.");
  } catch (error) {
    // Only our known operational codes are safe to print.
    const message = error instanceof Error ? error.message : "";
    console.error(/^(MODEL_LIST_HTTP_\d+|MODEL_UNAVAILABLE_[A-Z_]+|PROVIDER_[A-Z_]+)$/.test(message) ? message : "PROVIDER_PROBE_FAILED");
    process.exitCode = 1;
  } finally {
    closed = true;
    adapter?.close();
  }
}
