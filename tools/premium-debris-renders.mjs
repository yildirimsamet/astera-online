/** Inspect actual native debris silhouettes and maps before choosing production fragments. */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const repository = fileURLToPath(new URL('..', import.meta.url));
const three = realpathSync(join(repository, 'apps/web/node_modules/three'));
const out = join(repository, 'out/premium-assets/debris-candidates');
const html = `<!doctype html><body style="margin:0"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';import{MeshoptDecoder}from'three/addons/libs/meshopt_decoder.module.js';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setClearColor(0x101b26);document.body.append(renderer.domElement);
const scene=new T.Scene(), camera=new T.PerspectiveCamera(32,1,.01,100);scene.add(new T.HemisphereLight(0xd4eaff,0x263246,1.3));const key=new T.DirectionalLight(0xffffff,3);key.position.set(3,4,5);scene.add(key);const fill=new T.DirectionalLight(0x94c0e5,1);fill.position.set(-3,1,-4);scene.add(fill);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);let previous;
window.renderModel=async(url,view)=>{if(previous)scene.remove(previous);const gltf=await loader.loadAsync(url);previous=gltf.scene;scene.add(previous);const at={card:[2.8,2.1,3.5],front:[0,0,4.4],right:[4.4,0,0],top:[0,4.4,.001]}[view];camera.position.set(...at);camera.lookAt(0,0,0);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};window.ready=true;
</script>`;
const server = createServer(async(req,res)=>{
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    if(path.includes('..')){res.writeHead(403);res.end();return;}
    const file=path.startsWith('/three/')?join(three,path.slice(7)):join(out,path.slice(1));
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.glb')?'model/gltf-binary':'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:512,height:512}});
await mkdir(out,{recursive:true});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.ready);
  for(const number of ['04','05','09','11','13','15','16']){
    for(const view of ['card','front','right','top']){
      const png=await page.evaluate(async({url,view})=>window.renderModel(url,view),{url:`/${number}.glb`,view});
      await writeFile(join(out,`${number}-${view}.png`),Buffer.from(png.split(',')[1],'base64'));
    }
    console.log(number);
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
