import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openHost } from './snHost.js';

/**
 * Performance guard. Measures typing and scrolling on a large note, at full
 * speed and with a 6x CPU throttle (slow mobile WebView), and compares with
 * e2e/perf-baseline.json. Absolute numbers depend on the machine, so the
 * check is relative: a run fails only when it is clearly slower than the
 * baseline recorded on the same machine.
 *
 * Opt-in (PERF=1), and alone: specs running in parallel share the CPU and
 * skew the timings, so the regular e2e run skips it.
 *
 *   PERF=1 PERF_RECORD=1 npx playwright test e2e/perf.spec.js --workers=1   # (re)record
 *   PERF=1 npx playwright test e2e/perf.spec.js --workers=1                 # compare
 */

// Playwright loads the specs as CommonJS here (no "type": "module"), so
// import.meta is unavailable; the path is resolved from the project root.
const BASELINE_FILE = path.resolve('e2e', 'perf-baseline.json');
const ENABLED = process.env.PERF === '1';
const RECORD = process.env.PERF_RECORD === '1';
/** Allowed slowdown over the baseline before the test fails. */
const TOLERANCE = 1.25;
/** Below this many milliseconds, differences are measurement noise. */
const NOISE_MS = 4;

function bigNote() {
  const para =
    'Lorem ipsum dolor sit amet, **consectetur** adipiscing elit, sed do *eiusmod* ' +
    'tempor incididunt ut labore et dolore magna aliqua `code` ut enim.';
  const lines = ['# Large note', ''];
  for (let section = 1; section <= 25; section++) {
    lines.push(`## Section ${section}`, '');
    for (let i = 0; i < 8; i++) {
      lines.push(para, '');
    }
    lines.push('- [ ] task a', '- [x] task b', '', '| K | V |', '| --- | --- |', '| a | 1 |', '');
    if (section % 5 === 0) {
      lines.push('```js', 'const x = 1;', '```', '', '> [!NOTE]', '> callout', '');
    }
  }
  return lines.join('\n');
}

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

async function measure(page, throttle) {
  const plugin = await openHost(page, { text: bigNote(), throttle });
  await plugin.locator('.milkdown .editor h1').first().waitFor({ timeout: 60000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/index.html'));
  await plugin.locator('.milkdown .editor p').nth(3).click();
  await page.keyboard.press('End');

  const typing = await frame.evaluate(async () => {
    const times = [];
    for (let i = 0; i < 60; i++) {
      const start = performance.now();
      document.execCommand('insertText', false, 'x');
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      times.push(performance.now() - start);
    }
    return times.sort((a, b) => a - b);
  });

  const scrolling = await frame.evaluate(async () => {
    const pane = document.querySelector('.crepe-pane');
    const frames = [];
    let last = performance.now();
    for (let i = 0; i < 60; i++) {
      pane.scrollTop += 120;
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const now = performance.now();
      frames.push(now - last);
      last = now;
    }
    return frames.sort((a, b) => a - b);
  });

  const round = (value) => Math.round(value * 10) / 10;
  return {
    typingP50: round(percentile(typing, 0.5)),
    typingP95: round(percentile(typing, 0.95)),
    scrollP50: round(percentile(scrolling, 0.5)),
    scrollP95: round(percentile(scrolling, 0.95)),
  };
}

test.describe('performance', () => {
  // Throttled runs of a large note are slow by design.
  test.setTimeout(180000);
  test.skip(!ENABLED, 'opt-in: run with PERF=1');
  test.skip(!RECORD && !fs.existsSync(BASELINE_FILE), 'no baseline: run with PERF_RECORD=1 first');

  test('typing and scrolling stay within the baseline', async ({ browser }) => {
    const results = {};
    for (const throttle of [1, 6]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      results[`cpu${throttle}x`] = await measure(page, throttle);
      await context.close();
    }
    console.log('perf', JSON.stringify(results));

    if (RECORD) {
      fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(results, null, 2)}\n`);
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    for (const [run, metrics] of Object.entries(results)) {
      for (const [metric, value] of Object.entries(metrics)) {
        // The scroll p95 swings by +-50% between identical runs: logged
        // above for comparison, never asserted.
        if (metric === 'scrollP95') {
          continue;
        }
        const limit = Math.max(baseline[run][metric] * TOLERANCE, baseline[run][metric] + NOISE_MS);
        expect(value, `${run}.${metric} (baseline ${baseline[run][metric]})`).toBeLessThanOrEqual(
          limit
        );
      }
    }
  });
});
