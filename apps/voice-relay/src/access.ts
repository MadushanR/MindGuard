import { createRemoteJWKSet, jwtVerify } from "jose";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { VoiceError } from "@mindguard/voice-core";

export interface Principal {
  owner: string;
  expiresAt: number;
  email?: string;
}
export class CognitoVoiceAccess {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  private keys;
  constructor(
    private readonly issuer: string,
    private readonly clientId: string,
    private readonly table: string,
  ) {
    if (
      !/^https:\/\/cognito-idp\.[a-z0-9-]+\.amazonaws\.com\/[\w-]+$/.test(
        issuer,
      )
    )
      throw new VoiceError("COGNITO_NOT_CONFIGURED");
    this.keys = createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"));
  }
  async authenticate(token: string, allowDeleting = false): Promise<Principal> {
    const { payload } = await jwtVerify(token, this.keys, {
      issuer: this.issuer,
      algorithms: ["RS256"],
    });
    if (
      payload.token_use !== "access" ||
      payload.client_id !== this.clientId ||
      !payload.sub ||
      !payload.exp
    )
      throw new VoiceError("AUTH_REQUIRED");
    // GetUser rejects globally signed-out/deleted Cognito sessions; JWT signature
    // verification alone does not check revocation.
    const user = await this.cognito("GetUser", token);
    const attributes = user.UserAttributes as { Name: string; Value: string }[];
    if (!Array.isArray(attributes) || attributes.find(a => a.Name === "sub")?.Value !== payload.sub)
      throw new VoiceError("AUTH_REQUIRED");
    const email = attributes.find(a => a.Name === "email_verified")?.Value === "true"
      ? attributes.find(a => a.Name === "email")?.Value.toLowerCase() : undefined;
    if (!allowDeleting) {
      const status = await this.db.send(new GetCommand({ TableName: this.table,
        Key: { pk: `USER#${payload.sub}`, sk: "SECURITY_V1" }, ConsistentRead: true }));
      if (status.Item?.document?.status && status.Item.document.status !== "active") throw new VoiceError("AUTH_REQUIRED");
    }
    return { owner: payload.sub, expiresAt: payload.exp * 1000, email };
  }
  async cognito(operation: string, token: string) {
    const endpoint = new URL(this.issuer).origin;
    const response = await fetch(endpoint, { method: "POST", headers: {
      "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${operation}`,
    }, body: JSON.stringify({ AccessToken: token }), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok) {
      const code = typeof result.__type === "string" ? result.__type.split("#").at(-1) : "";
      if (["NotAuthorizedException", "UserNotFoundException"].includes(code)) throw new VoiceError("AUTH_REQUIRED");
      // Cognito throttling commonly uses HTTP 400, not 429. Availability failures
      // must not be interpreted as a revoked identity and sign the account out.
      throw new Error("IDENTITY_UNAVAILABLE");
    }
    return result;
  }
  async consent(owner: string) {
    const account = await this.db.send(new GetCommand({ TableName: this.table,
      Key: { pk: `USER#${owner}`, sk: "SECURITY_V1" }, ConsistentRead: true }));
    if (account.Item?.document?.status && account.Item.document.status !== "active") return false;
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `USER#${owner}`, sk: "VOICE_CONSENT" },
        ConsistentRead: true,
      }),
    );
    return (
      result.Item?.allowed === true &&
      result.Item?.disclosure === "voice-processing-v1"
    );
  }
  async setConsent(owner: string, allowed: boolean) {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `USER#${owner}`,
          sk: "VOICE_CONSENT",
          allowed,
          disclosure: "voice-processing-v1",
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }
  async check(owner: string, expiresAt: number) {
    if (Date.now() >= expiresAt) throw new VoiceError("AUTH_EXPIRED");
    if (!(await this.consent(owner))) throw new VoiceError("CONSENT_REQUIRED");
  }
  async reserveSession(owner: string, dailyLimit: number) {
    const date = new Date().toISOString().slice(0, 10);
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { pk: `USER#${owner}`, sk: `VOICE_USAGE#${date}` },
          UpdateExpression: "SET #ttl = :ttl ADD #count :one",
          ConditionExpression:
            "attribute_not_exists(#count) OR #count < :limit",
          ExpressionAttributeNames: {
            "#count": "sessionCount",
            "#ttl": "expiresAt",
          },
          ExpressionAttributeValues: {
            ":one": 1,
            ":limit": dailyLimit,
            ":ttl": Math.floor(Date.now() / 1000) + 172800,
          },
        }),
      );
    } catch (e) {
      if ((e as Error).name === "ConditionalCheckFailedException")
        throw new VoiceError("ALLOWANCE_EXHAUSTED");
      throw e;
    }
  }
}
