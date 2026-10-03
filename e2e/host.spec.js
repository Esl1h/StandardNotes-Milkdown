import { test, expect } from '@playwright/test';
import { openHost, hostLogs } from './snHost.js';

const MARKDOWN_NOTE = [
  '# Notes with Milkdown',
  '',
  'A paragraph with **bold** and *italic*.',
  '',
  '- one',
  '- two',
  '',
  '| Key | Value |',
  '| --- | ----- |',
  '| a | 1 |',
  '',
  '```js',
  'const answer = 42;',
  '```',
  '',
].join('\n');

test('a markdown note renders visually with the top bar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const plugin = await openHost(page, { text: MARKDOWN_NOTE });

  await expect(plugin.locator('.milkdown .editor h1')).toHaveText('Notes with Milkdown');
  await expect(plugin.locator('.milkdown .editor table.children')).toBeVisible();
  // Code fences render through the CodeMirror feature, not as <pre>.
  await expect(plugin.locator('.milkdown .editor .cm-editor')).toBeVisible();
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('opening a note does not save it, editing saves once', async ({ page }) => {
  const plugin = await openHost(page, { text: MARKDOWN_NOTE });
  await expect(plugin.locator('.milkdown .editor h1')).toBeVisible();

  // The EditorKit coalesces saves for 350 ms; wait past that before asserting.
  await page.waitForTimeout(800);
  expect(await hostLogs(page, 'save-items')).toHaveLength(0);

  const content = plugin.locator('.ProseMirror');
  // Click the heading so the caret starts there; End stays on that line
  // (ControlOrMeta+End would jump past the code block).
  await plugin.locator('.milkdown .editor h1').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(1);
  const [save] = await hostLogs(page, 'save-items');
  // The serializer owns the Markdown shape; assert the typed text made it.
  expect(save.text).toContain('Notes with Milkdown!');
});

test('an empty note invites the slash menu', async ({ page }) => {
  const plugin = await openHost(page, { text: '' });
  await plugin.locator('.ProseMirror').click();
  await expect(plugin.locator('.crepe-placeholder')).toHaveAttribute(
    'data-placeholder',
    'Type / for commands'
  );
});

test('undoing an edit saves the restored text', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Title\n\ncontent\n' });
  await expect(plugin.locator('.milkdown .editor h1')).toHaveText('Title');

  await plugin.locator('.milkdown .editor h1').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(1);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(plugin.locator('.milkdown .editor h1')).toHaveText('Title');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(2);
  const saves = await hostLogs(page, 'save-items');
  expect(saves[1].text).toContain('# Title');
  expect(saves[1].text).not.toContain('Title!');
});

test('undo does not bring back the text of the previous note', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Note A\n\ncontent a\n' });
  const content = plugin.locator('.ProseMirror');
  await expect(content).toContainText('content a');

  await content.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' typed');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(1);

  await page.evaluate(() => window.sendNote('n2', '# Note B\n\ncontent b\n'));
  await expect(content).toContainText('content b');

  await content.click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(content).toContainText('content b');
  await expect(content).not.toContainText('content a');
  await page.waitForTimeout(800);
  expect(await hostLogs(page, 'save-items')).toHaveLength(1);
});

test('modes switch panes and the orientation toggles the split', async ({ page }) => {
  const plugin = await openHost(page, { text: MARKDOWN_NOTE });
  await expect(plugin.locator('.milkdown')).toBeVisible();

  // Source only.
  await plugin.getByTitle('Edit the Markdown source only').click();
  await expect(plugin.locator('.source-pane .cm-editor')).toBeVisible();
  await expect(plugin.locator('.milkdown')).toBeHidden();

  // Split: both panes side by side.
  await plugin.getByTitle('Show the source next to the visual editor').click();
  await expect(plugin.locator('.source-pane .cm-editor')).toBeVisible();
  await expect(plugin.locator('.milkdown')).toBeVisible();

  const panes = plugin.locator('.panes');
  await expect(panes).toHaveClass(/orientation-vertical/);
  const source = await plugin.locator('.source-pane').boundingBox();
  const crepe = await plugin.locator('.crepe-pane').boundingBox();
  expect(source.y).toBeCloseTo(crepe.y, 0);
  expect(source.x).toBeLessThan(crepe.x);

  // Stacked.
  await plugin.getByTitle('Panes side by side; click to stack them').click();
  await expect(panes).toHaveClass(/orientation-horizontal/);
  const stackedSource = await plugin.locator('.source-pane').boundingBox();
  const stackedCrepe = await plugin.locator('.crepe-pane').boundingBox();
  expect(stackedSource.y).toBeLessThan(stackedCrepe.y);

  // Back to visual only.
  await plugin.getByTitle('Edit visually, without the Markdown source').click();
  await expect(plugin.locator('.source-pane .cm-editor')).toBeHidden();
  await expect(plugin.locator('.milkdown')).toBeVisible();
});

test('typing in the source pane updates the visual pane', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Title\n' });
  await expect(plugin.locator('.milkdown .editor h1')).toHaveText('Title');

  await plugin.getByTitle('Show the source next to the visual editor').click();
  const source = plugin.locator('.cm-content');
  await source.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n\nFrom the source pane.');

  await expect(plugin.locator('.milkdown .editor p').last()).toHaveText('From the source pane.');
});

test('the top bar hides and moves to the bottom', async ({ page }) => {
  const plugin = await openHost(page, { text: MARKDOWN_NOTE });
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();

  // Off.
  await plugin.getByTitle('Show or hide the fixed formatting bar').click();
  await expect(plugin.locator('.milkdown-top-bar')).toHaveCount(0);

  // Back on, then at the bottom.
  await plugin.getByTitle('Show or hide the fixed formatting bar').click();
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();
  await plugin.getByTitle('The bar sticks to the top; click to move it to the bottom').click();

  const editor = await plugin.locator('.milkdown .editor').boundingBox();
  const bar = await plugin.locator('.milkdown-top-bar').boundingBox();
  expect(bar.y).toBeGreaterThan(editor.y);
});

test('the layout bar hides, leaving only the button to bring it back', async ({ page }) => {
  const plugin = await openHost(page, { text: MARKDOWN_NOTE });
  await expect(plugin.locator('.mode-switcher')).toBeVisible();

  await plugin.getByTitle('Hide the layout bar').click();
  await expect(plugin.locator('.mode-switcher')).toHaveCount(0);
  const pane = await plugin.locator('.crepe-pane').boundingBox();
  expect(pane.y).toBe(0);

  await plugin.getByTitle('Show the layout bar').click();
  await expect(plugin.locator('.mode-switcher')).toBeVisible();
  await expect(plugin.getByTitle('Show the layout bar')).toHaveCount(0);
});

test('the bottom bar sits at the bottom even for a short note', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Short\n' });
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();
  await plugin.getByTitle('The bar sticks to the top; click to move it to the bottom').click();

  const pane = await plugin.locator('.crepe-pane').boundingBox();
  const bar = await plugin.locator('.milkdown-top-bar').boundingBox();
  expect(bar.y + bar.height).toBeCloseTo(pane.y + pane.height, 0);
});

test('the bottom bar stays pinned while a long note scrolls', async ({ page }) => {
  const long = Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n');
  const plugin = await openHost(page, { text: `# Long\n\n${long}\n` });
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();
  await plugin.getByTitle('The bar sticks to the top; click to move it to the bottom').click();

  for (const scroll of [0, 1000]) {
    await plugin.locator('.crepe-pane').evaluate((el, top) => el.scrollTo(0, top), scroll);
    const pane = await plugin.locator('.crepe-pane').boundingBox();
    const bar = await plugin.locator('.milkdown-top-bar').boundingBox();
    expect(bar.y + bar.height).toBeCloseTo(pane.y + pane.height, 0);
  }
});

test('the word count sits in the formatting bar and counts the selection', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Title\n\nOne two three\n' });
  const count = plugin.locator('.milkdown-top-bar .word-count');
  await expect(count).toHaveText('4 words');

  await plugin.locator('.milkdown .editor p').dblclick();
  await expect(count).toHaveText('1 of 4 words');

  await plugin.locator('.milkdown .editor p').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' four');
  await expect(count).toHaveText('5 words');
});

test('the word count falls back to the icon bar', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Title\n\nOne two three\n' });
  await expect(plugin.locator('.milkdown-top-bar .word-count')).toBeVisible();

  await plugin.getByTitle('Show or hide the fixed formatting bar').click();
  await expect(plugin.locator('.mode-switcher .word-count')).toHaveText('4 words');

  await plugin.getByTitle('Show or hide the fixed formatting bar').click();
  await plugin.getByTitle('Edit the Markdown source only').click();
  await expect(plugin.locator('.mode-switcher .word-count')).toHaveText('4 words');

  await plugin.getByTitle('Hide the layout bar').click();
  await expect(plugin.locator('.word-count')).toHaveCount(0);
});

test('the note is copied as Markdown', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const plugin = await openHost(page, { text: '# Title\n\n* starred list\n' });
  await expect(plugin.locator('.milkdown .editor h1')).toBeVisible();

  await plugin.getByTitle('Copy the note as Markdown').click();
  await expect(plugin.getByTitle('Copied')).toBeVisible();
  // The note text as stored, not the serializer's normalized form.
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '# Title\n\n* starred list\n'
  );
});

test('printing shows only the rendered note, unclipped', async ({ page }) => {
  const long = Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n');
  const plugin = await openHost(page, { text: `# Print me\n\n${long}\n` });
  await plugin.getByTitle('Show the source next to the visual editor').click();
  await expect(plugin.locator('.milkdown-top-bar')).toBeVisible();

  const frame = page.frames().find((candidate) => candidate.url().endsWith('/index.html'));
  await frame.evaluate(() => {
    window.print = () => {
      window.printed = true;
    };
  });
  await plugin.getByTitle('Print the note').click();
  expect(await frame.evaluate(() => window.printed)).toBe(true);

  await page.emulateMedia({ media: 'print' });
  for (const hidden of ['.mode-switcher', '.milkdown-top-bar', '.source-pane']) {
    await expect(plugin.locator(hidden)).toBeHidden();
  }
  await expect(plugin.locator('.milkdown .editor h1')).toBeVisible();
  const clipped = await plugin
    .locator('.crepe-pane')
    .evaluate((pane) => pane.scrollHeight > pane.clientHeight + 1);
  expect(clipped).toBe(false);
});

/** A noisy PNG (incompressible), generated in the browser. */
async function noisyPng(page, side) {
  const base64 = await page.evaluate((size) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(size, size);
    for (let i = 0; i < pixels.data.length; i++) {
      pixels.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, side);
  return Buffer.from(base64, 'base64');
}

test('uploaded images are embedded in the note, large ones shrunk', async ({ page }) => {
  const plugin = await openHost(page, { text: '# Photo\n' });
  await plugin.locator('.milkdown .editor h1').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await plugin.locator('.milkdown-slash-menu').getByText('Image', { exact: true }).click();
  const input = plugin.locator('.milkdown-image-block input[type="file"]');
  await expect(input).toHaveCount(1);

  const buffer = await noisyPng(page, 1200);
  expect(buffer.length).toBeGreaterThan(2_000_000);
  await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer });

  const lastSave = async () => {
    const saves = await hostLogs(page, 'save-items');
    return saves.length ? saves[saves.length - 1].text : '';
  };
  await expect.poll(lastSave).toMatch(/\]\((data|blob):/);
  const text = await lastSave();
  expect(text).toMatch(/!\[[^\]]*\]\(data:image\/(webp|jpeg);base64,/);
  expect(text.length).toBeLessThan(520 * 1024);
});

test('math renders with KaTeX, inline and in blocks', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const plugin = await openHost(page, {
    text: '# Math\n\nEnergy $E=mc^2$ inline.\n\n$$\n\\int_0^1 x\\,dx\n$$\n',
  });

  await expect(plugin.locator('.milkdown .editor p .katex')).toBeVisible();
  await expect(plugin.locator('.milkdown-code-block .katex').first()).toBeVisible();
  // Opening a note with math must not rewrite it either.
  await page.waitForTimeout(800);
  expect(await hostLogs(page, 'save-items')).toHaveLength(0);
  expect(pageErrors).toEqual([]);
});

test.describe('narrow screens', () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });

  test('the split stacks with the source on top', async ({ page }) => {
    const plugin = await openHost(page, { text: MARKDOWN_NOTE });

    await plugin.getByTitle('Show the source next to the visual editor').click();
    await expect(plugin.locator('.source-pane .cm-editor')).toBeVisible();
    await expect(plugin.locator('.milkdown')).toBeVisible();

    const source = await plugin.locator('.source-pane').boundingBox();
    const crepe = await plugin.locator('.crepe-pane').boundingBox();
    expect(source.y).toBeLessThan(crepe.y);
    expect(crepe.width).toBeGreaterThan(350);
  });
});
