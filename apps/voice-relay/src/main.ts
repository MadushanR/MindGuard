import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import {
  ConversationSession,
  ConversationSafetyPolicy,
  VoiceError,
  processVoiceTurn,
} from "@mindguard/voice-core";
import { CognitoVoiceAccess, processingDisclosure, type Principal } from "./access.js";
import { OpenAIConversationAdapter } from "./realtime.js";
import { loadApprovedPolicy } from "./policy.js";
import { DynamoSecurityStore, SecurityApplication, SecurityError, securityRouter } from "./security.js";

@Module({})
class VoiceRelayModule {}
const required = [
  "OPENAI_API_KEY",
  "OPENAI_REALTIME_MODEL",
  "OPENAI_TRANSCRIPTION_MODEL",
  "COGNITO_ISSUER",
  "COGNITO_CLIENT_ID",
  "VOICE_TABLE",
  "VOICE_POLICY_FILE",
  "ALLOWED_ORIGINS",
];
const missing = required.filter((k) => !process.env[k]);
const origins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081").split(
  ",",
);
let access: CognitoVoiceAccess | undefined,
  policy: ConversationSafetyPolicy | undefined;
if (!missing.length) {
  if (process.env.VOICE_POLICY_APPROVED !== "true")
    missing.push("VOICE_POLICY_APPROVED");
  else {
    try {
      policy = loadApprovedPolicy(process.env.VOICE_POLICY_FILE!);
      access = new CognitoVoiceAccess(
        process.env.COGNITO_ISSUER!,
        process.env.COGNITO_CLIENT_ID!,
        process.env.VOICE_TABLE!,
      );
    } catch {
      // Keep health available, but never log policy contents or enable protected processing.
      missing.push("VOICE_POLICY_OR_ACCESS_CONFIGURATION");
    }
  }
}
const app = await NestFactory.create(VoiceRelayModule, {
  logger: ["error", "warn"],
});
// Account identity/consent must remain usable without enabling a voice provider.
if (!access && process.env.COGNITO_ISSUER && process.env.COGNITO_CLIENT_ID && process.env.VOICE_TABLE)
  access = new CognitoVoiceAccess(process.env.COGNITO_ISSUER, process.env.COGNITO_CLIENT_ID, process.env.VOICE_TABLE);
app.enableCors({
  origin: origins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
});
app.use(express.json({ limit: "40kb" }));
const api = express.Router();
type AuthRequest = Request & { principal?: Principal };
const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!access || (missing.length && !["/consent", "/chat/consent"].includes(req.path)))
    return res.status(503).json({ code: "SERVICE_NOT_CONFIGURED" });
  const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) return res.status(401).json({ code: "AUTH_REQUIRED" });
  access
    .authenticate(token)
    .then((p) => {
      req.principal = p;
      next();
    })
    .catch(() => res.status(401).json({ code: "AUTH_REQUIRED" }));
};
const sessions = new Map<
  string,
  {
    session: ConversationSession;
    principal: Principal;
    bound: boolean;
    context: { role: "user" | "assistant"; content: string }[];
    shutdown?: () => void;
    kind?: "text" | "chat";
    busy?: boolean;
    chatTurns?: number;
  }
>();
api.get("/health", (_req, res) => res.json({ status: "ok" }));
api.get("/ready", (_req, res) =>
  res
    .status(missing.length ? 503 : 200)
    .json({ ready: !missing.length, missing }),
);
api.use(auth);
api.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
for (const purpose of ["voice", "chat"] as const) {
  const path = purpose === "chat" ? "/chat/consent" : "/consent";
  api.get(path, async (req: AuthRequest, res, next) => {
    try {
      res.json({
        allowed: await access!.consent(req.principal!.owner, purpose),
        disclosure: processingDisclosure[purpose],
      });
    } catch (error) { next(error); }
  });
  api.put(path, async (req: AuthRequest, res, next) => {
    try {
      const { allowed, disclosure } = req.body ?? {};
      if (typeof allowed !== "boolean" || disclosure !== processingDisclosure[purpose])
        return res.status(400).json({ code: "INVALID_CONSENT" });
      const owner = req.principal!.owner;
      await access!.setConsent(owner, allowed, purpose);
      if (!allowed)
        for (const s of sessions.values())
          if (s.principal.owner === owner && (s.kind === "chat") === (purpose === "chat")) {
            s.session.stop();
            s.shutdown?.();
            sessions.delete(s.session.id);
          }
      res.json({ allowed });
    } catch (error) { next(error); }
  });
}
api.post("/sessions", async (req: AuthRequest, res, next) => {
  try {
    if (missing.length || !policy) return res.status(503).json({ code: "SERVICE_NOT_CONFIGURED" });
    const p = req.principal!;
    await access!.check(p.owner, p.expiresAt);
    if (
      [...sessions.values()].some(
        (s) => s.kind !== "chat" && s.principal.owner === p.owner && s.session.isActive(),
      )
    )
      throw new VoiceError("SESSION_ALREADY_ACTIVE");
    if (sessions.size >= Number(process.env.MAX_CONCURRENT_SESSIONS ?? 20))
      throw new VoiceError("CAPACITY_REACHED");
    await access!.reserveSession(
      p.owner,
      Number(process.env.DAILY_SESSION_LIMIT ?? 10),
    );
    const id = randomUUID(),
      expiresAt = Math.min(
        Date.now() + Number(process.env.SESSION_DURATION_MS ?? 600000),
        p.expiresAt,
      );
    const session = new ConversationSession(id, p.owner, expiresAt);
    sessions.set(id, { session, principal: p, bound: false, context: [] });
    res.status(201).json({ sessionId: id, expiresAt });
  } catch (e) {
    next(e);
  }
});
api.post("/chat/sessions", async (req: AuthRequest, res, next) => {
  try {
    const p = req.principal!;
    await access!.check(p.owner, p.expiresAt, "chat");
    await access!.reserveSession(p.owner, Number(process.env.DAILY_SESSION_LIMIT ?? 10), "chat");
    await access!.check(p.owner, p.expiresAt, "chat");
    if (res.destroyed) return;
    if (sessions.size >= Number(process.env.MAX_CONCURRENT_SESSIONS ?? 20))
      throw new VoiceError("CAPACITY_REACHED");
    const id = randomUUID();
    const expiresAt = Math.min(Date.now() + Number(process.env.SESSION_DURATION_MS ?? 600000), p.expiresAt);
    const session = new ConversationSession(id, p.owner, expiresAt);
    sessions.set(id, { session, principal: p, bound: true, context: [], kind: "chat", chatTurns: 0 });
    res.status(201).json({ sessionId: id, expiresAt });
  } catch (error) { next(error); }
});
api.delete("/sessions/:id", async (req: AuthRequest, res, next) => {
  try {
    const s = sessions.get(String(req.params.id));
    if (s) {
      s.session.assertOwner(req.principal!.owner);
      s.session.stop();
      s.shutdown?.();
      sessions.delete(s.session.id);
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
api.post("/sessions/:id/handoff", async (req: AuthRequest, res, next) => {
  try {
    const p = req.principal!, source = sessions.get(String(req.params.id));
    if (!source || source.kind) throw new VoiceError("SESSION_UNAVAILABLE");
    source.session.assertOwner(p.owner);
    await access!.check(p.owner, p.expiresAt);
    if (!source.session.isActive()) throw new VoiceError("SESSION_EXPIRED");
    const id = randomUUID();
    const session = new ConversationSession(id, p.owner, Math.min(source.session.expiresAt, p.expiresAt));
    // Only turns acknowledged as completely heard enter this context.
    const context = source.context.slice(-6).map((message) => ({ ...message }));
    source.shutdown?.();
    source.session.stop();
    sessions.delete(source.session.id);
    sessions.set(id, { session, principal: p, bound: true, context, kind: "text" });
    res.json({ sessionId: id, expiresAt: session.expiresAt, messages: context });
  } catch (error) { next(error); }
});
api.post("/sessions/:id/text", async (req: AuthRequest, res, next) => {
  let provider: OpenAIConversationAdapter | undefined;
  let current: ReturnType<typeof sessions.get>;
  let acquired = false;
  const abort = new AbortController();
  const disconnected = () => {
    if (!res.writableEnded) {
      abort.abort();
      if (acquired) current?.session.cancel();
      provider?.close();
    }
  };
  res.once("close", disconnected);
  try {
    const p = req.principal!;
    current = sessions.get(String(req.params.id));
    if (!current?.kind) throw new VoiceError("SESSION_UNAVAILABLE");
    current.session.assertOwner(p.owner);
    const purpose = current.kind === "chat" ? "chat" : "voice";
    await access!.check(p.owner, p.expiresAt, purpose);
    if (abort.signal.aborted) return;
    if (!current.session.isActive()) throw new VoiceError("SESSION_EXPIRED");
    if (current.busy) throw new VoiceError("TURN_ALREADY_ACTIVE");
    const textInput = req.body?.text;
    if (typeof textInput !== "string" || !textInput.trim() || textInput.length > 8000)
      throw new VoiceError("INVALID_TRANSCRIPT");
    if (current.chatTurns !== undefined) {
      if (current.chatTurns >= 20) throw new VoiceError("CHAT_TURN_LIMIT");
      current.chatTurns++;
    }
    current.busy = true;
    acquired = true;
    const target = current;
    const turnId = randomUUID(), generation = target.session.beginTurn(turnId);
    provider = new OpenAIConversationAdapter({
      key: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_REALTIME_MODEL!,
      transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL!, voice: process.env.OPENAI_VOICE ?? "marin",
      timeoutMs: 30000, maxAudioBytes: 1440000,
    });
    target.shutdown = () => { abort.abort(); target.session.stop(); target.context = []; provider?.close(); sessions.delete(target.session.id); };
    provider.on("failure", () => abort.abort());
    // Keep input safety ahead of the provider connection as well as generation.
    const inputDecision = policy!.validateVoiceTurn(target.session, {
      sessionId: target.session.id, turnId, transcript: textInput, completed: true, interrupted: false,
    }, generation);
    if (inputDecision.route !== "PERMITTED") {
      target.shutdown();
      return res.json({ route: inputDecision.route });
    }
    const modality = purpose === "chat" ? "text" : "audio";
    const adapter = provider;
    await adapter.openControlledVoice(modality);
    const result = await processVoiceTurn({
      session: target.session, generation,
      turn: { sessionId: target.session.id, turnId, transcript: textInput, completed: true, interrupted: false },
      policy: policy!, access: { check: () => access!.check(p.owner, p.expiresAt, purpose) },
      provider: {
        requestApprovedVoiceReply: (text, context, signal) => adapter.requestApprovedVoiceReply(text, context, signal, modality),
        cancelPendingReply: () => adapter.cancelPendingReply(),
      },
      context: target.context, signal: abort.signal,
    });
    if (abort.signal.aborted || !target.session.isCurrent(turnId, generation)) throw new VoiceError("STALE_TURN");
    if (!result.candidate) {
      target.shutdown();
      return res.json({ route: result.decision.route });
    }
    const text = result.candidate.transcript;
    target.context.push({ role: "user", content: textInput }, { role: "assistant", content: text });
    target.context = target.context.slice(-6);
    res.json({ text, sessionId: target.session.id });
  } catch (error) { next(error); }
  finally {
    res.off("close", disconnected);
    if (current && acquired) current.busy = false;
    provider?.close();
  }
});
app.use("/api/voice", api);
if (process.env.COGNITO_ISSUER && process.env.COGNITO_CLIENT_ID && process.env.VOICE_TABLE) {
  const securityAccess = access ?? new CognitoVoiceAccess(process.env.COGNITO_ISSUER, process.env.COGNITO_CLIENT_ID, process.env.VOICE_TABLE);
  const security = new SecurityApplication(new DynamoSecurityStore(process.env.VOICE_TABLE));
  app.use("/api/security", securityRouter(security, async token => {
    try {
      const p = await securityAccess.authenticate(token, true);
      if (!p.email) throw new SecurityError("VERIFIED_EMAIL_REQUIRED", 403);
      return { owner: p.owner, email: p.email };
    } catch (e) {
      if (e instanceof SecurityError) throw e;
      if (e instanceof VoiceError || (e instanceof Error && (e.name.startsWith("JWT") || e.name.startsWith("JWS") || e.name === "JOSEAlgNotAllowed"))) throw new SecurityError("AUTH_REQUIRED", 401);
      throw new SecurityError("IDENTITY_UNAVAILABLE", 503);
    }
  }, async (operation, token) => { await securityAccess.cognito(operation, token); }, owner => {
    for (const s of sessions.values()) if (s.principal.owner === owner) { s.session.stop(); s.shutdown?.(); }
  }, process.env.SECURITY_ACCOUNT_DELETION_ENABLED === "true"));
} else app.use("/api/security", (_req: Request, res: Response) => res.status(503).json({ code: "SERVICE_NOT_CONFIGURED" }));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) =>
  res
    .status(error instanceof VoiceError ? 403 : 503)
    .json({
      code: error instanceof VoiceError ? error.code : "SERVICE_UNAVAILABLE",
    }),
);
await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
const wss = new WebSocketServer({
  server: app.getHttpServer(),
  path: "/api/voice/socket",
  maxPayload: 48 * 1024,
});
wss.on("connection", (ws, request) => {
  if (request.headers.origin && !origins.includes(request.headers.origin)) {
    ws.close(1008);
    return;
  }
  let state: ReturnType<typeof sessions.get>,
    provider: OpenAIConversationAdapter | undefined,
    abort: AbortController | undefined;
  let tokenExpiresAt = 0,
    lastInput = Date.now(),
    frames = 0,
    windowBytes = 0,
    windowAt = Date.now(),
    isMuted = false,
    authenticating = false;
  let turnTimer: ReturnType<typeof setTimeout> | undefined,
    pendingDelivery:
      | {
          turnId: string;
          generation: number;
          transcript: string;
          reply: string;
        }
      | undefined;
  const send = (event: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 4 * 1024 * 1024) {
        ws.close(1008);
        return;
      }
      ws.send(JSON.stringify(event));
    }
  };
  const cancel = () => {
    state?.session.cancel();
    abort?.abort();
    provider?.cancelPendingReply();
    pendingDelivery = undefined;
    if (turnTimer) clearTimeout(turnTimer);
  };
  const stop = () => {
    cancel();
    state?.session.stop();
    provider?.close();
    provider = undefined;
    if (state) {
      state.context = [];
      sessions.delete(state.session.id);
    }
    ws.close(1000);
  };
  const fail = (code: string) => {
    send({ type: "error", code });
    stop();
  };
  const handshake = setTimeout(() => {
    if (!state) ws.close(1008);
  }, 10000);
  const guard = setInterval(() => {
    if (!state) return;
    if (
      !state.session.isActive() ||
      Date.now() > tokenExpiresAt ||
      Date.now() - lastInput > Number(process.env.INACTIVITY_MS ?? 90000)
    ) {
      fail("SESSION_EXPIRED");
      return;
    }
    void access!
      .check(state.principal.owner, tokenExpiresAt)
      .catch(() => fail("ACCESS_REVOKED"));
  }, 3000);
  ws.on("message", async (raw) => {
    try {
      const e = JSON.parse(raw.toString());
      if (!state) {
        if (
          authenticating ||
          e.type !== "authenticate" ||
          typeof e.token !== "string" ||
          typeof e.sessionId !== "string" ||
          !access ||
          !policy
        ) {
          ws.close(1008);
          return;
        }
        authenticating = true;
        const p = await access.authenticate(e.token),
          s = sessions.get(e.sessionId);
        if (!s || s.bound) throw new VoiceError("SESSION_UNAVAILABLE");
        s.session.assertOwner(p.owner);
        await access.check(p.owner, p.expiresAt);
        if (!s.session.isActive()) throw new VoiceError("SESSION_EXPIRED");
        if (ws.readyState !== WebSocket.OPEN) return;
        state = s;
        s.bound = true;
        s.shutdown = stop;
        tokenExpiresAt = p.expiresAt;
        provider = new OpenAIConversationAdapter({
          key: process.env.OPENAI_API_KEY!,
          model: process.env.OPENAI_REALTIME_MODEL!,
          transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL!,
          voice: process.env.OPENAI_VOICE ?? "marin",
          timeoutMs: 30000,
          maxAudioBytes: 1440000,
        });
        provider.on("failure", (code: string) => fail(code));
        provider.on("speech", (itemId: string) => {
          if (!state || isMuted || typeof itemId !== "string") return;
          lastInput = Date.now();
          cancel();
          const generation = state.session.beginTurn(itemId);
          send({
            type: "turn.started",
            sessionId: state.session.id,
            turnId: itemId,
            generation,
          });
          turnTimer = setTimeout(() => fail("TRANSCRIPT_TIMEOUT"), 45000);
        });
        provider.on("speechEnd", () =>
          send({ type: "state", state: "processing" }),
        );
        provider.on(
          "transcript",
          async ({ itemId, text }: { itemId: string; text: string }) => {
            try {
              if (!state || isMuted || state.session.currentTurnId !== itemId)
                return;
              if (turnTimer) clearTimeout(turnTimer);
              // beginTurn is intentionally not called here: only the current speech event creates authority.
              const current = state;
              const generation = current.session.turnGeneration;
              abort = new AbortController();
              const result = await processVoiceTurn({
                session: current.session,
                generation,
                turn: {
                  sessionId: current.session.id,
                  turnId: itemId,
                  transcript: text,
                  completed: true,
                  interrupted: false,
                },
                policy: policy!,
                access: {
                  check: () =>
                    access!.check(current.principal.owner, tokenExpiresAt),
                },
                provider: provider!,
                context: current.context,
                signal: abort.signal,
              });
              if (!current.session.isCurrent(itemId, generation)) return;
              if (!result.candidate) {
                send({
                  type: "route",
                  route: result.decision.route,
                  reason: result.decision.reasonCode,
                });
                stop();
                return;
              }
              pendingDelivery = {
                turnId: itemId,
                generation,
                transcript: text,
                reply: result.candidate.transcript,
              };
              send({
                type: "reply.approved",
                sessionId: current.session.id,
                turnId: itemId,
                generation,
                audio: result.candidate.audio,
                format: "pcm16",
                sampleRate: 24000,
              });
            } catch (error) {
              if (
                error instanceof VoiceError &&
                ["CANCELLED", "STALE_TURN"].includes(error.code)
              )
                return;
              fail(error instanceof VoiceError ? error.code : "TURN_FAILED");
            }
          },
        );
        await provider.openControlledVoice();
        if (ws.readyState !== WebSocket.OPEN) {
          stop();
          return;
        }
        clearTimeout(handshake);
        send({
          type: "session.ready",
          sessionId: s.session.id,
          expiresAt: s.session.expiresAt,
        });
        return;
      }
      if (e.type === "stop") {
        stop();
        return;
      }
      if (e.type === "interrupt") {
        // A delayed interruption must not cancel a newer user utterance or erase its audio prefix.
        if (typeof e.turnId === "string" && Number.isSafeInteger(e.generation) &&
          state.session.isCurrent(e.turnId, e.generation)) cancel();
        return;
      }
      if (e.type === "mute" && typeof e.muted === "boolean") {
        if (!e.muted)
          await access!.check(state.principal.owner, tokenExpiresAt);
        isMuted = e.muted;
        cancel();
        state.session.setMuted(isMuted);
        provider?.clearInput();
        send({ type: "state", state: isMuted ? "muted" : "listening" });
        return;
      }
      if (
        e.type === "playback.completed" &&
        pendingDelivery &&
        e.turnId === pendingDelivery.turnId &&
        state.session.isCurrent(e.turnId, pendingDelivery.generation)
      ) {
        state.context.push(
          { role: "user", content: pendingDelivery.transcript },
          { role: "assistant", content: pendingDelivery.reply },
        );
        state.context = state.context.slice(-6);
        pendingDelivery = undefined;
        send({ type: "state", state: "listening" });
        return;
      }
      if (e.type === "audio" && !isMuted && provider) {
        if (!state.session.isActive() || Date.now() >= tokenExpiresAt)
          throw new VoiceError("SESSION_EXPIRED");
        if (
          typeof e.audio !== "string" ||
          e.audio.length > 32768 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(e.audio)
        )
          throw new VoiceError("INVALID_AUDIO");
        const bytes = Buffer.from(e.audio, "base64");
        if (!bytes.length || bytes.length % 2)
          throw new VoiceError("INVALID_AUDIO");
        if (Date.now() - windowAt > 1000) {
          windowAt = Date.now();
          frames = 0;
          windowBytes = 0;
        }
        windowBytes += bytes.length;
        if (++frames > 80 || windowBytes > 96000)
          throw new VoiceError("RATE_LIMIT");
        provider.append(e.audio);
        return;
      }
      throw new VoiceError("INVALID_EVENT");
    } catch (error) {
      fail(error instanceof VoiceError ? error.code : "INVALID_EVENT");
    }
  });
  ws.once("close", () => {
    clearTimeout(handshake);
    clearInterval(guard);
    stop();
  });
  ws.on("error", () => stop());
});
const sweep = setInterval(() => {
  for (const s of sessions.values())
    if (!s.session.isActive()) {
      s.session.stop();
      s.shutdown?.();
      sessions.delete(s.session.id);
    }
}, 5000);
sweep.unref();
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    for (const s of sessions.values()) s.shutdown?.();
    wss.close();
    void app.close();
  });
