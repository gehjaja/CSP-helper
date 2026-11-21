const prefix = "csp-practice:" + self.registration.scope + ":";
const cacheName = prefix + "2026-11-21.2";
const files = ["index.html","paper.js","review.js","runner.js","sample-frame.html","python-refs.js","manifest.webmanifest","icon-192.png","icon-512.png"];
const urls = files.map(file => new URL(file,self.registration.scope).href);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(urls.map(url=>new Request(url,{cache:"reload"})))));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for(const key of await caches.keys()){
      if(key.startsWith(prefix) && key!==cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  url.search="";
  const asset=url.href===self.registration.scope ? urls[0] : url.href;
  if(!urls.includes(asset)) return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(asset)) || fetch(event.request)));
});
