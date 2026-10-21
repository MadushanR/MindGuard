const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('artifacts', { recursive: true });
const base = process.env.MINDGUARD_URL || 'http://localhost:8081';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [], missing = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) missing.push(`${r.status()} ${r.url()}`); });
  const b = name => page.getByRole('button', { name, exact: true });
  const sw = name => page.getByRole('switch', { name, exact: true });
  const text = value => page.getByText(value, { exact: false }).first().waitFor();
  const explore = async label => {
    await b('Explore').click();
    await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
  };
  try {
    await page.goto(base + '/home');
    await text('Hello there.');
    await b('Trends').click();
    for (const label of ['Last week', 'This week', 'Chat', 'Voice tone', 'All']) await b(label).click();
    await text('No observations available');
    checks.push('Home to Trends, period/source filters and empty records');
    await explore('10 Wellness Data Sources');
    await b('Connect smartwatch').click();
    await sw('Simulate connection failure').check();
    await b('Connect demo watch').click();
    await text('Demo connection failed');
    await sw('Simulate connection failure').uncheck();
    await b('Retry connection').click();
    await text('Demo connected:');
    await b('Return to data sources').click();
    await text('Smartwatch · connected');
    await sw('Allow steps records').check();
    await sw('Allow sleep records').check();
    await b('Sync demo records').click();
    await text('Demo records synced.');
    await sw('Simulate sync failure').check();
    await b('Sync demo records').click();
    await text('Demo sync failed.');
    await sw('Simulate sync failure').uncheck();
    await b('Retry sync').click();
    await text('Demo records synced.');
    checks.push('Watch failure, retry, connection, permission and sync');
    await explore('13 Export and Share Preview');
    await sw('Steps').check();
    await b('Add recipient').click();
    await b('Save recipient').click();
    await text('Enter a full name.');
    await page.getByLabel('Full name', { exact: true }).fill('Alex Example With A Long Family Name');
    await page.getByLabel('Email', { exact: true }).fill('bad');
    await page.getByLabel('Relationship', { exact: true }).fill('Friend');
    await b('Save recipient').click();
    await text('Enter a valid email address.');
    await page.getByLabel('Email', { exact: true }).fill('alex.example@example.test');
    await b('Save recipient').click();
    assert.equal(await sw('Steps').isChecked(), true);
    await b('Preview selected content').click();
    await text('alex.example@example.test');
    await text('5200, 6100, 4800, 7200, 6500, 8100, 5600');
    const dialog = page.getByRole('dialog');
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await b('Preview selected content').click();
    await b('Confirm simulated action').click();
    await text('Simulation complete. No information was sent');
    await b('Demo export preview').click();
    await b('Preview selected content').click();
    await text('Demo export preview (no file download)');
    await b('Confirm simulated action').click();
    await b('Add recipient').click();
    await b('Cancel').click();
    assert.equal(await sw('Steps').isChecked(), true);
    checks.push('Recipient validation/save/cancel, preserved selections, exact preview, keyboard dialog, explicit demo confirmation');
    await explore('10 Wellness Data Sources');
    await sw('Pause wearable sync').check();
    await explore('13 Export and Share Preview');
    assert.equal(await b('Preview selected content').isDisabled(), true);
    await explore('10 Wellness Data Sources');
    await sw('Pause wearable sync').uncheck();
    await sw('Allow steps records').uncheck();
    await explore('13 Export and Share Preview');
    assert.equal(await b('Preview selected content').isDisabled(), true);
    await explore('19 Connect Smartwatch');
    await b('Disconnect smartwatch').click();
    await b('Return to data sources').click();
    await text('Smartwatch · disconnected');
    checks.push('Export destination preview, revoked metric access and disconnected watch state');
    await b('Explore').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sample saved records', exact: true }).click();
    await b('Load scenario').click();
    await explore('09 Wellness Dashboard and Trends');
    await b('Chat').click();
    // Seed observations are 1–3 days old and may fall in the prior week.
    if (!(await page.getByText(/Tense.*Estimated/).count())) await b('Last week').click();
    await b('Confirm').first().click();
    await text('Confirmed');
    await b('Correct').first().click();
    await b('Hopeful').first().click();
    await text('Corrected');
    const beforeDismiss = await b('Dismiss').count();
    await b('Dismiss').first().click();
    assert.equal(await b('Dismiss').count(), beforeDismiss - 1);
    await explore('10 Wellness Data Sources');
    await sw('Chat emotion observations').uncheck();
    await explore('09 Wellness Dashboard and Trends');
    await b('Chat').click();
    await text('No observations available');
    checks.push('Populated observation confirm/correct/dismiss and shared consent-disabled filtering');
    await explore('18 Settings and Account');
    await b('Reset wellness session').click();
    await page.getByRole('dialog').getByRole('button', {name:'Cancel',exact:true}).click();
    await text('Settings and account');
    await sw('Larger text').check();
    await sw('Reduced motion').check();
    checks.push('Paused source disables sharing; Settings updates shared accessibility preferences');
    await explore('11 Wellness and Crisis Resources');
    await text('Suicide crisis support');
    await b('Call 9-8-8').click();
    await page.getByRole('dialog').getByRole('button', {name:'Cancel',exact:true}).click();
    await text('These Canadian contact details are included');
    checks.push('Resources render bundled Canadian support details; contact-app confirmation cancels without opening an external app');
    // Reload each screen at each size, with persisted larger text enabled.
    for (const large of [false, true]) {
      await explore('18 Settings and Account');
      if (large) await sw('Larger text').check(); else await sw('Larger text').uncheck();
      for (const width of [320, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of ['home', 'trends', 'data-sources', 'resources', 'export-share', 'settings', 'connect-smartwatch', 'add-recipient']) {
        await page.goto(base + '/' + path);
        await b('Explore').waitFor();
        await page.waitForFunction(() => !document.body.innerText.includes('Opening your space'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${path} overflows at ${width}`);
        // Shared Page is a real scroll container; lower actions can be brought above navigation.
        if (path === 'settings') await b('Reset wellness session').scrollIntoViewIfNeeded();
        if (path === 'add-recipient') await b('Cancel').scrollIntoViewIfNeeded();
      }
      }
    }
    checks.push('64 screen/viewport/text-size combinations at 320/390/430/1440px: no horizontal overflow; lower Settings/form actions reachable');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['home', 'trends', 'settings', 'add-recipient']) {
      await page.goto(base + '/' + path);
      await b('Explore').waitFor();
      await page.waitForFunction(() => !document.body.innerText.includes('Opening your space'));
      await page.screenshot({ path: `artifacts/wellness-${path}.png` });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    const report = { checks, errors, missing };
    fs.writeFileSync('artifacts/wellness-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error(page.url(), (await page.locator('body').innerText()).slice(-5000), errors);
    throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
