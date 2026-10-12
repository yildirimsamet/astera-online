/** Real renderer + API; inspection/quotes only. No dispatches or recalls. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

export async function verifyMonumentMotion(output){
  const web=process.env.WEB??'http://localhost:5187';
  await mkdir(output,{recursive:true});
  const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  try{
    for(const [name,width] of [['desktop',1280],['phone',350]]){
      const context=await browser.newContext({viewport:{width,height:850}});
      await context.addInitScript(()=>localStorage.setItem('astera.language','tr'));
      const login=await context.request.post(`${web}/api/auth/login`,{data:{username:'monument_local',password:'MonumentLocal2026!'}});
      if(!login.ok())throw new Error(`Visual login ${login.status()}`);
      const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(web,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>{const g=window.__galaxy;if(!g?.scene.getObjectByName('monument-model-1'))return false;let clouds=0;g.scene.traverse(o=>{if(o.name.startsWith('radiation-haze-'))clouds++;});return clouds===8;},undefined,{timeout:90000});
      await page.locator('[data-loading-screen]').waitFor({state:'hidden',timeout:90000});
      const initial=await page.evaluate(()=>{
        const g=window.__galaxy;
        g.setFrameloop('never');g.advance(g.clock.elapsedTime+1/30);
        const rows=[];g.scene.traverse(o=>{if(/^monument-[a-f0-9-]+$/.test(o.name))rows.push({name:o.name,position:o.position.toArray()});});return rows;
      });
      const shifted=await page.evaluate(async()=>{
        const clock=await import('/src/lib/clock.ts');
        const offset=clock.clockOffset(),readNow=Date.now,frameAt=readNow();
        const g=window.__galaxy;
        // Sample every frame callback at one instant; real callbacks can cross a millisecond.
        Date.now=()=>frameAt;
        try{
          clock.resetClock(offset+3600_000);g.advance(g.clock.elapsedTime+1/30);
          const rows=[];g.scene.traverse(o=>{if(/^monument-[a-f0-9-]+$/.test(o.name))rows.push({name:o.name,position:o.position.toArray()});});
          const clouds=[];g.scene.traverse(o=>{if(o.name.startsWith('radiation-haze-'))clouds.push(o.position.toArray());});
          return {rows,clouds};
        }finally{
          Date.now=readNow;clock.resetClock(offset);g.advance(g.clock.elapsedTime+1/30);
        }
      });
      if(initial.length!==8||shifted.rows.length!==8)throw new Error('Eight monument roots missing');
      const moved=initial.every(a=>{const b=shifted.rows.find(b=>b.name===a.name);return b&&Math.hypot(...a.position.map((x,i)=>x-b.position[i]))>1;});
      if(!moved)throw new Error('A monument did not move on the shared clock');
      const cloudFollows=shifted.rows.every(r=>shifted.clouds.some(c=>Math.hypot(...c.map((x,i)=>x-r.position[i]))<1e-5));
      if(!cloudFollows)throw new Error(JSON.stringify({clouds:shifted.clouds,roots:shifted.rows,minGaps:shifted.rows.map(r=>Math.min(...shifted.clouds.map(c=>Math.hypot(...c.map((x,i)=>x-r.position[i])))))}));
      const cover=page.locator('[data-sheet-panel][data-placement="card"]');
      if(await cover.isVisible())await cover.getByRole('button',{name:'Kapat',exact:true}).click();
      await page.getByRole('button',{name:'8 anıt',exact:true}).click();
      await page.locator('#galaxy-target-list').getByRole('button').first().click();
      await page.locator('[data-focus-rail] button[aria-expanded="false"]').click();
      const dialog=page.getByRole('dialog');await dialog.waitFor();
      await dialog.getByRole('textbox',{name:/^(?!.*geri çağırma).*adedi/}).first().fill('1');
      await dialog.locator('[data-testid="monument-route-preview"]').waitFor({timeout:30000});
      const movingWithSheetOpen=await page.evaluate(async()=>{
        const g=window.__galaxy;
        const root=g.scene.children.flatMap(function walk(o){return /^monument-[a-f0-9-]+$/.test(o.name)?[o]:o.children.flatMap(walk);})[0];
        if(!root)return false;
        const before=root.position.toArray();
        const clock=await import('/src/lib/clock.ts');clock.resetClock(60_000);
        g.advance(g.clock.elapsedTime+1/30);
        const moved=Math.hypot(...root.position.toArray().map((x,i)=>x-before[i]))>0.01;
        clock.resetClock(0);g.advance(g.clock.elapsedTime+1/30);
        return moved;
      });
      if(!movingWithSheetOpen)throw new Error('Dispatch sheet freezes monument motion');
      await dialog.locator('[data-testid="monument-route-preview"]').scrollIntoViewIfNeeded();
      await dialog.getByText(/^Gidiş:.*dönüş rezervi:/).scrollIntoViewIfNeeded();
      const fits=await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth&&document.documentElement.scrollWidth<=window.innerWidth);
      if(!fits||errors.length)throw new Error(JSON.stringify({fits,errors}));
      await page.screenshot({path:`${output}/${name}.png`});
      const wave=dialog.locator('[data-testid^="monument-wave-"]').first();
      let recallFits=null;
      if(await wave.count()){
        await wave.getByRole('textbox').first().fill('1');
        const forecast=wave.getByTestId('monument-recall-forecast');
        await forecast.waitFor();
        await forecast.scrollIntoViewIfNeeded();
        recallFits=await forecast.evaluate(e=>e.scrollWidth<=e.clientWidth&&document.documentElement.scrollWidth<=window.innerWidth);
        if(!recallFits)throw new Error('Selected return overflows the viewport');
        await page.screenshot({path:`${output}/${name}-recall.png`});
      }
      results.push({name,moved,cloudFollows,movingWithSheetOpen,fits,recallFits,errors});
      await context.close();
    }
  }finally{await browser.close();}
  await writeFile(`${output}/results.json`,JSON.stringify(results,null,2)+'\n');
  console.log(results);
}
