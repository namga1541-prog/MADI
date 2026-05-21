var CACHE_NAME = "madi-v5-20260521-2040";
// 외부 API · 인증 응답은 캐시하지 않는다 (민감 응답 보호)
var SKIP_HOSTS = ["api.anthropic.com","googleapis.com"];
// 경로 기반 차단 — Supabase Edge Function 및 REST/Storage/Auth 응답
var SKIP_PATH_FRAGMENTS = ["/functions/v1/","/rest/v1/","/storage/v1/","/auth/v1/"];

// SWR 대상 호스트 (정적 CDN)
var SWR_HOSTS = ["cdnjs.cloudflare.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"];

self.addEventListener("install", function(e) { self.skipWaiting(); });
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return clients.claim(); })
  );
});

// network-first: 매번 네트워크 시도 → 성공 시 캐시 갱신, 실패 시 캐시 폴백
function networkFirst(req) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200 && res.type !== "opaque") {
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function(c) { c.put(req, clone); });
    }
    return res;
  }).catch(function() { return caches.match(req); });
}

// stale-while-revalidate: 캐시 즉시 응답 + 백그라운드 갱신
// 두 번째 방문부터 즉시 표시 (네트워크 대기 없음)
function staleWhileRevalidate(req) {
  return caches.match(req).then(function(cached) {
    var networkPromise = fetch(req).then(function(res) {
      if (res && res.status === 200 && res.type !== "opaque") {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, clone); });
      }
      return res;
    }).catch(function() { return cached; });
    return cached || networkPromise;
  });
}

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  // 호스트 차단 (외부 API)
  if (SKIP_HOSTS.indexOf(url.hostname) !== -1) return;
  if (url.hostname.endsWith(".supabase.co")) return;
  // 동일 출처 내에서도 API 경로는 캐시 안 함
  if (SKIP_PATH_FRAGMENTS.some(function(p){ return url.pathname.indexOf(p) !== -1; })) return;

  // HTML 문서는 network-first 유지 — 배포 즉시 반영
  var isHTML = e.request.destination === 'document'
            || url.pathname.endsWith('.html')
            || url.pathname === '/' || url.pathname.endsWith('/');
  if (isHTML) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // 정적 CDN 자산 (Chart.js, xlsx, supabase-js, fonts): SWR
  if (SWR_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  // 동일 출처 정적 자산 (JS, CSS, 이미지, 폰트, 매니페스트): SWR
  // → 재방문 시 즉시 표시, 백그라운드에서 새 버전 받음
  e.respondWith(staleWhileRevalidate(e.request));
});
