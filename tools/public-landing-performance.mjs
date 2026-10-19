import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

/** Lab evidence only: 4x CPU, 100 ms latency, 1.6 Mbps download; no real accounts. */
export async function measurePublicLanding(output) {
  const origin = process.env.ASTERA_VISUAL_WEB ?? 'http://localhost:4174';
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', ignoreHTTPSErrors: origin.startsWith('https://127.0.0.1:') });
    await context.route(url => url.origin !== origin, route => route.abort());
    await context.route(url => url.pathname.startsWith('/api/'), route => {
      const isServers = new URL(route.request().url()).pathname === '/api/servers';
      return route.fulfill({ status: isServers ? 200 : 401, contentType: 'application/json', body: JSON.stringify(isServers ? { servers: [] } : { error: 'UNAUTHENTICATED', message: 'Anonymous performance fixture' }) });
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__landingMetrics = { lcpMs: null, cls: 0, longTasks: [], maxEventDurationMs: 0 };
      new PerformanceObserver(list => { for (const item of list.getEntries()) window.__landingMetrics.lcpMs = item.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const item of list.getEntries()) if (!item.hadRecentInput) window.__landingMetrics.cls += item.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const item of list.getEntries()) window.__landingMetrics.longTasks.push(item.duration); }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver(list => { for (const item of list.getEntries()) window.__landingMetrics.maxEventDurationMs = Math.max(window.__landingMetrics.maxEventDurationMs, item.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200000, uploadThroughput: 100000 });
    await page.goto(`${origin}/tr/`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="landing-primary"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('canvas').count(), 0);
    const initial = await page.evaluate(() => ({ ...window.__landingMetrics, resources: performance.getEntriesByType('resource').map(entry => ({ url: entry.name, bytes: entry.encodedBodySize, transfer: entry.transferSize })) }));
    assert.ok(Number.isFinite(initial.lcpMs));
    await page.locator('.landing-faq summary').first().click();
    await page.waitForTimeout(150);
    const interaction = await page.evaluate(() => window.__landingMetrics.maxEventDurationMs);
    await writeFile(`${output}/lab.json`, JSON.stringify({ conditions: { cpuSlowdown: 4, latencyMs: 100, downloadBitsPerSecond: 1600000, viewport: '390x844', api: 'anonymous local fixture', thirdParties: 'blocked' }, ...initial, maxObservedEventDurationMs: interaction, limitations: 'Local lab; event duration is not field INP. No real-device or 75th-percentile CWV claim.' }, null, 2));
    console.log(JSON.stringify({ lcpMs: initial.lcpMs, cls: initial.cls, maxObservedEventDurationMs: interaction }));
  } finally { await browser.close(); }
}
