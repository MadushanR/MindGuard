export type SafetyRoute = "PERMITTED" | "FIXED_RESOURCES" | "BLOCKED";
export interface SafetyDecision {
  route: SafetyRoute;
  reasonCode: string;
  policyVersion: string;
}
export interface VoicePolicyRules {
  version: string;
  /** Exact phrases are reviewed configuration; this is not a clinical classifier. */
  fixedResourcePhrases: string[];
  blockedOutputPhrases: string[];
}
export class VoiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export class ConversationSession {
  readonly id: string;
  readonly owner: string;
  readonly expiresAt: number;
  currentTurnId: string | null = null;
  private active = true;
  private generation = 0;
  private muted = false;
  constructor(id: string, owner: string, expiresAt: number) {
    this.id = id;
    this.owner = owner;
    this.expiresAt = expiresAt;
  }
  isActive(now = Date.now()) {
    return this.active && now < this.expiresAt;
  }
  get turnGeneration() {
    return this.generation;
  }
  assertOwner(owner: string) {
    if (owner !== this.owner) throw new VoiceError("WRONG_OWNER");
  }
  beginTurn(turnId: string, now = Date.now()) {
    if (!this.isActive(now) || this.muted)
      throw new VoiceError("SESSION_INACTIVE");
    this.generation++;
    this.currentTurnId = turnId;
    return this.generation;
  }
  isCurrent(turnId: string, generation: number, now = Date.now()) {
    return (
      this.isActive(now) &&
      !this.muted &&
      this.currentTurnId === turnId &&
      generation === this.generation
    );
  }
  cancel() {
    this.generation++;
    this.currentTurnId = null;
  }
  setMuted(muted: boolean) {
    this.cancel();
    this.muted = muted;
  }
  stop() {
    this.cancel();
    this.active = false;
  }
}
export interface ConversationTurn {
  sessionId: string;
  turnId: string;
  transcript: string;
  completed: boolean;
  interrupted: boolean;
}
const normalize = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
export class ConversationSafetyPolicy {
  constructor(private readonly rules: VoicePolicyRules) {
    if (
      !rules ||
      typeof rules.version !== "string" ||
      !rules.version.trim() ||
      ![rules.fixedResourcePhrases, rules.blockedOutputPhrases].every(
        (phrases) =>
          Array.isArray(phrases) &&
          phrases.length > 0 &&
          phrases.every((phrase) => typeof phrase === "string" && normalize(phrase).length > 0),
      )
    )
      throw new VoiceError("POLICY_NOT_CONFIGURED");
  }
  private result(route: SafetyRoute, reasonCode: string): SafetyDecision {
    return { route, reasonCode, policyVersion: this.rules.version };
  }
  validateVoiceTurn(
    session: ConversationSession,
    turn: ConversationTurn,
    generation: number,
    now = Date.now(),
  ) {
    if (
      turn.sessionId !== session.id ||
      !session.isCurrent(turn.turnId, generation, now)
    )
      return this.result("BLOCKED", "STALE_TURN");
    if (
      !turn.completed ||
      turn.interrupted ||
      !turn.transcript.trim() ||
      turn.transcript.length > 8000
    )
      return this.result("BLOCKED", "INVALID_TRANSCRIPT");
    return this.evaluateText(turn.transcript);
  }
  evaluateText(text: string) {
    const value = normalize(text);
    return this.rules.fixedResourcePhrases.some((p) =>
      value.includes(normalize(p)),
    )
      ? this.result("FIXED_RESOURCES", "REVIEWED_RULE_MATCH")
      : this.result("PERMITTED", "INPUT_ALLOWED");
  }
  evaluateReply(text: string) {
    if (!text.trim() || text.length > 8000)
      return this.result("BLOCKED", "INVALID_REPLY");
    return this.rules.blockedOutputPhrases.some((p) =>
      normalize(text).includes(normalize(p)),
    )
      ? this.result("BLOCKED", "OUTPUT_RULE_MATCH")
      : this.result("PERMITTED", "OUTPUT_ALLOWED");
  }
}
export interface ProcessingAccess {
  check(owner: string, expiresAt: number): Promise<void>;
}
export interface CandidateReply {
  audio: string;
  transcript: string;
  responseId: string;
}
export interface ConversationProvider {
  requestApprovedVoiceReply(
    transcript: string,
    context: readonly { role: "user" | "assistant"; content: string }[],
    signal: AbortSignal,
  ): Promise<CandidateReply>;
  cancelPendingReply(): void;
}
/** Authorization is repeated after generation. Candidate audio is never emitted here before approval. */
export async function processVoiceTurn(options: {
  session: ConversationSession;
  generation: number;
  turn: ConversationTurn;
  policy: ConversationSafetyPolicy;
  access: ProcessingAccess;
  provider: ConversationProvider;
  context: readonly { role: "user" | "assistant"; content: string }[];
  signal: AbortSignal;
}) {
  const { session, generation, turn, policy, access, provider, signal } =
    options;
  await access.check(session.owner, session.expiresAt);
  const decision = policy.validateVoiceTurn(session, turn, generation);
  if (decision.route !== "PERMITTED") return { decision };
  const candidate = await provider.requestApprovedVoiceReply(
    turn.transcript,
    options.context,
    signal,
  );
  const outputDecision = policy.evaluateReply(candidate.transcript);
  await access.check(session.owner, session.expiresAt);
  if (signal.aborted || !session.isCurrent(turn.turnId, generation))
    throw new VoiceError("STALE_TURN");
  if (outputDecision.route !== "PERMITTED") return { decision: outputDecision };
  return { decision: outputDecision, candidate };
}
