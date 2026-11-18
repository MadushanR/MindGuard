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

test('chat and voice consent are separate and both close for a deleting account', async () => {
  const access = new CognitoVoiceAccess('https://cognito-idp.ca-central-1.amazonaws.com/synthetic', 'synthetic', 'synthetic');
  const items = new Map([
    ['SECURITY_V1', { document: { status: 'active' } }],
    ['VOICE_CONSENT', { allowed: true, disclosure: 'voice-processing-v1' }],
  ]);
  access.db = {
    async send({ input }) {
      if (input.Item) items.set(input.Item.sk, input.Item);
      else return { Item: items.get(input.Key.sk) };
    },
  };
  assert.equal(await access.consent('account'), true);
  assert.equal(await access.consent('account', 'chat'), false);
  await access.setConsent('account', true, 'chat');
  await access.setConsent('account', false);
  assert.equal(await access.consent('account'), false);
  assert.equal(await access.consent('account', 'chat'), true);

  items.set('SECURITY_V1', { document: { status: 'deleting' } });
  items.set('VOICE_CONSENT', { allowed: true, disclosure: 'voice-processing-v1' });
  await assert.rejects(access.check('account', Date.now() + 60000), { code: 'CONSENT_REQUIRED' });
  await assert.rejects(access.check('account', Date.now() + 60000, 'chat'), { code: 'CONSENT_REQUIRED' });
});
