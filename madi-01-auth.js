/* ───────────────────────────────────────────────────────────
   madi-01-auth.js — 로그인 / 회원가입 / 로그아웃 / 비밀번호
   - 랜딩·로그인·회원가입 화면 전환 및 사용자 목록
   - 초대코드 검증 (디바운스)
   - 로그아웃 메뉴 / 로그인 업데이트 팝업
   - 비밀번호 변경 모달

   분리 사유: madi-01.js 가 1,062 라인으로 비대 → 공통 유틸·supaFetch
   는 madi-01.js, 인증 UI 플로우는 본 파일, 데이터 로드·앱 UI 는
   madi-01-app.js 로 3분할.
   ─────────────────────────────────────────────────────────── */

function showLanding()    { var el = document.getElementById('landingScreen'); if (el) el.style.display = 'flex'; }
function hideLanding()    { var el = document.getElementById('landingScreen'); if (el) el.style.display = 'none'; }
function backToLanding()  { var _ls = document.getElementById('loginScreen'); if (_ls) _ls.style.display = 'none'; var ss = document.getElementById('signupScreen'); if (ss) ss.style.display = 'none'; showLanding(); }
function showLoginScreen(){ var _ls = document.getElementById('loginScreen'); if (_ls) _ls.style.display = 'flex'; loadUserList(); }
function hideLoginScreen(){ var _ls = document.getElementById('loginScreen'); if (_ls) _ls.style.display = 'none'; showDashboard(); }
function loadUserList() {
  var un = document.getElementById('loginUsernameInput'), pw = document.getElementById('loginPwInput'), err = document.getElementById('loginError');
  var lastId = localStorage.getItem('madi_last_id') || '';
  if (un) un.value = lastId; if (pw) pw.value = ''; if (err) err.textContent = '';
  if (lastId) { if (pw) setTimeout(function(){ pw.focus(); }, 200); } else { if (un) setTimeout(function(){ un.focus(); }, 200); }
}

var _inviteCheckTimer = null;
function onInviteCodeInput() {
  if (_inviteCheckTimer) clearTimeout(_inviteCheckTimer);
  var inp = document.getElementById('signupInviteCode'); if (!inp) return;
  var label = document.getElementById('signupCenterName');
  var code = (inp.value || '').trim().toUpperCase();
  if (!code || code.length < 5) { if (label) label.textContent = ''; return; }
  if (label) { label.style.color = 'var(--text2)'; label.textContent = '확인 중...'; }
  _inviteCheckTimer = setTimeout(function() {
    supaFetch('madi_centers?invite_code=eq.' + encodeURIComponent(code) + '&select=name,invite_expires_at', 'GET')
      .then(function(centers) {
        if (!label) return;
        if (Array.isArray(centers) && centers.length > 0) {
          var c = centers[0];
          if (c.invite_expires_at) { var exp = new Date(c.invite_expires_at); if (!isNaN(exp.getTime()) && exp - new Date() < 0) { label.style.color = '#ef4444'; label.textContent = '⛔ 만료된 초대 코드입니다'; return; } }
          label.style.color = 'var(--mint)'; label.textContent = '✅ ' + c.name;
        } else { label.style.color = '#ef4444'; label.textContent = '⚠️ 유효하지 않은 코드입니다'; }
      }).catch(function(e) { if (label) label.textContent = ''; showToast('⚠️ 초대코드 확인 중 오류가 발생했습니다'); });
  }, 500);
}

function showSignupScreen() {
  hideLanding(); var _ls = document.getElementById('loginScreen'); if (_ls) _ls.style.display = 'none'; var _ss2 = document.getElementById('signupScreen'); if (_ss2) _ss2.style.display = 'flex';
  ['signupInviteCode','signupName','signupUsername','signupPassword','signupPasswordConfirm'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
  var _se = document.getElementById('signupError'); if (_se) _se.textContent = '';
  var _sc = document.getElementById('signupCenterName'); if (_sc) _sc.textContent = '';
  setTimeout(function(){ var inv = document.getElementById('signupInviteCode'); if (inv) inv.focus(); }, 200);
}
function backToLoginFromSignup() { var _ss = document.getElementById('signupScreen'); if (_ss) _ss.style.display = 'none'; var _ls = document.getElementById('loginScreen'); if (_ls) _ls.style.display = 'flex'; }

function doSignup() {
  var errEl = document.getElementById('signupError'), btn = document.getElementById('signupSubmitBtn');
  if (!errEl || !btn) { showToast('⚠️ 페이지를 새로고침 후 다시 시도해주세요'); return; }
  errEl.textContent = '';
  var codeEl = document.getElementById('signupInviteCode');
  var nameEl = document.getElementById('signupName');
  var usernameEl = document.getElementById('signupUsername');
  var pwEl = document.getElementById('signupPassword');
  var pwCfEl = document.getElementById('signupPasswordConfirm');
  if (!codeEl || !nameEl || !usernameEl || !pwEl || !pwCfEl) { showToast('⚠️ 페이지를 새로고침 후 다시 시도해주세요'); return; }
  var inviteCode = (codeEl.value || '').trim().toUpperCase();
  var name = (nameEl.value || '').trim();
  var username = (usernameEl.value || '').trim();
  var pw = pwEl.value || '';
  var pwConfirm = pwCfEl.value || '';
  if (!inviteCode) { errEl.textContent = '초대 코드를 입력해주세요.'; return; }
  if (!name)       { errEl.textContent = '이름을 입력해주세요.'; return; }
  if (!username)   { errEl.textContent = '아이디를 입력해주세요.'; return; }
  if (!pw)         { errEl.textContent = '비밀번호를 입력해주세요.'; return; }
  if (!pwConfirm)  { errEl.textContent = '비밀번호 확인을 입력해주세요.'; return; }
  if (username.length < 4) { errEl.textContent = '아이디는 4자 이상이어야 합니다.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = '아이디는 영문/숫자/언더바(_)만 사용 가능합니다.'; return; }
  var pwErr = validatePasswordStrength(pw); if (pwErr) { errEl.textContent = pwErr; return; }
  if (pw !== pwConfirm) { errEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '확인 중...';
  supaFetch('madi_centers?invite_code=eq.' + encodeURIComponent(inviteCode) + '&select=id,name,invite_expires_at', 'GET')
    .then(function(centers) {
      if (!Array.isArray(centers) || centers.length === 0) throw new Error('유효하지 않은 초대 코드입니다.');
      var center = centers[0];
      if (center.invite_expires_at) { var exp = new Date(center.invite_expires_at); if (!isNaN(exp.getTime()) && exp - new Date() < 0) throw new Error('만료된 초대 코드입니다. 관리자에게 새 코드를 요청해주세요.'); }
      return supaFetch('madi_users?username=eq.' + encodeURIComponent(username) + '&select=id', 'GET')
        .then(function(rows) { if (Array.isArray(rows) && rows.length > 0) throw new Error('이미 사용 중인 아이디입니다.'); return center; });
    })
    .then(function(center) {
      return hashPassword(pw).then(function(hashed) {
        // role/permissions 는 서버(api/index.ts)에서 teacher·기본값으로 강제됨 — 클라이언트 값 무시됨
        var newUser = { id: generateClientId(), username: username, name: name, password: hashed, role: 'teacher', center_id: center.id, color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'), permissions: { viewOtherChildren:true, deleteSession:true, useAI:true } };
        return supaFetch('madi_users', 'POST', [newUser]).then(function(){ return { center: center, user: newUser }; });
      });
    })
    .then(function(result) {
      btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '✨ 가입하기';
      // 가입 직후 /login 으로 httpOnly 쿠키 발급 (쿠키 없으면 모든 API가 401)
      return fetch(EDGE_URL + '/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: result.user.username, password: pw })
      })
      .then(function(r) { return r.json(); })
      .then(function(loginData) {
        currentUser = (loginData && loginData.user) ? loginData.user
          : { id: result.user.id, username: result.user.username, name: result.user.name, role: result.user.role, color: result.user.color, center_id: result.user.center_id, permissions: result.user.permissions };
        try { localStorage.setItem('madi_user', JSON.stringify(currentUser)); localStorage.setItem('madi_last_id', result.user.username); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
        var _scr = document.getElementById('signupScreen'); if (_scr) _scr.style.display = 'none'; hideLoginScreen();
        if (typeof applyUserUI === 'function') applyUserUI();
        if (typeof applyRoleUI === 'function') applyRoleUI();
        if (typeof loadCenterApiKey === 'function') loadCenterApiKey();
        if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase();
        if (typeof initRealtime === 'function') initRealtime();
        var roleLabel = currentUser.role === 'superadmin' ? '대장님 👑' : currentUser.role === 'admin' ? '원장님 🏥' : '선생님 👩‍⚕️';
        showToast('🎉 환영합니다, ' + currentUser.name + ' ' + roleLabel + '! (' + result.center.name + ')');
      })
      .catch(function() {
        // /login 실패해도 가입 자체는 완료 — 로그인 화면에서 수동 로그인 유도
        var _ssc = document.getElementById('signupScreen'); if (_ssc) _ssc.style.display = 'none';
        var _lsc = document.getElementById('loginScreen'); if (_lsc) _lsc.style.display = 'flex';
        var unEl = document.getElementById('loginUsernameInput');
        if (unEl) unEl.value = result.user.username;
        showToast('✅ 가입 완료! 비밀번호를 입력해 로그인해주세요');
      });
    })
    .catch(function(err) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '✨ 가입하기'; errEl.textContent = '❌ ' + (err.message || '가입에 실패했습니다.'); });
}

function doLogin(_totpCode) {
  var unEl = document.getElementById('loginUsernameInput'), pwEl = document.getElementById('loginPwInput');
  var errEl = document.getElementById('loginError'), btn = document.getElementById('loginSubmitBtn');
  var un = unEl ? unEl.value.trim() : '', pw = pwEl ? pwEl.value : '';
  if (errEl) errEl.textContent = '';
  if (!un) { if (errEl) errEl.textContent = '아이디를 입력해주세요.'; return; }
  if (!pw) { if (errEl) errEl.textContent = '비밀번호를 입력해주세요.'; return; }
  if (btn) { if (btn.dataset.busy === '1') return; btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '로그인 중...'; }
  var payload = { username: un, password: pw };
  if (_totpCode) payload.totp_code = _totpCode;
  fetchWithRetry(EDGE_URL + '/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, { retries: 1, label: '로그인' })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
    // ── SEC6: 2FA 필요 시 6자리 입력 모달 표시 ──
    if (data.require_totp) {
      _promptTotpCode(un, pw, data.error);
      return;
    }
    if (data.error) { if (errEl) errEl.textContent = data.error; return; }
    // 토큰은 서버가 httpOnly 쿠키로 발급 — 클라이언트는 user 정보만 저장
    currentUser = data.user;
    try { localStorage.setItem('madi_user', JSON.stringify(currentUser)); localStorage.setItem('madi_last_id', un); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    _purgeLegacyCnCache(); // 이전 사용자의 cn3_* PII 잔존 데이터 일소
    hideLoginScreen(); if (typeof applyUserUI === 'function') applyUserUI(); if (typeof applyRoleUI === 'function') applyRoleUI(); if (typeof loadCenterApiKey === 'function') loadCenterApiKey(); if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase(); if (typeof initRealtime === 'function') initRealtime(); if (typeof loadCenterSessionInterval === 'function') loadCenterSessionInterval();
    // 로그인 직후 마디 업데이트 팝업 표시 (대시보드 렌더 후 약간의 딜레이)
    setTimeout(function(){ if (typeof showLoginUpdatePopup === 'function') showLoginUpdatePopup(); }, 500);
  }).catch(function() {
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (errEl) errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  });
}

// SEC6: 2FA 코드 입력 프롬프트 (showInputPrompt 헬퍼 사용)
function _promptTotpCode(username, password, prevErr) {
  if (typeof showInputPrompt !== 'function') {
    // 폴백: native prompt
    var code = window.prompt(prevErr || '인증 코드 6자리');
    if (code) doLogin(code.trim());
    return;
  }
  showInputPrompt({
    title:    '🔐 2단계 인증',
    label:    prevErr ? (prevErr + ' — 다시 입력해주세요') : 'Authenticator 앱의 6자리 코드',
    type:     'text',
    placeholder: '000000',
    okLabel:  '확인',
    validate: function(v) {
      if (!/^\d{6}$/.test((v || '').trim())) return '6자리 숫자를 입력해주세요';
      return null;
    },
    onOk: function(code) { doLogin(code.trim()); }
  });
}

function getMadiLogoSVG(w, h) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="' + w + '" height="' + h + '">'
    + '<rect width="130" height="130" rx="28" fill="#e8f5f0"/><rect x="18" y="14" width="94" height="76" rx="18" fill="#2d6a4f"/>'
    + '<path d="M 26 90 L 16 112 L 52 90 Z" fill="#2d6a4f"/><rect x="61" y="38" width="8" height="38" rx="4" fill="white"/>'
    + '<path d="M 65 62 C 65 62 36 60 38 38 C 40 26 62 34 65 52 Z" fill="white"/>'
    + '<path d="M 65 54 C 65 54 92 52 91 32 C 90 20 68 28 65 44 Z" fill="white"/></svg>';
}

// ─── Web Vitals 계측 (2026-05-21 최적화 효과 검증용) ───
// 핵심 지표: FCP / LCP / CLS / TTFB / domContentLoaded
// 결과는 window.__madiVitals 에 모임 — DevTools console 에서 확인 가능
// 별도 서버 전송은 없음 (PII·네트워크 절감)
window.__madiVitals = { collectedAt: null };
function _initWebVitals() {
  try {
    // FCP / LCP / CLS — PerformanceObserver 사용 (있는 브라우저만)
    if (typeof PerformanceObserver === 'undefined') return;
    // FCP
    try {
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(e) {
          if (e.name === 'first-contentful-paint') window.__madiVitals.fcp = Math.round(e.startTime);
        });
      }).observe({ type: 'paint', buffered: true });
    } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    // LCP (최종값은 사용자 인터랙션 직전까지 갱신)
    try {
      var lcpObs = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) window.__madiVitals.lcp = Math.round(last.startTime);
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    // CLS (계속 누적)
    try {
      var clsValue = 0;
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(e) {
          if (!e.hadRecentInput) clsValue += e.value;
        });
        window.__madiVitals.cls = Math.round(clsValue * 1000) / 1000;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    // 네비게이션 타이밍 (TTFB / domContentLoaded)
    setTimeout(function() {
      try {
        var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
        if (nav) {
          window.__madiVitals.ttfb = Math.round(nav.responseStart);
          window.__madiVitals.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
          window.__madiVitals.loadComplete = Math.round(nav.loadEventEnd);
        }
        window.__madiVitals.collectedAt = Date.now();
      } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    }, 3000);
  } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
}
_initWebVitals();

document.addEventListener('DOMContentLoaded', function() {
  restoreSidebarState();

  // SVG 로고 4곳 자동 주입 — 비활성화됨 (A7 base64 아이콘 사용을 위해 2026-05-12)
  // var lpNav = document.querySelector('.lp-nav-logo-icon');
  // if (lpNav) lpNav.innerHTML = getMadiLogoSVG(44, 44);
  // document.querySelectorAll('.login-logo-icon').forEach(function(el) {
  //   el.innerHTML = getMadiLogoSVG(34, 34);
  // });
  // var logoIcon = document.querySelector('.logo-icon');
  // if (logoIcon) logoIcon.innerHTML = getMadiLogoSVG(22, 22);

  // Enter 키 로그인 처리
  var pwInput = document.getElementById('loginPwInput');
  if (pwInput) pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  var unInput = document.getElementById('loginUsernameInput');
  if (unInput) unInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter') {
      var pw = document.getElementById('loginPwInput');
      if (pw) pw.focus();
    }
  });
});

// ★ 헤더 사용자 클릭 드롭다운 (로그아웃)
// 비밀번호 변경은 별도 설정 메뉴/관리자 페이지에서 호출 (showChangePasswordModal 함수는 유지)
function showLogoutMenu() {
  var existing = document.getElementById('userDropdown');
  if (existing) { existing.remove(); return; }
  var headerUser = document.getElementById('headerUser');
  var rect = headerUser ? headerUser.getBoundingClientRect() : { right: window.innerWidth - 12, bottom: 52 };
  var rightOffset = window.innerWidth - rect.right;
  var menu = document.createElement('div');
  menu.id = 'userDropdown';
  menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 6) + 'px;right:' + rightOffset + 'px;'
    + 'background:white;border:1px solid #e2e8f0;border-radius:12px;'
    + 'box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:9999;min-width:160px;overflow:hidden;';
  menu.innerHTML =
    '<div style="padding:6px 0;">'
    + '<button onclick="var d=document.getElementById(\'userDropdown\');if(d)d.remove();doLogout();"'
    + ' style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 16px;border:none;background:none;font-size:13px;cursor:pointer;color:#ef4444;">🚪 로그아웃</button>'
    + '</div>';
  document.body.appendChild(menu);
  setTimeout(function() {
    document.addEventListener('click', function _closeDd(e) {
      var d = document.getElementById('userDropdown');
      if (d && !d.contains(e.target)) { d.remove(); document.removeEventListener('click', _closeDd); }
    });
  }, 10);
}

function doLogout() {
  if (!currentUser) { showLoginScreen(); return; }
  showConfirm(currentUser.name + '님, 로그아웃 하시겠습니까?', function() {
    // 서버에서 httpOnly 쿠키 삭제 (fire-and-forget)
    fetch(EDGE_URL + '/logout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }).catch(function(){});
    if (typeof stopRealtime === 'function') stopRealtime(); currentUser = null; clearToken();
    // 보안: supaFetch 메모리 캐시 전체 클리어 — 다른 사용자에게 잔여 PII 노출 방지
    if (typeof supaCacheClearAll === 'function') supaCacheClearAll();
    // 공유 기기 보호: 다음 사용자가 이전 사용자의 PII 를 보지 못하도록 모든 캐시 제거
    var _localKeys = [
      'madi_user', 'madi_last_id',
      'cn3_children', 'cn3_sessions', 'cn3_schedule',
      'cn3_assess', 'cn3_activities', 'cn3_iep',
      'madi_api_usage', 'madi_last_backup', 'madi_maro_pos'
    ];
    _localKeys.forEach(function(k){ try { localStorage.removeItem(k); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ } });
    // login_block_* 동적 키도 sweep
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('login_block_') === 0 || k.indexOf('cn3_') === 0)) localStorage.removeItem(k);
      }
    } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    // sessionStorage 도 전체 정리 (madi_error_log 등)
    try { sessionStorage.clear(); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    // 인메모리 DB도 비우기
    childDB=[]; sessionDB=[]; scheduleDB=[]; assessmentDB=[]; activityDB=[]; iepDB=[];
    if (typeof window._parentChildren !== 'undefined') {
      window._parentChildren = null;
      window._parentChildId = null;
      window._parentCenterId = null;
      window._parentChildName = '';
      window._parentCacheUserId = null;
      window._parentActiveIdx = 0;
    }
    if (typeof renderChildGrid === 'function') renderChildGrid(); var _hu = document.getElementById('headerUser'); if (_hu) _hu.style.display = 'none'; showLoginScreen();
  }, { danger: false, okLabel: '로그아웃' });
}

// ═══════════════════════════════════════════════════════════
// 🔔 로그인 업데이트 팝업
// ═══════════════════════════════════════════════════════════
// 슈퍼어드민이 madi_global_notices 에서 show_as_login_popup=true 로 지정한 글 1개를
// 로그인 직후 모달로 표시. '하루동안 열지 않음' 체크 시 글 단위 24h dismiss.
// 학부모(role=parent)는 표시 대상 제외.
function showLoginUpdatePopup() {
  if (!currentUser) return;
  if (currentUser.role === 'parent') return;
  if (document.getElementById('loginUpdatePopup')) return; // 중복 방지

  supaFetch('madi_global_notices?show_as_login_popup=eq.true&order=created_at.desc&limit=1', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return; // 활성 팝업 없음
      var n = rows[0];
      // 글 단위 dismiss 확인
      var dismissKey = 'madi_update_popup_dismiss_' + n.id;
      var until = parseInt(localStorage.getItem(dismissKey) || '0', 10);
      if (until && Date.now() < until) return; // 24h 이내 → 표시 안 함
      _renderLoginUpdatePopup(n, dismissKey);
    })
    .catch(function() { /* 조용히 실패 (네트워크 오류는 토스트로 사용자 흐름 방해 안 함) */ });
}

function _renderLoginUpdatePopup(n, dismissKey) {
  var overlay = document.createElement('div');
  overlay.id = 'loginUpdatePopup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

  var title   = escHtml(n.title || '마디 공지');
  var content = escHtml(n.content || '');

  // eslint-disable-next-line no-unsanitized/property
  overlay.innerHTML =
      '<div style="background:white;border-radius:14px;width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.25);overflow:hidden;">'
    +   // 헤더: 제목 + 우상단 X
        '<div style="position:relative;padding:20px 24px 14px;border-bottom:1px solid #e2e8f0;">'
    +     '<div style="text-align:center;font-size:16px;font-weight:700;color:#1e293b;padding:0 28px;">' + title + '</div>'
    +     '<button id="lupClose1" aria-label="닫기" style="position:absolute;top:14px;right:14px;width:28px;height:28px;border:none;background:transparent;font-size:20px;color:#94a3b8;cursor:pointer;line-height:1;padding:0;">×</button>'
    +   '</div>'
    +   // 본문 (스크롤 가능)
        '<div style="padding:18px 24px;overflow-y:auto;flex:1;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;word-break:break-word;">'
    +     content
    +   '</div>'
    +   // 푸터: 좌측 체크박스 + 우측 닫기
        '<div style="padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
    +     '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#475569;cursor:pointer;">'
    +       '<input type="checkbox" id="lupDontShow" style="width:14px;height:14px;cursor:pointer;margin:0;">'
    +       '<span>하루동안 이 창을 열지 않음</span>'
    +     '</label>'
    +     '<button id="lupClose2" style="padding:8px 20px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#475569;font-size:13px;font-weight:600;cursor:pointer;">닫기</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(overlay);

  function _dismiss() {
    var cb = document.getElementById('lupDontShow');
    if (cb && cb.checked) {
      // 24h 후 만료 시각 저장
      var until = Date.now() + 24 * 60 * 60 * 1000;
      try { localStorage.setItem(dismissKey, String(until)); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    }
    overlay.remove();
    document.removeEventListener('keydown', _onKey);
  }
  function _onKey(e) { if (e.key === 'Escape') _dismiss(); }

  var c1 = document.getElementById('lupClose1');
  var c2 = document.getElementById('lupClose2');
  if (c1) c1.addEventListener('click', _dismiss);
  if (c2) c2.addEventListener('click', _dismiss);
  // 바깥 클릭 시 닫힘 (체크박스 상태 반영)
  overlay.addEventListener('click', function(e) { if (e.target === overlay) _dismiss(); });
  document.addEventListener('keydown', _onKey);
}

// ★ 비밀번호 변경 모달
function showChangePasswordModal() {
  var existing = document.getElementById('changePwModal');
  if (existing) { existing.remove(); return; }
  var overlay = document.createElement('div');
  overlay.id = 'changePwModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 40px rgba(0,0,0,0.2);">'
    + '<div style="font-size:17px;font-weight:700;color:#1e293b;margin-bottom:20px;">🔑 비밀번호 변경</div>'
    + '<div style="margin-bottom:12px;">'
    + '<label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">현재 비밀번호</label>'
    + '<input type="password" id="cpCurrent" class="form-input" placeholder="현재 비밀번호 입력" style="width:100%;box-sizing:border-box;">'
    + '</div>'
    + '<div style="margin-bottom:12px;">'
    + '<label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">새 비밀번호</label>'
    + '<input type="password" id="cpNew" class="form-input" placeholder="4자 이상" style="width:100%;box-sizing:border-box;">'
    + '</div>'
    + '<div style="margin-bottom:16px;">'
    + '<label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">새 비밀번호 확인</label>'
    + '<input type="password" id="cpConfirm" class="form-input" placeholder="새 비밀번호 재입력" style="width:100%;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')submitChangePassword();">'
    + '</div>'
    + '<div id="cpError" style="font-size:12px;color:#ef4444;margin-bottom:12px;min-height:16px;word-break:break-word;"></div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="document.getElementById(\'changePwModal\').remove();" style="flex:1;padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:white;font-size:14px;cursor:pointer;color:#64748b;">취소</button>'
    + '<button id="cpSubmitBtn" onclick="submitChangePassword();" style="flex:1;padding:11px;border:none;border-radius:10px;background:#0ea5a0;color:white;font-size:14px;font-weight:700;cursor:pointer;">변경</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  setTimeout(function() { var el = document.getElementById('cpCurrent'); if (el) el.focus(); }, 100);
}

function submitChangePassword() {
  var current = (document.getElementById('cpCurrent') || {}).value || '';
  var newPw   = (document.getElementById('cpNew') || {}).value || '';
  var conf    = (document.getElementById('cpConfirm') || {}).value || '';
  var errEl   = document.getElementById('cpError');
  var btn     = document.getElementById('cpSubmitBtn');
  if (!errEl || !btn) { showToast('⚠️ 페이지를 새로고침 후 다시 시도해주세요'); return; }
  errEl.textContent = '';
  if (!current) { errEl.textContent = '현재 비밀번호를 입력해주세요.'; return; }
  if (!newPw)   { errEl.textContent = '새 비밀번호를 입력해주세요.'; return; }
  var pwErr = validatePasswordStrength(newPw);
  if (pwErr) { errEl.textContent = pwErr; return; }
  if (newPw !== conf)    { errEl.textContent = '새 비밀번호가 일치하지 않습니다.'; return; }
  if (current === newPw) { errEl.textContent = '현재 비밀번호와 동일합니다.'; return; }
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '변경 중...';
  fetchWithRetry(EDGE_URL + '/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: current, newPassword: newPw })
  }, { retries: 0, label: '비밀번호 변경' })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '변경';
    if (data.error) { errEl.textContent = '❌ ' + data.error; return; }
    var modal = document.getElementById('changePwModal');
    if (modal) modal.remove();
    showToast('✅ 비밀번호가 변경되었습니다.');
  })
  .catch(function() {
    btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '변경';
    errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  });
}

