'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const patterns=JSON.parse(fs.readFileSync(path.join(root,'data/grammar-patterns.json'),'utf8'));
const content=require('./grammar-pattern-content');
let total=0;
for(const pat of patterns){
  const html=fs.readFileSync(path.join(root,'grammar/patterns',pat.slug,'index.html'),'utf8');
  assert.equal(content.enrich(html,pat),html,'Refresh must be idempotent: '+pat.slug);
  assert.equal((html.match(/src="\/grammar\/pattern-practice.js"/g)||[]).length,1);
  assert.ok(!html.includes('ans.indexOf(val) === 0'));
  assert.ok(!html.includes('Mock Test Questions Using'));
  assert.ok(!html.includes('不聊明'));
  assert.equal((html.match(/class="fill-input"/g)||[]).length,pat.exercises.reduce((n,e)=>n+e.sentence.split('___').length-1,0));
  for(const ex of pat.exercises){
    assert.ok(ex.explanation&&ex.hint);
    for(const accepted of ex.answers){assert.equal(accepted.length,ex.sentence.split('___').length-1);assert.ok(accepted.every(Boolean));}
    total++;
  }
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(match[1].includes('application/ld+json'))JSON.parse(match[2]);
    else if(!match[1].includes('src='))new vm.Script(match[2]);
  }
}
// Exercise the real build function, including customHtml, without rebuilding unrelated pages.
const source=fs.readFileSync(path.join(root,'build.js'),'utf8');
const start=source.indexOf('function buildGrammarPatternPages()');
const end=source.indexOf('function buildGrammarPatternsHub()',start);
const next=end===-1?source.indexOf('// 13.',start):end;
assert.ok(next>start);
const written=new Map();
const fakeFs={readFileSync:(p)=>fs.readFileSync(p,'utf8'),writeFileSync:(p,s)=>written.set(p,s)};
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ctx={fs:fakeFs,path,ROOT:root,console:{log(){}},GrammarPractice:content,ensureDir(){},escHtml:esc,truncDesc:s=>s,SITEMAP_PAGES:[],readJSON:n=>{assert.equal(n,'grammar-patterns.json');return patterns;},generateFillExercises:()=>'<h2>Fill in the Blank</h2>'};
vm.createContext(ctx);vm.runInContext(source.slice(start,next)+'\nbuildGrammarPatternPages();',ctx);
assert.equal(written.size,patterns.length);
for(const html of written.values()){assert.equal((html.match(/data-reviewed="grammar-20261020"/g)||[]).length,3);assert.equal((html.match(/src="\/grammar\/pattern-practice.js"/g)||[]).length,1);assert.ok(html.includes('id="usage-check"'));}
console.log(`Grammar checks passed: ${patterns.length} pages, ${total} fill exercises; full build and custom-page refresh verified.`);
