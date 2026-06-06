var CACHE_NAME = "madi-v5-20260606-172350";
// 외부 API · 인증 응답은 캐시하지 않는다 (민감 응답 보호)
var SKIP_HOSTS = ["api.anthropic.com","googleapis.com"];
// 경로 기반 차단 — Supabase Edge Function 및 REST/Storage/Auth 응답
var SKIP_PATH_FRAGMENTS = ["/functions/v1/","/rest/v1/","/storage/v1/","/auth/v1/"];

// SWR 대상 호스트 (정적 CDN)
var SWR_HOSTS = ["cdnjs.cloudflare.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"];

// 오프라인 폴백 페이지 — 네트워크 실패 + 캐시 미스 시 표시
var OFFLINE_URL = "./offline.html";

self.addEventListener("install", function(e) {
  // 설치 즉시 오프라인 페이지를 캐시에 적재 (네트워크 끊긴 상태에서도 표시 가능)
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(c) {
      return c.add(new Request(OFFLINE_URL, { cache: "reload" }));
    }).catch(function(){ /* 첫 설치 시 네트워크 실패해도 무시 */ })
  );
  self.skipWaiting();
});
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return clients.claim(); })
  );
});

// network-first: 매번 네트워크 시도 → 성공 시 캐시 갱신, 실패 시 캐시 폴백
// HTML 문서는 캐시도 없으면 오프라인 페이지로 폴백
// e: FetchEvent — cache.put 을 e.waitUntil() 에 연결해 SW 종료 전 완료 보장
function networkFirst(req, isHTML, e) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200 && res.type !== "opaque") {
      var clone = res.clone();
      var cacheWrite = caches.open(CACHE_NAME).then(function(c) { return c.put(req, clone); });
      if (e) e.waitUntil(cacheWrite);
    }
    return res;
  }).catch(function() {
    return caches.match(req).then(function(cached) {
      if (cached) return cached;
      if (isHTML) {
        return caches.match(OFFLINE_URL).then(function(offlinePage) {
          return offlinePage || new Response('오프라인 상태입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      }
      return Response.error();
    });
  });
}

// stale-while-revalidate: 캐시 즉시 응답 + 백그라운드 갱신
// 두 번째 방문부터 즉시 표시 (네트워크 대기 없음)
// e: FetchEvent — 백그라운드 cache.put 을 e.waitUntil() 에 연결해 SW 종료 전 완료 보장
function staleWhileRevalidate(req, e) {
  return caches.match(req).then(function(cached) {
    var networkPromise = fetch(req).then(function(res) {
      if (res && res.status === 200 && res.type !== "opaque") {
        var clone = res.clone();
        var cacheWrite = caches.open(CACHE_NAME).then(function(c) { return c.put(req, clone); });
        if (e) e.waitUntil(cacheWrite);
      }
      return res;
    }).catch(function() { return cached || Response.error(); });
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
    e.respondWith(networkFirst(e.request, true, e));
    return;
  }

  // 정적 CDN 자산 (Chart.js, xlsx, supabase-js, fonts): SWR
  if (SWR_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(staleWhileRevalidate(e.request, e));
    return;
  }

  // 동일 출처 앱 코드 (JS/CSS): network-first
  // → SWR 는 "옛 캐시 먼저 서빙 + 다음 로드에 갱신" 이라, 설치형 PWA 에서
  //   배포한 코드 수정이 디바이스에서 영영 실행되지 않는 문제가 있었음.
  //   코드 파일만큼은 온라인이면 항상 최신을 받고, 오프라인일 때만 캐시 폴백.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(networkFirst(e.request, false, e));
    return;
  }

  // 그 외 동일 출처 정적 자산 (이미지, 아이콘, 폰트, 매니페스트): SWR
  // → 자주 안 바뀌고 용량이 크므로 캐시 우선 + 백그라운드 갱신
  e.respondWith(staleWhileRevalidate(e.request, e));
});

// ─── Web Push 핸들러 ───────────────────────────────────────────────
// 아이콘·기본 URL 은 self.registration.scope 기반으로 동적 생성 →
// 커스텀 도메인 이전 시(예: madi.kr) 자동 적응. 하드코딩 금지.
function _scopeUrl(rel) {
  try { return new URL(rel, self.registration.scope).href; }
  catch (e) { return rel; }
}

self.addEventListener("push", function(e) {
  var data = {};
  try { if (e.data) data = e.data.json(); } catch(_) {}
  var title = data.title || '마디';
  var targetUrl = data.url || self.registration.scope;
  // 같은 origin인지 검증 — 외부 URL로 리다이렉트 방지
  try {
    var parsed = new URL(targetUrl);
    var scopeParsed = new URL(self.registration.scope);
    if (parsed.origin !== scopeParsed.origin) targetUrl = self.registration.scope;
  } catch(e) {
    targetUrl = self.registration.scope;
  }
  var opts = {
    body: data.body || '',
    icon:  _scopeUrl('icon-192.png'),
    badge: _scopeUrl('icon-192.png'),
    data:  { url: targetUrl },
    requireInteraction: false
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url)
    || self.registration.scope;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        // target URL 과 일치하는 창이 이미 있으면 포커스 (URL 불일치 창은 건너뜀)
        if (list[i].url === target && 'focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
