import type { VoiceAudioPort } from "./VoiceSessionController";
import { decodePcm16, encodePcm16, SpeechActivity } from "./pcm";

// Resample on the audio thread into bounded 100ms mono frames. Output is silent.
const processor = `class VoiceCapture extends AudioWorkletProcessor {
  constructor() { super(); this.frame=new Float32Array(2400); this.index=0; this.phase=0; this.sum=0; this.count=0; }
  process(inputs) {
    const channels=inputs[0]; if (!channels?.length) return true;
    for (let i=0;i<channels[0].length;i++) {
      let sample=0; for (const channel of channels) sample+=(channel[i]||0)/channels.length;
      this.sum+=sample; this.count++; this.phase+=24000;
      if (this.phase>=sampleRate) {
        this.phase-=sampleRate; this.frame[this.index++]=this.sum/this.count; this.sum=0; this.count=0;
        if(this.index===2400) { this.port.postMessage(this.frame,[this.frame.buffer]); this.frame=new Float32Array(2400); this.index=0; }
      }
    }
    return true;
  }
} registerProcessor('mindguard-voice-capture',VoiceCapture);`;

export class VoiceAudio implements VoiceAudioPort {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private recorder: AudioWorkletNode | null = null;
  private playback: AudioBufferSourceNode | null = null;
  private finishPlayback: (() => void) | null = null;
  private revision = 0;
  private moduleLoading: Promise<void> | null = null;
  constructor(private readonly failure: (code: string) => void = () => {}) {}

  async requestPermission() {
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error("SECURE_MICROPHONE_UNAVAILABLE");
    const revision = this.revision;
    const context = this.context ?? new AudioContext();
    this.context = context;
    // Begin activation synchronously inside the user's start/unmute gesture.
    const activation = context.resume();
    void activation.catch(() => {});
    try {
      if (!this.stream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (revision !== this.revision) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }
        this.stream = stream;
      }
      await activation;
      return revision === this.revision;
    } catch {
      if (revision === this.revision) this.stopCapture();
      return false;
    }
  }

  async startCapture(onAudio: (value: string) => void, onSpeech: () => void) {
    if (!this.stream && !(await this.requestPermission())) throw new Error("MICROPHONE_PERMISSION_REQUIRED");
    const context = this.context!, stream = this.stream!, revision = this.revision;
    if (!context.audioWorklet) throw new Error("SECURE_MICROPHONE_UNAVAILABLE");
    if (!this.moduleLoading) {
      const url = URL.createObjectURL(new Blob([processor], { type: "application/javascript" }));
      this.moduleLoading = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    }
    await this.moduleLoading;
    if (revision !== this.revision) return;
    const source = context.createMediaStreamSource(stream);
    const recorder = new AudioWorkletNode(context, "mindguard-voice-capture");
    this.source = source;
    this.recorder = recorder;
    const detector = new SpeechActivity();
    recorder.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
      if (revision !== this.revision || recorder !== this.recorder) return;
      if (detector.accept(data)) onSpeech();
      onAudio(encodePcm16(data));
    };
    recorder.onprocessorerror = () => this.failure("MICROPHONE_FAILED");
    stream.getAudioTracks().forEach((track) => { track.onended = () => this.failure("MICROPHONE_DISCONNECTED"); });
    source.connect(recorder);
    recorder.connect(context.destination);
  }

  stopCapture() {
    this.revision++;
    if (this.recorder) {
      this.recorder.port.onmessage = null;
      this.recorder.onprocessorerror = null;
      this.recorder.disconnect();
      this.recorder.port.close();
    }
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    this.stream = null;
    this.source = null;
    this.recorder = null;
  }

  async playApprovedReply(audio: string, sampleRate: number) {
    this.stopPlayback();
    const context = this.context;
    if (!context || context.state !== "running") throw new Error("AUDIO_PLAYBACK_UNAVAILABLE");
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
    this.moduleLoading = null;
    void context?.close().catch(() => {});
  }
}
