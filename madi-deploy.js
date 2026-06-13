// ═══════════════════════════════════════════════════════════════════════════
// madi-deploy.js — GitHub 자동 배포 + 마디 폴더 핸들(IndexedDB)
//   madi-system.js("권한·배포·PWA·IndexedDB·초기화"의 잡동사니 서랍)에서
//   응집도 높은 "원클릭 GitHub 배포" 기능 일체를 분리한 파일.
//   진입점: deployToGitHub() (index.html 헤더 🚀 배포 버튼). SW_CODE 는 PWA(madi-system.js)도 참조.
//
//   ⚠️ 로드 순서: madi-core.js 뒤 / madi-system.js 앞.
//      (system.js 하단이 로드시점에 _cleanupLegacyGithubToken() 를 호출하고,
//       PWA 가 런타임에 SW_CODE 를 참조하므로 deploy 가 먼저 정의되어야 한다.)
// ═══════════════════════════════════════════════════════════════════════════

// ─────── 마디 폴더 핸들 관리 (IndexedDB) ───────
function _openMadiDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('madi_deploy', 1);
    req.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function() { reject(req.error); };
    // 다른 탭이 이전 버전 연결을 잡고 있으면 업그레이드가 blocked — 사용자 안내(M-26)
    req.onblocked = function() { if (typeof showToast === 'function') showToast('⚠️ 다른 탭에서 마디가 열려 있어 저장소 접근이 지연됩니다. 다른 탭을 닫아주세요.'); };
  });
}
function _saveFolderHandle(handle) {
  return _openMadiDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'madiFolder');
      // 작업 완료/실패 시 연결을 닫아 향후 스키마 업그레이드 blocked 방지(M-26)
      tx.oncomplete = function() { db.close(); resolve(); };
      tx.onerror = function() { db.close(); reject(tx.error); };
      tx.onabort = function() { db.close(); reject(tx.error || new Error('IDB 트랜잭션이 중단되었습니다')); };
    });
  });
}
function _loadFolderHandle() {
  return _openMadiDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction('handles', 'readonly');
      var req = tx.objectStore('handles').get('madiFolder');
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror = function() { resolve(null); };
      tx.oncomplete = function() { db.close(); };
      tx.onabort = function() { db.close(); resolve(null); };
    });
  });
}
function getMadiFolderHandle() {
  return _loadFolderHandle().then(function(handle) {
    if (!handle) {
      showToast('📁 마디 폴더를 선택해주세요');
      return window.showDirectoryPicker({ mode: 'read' })
        .then(function(h) { return _saveFolderHandle(h).then(function() { return h; }); });
    }
    return handle.queryPermission({ mode: 'read' }).then(function(perm) {
      if (perm === 'granted') return handle;
      return handle.requestPermission({ mode: 'read' }).then(function(p) {
        if (p === 'granted') return handle;
        showToast('📁 폴더 접근 권한이 필요합니다. 다시 선택해주세요');
        return window.showDirectoryPicker({ mode: 'read' })
          .then(function(h) { return _saveFolderHandle(h).then(function() { return h; }); });
      });
    });
  });
}

// ─────── GitHub 자동 배포 ───────
var GITHUB_OWNER = 'namga1541-prog';
var GITHUB_REPO  = 'MADI';
var GITHUB_FILE  = 'index.html';
var GITHUB_SW    = 'sw.js';

// 인라인 SW 폴백 — 실제 sw.js 와 동기화 유지 (캐시명·SWR·푸시·notificationclick·offline·민감경로 차단).
// 평상시 배포는 폴더의 실제 sw.js 파일을 직접 업로드하며, 이 상수는 다음 두 경우에만 사용:
//   ① 배포 중 폴더에서 sw.js 를 못 읽을 때 폴백, ② ./sw.js 등록 실패 시 Blob URL 폴백(initPWA).
var _swNow = nowKST();
// 실제 sw.js(pre-commit)와 동일하게 초(%S)까지 포함 — 분 단위면 같은 분 커밋·재로드 시
//   폴백 캐시명이 충돌해 activate 단계의 옛 캐시 정리가 무력화될 수 있다.
var SW_BUILD = 'madi-v5-' + ymd(_swNow).replace(/-/g,'')
             + '-' + String(_swNow.getHours()).padStart(2,'0')
             + String(_swNow.getMinutes()).padStart(2,'0')
             + String(_swNow.getSeconds()).padStart(2,'0');
var SW_LINES = [
  'var CACHE_NAME = "' + SW_BUILD + '";',
  'var SKIP_HOSTS = ["api.anthropic.com","googleapis.com"];',
  'var SKIP_PATH_FRAGMENTS = ["/functions/v1/","/rest/v1/","/storage/v1/","/auth/v1/"];',
  'var SWR_HOSTS = ["cdnjs.cloudflare.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"];',
  'var OFFLINE_URL = "./offline.html";',
  'self.addEventListener("install", function(e) {',
  '  e.waitUntil(',
  '    caches.open(CACHE_NAME).then(function(c) {',
  '      return c.add(new Request(OFFLINE_URL, { cache: "reload" }));',
  '    }).catch(function(){})',
  '  );',
  '  self.skipWaiting();',
  '});',
  'self.addEventListener("activate", function(e) {',
  '  e.waitUntil(',
  '    caches.keys().then(function(keys) {',
  '      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));',
  '    }).then(function(){ return clients.claim(); })',
  '  );',
  '});',
  'function networkFirst(req, isHTML, e) {',
  '  return fetch(req).then(function(res) {',
  '    if (res && res.status === 200 && res.type !== "opaque") {',
  '      var clone = res.clone();',
  '      var cacheWrite = caches.open(CACHE_NAME).then(function(c) { return c.put(req, clone); });',
  '      if (e) e.waitUntil(cacheWrite);',
  '    }',
  '    return res;',
  '  }).catch(function() {',
  '    return caches.match(req).then(function(cached) {',
  '      if (cached) return cached;',
  '      if (isHTML) {',
  '        return caches.match(OFFLINE_URL).then(function(offlinePage) {',
  '          return offlinePage || new Response("오프라인 상태입니다.", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });',
  '        });',
  '      }',
  '      return Response.error();',
  '    });',
  '  });',
  '}',
  'function staleWhileRevalidate(req, e) {',
  '  return caches.match(req).then(function(cached) {',
  '    var networkPromise = fetch(req).then(function(res) {',
  '      if (res && res.status === 200 && res.type !== "opaque") {',
  '        var clone = res.clone();',
  '        var cacheWrite = caches.open(CACHE_NAME).then(function(c) { return c.put(req, clone); });',
  '        if (e) e.waitUntil(cacheWrite);',
  '      }',
  '      return res;',
  '    }).catch(function() { return cached || Response.error(); });',
  '    return cached || networkPromise;',
  '  });',
  '}',
  'self.addEventListener("fetch", function(e) {',
  '  if (e.request.method !== "GET") return;',
  '  var url;',
  '  try { url = new URL(e.request.url); } catch (err) { return; }',
  '  if (SKIP_HOSTS.indexOf(url.hostname) !== -1) return;',
  '  if (url.hostname.endsWith(".supabase.co")) return;',
  '  if (SKIP_PATH_FRAGMENTS.some(function(p){ return url.pathname.indexOf(p) !== -1; })) return;',
  '  var isHTML = e.request.destination === "document" || url.pathname.endsWith(".html") || url.pathname === "/" || url.pathname.endsWith("/");',
  '  if (isHTML) { e.respondWith(networkFirst(e.request, true, e)); return; }',
  '  if (SWR_HOSTS.indexOf(url.hostname) !== -1) { e.respondWith(staleWhileRevalidate(e.request, e)); return; }',
  '  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) { e.respondWith(networkFirst(e.request, false, e)); return; }',
  '  e.respondWith(staleWhileRevalidate(e.request, e));',
  '});',
  'function _scopeUrl(rel) {',
  '  try { return new URL(rel, self.registration.scope).href; }',
  '  catch (e) { return rel; }',
  '}',
  'self.addEventListener("push", function(e) {',
  '  var data = {};',
  '  try { if (e.data) data = e.data.json(); } catch(_) {}',
  '  var title = data.title || "마디";',
  '  var targetUrl = data.url || self.registration.scope;',
  '  try {',
  '    var parsed = new URL(targetUrl);',
  '    var scopeParsed = new URL(self.registration.scope);',
  '    if (parsed.origin !== scopeParsed.origin) targetUrl = self.registration.scope;',
  '  } catch(e) { targetUrl = self.registration.scope; }',
  '  var opts = {',
  '    body: data.body || "",',
  '    icon:  _scopeUrl("icon-192.png"),',
  '    badge: _scopeUrl("icon-192.png"),',
  '    data:  { url: targetUrl },',
  '    requireInteraction: false',
  '  };',
  '  e.waitUntil(self.registration.showNotification(title, opts));',
  '});',
  'self.addEventListener("notificationclick", function(e) {',
  '  e.notification.close();',
  '  var target = (e.notification.data && e.notification.data.url) || self.registration.scope;',
  '  e.waitUntil(',
  '    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list) {',
  '      for (var i = 0; i < list.length; i++) {',
  '        if (list[i].url === target && "focus" in list[i]) return list[i].focus();',
  '      }',
  '      if (clients.openWindow) return clients.openWindow(target);',
  '    })',
  '  );',
  '});'
];
var SW_CODE = SW_LINES.join(String.fromCharCode(10));

// ─────── GitHub 배포 — Edge Function 프록시 방식 ───────
// GitHub PAT 는 클라이언트에 저장하지 않음.
// 대신 Supabase Edge Function /github-deploy 를 통해 서버사이드에서 처리.
// 이전에 IndexedDB/localStorage 에 저장된 토큰이 있으면 마이그레이션 시 자동 삭제.

function _cleanupLegacyGithubToken() {
  // 구버전 토큰 잔재 제거 (1회성 마이그레이션)
  try { localStorage.removeItem('madi_gh_token'); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  _openMadiDB().then(function(db) {
    var tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete('gh_token');
    // 트랜잭션 종료 핸들러 + 연결 닫기 (M-25 — 중단/실패 무시 방지, 연결 누수 방지)
    tx.oncomplete = function() { db.close(); };
    tx.onerror    = function() { db.close(); };
    tx.onabort    = function() { db.close(); };
  }).catch(function() {});
}

function deployFileViaProxy(filename, textContent, commitMsg) {
  if (!currentUser || currentUser.role !== 'superadmin') {
    showToast('⚠️ 슈퍼관리자만 배포할 수 있습니다.');
    return Promise.reject(new Error('권한 없음'));
  }
  return fetch(EDGE_URL + '/github-deploy', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'deploy',
      files:  [{ name: filename, content: textContent, commitMsg: commitMsg }]
    })
  }).then(function(r) {
    return r.json().then(function(data) {
      if (!r.ok || !data.ok) throw new Error(data.error || filename + ' 업로드 실패');
      return data;
    }).catch(function(err) {
      if (err && err.message && err.message.indexOf('업로드 실패') !== -1) throw err;
      throw new Error('배포 실패: 서버 응답을 처리할 수 없습니다.');
    });
  });
}

// ─────── 배포 대상 파일 자동 스캔 ───────
// 폴더 핸들에서 madi-NN.js 패턴 자동 감지 → 자연 정렬 → madi.css는 마지막에
// 새 madi-XX.js 추가해도 자동 포함 (하드코딩 제거)
function scanMadiFiles(folderHandle) {
  var iterator = folderHandle.values();
  var jsFiles = [];
  var hasCss = false;
  function next() {
    return iterator.next().then(function(result) {
      if (result.done) return;
      var entry = result.value;
      if (entry.kind === 'file') {
        if (/^madi-\d+\.js$/.test(entry.name)) jsFiles.push(entry.name);
        else if (entry.name === 'madi.css') hasCss = true;
      }
      return next();
    });
  }
  return next().then(function() {
    // 자연 정렬: madi-01 < madi-02 < ... < madi-13
    jsFiles.sort(function(a, b) {
      var na = a.match(/\d+/) ? parseInt(a.match(/\d+/)[0], 10) : 0;
      var nb = b.match(/\d+/) ? parseInt(b.match(/\d+/)[0], 10) : 0;
      return na - nb;
    });
    if (hasCss) jsFiles.push('madi.css');
    return jsFiles;
  });
}

// ─────── 파일 내용 → Git blob SHA-1 계산 ───────
// GitHub의 blob SHA 알고리즘: SHA1('blob {size}\0{content}')
// 동일 SHA = 동일 내용 (mtime만 바뀌고 내용 같으면 같은 SHA)
function gitBlobSha(content) {
  var enc    = new TextEncoder();
  var body   = enc.encode(content);
  var header = enc.encode('blob ' + body.length + '\0');
  var data   = new Uint8Array(header.length + body.length);
  data.set(header, 0);
  data.set(body, header.length);
  return crypto.subtle.digest('SHA-1', data).then(function(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function(b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  });
}

// ─────── GitHub Pages 빌드 상태 폴링 (Edge Function 프록시) ───────
function pollGithubPagesBuild(deployStartTs) {
  var attempts    = 0;
  var MAX_TRY     = 30;
  var INTERVAL_MS = 5000;
  function poll() {
    return fetch(EDGE_URL + '/github-deploy', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'poll', deployStartTs: deployStartTs })
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(build) {
      attempts++;
      var buildTs = build.created_at ? new Date(build.created_at).getTime() : 0;
      if (buildTs < deployStartTs) {
        if (attempts >= MAX_TRY) { showToast('⏰ 빌드 시작 대기 시간 초과', { duration: 5000 }); return; }
        return new Promise(function(r){ setTimeout(r, INTERVAL_MS); }).then(poll);
      }
      if (build.status === 'built') {
        showToast('🌐 GitHub Pages 반영 완료! 새로고침하면 보입니다.', { duration: 7000 });
      } else if (build.status === 'errored') {
        var err = (build.error && build.error.message) || '알 수 없는 오류';
        showToast('❌ GitHub Pages 빌드 실패: ' + err, { duration: 9000 });
      } else {
        if (attempts >= MAX_TRY) { showToast('⏰ 빌드 진행 중 — 잠시 후 사이트 확인', { duration: 5000 }); return; }
        return new Promise(function(r){ setTimeout(r, INTERVAL_MS); }).then(poll);
      }
    })
    .catch(function(e) {
      showToast('⚠️ ' + _userErrMsg(e, '빌드 상태 확인'), { duration: 5000 });
    });
  }
  setTimeout(poll, 5000);
}

function deployToGitHub() {
  if (!currentUser || currentUser.role !== 'superadmin') {
    showToast('⚠️ 슈퍼관리자만 배포할 수 있습니다.');
    return;
  }
  // GitHub PAT 는 서버(Edge Function)에서 관리 — 클라이언트 불필요
  // 구버전 IndexedDB 토큰 잔재 정리
  _cleanupLegacyGithubToken();

  var btn = document.getElementById('headerDeployBtn');
  if (!btn) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled    = true;
  btn.textContent = '⏳ 배포 중...';

  var commitTime = new Date().toLocaleString('ko-KR');

  if (!window.showDirectoryPicker) {
    btn.dataset.busy = '';
    btn.disabled = false; btn.textContent = '🚀 배포';
    showToast('❌ Chrome 또는 Edge에서만 사용 가능합니다.');
    return;
  }

  // 배포 대상 파일은 폴더 스캔 + SHA 변경 감지로 동적 결정
  var JS_FILES, ALL_FILES, TOTAL_FILES, FILES_TO_UPLOAD;
  var _madiFolderHandle = null; // sw.js 직접 읽기용 — 이후 .then 단계에서 재사용
  var deployStartTs = Date.now(); // GitHub Pages 빌드 폴링 기준 시각

  showToast('📡 배포 준비 중...');

  getMadiFolderHandle()
    .then(function(folderHandle) {
      _madiFolderHandle = folderHandle;
      return scanMadiFiles(folderHandle).then(function(jsFiles) {
        if (jsFiles.length === 0) throw new Error('madi-*.js 파일을 찾을 수 없습니다');
        JS_FILES  = jsFiles;
        ALL_FILES = ['index.html', 'admin.html'].concat(JS_FILES);

        // 각 파일의 내용 + SHA 동시 계산 (이전 SHA와 비교해 변경 판정)
        var lastDeployIso = localStorage.getItem('madi_last_deploy');
        var prevShas      = {};
        try { prevShas = JSON.parse(localStorage.getItem('madi_deploy_shas') || '{}') || {}; } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }

        return Promise.all(ALL_FILES.map(function(name) {
          return folderHandle.getFileHandle(name)
            .then(function(fh) { return fh.getFile(); })
            .then(function(f) {
              return f.text().then(function(content) {
                return gitBlobSha(content).then(function(sha) {
                  return {
                    name:    name,
                    content: content,
                    sha:     sha,
                    changed: prevShas[name] !== sha
                  };
                });
              });
            })
            .catch(function() { return { name: name, content: null, sha: '', changed: false }; });
        })).then(function(fileInfos) {
          // 유효 파일 필터 + index.html 존재 검사
          var valid    = fileInfos.filter(function(f){ return f.content !== null; });
          var hasIndex = valid.some(function(f){ return f.name === 'index.html'; });
          if (!hasIndex) throw new Error('index.html 읽기 실패 — 폴더에 없거나 접근 불가');

          var changed     = valid.filter(function(f){ return f.changed; });
          var unchanged   = valid.filter(function(f){ return !f.changed; });
          var firstDeploy = !lastDeployIso;
          var NL          = String.fromCharCode(10);
          var lastText    = lastDeployIso
            ? '마지막 배포: ' + new Date(lastDeployIso).toLocaleString('ko-KR')
            : '마지막 배포: 기록 없음 (첫 배포)';

          // 업로드 대상 결정: 첫 배포 또는 변경 0건이면 전체, 아니면 변경분만
          var willUpload = [];
          var confirmPromise;
          if (firstDeploy) {
            willUpload = valid;
            confirmPromise = Promise.resolve();
          } else if (changed.length === 0) {
            var msg = lastText + NL + NL
                    + '⏸️ 마지막 배포 이후 내용이 변경된 파일이 없습니다.' + NL
                    + '(SHA-1 해시 비교 — 저장만 했고 내용 동일한 파일은 자동 제외됨)' + NL + NL
                    + '그래도 ' + valid.length + '개 파일을 모두 배포하시겠습니까?';
            confirmPromise = new Promise(function(res, rej) {
              showConfirm(msg, res, { danger: false, okLabel: '배포', onCancel: function() { rej(new Error('USER_CANCEL')); } });
            }).then(function() { willUpload = valid; });
          } else {
            willUpload = changed;
            confirmPromise = Promise.resolve();
          }

          // 미리보기 다이얼로그 — confirmPromise 해소 후 willUpload 사용 보장
          return confirmPromise.then(function() {
            var lines = [lastText, ''];
            lines.push('✏️ 배포 대상 ' + willUpload.length + '개:');
            willUpload.forEach(function(f, i) { lines.push('  ' + (i + 1) + '. ' + f.name); });
            var skipped = valid.length - willUpload.length;
            if (skipped > 0) {
              lines.push('');
              lines.push('⏸️ 미변경 ' + skipped + '개 (SHA 동일, 건너뜀):');
              unchanged.forEach(function(f) { lines.push('  · ' + f.name); });
            }
            lines.push('', '+ sw.js (자동 캐시 갱신)', '', '진행하시겠습니까?');
            var _finalMsg = lines.join(NL);
            var _finalUpload = willUpload;
            return new Promise(function(res, rej) {
              showConfirm(_finalMsg, res, { danger: false, okLabel: '배포', onCancel: function() { rej(new Error('USER_CANCEL')); } });
            }).then(function() {
              FILES_TO_UPLOAD = _finalUpload;
              TOTAL_FILES     = _finalUpload.length + 1;
              var allShas = {};
              valid.forEach(function(f){ allShas[f.name] = f.sha; });
              FILES_TO_UPLOAD.allShas = allShas;
              return _finalUpload;
            });
          });
        });
      });
    })
    .then(function(filesToUpload) {
      // 순차 업로드 (커밋 메시지는 파일 종류에 따라)
      var step = 1;
      return filesToUpload.reduce(function(chain, fi) {
        return chain.then(function() {
          showToast('📡 ' + fi.name + ' 업로드 중... (' + step + '/' + TOTAL_FILES + ')');
          step++;
          var msg;
          if (fi.name === 'index.html')      msg = '마디 앱 업데이트 — ' + commitTime;
          else if (fi.name === 'admin.html') msg = '마디 관리자 업데이트 — ' + commitTime;
          else if (fi.name === 'madi.css')   msg = '마디 CSS 업데이트 — ' + commitTime;
          else                                msg = '마디 JS 업데이트 — ' + commitTime;
          return deployFileViaProxy(fi.name, fi.content, msg);
        });
      }, Promise.resolve());
    })
    .then(function() {
      // sw.js는 항상 업로드 (캐시 갱신 보장)
      // 실제 레포의 sw.js 를 폴더에서 직접 읽어 그대로 업로드 → 인라인 구버전 롤백 방지.
      // 폴더에서 sw.js 를 못 읽으면 동기화된 인라인 SW_CODE 로 폴백.
      showToast('📡 sw.js 업로드 중... (' + TOTAL_FILES + '/' + TOTAL_FILES + ')');
      return _madiFolderHandle.getFileHandle(GITHUB_SW)
        .then(function(fh) { return fh.getFile(); })
        .then(function(f) { return f.text(); })
        .catch(function() { return SW_CODE; })
        .then(function(swContent) {
          if (!swContent) swContent = SW_CODE;
          return deployFileViaProxy(GITHUB_SW, swContent, '마디 SW 업데이트 — ' + commitTime);
        });
    })
    .then(function() {
      btn.dataset.busy = '';
      btn.disabled    = false;
      btn.textContent = '🚀 배포';
      showToast('🚀 배포 완료! ' + (FILES_TO_UPLOAD.length + 1) + '개 파일 1~2분 후 반영됩니다.', { duration: 5000 });
      try { localStorage.setItem('madi_last_deploy', new Date().toISOString()); } catch(_e) {}
      // 다음 배포 시 SHA 비교를 위해 모든 파일의 SHA 저장 (변경되지 않은 파일도 포함)
      try {
        if (FILES_TO_UPLOAD.allShas) {
          localStorage.setItem('madi_deploy_shas', JSON.stringify(FILES_TO_UPLOAD.allShas));
        }
      } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
      // GitHub Pages 빌드 상태 자동 폴링 (5초 후 시작)
      pollGithubPagesBuild(deployStartTs);
    })
    .catch(function(e) {
      btn.dataset.busy = '';
      btn.disabled    = false;
      btn.textContent = '🚀 배포';
      if (e.message === 'USER_CANCEL') {
        showToast('배포 취소됨');
      } else {
        showToast('❌ ' + _userErrMsg(e, '배포'));
      }
    });
}

