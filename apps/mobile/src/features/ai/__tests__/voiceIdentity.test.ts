import { CognitoVoiceIdentity } from "../live/identity";

afterEach(() => jest.restoreAllMocks());

test("default browser fetch is invoked without the identity adapter as its receiver", async () => {
  const request = jest.spyOn(globalThis, "fetch").mockImplementation(function (this: unknown) {
    if (this instanceof CognitoVoiceIdentity) throw new TypeError("Illegal invocation");
    return Promise.resolve({ ok: true, json: async () => ({ AuthenticationResult: { AccessToken: "synthetic-token", ExpiresIn: 60 } }) } as Response);
  });
  const before = Date.now();
  const identity = await new CognitoVoiceIdentity().signIn("synthetic@example.invalid", "test-only-password");
  expect(identity.token).toBe("synthetic-token");
  expect(identity.expiresAt).toBeGreaterThanOrEqual(before + 60000);
  const payload = JSON.parse(request.mock.calls[0][1]!.body as string);
  expect(payload.AuthFlow).toBe("USER_PASSWORD_AUTH");
  expect(payload.AuthParameters.USERNAME).toBe("synthetic@example.invalid");
});

test("an unexpected account challenge cannot be mistaken for signed-in access", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ ChallengeName: "NEW_PASSWORD_REQUIRED" }) } as Response);
  await expect(new CognitoVoiceIdentity().signIn("synthetic@example.invalid", "test-only-password")).rejects.toThrow("ACCOUNT_CHALLENGE_REQUIRED");
});

test("Cognito confirmation errors become safe app codes without exposing service messages", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({ __type: "CodeMismatchException", message: "untrusted service detail" }) } as Response);
  await expect(new CognitoVoiceIdentity().confirm("synthetic@example.invalid", "123456")).rejects.toThrow("CONFIRMATION_CODE_INVALID");
});
