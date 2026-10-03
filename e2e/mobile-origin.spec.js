import { test, expect } from '@playwright/test';
import { openHost } from './snHost.js';

// The mobile app runs its web UI from a local file inside a WebView, so the
// host origin is "null". An opaque-origin page may not load localhost, where
// the plugin is served in tests; in the app it comes from a public host.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

test('loads the note when the host origin is opaque, as in the mobile app', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const plugin = await openHost(page, {
    text: '# Mobile note\n\n- a\n- b\n',
    opaqueOrigin: true,
  });

  await expect(plugin.locator('.milkdown .editor h1')).toHaveText('Mobile note');
  expect(pageErrors).toEqual([]);
});

test('the note survives a slow (throttled) mobile CPU', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const plugin = await openHost(page, {
    text: '# Throttled note\n',
    throttle: 30,
  });

  await expect(plugin.locator('.milkdown .editor h1')).toHaveText('Throttled note');
  expect(pageErrors).toEqual([]);
});

test('layout preferences survive reopening without localStorage', async ({ page }) => {
  // The opaque origin also blocks localStorage, as in the app's sandbox.
  const plugin = await openHost(page, { text: '# Note\n', opaqueOrigin: true });
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();
  await plugin.getByTitle('The bar sticks to the top; click to move it to the bottom').click();
  await plugin.getByTitle('Show the source next to the visual editor').click();
  const saved = await page.evaluate(() => window.componentData);

  const reopened = await openHost(page, {
    text: '# Note\n',
    opaqueOrigin: true,
    componentData: saved,
  });
  await expect(
    reopened.getByTitle('The bar sticks to the bottom; click to move it to the top')
  ).toBeVisible();
  await expect(reopened.locator('.source-pane')).toBeVisible();
});
