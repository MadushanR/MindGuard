import type * as AudioAPI from "react-native-audio-api";
import type { VoiceAudioPort } from "./VoiceSessionController";
import { decodePcm16, encodePcm16, SpeechActivity } from "./pcm";

// Native audio sessions are process-wide; a fresh adapter must wait for prior OS cleanup.
let nativeCleanup: Promise<unknown> = Promise.resolve();

export class VoiceAudio implements VoiceAudioPort {
  private api: typeof AudioAPI;
  private recorder: AudioAPI.AudioRecorder | null = null;
  private context: AudioAPI.AudioContext | null = null;
  private playback: AudioAPI.AudioBufferSourceNode | null = null;
  private finishPlayback: (() => void) | null = null;
  private release: Promise<unknown> = Promise.resolve();
  private starting: Promise<unknown> | null = null;
  private interruptions: { remove(): void } | null = null;
  private routes: { remove(): void } | null = null;
  private revision = 0;
  constructor(private readonly failure: (code: string) => void = () => {}) {
    // Load only when voice is requested; the module requires a rebuilt native app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native module must load only when a rebuilt app starts voice.
    this.api = require("react-native-audio-api") as typeof AudioAPI;
  }
  async requestPermission() {
    // Reopening Android's permission activity can background and cancel a live start.
    if ((await this.api.AudioManager.checkRecordingPermissions()) === "Granted") return true;
    return (await this.api.AudioManager.requestRecordingPermissions()) === "Granted";
  }
  async startCapture(onAudio: (value: string) => void, onSpeech: () => void) {
    const revision = this.revision;
    await Promise.all([this.release, nativeCleanup]);
    if (revision !== this.revision) return;
    this.api.AudioManager.observeAudioInterruptions(true);
    this.interruptions = this.api.AudioManager.addSystemEventListener("interruption", (event) => {
      if (event.type === "began" && revision === this.revision) this.failure("AUDIO_FOCUS_LOST");
    });
    this.routes = this.api.AudioManager.addSystemEventListener("routeChange", (event) => {
      if (["OldDeviceUnavailable", "NoSuitableRouteForCategory"].includes(event.reason) && revision === this.revision)
        this.failure("MICROPHONE_DISCONNECTED");
    });
    this.api.AudioManager.setSystemOptions({
      ios: { category: "playAndRecord", mode: "voiceChat", options: ["defaultToSpeaker", "allowBluetoothHFP"] },
      android: { mode: "inCommunication", communicationDevice: "systemDefault" },
    });
    await this.api.AudioManager.setAudioSessionActivity(true);
    if (revision !== this.revision) { await this.api.AudioManager.setAudioSessionActivity(false); return; }
    const context = this.context ?? new this.api.AudioContext({ sampleRate: 24000, androidOutputProfile: "voiceCommunication" });
    this.context = context;
    context.onerror = () => this.failure("AUDIO_FOCUS_LOST");
    await context.resume();
    if (revision !== this.revision) return;
    const recorder = new this.api.AudioRecorder({ androidInputPreset: "voiceCommunication", iosVoiceProcessing: true });
    this.recorder = recorder;
    const detector = new SpeechActivity();
    const result = recorder.onAudioReady({ sampleRate: 24000, bufferLength: 2400, channelCount: 1 }, ({ buffer }) => {
      if (revision !== this.revision || recorder !== this.recorder) return;
      const samples = buffer.getChannelData(0);
      if (detector.accept(samples)) onSpeech();
      onAudio(encodePcm16(samples));
    });
    if (result.status === "error") throw new Error("MICROPHONE_FAILED");
    recorder.onError(() => this.failure("MICROPHONE_DISCONNECTED"));
    const starting = recorder.start();
    this.starting = starting;
    const started = await starting;
    if (this.starting === starting) this.starting = null;
    if (started.status === "error") throw new Error("MICROPHONE_FAILED");
    if (revision !== this.revision) return;
    // File output is deliberately never enabled.
  }
  stopCapture() {
    this.revision++;
    this.interruptions?.remove();
    this.routes?.remove();
    this.interruptions = null;
    this.routes = null;
    this.api.AudioManager.observeAudioInterruptions(false);
    const recorder = this.recorder;
    this.recorder = null;
    recorder?.clearOnAudioReady();
    recorder?.clearOnError();
    const previousRelease = this.release;
    const pendingStart = this.starting;
    this.release = Promise.all([nativeCleanup, previousRelease, Promise.resolve(pendingStart).catch(() => {})])
      .then(() => recorder?.stop()).catch(() => {}).then(() =>
      this.api.AudioManager.setAudioSessionActivity(false),
    ).catch(() => {});
    nativeCleanup = this.release;
  }
  async playApprovedReply(audio: string, sampleRate: number) {
    this.stopPlayback();
    const context = this.context;
    if (!context) throw new Error("AUDIO_PLAYBACK_UNAVAILABLE");
    const samples = decodePcm16(audio);
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    this.playback = source;
    await new Promise<void>((resolve) => {
      this.finishPlayback = resolve;
      source.onended = () => {
        if (this.playback !== source) return;
        source.disconnect();
        this.playback = null;
        this.finishPlayback = null;
        resolve();
      };
      source.start();
    });
  }
  stopPlayback() {
    const source = this.playback;
    this.playback = null;
    if (source) { source.onended = null; source.stop(); source.disconnect(); }
    this.finishPlayback?.();
    this.finishPlayback = null;
  }
  dispose() {
    this.stopCapture();
    this.stopPlayback();
    const context = this.context;
    this.context = null;
    if (context) { context.onerror = null; void context.close().catch(() => {}); }
  }
}
