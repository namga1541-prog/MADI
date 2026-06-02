// ─────── 권한 설정 모달 ───────
var _permUserId = null;
var _permData = {};

var PERM_LIST = [
  { key:'viewOtherChildren', icon:'👀', label:'다른 선생님 아동 조회',   desc:'같은 센터 내 다른 선생님이 담당하는 아동 목록을 볼 수 있어요.', active:true },
  { key:'editChild',         icon:'✏️', label:'아동 정보 수정',           desc:'아동 종결·재등록 등 아동 정보를 수정할 수 있어요.', active:true },
  { key:'deleteSession',     icon:'📋', label:'세션 기록 삭제',           desc:'작성한 세션 기록을 삭제할 수 있어요.', active:true },
  { key:'useAI',             icon:'🤖', label:'AI 기능 사용',             desc:'장단기계획(IEP) 생성, 포트폴리오, 부모 리포트 등 AI 분석 기능을 사용할 수 있어요.', active:true },
  { key:'deleteAssessment',  icon:'🗑️', label:'검사 결과 삭제',           desc:'표준화 검사 결과를 삭제할 수 있어요.', active:true }
];

function openPermModal(userId, userName, role) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) { showToast('⚠️ 권한 없음'); return; }
  _permUserId = userId;
  supaFetch('madi_users?id=eq.' + userId + '&select=permissions,role').then(function(rows) {
    _permData = {};
    if (Array.isArray(rows) && rows[0]) {
      if (rows[0].permissions) {
        try { _permData = typeof rows[0].permissions === 'object' ? rows[0].permissions : JSON.parse(rows[0].permissions); } catch (e) { if (window.console && console.warn) console.warn('[permissions parse]', e && e.message); }
      }
      // 대상 role을 보존해 savePermissions에서 참조
      _permData._targetRole = rows[0].role || role;
    }
    var isAdmin = role === 'admin';
    var overlay = document.createElement('div');
    overlay.className = 'sched-modal-overlay';
    overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
    var rows_html = PERM_LIST.map(function(p) {
      var allowed = isAdmin ? true : (_permData[p.key] !== false);
      var badgeHtml = p.active
        ? '<span style="font-size:9px;font-weight:700;color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 6px;border-radius:6px;margin-left:6px;vertical-align:middle;">✅ 적용 중</span>'
        : '<span style="font-size:9px;font-weight:700;color:#94a3b8;background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:6px;margin-left:6px;vertical-align:middle;">🚧 준비 중</span>';
      return '<div style="padding:14px 0;border-bottom:1px solid var(--border);">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span style="font-size:18px;width:24px;text-align:center;">' + p.icon + '</span>'
        + '<div style="flex:1;">'
        + '<div style="font-size:14px;font-weight:700;color:var(--navy);">' + p.label + badgeHtml + '</div>'
        + '<div style="font-size:12px;color:var(--text2);margin-top:2px;">' + p.desc + '</div>'
        + '</div>'
        + '<label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;">'
        + '<input type="checkbox" id="perm_' + p.key + '" ' + (allowed ? 'checked' : '') + (isAdmin ? ' disabled' : '')
        + ' onchange="updatePermToggle(this,\'' + p.key + '\')"'
        + ' style="opacity:0;width:0;height:0;">'
        + '<span id="permTrack_' + p.key + '" style="position:absolute;cursor:pointer;inset:0;border-radius:24px;background:' + (allowed ? 'var(--mint)' : '#cbd5e1') + ';transition:.2s;">'
        + '<span style="position:absolute;height:18px;width:18px;left:' + (allowed ? '22' : '3') + 'px;bottom:3px;background:white;border-radius:50%;transition:.2s;"></span>'
        + '</span></label>'
        + '</div></div>';
    }).join('');
    // eslint-disable-next-line no-unsanitized/property
    overlay.innerHTML = '<div class="sched-modal" style="max-height:85vh;overflow-y:auto;">'
      + '<div class="sched-modal-title">🔐 ' + escHtml(userName) + ' 선생님 권한 설정'
      + (isAdmin ? '<div style="font-size:11px;color:var(--mint);font-weight:400;margin-top:4px;">관리자 계정은 모든 권한이 자동으로 허용됩니다</div>' : '') + '</div>'
      + (isAdmin ? '' : '<div style="font-size:12px;color:var(--text2);background:var(--bg);border-radius:8px;padding:10px;margin-bottom:12px;">⚠️ 관리자 권한을 가진 계정은 이 설정과 무관하게 모든 기능을 사용할 수 있습니다.</div>')
      + rows_html
      + (isAdmin ? '' : '<div style="display:flex;gap:8px;margin-top:16px;">'
        + '<button class="btn-ghost" onclick="this.closest(\'.sched-modal-overlay\').remove()" style="flex:1;">취소</button>'
        + '<button class="btn-primary" onclick="savePermissions()" style="flex:1;">저장</button>'
        + '</div>')
      + (isAdmin ? '<button class="btn-ghost" onclick="this.closest(\'.sched-modal-overlay\').remove()" style="width:100%;margin-top:16px;">닫기</button>' : '')
      + '</div>';
    document.body.appendChild(overlay);
  }).catch(function() {
    showToast('⚠️ 권한 정보를 불러오지 못했습니다.');
  });
}

function updatePermToggle(el, key) {
  _permData[key] = el.checked;
  var track = document.getElementById('permTrack_' + key);
  if (track) {
    track.style.background = el.checked ? 'var(--mint)' : '#cbd5e1';
    var thumb = track.querySelector('span');
    if (thumb) thumb.style.left = el.checked ? '22px' : '3px';
  }
}

function savePermissions() {
  if (!_permUserId) { showToast('⚠️ 권한을 저장할 사용자를 선택해주세요'); return; }
  // 역할 재검증: superadmin 또는 admin만 허용
  if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
    showToast('⚠️ 권한이 없습니다'); return;
  }
  // 자기 자신의 권한 변경 방지
  if (String(_permUserId) === String(currentUser.id)) {
    showToast('⚠️ 자신의 권한은 변경할 수 없습니다'); return;
  }
  // admin이 superadmin 계정의 권한을 변경하려는 경우 차단(UX 가드).
  //   _targetRole 은 openPermModal 의 서버 GET 응답(rows[0].role) 기반이라 클라 위조 불가.
  //   실제 방어는 서버 api/index.ts PATCH escalation 가드(role/permissions 변경은 superadmin 강제)가 담당(M-12).
  if (currentUser.role === 'admin' && _permData._targetRole === 'superadmin') {
    showToast('⚠️ 슈퍼관리자 계정의 권한은 변경할 수 없습니다'); return;
  }
  // 정본 권한 키(PERM_LIST)만 저장 — 옛/미사용 키와 _targetRole 메타를 자동 정리.
  //   PERM_LIST 는 madi-core.js DEFAULT_PERMS / canDo() 와 키가 일치(이중 체계 방지).
  var payload = {};
  PERM_LIST.forEach(function(p) {
    payload[p.key] = (_permData[p.key] !== false);
  });
  var _savedPermUserId = _permUserId;
  supaFetch('madi_users?id=eq.' + _permUserId, 'PATCH', { permissions: payload })
    .then(function() {
      showToast('✅ 권한 저장 완료');
      var _permOverlay = document.querySelector('.sched-modal-overlay');
      if (_permOverlay) _permOverlay.remove();
      supaFetch('madi_audit_log', 'POST', {
        actor_id: currentUser.id,
        actor_role: currentUser.role,
        action: 'UPDATE_PERMISSIONS',
        table_name: 'madi_users',
        row_id: _savedPermUserId,
        center_id: currentUser.center_id,
        changed_cols: ['permissions', 'role']
      }).catch(function(){});  // 감사 로그 실패가 주 기능을 막으면 안 됨
    }).catch(function() { showToast('❌ 저장 실패'); });
}

// ─────── 선생님 계정 관리 (관리자 전용) ───────
function renderStaffCard() {
  // TODO: staffCard UI가 HTML에 없어 비활성 상태 (admin.html에 #staffCard, #staffList, #deployCard 요소 없음)
  var card = document.getElementById('staffCard');
  var deployCard = document.getElementById('deployCard');
  if (!card) return;
  var isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  var isSuperAdmin = currentUser && currentUser.role === 'superadmin';
  card.style.display = isAdmin ? 'block' : 'none';
  // 배포 카드는 superadmin 전용 (admin/teacher/parent 모두에게 숨김)
  if (deployCard) deployCard.style.display = isSuperAdmin ? 'block' : 'none';
  if (!isAdmin) return;
  supaFetch('madi_users?' + centerFilter() + '&select=id,username,name,role,color,prog_types&order=role.desc,name.asc')
    .then(function(users) {
      if (!Array.isArray(users)) return;
      var html = '';
      users.forEach(function(u) {
        var safeColor = escHtml(u.color || '#0ea5a0');
        var safeId = escHtml(String(u.id));
        var safeName = escHtml(u.name || '');
        var safeRole = escHtml(u.role || '');
        // onclick 속성 내 작은따옴표 이스케이프 (작은따옴표가 JS 문자열을 깨는 것 방지)
        var onclickName = safeName.replace(/'/g, '&#39;');
        var onclickRole = safeRole.replace(/'/g, '&#39;');
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;">'
          + '<div style="width:34px;height:34px;border-radius:50%;background:' + safeColor + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;">' + (u.name || '?').slice(0,1) + '</div>'
          + '<div style="flex:1;"><div style="font-size:14px;font-weight:700;">' + safeName + '</div>'
          + '<div style="font-size:11px;color:var(--text2);">@' + escHtml(u.username || '') + ' · ' + (u.role==='admin'?'👑 관리자':'👩‍⚕️ 선생님') + '</div></div>'
          + (u.id !== currentUser.id
            ? '<div style="display:flex;gap:6px;">'
              + '<button class="btn-ghost" style="font-size:11px;padding:4px 8px;color:var(--mint);border-color:var(--mint);" onclick="openPermModal(\'' + safeId + '\',\'' + onclickName + '\',\'' + onclickRole + '\')">\uad8c\ud55c</button>'
              + '<button class="btn-del" onclick="deleteStaff(\'' + safeId + '\',\'' + onclickName + '\')">\uc0ad\uc81c</button>'
              + '</div>'
            : '<span style="font-size:11px;color:var(--mint);">나</span>')
          + '</div>';
      });
      var staffList = document.getElementById('staffList');
      if (!staffList) return;
      // eslint-disable-next-line no-unsanitized/property
      staffList.innerHTML = html || '<div style="font-size:13px;color:var(--text2);text-align:center;padding:12px;">등록된 계정 없음</div>';
    }).catch(function() {
      showToast('⚠️ 직원 목록을 불러오지 못했습니다.');
    });
}

function saveNewStaff(btn) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) { showToast('⚠️ 권한 없음'); return; }
  var modal    = btn.closest('.sched-modal-overlay');
  if (!modal) { showToast('⚠️ 입력 폼을 찾을 수 없습니다'); return; }
  // querySelector null-safe (모달 마크업 변경·조건부 렌더 대비, M-6)
  var name     = ((modal.querySelector('#newStaffName') || {}).value || '').trim();
  var username = ((modal.querySelector('#newStaffId')   || {}).value || '').trim();
  var password = ((modal.querySelector('#newStaffPw')   || {}).value || '').trim();
  var role     = (modal.querySelector('#newStaffRole')  || {}).value || '';
  var errEl    = modal.querySelector('#addStaffError');
  if (!name || !username || !password) { if(errEl) errEl.textContent = '모든 항목을 입력해주세요.'; return; }
  var color = TEACHER_COLORS[Math.floor(Math.random() * TEACHER_COLORS.length)];
  if (errEl) errEl.textContent = '';
  hashPassword(password).then(function(hashed) {
    return supaFetch('madi_users', 'POST', [{
      username: username, password: hashed, name: name,
      role: role, color: color, center_id: getCenterId()
    }]);
  }).then(function(r) {
    if (r && r[0] && r[0].id) {
      _teacherList = [];
      modal.remove();
      renderStaffCard();
      loadStaffMgmtList();
      showToast('✅ ' + escHtml(name) + ' 계정 추가 완료!');
    } else {
      if (errEl) errEl.textContent = '추가 실패 (아이디 중복일 수 있음)';
    }
  }).catch(function(e){ if(errEl) errEl.textContent = '서버 오류: ' + (e.message||''); });
}

function deleteStaff(id, name) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) { showToast('⚠️ 권한 없음'); return; }
  showDeleteConfirm(
    '이용자를 삭제하시겠습니까?',
    '데이터가 완전히 삭제되고 복구할 수 없음을 확인하였습니다.',
    '삭제확인',
    function() {
      var _centerFilter = currentUser.center_id ? '&center_id=eq.' + encodeURIComponent(currentUser.center_id) : '';
      var _deletedUserId = id;
      supaFetch('madi_users?id=eq.' + encodeURIComponent(id) + _centerFilter, 'DELETE').then(function() {
        _teacherList = [];
        renderStaffCard();
        showToast('🗑️ ' + escHtml(name) + ' 계정 삭제됨');
        supaFetch('madi_audit_log', 'POST', {
          actor_id: currentUser.id,
          actor_role: currentUser.role,
          action: 'DELETE_STAFF',
          table_name: 'madi_users',
          row_id: _deletedUserId,
          center_id: currentUser.center_id
        }).catch(function(){});  // 감사 로그 실패가 주 기능을 막으면 안 됨
      }).catch(function() {
        showToast('❌ 계정 삭제에 실패했습니다. 다시 시도해주세요.');
      });
    }
  );
}

// ─────── 폴링 방식 동기화 (보안 강화 — Realtime 대체) ───────
var _pollTimer = null;
var _pollInterval = 30000; // 30초마다 갱신 (기존 10초 → 3배 감소, Supabase API 호출 절감)
var _myChangeTs = 0;
var _lastActivityTs = Date.now(); // 사용자 마지막 활동 시각 (유휴 시 폴링 스킵)
var _IDLE_THRESHOLD = 5 * 60 * 1000; // 5분 비활성 시 폴링 중단

// 활동 감지 리스너 — 클릭·키·터치 발생 시 _lastActivityTs 갱신
if (typeof window !== 'undefined' && !window._madiActivityBound) {
  window._madiActivityBound = true;
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function(ev) {
    document.addEventListener(ev, function() { _lastActivityTs = Date.now(); }, { passive: true, capture: true });
  });
}

function initRealtime() {
  stopRealtime();
  _pollTimer = setInterval(function() {
    // 내가 방금 저장한 경우 2초 동안 폴링 스킵 (중복 갱신 방지)
    if (_myChangeTs && Date.now() < _myChangeTs + 2000) return;
    // 5분 이상 비활성 시 폴링 스킵 — 모바일 배터리·데이터 낭비 방지
    if (Date.now() - _lastActivityTs > _IDLE_THRESHOLD) return;
    if (typeof loadDBFromSupabase === 'function') {
      loadDBFromSupabase(true);
    }
  }, _pollInterval);
  if (window.console && console.debug) console.debug('✅ 폴링 동기화 시작 (' + (_pollInterval/1000) + '초 간격)');
}

function markMyChange() { _myChangeTs = Date.now(); }

function stopRealtime() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

// 페이지 unload / 백그라운드 전환 시 폴링 정지 — 모바일에서 백그라운드 네트워크 낭비 방지
if (typeof window !== 'undefined' && !window._madiPollUnloadBound) {
  window._madiPollUnloadBound = true;
  window.addEventListener('beforeunload', stopRealtime);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      stopRealtime();
    } else if (document.visibilityState === 'visible' && typeof currentUser !== 'undefined' && currentUser) {
      _lastActivityTs = Date.now(); // 탭 복귀 = 활동으로 간주
      // 즉시 1회 갱신 — 탭 숨김 중 변경사항을 30초 기다리지 않고 즉시 반영
      if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase(true);
      initRealtime();
    }
  });
}

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
var _swNow = new Date();
var SW_BUILD = 'madi-v5-' + _swNow.toISOString().slice(0,10).replace(/-/g,'')
             + '-' + String(_swNow.getHours()).padStart(2,'0')
             + String(_swNow.getMinutes()).padStart(2,'0');
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
      showToast('⚠️ 빌드 상태 확인 불가: ' + (e.message || '네트워크 오류'), { duration: 5000 });
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
        showToast('❌ 배포 실패: ' + (e.message || '오류'));
      }
    });
}

function processImportFile(file) {
  // TODO: importResult UI가 HTML에 없어 비활성 상태 (admin.html에 #importResult 요소 없음 — 엑셀 import 기능 미구현)
  if (!getApiKeyOrAlert()) return;

  var resultEl = document.getElementById('importResult');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>엑셀 모듈 준비 중...</p></div>';

  // XLSX lazy 로드 (~900KB) — 평가지 import 진입 시점에만
  ensureXLSX().then(function() {
    resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>파일을 읽는 중...</p></div>';
    _processImportFileInner(file, resultEl);
  }).catch(function(e) {
    resultEl.innerHTML = '<div class="import-warning">⚠️ ' + escHtml(e && e.message ? e.message : '엑셀 모듈 로드 실패') + '</div>';
  });
}

function _processImportFileInner(file, resultEl) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var wb   = XLSX.read(data, { type: 'array', cellDates: true });

      var allRows = [];
      wb.SheetNames.forEach(function(sheetName) {
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        allRows = allRows.concat(rows);
      });

      if (!allRows.length) {
        resultEl.innerHTML = '<div class="import-warning">⚠️ 파일에서 데이터를 찾을 수 없습니다.</div>';
        return;
      }

      // eslint-disable-next-line no-unsanitized/property
      resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>데이터 변환 중... (애 ' + allRows.length + '행)</p></div>';

      var children = parseRowsToChildren(allRows);

      if (children.length > 0) {
        renderImportPreview({ children: children, sessions: [], unmapped: [], summary: children.length + '명 변환 완료' }, resultEl);
      } else {
        resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>컨럼 형식을 AI가 분석 중입니다...</p></div>';
        var wb2  = XLSX.read(data, { type: 'array' });
        var csv  = XLSX.utils.sheet_to_csv(wb2.Sheets[wb2.SheetNames[0]], { blankrows: false });
        var sample = csv.split('\n').slice(0, 30).join('\n');
        analyzeImportData(sample, resultEl);
      }
    } catch(err) {
      resultEl.innerHTML = '<div class="import-warning">⚠️ 파일 읽기 실패: ' + escHtml(err.message || '오류') + '</div>';
    }
  };
  reader.onerror = function() { resultEl.innerHTML = '<div class="import-warning">⚠️ 파일을 읽을 수 없습니다.</div>'; };
  reader.readAsArrayBuffer(file);
}

function normalizeDisorderType(raw) {
  var s = String(raw || '').trim();
  if (!s || s === '미응답' || s === '-') return '기타';
  if (s.indexOf('조음') > -1) return '조음음운장애';
  if (s.indexOf('언어발달') > -1 || s.indexOf('언어지연') > -1) return '언어발달장애';
  if (s.indexOf('유창성') > -1 || s.indexOf('말더듬') > -1) return '유창성장애';
  if (s.indexOf('자폐') > -1 || s.indexOf('ASD') > -1) return '자폐스펙트럼';
  if (s.indexOf('지적') > -1) return '지적장애';
  if (s.indexOf('청각') > -1) return '청각장애';
  return '기타';
}

function parseRowsToChildren(rows) {
  if (!rows.length) return [];
  var keys = Object.keys(rows[0]);

  function findCol(candidates) {
    for (var ci = 0; ci < candidates.length; ci++) {
      for (var ki = 0; ki < keys.length; ki++) {
        if (keys[ki].trim().indexOf(candidates[ci]) > -1) return keys[ki];
      }
    }
    return null;
  }

  var colName   = findCol(['이용자','아동명','이름','성명']);
  if (!colName) return [];

  var colBirth  = findCol(['생년월일','birth','생일']);
  var colAge    = findCol(['개월수','연령','나이','age']);
  var colType   = findCol(['장애유형','장애','진단명','진단']);
  var colPhone  = findCol(['연락연락캘당자','연락처','전화번호','보호자연락첸','보호자 연락첸']);
  var colStatus = findCol(['상태','status']);
  var colMemo   = findCol(['메모','비고','특이사항']);

  var children = [];
  rows.forEach(function(row) {
    var name = String(row[colName] || '').trim();
    if (!name) return;

    var birth = '';
    if (colBirth && row[colBirth]) {
      var bRaw = row[colBirth];
      if (bRaw instanceof Date) {
        birth = ymd(bRaw);
      } else {
        var bStr = String(bRaw).replace(/[./ ]/g, '-').trim();
        var bNum = bStr.replace(/-/g, '');
        if (/^[0-9]{8}$/.test(bNum)) birth = bNum.slice(0,4)+'-'+bNum.slice(4,6)+'-'+bNum.slice(6,8);
        else birth = bStr;
      }
    }

    var age    = colAge    ? String(row[colAge]    || '') : '';
    var phone  = colPhone  ? String(row[colPhone]  || '') : '';
    var memo   = colMemo   ? String(row[colMemo]   || '') : '';
    var rawStatus = colStatus ? String(row[colStatus] || '').trim() : '';

    var childStatus = '등록';
    if (rawStatus.indexOf('종결') > -1 || rawStatus.indexOf('퇴원') > -1 || rawStatus.indexOf('종료') > -1) {
      childStatus = '종결';
    } else if (rawStatus.indexOf('대기') > -1 || rawStatus.indexOf('접수') > -1 || rawStatus.indexOf('신규') > -1) {
      childStatus = '대기';
    } else if (rawStatus.indexOf('등록') > -1 || rawStatus.indexOf('재원') > -1 || rawStatus.indexOf('이용') > -1 || rawStatus.indexOf('진행') > -1) {
      childStatus = '등록';
    }

    children.push({
      name:   name,
      birth:  birth,
      age:    age,
      type:   normalizeDisorderType(colType ? row[colType] : ''),
      phone:  phone,
      goals:  [],
      memo:   memo,
      status: childStatus
    });
  });
  return children;
}

function analyzeImportData(csvText, resultEl) {
  var SYSTEM = '당신은 언어치료 데이터 마이그레이션 전문가입니다. '
    + '케어플센터 또는 다른 언어치료 앱에서 내보렬 엑셀/CSV 데이터를 분석하여 아동 정보와 세션 기록을 추출하세요.\n\n'
    + '【케어플센터 이용자 파일 컨럼 매핑 규칙】\n'
    + '- "이용자" 컨럼 → name (아동명)\n'
    + '- "생년월일" 컨럼 → birth (YYYY-MM-DD 형식으로 변환. 예: 2022-06-14)\n'
    + '- "개월수" 컨럼 → age (예: "3세 10개월" 그대로 사용. birth가 있으면 age는 비워도 됨)\n'
    + '- "장애유형" 컨럼 → type. "미응답"이면 "기타"로 변환\n'
    + '- "연락첸" 컨럼 → phone (보호자 연락첸)\n'
    + '- "메모" 컨럼 → memo\n'
    + '- "상태"가 "퇴원" 또는 "종결"이면 memo에 "(종결)" 추가\n'
    + '- "이메일", "주소", "학교", "회원번호" 등 나머지 개인정보 → 무시\n\n'
    + '【장애유형 변환 규칙】\n'
    + '"조음"이 포함 → "조음음운장애" / "언어발달"이 포함 → "언어발달장애" / "유창성"이 포함 → "유창성장애" '
    + '/ "자폐" 포함 → "자폐스펙트럼" / "지적" 포함 → "지적장애" / "청각" 포함 → "청각장애" / 나머지 → "기타"\n\n'
    + '【세션 기록 파일 컨럼 매핑 규칙】(회기 데이터가 있을 경우)\n'
    + '- "이용자" 또는 "아동명" → childName\n'
    + '- "날짜" 또는 "회기일" → date (YYYY-MM-DD)\n'
    + '- "목표" 또는 "치료목표" → goals (문자열 배열)\n'
    + '- "내용" 또는 "회기내용" → memo\n\n'
    + '반드시 순수 JSON만 응답 (마크다운 없이):\n'
    + '{"children":[{"name":"아동명","birth":"2022-06-14","age":"3세 10개월","type":"조음음운장애","phone":"010-1234-5678","goals":[],"memo":""}],'
    + '"sessions":[],'
    + '"unmapped":[],'
    + '"summary":"N명 변환"}';

  var USER = '아래 데이터를 변환하세요. goals는 빈 배열로, memo는 꼭 필요한 것만, 간결하게 작성하세요.\n\n'
    + csvText;

  callClaude(SYSTEM, USER, 4096, getAIModel())
    .then(function(raw) {
      var parsed = parseJSON(raw);
      renderImportPreview(parsed, resultEl);
    })
    .catch(function(err) {
      var msg = err.message;
      if (msg.includes('JSON') || msg.includes('position')) {
        msg = '아동 수가 너무 많아 응답이 잊혀졌습니다. 파일을 절반씩 나눠서 두 번 올려주세요.';
      }
      // eslint-disable-next-line no-unsanitized/property
      resultEl.innerHTML = '<div class="import-warning">⚠️ AI 분석 실패: ' + escHtml(msg) + '</div>';
    });
}

function renderImportPreview(data, resultEl) {
  var children = data.children || [];
  var sessions = data.sessions || [];
  var unmapped = data.unmapped || [];

  if (children.length === 0) {
    // eslint-disable-next-line no-unsanitized/property
    resultEl.innerHTML = '<div class="import-warning">⚠️ 아동 정보를 찾지 못했습니다. 파일 형식을 확인해주세요.<br>'
      + (data.summary ? '분석 결과: ' + escHtml(data.summary) : '') + '</div>';
    return;
  }

  var existingNames = childDB.map(function(c) { return c.name; });
  var html = '';

  if (data.summary) {
    html += '<div style="background:var(--mint2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--mint);font-weight:600;">'
      + '🤖 ' + escHtml(data.summary) + '</div>';
  }

  html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">👶 아동 ' + children.length + '명 · 📝 세션 ' + sessions.length + '개 발견</div>';

  children.forEach(function(c) {
    var isDup       = existingNames.indexOf(c.name) >= 0;
    var isTerminated = c.memo && c.memo.includes('(종결)');
    var sessionCnt  = sessions.filter(function(s) { return s.childName === c.name; }).length;
    html += '<div class="import-preview-item" style="' + (isDup ? 'border-left-color:var(--amber);' : isTerminated ? 'border-left-color:#94a3b8;opacity:0.75;' : '') + '">'
      + '<div class="import-preview-name">' + escHtml(c.name || '이름 없음')
      + (isDup        ? ' <span style="font-size:10px;background:#fef3c7;color:#b45309;padding:2px 7px;border-radius:10px;margin-left:4px;">이미 존재</span>' : '')
      + (isTerminated ? ' <span style="font-size:10px;background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:10px;margin-left:4px;">종결</span>' : '')
      + '</div>'
      + '<div class="import-preview-meta">' + escHtml(c.age || '나이 미상') + ' · ' + escHtml(c.type || '유형 미상')
      + (c.birth ? ' · 🎂 ' + escHtml(c.birth) : '')
      + (sessionCnt > 0 ? ' · 세션 ' + sessionCnt + '개' : '') + '</div>'
      + (c.phone ? '<div style="font-size:11px;color:var(--text2);margin-top:2px;">📞 ' + escHtml(c.phone) + '</div>' : '')
      + (c.goals && c.goals.length > 0 ? '<div class="import-preview-goals">목표: ' + c.goals.map(function(g){return escHtml(g);}).join(', ') + '</div>' : '')
      + (c.memo ? '<div style="font-size:11px;color:var(--text2);margin-top:3px;">' + escHtml(c.memo) + '</div>' : '')
      + '</div>';
  });

  if (unmapped.length > 0) {
    html += '<div class="import-warning">⚠️ 변환하지 못한 항목 ' + unmapped.length + '개: '
      + unmapped.slice(0, 3).map(function(u){return escHtml(String(u));}).join(', ')
      + (unmapped.length > 3 ? ' 외 ' + (unmapped.length - 3) + '개' : '') + '</div>';
  }

  window._importPreview = data;

  html += '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-primary" style="flex:1;" onclick="confirmImport()">✅ 이대로 가져오기</button>'
    + '<button class="btn-ghost" style="flex:0.4;" onclick="cancelImport()">취소</button>'
    + '</div>';

  // eslint-disable-next-line no-unsanitized/property
  resultEl.innerHTML = html;
}

function confirmImport() {
  var data = window._importPreview;
  if (!data) return;

  _myChangeTs = Date.now() + 8000;

  var children = data.children || [];
  var sessions  = data.sessions || [];
  var addedCount = 0, skippedCount = 0, sessionCount = 0;

  var nameToId = {};
  children.forEach(function(c) {
    var exists = childDB.find(function(existing) { return existing.name === c.name; });
    if (exists) {
      nameToId[c.name] = exists.id;
      skippedCount++;
    } else {
      var newId = generateClientId();
      var birthVal = c.birth || '';
      var ageVal   = birthVal ? (calcAgeFromBirth(birthVal) || c.age || '미상') : (c.age || '미상');
      childDB.push({
        id:           newId,
        name:         c.name   || '이름 없음',
        birth:        birthVal,
        age:          ageVal,
        type:         c.type   || '기타',
        phone:        c.phone  || '',
        goals:        Array.isArray(c.goals) ? c.goals : [],
        memo:         c.memo   || '',
        status:       c.status || '등록',
        startDate:    '',
        voucherLimit: 0,
        color:        CHILD_COLORS[childDB.length % CHILD_COLORS.length]
      });
      nameToId[c.name] = newId;
      addedCount++;
    }
  });
  refreshChildAges();   // 임포트 직후 age 최신화

  sessions.forEach(function(s) {
    var childId = nameToId[s.childName];
    if (!childId) return;
    sessionDB.push({
      id:      generateClientId(),
      childId: childId,
      date:    s.date    || getTodayKST(),
      goals:   Array.isArray(s.goals) ? s.goals : [],
      memo:    s.memo    || '',
      aiNote:  ''
    });
    sessionCount++;
  });

  // localStorage 동기화 (서버 저장 결과와 무관하게 즉시 반영)
  markMyChange();
  _optionsCacheKey = null;
  safeSetItem('cn3_children', JSON.stringify(childDB));
  safeSetItem('cn3_sessions', JSON.stringify(sessionDB));

  window._importPreview = null;
  renderChildGrid();
  populateChildSelects();

  var importResult = document.getElementById('importResult');
  if (importResult) {
    // eslint-disable-next-line no-unsanitized/property
    importResult.innerHTML =
      '<div style="background:#f0fdf4;border-radius:10px;padding:14px;border-left:4px solid var(--green);">'
      + '<div style="font-weight:700;color:var(--green);margin-bottom:6px;">✅ 가져오기 완료!</div>'
      + '<div style="font-size:13px;line-height:1.8;">'
      + '아동 추가: <strong>' + addedCount + '명</strong><br>'
      + (skippedCount > 0 ? '중복 스킵: <strong>' + skippedCount + '명</strong><br>' : '')
      + '세션 기록: <strong>' + sessionCount + '개</strong>'
      + '</div></div>';
  }

  showToast('✅ ' + addedCount + '명 추가! 서버 저장 중...(잠시 기다려주세요)');

  // 서버 저장: children → sessions 순서로 직렬 처리, 실제 완료 후 결과 토스트
  var _cid = getCenterId();
  var childRows = childDB.map(function(c) { return { id: c.id, center_id: _cid, data: c }; });
  var sessRows  = sessionDB.map(function(s) { return { id: s.id, center_id: _cid, data: s }; });

  function _batchPost(endpoint, rows) {
    if (!rows || rows.length === 0) return Promise.resolve();
    var batches = [];
    for (var i = 0; i < rows.length; i += 50) batches.push(rows.slice(i, i + 50));
    return batches.reduce(function(p, batch) {
      return p.then(function() { return supaFetch(endpoint, 'POST', batch); });
    }, Promise.resolve());
  }

  _batchPost('madi_children?on_conflict=id', childRows)
    .then(function() { return _batchPost('madi_sessions?on_conflict=id', sessRows); })
    .then(function() {
      showToast('☁️ 서버 저장 완료! 아동 ' + childDB.length + '명');
    })
    .catch(function(e) {
      var msg = e && e.message ? e.message : '오류';
      showToast('❌ 서버 저장 실패 — ' + msg);
    });
}

function cancelImport() {
  window._importPreview = null;
  var importResultEl = document.getElementById('importResult');
  if (importResultEl) importResultEl.innerHTML = '';
  var importFileInputEl = document.getElementById('importFileInput');
  if (importFileInputEl) importFileInputEl.value = '';
}

// ─────── 초기화 ───────
function init() {
  // 배포 버튼 / 토스트가 "배포 중..." 상태로 저장된 경우 강제 정상화
  var _db = document.getElementById('headerDeployBtn');
  if (_db) { _db.disabled = false; _db.textContent = '🚀 배포'; }
  var _toast = document.getElementById('toast');
  if (_toast) { _toast.classList.remove('show'); _toast.textContent = ''; _toast.style.pointerEvents = ''; }
  loadDarkMode();
  setTimeout(applyPermissions, 400);
  startHeaderClock();
  setupNetworkMonitor();
  setupGlobalErrorHandler();
  maybeAutoBackup();
  loadApiUsage();
  var today = getTodayKST();
  var sessDateEl = document.getElementById('sessionDate'); if (sessDateEl) sessDateEl.value = today;
  var portMonEl = document.getElementById('portfolioMonth'); if (portMonEl) portMonEl.value = today.slice(0, 7);
  var assessDateEl = document.getElementById('assessDate'); if (assessDateEl) assessDateEl.value = today;
  schedCurrentDate = new Date();

  // cowork High #4: localStorage cn3_apikey 캐싱 제거 — API 키는 loadCenterApiKey()가 Supabase에서만 로드
  // (DevTools 추출 방지)
  // 마이그레이션: 기존 사용자 localStorage 잔재 자동 정리
  try { localStorage.removeItem('cn3_apikey'); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }

  // httpOnly 쿠키 보안 마이그레이션: localStorage 잔재 토큰 정리
  try { localStorage.removeItem('madi_token'); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }

  var savedUser;
  try { savedUser = localStorage.getItem('madi_user'); } catch(_e) { savedUser = null; }

  // iOS Safari ITP 대응: sessionStorage 토큰 유무로 세션 유효성 사전 확인
  // madi-core.js 에서 이미 sessionStorage → _madiToken 복원이 완료된 상태
  // 토큰이 없으면 쿠키도 차단된 것으로 간주 → 대시보드 플래시 없이 즉시 로그인
  var _hasSessToken = (typeof _madiToken !== 'undefined' && !!_madiToken);
  if (!_hasSessToken) {
    try { _hasSessToken = !!sessionStorage.getItem('madi_sess'); } catch(_e) {}
  }

  if (savedUser && _hasSessToken) {
    // 세션 토큰 유효 — 대시보드 표시 후 데이터 로드
    try {
      currentUser = JSON.parse(savedUser);
      applyUserUI();
      applyRoleUI();
      loadCenterApiKey();
      hideLoginScreen();
      loadDBFromSupabase();
      initRealtime();
    } catch(e) {
      currentUser = null;
      try { localStorage.removeItem('madi_user'); } catch(_e) {}
      showLanding();
    }
  } else if (savedUser && !_hasSessToken) {
    // madi_user 는 있지만 세션 토큰 없음 = 새 브라우저 세션 (쿠키·토큰 만료)
    // iOS Safari 에서 가장 자주 발생하는 케이스:
    //   기존: 대시보드 플래시 → "데이터 로드 실패" 오류 → 1.5초 후 로그인 화면 (혼란스러운 UX)
    //   개선: 오류 없이 즉시 로그인 화면으로 이동
    try { localStorage.removeItem('madi_user'); } catch(_e) {}
    loadDB();
    renderChildGrid();
    populateChildSelects();
    renderGoalRows();
    renderSessionList();
    renderUnwrittenAlert();
    showLoginScreen();  // 랜딩이 아닌 로그인 화면 (재방문 사용자이므로)
  } else {
    // 첫 방문 또는 명시적 로그아웃 후
    try { localStorage.removeItem('madi_user'); } catch(_e) {}
    loadDB();
    renderChildGrid();
    populateChildSelects();
    renderGoalRows();
    renderSessionList();
    renderUnwrittenAlert();
    showLanding();
  }

  initPWA();
}

// ─────── PWA 지원 ───────
var _pwaPrompt = null;

function initPWA() {
  // 매니페스트와 아이콘은 정적 파일(./manifest.json, ./icon-*.png)에서 직접 로드
  // — index.html / admin.html <head> 의 <link rel="manifest"> 가 처리

  // ── Service Worker 등록: ./sw.js 우선, 실패 시 Blob URL 폴백 ──
  if ('serviceWorker' in navigator) {
    // ── SW 업데이트 시 자동 새로고침 (설치형 PWA 포함) ──
    //  기존 confirm() 방식은 standalone PWA 에서 다이얼로그가 무시·차단되어
    //  새 코드가 영영 적용되지 않던 문제 → 사용자 개입 없는 자동 reload 로 전환.
    //  단 세션 기록 등 입력 유실 방지:
    //    · 앱을 방금 연 직후(8초 이내) 또는 백그라운드 → 즉시 적용
    //    · 사용 중(화면 보는 중) → 토스트 안내 후 다음 포그라운드 복귀 시 적용
    var _swHadController = !!navigator.serviceWorker.controller;
    var _swLoadedAt = Date.now();
    var _swReloaded = false;
    function _swApplyUpdate() {
      if (_swReloaded) return;
      _swReloaded = true;
      window.location.reload();
    }
    // 사용 중(작업 화면)일 때 띄우는 '지속' 업데이트 배너. 탭하면 즉시 최신화.
    //   기존엔 사라지는 토스트만 띄우고 '포그라운드 복귀' 때만 reload 했는데,
    //   한 탭에서 계속 작업하는 사용자는 복귀 이벤트가 없어 옛 코드를 영영 못 받았다
    //   (2026-06-02 step/반복기본값 수정이 디바이스에 안 닿던 정황). 명시적 배너로 해소.
    function _swShowUpdateBanner(onClick) {
      if (document.getElementById('swUpdateBanner')) return;
      var b = document.createElement('div');
      b.id = 'swUpdateBanner';
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      b.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);'
        + 'z-index:2147483646;background:var(--mint,#0ea5a0);color:#fff;font-weight:700;'
        + 'font-size:14px;line-height:1.3;padding:13px 22px;border-radius:999px;cursor:pointer;'
        + 'box-shadow:0 6px 22px rgba(0,0,0,0.28);max-width:92vw;text-align:center;'
        + '-webkit-tap-highlight-color:transparent;';
      b.textContent = '🔄 새 버전이 있습니다 — 탭하여 업데이트';
      b.onclick = onClick;
      b.onkeydown = function(ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); } };
      document.body.appendChild(b);
    }
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      // 최초 설치(이전 컨트롤러 없음)는 이미 최신 → reload 불필요(무한 새로고침 방지)
      if (!_swHadController) { _swHadController = true; return; }
      if (document.visibilityState !== 'visible' || (Date.now() - _swLoadedAt) < 8000) {
        _swApplyUpdate();
        return;
      }
      // 사용 중 → 지속 배너(탭 시 즉시 적용) + 포그라운드 복귀 시 자동 적용(백업 경로)
      _swShowUpdateBanner(_swApplyUpdate);
      var _onVis = function() {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', _onVis);
          _swApplyUpdate();
        }
      };
      document.addEventListener('visibilitychange', _onVis);
    });
    // 1차 시도: 배포된 ./sw.js (GitHub Pages 환경)
    // updateViaCache: 'none' — sw.js 자체가 HTTP 캐시에서 서빙되지 않도록 강제.
    //   배포 직후 새 sw.js 가 즉시 감지되어 cache 갱신 race 가 짧아짐 (외부 리뷰 R5)
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(function(reg) {
        if (window.console && console.debug) console.debug('[마디 PWA] sw.js 등록 성공');
        // 장시간 열려있는 탭(학부모가 화면을 켜둔 채로 며칠) 대비:
        //   1시간마다 SW 업데이트 체크 — 변경 있으면 controllerchange 트리거 → 자동 reload
        try { setInterval(function() { reg.update(); }, 60 * 60 * 1000); } catch (e) {}
      })
      .catch(function() {
        // 2차 시도: Blob URL (로컈 개발 / sw.js 미배포 환경)
        var swBlob = new Blob([SW_CODE], { type: 'text/javascript' });
        var swUrl  = URL.createObjectURL(swBlob);
        navigator.serviceWorker.register(swUrl)
          .then(function() { if (window.console && console.debug) console.debug('[마디 PWA] Blob URL SW 등록 (폴백)'); })
          .catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-12]',e&&e.message);});
      });
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _pwaPrompt = e;
    if (_pwaShouldShowBanner()) showPWABanner('android');
  });

  window.addEventListener('appinstalled', function() {
    _pwaPrompt = null;
    hidePWABanner();
    try { localStorage.setItem('madi_pwa_installed', '1'); } catch (e) {}
    showToast('✅ 마디 앱 설치 완료!');
  });

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
  var isStandalone = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone && _pwaShouldShowBanner()) {
    setTimeout(function() { showPWABanner('ios'); }, 2500);
  }

  // dismiss 이후의 방문 카운트 증가 (재안내 조건: 30일 + 5회 방문)
  try {
    if (localStorage.getItem('madi_pwa_dismissed_at')) {
      var v = parseInt(localStorage.getItem('madi_pwa_visits_since_dismiss') || '0', 10) + 1;
      localStorage.setItem('madi_pwa_visits_since_dismiss', String(v));
    }
  } catch (e) {}
}

// PWA 설치 배너 표시 여부 결정 — dismissed 후 30일 + 5회 방문 누적 시 다시 표시
function _pwaShouldShowBanner() {
  try {
    if (localStorage.getItem('madi_pwa_installed') === '1') return false;
    var dismissedAt = parseInt(localStorage.getItem('madi_pwa_dismissed_at') || '0', 10);
    if (!dismissedAt) return true;  // 첫 노출
    var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    var visitsAfterDismiss = parseInt(localStorage.getItem('madi_pwa_visits_since_dismiss') || '0', 10);
    return (Date.now() - dismissedAt) > THIRTY_DAYS && visitsAfterDismiss >= 5;
  } catch (e) { return true; }
}

function showPWABanner(type) {
  if (document.getElementById('pwaBanner')) return;

  var banner = document.createElement('div');
  banner.id = 'pwaBanner';
  banner.className = 'pwa-banner';

  if (type === 'android') {
    banner.innerHTML = '<div class="pwa-banner-icon">🗒️</div>'
      + '<div class="pwa-banner-text">'
      + '<div class="pwa-banner-title">마디 앱 설치</div>'
      + '<div class="pwa-banner-desc">홈 화면에 추가하여 앱처럼 빠르게 실행하세요</div>'
      + '</div>'
      + '<button class="pwa-install-btn" onclick="triggerPWAInstall()">설치</button>'
      + '<button class="pwa-close-btn" onclick="hidePWABanner()">✕</button>';
  } else {
    banner.innerHTML = '<div class="pwa-banner-icon">🗒️</div>'
      + '<div class="pwa-banner-text">'
      + '<div class="pwa-banner-title">홈 화면에 추가하기</div>'
      + '<div class="pwa-banner-desc">Safari 하단 <b>공유 버튼(⬆️)</b> → <b>홈 화면에 추가</b> 탭하세요</div>'
      + '</div>'
      + '<button class="pwa-close-btn" onclick="hidePWABanner()">✕</button>';
  }

  document.body.appendChild(banner);
  document.body.classList.add('pwa-banner-open');

  var toast = document.getElementById('toast');
  if (toast) toast.style.bottom = '90px';
}

function hidePWABanner() {
  var b = document.getElementById('pwaBanner');
  if (!b) return;
  b.remove();
  document.body.classList.remove('pwa-banner-open');
  var toast = document.getElementById('toast');
  if (toast) toast.style.bottom = '';
  // 사용자가 ✕ 로 닫은 경우 30일 + 5회 방문 후 재안내
  try {
    localStorage.setItem('madi_pwa_dismissed_at', String(Date.now()));
    localStorage.setItem('madi_pwa_visits_since_dismiss', '0');
  } catch (e) {}
}

function triggerPWAInstall() {
  if (!_pwaPrompt) { showToast('⚠️ 설치 프롬프트를 다시 시도해주세요.'); return; }
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(function(result) {
    if (result.outcome === 'accepted') showToast('📲 설치 중...');
    _pwaPrompt = null;
  });
  hidePWABanner();
}

document.addEventListener('DOMContentLoaded', function() {
  init();
  initFloatBtnDrag();

  // ─── 뒤로가기 버튼 탭 연동 ───
  window.addEventListener('popstate', function(e) {
    if (e.state && typeof e.state.tab !== 'undefined') {
      if (typeof switchTab === 'function') switchTab(e.state.tab);
    }
  });
});


// ───────────────────────────────────────────────────────────────────────
// 플로팅 AI 비서 (chat / macros / 음성) 는 분리됨: madi-chat.js
// ───────────────────────────────────────────────────────────────────────

// ─── 모듈 초기화 ───
// 구버전 GitHub 토큰 잔재 제거 (IndexedDB/localStorage)
_cleanupLegacyGithubToken();
