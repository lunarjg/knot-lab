'use strict';
const CACHE='knot-lab-v49-research-audit';
const FILES=['./','./index.html','./pd-import.js','./knot-core.js','./seifert.js','./graph-blocks.js','./research-analysis.js','./research-dataset.js','./research-ui.js','./research-worker.js','./research.css','./research.html','./invariants.js','./invariants-worker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const path of FILES){
      const request=new Request(new URL(path,self.registration.scope),{cache:'reload',credentials:'same-origin'});
      const response=await fetch(request);
      if(!response.ok||response.redirected)throw new Error('Offline files unavailable');
      if((path==='./'||path==='./index.html')&&!(await response.clone().text()).includes('id="knot-lab-app"'))throw new Error('Expected application page');
      await cache.put(request,response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('knot-lab-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const assets=new Set(FILES.map(p=>new URL(p,self.registration.scope).pathname));
  if(request.mode==='navigate'){
    if(!assets.has(url.pathname))return;
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok&&!response.redirected&&(await response.clone().text()).includes('id="knot-lab-app"')){
          const cache=await caches.open(CACHE);await cache.put(new URL('./',self.registration.scope).href,response.clone());
        }
        return response;
      }catch(error){const target=url.pathname===new URL('./research.html',self.registration.scope).pathname?request:new URL('./',self.registration.scope).href;const cached=await caches.match(target,{ignoreSearch:true});if(cached)return cached;throw error;}
    })());
  } else if(assets.has(url.pathname)){
    event.respondWith(fetch(request).catch(async error=>{const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;throw error;}));
  }
});
