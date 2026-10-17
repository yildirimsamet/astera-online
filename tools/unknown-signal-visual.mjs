import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real signal components, deterministic API-shaped scenarios, both viewport sizes. */
export async function verifyUnknownSignal(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const measurements = [];
  try {
    for (const width of process.env.SIGNAL_VISUAL_SMOKE ? [350] : [350, 1280]) for (const language of process.env.SIGNAL_VISUAL_SMOKE ? ['tr'] : ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const url = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const react = resources.find(name => /\/react\.js\?/.test(name));
        const dom = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const fiber = resources.find(name => /\/@react-three_fiber\.js\?/.test(name));
        if (!react || !dom || !fiber) throw new Error('Gallery modules not loaded');
        const [{ default: { createElement: h, useState } }, { default: { createRoot } }, { Canvas },
          { UnknownSignalHud }, { UnknownSignals }, { OwnFleets }, { SignalBoostNote }, { planetView }, { default: i18n }, { serverNow }] = await Promise.all([
          import(react), import(dom), import(fiber), import(url('/src/screens/UnknownSignalHud.tsx')),
          import(url('/src/galaxy/UnknownSignals.tsx')), import(url('/src/galaxy/Fleets.tsx')), import(url('/src/ui/SignalBoostNote.tsx')),
          import(url('/test/fixtures.ts')), import(url('/src/i18n/index.ts')), import(url('/src/lib/clock.ts')),
        ]);
        await i18n.changeLanguage(language);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div'); mount.className = 'v2-shell';
        mount.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center,#101c2c,#040810);--v2-top-h:0px;--v2-dock-h:0px';
        document.body.append(mount);
        const id = '0f5e3c2a-7a39-4a8b-9d6e-1f2a3b4c5d6e';
        const review = { actions: [], labels: { title: i18n.t('unknownSignal.title'), close: i18n.t('sheet.close'), send: i18n.t('unknownSignal.send'), read: i18n.t('unknownSignal.readSignal') } };
        window.__signalReview = review;
        function Review() {
          const [mode, setMode] = useState('map'); const [focusedId, setFocus] = useState(null);
          const [impactAt, setImpactAt] = useState(() => serverNow());
          review.show = next => { setImpactAt(serverNow()); setMode(next); setFocus(next === 'map' || next === 'ambush' ? null : id); };
          const now = serverNow();
          const planet = planetView({ fleet: { DART: 1, PIKE: 1, RAMPART: 1, WARDEN: 1, COURIER: 1 }, buildings: { CORE: 3, SHIPYARD: 1 } }, { deuterium: 1000 });
          const signal = { id, at: { x: 400, y: 0, z: 0 }, status: 'open', appearedAt: new Date(now - 15 * 60_000),
            expiresAt: new Date(now + 45 * 60_000), originPlanetId: planet.planet.id, origin: planet.planet.position,
            fleet: { DART: 1, COURIER: 1 }, damage: null, departAt: null, arriveAt: null,
            returnDepartAt: null, returnAt: null, recalledAt: null, outcome: null, deliveredAt: null };
          if (mode === 'no-warship') planet.fleet = { COURIER: 1 };
          if (mode === 'no-courier') planet.fleet = { DART: 1 };
          if (mode === 'no-ships') { planet.fleet = {}; planet.buildings.SHIPYARD = 0; }
          if (mode === 'no-bay') planet.flight = { used: 3, total: 3 };
          if (mode === 'no-fuel') planet.planet.deuterium = 0;
          if (mode === 'expired') signal.expiresAt = new Date(now - 1000);
          const results = {
            resources: { kind: 'RESOURCES', loot: { alloy: 700, crystal: 200, deuterium: 50 } },
            energy: { kind: 'ENERGY', hours: 2 }, derelict: { kind: 'DERELICT', hull: 'TEMPEST', damageBp: 6000 },
            pirates: { kind: 'PIRATES' }, skin: { kind: 'SKIN', cosmeticId: 'planet-lava' },
          };
          const rewardMode = mode === 'cargo-lost' ? 'resources' : mode === 'derelict-lost' ? 'derelict' : mode === 'ambush' ? 'pirates' : mode;
          if (results[rewardMode] || mode === 'outbound' || mode === 'radiation') {
            signal.status = mode === 'outbound' ? 'outbound' : rewardMode === 'pirates' || mode === 'radiation' ? 'lost' : 'returning';
            signal.departAt = new Date(now - 600_000); signal.arriveAt = mode === 'ambush' ? new Date(impactAt) : new Date(now + (mode === 'outbound' ? 300_000 : -10_000));
            signal.returnDepartAt = signal.arriveAt; signal.returnAt = new Date(now + 300_000); signal.outcome = results[rewardMode] ?? null;
          }
          if (mode === 'cargo-lost') signal.fleet = { DART: 1 };
          if (mode === 'derelict-lost') {
            signal.status = 'done'; signal.deliveredAt = new Date(now); signal.fleet = { DART: 1, COURIER: 1 };
          }
          const boost = mode === 'energy' ? new Date(now + 2 * 3_600_000) : null;
          const action = name => (...args) => { review.actions.push({ name, args }); };
          return h('div', { style: { position: 'absolute', inset: 0 } },
            h(Canvas, { camera: { position: [8, 2, 12], fov: 45 }, frameloop: 'always', onCreated: state => { state.camera.lookAt(8, 0, 0); review.scene = state.scene; } },
              h(UnknownSignals, { signals: [signal], focusedId, onSelect: setFocus }),
              signal.status === 'outbound' && h(OwnFleets, { nodes: [], focusedKey: null, onSelect: action('flight'), pending: [{
                id, kind: 'unknown_signal', leg: 'outbound', targetName: 'UNKNOWN_SIGNAL', arriveAt: signal.arriveAt,
                minutesRemaining: 5, fleet: signal.fleet, path: { from: signal.origin, to: signal.at, departAt: signal.departAt, arriveAt: signal.arriveAt },
              }] })),
            h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
              h(SignalBoostNote, { until: boost, recoveryUntil: boost, now }),
              h('div', { style: { padding: 8 } }, h(UnknownSignalHud, {
                data: { signals: [signal], radar: { level: 0, range: 2700 }, tier: 1 }, planet, worlds: [planet], focusedId,
                onFocus: setFocus, onClose: () => setFocus(null), onOrigin: action('origin'), onSend: action('send'),
                onBuild: action('build'), onSkins: action('skins'), onDetected: action('detected'),
              }))),
          );
        }
        createRoot(mount).render(h(Review));
      }, language);
      const labels = await page.evaluate(() => window.__signalReview.labels);
      await page.locator('[data-unknown-signal-marker]').waitFor();
      const hit = page.getByRole('button', { name: labels.read, exact: true });
      const box = await hit.boundingBox(); assert.equal(box.width, 48); assert.equal(box.height, 48);
      const markerBox = await page.locator('[data-unknown-signal-marker]').boundingBox();
      assert(Math.abs(box.y + box.height / 2 - markerBox.y - markerBox.height / 2) < .5, 'Signal hit centre must equal its projected route endpoint');
      assert.equal(await page.locator('.unknown-signal-wave').first().evaluate(node => getComputedStyle(node).animationDuration), '1.6s');
      await page.screenshot({ path: join(output, `${language}-${width}-map.png`) });
      await hit.click();
      await page.getByRole('dialog', { name: labels.title }).waitFor();
      await page.getByRole('dialog').getByRole('button', { name: labels.send, exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.__signalReview.actions.find(action => action.name === 'send')?.args),
        [await page.locator('[data-unknown-signal-marker]').getAttribute('data-unknown-signal-marker'), 'DART']);
      const scenarios = process.env.SIGNAL_VISUAL_SMOKE ? ['outbound'] : ['tr', 'en'].includes(language)
        ? ['open', 'no-warship', 'no-courier', 'no-ships', 'no-bay', 'no-fuel', 'expired', 'outbound', 'resources', 'cargo-lost', 'energy', 'derelict', 'derelict-lost', 'pirates', 'skin', 'radiation']
        : ['open', 'energy', 'derelict', 'skin'];
      for (const scenario of scenarios) {
        await page.evaluate(scenario => window.__signalReview.show(scenario), scenario);
        await page.waitForTimeout(200);
        const dialog = page.getByRole('dialog', { name: labels.title }); await dialog.waitFor();
        const bounds = await dialog.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        assert(bounds.y >= 0 && bounds.y + bounds.height <= 813);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (['no-warship', 'no-courier', 'no-ships', 'no-bay', 'no-fuel', 'expired'].includes(scenario)) {
          assert(await dialog.getByRole('button', { name: labels.send, exact: true }).isDisabled());
        }
        await page.screenshot({ path: join(output, `${language}-${width}-${scenario}.png`) });
        measurements.push({ language, width, scenario, bounds });
      }
      if (process.env.SIGNAL_VISUAL_SMOKE) {
        await page.getByRole('dialog').getByRole('button', { name: labels.close, exact: true }).click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(output, `${language}-${width}-outbound-route.png`) });
      }
      await page.evaluate(() => window.__signalReview.show('outbound'));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__signalReview.show('ambush'));
      await page.waitForFunction(() => {
        const node = window.__signalReview.scene.getObjectByName('death-star-interception-blast');
        return node?.visible;
      }, undefined, { timeout: 2500 });
      await page.waitForTimeout(200);
      const blast = await page.evaluate(() => {
        const node = window.__signalReview.scene.getObjectByName('death-star-interception-blast');
        return { exists: Boolean(node), visible: node?.visible ?? false };
      });
      assert(blast.exists && blast.visible, 'Pirate ambush must draw the existing interception explosion');
      await page.screenshot({ path: join(output, `${language}-${width}-ambush.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
}
