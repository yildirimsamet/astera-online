import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyRadiationBomb(output) {
  await mkdir(output,{recursive:true});
  const browser=await chromium.launch();
  const results=[];
  try {
    for(const width of [350,1280]) for(const language of ['tr','en','de','fr','es','ja'].filter(code=>!process.env.ASTERA_VISUAL_LANGS||process.env.ASTERA_VISUAL_LANGS.split(',').includes(code))) {
      const page=await browser.newPage({viewport:{width,height:900},...(width===1280&&language==='tr'?{recordVideo:{dir:output,size:{width:1280,height:900}}}:{})});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.routeWebSocket('**/*',()=>undefined);
      await page.goto(`${process.env.WEB??'http://localhost:5173'}/radiation-bomb-preview.html?lng=${language}`);
      await page.locator('canvas').waitFor();
      await page.getByTestId('radiation-product-3').waitFor();
      await page.waitForFunction(()=>[1,2,3].every(level=>{
        const flight=window.__bombPreviewScene?.getObjectByName(`bomb-preview-flight-${level}`);
        return flight?.getObjectByName('Warhead_tip')&&flight.getObjectByName('rocket-velocity-aligned-fire');
      }));
      await page.waitForTimeout(250);
      await page.getByRole('button',{name:/Yeniden oynat/}).click();
      const flights=await page.evaluate(async()=>{
        const scene=window.__bombPreviewScene, radius=window.__bombPreviewRadius;
        const records=[1,2,3].map(level=>({level,samples:0,impactSamples:0,minNoseRadius:Infinity,forward:true,exhaust:true,length:0,
          dangerColour:null,transitionColour:null,litColours:[],dialColour:null}));
        await new Promise(resolve=>{
          const deadline=performance.now()+12000;
          const sample=()=>{
            for(const record of records){
              const flight=scene.getObjectByName(`bomb-preview-flight-${record.level}`);
              const age=flight?(Date.now()-flight.userData.hitAt)/1000:-1;
              const meter=document.querySelector('.radiation-meter');
              if(meter&&record.level>1&&age>.05&&age<.85){
                const colour=getComputedStyle(meter).color;
                const bands=['rgb(247, 205, 79)','rgb(255, 151, 66)','rgb(255, 86, 88)'];
                if(colour!==bands[record.level-2]&&colour!==bands[record.level-1])record.transitionColour=colour;
              }
              if(meter&&age>=.85&&age<1.5){
                record.dangerColour=getComputedStyle(meter).color;
                record.litColours=[...meter.querySelectorAll('.is-lit')].map(segment=>getComputedStyle(segment).backgroundColor);
                record.dialColour=getComputedStyle(document.querySelector('.radiation-instrument__arc')).stroke;
              }
              if(age>=0&&age<.3){
                scene.traverse(node=>{
                  const actual=node.material?.uniforms?.uHitAge?.value;
                  if(typeof actual==='number'&&Math.abs(actual-age)<.06)record.impactSamples++;
                });
              }
              if(!flight?.visible)continue;
              const nose=flight.getObjectByName('Warhead_tip'),drive=flight.getObjectByName('Isotope_drive_throat');
              const plume=flight.getObjectByName('radiation-bomb-rocket-exhaust')?.getObjectByName('rocket-velocity-aligned-fire');
              if(!nose||!drive)continue;
              const tip=nose.getWorldPosition(flight.position.clone());
              const mouth=drive.getWorldPosition(flight.position.clone());
              const heading=tip.clone().sub(mouth);
              record.samples++;
              record.length=flight.userData.length;
              record.minNoseRadius=Math.min(record.minNoseRadius,tip.length());
              record.forward&&=heading.dot(flight.position.clone().negate())>0;
              record.exhaust&&=Boolean(plume?.count>0&&plume.geometry.getAttribute('aAlpha').array.some(alpha=>alpha>0));
            }
            const final=scene.getObjectByName('bomb-preview-flight-3');
            if((final&&Date.now()>final.userData.hitAt+1000)||performance.now()>deadline)resolve();else requestAnimationFrame(sample);
          };requestAnimationFrame(sample);
        });
        return {radius,records};
      });
      for(const flight of flights.records){
        assert(flight.samples>2,`${language}/${width}: L${flight.level} flight was not observed`);
        assert.equal(flight.forward,true,`L${flight.level}: tail-first flight`);
        assert.equal(flight.exhaust,true,`L${flight.level}: missing animated exhaust`);
        assert(flight.impactSamples>0,`L${flight.level}: surface impact missed its timestamp`);
        assert(flight.minNoseRadius>=flights.radius-.005,`L${flight.level}: warhead penetrated the body`);
        const colour=['rgb(247, 205, 79)','rgb(255, 151, 66)','rgb(255, 86, 88)'][flight.level-1];
        assert.equal(flight.dangerColour,colour,`L${flight.level}: wrong danger band`);
        assert(flight.litColours.length>0&&flight.litColours.every(actual=>actual===colour),`L${flight.level}: segment colours disagree with total danger`);
        assert.equal(flight.dialColour,colour,`L${flight.level}: dial colour disagrees with map bar`);
        if(flight.level>1){
          assert(flight.transitionColour,`L${flight.level}: colour transition was not observed`);
          assert.notEqual(flight.transitionColour,colour,`L${flight.level}: colour snapped instantly`);
          assert.notEqual(flight.transitionColour,flights.records[flight.level-2].dangerColour,`L${flight.level}: colour transition did not start`);
        }
      }
      assert(flights.records[0].length<flights.records[1].length&&flights.records[1].length<flights.records[2].length,'Level sizes collapsed');
      for (const image of await page.locator('.radiation-product__art').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(node => node.decode());
      }
      const dimensions=await page.evaluate(()=>({
        fits:document.documentElement.scrollWidth<=innerWidth,
        images:[...document.images].filter(image=>!image.complete||image.naturalWidth===0).map(image=>image.src),
        untranslated:/planet\.radiationBomb\.|units\.minuteShort/.test(document.body.textContent),
        meters:[...document.querySelectorAll('[role="meter"]')].map(node=>node.getAttribute('aria-valuenow')),
      }));
      assert.equal(errors.length,0,errors.join('\n'));
      assert.equal(dimensions.fits,true,`${language}/${width}: horizontal overflow`);
      assert.deepEqual(dimensions.images,[],`${language}/${width}: broken art`);
      assert.equal(dimensions.untranslated,false,`${language}/${width}: missing translation`);
      assert(dimensions.meters.includes('39.5'),`${language}/${width}: three independent hits missing`);
      const launchPolicy=await page.getByTestId('radiation-launch').evaluate(panel=>({
        fits:panel.getBoundingClientRect().right<=innerWidth&&panel.scrollWidth<=panel.clientWidth+1,
        honor:panel.textContent.includes('Honor')&&/2[.,]5/.test(panel.textContent),
      }));
      assert(launchPolicy.fits,`${language}/${width}: launch policy overflows`);
      assert(launchPolicy.honor,`${language}/${width}: small Honor cap missing before launch`);
      await page.screenshot({path:`${output}/${language}-${width}.png`,fullPage:true});
      await page.locator('.radiation-instrument__sources summary').click();
      const sourceDetails=await page.locator('.radiation-instrument__sources').evaluate(details=>({
        open:details.open, count:details.querySelectorAll('li').length,
        fits:details.getBoundingClientRect().right<=innerWidth&&details.scrollWidth<=details.clientWidth+1,
      }));
      assert.equal(sourceDetails.open,true,`${language}/${width}: source details cannot be opened`);
      assert.equal(sourceDetails.count,3,`${language}/${width}: independent source rows missing`);
      assert(sourceDetails.fits,`${language}/${width}: source details overflow`);
      await page.screenshot({path:`${output}/${language}-${width}-sources.png`,fullPage:true});
      const protection=page.locator('[data-radiation-protection-preview]');
      for(const info of await protection.getByRole('button').all()) await info.click();
      assert.equal(await protection.locator('[data-stat]').count(),7,'Ship stats or radiation protection missing');
      assert.equal(await protection.getByRole('button',{expanded:true}).count(),2,'Protection explanations did not open');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${language}/${width}: protection info overflow`);
      assert(!/planet\.radiationProtection\./.test(await protection.textContent()),`${language}/${width}: protection translation missing`);
      await page.screenshot({path:`${output}/${language}-${width}-protection.png`,fullPage:true});
      await page.goto(`${process.env.WEB??'http://localhost:5173'}/radiation-bomb-preview.html?lng=${language}&aegis=10`);
      await page.locator('canvas').waitFor();
      await page.getByRole('button',{name:/Yeniden oynat/}).click();
      await page.waitForFunction(()=>document.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')==='9');
      const blocked=await page.locator('[data-radiation-dial]').textContent();
      const smoke=await page.evaluate(()=>{
        let active=false;
        window.__bombPreviewScene.traverse(node=>{
          const uniforms=node.material?.uniforms;
          if(uniforms?.uStrength?.value>0&&uniforms.uHitAge?.value>=0) active=true;
        });return active;
      });
      assert(smoke,`${language}/${width}: fully blocked radiation lost its smoke`);
      assert(/\b0(?:[.,]00)?\s*(?:HP|PV)/.test(blocked),`${language}/${width}: one L1 did not show zero ship damage`);
      await page.screenshot({path:`${output}/${language}-${width}-blocked-smoke.png`,fullPage:true});
      await page.waitForFunction(()=>document.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')==='18');
      assert(/\b8(?:[.,]00)?\s*(?:HP|PV)/.test(await page.locator('[data-radiation-dial]').textContent()),`${language}/${width}: two L1 did not show 8 ship damage`);
      await page.screenshot({path:`${output}/${language}-${width}-aegis-stack.png`,fullPage:true});
      await page.goto(`${process.env.WEB??'http://localhost:5173'}/v2-gallery.html?view=wave-critical&lng=${language}`);
      await page.locator('[data-staged-health]').first().waitFor();
      const staging=await page.evaluate(()=>({
        fits:document.documentElement.scrollWidth<=innerWidth,
        healthGroups:document.querySelectorAll('[data-staged-health]').length,
        strikeBlocked:document.querySelector('[data-strike-commit] button')?.disabled,
        recallEnabled:[...document.querySelectorAll('[data-seat-waves] button')].some(button=>!button.disabled),
        untranslated:/clanWar\.(criticalReason|stagingRadiation)|repairStation\.maintenance\./.test(document.body.textContent),
      }));
      assert(staging.fits,`${language}/${width}: staged health overflows`);
      assert.equal(staging.healthGroups,2,`${language}/${width}: staged health cohorts missing`);
      assert(staging.strikeBlocked,`${language}/${width}: critical pool can strike`);
      assert(staging.recallEnabled,`${language}/${width}: critical pool cannot recall`);
      assert(!staging.untranslated,`${language}/${width}: staged health copy missing`);
      await page.screenshot({path:`${output}/${language}-${width}-staging.png`,fullPage:true});
      results.push({language,width,...dimensions,flights,sourceDetails,launchPolicy,staging});
      const video=page.video();await page.close();
      if(video) results.push({video:await video.path()});
    }
  } finally {await browser.close();}
  await writeFile(`${output}/checks.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify({output,states:results.length,passed:true}));
}
