import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { SecurityApplication, SecurityError, emptyAccount, securityRouter } from '../dist/security.js';

class MemoryStore {
  accounts = new Map(); directory = new Map();
  async read(owner) { return structuredClone(this.accounts.get(owner) ?? emptyAccount()); }
  async write(changes) {
    if (changes.some(c => (this.accounts.get(c.owner)?.rev ?? 0) !== c.before.rev)) {
      const e = new Error('conflict'); e.name = 'TransactionCanceledException'; throw e;
    }
    for (const c of changes) this.accounts.set(c.owner, structuredClone({ ...c.after, rev: c.before.rev + 1 }));
  }
  async register(email, owner) { this.directory.set(email, owner); }
  async resolve(email) { return this.directory.get(email); }
  async forget(email) { this.directory.delete(email); }
}
const reorderMaps = value => Array.isArray(value) ? value.map(reorderMaps) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorderMaps(v)])) : value;
const granted = { wellnessData: true, saveSummaries: true, sharing: true, contactNotifications: true };
const payload = () => ({ requestId: 'request-1', destination: { id: 'recipient-1', name: 'Recipient Demo', email: 'b@example.test', relationship: 'Friend' },
  content: ['Source: synthetic demo records from demo watch · Synthetic demo week · Monday–Sunday · not live measurements.', 'Steps: 1, 2, 3, 4, 5, 6, 7 steps (Mon–Sun); daily average 4 steps.'] });
async function fixture() {
  const store = new MemoryStore(), service = new SecurityApplication(store);
  for (const owner of ['a', 'b', 'c']) await service.register(owner, `${owner}@example.test`);
  await service.preferences('a', granted);
  return { store, service };
}
test('authorized create → sender history → recipient read → revoke; unrelated account denied', async () => {
  const { service } = await fixture(); const share = await service.createShare('a', payload());
  assert.equal((await service.snapshot('a')).outgoing[0].id, share.id);
  assert.deepEqual((await service.snapshot('b')).incoming[0].content, payload().content);
  assert.deepEqual((await service.snapshot('b')).incoming[0].destination, payload().destination);
  assert.equal((await service.snapshot('c')).incoming.length, 0);
  await assert.rejects(service.revoke('c', share.id), e => e.code === 'NOT_FOUND');
  await service.preferences('a', { ...granted, sharing: false });
  assert.equal((await service.snapshot('b')).incoming.length, 1);
  await service.revoke('a', share.id);
  await service.revoke('a', share.id);
  assert.equal((await service.snapshot('b')).incoming.length, 0);
});
test('server requires both consents; withdrawal races cannot authorize new writes', async () => {
  const { service } = await fixture();
  for (const key of ['sharing', 'wellnessData']) {
    await service.preferences('a', { ...granted, [key]: false });
    await assert.rejects(service.createShare('a', payload()), e => e.code === 'CONSENT_REQUIRED');
  }
  assert.equal((await service.snapshot('b')).incoming.length, 0);
});
test('a consent withdrawal between read and commit wins over an obsolete create', async () => {
  const { service, store } = await fixture();
  const write = store.write.bind(store);
  let intercept = true;
  store.write = async changes => {
    if (intercept && changes.length === 2) {
      intercept = false;
      const current = await store.read('a');
      store.accounts.set('a', { ...current, rev: current.rev + 1, preferences: { ...current.preferences, sharing: false } });
    }
    await write(changes);
  };
  await assert.rejects(service.createShare('a', payload()), e => e.code === 'CONSENT_REQUIRED');
  assert.equal((await service.snapshot('a')).outgoing.length, 0);
  assert.equal((await service.snapshot('b')).incoming.length, 0);
});
test('duplicate concurrent creates are idempotent; changed content/destination conflicts', async () => {
  const { service } = await fixture();
  const shares = await Promise.all([service.createShare('a', payload()), service.createShare('a', payload())]);
  assert.equal(shares[0].id, shares[1].id);
  assert.equal((await service.snapshot('a')).outgoing.length, 1);
  const changed = payload(); changed.destination.name = 'Someone else';
  await assert.rejects(service.createShare('a', changed), e => e.code === 'CONFLICT');
  const changedContent = payload(); changedContent.content[1] = 'Sleep: 1, 2, 3, 4, 5, 6, 7 hours (Mon–Sun); daily average 4.0 hours.';
  await assert.rejects(service.createShare('a', changedContent), e => e.code === 'CONFLICT');
});
test('DynamoDB map ordering cannot turn an identical retry into a conflict', async () => {
  const { service, store } = await fixture();
  const share = await service.createShare('a', payload());
  store.accounts.set('a', reorderMaps(await store.read('a')));
  await service.preferences('a', { ...granted, sharing: false });
  assert.equal((await service.createShare('a', payload())).id, share.id);
  const contact = { id: 'same-contact', name: 'Demo', relationship: 'Friend' };
  await service.contact('a', contact);
  store.accounts.set('a', reorderMaps(await store.read('a')));
  assert.equal((await service.contact('a', contact)).id, contact.id);
});
test('arbitrary content and missing destinations fail closed', async () => {
  const { service } = await fixture();
  await assert.rejects(service.createShare('a', { ...payload(), destination: undefined }), e => e.code === 'INVALID_DESTINATION');
  await assert.rejects(service.createShare('a', { ...payload(), content: ['full conversation'] }), e => e.code === 'INVALID_CONTENT');
});
test('contacts confer no alert eligibility; explicit recipient opt-in and both consents required', async () => {
  const { service } = await fixture();
  await service.contact('a', { id: 'contact-1', name: 'Recipient', relationship: 'Friend' });
  await service.preferences('b', granted);
  const alert = { requestId: 'alert-1', email: 'b@example.test', message: 'Synthetic check-in.' };
  await assert.rejects(service.alert('a', alert), e => e.code === 'ALERT_PERMISSION_REQUIRED');
  await service.alertPermission('b', { email: 'a@example.test', allowed: true });
  await service.alert('a', alert); await service.alert('a', alert);
  assert.equal((await service.snapshot('b')).alerts.length, 1);
  await assert.rejects(service.alert('a', { ...alert, message: 'Changed' }), e => e.code === 'CONFLICT');
  await service.alertPermission('b', { email: 'a@example.test', allowed: false });
  await assert.rejects(service.alert('a', { ...alert, requestId: 'new-alert' }), e => e.code === 'ALERT_PERMISSION_REQUIRED');
});
test('selected category deletion preserves contacts and existing snapshots; deletion blocks reads and cleans linked data', async () => {
  const { service, store } = await fixture();
  await service.contact('a', { id: 'contact-1', name: 'Demo', relationship: 'Friend' });
  const categories = [{ id: 'weekly-summary', label: 'Summary', weekLabel: 'Synthetic', content: ['Fictional example'] }, { id: 'wellness-records', label: 'Records', weekLabel: 'Synthetic', content: ['Fictional daily records'] }];
  await service.saved('a', { categories }); await service.createShare('a', payload());
  await service.saved('a', { categories: ['wellness-records'] }, true);
  const before = await service.snapshot('a');
  assert.equal(before.saved.length, 1); assert.equal(before.contacts.length, 1); assert.equal(before.outgoing.length, 1);
  await service.deleteData('a');
  await assert.rejects(service.snapshot('a'), e => e.code === 'ACCOUNT_DELETING');
  assert.equal((await service.snapshot('b')).incoming.length, 0);
  assert.equal(await store.resolve('a@example.test'), undefined);
  await service.deleteData('a'); // retry after a lost response is safe
});
test('HTTP auth, expired sessions, owner isolation and operation reconciliation', async t => {
  const { service } = await fixture();
  const app = express(); app.use(express.json());
  app.use('/api/security', securityRouter(service, async token => {
    if (!['a','b','c'].includes(token)) throw new SecurityError('AUTH_REQUIRED', 401);
    return { owner: token, email: `${token}@example.test` };
  }, async () => {}, () => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/security`;
  const call = (token, path, method = 'GET', body) => fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await call('', '/snapshot')).status, 401);
  assert.equal((await call('expired', '/snapshot')).status, 401);
  assert.equal((await call('a', '/account', 'DELETE')).status, 409);
  assert.equal((await service.store.read('a')).status, 'active');
  assert.equal((await call('a', '/shares', 'POST', payload())).status, 200);
  assert.ok((await (await call('a', '/shares/status/request-1')).json()).share);
  assert.equal((await (await call('c', '/shares/status/request-1')).json()).share, null);
  const share = (await service.snapshot('a')).outgoing[0];
  assert.equal((await call('b', `/shares/${share.id}`, 'DELETE')).status, 404);
});
