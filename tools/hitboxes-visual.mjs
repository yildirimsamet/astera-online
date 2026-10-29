import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Real galaxy renderers with frozen, local fixtures; never changes an account or API state. */
async function setupHitboxReview() {
  const refresh = await import('/@react-refresh');
  refresh.default.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => undefined;
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  const { default: R } = await import('/node_modules/.vite/deps/react.js');
  const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
  const { Canvas, useFrame } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const { OrbitControls } = await import('/node_modules/.vite/deps/@react-three_drei.js');
  const T = await import('/node_modules/.vite/deps/three.js');
  const { OwnFleets, Traffic } = await import('/src/galaxy/Fleets.tsx');
  const { TradeShip } = await import('/src/galaxy/TradeShip.tsx');
  const { IntergalacticConvoy } = await import('/src/galaxy/IntergalacticConvoy.tsx');
  const { DefaultPlanetModel, PlanetSkinModel } = await import('/src/galaxy/PlanetSkinModel.tsx');
  const { PlanetField } = await import('/src/galaxy/PlanetField.tsx');
  const { planetModel } = await import('/src/ui/assets.ts');
  const { setHitboxDebug } = await import('/src/galaxy/hitboxDebug.tsx');
  const { installTapGuard } = await import('/src/galaxy/tap.ts');
  const { GalaxyVisualPhase } = await import('/src/galaxy/visualFrame.tsx');
  const { SCENE_LIGHT } = await import('/src/galaxy/planetSurface.ts');
  const { serverNow } = await import('/src/lib/clock.ts');
  installTapGuard();
  const epoch = Date.now();
  Date.now = () => epoch;
  const now = serverNow(), h = R.createElement;
  document.body.style.cssText = 'margin:0;overflow:hidden;background:#050914;color:#e6f0fa;font:13px system-ui';
  document.body.innerHTML = `<div id="stage" style="position:absolute;inset:0"></div><div style="position:absolute;left:16px;top:16px;padding:14px;background:#0b1429ec;border:1px solid #273c59;border-radius:12px;max-width:calc(100vw - 62px)">
    <div style="font-size:15px;font-weight:600;margin-bottom:10px">Astera · Seçim alanları</div>
    <select id="fixture"><option value="trade">Ticaret gemisi</option><option value="pirate">Korsan konvoyu</option><option value="owner">Kalabalık filo</option><option value="observer">Diğer oyuncunun filosu</option><option value="convoy">Galaksiler arası konvoy</option><option value="towing">Çekilen gemiler</option></select>
    <select id="distance"><option value="3">Çok yakın</option><option value="9">Yakın</option><option value="28">Orta</option></select>
    <label><input id="debug" type="checkbox"> Alanları göster</label>
    <p style="margin-bottom:0;color:#9eb5d1">Sürükle: döndür · Tekerlek / iki parmak: yakınlaştır · Sağ tuş: kaydır</p>
    <p style="margin-bottom:0;color:#9eb5d1">Seçilen: <span id="selected">—</span></p></div>`;
  const root = createRoot(document.getElementById('stage'));
  const review = window.__pickReview = { mode: 'trade', distance: 3, selected: '', frames: 0, debug: false };
  const select = what => { review.selected = what; document.getElementById('selected').textContent = what; };
  const fleet = { DART: 350, VIPER: 60, CORSAIR: 30, CITADEL: 10 };
  const from = { x: 0, y: 0, z: -100 }, to = { x: 0, y: 0, z: 100 };
  const thread = { id: 'pick-fixture', kind: 'unknown_signal', targetName: '', minutesRemaining: 30, leg: 'outbound',
    arriveAt: new Date(now + 1800000), fleet, path: { from, to, departAt: new Date(now - 1800000), arriveAt: new Date(now + 1800000) } };
  const contact = { id: 'pick-contact', kind: 'pirate', fleet, from, to, startAt: thread.path.departAt, endAt: thread.path.arriveAt };
  const merchant = { id: 'pick-trade', kind: 'TRADE_SHIP', orbit: { radius: 500, period: 200, phase: 0, inclination: 0, ascendingNode: 0 } };
  const convoy = { id: 'pick-convoy', kind: 'INTERGALACTIC_CONVOY', appearsAtMinute: 0, expiresAtMinute: 60,
    route: { from, to }, visual: { formationVersion: 1 } };
  const season = new Date(now - 1800000);
  function Planet() {
    const [fixture, setFixture] = R.useState(null);
    review.setPlanet = setFixture;
    if (!fixture) return null;
    const nodes = [{ id: 'pick-world', position: fixture.position, radius: fixture.radius, stance: 'self', intel: 'RESOLVED', name: 'Gezegen', owner: '', isClanmate: false, weight: 1, coreTier: 1, coreLevel: 1, satellites: [], shielded: false, state: {kind:'NORMAL'}, isOwned: false, isCapital: false }];
    const props = { nodes, onSelect: () => select('Gezegen') };
    if (fixture.kind === 'skin') return h(PlanetSkinModel, { ...props, skinId: 'planet-lava', status: 'NORMAL', galaxyLod: true });
    if (fixture.kind === 'fallback') return h(PlanetField, { ...props, nodes: nodes.map(node => ({...node, skin: { id: 'planet-lava', status: 'NORMAL' }})), rivals: [], selectedId: null });
    return h(DefaultPlanetModel, { ...props, url: planetModel('pick-world', fixture.lod ?? 'far'), lod: fixture.lod ?? 'far', capacity: 1 });
  }
  function Probe() {
    useFrame(({scene, camera, size, gl}) => {
      review.scene = scene; review.camera = camera; review.size = size;
      const targets = [];
      scene.traverse(node => { if (node.name.endsWith('-hull-hit-targets')) targets.push(node); });
      if (!targets.length && review.mode !== 'planet') return;
      const box = new T.Box3();
      const local = new T.Matrix4();
      for (const target of targets) {
        target.updateWorldMatrix(true, false);
        for (let index = 0; index < target.count; index++) {
          target.getMatrixAt(index, local);
          box.union(new T.Box3(new T.Vector3(-.5,-.5,-.5), new T.Vector3(.5,.5,.5)).applyMatrix4(local).applyMatrix4(target.matrixWorld));
        }
      }
      const centre = targets.length ? box.getCenter(new T.Vector3()) : new T.Vector3();
      // Keep a close view on the lead half of a large formation; the medium view shows the wing.
      review.centre = centre;
      if (review.cameraPending) {
        review.cameraPending = false;
        camera.position.copy(centre).add(new T.Vector3(0, review.distance, review.distance * .32));
        camera.lookAt(centre); camera.updateMatrixWorld();
        review.controls?.target.copy(centre);
        review.controls?.update();
      }
      review.targets = targets;
      review.frames++;
      if (review.backgroundPending && review.frames > 12) {
        review.backgroundPending = false;
        const {planet} = review.findPoints();
        review.setPlanet({position: planet, radius: .16});
      }
      gl.domElement.dataset.ready = String(review.frames);
    });
    useFrame(({gl, scene, camera}) => gl.render(scene, camera), 1);
    return null;
  }
  review.render = mode => {
    review.mode = mode; review.frames = 0; review.backgroundPending = mode !== 'planet'; review.cameraPending = true;
    review.setPlanet?.(null);
    if (mode !== 'planet') document.getElementById('fixture').value = mode;
    let craft;
    if (mode === 'planet') craft = null;
    else if (mode === 'trade') craft = h(TradeShip, { event: merchant, seasonStart: season, onSelect: () => select('Ticaret gemisi') });
    else if (mode === 'convoy') craft = h(IntergalacticConvoy, { event: convoy, seasonStart: season, onSelect: () => select('Konvoy') });
    else if (mode === 'owner' || mode === 'towing') craft = h(OwnFleets, { pending: [{ ...thread,
      ...(mode === 'towing' ? { leg: 'return', fleet: {...fleet, TALON: 2}, towing: {DART: 1, CORSAIR: 1} } : {}) }], nodes: [], focusedKey: null, onSelect: () => select('Filo') });
    else craft = h(Traffic, { contacts: [{...contact, kind: mode === 'observer' ? 'fleet' : 'pirate'}], nodes: [], focusedId: null, onSelect: () => select(mode === 'pirate' ? 'Korsan' : 'Filo') });
    root.render(h(Canvas, { camera: {position: [0, 8, 3], fov: 45, near: .01, far: 5000}, dpr: 1, gl: {preserveDrawingBuffer: true} },
      h('color', {attach:'background',args:['#050914']}), h('ambientLight', {intensity:SCENE_LIGHT.ambient}),
      h('directionalLight', {position:[-8,12,9],intensity:SCENE_LIGHT.key}),
      h('directionalLight', {position:[10,-3,-12],intensity:.48,color:'#91b5de'}),
      h(GalaxyVisualPhase, null, h('group', {key:mode}, craft), h(Planet)),
      h(OrbitControls, {ref: controls => {review.controls = controls;}, minDistance:.1, maxDistance:2000, enableDamping:true}), h(Probe)));
  };
  review.atPixel = (x, y) => {
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(x / review.size.width * 2 - 1, 1 - y / review.size.height * 2), review.camera);
    return ray;
  };
  review.findPoints = () => {
    const { camera, size, targets } = review;
    const matrix = new T.Matrix4(), point = new T.Vector3();
    let hull = null, gap = null;
    for (const target of targets) for (let i = 0; i < target.count; i++) {
      target.getMatrixAt(i, matrix);
      point.setFromMatrixPosition(matrix).applyMatrix4(target.matrixWorld).project(camera);
      const x = (point.x + 1) * size.width / 2, y = (1 - point.y) * size.height / 2;
      if (x > 30 && x < size.width - 30 && y > 130 && y < size.height - 30) hull ??= {x,y};
    }
    // A planet beside the lead hull/inside the former formation-wide rectangle.
    for (let y = size.height * .35; y < size.height * .75 && !gap; y += 9) {
      for (let x = size.width * .3; x < size.width * .7; x += 9) {
        if (review.atPixel(x,y).intersectObjects(targets, false).length === 0) { gap = {x,y}; break; }
      }
    }
    if (!hull || !gap) throw new Error(`Missing test points for ${review.mode}`);
    const ray = review.atPixel(gap.x,gap.y);
    const depth = camera.position.distanceTo(review.centre) + 3;
    const planet = ray.ray.at(depth,new T.Vector3()).toArray();
    return {hull,gap,planet};
  };
  document.getElementById('fixture').onchange = event => review.render(event.target.value);
  document.getElementById('distance').onchange = event => { review.distance = Number(event.target.value); review.backgroundPending = true; review.cameraPending = true; review.frames = 0; };
  document.getElementById('debug').onchange = event => setHitboxDebug(event.target.checked);
  review.debug = setHitboxDebug;
  review.render(new URLSearchParams(location.search).has('planetOnly') ? 'planet' : 'trade');
}

export async function prepareHitboxReview() {
  await mkdir('apps/web/.dev', {recursive: true});
  await writeFile('apps/web/.dev/hitbox-review.html', `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Astera · Seçim alanları</title><body><script type="module">(${setupHitboxReview.toString()})()</script></body></html>`);
}

export async function verifyHitboxes(output) {
  await mkdir(output, {recursive: true});
  await prepareHitboxReview();
  const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--js-flags=--max-old-space-size=1024']});
  const results = [], errors = [];
  try {
    const page = await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:1});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if(message.type()==='error') errors.push(message.text());});
    await page.goto(`${process.env.WEB ?? 'http://localhost:5188'}/.dev/hitbox-review.html`);
    await page.waitForFunction(() => window.__pickReview?.frames > 8, undefined, {timeout:90000});
    const cameraBefore = await page.evaluate(() => window.__pickReview.camera.position.toArray());
    await page.mouse.move(500,400); await page.mouse.down();
    await page.mouse.move(610,460,{steps:8}); await page.mouse.up();
    await page.waitForTimeout(250);
    const cameraAfter = await page.evaluate(() => window.__pickReview.camera.position.toArray());
    assert(Math.hypot(...cameraBefore.map((value,index)=>value-cameraAfter[index]))>.1,'drag must orbit the camera');
    assert.equal(await page.evaluate(()=>window.__pickReview.selected),'','a drag must not select a hull');
    const rangeBefore = await page.evaluate(()=>window.__pickReview.camera.position.distanceTo(window.__pickReview.controls.target));
    await page.mouse.wheel(0,-300); await page.waitForTimeout(250);
    assert(await page.evaluate(()=>window.__pickReview.camera.position.distanceTo(window.__pickReview.controls.target))<rangeBefore,'wheel must zoom');
    console.log('PASS interactive preview: drag, zoom and drag-selection guard');
    for (const mode of ((process.argv.includes('--hitbox-planets') || process.argv.includes('--hitbox-fallback')) ? [] : ['trade','pirate','owner','observer','convoy','towing'])) {
      await page.evaluate(mode => window.__pickReview.render(mode),mode);
      await page.waitForFunction(() => window.__pickReview.frames > 12, undefined, {timeout:90000});
      for (const [range, distance] of [['very-close',3],['close',9],['medium',28]]) {
        await page.evaluate(distance => {document.getElementById('distance').value = String(distance);window.__pickReview.distance = distance;window.__pickReview.cameraPending=true;window.__pickReview.frames=0;window.__pickReview.setPlanet(null);},distance);
        await page.waitForFunction(() => window.__pickReview.frames > 8);
        const points = await page.evaluate(() => window.__pickReview.findPoints());
        await page.evaluate(points => window.__pickReview.setPlanet({position:points.planet,radius:.16}),points);
        await page.waitForTimeout(350);
        await page.mouse.click(points.hull.x,points.hull.y);
        const hull = await page.evaluate(() => window.__pickReview.selected);
        assert(hull && hull !== 'Gezegen', `${mode}/${range}: visible hull not selectable: ${hull}`);
        await page.mouse.click(points.gap.x,points.gap.y);
        assert.equal(await page.evaluate(() => window.__pickReview.selected),'Gezegen',`${mode}/${range}: empty space steals the planet`);
        await page.screenshot({path:`${output}/${mode}-${range}.png`});
        await page.evaluate(() => window.__pickReview.debug(true));
        await page.waitForTimeout(100);
        await page.screenshot({path:`${output}/${mode}-${range}-hitboxes.png`});
        await page.evaluate(() => window.__pickReview.debug(false));
        results.push({mode,range,distance,hull,planet:'selected through gap'});
        await writeFile(`${output}/results.json`,JSON.stringify({results,errors},null,2));
        console.log(`PASS ${mode}/${range}: hull and background planet`);
      }
    }
    await page.evaluate(() => window.__pickReview.render('planet'));
    for (const viewport of (process.argv.includes('--hitbox-fallback') ? [] : [{width:1000,height:760},{width:350,height:812}])) {
      await page.setViewportSize(viewport);
      for (const kind of ['far','lite','full','skin']) {
        for (const distance of [30,100,500,30]) {
          await page.evaluate(({kind,distance}) => {
            const review = window.__pickReview;
            review.distance = distance; review.cameraPending = true; review.frames = 0; review.selected = '';
            review.setPlanet({position:[0,0,0],radius:.04,kind:kind === 'skin' ? 'skin' : undefined,lod:kind});
          },{kind,distance});
          await page.waitForFunction(() => {
            const r = window.__pickReview;
            return r.frames > 6 && r.scene.getObjectsByProperty('isInstancedMesh',true).some(mesh => /hits$/.test(mesh.name) && mesh.count);
          }, undefined,{timeout:60000});
          // Offset from the visible speck, still inside the 12px pick radius, then beyond it.
          const x = viewport.width / 2, y = viewport.height / 2;
          await page.mouse.click(x+9,y);
          assert.equal(await page.evaluate(() => window.__pickReview.selected),'Gezegen',`${kind}/${viewport.width}/${distance}: minimum area missing`);
          const outside = await page.evaluate(({x,y}) => {
            const r=window.__pickReview;
            const meshes=r.scene.getObjectsByProperty('isInstancedMesh',true).filter(mesh=>/hits$/.test(mesh.name));
            return r.atPixel(x+15,y).intersectObjects(meshes,false).length;
          },{x,y});
          assert.equal(outside,0,`${kind}: minimum area grows beyond the 24px disc`);
          results.push({kind,viewport,distance,minDiameter:24});
        }
        await page.evaluate(() => window.__pickReview.debug(true));
        await page.waitForTimeout(100);
        await page.screenshot({path:`${output}/planet-${kind}-${viewport.width}.png`});
        await page.evaluate(() => window.__pickReview.debug(false));
        console.log(`PASS distant ${kind}/${viewport.width}: 24px target through zoom in/out`);
      }
    }
    const fallback = await browser.newPage({viewport:{width:350,height:812},deviceScaleFactor:2});
    const fallbackErrors = [];
    fallback.on('pageerror',error => fallbackErrors.push(error.message));
    await fallback.route('**/*.glb*',route => route.request().url().includes('/ships/')
      ? route.continue() : route.fulfill({status:404,body:'deliberate model failure for fallback verification'}));
    await fallback.goto(`${process.env.WEB ?? 'http://localhost:5188'}/.dev/hitbox-review.html?planetOnly=1`);
    await fallback.waitForFunction(() => window.__pickReview?.frames > 6);
    for (const distance of [30,500,30]) {
      await fallback.evaluate(distance => {
        const r=window.__pickReview;r.distance=distance;r.cameraPending=true;r.frames=0;r.selected='';
        r.setPlanet({kind:'fallback',position:[0,0,0],radius:.04});
      },distance);
      await fallback.waitForFunction(() => window.__pickReview.frames > 6 && window.__pickReview.scene.getObjectByName('planet-hitboxes')?.count === 1,
        undefined,{timeout:60000});
      await fallback.mouse.click(350/2+9,812/2);
      assert.equal(await fallback.evaluate(() => window.__pickReview.selected),'Gezegen',`fallback/${distance}: minimum area missing`);
      results.push({kind:'fallback',distance,viewport:{width:350,height:812},dpr:2,minDiameter:24});
    }
    await fallback.evaluate(() => window.__pickReview.debug(true));
    await fallback.waitForTimeout(100);
    await fallback.screenshot({path:`${output}/planet-fallback-phone-dpr2.png`});
    assert(fallbackErrors.length > 0, 'the injected GLB failure must actually be observed');
    assert(fallbackErrors.every(message => /^Could not load \/assets\/models\/.*\.glb: fetch for .* responded with 404: Not Found$/.test(message)), `unexpected fallback error: ${JSON.stringify(fallbackErrors)}`);
    await fallback.close();
    console.log('PASS fallback/350/dpr2: real model-loading failure retains 24px selection');
    assert.deepEqual(errors,[]);
    await writeFile(`${output}/results.json`,JSON.stringify({results,errors},null,2));
  } finally {await browser.close();}
  return results;
}
