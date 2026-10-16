import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Renders only the three approved M1 derivatives; never regenerates another asset.
const output = process.argv[2] ?? '/tmp/astera-radiation-bomb-art';
await mkdir(output, { recursive: true });
await mkdir('apps/web/public/assets/images/tactical', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 640 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/*', () => undefined);
  await page.route('**/__bomb-art.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/__bomb-art.html`);
  await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
    document.body.innerHTML = '<canvas id="art"></canvas>';
    document.body.style.cssText = 'margin:0;background:transparent;overflow:hidden';
    const renderer = new T.WebGLRenderer({ canvas: document.querySelector('#art'), antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(420,640); renderer.setPixelRatio(1);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    const scene = new T.Scene();
    const environment = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(environment,.04).texture;
    const key = new T.DirectionalLight('#fff3d7',5); key.position.set(-3,4,5); scene.add(key);
    const rim = new T.DirectionalLight('#aecb85',3); rim.position.set(4,1,-2); scene.add(rim);
    const camera = new T.OrthographicCamera(-.93,.93,1.42,-1.42,.01,100);
    camera.position.set(0,0,5); camera.lookAt(0,0,0);
    const loader = new GLTFLoader();
    let active;
    window.__renderBomb = async level => {
      if (active) scene.remove(active);
      const gltf = await loader.loadAsync(`/assets/models/missiles/radiation-bomb-l${level}.glb`);
      active = gltf.scene;
      active.rotation.set(-Math.PI/2,-.35,-.34);
      // Same relative size ladder as the flight renderer; one fixed camera for all three.
      active.scale.setScalar(({1:.48,2:.64,3:.84})[level]/.84);
      const bounds = new T.Box3().setFromObject(active);
      active.position.sub(bounds.getCenter(new T.Vector3()));
      scene.add(active); renderer.render(scene,camera);
      return { level, width: bounds.max.x-bounds.min.x, height: bounds.max.y-bounds.min.y, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    };
  });
  const stats = [];
  for (const level of [1,2,3]) {
    stats.push(await page.evaluate(level => window.__renderBomb(level),level));
    const bytes = await page.locator('#art').screenshot({ omitBackground: true });
    await writeFile(`${output}/radiation-bomb-l${level}.png`,bytes);
    // Keep the raster derivation reproducible without loading a canvas in every product card.
    const webp = await page.evaluate(() => {
      const thumb = document.createElement('canvas'); thumb.width = 210; thumb.height = 320;
      thumb.getContext('2d').drawImage(document.querySelector('#art'),0,0,210,320);
      return thumb.toDataURL('image/webp',.94).split(',')[1];
    });
    await writeFile(`apps/web/public/assets/images/tactical/radiation-bomb-l${level}.webp`,Buffer.from(webp,'base64'));
  }
  if(errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${output}/stats.json`,JSON.stringify(stats,null,2));
  console.log(JSON.stringify({output,stats}));
} finally { await browser.close(); }
