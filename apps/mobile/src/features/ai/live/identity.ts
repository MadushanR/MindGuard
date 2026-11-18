export interface VoiceIdentity {
  token: string;
  expiresAt: number;
}
export interface VoiceIdentityPort {
  signIn(email: string, password: string): Promise<VoiceIdentity>;
  signUp(email: string, password: string): Promise<void>;
  confirm(email: string, code: string): Promise<void>;
  signOut(token: string): Promise<void>;
}

/** Replaceable FA3 access adapter; credentials and tokens are never written to storage. */
export class CognitoVoiceIdentity implements VoiceIdentityPort {
  constructor(
    private readonly clientId = "1h724t9mf6h9jen6v3r6upq2pt",
    private readonly endpoint = "https://cognito-idp.ca-central-1.amazonaws.com/",
    private readonly request: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  private async call(operation: string, body: Record<string, unknown>) {
    const response = await this.request(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${operation}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) {
      const code = typeof result.__type === "string" ? result.__type.split("#").at(-1) : "";
      if (code === "UserNotConfirmedException") throw new Error("ACCOUNT_CONFIRMATION_REQUIRED");
      if (code === "InvalidPasswordException") throw new Error("PASSWORD_REQUIREMENTS_NOT_MET");
      if (code === "CodeMismatchException" || code === "ExpiredCodeException") throw new Error("CONFIRMATION_CODE_INVALID");
      throw new Error("VOICE_SIGN_IN_FAILED");
    }
    return result;
  }
  async signIn(email: string, password: string) {
    const result = await this.call("InitiateAuth", {
      ClientId: this.clientId, AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: email.trim(), PASSWORD: password },
    });
    if (result.ChallengeName) throw new Error("ACCOUNT_CHALLENGE_REQUIRED");
    const auth = result.AuthenticationResult;
    if (typeof auth?.AccessToken !== "string" || !Number.isFinite(auth?.ExpiresIn) || auth.ExpiresIn <= 0)
      throw new Error("VOICE_SIGN_IN_FAILED");
    return { token: auth.AccessToken, expiresAt: Date.now() + auth.ExpiresIn * 1000 };
  }
  async signUp(email: string, password: string, name?: string) {
    await this.call("SignUp", { ClientId: this.clientId, Username: email.trim(), Password: password, UserAttributes: [{ Name: "email", Value: email.trim() }, ...(name?.trim() ? [{ Name: "name", Value: name.trim() }] : [])] });
  }
  async confirm(email: string, code: string) {
    await this.call("ConfirmSignUp", { ClientId: this.clientId, Username: email.trim(), ConfirmationCode: code.trim() });
  }
  async recover(email: string) {
    await this.call("ForgotPassword", { ClientId: this.clientId, Username: email.trim() });
  }
  async resetPassword(email: string, code: string, password: string) {
    await this.call("ConfirmForgotPassword", { ClientId: this.clientId, Username: email.trim(), ConfirmationCode: code.trim(), Password: password });
  }
  async signOut(token: string) {
    await this.call("GlobalSignOut", { AccessToken: token });
  }
}
