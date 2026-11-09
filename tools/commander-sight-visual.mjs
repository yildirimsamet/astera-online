import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Serialized into the browser. Labels and invisible hit volumes do not prove that a model loaded. */
export function commanderEscortsReady(minimum = 2) {
  const scene = window.__galaxy?.scene;
  if (!scene) return false;
  let escorts = 0; let loaded = 0;
  scene.traverse(object => {
    if (object.name !== 'flight-escort') return;
    escorts++;
    let meshes = 0;
    object.traverse(child => { if (child.isMesh && child.name !== 'escort-hit-target') meshes++; });
    if (meshes > 0) loaded++;
  });
  return escorts >= minimum && loaded === escorts;
}

/** Real signed-in galaxy, with a local disposable fixture supplied by the operator. */
export async function verifyCommanderSight(output) {
  await mkdir(output, { recursive: true });
  const fixture = JSON.parse(await readFile(process.env.ASTERA_SIGHT_FIXTURE ?? 'out/commander-sight/fixture.json', 'utf8'));
  const web = process.env.WEB ?? 'http://127.0.0.1:5188';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const evidence = { errors: [], assetFailures: [], assetRequests: [], checks: [] };
  try {
    if (process.argv.includes('--recovery-only')) {
      await verifyDownloadRecovery(browser, fixture, web, evidence);
      console.log(JSON.stringify(evidence));
      return;
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const login = await context.request.post(`${web}/api/auth/login`, { data: { username: fixture.username, password: fixture.password } });
    assert.equal(login.status(), 200);
    const page = await context.newPage();
    page.on('pageerror', error => { evidence.errors.push(error.message); });
    page.on('response', response => {
      if (response.url().includes('/arena/galaxy-ships')) {
        evidence.assetRequests.push({ url: response.url(), status: response.status() });
        if (response.status() >= 400) evidence.assetFailures.push(response.url());
      }
    });
    console.log('Opening galaxy without a hangar visit');
    await page.goto(web, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__galaxy?.scene), { timeout: 60_000 });
    await page.getByRole('button', { name: /back to the galaxy/i }).click({ timeout: 20_000 }).catch(() => undefined);
    await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
    await page.waitForFunction(commanderEscortsReady);
    await page.evaluate(() => {
      const g = window.__galaxy; const park = g.scene.getObjectByName('commander-ship');
      const at = park.getWorldPosition(park.position.clone());
      g.controls.dispatchEvent({ type: 'start' });
      g.controls.target.copy(at); g.camera.position.copy(at).add(at.clone().set(0, 5, 7));
      g.controls.update(); g.camera.updateMatrixWorld(); g.controls.dispatchEvent({ type: 'end' }); g.invalidate();
    });
    const parked = page.locator('[data-part="commander-ship-tag"]').filter({ hasText: /muhaf[ıi]z/i });
    await parked.first().waitFor();
    await parked.first().click({ force: true });
    console.log('Park label tapped', (await page.locator('body').innerText()).slice(-900));
    await page.locator('[data-focus-rail]').waitFor();
    await page.screenshot({ path: join(output, '390-foreign-parked.png'), timeout: 60_000 });
    console.log('Parked ship selected');
    evidence.checks.push('foreign parked ship opens its planet');

    async function selectCraft(name, id) {
      // Freeze only the diagnostic camera setup; selection is still a pointer tap on the real hit target.
      const point = await page.evaluate(({ name, id }) => {
        const g = window.__galaxy;
        g.setFrameloop('never');
        for (let ancestor = g.gl.domElement; ancestor; ancestor = ancestor.parentElement) ancestor.scrollLeft = 0;
        g.scene.updateMatrixWorld(true);
        let subject;
        g.scene.traverse(object => { if (object.name === name && object.userData.craftId === id) subject = object; });
        if (!subject) throw new Error(`craft absent: ${id}`);
        let mesh;
        subject.traverse(object => { if (object.name === 'escort-hit-target') mesh = object; });
        if (!mesh) throw new Error('craft has no commander ship hit target');
        const at = mesh.getWorldPosition(subject.position.clone());
        g.controls.dispatchEvent({ type: 'start' });
        g.controls.target.copy(at); g.camera.position.copy(at).add(at.clone().set(0, 7, 9));
        g.camera.lookAt(at); g.camera.updateMatrixWorld();
        g.gl.render(g.scene, g.camera);
        at.project(g.camera);
        const rect = g.gl.domElement.getBoundingClientRect();
        if (rect.left < 0) throw new Error('diagnostic canvas was scrolled out of the viewport');
        return { x: rect.left + (at.x + 1) * rect.width / 2, y: rect.top + (1 - at.y) * rect.height / 2 };
      }, { name, id });
      console.log('Tapping craft', name, point);
      await page.mouse.click(point.x, point.y);
      console.log('After craft tap', (await page.locator('body').innerText()).slice(-650));
      const rail = page.locator('[data-focus-rail]');
      await rail.waitFor();
      await page.evaluate(() => { const g = window.__galaxy; g.setFrameloop('demand'); g.controls.dispatchEvent({ type: 'end' }); g.invalidate(); });
      const expand = rail.locator('button[aria-expanded="false"]');
      if (await expand.count()) await expand.click();
      await rail.locator('[data-flight-escort]').waitFor();
      assert.match(await rail.locator('[data-flight-escort]').innerText(), /damage \+5%/i);
      return rail;
    }
    // Clear the planet selection through the surface's own close control.
    await page.locator('[data-focus-rail]').getByRole('button', { name: /clear|close/i }).click();
    await selectCraft('flight', fixture.flights[0]);
    await page.screenshot({ path: join(output, '390-own-escort.png'), timeout: 60_000 });
    evidence.checks.push('own commander ship tap selects its fleet and shows the frozen escort bonus');
    await page.locator('[data-focus-rail]').getByRole('button', { name: /clear|close/i }).click();
    await selectCraft('contact', fixture.flights[1]);
    await page.screenshot({ path: join(output, '390-foreign-escort.png'), timeout: 60_000 });
    evidence.checks.push('foreign commander ship tap selects its fleet and shows the same escort bonus');
    await page.setViewportSize({ width: 350, height: 812 });
    assert.match(await page.locator('[data-flight-escort]').innerText(), /damage \+5%/i);
    await page.screenshot({ path: join(output, '350-foreign-escort.png'), timeout: 60_000 });

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(evidence.assetFailures, []);
    assert.deepEqual(evidence.errors, []);
    const catalogue = evidence.assetRequests.filter(request => new URL(request.url).pathname === '/arena/galaxy-ships');
    assert.equal(catalogue.length, 1);
    evidence.checks.push('one shared catalogue; no asset 404 or page error; no horizontal overflow');
    await context.close();
    await verifyDownloadRecovery(browser, fixture, web, evidence);

    await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally { await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2)); await browser.close(); }
}

async function verifyDownloadRecovery(browser, fixture, web, evidence) {
    console.log('Checking recovery from interrupted ship downloads');
    const recoveryContext = await browser.newContext({ viewport: { width: 350, height: 812 } });
    const login = await recoveryContext.request.post(`${web}/api/auth/login`, { data: { username: fixture.username, password: fixture.password } });
    assert.equal(login.status(), 200, 'recovery login must succeed');
    const recoveryPage = await recoveryContext.newPage();
    const recoveryErrors = [];
    const network = [];
    recoveryPage.on('response', response => { if (response.url().includes('galaxy-ships')) network.push({ url: response.url(), status: response.status() }); });
    recoveryPage.on('pageerror', error => { recoveryErrors.push(error.message); });
    let interrupt = true;
    let interrupted = 0;
    const interruptedUrls = new Set();
    const interruption = Promise.withResolvers();
    const timeout = setTimeout(() => { interruption.reject(new Error('ship download was not intercepted')); }, 45_000);
    await recoveryPage.route('**/arena/galaxy-ships/*.glb*', route => {
      if (interrupt) { interrupted++; interruptedUrls.add(route.request().url()); return route.abort('failed').then(() => { interruption.resolve(); }); }
      return route.continue();
    });
    await recoveryPage.goto(web, { waitUntil: 'domcontentloaded' });
    await interruption.promise.finally(() => { clearTimeout(timeout); });
    assert(interrupted > 0);
    interrupt = false;
    await recoveryPage.evaluate(() => { window.dispatchEvent(new Event('online')); });
    try { await recoveryPage.waitForFunction(commanderEscortsReady, undefined, { timeout: 45_000 }); } catch (error) {
      console.log('Recovery diagnostic', { interrupted, network, recoveryErrors, body: (await recoveryPage.locator('body').innerText()).slice(-1000) });
      throw error;
    }
    // React's development build reports the deliberately rejected fetch even when a local boundary recovers it.
    for (const message of recoveryErrors) assert([...interruptedUrls].some(url => {
      const asset = new URL(url);
      return message === `Could not load ${asset.pathname}${asset.search}: Failed to fetch`;
    }), `unexpected recovery error: ${message}`);
    assert(await recoveryPage.getByText('Galaxy', { exact: true }).last().isVisible());
    evidence.checks.push(`350px mobile; interrupted downloads recover without losing the galaxy (${String(recoveryErrors.length)} expected injected fetch reports)`);
    await recoveryContext.close();
}
