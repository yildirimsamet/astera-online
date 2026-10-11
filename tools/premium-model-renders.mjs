/** Acceptance frames from the approved missile and asteroid derivatives. */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { realpathSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const repository = fileURLToPath(new URL('..', import.meta.url));
const root = join(repository, 'apps/web/public');
const three = realpathSync(join(repository, 'apps/web/node_modules/three'));
const records = JSON.parse(readFileSync(join(repository, 'docs/implementation/premium-asset-measurements.json'), 'utf8'));
const html = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';import{MeshoptDecoder}from'three/addons/libs/meshopt_decoder.module.js';
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setClearColor(0,0);document.body.append(renderer.domElement);
const scene=new T.Scene(), camera=new T.PerspectiveCamera(32,1,.01,100);scene.add(new T.HemisphereLight(0xd4eaff,0x263246,2));const key=new T.DirectionalLight(0xffffff,3);key.position.set(3,4,5);scene.add(key);const fill=new T.DirectionalLight(0x7ab8ff,1.8);fill.position.set(-3,1,-4);scene.add(fill);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);let previous;
window.renderModel=async(url,view)=>{if(previous)scene.remove(previous);const gltf=await loader.loadAsync(url);previous=gltf.scene;scene.add(previous);const at={card:[2.8,2.1,3.5],front:[0,0,5],back:[0,0,-5],left:[-5,0,0],right:[5,0,0],top:[0,5,.001],bottom:[0,-5,.001]}[view];camera.position.set(...at);camera.lookAt(0,0,0);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};window.ready=true;
</script>`;
const server = createServer(async(req,res)=>{
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    if(path.includes('..')){res.writeHead(403);res.end();return;}
    const file=path.startsWith('/three/')?join(three,path.slice(7)):join(root,path.slice(1));
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.glb')?'model/gltf-binary':'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:512,height:512}});
const out=join(repository,'out/premium-assets/models');await mkdir(out,{recursive:true});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.ready);
  for(const entry of records){
    for(const view of ['card','front','back','left','right','top','bottom']){
      const png=await page.evaluate(async({url,view})=>window.renderModel(url,view),{url:`/${entry.output}`,view});
      const bytes=Buffer.from(png.split(',')[1],'base64');await writeFile(join(out,`${entry.name}-${view}.png`),bytes);

    }
    console.log(entry.name);
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
