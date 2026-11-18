import { CognitoVoiceIdentity } from "../../ai/live/identity";

test("signup, email confirmation and recovery reuse the existing Cognito client without a second account system", async () => {
  const request = jest.fn(async () => ({ ok: true, json: async () => ({}) } as Response));
  const identity = new CognitoVoiceIdentity("existing-client", "https://identity.example.invalid", request);
  await identity.signUp(" demo@example.test ", "Synthetic-password!9", "Demo Account");
  await identity.confirm("demo@example.test", " 123456 ");
  await identity.recover(" demo@example.test ");
  await identity.resetPassword("demo@example.test", " 123456 ", "New-synthetic-password!9");
  const calls = request.mock.calls as unknown as [string, RequestInit][];
  expect(calls.map(([, init]) => (init.headers as Record<string, string>)["X-Amz-Target"].split(".").at(-1)))
    .toEqual(["SignUp", "ConfirmSignUp", "ForgotPassword", "ConfirmForgotPassword"]);
  for (const [, init] of calls) expect(JSON.parse(String(init.body)).ClientId).toBe("existing-client");
  expect(JSON.parse(String(calls[0][1].body)).UserAttributes).toContainEqual({ Name: "name", Value: "Demo Account" });
  expect(JSON.parse(String(calls[3][1].body))).toMatchObject({ Username: "demo@example.test", ConfirmationCode: "123456", Password: "New-synthetic-password!9" });
});
test("Cognito invalid/expired confirmation codes reject instead of showing recovery success", async () => {
  const request = jest.fn(async () => ({ ok: false, json: async () => ({ __type: "ExpiredCodeException" }) } as Response));
  const identity = new CognitoVoiceIdentity("existing-client", "https://identity.example.invalid", request);
  await expect(identity.resetPassword("demo@example.test", "123456", "Synthetic-password!9")).rejects.toThrow("CONFIRMATION_CODE_INVALID");
});
