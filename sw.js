var CACHE_NAME = "madi-v4-20260521-2029";
// 외부 API · 인증 응답은 캐시하지 않는다 (민감 응답 보호)
var SKIP_HOSTS = ["api.anthropic.com","googleapis.com","cdnjs.cloudflare.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"];
// 경로 기반 차단 — Supabase Edge Function 및 REST/Storage 응답
var SKIP_PATH_FRAGMENTS = ["/functions/v1/","/rest/v1/","/storage/v1/","/auth/v1/"];
self.addEventListener("install", function(e) { self.skipWaiting(); });
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return clients.claim(); })
  );
});
self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  // 호스트명 정확 일치 또는 supabase.co 서브도메인 (예: <ref>.supabase.co)
  if (SKIP_HOSTS.indexOf(url.hostname) !== -1) return;
  if (url.hostname.endsWith(".supabase.co")) return;
  // 동일 출처 내에서도 API 경로는 캐시 안 함
  if (SKIP_PATH_FRAGMENTS.some(function(p){ return url.pathname.indexOf(p) !== -1; })) return;
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