var CACHE_NAME = "madi-v4-20260506-0731";
var SKIP_URLS = ["api.anthropic.com","supabase.co","googleapis.com","cdnjs","jsdelivr","fonts.g"];
self.addEventListener("install", function(e) { self.skipWaiting(); });
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return clients.claim(); })
  );
});
self.addEventListener("fetch", function(e) {
  var url = e.request.url;
  if (SKIP_URLS.some(function(s){ return url.includes(s); })) return;
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (!res || res.status !== 200 || res.type === "opaque") return res;
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});