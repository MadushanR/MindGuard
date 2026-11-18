import test from 'node:test';
import assert from 'node:assert/strict';
import { CognitoVoiceAccess } from '../dist/access.js';

test('Cognito throttling is availability failure, while invalidated sessions require authentication', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const access = new CognitoVoiceAccess('https://cognito-idp.ca-central-1.amazonaws.com/synthetic', 'synthetic', 'synthetic');
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ __type: 'TooManyRequestsException' }) });
  await assert.rejects(access.cognito('GetUser', 'synthetic-token'), e => e.message === 'IDENTITY_UNAVAILABLE' && !('code' in e));
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ __type: 'NotAuthorizedException' }) });
  await assert.rejects(access.cognito('GetUser', 'synthetic-token'), e => e.code === 'AUTH_REQUIRED');
});
