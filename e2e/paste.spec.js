import { test, expect } from '@playwright/test';
import zlib from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { openHost } from './snHost.js';

// A decodable PNG of random pixels, stored uncompressed (from the perf spec).
function noisePng(side) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = randomBytes(side * (side * 3 + 1));
  for (let y = 0; y < side; y++) {
    rows[y * (side * 3 + 1)] = 0;
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const URI_LIMIT = 500 * 1024;

test('pasted embedded images follow the limits of an upload', async ({ page }) => {
  test.setTimeout(60000);
  // The recompression alert never fires here: the picture only needs to be
  // smaller, which the browser can do.
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const bigImage = `data:image/png;base64,${noisePng(380).toString('base64')}`;
  const html =
    `<p>kept text</p><img alt="big" src="${bigImage}">` +
    `<img alt="svg" src="data:image/svg+xml;base64,PHN2Zy8+">` +
    `<img alt="remote" src="https://example.com/i.png">`;
  const plugin = await openHost(page, { text: '' });
  await expect(plugin.locator('.milkdown .ProseMirror p').first()).toBeVisible();

  await plugin
    .locator('.milkdown .ProseMirror p')
    .first()
    .evaluate((element, markup) => {
      const transfer = new DataTransfer();
      transfer.setData('text/html', markup);
      transfer.setData('text/plain', 'kept text');
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true })
      );
    }, html);
  await page.waitForTimeout(3000);

  const saved = (await page.evaluate(() => window.logs))
    .filter((entry) => entry.action === 'save-items')
    .map((entry) => entry.text)
    .at(-1);
  expect(saved).toContain('kept text');
  expect(saved).toContain('https://example.com/i.png');
  expect(saved).not.toContain('data:image/svg');
  const images = [...saved.matchAll(/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g)].map(
    (match) => match[0]
  );
  // The pasted picture comes back recompressed under the per image limit,
  // exactly as an upload of the same file would.
  expect(images.length).toBeGreaterThanOrEqual(1);
  for (const image of images) {
    expect(image.length).toBeLessThanOrEqual(URI_LIMIT);
  }
  // One alert: the SVG cannot be stored, as an uploaded one would not be.
  expect(dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('decoded');
});
