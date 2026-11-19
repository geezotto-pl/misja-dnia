// Misja Dnia: zawsze najnowsza wersja z internetu (z pominięciem pamięci podręcznej przeglądarki), bez internetu kopia.
var C="misja-dnia-v12";
var FILES=["./","index.html","game.js","misje.json","manifest.json","avatar.js","avatar2.js","icon-192.png","icon-512.png","fonts/caveat-latin-700-normal.woff2","fonts/caveat-latin-ext-700-normal.woff2"];
self.addEventListener("install",function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return c.addAll(FILES.map(function(f){return new Request(f,{cache:"reload"})}))}).catch(function(){}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request.url,{cache:"no-cache",credentials:"same-origin"}).then(function(r){if(r.ok){var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp)})}return r}).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(r){return r||caches.match("index.html")})}));
});
