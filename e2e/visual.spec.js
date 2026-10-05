import { test, expect } from '@playwright/test';
import { openHost, hostLogs } from './snHost.js';

const NOTE = ['# Title', '', 'First paragraph.', '', 'Second paragraph with `code`.', ''].join(
  '\n'
);

/** A dark StyleKit palette, as a Standard Notes dark theme would set it. */
const DARK_THEME = `:root {
  --sn-stylekit-background-color: #1e1e1e;
  --sn-stylekit-foreground-color: #e6e6e6;
  --sn-stylekit-editor-background-color: #1e1e1e;
  --sn-stylekit-editor-foreground-color: #e6e6e6;
  --sn-stylekit-contrast-background-color: #2a2a2a;
  --sn-stylekit-contrast-foreground-color: #eeeeee;
  --sn-stylekit-info-color: #4a9eff;
}`;

/** The plugin's own frame, to read computed styles from. */
const pluginFrame = (page) => page.frames().find((frame) => frame.url().includes('/index.html'));

test('the editor follows a dark Standard Notes theme', async ({ page }) => {
  const plugin = await openHost(page, { text: NOTE });
  await expect(plugin.locator('.milkdown .editor h1')).toBeVisible();
  await pluginFrame(page).addStyleTag({ content: DARK_THEME });

  const colors = await pluginFrame(page).evaluate(() => ({
    background: getComputedStyle(document.querySelector('.milkdown')).backgroundColor,
    heading: getComputedStyle(document.querySelector('.milkdown .editor h1')).color,
  }));
  expect(colors.background).toBe('rgb(30, 30, 30)');
  expect(colors.heading).toBe('rgb(230, 230, 230)');
});

test('the block holding the cursor is marked active, without saving', async ({ page }) => {
  const plugin = await openHost(page, { text: NOTE });
  const paragraphs = plugin.locator('.milkdown .editor p');
  await expect(paragraphs.first()).toBeVisible();

  await paragraphs.nth(0).click();
  await expect(paragraphs.nth(0)).toHaveClass(/is-active/);
  await paragraphs.nth(1).click();
  await expect(paragraphs.nth(1)).toHaveClass(/is-active/);
  await expect(paragraphs.nth(0)).not.toHaveClass(/is-active/);
  await expect(plugin.locator('.milkdown .editor .is-active')).toHaveCount(1);

  // The EditorKit coalesces saves for 350 ms; wait past that before asserting.
  await page.waitForTimeout(800);
  expect(await hostLogs(page, 'save-items')).toHaveLength(0);
});

test('task boxes are drawn with the custom icons', async ({ page }) => {
  const plugin = await openHost(page, { text: '- [x] done\n- [ ] open\n' });
  await expect(plugin.locator('.milkdown-list-item-block .label.checked .cb-check')).toHaveCount(1);
  await expect(plugin.locator('.milkdown-list-item-block .label.unchecked .cb-box')).toHaveCount(1);
});
