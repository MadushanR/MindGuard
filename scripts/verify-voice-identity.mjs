import { readFileSync } from "node:fs";
const account = JSON.parse(readFileSync("artifacts/voice-test-account.local.json", "utf8"));
try {
  const response = await fetch("https://cognito-idp.ca-central-1.amazonaws.com/", {
    method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" },
    body: JSON.stringify({ ClientId: "1h724t9mf6h9jen6v3r6upq2pt", AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: account.email, PASSWORD: account.password } }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  const token = result.AuthenticationResult?.AccessToken;
  const code = result.__type?.split("#").at(-1);
  console.log(JSON.stringify({ service: "cognito", status: response.status, authenticated: !!token, code: /^[A-Za-z]+$/.test(code ?? "") ? code : undefined }));
  if (!token) { process.exitCode = 1; }
  else {
    const consent = await fetch("http://localhost:3001/api/voice/consent", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    const record = await consent.json();
    console.log(JSON.stringify({ service: "consent", status: consent.status, allowed: record.allowed, code: record.code }));
    if (!consent.ok) process.exitCode = 1;
  }
} catch { console.error("IDENTITY_OR_CONSENT_PROBE_FAILED"); process.exitCode = 1; }
