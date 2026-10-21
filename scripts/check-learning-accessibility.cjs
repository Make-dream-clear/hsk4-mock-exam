/* Focused browser regression, not a WCAG conformance certification.
 * Requires Playwright; set PLAYWRIGHT_MODULE and optionally CHROMIUM_EXECUTABLE.
 * Start the local server first; HSK4_PREVIEW defaults to http://127.0.0.1:8768.
 * Network is limited to that preview origin. No learning text is uploaded. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.HSK4_PREVIEW||'http://127.0.0.1:8768';
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/playwright/accessibility');
function scanContrast(root){
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),blend=(fg,bg)=>{const a=fg[3]??1;return fg.slice(0,3).map((n,i)=>n*a+bg[i]*(1-a));};const luminance=a=>a.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 let failures=[],count=0;for(const e of [root,...root.querySelectorAll('*')]){if(!e.getClientRects().length||e.closest('[hidden],button:disabled,select:disabled')||!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.tagName)&&![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const s=getComputedStyle(e);if(s.visibility==='hidden')continue;let layers=[],a=e,opacity=1;while(a){const st=getComputedStyle(a);layers.push(rgb(st.backgroundColor));opacity*=Number(st.opacity);a=a.parentElement;}let bg=[255,255,255];layers.reverse().forEach(l=>bg=blend(l,bg));let fg=rgb(s.color);fg[3]=(fg[3]??1)*opacity;fg=blend(fg,bg);const ratio=contrast(fg,bg),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseInt(s.fontWeight)>=700);count++;if(ratio<(large?3:4.5)-.01)failures.push({tag:e.tagName,id:e.id,cls:e.className,text:e.textContent.trim().slice(0,65),color:s.color,bg,ratio:+ratio.toFixed(2)});}
 return {count,failures};
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const page=await context.newPage(),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
 const grammar=JSON.parse(fs.readFileSync(path.join(root,'data/grammar-patterns.json'))).map(p=>[`grammar/patterns/${p.slug}/`,'main']);
 const topics=Object.keys(JSON.parse(fs.readFileSync(path.join(root,'data/topic-practice.json')))).map(s=>[`topics/${s}/`,'.topic-practice']);
 async function contrast(scope,label){const result=await page.locator(scope).evaluate(scanContrast);report.push({label,...result});assert.deepEqual(result.failures,[],label+' text contrast');}
 async function fit(label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' horizontal overflow');}
 for(const theme of ['light','dark']){
  await context.addInitScript(t=>localStorage.setItem('hsk4_theme',t),theme);
  for(const [url,scope] of [['writing/','main'],['vocabulary/','#context-practice'],...grammar,...topics]){
   await page.goto(base+'/'+url,{waitUntil:'domcontentloaded'});await contrast(scope,theme+' '+url);
   for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});await fit(theme+' '+url+' '+width);}
   await page.setViewportSize({width:390,height:844});
  }
  await page.goto(base+'/writing/#essay-revision');
  await page.locator('#essay-revision').screenshot({path:path.join(output,`writing-${theme}.png`)});
  await page.locator('#essay-input').fill('上周我和朋友去公园散步。');
  await page.locator('#revision-start').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'essay-input');
  const top=await page.locator('#essay-input').evaluate(e=>e.getBoundingClientRect().top);
  const headerBottom=await page.locator('header').evaluate(e=>e.getBoundingClientRect().bottom);
  assert(top>=headerBottom,'Essay focus hidden by header');
  await page.locator('#essay-input').fill('上周我和朋友去公园散步。我们沿着湖边走了一圈，看到几只小鸟。');
  await page.locator('#revision-check').focus();await page.keyboard.press('Space');
  await page.locator('#revision-done').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'revision-feedback');
  await contrast('#essay-revision',theme+' reviewed writing');
  await page.locator('#revision-cancel').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'revision-start');
  await page.goto(base+'/grammar/patterns/zhiyou-cai/#transfer-practice');
  await page.locator('#transfer-practice').screenshot({path:path.join(output,`grammar-${theme}.png`)});
  await page.goto(base+'/topics/proverbs-sayings/#topic-practice');
  await page.locator('[data-action=start]').focus();await page.keyboard.press('Enter');
  await page.locator('[data-action=finish]').focus();await page.keyboard.press('Enter');
  for(let i=0;i<4;i++){await page.locator(`[name=point-${i}][value=yes]`).focus();await page.keyboard.press('Space');}
  await page.locator('.tp-review button[type=submit]').focus();await page.keyboard.press('Enter');
  await contrast('.topic-practice',theme+' topic self-review');
  await page.locator('.tp-result').screenshot({path:path.join(output,`topics-${theme}.png`)});
  await page.goto(base+'/vocabulary/#context-practice');
  const trigger=page.locator('#context-practice [data-vocab-interactive]');await trigger.focus();await page.keyboard.press('Enter');
  assert(await page.locator('main').evaluate(e=>e.inert),'Background should be inert');
  await contrast('#quiz-overlay',theme+' vocabulary open');
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('#quiz-overlay')),'Tab escaped dialog');}
  await page.locator('#quiz-options button').first().focus();await page.keyboard.press('Enter');
  await contrast('#quiz-overlay',theme+' vocabulary feedback');
  await page.locator('#quiz-overlay .modal').screenshot({path:path.join(output,`vocabulary-${theme}.png`)});
  await page.keyboard.press('Escape');assert(await trigger.evaluate(e=>document.activeElement===e));assert(!(await page.locator('main').evaluate(e=>e.inert)));
 }
 // Reflow at the 320 CSS pixel equivalent of 400% zoom on a 1280px viewport;
 // separately double text sizes and apply WCAG text-spacing overrides.
 for(const url of ['writing/','vocabulary/','grammar/patterns/zhiyou-cai/','topics/proverbs-sayings/']){
  await page.goto(base+'/'+url);await page.setViewportSize({width:320,height:844});await fit(url+' reflow');
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>{const sizes=[...document.querySelectorAll('main *')].map(e=>[e,getComputedStyle(e).fontSize]);sizes.forEach(([e,s])=>e.style.fontSize=parseFloat(s)*2+'px');});
  await page.addStyleTag({content:'main *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}main p{margin-bottom:2em!important}'});await fit(url+' 200% text and spacing');
 }
 await page.emulateMedia({forcedColors:'active'});await page.goto(base+'/writing/#essay-revision');await page.locator('#revision-start').focus();
 assert.equal(await page.locator('#revision-start').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 await page.screenshot({path:path.join(output,'forced-colors.png')});
 await page.emulateMedia({forcedColors:'none',colorScheme:'dark'});await page.evaluate(()=>localStorage.removeItem('hsk4_theme'));await page.reload();
 // addInitScript intentionally sets an explicit choice in this context; use fresh context for OS preference.
 const system=await browser.newContext({colorScheme:'dark'});await system.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());const sp=await system.newPage();await sp.goto(base+'/writing/');assert.equal(await sp.locator('html').getAttribute('data-theme'),'dark');await system.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));
 await browser.close();console.log(`${report.length} contrast states passed; keyboard, focus, reflow, text resize, forced colors and system dark preference passed.`);
})().catch(e=>{console.error(e);process.exit(1)});
