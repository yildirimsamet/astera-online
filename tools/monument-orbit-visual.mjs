/** Actual galaxy renderer with deterministic public motion fixtures; no database writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyMonumentOrbits(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const source = await (await fetch(`${web}/src/v2/gallery/main.tsx`)).text();
  const react = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/);
  const dom = source.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/);
  assert(react && dom, 'Vite must expose the React imports');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const width of [1280, 350]) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Another task's source save must not reload a frame while SwiftShader reads it back.
      await page.route('**/@vite/client', async route => {
        const response = await route.fetch();
        const client = await response.text();
        const connection = 'transport.connect(createHMRHandler(handleMessage));';
        assert(client.includes(connection), 'Vite HMR startup must be identifiable');
        await route.fulfill({ response, body: client.replace(connection, '') });
      });
      await page.route('**/__monument-orbits.html', route => route.fulfill({ contentType: 'text/html', body: `
        <!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#080e19">
        <div id="root" style="height:100vh"></div><script type="module">
        import '/src/styles.css';
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const [{default: React}, {default: ReactDOM}, {GalaxyCanvas}, rules] = await Promise.all([
          import(${JSON.stringify(react[1])}), import(${JSON.stringify(dom[1])}),
          import('/src/galaxy/GalaxyCanvas.tsx'), import('/@fs${process.cwd()}/packages/rules/src/index.ts'),
          import('/src/i18n/index.ts'),
        ]);
        const epoch = Date.now();
        const monuments = Array.from({length:8}, (_,i) => {
          const angle = i * Math.PI / 4;
          const motion = rules.monumentMotion({x:Math.cos(angle)*6200,y:(i%2 ? -1 : 1)*1800,z:Math.sin(angle)*6200},epoch);
          return {id:'orbit-'+i,ordinal:i+1,difficulty:i<4?'HARD':'EASY',motion,
            position:rules.motionPositionAt(motion,epoch),controller:{kind:'NEUTRAL'},capacity:7270,
            used:120,productionPerMinute:60,radiationHpPerMinute:i<4?5:2,emptySince:null,respawnAt:null};
        });
        const hpRadiation = monuments.map(m => ({id:'cloud-'+m.id,mode:'EMIT',center:m.position,motion:m.motion,
          radius:1500,intensityHpPerMinute:m.radiationHpPerMinute,activeFrom:new Date(epoch-1000),activeUntil:null}));
        const root = ReactDOM.createRoot(document.getElementById('root'));
        window.drawOrbits = id => root.render(React.createElement(GalaxyCanvas, {
          planets:[],pending:[],contacts:[],asteroids:[],runs:[],wrecks:[],monuments,hpRadiation,
          homePosition:{x:0,y:0,z:0},aegisLevel:0,homeSignal:0,openingDataReady:true,
          focus:id?{kind:'monument',id}:null,onFocus:focus=>window.drawOrbits(focus?.id),
          onReady:()=>{window.orbitsReady=true;},
        }));
        window.drawOrbits(null);
        </script></body></html>` }));
      await page.goto(`${web}/__monument-orbits.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.orbitsReady && window.__galaxy?.scene.getObjectByName('monument-orbit-orbit-0'), undefined, { timeout: 90000 });
      for (const [name, id, distance] of [['overview', null, 430], ['hard', 'orbit-0', 65], ['easy', 'orbit-5', 50]]) {
        await page.evaluate(id => window.drawOrbits(id), id);
        await page.waitForTimeout(500);
        const measured = await page.evaluate(({ id, distance }) => {
          const g = window.__galaxy;
          g.setFrameloop('never');
          g.controls.enableDamping = false;
          g.controls.maxDistance = Infinity;
          const target = id ? g.scene.getObjectByName('monument-'+id).position.clone() : g.camera.position.clone().set(0,0,0);
          g.controls.target.copy(target);
          g.camera.position.copy(target).add(g.camera.position.clone().set(0.5,0.55,1).normalize().multiplyScalar(distance));
          g.controls.update();
          for(let i=0;i<3;i++)g.advance(g.clock.elapsedTime+1/30);
          const paths=[],arrows=[],visibleMonuments=[];
          g.scene.traverse(o=>{if(o.name==='monument-orbit-path')paths.push(o);if(o.name==='monument-orbit-direction')arrows.push(o);});
          for(let i=0;i<8;i++){
            const p=g.scene.getObjectByName('monument-orbit-'+i).position.clone().project(g.camera);
            if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1)visibleMonuments.push(i);
          }
          return {paths:paths.length,arrows:arrows.length,depthTest:paths.concat(arrows).every(o=>o.material.depthTest&&!o.material.depthWrite),
            focusedOpacity:id?g.scene.getObjectByName('monument-orbit-'+id).children[0].material.opacity:null,
            visibleMonuments,overflow:document.documentElement.scrollWidth>innerWidth,contextLost:g.gl.getContext().isContextLost()};
        }, { id, distance });
        assert.equal(measured.paths, 8);
        assert.equal(measured.arrows, 8);
        assert(measured.visibleMonuments.length > 0, 'The capture must actually show the monuments');
        assert(measured.depthTest && !measured.overflow && !measured.contextLost);
        if (id) assert(measured.focusedOpacity > 0.2);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: `${output}/${width}-${name}.png` });
        results.push({ width, name, ...measured, errors: [...errors] });
        console.log(`PASS ${width}px ${name}: eight trajectories and direction cues`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/measurements.json`, `${JSON.stringify(results, null, 2)}\n`);
}
