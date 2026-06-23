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
  supaFetch('madi_users?id=eq.' + encodeURIComponent(userId) + '&select=permissions,role').then(function(rows) {
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
  }).catch(function(e) {
    if(window.console&&console.warn)console.warn('[loadPermPanel]',e&&e.message);
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
  supaFetch('madi_users?id=eq.' + encodeURIComponent(_permUserId), 'PATCH', { permissions: payload })
    .then(function() {
      showToast('✅ 권한 저장 완료');
      var _permOverlay = document.querySelector('.sched-modal-overlay');
      if (_permOverlay) _permOverlay.remove();
      supaFetch('madi_audit_log', 'POST', [{
        actor_id: currentUser.id,
        actor_role: currentUser.role,
        action: 'UPDATE_PERMISSIONS',
        table_name: 'madi_users',
        row_id: _savedPermUserId,
        center_id: currentUser.center_id,
        changed_cols: ['permissions', 'role']
      }]).catch(function(){});  // 감사 로그 실패가 주 기능을 막으면 안 됨
    }).catch(function() { showToast('❌ 저장 실패'); });
}

// ─────── 선생님 계정 관리 ───────
//   #staffCard 기반 구현(renderStaffCard/saveNewStaff/deleteStaff)은 제거됨(2026-06-13):
//   해당 DOM(#staffCard/#staffList/#newStaffRole)이 HTML 에 없던 미연결 중복이었다.
//   활성 경로: loadStaffMgmtList(목록)·removeStaffAccount(삭제, DELETE_STAFF 감사)·
//   openPermModal/savePermissions(권한 편집 — 위 정의, 활성).

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
    // 작성 중(값이 있는 입력 필드)인지 — 자동 reload 로 인한 세션기록·평가 입력 유실 방지용.
    function _swDirty() {
      if (window._sessionSaveBusy) return true;
      var tas = document.querySelectorAll('textarea');
      for (var i = 0; i < tas.length; i++) {
        var t = tas[i];
        if (t.offsetParent !== null && t.value && t.value.trim()) return true;
      }
      // 검색창을 제외한 중요 단일 입력 필드도 체크
      var importantIds = ['sessionMemo','aiInput','quickNote','aiInputText'];
      for (var j = 0; j < importantIds.length; j++) {
        var el = document.getElementById(importantIds[j]);
        if (el && el.offsetParent !== null && el.value && el.value.trim()) return true;
      }
      return false;
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
      // safe-area-inset-bottom: 홈인디케이터 아이폰에서 배너가 인디케이터와 겹치지 않게.
      // right:84px: 우하단 .float-btn(width 56px + right 20px + 간격)과 겹치지 않게 우측 여백 확보.
      b.style.cssText = 'position:fixed;left:16px;right:84px;bottom:calc(22px + env(safe-area-inset-bottom,0px));'
        + 'z-index:2147483646;background:var(--mint,#0ea5a0);color:#fff;font-weight:700;'
        + 'font-size:14px;line-height:1.3;padding:13px 16px;border-radius:16px;cursor:pointer;'
        + 'box-shadow:0 6px 22px rgba(0,0,0,0.28);text-align:center;'
        + '-webkit-tap-highlight-color:transparent;';
      b.textContent = '🔄 새 버전이 있습니다 — 탭하여 업데이트';
      b.onclick = onClick;
      b.onkeydown = function(ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); } };
      document.body.appendChild(b);
    }
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      // 최초 설치(이전 컨트롤러 없음)는 이미 최신 → reload 불필요(무한 새로고침 방지)
      if (!_swHadController) { _swHadController = true; return; }
      // 작성 중이 아니고(입력 유실 위험 없음) + 백그라운드이거나 방금 연 직후면 즉시 적용.
      if (!_swDirty() && (document.visibilityState !== 'visible' || (Date.now() - _swLoadedAt) < 8000)) {
        _swApplyUpdate();
        return;
      }
      // 사용 중이거나 작성 중 → 지속 배너(탭 시 즉시 적용). dirty 인 동안에는 포그라운드 복귀
      //   자동 reload 를 보류해 미저장 입력(세션기록·평가) 유실을 막는다(배너 탭은 사용자 의사).
      _swShowUpdateBanner(_swApplyUpdate);
      var _onVis = function() {
        if (document.visibilityState === 'visible' && !_swDirty()) {
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
    // 배너를 랜딩/로그인 화면(z-index 9998/9999) 위에 표시 — 로그인 후 표시로 지연해 가림 방지.
    //   2500ms 고정 대신 로그인 완료 후 500ms 딜레이로 변경(비로그인 상태에서는 미표시).
    //   initPWA 는 로그인 전에도 호출되므로 타이머만으로는 가려짐 → 이벤트 방식으로 전환.
    if (!currentUser) {
      document.addEventListener('madiLoggedIn', function _pwaIosOnce() {
        document.removeEventListener('madiLoggedIn', _pwaIosOnce);
        setTimeout(function() { showPWABanner('ios'); }, 800);
      });
    } else {
      setTimeout(function() { showPWABanner('ios'); }, 800);
    }
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

  // ─── 뒤로가기 버튼 탭 연동 + 모달 닫힘 ───
  // Android Chrome/PWA standalone: 모달이 열려 있으면 뒤로가기가 모달을 닫도록 처리.
  //   history.pushState({tab}) 는 switchTab 만 쌓고 동적 모달은 미참여해,
  //   Back 시 모달은 안 닫히고 탭이 전환되거나 앱이 종료되던 문제 해소.
  window.addEventListener('popstate', function(e) {
    // 오버레이 모달이 열려 있으면 닫고 스택을 다시 push 해 탭 이동을 막는다.
    var overlay = document.querySelector('.sched-modal-overlay, .modal-overlay, .confirm-ov, .pwa-modal-bg');
    if (overlay) {
      overlay.remove();
      if (e.state && typeof e.state.tab !== 'undefined') {
        // 닫힌 모달의 뒤 상태를 다시 쌓아 탭이 돌아가지 않게 함
        history.pushState(e.state, '');
      }
      return;
    }
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
