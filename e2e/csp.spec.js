import { test, expect } from '@playwright/test';
import { openHost } from './snHost.js';

// See mobile-origin.spec.js: the opaque host may not load localhost.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

// A 1x1 PNG, embedded the way uploaded images are.
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Every part that loads code or styles of its own: KaTeX, Mermaid, a code
// block language and an embedded image.
const NOTE = [
  '# CSP',
  '',
  'Energy $E=mc^2$ inline.',
  '',
  '```mermaid',
  'graph TD',
  '  Start --> Finish',
  '```',
  '',
  '```js',
  'const x = 1;',
  '```',
  '',
  `![pixel](${PIXEL})`,
  '',
].join('\n');

// The built page carries a Content Security Policy; nothing a note draws
// may trip it, in the web host or in the opaque-origin mobile one.
for (const opaqueOrigin of [false, true]) {
  test(`a note with math, a diagram and an image trips no CSP rule${opaqueOrigin ? ', opaque origin' : ''}`, async ({
    page,
  }) => {
    const violations = [];
    page.on('console', (message) => {
      if (/Content Security Policy/.test(message.text())) violations.push(message.text());
    });

    const plugin = await openHost(page, { text: NOTE, opaqueOrigin });

    await expect(plugin.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
    await expect(plugin.locator('.milkdown .editor p .katex')).toBeVisible();
    await expect(plugin.locator('.milkdown-code-block .preview svg')).toBeVisible({
      timeout: 15000,
    });
    await expect(plugin.locator('.milkdown .editor img[src^="data:"]')).toBeVisible();
    expect(violations).toEqual([]);
  });
}
