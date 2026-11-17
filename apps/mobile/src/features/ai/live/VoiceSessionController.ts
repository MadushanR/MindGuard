/** Live voice application boundary. Audio and transport implementations are injected. */
export type LiveVoiceState =
  | "ready"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "muted"
  | "reconnecting"
  | "stopped"
  | "error";

export interface VoiceAudioPort {
  requestPermission(): Promise<boolean>;
  startCapture(
    onAudio: (pcm16Base64: string) => void,
    onSpeech: () => void,
  ): Promise<void>;
  stopCapture(): void;
  playApprovedReply(pcm16Base64: string, sampleRate: number): Promise<void>;
  stopPlayback(): void;
  dispose?(): void;
}
export interface VoiceSocket {
  readyState: number;
  bufferedAmount?: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(value: string): void;
  close(): void;
}
export interface VoiceUpdate {
  state: LiveVoiceState;
  microphoneActive: boolean;
  error?: string;
  resourceRoute?: boolean;
  recovered?: boolean;
}
type FetchPort = typeof fetch;
type Turn = { sessionId: string; turnId: string; generation: number };
export interface TextHandoff {
  sessionId: string;
  expiresAt: number;
  messages: { role: "user" | "assistant"; content: string }[];
}

export class VoiceSessionController {
  private socket: VoiceSocket | null = null;
  private sessionId: string | null = null;
  private epoch = 0;
  private recoveryEpoch = 0;
  private currentTurn: Turn | null = null;
  private capturing = false;
  private muted = false;
  private state: LiveVoiceState = "ready";
  private startReject: ((error: Error) => void) | null = null;
  private openingTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryRunning = false;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private latestGeneration = -1;
  private playingTurn: Turn | null = null;
  private capturePending: Promise<void> | null = null;
  private remoteCleanup: Promise<void> = Promise.resolve();
  private contextReset = false;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly audio: VoiceAudioPort,
    private readonly update: (value: VoiceUpdate) => void,
    private readonly request: FetchPort = (input, init) => fetch(input, init),
    private readonly createSocket: (url: string) => VoiceSocket = (url) =>
      new WebSocket(url) as unknown as VoiceSocket,
  ) {}

  private publish(state: LiveVoiceState, extra: Partial<VoiceUpdate> = {}) {
    this.state = state;
    this.update({ state, microphoneActive: this.capturing, recovered: this.contextReset, ...extra });
  }
  private send(event: unknown) {
    if (this.socket?.readyState === 1) {
      if ((this.socket.bufferedAmount ?? 0) > 256000) {
        this.fail("CONNECTION_TOO_SLOW", true);
        return;
      }
      this.socket.send(JSON.stringify(event));
    }
  }
  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }
  private stopAudio() {
    this.capturing = false;
    this.audio.stopCapture();
    this.audio.stopPlayback();
  }
  private fail(code: string, recoverable = false) {
    this.closeSession();
    this.publish(recoverable ? "reconnecting" : "error", { error: code });
    if (recoverable && !this.recoveryRunning) {
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = null;
        void this.reconnect();
      }, 750);
    }
  }

  async start(cancelRecovery = true) {
    if (cancelRecovery) { this.recoveryEpoch++; this.contextReset = false; }
    this.closeSession();
    const epoch = this.epoch;
    this.muted = false;
    this.publish("connecting");
    try {
      if (!(await this.audio.requestPermission()))
        throw new Error("MICROPHONE_PERMISSION_REQUIRED");
      if (epoch !== this.epoch) return;
      await this.remoteCleanup;
      if (epoch !== this.epoch) return;
      const response = await this.request(
        `${this.baseUrl}/api/voice/sessions`,
        {
          method: "POST",
          headers: this.headers(),
          body: "{}",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          typeof result.code === "string" ? result.code : "SESSION_UNAVAILABLE",
        );
      }
      const result = await response.json();
      if (typeof result.sessionId !== "string")
        throw new Error("INVALID_SESSION_RESPONSE");
      if (epoch !== this.epoch) {
        void this.cleanupRemote(result.sessionId);
        return;
      }
      this.sessionId = result.sessionId;
      const wsUrl = `${this.baseUrl.replace(/^http/, "ws")}/api/voice/socket`;
      const socket = this.createSocket(wsUrl);
      this.socket = socket;
      await new Promise<void>((resolve, reject) => {
        this.startReject = reject;
        this.openingTimer = setTimeout(
          () => reject(new Error("SESSION_OPEN_TIMEOUT")),
          20000,
        );
        socket.onopen = () => {
          if (epoch !== this.epoch) return;
          this.send({
            type: "authenticate",
            token: this.token,
            sessionId: this.sessionId,
          });
        };
        socket.onmessage = (event) => {
          if (epoch !== this.epoch) return;
          void this.receive(event.data, epoch)
            .then((ready) => {
              if (ready) {
                if (this.openingTimer) clearTimeout(this.openingTimer);
                this.openingTimer = null;
                this.startReject = null;
                resolve();
              }
            })
            .catch((error: unknown) => {
              if (epoch !== this.epoch) return;
              reject(error);
              this.fail(
                error instanceof Error ? error.message : "VOICE_FAILED",
              );
            });
        };
        socket.onclose = () => {
          if (epoch === this.epoch) this.fail("CONNECTION_CLOSED", true);
        };
        socket.onerror = () => {
          if (epoch === this.epoch) this.fail("CONNECTION_FAILED", true);
        };
      });
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.fail(error instanceof Error ? error.message : "VOICE_FAILED");
    }
  }

  private async capture(epoch: number) {
    if (this.capturing || this.muted || epoch !== this.epoch) return;
    if (this.capturePending) return this.capturePending;
    const pending = this.audio.startCapture(
      (audio) => {
        if (epoch === this.epoch && this.capturing && !this.muted)
          this.send({ type: "audio", audio });
      },
      () => {
        if (
          epoch === this.epoch &&
          ["speaking", "processing"].includes(this.state)
        )
          this.interrupt();
      },
    );
    this.capturePending = pending;
    try { await pending; } finally { if (this.capturePending === pending) this.capturePending = null; }
    if (epoch !== this.epoch) return;
    if (this.muted) {
      this.audio.stopCapture();
      return;
    }
    this.capturing = true;
  }
  private async receive(raw: string, epoch: number): Promise<boolean> {
    const e: unknown = JSON.parse(raw);
    if (!e || typeof e !== "object" || !("type" in e))
      throw new Error("INVALID_SERVER_EVENT");
    const event = e as Record<string, unknown>;
    if (event.type === "session.ready") {
      if (event.sessionId !== this.sessionId) throw new Error("WRONG_SESSION");
      await this.capture(epoch);
      if (epoch === this.epoch) this.publish("listening");
      return true;
    }
    if (event.type === "turn.started") {
      if (
        this.muted ||
        event.sessionId !== this.sessionId ||
        typeof event.turnId !== "string" ||
        !Number.isSafeInteger(event.generation) ||
        (event.generation as number) <= this.latestGeneration
      )
        return false;
      this.audio.stopPlayback();
      this.latestGeneration = event.generation as number;
      this.playingTurn = null;
      if (!this.sessionId) return false;
      this.currentTurn = {
        sessionId: this.sessionId,
        turnId: event.turnId,
        generation: event.generation as number,
      };
      this.publish("listening");
    } else if (event.type === "reply.approved") {
      const turn = this.currentTurn;
      if (
        !turn ||
        this.muted ||
        event.sessionId !== turn.sessionId ||
        event.turnId !== turn.turnId ||
        event.generation !== turn.generation
      )
        return false;
      if (this.playingTurn === turn) return false;
      if (
        typeof event.audio !== "string" ||
        event.audio.length > 2000000 ||
        event.format !== "pcm16" ||
        event.sampleRate !== 24000
      )
        throw new Error("INVALID_APPROVED_AUDIO");
      this.publish("speaking");
      this.playingTurn = turn;
      await this.audio.playApprovedReply(event.audio, event.sampleRate);
      if (epoch !== this.epoch || this.currentTurn !== turn || this.muted)
        return false;
      this.send({ type: "playback.completed", turnId: turn.turnId });
      this.publish("listening");
    } else if (event.type === "state") {
      if (event.state === "processing" && !this.muted)
        this.publish("processing");
      if (event.state === "listening" && !this.muted) {
        await this.capture(epoch);
        if (epoch === this.epoch) this.publish("listening");
      }
      if (event.state === "muted") this.publish("muted");
    } else if (event.type === "error") {
      throw new Error(
        typeof event.code === "string" ? event.code : "VOICE_FAILED",
      );
    } else if (event.type === "route") {
      this.stop();
      this.publish("error", {
        error: "RESPONSE_NOT_PERMITTED",
        resourceRoute: event.route === "FIXED_RESOURCES",
      });
    }
    return false;
  }

  interrupt() {
    const turn = this.currentTurn;
    this.currentTurn = null;
    this.audio.stopPlayback();
    this.send({ type: "interrupt", turnId: turn?.turnId, generation: turn?.generation });
    this.publish(this.muted ? "muted" : "listening");
  }
  async setMuted(muted: boolean) {
    const epoch = this.epoch;
    if (!muted && !(await this.audio.requestPermission())) {
      this.fail("MICROPHONE_PERMISSION_REQUIRED");
      return;
    }
    if (epoch !== this.epoch || !this.sessionId) return;
    this.muted = muted;
    this.currentTurn = null;
    this.stopAudio();
    this.send({ type: "mute", muted });
    this.publish(muted ? "muted" : "connecting");
    // Capture resumes only after the server acknowledges an allowed unmute.
  }
  async reconnect() {
    if (this.recoveryRunning) return;
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    this.recoveryRunning = true;
    const recovery = ++this.recoveryEpoch;
    try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (recovery !== this.recoveryEpoch) return;
      await this.start(false);
      if (recovery !== this.recoveryEpoch) return;
      if (this.state === "listening") {
        this.contextReset = true;
        this.publish("listening");
        return;
      }
    }
    this.fail("RECOVERY_FAILED");
    } finally { this.recoveryRunning = false; }
  }
  async handoff(): Promise<TextHandoff> {
    const id = this.sessionId;
    // Invalidate all late events before waiting for the server transfer.
    this.recoveryEpoch++;
    this.epoch++;
    this.currentTurn = null;
    this.muted = true;
    this.stopAudio();
    if (!id) throw new Error("SESSION_UNAVAILABLE");
    try {
      const response = await this.request(`${this.baseUrl}/api/voice/sessions/${encodeURIComponent(id)}/handoff`, {
        method: "POST", headers: this.headers(), body: "{}", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("TEXT_HANDOFF_UNAVAILABLE");
      return await response.json() as TextHandoff;
    } finally { this.stop(); }
  }
  private async cleanupRemote(id: string) {
    try {
      await this.request(
        `${this.baseUrl}/api/voice/sessions/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: this.headers(),
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      /* Local shutdown remains complete. Server expiry bounds remote cleanup. */
    }
  }
  stop() {
    this.recoveryEpoch++;
    this.closeSession();
  }
  private closeSession() {
    const id = this.sessionId;
    this.epoch++;
    this.sessionId = null;
    this.currentTurn = null;
    this.latestGeneration = -1;
    this.playingTurn = null;
    this.capturePending = null;
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    this.stopAudio();
    this.audio.dispose?.();
    if (this.openingTimer) clearTimeout(this.openingTimer);
    this.openingTimer = null;
    this.startReject?.(new Error("CANCELLED"));
    this.startReject = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === 1)
        socket.send(JSON.stringify({ type: "stop" }));
      socket.close();
    }
    if (id) this.remoteCleanup = this.cleanupRemote(id);
    this.publish("stopped");
  }
}
