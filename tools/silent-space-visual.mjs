/** Exercises the real modal at 350×812 against explicit UI fixtures; no worlds are moved. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

export async function verifySilentSpace(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: language });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      await page.route('**/silent-space-visual', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const { SilentSpaceNotice } = await import('/src/shell/SilentSpaceNotice.tsx');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css');
await i18n.changeLanguage('${language}');
function Demo() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState({ placement: { playerId: 'visual-commander', version: 1, role: 'WAITING' }, homeShard: 'EU-1', canApply: true, application: null });
  return React.createElement('main', { style: { minHeight: '100vh', padding: 16, background: 'radial-gradient(ellipse at top, #1b283d, #060a11)' } },
    React.createElement('button', { onClick: () => setOpen(true), className: 'slab px-3 py-2' }, i18n.t('silentSpace.menu')),
    React.createElement(SilentSpaceNotice, { data, open, allowAutomatic: true, onClose: () => setOpen(false), onApply: async () => {
      if (window.failApplication) throw new Error('offline');
      setData({ ...data, application: { id: 'visual-application', position: 2 } });
    }}));
}
createRoot(document.getElementById('root')).render(React.createElement(Demo));
</script></body></html>` }));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/silent-space-visual`);
      const modal = page.getByRole('dialog');
      await modal.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const measure = async () => {
        const box = await modal.boundingBox();
        if (!box || box.x < 0 || box.x + box.width > 350 || box.y < 0 || box.y + box.height > 812) throw new Error('Modal exceeds the phone viewport');
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow');
      };
      await measure();
      await page.screenshot({ path: `${out}/${language}-notice.png` });
      await page.getByRole('button', { name: language === 'tr' ? 'Oynamaya devam et' : 'Keep playing' }).click();
      await modal.waitFor({ state: 'hidden' });
      await page.reload();
      await page.getByRole('button', { name: language === 'tr' ? 'Sessiz Uzay' : 'Silent Space', exact: true }).waitFor();
      if (await modal.count()) throw new Error('Acknowledged placement reopened after reload');
      await page.getByRole('button', { name: language === 'tr' ? 'Sessiz Uzay' : 'Silent Space', exact: true }).click();
      await modal.waitFor();
      const apply = page.getByRole('button', { name: language === 'tr' ? 'Dönüş başvurusu yap' : 'Apply to return' });
      await page.evaluate(() => { window.failApplication = true; });
      await apply.click();
      await page.getByRole('alert').waitFor();
      await measure();
      await page.screenshot({ path: `${out}/${language}-error.png` });
      await page.evaluate(() => { window.failApplication = false; });
      await apply.click();
      await page.getByRole('status').waitFor();
      await measure();
      await page.screenshot({ path: `${out}/${language}-queued.png` });
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`${language}: notice, dismissal, reopen, error and queued verified at 350×812`);
      await page.close();
      await verifyLocks(browser, out, language);
    }
  } finally { await browser.close(); }
}

/**
 * D212: the two new surfaces of the waiting room. A MAIN commander's amber Now line in the
 * last twelve hours (and the timers sheet under it), and a launch rail that is closed in
 * Silent Space and says why before it is pressed. Fixtures only; no commander is created.
 */
async function verifyLocks(browser, out, language) {
  const page = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: language });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.route('**/silent-space-locks-visual', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const { NowLine } = await import('/src/v2/hud/NowLine.tsx');
const { nowEntries } = await import('/src/lib/nowLine.ts');
const { PirateFocus } = await import('/src/galaxy/FocusPanel.tsx');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css');
await i18n.changeLanguage('${language}');
const now = Date.now();
const entries = nowEntries({ now, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null,
  silentSpaceAt: new Date(now + 5 * 3600_000 + 12 * 60_000) });
const pirate = { id: 'mJtQH0vR5cP8sN2xK7dL4A', callsign: 'mJtQ', zone: 'IDENTIFIED', at: { x: 100, y: 0, z: 0 },
  expiresInMinutes: 180, reachMinutes: 12, reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
  level: 3, fleet: { DART: 2 }, damageMult: 1, mass: 'MEDIUM' };
function Demo() {
  const [open, setOpen] = React.useState(false);
  return React.createElement('main', { style: { minHeight: '100vh', background: 'radial-gradient(ellipse at top, #1b283d, #060a11)' } },
    React.createElement(NowLine, { entries, now, open, onOpen: () => setOpen(true), onClose: () => setOpen(false) }),
    React.createElement('div', { style: { position: 'fixed', left: 0, right: 0, bottom: 0 } },
      React.createElement(PirateFocus, { pirate, fleetAtHome: { DART: 10 }, launchBlock: 'SILENT_SPACE', raiding: false,
        onClose: () => {}, onAttack: () => { window.attacked = true; }, open: true, onToggle: () => {} })));
}
createRoot(document.getElementById('root')).render(React.createElement(Demo));
</script></body></html>` }));
  await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/silent-space-locks-visual`);
  const line = page.locator('[data-now-line]');
  await line.waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (await line.getAttribute('data-tone') !== 'warn') throw new Error('The departure timer is not amber');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow');
  const locked = page.getByRole('button', { name: language === 'tr' ? 'Sessiz Uzay’da kapalı — dönünce açılır' : 'Closed in Silent Space — return to use it' });
  await locked.waitFor();
  if (await locked.isEnabled()) throw new Error('The pirate raid stays pressable in Silent Space');
  const box = await locked.boundingBox();
  if (!box || box.x < 0 || box.x + box.width > 350) throw new Error('The locked control leaves the phone width');
  await page.screenshot({ path: `${out}/${language}-locks.png` });
  await line.click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: `${out}/${language}-timers.png` });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`${language}: amber departure line, timers sheet and closed pirate rail verified at 350×812`);
  await page.close();
}
