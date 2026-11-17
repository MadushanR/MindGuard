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
  async authenticate(token: string): Promise<Principal> {
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
    return { owner: payload.sub, expiresAt: payload.exp * 1000 };
  }
  async consent(owner: string) {
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
