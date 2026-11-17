// Invoked only by the AWS SDK credential_process provider. Never run this in a visible terminal.
const fs = require("node:fs");
try {
  const credentials = JSON.parse(fs.readFileSync(process.env.VOICE_LOCAL_AWS_CREDENTIALS_FILE || "/run/mindguard-voice/credentials.json", "utf8"));
  if (credentials.Version !== 1 || !credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken ||
      !Number.isFinite(Date.parse(credentials.Expiration)) || Date.parse(credentials.Expiration) <= Date.now())
    throw new Error();
  // This pipe is consumed by the SDK, never by application logs or an HTTP response.
  process.stdout.write(JSON.stringify(credentials));
} catch {
  process.stderr.write("LOCAL_AWS_CREDENTIALS_UNAVAILABLE\n");
  process.exitCode = 1;
}
