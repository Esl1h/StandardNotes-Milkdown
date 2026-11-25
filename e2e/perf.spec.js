import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { openHost } from './snHost.js';

/**
 * Latency benchmark: typing, cursor movement and boot on generated notes,
 * driven through the fake host. Writes perf-results.json and fails when
 * typing in the 50k note goes over the budget.
 *
 * Opt-in and alone, as specs running in parallel share the CPU and skew the
 * timings: `npm run perf`.
 */

const ENABLED = process.env.PERF === '1';
// Playwright loads the specs as CommonJS here, so the path is resolved from
// the project root.
const RESULTS_FILE = path.resolve('perf-results.json');
const KEYS = Number(process.env.PERF_KEYS ?? 200);
const BOOTS = Number(process.env.PERF_BOOTS ?? 5);
const ONLY = process.env.PERF_ONLY?.split(',');

/**
 * What typing in the 50k note may cost, in milliseconds. Timings depend on
 * the machine, so the limits leave about twice what a desktop measures (see
 * ARCHITECTURE.md): room for a CI runner, and still under the 55 ms of main
 * thread per key the editor took before there was a budget.
 */
const BUDGET = { paintP95: 50, cpuPerKey: 40, longestTask: 150 };

/** Deterministic pseudo random numbers, so every run types the same way. */
function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 48271) >>> 0) % 2147483647;
    return state / 2147483647;
  };
}

const PARAGRAPH =
  'Lorem ipsum dolor sit amet, **consectetur** adipiscing elit, sed do *eiusmod* tempor ' +
  'incididunt ut `labore` et [dolore](https://example.com) magna aliqua, see [[Other note]].';

function section(n) {
  const lines = [`## Section ${n}`, '', PARAGRAPH, '', `${PARAGRAPH} Inline math $a_${n}^2$.`, ''];
  lines.push('- first item', '- second item', '  - nested item', '');
  lines.push('- [ ] open task', '- [x] done task', '', `### Detail ${n}`, '', PARAGRAPH, '');
  lines.push('| Key | Value |', '| --- | ----- |', `| a   | ${n}     |`, '| b   | two   |', '');
  if (n % 4 === 1) {
    lines.push('```js', `const value${n} = ${n};`, 'console.log(value);', '```', '');
  }
  if (n % 8 === 2) {
    lines.push('> [!NOTE]', '> A callout.', '');
  }
  return lines.join('\n');
}

/** A note of about `size` characters mixing every block the editor draws. */
function note(size) {
  const parts = [
    '# Benchmark note\n',
    '[TOC]\n',
    '```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n',
    '$$\nE = mc^2\n$$\n',
  ];
  let length = parts.join('\n').length;
  for (let n = 1; length < size; n++) {
    const part = section(n);
    parts.push(part);
    length += part.length + 1;
  }
  return parts.join('\n');
}

/** A decodable PNG of random pixels, stored uncompressed. */
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

/** About 5 MB of embedded images, the most a note may carry. */
function imageNote() {
  const images = Array.from(
    { length: 10 },
    (_, i) => `![image ${i}](data:image/png;base64,${noisePng(350).toString('base64')})`
  );
  return `${note(50_000)}\n\n${images.join('\n\n')}\n`;
}

/** Runs in every frame: when the note arrived and when it was first painted. */
function bootProbe() {
  window.addEventListener('message', (event) => {
    if (event.data?.data?.item && !window.__noteAt) {
      window.__noteAt = performance.now();
    }
  });
  const observer = new MutationObserver(() => {
    if (document.querySelector('.milkdown .ProseMirror[contenteditable="true"] h1')) {
      observer.disconnect();
      requestAnimationFrame(() =>
        setTimeout(() => {
          window.__interactiveAt = performance.now();
        })
      );
    }
  });
  observer.observe(document, { childList: true, subtree: true });
}

/** Runs in the plugin frame: latency of each key, and the long tasks. */
function keyProbe() {
  const probe = { frame: [], paint: [], long: [] };
  const onKey = () => {
    const start = performance.now();
    requestAnimationFrame(() => {
      probe.frame.push(performance.now() - start);
      // A message queued from the frame callback runs after style, layout and
      // paint of that frame.
      const channel = new MessageChannel();
      channel.port1.onmessage = () => probe.paint.push(performance.now() - start);
      channel.port2.postMessage(null);
    });
  };
  window.addEventListener('keydown', onKey, true);
  const observer = new PerformanceObserver((list) =>
    probe.long.push(...list.getEntries().map((entry) => entry.duration))
  );
  observer.observe({ type: 'longtask' });
  window.__takeProbe = () => {
    window.removeEventListener('keydown', onKey, true);
    observer.disconnect();
    return probe;
  };
}

const round = (value) => Math.round(value * 10) / 10;

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]);
}

async function open(browser, text, throttle) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(bootProbe);
  const plugin = await openHost(page, { text, throttle });
  const frame = await (await page.locator('#f').elementHandle()).contentFrame();
  await frame.waitForFunction(() => window.__interactiveAt, null, { timeout: 120000 });
  return { context, page, plugin, frame };
}

/** Presses `keys` one by one and reports latency, long tasks and CPU time. */
async function measureKeys(page, frame, keys) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const cpu = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'TaskDuration').value * 1000;
  };
  const next = random(7);
  await frame.evaluate(keyProbe);
  const before = await cpu();
  for (let i = 0; i < keys.length; i++) {
    await page.keyboard.press(keys[i]);
    // A pause now and then lets the debounced work (serializer, save, word
    // count) run, as it does between words.
    await page.waitForTimeout(i % 20 === 19 ? 450 : 20 + Math.floor(next() * 50));
  }
  await page.waitForTimeout(600);
  const after = await cpu();
  const probe = await frame.evaluate(() => window.__takeProbe());
  expect(probe.paint).toHaveLength(keys.length);
  return {
    keys: keys.length,
    frameP50: percentile(probe.frame, 0.5),
    frameP95: percentile(probe.frame, 0.95),
    paintP50: percentile(probe.paint, 0.5),
    paintP95: percentile(probe.paint, 0.95),
    cpuPerKey: round((after - before) / keys.length),
    longTasks: probe.long.length,
    longestTask: round(Math.max(0, ...probe.long)),
  };
}

const typedKeys = () =>
  Array.from({ length: KEYS }, (_, i) => 'lorem ipsum dolor sit amet '[i % 27]).map((key) =>
    key === ' ' ? 'Space' : key
  );

const arrowKeys = () =>
  Array.from(
    { length: KEYS },
    (_, i) => ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'][Math.floor((i * 4) / KEYS)]
  );

/** Puts the cursor at the end of a paragraph in the middle of the note. */
async function focusMiddle(page, plugin) {
  const paragraphs = plugin.locator('.milkdown .ProseMirror > p');
  const target = paragraphs.nth(Math.floor((await paragraphs.count()) / 2));
  await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await target.click();
  await page.keyboard.press('End');
  // Diagrams, math and the first word count settle before measuring.
  await page.waitForTimeout(1500);
}

async function measureTyping(browser, text, throttle) {
  const { context, page, plugin, frame } = await open(browser, text, throttle);
  await focusMiddle(page, plugin);
  const typing = await measureKeys(page, frame, typedKeys());
  const cursor = await measureKeys(page, frame, arrowKeys());
  await context.close();
  return { typing, cursor };
}

async function measureBoot(browser, text, throttle) {
  const runs = [];
  for (let i = 0; i < BOOTS; i++) {
    const { context, frame } = await open(browser, text, throttle);
    runs.push(
      await frame.evaluate(() => ({
        total: window.__interactiveAt,
        afterNote: window.__interactiveAt - window.__noteAt,
      }))
    );
    await context.close();
  }
  return {
    runs: BOOTS,
    // From the navigation of the plugin frame, and from the note arriving.
    totalP50: percentile(
      runs.map((run) => run.total),
      0.5
    ),
    afterNoteP50: percentile(
      runs.map((run) => run.afterNote),
      0.5
    ),
  };
}

const SCENARIOS = [
  { name: '5k', text: () => note(5_000), throttle: 1 },
  { name: '50k', text: () => note(50_000), throttle: 1 },
  { name: '200k', text: () => note(200_000), throttle: 1 },
  { name: '50k-cpu4x', text: () => note(50_000), throttle: 4 },
  { name: 'images-5MB', text: imageNote, throttle: 1 },
];

test.describe('performance', () => {
  test.setTimeout(900_000);
  test.skip(!ENABLED, 'opt-in: npm run perf');

  test('typing, cursor movement and boot', async ({ browser }) => {
    const results = {
      meta: {
        date: new Date().toISOString(),
        browser: browser.version(),
        cpu: os.cpus()[0]?.model,
        cpus: os.cpus().length,
        keys: KEYS,
      },
      scenarios: {},
    };
    for (const { name, text, throttle } of SCENARIOS) {
      if (ONLY && !ONLY.includes(name)) {
        continue;
      }
      const markdown = text();
      const result = {
        chars: markdown.length,
        cpuThrottle: throttle,
        boot: await measureBoot(browser, markdown, throttle),
        ...(await measureTyping(browser, markdown, throttle)),
      };
      results.scenarios[name] = result;
      for (const part of ['boot', 'typing', 'cursor']) {
        const values = Object.entries(result[part]).map(([key, value]) => `${key}=${value}`);
        console.log(`perf ${name} ${part}: ${values.join(' ')}`);
      }
      // Written after every scenario, so a failure keeps what was measured.
      fs.writeFileSync(RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
    }
    const budgeted = results.scenarios['50k'];
    if (budgeted) {
      for (const [metric, limit] of Object.entries(BUDGET)) {
        expect.soft(budgeted.typing[metric], `50k typing ${metric}`).toBeLessThanOrEqual(limit);
      }
    }
  });
});
