/** Exercise the four brand surfaces with the real client/API and real elapsed time.
 * Render at 10 fps for this UI check; the foreground clock is not accelerated.
 * Run alone: WEB=http://localhost:5192 node tools/visual.mjs out/brand-recall --brand-recall
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
export async function verifyBrandRecall(out) {
  await mkdir(out,{recursive:true});
  const web=process.env.WEB??'http://localhost:5173';
  const name=`brand${String(Date.now()).slice(-8)}`;
  const errors=[];
  let page;
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  try {
    const context=await browser.newContext({viewport:{width:350,height:812},locale:'en-GB',isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
    await context.addInitScript(()=>{
      window.requestAnimationFrame=(callback)=>window.setTimeout(()=>callback(performance.now()),100);
      window.cancelAnimationFrame=(id)=>window.clearTimeout(id);
    });
    page=await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR:',e.message);});
    await page.goto(web,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button',{name:/explore your planet|start a new commander/i}).first().waitFor();
    await page.locator('[data-loading-screen]').waitFor({state:'hidden'});
    const refuse=page.getByRole('button',{name:'Refuse',exact:true});
    if(await refuse.isVisible()) await refuse.click();
    console.log('Entering Academy');
    await page.getByRole('button',{name:/explore your planet|check your planet|start a new commander/i}).first().click();
    await page.locator('[data-loading-screen]').waitFor({state:'hidden'});
    console.log('Academy loaded');
    await page.screenshot({path:`${out}/academy-en.png`});
    assert.equal(await page.getByTestId('brand-quiz').count(),0);
    await page.getByRole('button',{name:/^skip(?: training)?$/i}).click();
    console.log('Claiming the real planet');
    await page.getByRole('textbox',{name:'Commander name',exact:true}).fill(name);
    await page.getByRole('button',{name:/^continue$/i}).click();
    await page.getByLabel('Password',{exact:true}).fill('correct-horse-battery');
    await page.getByRole('button',{name:/^claim the planet$/i}).click();
    await page.getByRole('dialog',{name:/choose your commander name|set a password|sign the world/i}).waitFor({state:'hidden'});
    await page.locator('[data-loading-screen]').waitFor({state:'hidden'});
    // The card intentionally waits sixty foreground seconds. Allow room for
    // the interval's next tick and software rendering after that threshold.
    await page.getByTestId('return-card').waitFor({timeout:90000});
    console.log('PASS: real-game return card visible; Academy has no quiz');
    const card=page.getByTestId('return-card');
    const bounds=await card.boundingBox();
    const dock=await page.getByRole('navigation').last().boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=350);
    assert(bounds.y+bounds.height<=dock.y);
    await page.screenshot({path:`${out}/return-mobile-en.png`});
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:`${out}/return-desktop-en.png`});
    await page.setViewportSize({width:350,height:812});
    await card.getByRole('button',{name:'Close'}).click();
    await page.getByRole('button',{name:new RegExp(`Commander ${name}`)}).first().click();
    await page.screenshot({path:`${out}/menu-mobile-en.png`});
    await page.getByRole('button',{name:'Add to home screen'}).click();
    await page.getByRole('dialog',{name:'Keep Astera within reach'}).waitFor();
    assert.match(await page.getByRole('dialog',{name:'Keep Astera within reach'}).innerText(),/Share/);
    await page.screenshot({path:`${out}/install-ios-en.png`});
    await page.getByRole('dialog',{name:'Keep Astera within reach'}).getByRole('button',{name:'Close'}).click();
    await page.getByRole('button',{name:'Close'}).first().click();
    await page.evaluate(()=>localStorage.setItem('astera.language','tr'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-loading-screen]').waitFor({state:'hidden'});
    await page.screenshot({path:`${out}/game-mobile-tr.png`});
    for(let i=0;i<7&&!(await page.getByTestId('brand-quiz').isVisible().catch(()=>false));i++) {
      console.log(`Waiting for real foreground time: ${i*30}s`);
      await page.waitForTimeout(30000);
    }
    await page.getByTestId('brand-quiz').waitFor();
    await page.screenshot({path:`${out}/quiz-mobile-tr.png`});
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:`${out}/quiz-desktop-tr.png`});
    await page.setViewportSize({width:350,height:812});
    await page.getByRole('button',{name:'asteraonline.com',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(),/asteraonline.space/);
    const paid=page.waitForResponse(r=>r.url().endsWith('/api/session/brand-recall')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'asteraonline.space',exact:true}).click();
    const result=await (await paid).json();
    assert.deepEqual(result.granted,{alloy:100,crystal:50,deuterium:20});
    await page.getByRole('button',{name:'Oyuna devam et'}).waitFor();
    await page.screenshot({path:`${out}/reward-mobile-tr.png`});
    await page.getByRole('button',{name:'Oyuna devam et'}).click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-loading-screen]').waitFor({state:'hidden'});
    await page.waitForTimeout(6000);
    assert.equal(await page.getByTestId('brand-quiz').count(),0);
    assert.equal(await page.getByTestId('return-card').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: wrong answer retry, confirmed 100/50/20 payout, completion survives reload, no page errors');
  } catch(error) { console.error(error); if(page) await page.screenshot({path:`${out}/flow-failure.png`}).catch(()=>undefined); throw error; }
  finally { await browser.close(); }

}
