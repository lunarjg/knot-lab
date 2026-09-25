const vm=require('vm'),fs=require('fs'),assert=require('assert');
async function check(unauthorized=false){
 const hooks={},saved=new Map();let offline=false,claimed=false;
 const cache={put:async(k,v)=>saved.set(k.url||k,v.clone()),match:async(k)=>saved.get(k.url||k)?.clone()};
 const scope='https://knot.test/';
 const ctx={URL,Request,Response,Set,Error,self:{registration:{scope},location:{origin:'https://knot.test'},addEventListener:(k,f)=>hooks[k]=f,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}},caches:{open:async()=>cache,keys:async()=>['knot-lab-v1'],delete:async()=>{},match:cache.match},fetch:async req=>{
  if(offline)throw new Error('offline');
  const path=new URL(req.url||req).pathname;
  return new Response(path==='/'||path==='/index.html'?unauthorized?'Sign in required':'<div id="knot-lab-app">App</div>':'asset',{status:200});
 }};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/sw.js','utf8'),ctx);
 let promise;hooks.install({waitUntil:p=>promise=p});
 if(unauthorized){await assert.rejects(promise,/Expected application page/);return;}
 await promise;assert.equal(saved.size,17);hooks.activate({waitUntil:p=>promise=p});await promise;assert(claimed);
 offline=true;hooks.fetch({request:{method:'GET',url:scope,mode:'navigate'},respondWith:p=>promise=p});assert((await(await promise).text()).includes('knot-lab-app'));
 hooks.fetch({request:{method:'GET',url:scope+'research.html',mode:'navigate'},respondWith:p=>promise=p});assert.equal(await(await promise).text(),'asset','offline research navigation keeps the guide instead of opening the editor');
 hooks.fetch({request:new Request(scope+'pd-import.js'),respondWith:p=>promise=p});assert.equal(await(await promise).text(),'asset');
 for(const asset of ['invariants.js','invariants-worker.js','knot-core.js','seifert.js','graph-blocks.js','research-analysis.js','research-ui.js','research-dataset.js','research-worker.js','research.css','research.html']){hooks.fetch({request:new Request(scope+asset),respondWith:p=>promise=p});assert.equal(await(await promise).text(),'asset');}
 let intercepted=false;hooks.fetch({request:new Request(scope+'private-api'),respondWith:()=>intercepted=true});assert(!intercepted);
}
(async()=>{await check();await check(true);console.log('Offline install, activation, navigation/assets fallback, route isolation and login-page rejection: PASS');})().catch(e=>{console.error(e);process.exitCode=1});
