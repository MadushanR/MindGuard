// Real Cognito + DynamoDB through the configured app. Only dedicated synthetic accounts.
// No credential, access token, or request/response body is printed or recorded as a trace.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.MINDGUARD_URL || 'http://localhost:8080';
const accounts = JSON.parse(fs.readFileSync('artifacts/security-test-accounts.local.json', 'utf8'));
const checks = [], errors = [], apiFailures = [], authEvents = [];
const runId = Date.now().toString(36);
let stage = 'launch', browser, pages = [];
const roles = Object.fromEntries(accounts.map(a => [a.role, a]));
const savedCopy = require('../packages/fixtures/security/saved-information.json');
const button = (p, name) => p.getByRole('button', { name, exact: true });
const text = (p, value) => p.getByText(value, { exact: false }).first().waitFor();
async function explore(page, label) {
  // Use product navigation in Docker production exports; Explore is dev-only.
  const destinations = { '12 Trusted Contacts': 'Trusted contacts', '13 Export and Share Preview': 'Export and sharing',
    '14 Shared Information': 'Shared information', '15 Contact Alert Review': 'Contact alert review',
    '16 Privacy and Consent': 'Privacy and consent', '17 Saved Information and Deletion': 'Saved information and deletion',
    '19 Connect Smartwatch': 'Smartwatch' };
  await button(page, 'Settings').first().click();
  await button(page, 'Privacy and consent').waitFor();
  if (await page.getByText('Sign in to manage your account.', { exact: false }).count()) throw new Error('Session lost while opening Settings');
  if (label !== '18 Settings and Account') await button(page, destinations[label]).click();
}
async function login(page, account) {
  await page.goto(base + '/sign-in');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  const authenticated = page.waitForResponse(r => r.url().endsWith('/api/security/snapshot') && r.status() === 200);
  const tokenResponse = page.waitForResponse(r => r.url().includes('cognito-idp.') && r.request().headers()['x-amz-target']?.endsWith('.InitiateAuth'));
  await button(page, 'Sign in').click();
  await authenticated;
  await page.waitForURL('**/home');
  return (await (await tokenResponse).json()).AuthenticationResult.AccessToken;
}
async function consent(page, sharing = true) {
  stage += ':privacy_load';
  await explore(page, '16 Privacy and Consent');
  for (const label of ['Wellness data', 'Save summaries', 'Notifications to contacts']) await page.getByRole('switch', { name: label, exact: true }).check();
  await page.getByRole('switch', { name: 'Sharing', exact: true }).setChecked(sharing);
  await button(page, 'Save preferences').click();
  stage += ':privacy_save';
  await text(page, 'Privacy preferences saved to your account.');
}
(async () => {
  fs.mkdirSync('artifacts/security-demo', { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const aContext = await browser.newContext({ viewport: { width: 430, height: 932 }, reducedMotion: 'reduce', recordVideo: { dir: 'artifacts/security-demo', size: { width: 430, height: 932 } } });
  const bContext = await browser.newContext({ viewport: { width: 430, height: 932 }, reducedMotion: 'reduce', recordVideo: { dir: 'artifacts/security-demo', size: { width: 430, height: 932 } } });
  const a = await aContext.newPage(), b = await bContext.newPage();
  pages = [a, b];
  for (const page of [a, b]) page.on('pageerror', () => errors.push('BROWSER_RUNTIME_ERROR'));
  for (const page of [a, b]) {
    page.on('domcontentloaded', () => authEvents.push('DOCUMENT_LOADED'));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) authEvents.push('NAV ' + new URL(frame.url()).pathname); });
  }
  for (const page of [a, b]) page.on('request', request => {
    if (request.url().includes('/api/security/')) authEvents.push(new URL(request.url()).pathname);
    const operation = request.headers()['x-amz-target'];
    if (operation?.endsWith('.GlobalSignOut')) authEvents.push('CognitoGlobalSignOut');
  });
  for (const page of [a, b]) page.on('response', async response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      const result = await response.json().catch(() => ({}));
      apiFailures.push({ path: new URL(response.url()).pathname, status: response.status(), code: typeof result.code === 'string' ? result.code : 'UNKNOWN' });
    }
  });
  stage = 'recipient_login'; const tokenB = await login(b, roles.recipient); await consent(b);
  await explore(b, '15 Contact Alert Review');
  await b.getByLabel('Allowed sender account email', { exact: true }).waitFor();
  const previousPermission = button(b, 'Remove alert permission for ' + roles.sender.email);
  if (await previousPermission.count()) { await previousPermission.click(); await previousPermission.waitFor({ state: 'hidden' }); }
  stage = 'sender_login'; const tokenA = await login(a, roles.sender); await consent(a);
  const apiBase = (process.env.SECURITY_API_URL || (base.includes(':8081') ? 'http://localhost:3001' : base)) + '/api/security';
  const call = (token, path, method = 'GET', data) => a.request.fetch(apiBase + path, { method, headers: { Authorization: `Bearer ${token}` }, ...(data ? { data } : {}) });
  const prior = await (await call(tokenA, '/snapshot')).json();
  for (const record of prior.outgoing ?? []) if (!record.revoked && record.destination.email === roles.recipient.email && record.recipientName === 'Synthetic recipient') {
    assert.equal((await call(tokenA, `/shares/${record.id}`, 'DELETE')).status(), 200);
  }
  const legacyKeys = ['mindguard.synthetic.v1', 'mindguard.synthetic.recipients.v1', 'mindguard.synthetic.privacy-preferences.v1'];
  const legacy = await a.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), legacyKeys);
  stage = 'trusted_contact';
  await explore(a, '12 Trusted Contacts'); await button(a, 'Add recipient').click();
  await a.getByLabel('Full name', { exact: true }).fill('Synthetic support contact');
  await a.getByLabel('Relationship', { exact: true }).fill('Friend');
  await button(a, 'Save recipient').click(); await text(a, 'Synthetic support contact');
  checks.push('Authenticated trusted contact saved; separate from recipient destinations and alert eligibility');
  stage = 'saved_information';
  await explore(a, '17 Saved Information and Deletion');
  const savedResponse = a.waitForResponse(r => r.url().endsWith('/api/security/snapshot') && r.request().method() === 'GET');
  await button(a, 'Save fictional examples to my account').click();
  await savedResponse;
  await button(a, 'Save fictional examples to my account').click({ trial: true });
  await a.getByRole('checkbox', { name: savedCopy.summaryLabel, exact: true }).waitFor();
  await a.getByRole('checkbox', { name: savedCopy.summaryLabel, exact: true }).uncheck();
  assert.equal(await a.getByRole('checkbox', { name: savedCopy.summaryLabel, exact: true }).isChecked(), false, 'Summary must be unchecked before deletion');
  await button(a, 'Delete selected information').click();
  assert.equal(await a.getByRole('dialog').getByText(savedCopy.summaryLabel, { exact: true }).count(), 0, 'Deletion review must exclude unchecked summary');
  await button(a, 'Confirm delete selected information').click();
  await text(a, 'Selected categories were deleted from your account.');
  await a.getByRole('checkbox', { name: savedCopy.summaryLabel, exact: true }).check({ trial: true });
  assert.equal(await a.getByRole('checkbox', { name: savedCopy.recordsLabel, exact: true }).isDisabled(), true);
  assert.equal(await a.getByRole('checkbox', { name: savedCopy.summaryLabel, exact: true }).isDisabled(), false);
  checks.push('Explicit fictional examples saved to AWS with applicable consent');
  stage = 'watch_source';
  await explore(a, '19 Connect Smartwatch'); await button(a, 'Connect demo watch').click(); await text(a, 'Demo connected:');
  await button(a, 'Return to data sources').click();
  await a.getByRole('switch', { name: 'Allow steps records', exact: true }).check();
  await button(a, 'Sync demo records').click(); await text(a, 'Demo records synced.');
  await explore(a, '13 Export and Share Preview');
  await a.getByRole('switch', { name: 'Steps', exact: true }).check();
  await button(a, 'Add recipient').click();
  await a.getByLabel('Full name', { exact: true }).fill('Synthetic recipient');
  await a.getByLabel('Email', { exact: true }).fill(roles.recipient.email);
  await a.getByLabel('Relationship', { exact: true }).fill('Friend');
  await button(a, 'Save recipient').click();
  stage = 'share_confirm';
  await button(a, 'Preview selected content').click();
  await text(a, roles.recipient.email); await text(a, '5200, 6100, 4800, 7200, 6500, 8100, 5600');
  let committedShare, submittedBody;
  await a.route('**/api/security/shares', async route => {
    submittedBody = route.request().postDataJSON();
    const response = await route.fetch();
    if (response.ok()) { committedShare = await response.json(); await route.abort('failed'); }
    else await route.fulfill({ response });
  });
  await button(a, 'Confirm in-app sharing').click(); await text(a, 'No response from the sharing service');
  await a.unroute('**/api/security/shares');
  await button(a, 'Try again').click(); await text(a, 'In-app access confirmed for');
  checks.push('Exact selected synthetic content and reviewed destination → live create → owner history');
  checks.push('Real server commit with deliberately lost browser response → unknown → same-request status reconciliation');
  assert.equal((await call('', '/snapshot')).status(), 401);
  assert.equal((await call(tokenB, `/shares/${committedShare.id}`, 'DELETE')).status(), 404);
  assert.equal((await (await call(tokenB, `/shares/status/${submittedBody.requestId}`)).json()).share, null);
  assert.equal((await call(tokenA, '/shares', 'POST', { ...submittedBody, destination: { ...submittedBody.destination, name: 'Conflicting destination' } })).status(), 409);
  checks.push('Real server authentication and cross-account revoke/status denial; changed-payload idempotency conflict');
  stage = 'recipient_access';
  await explore(b, '14 Shared Information'); await button(b, 'Refresh shared information').click();
  await text(b, 'From ' + roles.sender.email); await text(b, '5200, 6100, 4800, 7200, 6500, 8100, 5600');
  stage = 'withdraw_new_shares_only';
  await consent(a, false);
  const deniedStatus = (await call(tokenA, '/shares', 'POST', { ...submittedBody, requestId: `denied-${runId}` })).status();
  assert.equal(deniedStatus, 403, `New share after withdrawal must be denied; received HTTP ${deniedStatus}`);
  const repeated = await (await call(tokenA, '/shares', 'POST', submittedBody)).json();
  assert.equal(repeated.id, committedShare.id, 'An identical completed retry must return the original share after consent withdrawal');
  await button(b, 'Refresh shared information').click(); await text(b, 'From ' + roles.sender.email);
  await explore(a, '13 Export and Share Preview'); await button(a, 'Preview selected content').click();
  await text(a, 'Sharing is turned off'); await a.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Consent withdrawal blocks new shares and preserves existing recipient access');
  stage = 'revoke';
  await explore(a, '14 Shared Information');
  await button(a, 'Revoke access for Synthetic recipient').first().click();
  await button(a, 'Confirm revoke access').click(); await text(a, 'In-app access has been revoked.');
  await button(b, 'Refresh shared information').click();
  await text(b, 'No active information shared with you.');
  checks.push('Owner revoke without sharing consent → authoritative recipient access removed');
  stage = 'alert_opt_in';
  await explore(a, '15 Contact Alert Review');
  await a.getByLabel('Recipient account email', { exact: true }).fill(roles.recipient.email);
  const alertMessage = `Synthetic capstone check-in ${runId}.`;
  await a.getByLabel('Your message', { exact: true }).fill(alertMessage);
  await button(a, 'Review alert').click(); await button(a, 'Send alert').click();
  await text(a, 'ALERT_PERMISSION_REQUIRED');
  await a.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await explore(b, '15 Contact Alert Review');
  await b.getByLabel('Allowed sender account email', { exact: true }).fill(roles.sender.email);
  await button(b, 'Allow this sender').click(); await text(b, 'Sender permission saved.');
  await button(a, 'Review alert').click(); await button(a, 'Send alert').click(); await text(a, 'In-app alert confirmed.');
  await button(b, 'Refresh alert inbox').click(); await text(b, alertMessage);
  checks.push('Alert denied before recipient opt-in; confirmed exact in-app alert received after explicit permission');
  stage = 'storage_isolation';
  assert.deepEqual(await a.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), legacyKeys), legacy);
  assert.equal(await a.evaluate(() => Object.values(localStorage).some(v => /AccessToken|RefreshToken|IdToken/.test(v))), false);
  await explore(a, '18 Settings and Account'); await button(a, 'Account deletion information').click();
  await text(a, 'Account deletion is disabled');
  await a.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await button(a, 'Sign out').click(); await button(a, 'Confirm sign out').click();
  await login(a, roles.recipient);
  await explore(a, '12 Trusted Contacts');
  assert.equal(await a.getByText('Synthetic support contact', { exact: true }).count(), 0);
  checks.push('Same-browser account switching hides the previous account contacts');
  for (const larger of [false, true]) {
    await explore(a, '18 Settings and Account');
    await a.getByRole('switch', { name: 'Larger text', exact: true }).setChecked(larger);
    for (const width of [320, 390, 430, 900, 1440]) {
      await a.setViewportSize({ width, height: 932 });
      for (const [screen, title] of [['14 Shared Information', 'Shared information.'], ['15 Contact Alert Review', 'Contact alert review']]) {
        await explore(a, screen); await text(a, title);
        assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Horizontal overflow at ${width}px`);
      }
    }
  }
  checks.push('Live sharing/inbox screens: 20 viewport/text-size combinations without horizontal overflow');
  await explore(a, '18 Settings and Account');
  await a.getByRole('switch', { name: 'Larger text', exact: true }).uncheck();
  await a.setViewportSize({ width: 430, height: 932 });
  checks.push('Legacy synthetic stores preserved; no tokens persisted; account deletion explicitly blocked; shared sign-out');
  assert.deepEqual(errors, []);
  await a.screenshot({ path: 'artifacts/security-demo-complete.png' });
  const demoVideo = a.video();
  const recipientVideo = b.video();
  await aContext.close(); await bContext.close(); await browser.close(); browser = undefined;
  fs.copyFileSync(await demoVideo.path(), 'artifacts/security-integrated-demo.webm');
  fs.copyFileSync(await recipientVideo.path(), 'artifacts/security-recipient-demo.webm');
  const report = { passed: true, checks, errors, nativeAndroid: 'not tested', nativeIOS: 'unverified', accountDeletion: 'disabled by owner pending IAM', demo: 'artifacts/security-integrated-demo.webm', recipientDemo: 'artifacts/security-recipient-demo.webm' };
  fs.writeFileSync('artifacts/security-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(async error => {
  let reason = String(error?.message ?? 'Verification failed').split('\n')[0];
  for (const account of accounts) reason = reason.replaceAll(account.password, '[REDACTED]');
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: `artifacts/security-failure-${i}.png` }).catch(() => {});
    fs.writeFileSync(`artifacts/security-failure-${i}.txt`, await pages[i].locator('body').innerText().catch(() => 'unavailable'));
  }
  const report = { passed: false, stage, checks, errors, reason, apiFailures, authEvents };
  fs.writeFileSync('artifacts/security-verification.json', JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  if (browser) await browser.close(); process.exitCode = 1;
});
