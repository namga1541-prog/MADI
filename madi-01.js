// ─────── 상수 ───────
var MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
var MODEL_SONNET = 'claude-sonnet-4-6';

/* ── KST(UTC+9) 날짜 유틸: 실행 환경 타임존과 무관하게 동작 ── */
function toKST(d)      { return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000); }
function nowKST()      { return toKST(new Date()); }
function ymd(d)        { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function getTodayKST() { return ymd(nowKST()); }
function getMonthKST() { return getTodayKST().slice(0, 7); }
/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' (한국 표기) */
function fmtDateKR(s) { if (!s) return ''; var p = s.split('-'); return p[0] + '년 ' + parseInt(p[1]) + '월 ' + parseInt(p[2]) + '일'; }

var DEFAULT_PERMS = { viewOtherChildren:true, deleteSession:true, useAI:true };
function canDo(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  var p = currentUser.permissions || {};
  return p[perm] !== false;
}
function isMyChild(childId) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  var myName = currentUser.name;
  var hasSession = (typeof sessionDB !== 'undefined') && sessionDB.some(function(s){ return s.childId === childId && s.teacher === myName; });
  if (hasSession) return true;
  return (typeof scheduleDB !== 'undefined') && scheduleDB.some(function(s){ return s.childId === childId && s.teacher === myName; });
}
function applyPermissions() {
  if (!currentUser) return;
  var isAdminOrSuper = getRoleFlags().isAdminOrSuper;
  var settingsBtn = document.getElementById('tabBtn5');
  if (settingsBtn) settingsBtn.style.display = isAdminOrSuper ? '' : 'none';
  var svcBtn = document.getElementById('tabBtn4');
  if (svcBtn) svcBtn.style.display = isAdminOrSuper ? '' : 'none';
  if (isAdminOrSuper) return;
  if (!canDo('useAI')) { var aiSubBtn = document.getElementById('ptBtn_ai'); if (aiSubBtn) aiSubBtn.style.display = 'none'; }
}
function getAIModel() {
  try { var v = localStorage.getItem('madi_ai_model'); if (v === 'sonnet') return MODEL_SONNET; if (v === 'haiku') return MODEL_HAIKU; } catch (e) {}
  return MODEL_HAIKU;
}
function saveAIModelChoice(choice) {
  if (choice !== 'haiku' && choice !== 'sonnet') return;
  try { localStorage.setItem('madi_ai_model', choice); } catch (e) {}
  updateAIModelUI();
  var label = choice === 'sonnet' ? '🎯 Sonnet 4.6 (임상 추론·정밀)' : '⚡ Haiku 4.5 (빠름·저렴)';
  if (typeof showToast === 'function') showToast('✅ AI 모델이 ' + label + ' 으로 설정됐습니다');
}
function updateAIModelUI() {
  var current = 'haiku';
  try { var v = localStorage.getItem('madi_ai_model'); if (v === 'sonnet') current = 'sonnet'; } catch (e) {}
  var haikuRadio = document.getElementById('aiModelHaikuRadio');
  var sonnetRadio = document.getElementById('aiModelSonnetRadio');
  var haikuLabel = document.getElementById('aiModelHaikuLabel');
  var sonnetLabel = document.getElementById('aiModelSonnetLabel');
  var currentLabel = document.getElementById('aiModelCurrentLabel');
  if (haikuRadio)  haikuRadio.checked  = (current === 'haiku');
  if (sonnetRadio) sonnetRadio.checked = (current === 'sonnet');
  if (haikuLabel) { haikuLabel.style.borderColor = current === 'haiku' ? '#0ea5a0' : 'var(--border)'; haikuLabel.style.background = current === 'haiku' ? '#f0fdfa' : 'transparent'; }
  if (sonnetLabel) { sonnetLabel.style.borderColor = current === 'sonnet' ? '#8b5cf6' : 'var(--border)'; sonnetLabel.style.background = current === 'sonnet' ? '#faf5ff' : 'transparent'; }
  if (currentLabel) { currentLabel.textContent = '현재: ' + (current === 'sonnet' ? '🎯 Sonnet' : '⚡ Haiku'); currentLabel.style.color = current === 'sonnet' ? '#7c3aed' : '#047857'; }
}
var DISORDER_EMOJI = { '언어발달장애':'🗣️','조음음운장애':'👄','유창성장애':'💬','자폐스펙트럼':'🌈','지적장애':'🧩','청각장애':'👂','기타':'📋' };
var CHILD_COLORS = ['#0ea5a0','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981'];
var TEACHER_COLORS = ['#0ea5a0','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#06b6d4','#84cc16','#ec4899','#14b8a6','#a855f7','#eab308','#3b82f6','#f43f5e'];
var _teacherColorMap = {};
function getTeacherColor(name) {
  if (!name) return '#94a3b8';
  if (!_teacherColorMap[name]) { var idx = Object.keys(_teacherColorMap).length % TEACHER_COLORS.length; _teacherColorMap[name] = TEACHER_COLORS[idx]; }
  return _teacherColorMap[name];
}

var SUPA_URL  = 'https://ujxdhafzjyrglaclarwe.supabase.co';
var CENTER_SESSION_INTERVAL = 40;
function loadCenterSessionInterval() {
  var cid = getCenterId(); if (!cid) return;
  supaFetch('madi_centers?id=eq.' + encodeURIComponent(cid) + '&select=session_interval', 'GET')
    .then(function(rows) { if (rows && rows[0] && rows[0].session_interval) CENTER_SESSION_INTERVAL = parseInt(rows[0].session_interval) || 40; })
    .catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}
var EDGE_URL  = 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1';
var _madiToken = null;
// 토큰은 인메모리에만 보관 — localStorage 저장 금지 (XSS 탈취 방지)
// 페이지 새로고침 후에는 httpOnly 쿠키로 서버 인증이 자동 처리됨
function getToken()   { return _madiToken || ''; }
function setToken(t)  { _madiToken = t; }
function clearToken() { _madiToken = null; }

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (e) { console.error('localStorage 저장 실패:', key, e); if (e && e.name === 'QuotaExceededError') showToast('⚠️ 로컬 저장 공간 부족 — 데이터는 서버에 안전하게 저장됩니다'); return false; }
}

function supaFetch(path, method, body) {
  return fetchWithRetry(EDGE_URL + '/api', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: path, method: method || 'GET', body: body || null })
  }, {
    retries: 2,
    allowPostRetry: true,
    label: 'Supabase ' + (method || 'GET') + ' ' + path.split('?')[0]
  }).then(function(r) {
    if (r.status === 401 && typeof currentUser !== 'undefined' && currentUser) {
      clearToken(); currentUser = null;
      try { localStorage.removeItem('madi_user'); } catch(e) {}
      if (typeof showToast === 'function') showToast('⚠️ 세션이 만료되었습니다. 다시 로그인해주세요.', { duration: 3000 });
      setTimeout(function() { if (typeof showLoginScreen === 'function') showLoginScreen(); }, 1500);
      throw new Error('401: 세션 만료');
    }
    if (!r.ok && r.status !== 200 && r.status !== 201) {
      return r.text().then(function(t){ throw new Error(r.status + ': ' + t); });
    }
    var ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  });
}

var currentUser = null;
function hashPassword(pw) {
  var enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(pw))
    .then(function(buf) { return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join(''); });
}
function getCenterId() { return (currentUser && currentUser.center_id) ? currentUser.center_id : ''; }
function centerFilter() {
  if (currentUser && currentUser.role === 'superadmin') return 'center_id=not.is.null';
  var cid = getCenterId();
  return cid ? 'center_id=eq.' + cid : 'center_id=eq.INVALID';
}

function showLanding()    { var el = document.getElementById('landingScreen'); if (el) el.style.display = 'flex'; }
function hideLanding()    { var el = document.getElementById('landingScreen'); if (el) el.style.display = 'none'; }
function backToLanding()  { document.getElementById('loginScreen').style.display = 'none'; var ss = document.getElementById('signupScreen'); if (ss) ss.style.display = 'none'; showLanding(); }
function showLoginScreen(){ document.getElementById('loginScreen').style.display = 'flex'; loadUserList(); }
function hideLoginScreen(){ document.getElementById('loginScreen').style.display = 'none'; showDashboard(); }
function loadUserList() {
  var un = document.getElementById('loginUsernameInput'), pw = document.getElementById('loginPwInput'), err = document.getElementById('loginError');
  var lastId = localStorage.getItem('madi_last_id') || '';
  if (un) un.value = lastId; if (pw) pw.value = ''; if (err) err.textContent = '';
  if (lastId) { if (pw) setTimeout(function(){ pw.focus(); }, 200); } else { if (un) setTimeout(function(){ un.focus(); }, 200); }
}

var _inviteCheckTimer = null;
function onInviteCodeInput() {
  if (_inviteCheckTimer) clearTimeout(_inviteCheckTimer);
  var label = document.getElementById('signupCenterName');
  var code = (document.getElementById('signupInviteCode').value || '').trim().toUpperCase();
  if (!code || code.length < 5) { label.textContent = ''; return; }
  label.style.color = 'var(--text2)'; label.textContent = '확인 중...';
  _inviteCheckTimer = setTimeout(function() {
    supaFetch('madi_centers?invite_code=eq.' + encodeURIComponent(code) + '&select=name,invite_expires_at', 'GET')
      .then(function(centers) {
        if (Array.isArray(centers) && centers.length > 0) {
          var c = centers[0];
          if (c.invite_expires_at) { var exp = new Date(c.invite_expires_at); if (!isNaN(exp.getTime()) && exp - new Date() < 0) { label.style.color = '#ef4444'; label.textContent = '⛔ 만료된 초대 코드입니다'; return; } }
          label.style.color = 'var(--mint)'; label.textContent = '✅ ' + c.name;
        } else { label.style.color = '#ef4444'; label.textContent = '⚠️ 유효하지 않은 코드입니다'; }
      }).catch(function() { label.textContent = ''; });
  }, 500);
}

function showSignupScreen() {
  hideLanding(); document.getElementById('loginScreen').style.display = 'none'; document.getElementById('signupScreen').style.display = 'flex';
  ['signupInviteCode','signupName','signupUsername','signupPassword','signupPasswordConfirm'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('signupError').textContent = ''; document.getElementById('signupCenterName').textContent = '';
  setTimeout(function(){ var inv = document.getElementById('signupInviteCode'); if (inv) inv.focus(); }, 200);
}
function backToLoginFromSignup() { document.getElementById('signupScreen').style.display = 'none'; document.getElementById('loginScreen').style.display = 'flex'; }

function doSignup() {
  var errEl = document.getElementById('signupError'), btn = document.getElementById('signupSubmitBtn');
  errEl.textContent = '';
  var inviteCode = (document.getElementById('signupInviteCode').value || '').trim().toUpperCase();
  var name = (document.getElementById('signupName').value || '').trim();
  var username = (document.getElementById('signupUsername').value || '').trim();
  var pw = document.getElementById('signupPassword').value || '';
  var pwConfirm = document.getElementById('signupPasswordConfirm').value || '';
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
        try { localStorage.setItem('madi_user', JSON.stringify(currentUser)); localStorage.setItem('madi_last_id', result.user.username); } catch(e) {}
        document.getElementById('signupScreen').style.display = 'none'; hideLoginScreen();
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
        document.getElementById('signupScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        var unEl = document.getElementById('loginUsernameInput');
        if (unEl) unEl.value = result.user.username;
        showToast('✅ 가입 완료! 비밀번호를 입력해 로그인해주세요');
      });
    })
    .catch(function(err) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '✨ 가입하기'; errEl.textContent = '❌ ' + (err.message || '가입에 실패했습니다.'); });
}

function doLogin() {
  var unEl = document.getElementById('loginUsernameInput'), pwEl = document.getElementById('loginPwInput');
  var errEl = document.getElementById('loginError'), btn = document.getElementById('loginSubmitBtn');
  var un = unEl ? unEl.value.trim() : '', pw = pwEl ? pwEl.value : '';
  if (errEl) errEl.textContent = '';
  if (!un) { if (errEl) errEl.textContent = '아이디를 입력해주세요.'; return; }
  if (!pw) { if (errEl) errEl.textContent = '비밀번호를 입력해주세요.'; return; }
  if (btn) { if (btn.dataset.busy === '1') return; btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '로그인 중...'; }
  fetchWithRetry(EDGE_URL + '/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: un, password: pw }) }, { retries: 1, label: '로그인' })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (data.error) { if (errEl) errEl.textContent = data.error; return; }
    // 토큰은 서버가 httpOnly 쿠키로 발급 — 클라이언트는 user 정보만 저장
    currentUser = data.user;
    localStorage.setItem('madi_user', JSON.stringify(currentUser)); localStorage.setItem('madi_last_id', un);
    hideLoginScreen(); applyUserUI(); applyRoleUI(); loadCenterApiKey(); loadDBFromSupabase(); initRealtime(); loadCenterSessionInterval();
  }).catch(function() {
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (errEl) errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  });
}

function getMadiLogoSVG(w, h) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="' + w + '" height="' + h + '">'
    + '<rect width="130" height="130" rx="28" fill="#e8f5f0"/><rect x="18" y="14" width="94" height="76" rx="18" fill="#2d6a4f"/>'
    + '<path d="M 26 90 L 16 112 L 52 90 Z" fill="#2d6a4f"/><rect x="61" y="38" width="8" height="38" rx="4" fill="white"/>'
    + '<path d="M 65 62 C 65 62 36 60 38 38 C 40 26 62 34 65 52 Z" fill="white"/>'
    + '<path d="M 65 54 C 65 54 92 52 91 32 C 90 20 68 28 65 44 Z" fill="white"/></svg>';
}

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

// ★ 헤더 사용자 클릭 드롭다운 (비밀번호 변경 / 로그아웃)
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
    + '<button onclick="var d=document.getElementById(\'userDropdown\');if(d)d.remove();showChangePasswordModal();"'
    + ' style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 16px;border:none;background:none;font-size:13px;cursor:pointer;color:#1e293b;">🔑 비밀번호 변경</button>'
    + '<div style="height:1px;background:#f1f5f9;margin:2px 0;"></div>'
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
    stopRealtime(); currentUser = null; clearToken();
    // 공유 기기 보호: 다음 사용자가 이전 사용자의 PII 를 보지 못하도록 모든 캐시 제거
    var _localKeys = [
      'madi_user', 'madi_last_id',
      'cn3_children', 'cn3_sessions', 'cn3_schedule',
      'cn3_assess', 'cn3_activities', 'cn3_iep',
      'madi_api_usage', 'madi_last_backup', 'madi_maro_pos'
    ];
    _localKeys.forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
    // login_block_* 동적 키도 sweep
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('login_block_') === 0 || k.indexOf('cn3_') === 0)) localStorage.removeItem(k);
      }
    } catch(e) {}
    // sessionStorage 도 전체 정리 (madi_error_log 등)
    try { sessionStorage.clear(); } catch(e) {}
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
    renderChildGrid(); document.getElementById('headerUser').style.display = 'none'; showLoginScreen();
  }, { danger: false, okLabel: '로그아웃' });
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
  if (!errEl || !btn) return;
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

// ─────── Supabase DB 로드 / 저장 ───────
function loadDBFromSupabase(silent) {
  if (!silent) showToast('📡 데이터 불러오는 중...');
  _optionsCacheKey = null;
  Promise.all([
    supaFetch('madi_children?'    + centerFilter() + '&select=id,data&order=id.asc'),
    supaFetch('madi_sessions?'    + centerFilter() + '&select=id,data&order=id.asc'),
    supaFetch('madi_schedules?'   + centerFilter() + '&select=id,data&order=id.asc'),
    supaFetch('madi_assessments?' + centerFilter() + '&select=id,data&order=id.asc')
  ]).then(function(results) {
    function safeMap(arr) { if (!Array.isArray(arr)) return []; return arr.filter(function(r){ return r && r.data; }).map(function(r){ var d=r.data; d.id=r.id; return d; }); }
    var supaCh = safeMap(results[0]), supaSe = safeMap(results[1]), supaSch = safeMap(results[2]), supaAs = safeMap(results[3]);
    var localCh = []; try { localCh = JSON.parse(localStorage.getItem('cn3_children') || '[]'); } catch(e){}
    if (supaCh.length === 0 && localCh.length > 0) {
      childDB = localCh;
      try { sessionDB = JSON.parse(localStorage.getItem('cn3_sessions') || '[]'); } catch(e){ sessionDB=[]; }
      try { scheduleDB = JSON.parse(localStorage.getItem('cn3_schedule') || '[]'); } catch(e){ scheduleDB=[]; }
      try { assessmentDB = JSON.parse(localStorage.getItem('cn3_assess') || '[]'); } catch(e){ assessmentDB=[]; }
      saveChildren(); saveSessions(); saveSchedule(); saveAssess();
      showToast('☁️ 기존 데이터 ' + childDB.length + '명 → Supabase 자동 업로드 완료!');
    } else {
      childDB = supaCh; sessionDB = supaSe; scheduleDB = supaSch; assessmentDB = supaAs;
      if (!silent) showToast('✅ 데이터 로드 완료 (아동 ' + childDB.length + '명)');
    }
    renderChildGrid(); populateChildSelects(); renderGoalRows(); renderSessionList(); renderUnwrittenAlert(); renderStaffCard();
    if (typeof renderSchedView === 'function') renderSchedView();
    if (typeof renderDashboard === 'function') renderDashboard();
    loadActivitiesFromSupa(); loadIEPFromSupa();
    setTimeout(function() { if (typeof loadNotices === 'function') loadNotices(); }, 600);
  }).catch(function(e) {
    console.error('loadDB 실패:', e); showToast('❌ 데이터 로드 실패 — 로컬 데이터로 표시합니다');
    loadDB(); renderChildGrid(); populateChildSelects();
  });
}

function saveChildren() {
  markMyChange(); _optionsCacheKey = null; safeSetItem('cn3_children', JSON.stringify(childDB));
  if (childDB.length === 0) return;
  var cid = getCenterId(), rows = childDB.map(function(c){ return { id: c.id, center_id: cid, data: c }; }), batches = [];
  for (var i = 0; i < rows.length; i += 50) batches.push(rows.slice(i, i + 50));
  batches.reduce(function(p, batch) { return p.then(function() { return supaFetch('madi_children?on_conflict=id', 'POST', batch); }); }, Promise.resolve())
    .catch(function(e) { console.error('아동 저장 실패:', e); showToast('❌ 서버 저장 실패 — 인터넷 연결 확인 후 다시 시도해주세요'); });
}
function getSaveErrMsg(e, label) {
  var msg = e && e.message ? e.message : '';
  if (!navigator.onLine) return label + ' 저장 실패 — 인터넷 연결을 확인해주세요';
  if (msg.indexOf('403') !== -1 || msg.indexOf('401') !== -1) return label + ' 저장 권한 없음 — 관리자에게 문의해주세요';
  if (msg.indexOf('timeout') !== -1 || msg.indexOf('RETRY') !== -1) return label + ' 저장 실패 — 서버 응답 없음, 잠시 후 재시도해주세요';
  return label + ' 저장 실패 — 잠시 후 다시 시도해주세요';
}
function saveSessions() {
  markMyChange(); safeSetItem('cn3_sessions', JSON.stringify(sessionDB)); if (sessionDB.length === 0) return;
  var cid = getCenterId(), rows = sessionDB.map(function(s){ return { id: s.id, center_id: cid, data: s }; }), batches = [];
  for (var i = 0; i < rows.length; i += 50) batches.push(rows.slice(i, i + 50));
  batches.reduce(function(p, batch) { return p.then(function() { return supaFetch('madi_sessions?on_conflict=id', 'POST', batch); }); }, Promise.resolve())
    .catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, '세션')); });
}
function saveSchedule() {
  markMyChange(); safeSetItem('cn3_schedule', JSON.stringify(scheduleDB)); if (scheduleDB.length === 0) return;
  var cid = getCenterId(), rows = scheduleDB.map(function(s){ return { id: s.id, center_id: cid, data: s }; }), batches = [];
  for (var i = 0; i < rows.length; i += 50) batches.push(rows.slice(i, i + 50));
  batches.reduce(function(p, batch) { return p.then(function() { return supaFetch('madi_schedules?on_conflict=id', 'POST', batch); }); }, Promise.resolve())
    .catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, '일정')); });
}
function saveAssess() {
  markMyChange(); safeSetItem('cn3_assess', JSON.stringify(assessmentDB)); if (assessmentDB.length === 0) return;
  var cid = getCenterId(), rows = assessmentDB.map(function(a){ return { id: a.id, center_id: cid, user_id: a.user_id || null, data: a }; }), batches = [];
  for (var i = 0; i < rows.length; i += 50) batches.push(rows.slice(i, i + 50));
  batches.reduce(function(p, batch) { return p.then(function() { return supaFetch('madi_assessments?on_conflict=id', 'POST', batch); }); }, Promise.resolve())
    .catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, '검사')); });
}

var childDB = [], sessionDB = [], scheduleDB = [], assessmentDB = [], activityDB = [], iepDB = [];
function loadDB() {
  try { childDB      = JSON.parse(localStorage.getItem('cn3_children')   || '[]'); } catch(e){ childDB=[]; }
  try { sessionDB    = JSON.parse(localStorage.getItem('cn3_sessions')   || '[]'); } catch(e){ sessionDB=[]; }
  try { scheduleDB   = JSON.parse(localStorage.getItem('cn3_schedule')   || '[]'); } catch(e){ scheduleDB=[]; }
  try { assessmentDB = JSON.parse(localStorage.getItem('cn3_assess')     || '[]'); } catch(e){ assessmentDB=[]; }
  try { activityDB   = JSON.parse(localStorage.getItem('cn3_activities') || '[]'); } catch(e){ activityDB=[]; }
  try { iepDB        = JSON.parse(localStorage.getItem('cn3_iep')        || '[]'); } catch(e){ iepDB=[]; }
}
function saveIEP() {
  safeSetItem('cn3_iep', JSON.stringify(iepDB));
  var cid = getCenterId(), rows = iepDB.map(function(r){ return { id: r.id, center_id: cid, data: r }; });
  if (rows.length === 0) return;
  supaFetch('madi_iep_history?on_conflict=id', 'POST', rows).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}
function loadIEPFromSupa() {
  supaFetch('madi_iep_history?' + centerFilter() + '&select=id,data&order=id.desc', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      var parsed = rows.filter(function(r){ return r && r.data; }).map(function(r){ var d=r.data; d.id=r.id; return d; });
      if (parsed.length > 0) { iepDB = parsed; safeSetItem('cn3_iep', JSON.stringify(iepDB)); var _iepEl = document.getElementById('iepChild'); if (_iepEl) renderIEPHistory(parseInt(_iepEl.value) || 0); }
    }).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}
function saveActivities() {
  safeSetItem('cn3_activities', JSON.stringify(activityDB));
  var cid = getCenterId(), rows = activityDB.map(function(a){ return Object.assign({}, a, { center_id: cid }); });
  supaFetch('madi_activities?on_conflict=id', 'POST', rows).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}
function loadActivitiesFromSupa() {
  supaFetch('madi_activities?' + centerFilter() + '&order=id.asc', 'GET')
    .then(function(rows) { if (Array.isArray(rows) && rows.length > 0) { activityDB = rows; safeSetItem('cn3_activities', JSON.stringify(activityDB)); renderActivityCatalog(); } })
    .catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}

// ── 커스텀 confirm 모달 (브라우저 confirm 대체) ──
function showConfirm(msg, onOk, opts) {
  opts = opts || {};
  var okLabel     = opts.okLabel     || '확인';
  var cancelLabel = opts.cancelLabel || '취소';
  var danger      = opts.danger !== false;
  var ov = document.createElement('div');
  ov.className = 'confirm-ov';
  ov.innerHTML = '<div class="confirm-box" role="alertdialog" aria-modal="true">'
    + '<p class="confirm-msg">' + escHtml(msg).replace(/\n/g,'<br>') + '</p>'
    + '<div class="confirm-btns">'
    + '<button class="btn btn-ghost confirm-cancel">' + escHtml(cancelLabel) + '</button>'
    + '<button class="btn ' + (danger ? 'btn-del' : 'btn-primary') + ' confirm-ok">' + escHtml(okLabel) + '</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  function close() { if (ov.parentNode) document.body.removeChild(ov); document.removeEventListener('keydown', _onKey); }
  function _onKey(e) {
    if (e.key === 'Escape') { close(); if (opts.onCancel) opts.onCancel(); }
  }
  ov.querySelector('.confirm-cancel').onclick = function() { close(); if (opts.onCancel) opts.onCancel(); };
  ov.querySelector('.confirm-ok').onclick = function() { close(); onOk(); };
  ov.addEventListener('click', function(e) { if (e.target === ov) { close(); if (opts.onCancel) opts.onCancel(); } });
  document.addEventListener('keydown', _onKey);
  setTimeout(function() { var b = ov.querySelector('.confirm-ok'); if (b) b.focus(); }, 50);
}

var toastTimer = null, toastForceTimer = null, toastLocked = false;
function debounce(fn, delay) { var timer = null; return function() { var ctx = this, args = arguments; clearTimeout(timer); timer = setTimeout(function() { fn.apply(ctx, args); }, delay); }; }
var CHILD_PAGE_SIZE = 50, _childCurrentPage = 1, _optionsCacheKey = null, _optionsCacheHtml = '';

function showToast(msg, opts) {
  opts = opts || {}; if (toastLocked && !opts.force) return;
  var el = document.getElementById('toast');
  if (opts.undo && typeof opts.undo === 'function') {
    el.innerHTML = '<span>' + escHtml(msg) + '</span> <span style="display:inline-block;margin-left:8px;padding:3px 10px;background:rgba(255,255,255,0.18);border-radius:14px;color:#5eead4;font-size:12px;cursor:pointer;pointer-events:auto;" id="toastUndoBtn">↩️ 실행취소</span>';
    el.style.pointerEvents = 'auto';
    setTimeout(function() { var b = document.getElementById('toastUndoBtn'); if (b) b.onclick = function(e) { e.stopPropagation(); opts.undo(); el.classList.remove('show'); toastLocked = false; }; }, 0);
  } else { el.textContent = msg; el.style.pointerEvents = 'auto'; }
  el.onclick = function() { el.classList.remove('show'); clearTimeout(toastTimer); clearTimeout(toastForceTimer); toastTimer = null; toastForceTimer = null; toastLocked = false; };
  var wasShowing = el.classList.contains('show'); el.classList.add('show');
  if (!wasShowing) {
    clearTimeout(toastForceTimer);
    var maxDuration = opts.lock ? (opts.duration || 8000) : 5000;
    toastForceTimer = setTimeout(function() { el.classList.remove('show'); toastLocked = false; toastForceTimer = null; }, maxDuration);
  }
  clearTimeout(toastTimer);
  var duration = opts.duration || (opts.undo ? 5000 : 2500);
  if (opts.lock) toastLocked = true;
  toastTimer = setTimeout(function() { el.classList.remove('show'); toastLocked = false; }, duration);
}
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    clearTimeout(toastTimer); clearTimeout(toastForceTimer); toastTimer = null; toastForceTimer = null; toastLocked = false;
    var el = document.getElementById('toast'); if (el) el.classList.remove('show');
  }
});

function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern || 30); } catch(e) {} }
function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark-mode'); localStorage.setItem('madi_dark', isDark ? '1' : '0');
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', isDark ? '#020617' : '#0ea5a0');
  showToast(isDark ? '🌙 다크 모드' : '☀️ 라이트 모드');
}
function loadDarkMode() {
  var saved = localStorage.getItem('madi_dark');
  if (saved === '1') { document.body.classList.add('dark-mode'); var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', '#020617'); }
}
function updateHeaderClock() {
  var timeEl = document.getElementById('clockTime'), nextEl = document.getElementById('clockNext');
  if (!timeEl || !nextEl) return;
  var now = nowKST(); timeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  var today = ymd(now), nowMin = now.getHours()*60+now.getMinutes();
  var upcoming = (typeof scheduleDB !== 'undefined' ? scheduleDB : [])
    .filter(function(s){ if (s.date !== today || !s.startTime) return false; var p = s.startTime.split(':'); return parseInt(p[0])*60+parseInt(p[1]) >= nowMin; })
    .sort(function(a,b){ return a.startTime.localeCompare(b.startTime); });
  if (upcoming.length > 0) {
    var next = upcoming[0], child = (typeof childDB !== 'undefined' ? childDB : []).find(function(c){ return c.id === next.childId; });
    var name = child ? child.name : '?', p = next.startTime.split(':'), diff = (parseInt(p[0])*60+parseInt(p[1]))-nowMin;
    nextEl.textContent = diff === 0 ? '🔔 '+name+' 지금' : diff < 60 ? '⏱️ '+name+' '+diff+'분 후' : '📅 '+name+' '+next.startTime;
  } else { var count = (typeof childDB !== 'undefined' ? childDB.length : 0); nextEl.textContent = count > 0 ? '아동 '+count+'명' : '오늘 일정 없음'; }
}
var _clockTimer = null, _clockVcBound = false;
function startHeaderClock() {
  updateHeaderClock();
  if (_clockTimer) clearInterval(_clockTimer);
  _clockTimer = setInterval(updateHeaderClock, 60000);
  // visibilitychange 리스너 중복 등록 방지
  if (!_clockVcBound) {
    _clockVcBound = true;
    document.addEventListener('visibilitychange', function() { if (!document.hidden) updateHeaderClock(); });
  }
}

function fetchWithRetry(url, options, opts) {
  opts = opts || {}; var maxRetries = opts.retries !== undefined ? opts.retries : 3, baseDelay = opts.delay !== undefined ? opts.delay : 1000, label = opts.label || '요청', onSlow = opts.onSlow;
  if ((options.method || 'GET').toUpperCase() === 'POST' && !opts.allowPostRetry) maxRetries = 0;
  var attempt = 0, slowTimer = setTimeout(function() { if (typeof onSlow === 'function') onSlow(); }, 5000);
  function doFetch() {
    return fetch(url, options).then(function(res) {
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) throw new Error('RETRY:' + res.status);
      clearTimeout(slowTimer); return res;
    }).catch(function(err) {
      var isRetriable = err.message && err.message.startsWith('RETRY:'), isNetwork = err.message && err.message.includes('Failed to fetch');
      if ((isRetriable || isNetwork) && attempt < maxRetries) { attempt++; var delay = baseDelay * Math.pow(2, attempt-1); if (window.console && console.debug) console.debug('['+label.split('?')[0]+'] 재시도 '+attempt+'/'+maxRetries); return new Promise(function(resolve){ setTimeout(resolve,delay); }).then(doFetch); }
      clearTimeout(slowTimer); throw err;
    });
  }
  return doFetch();
}

function setupNetworkMonitor() {
  function showOfflineBanner() {
    if (document.getElementById('offlineBanner')) return;
    var b = document.createElement('div'); b.id = 'offlineBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:8px 14px;font-size:12px;font-weight:700;text-align:center;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    b.innerHTML = '🔌 인터넷 연결 끊김 — 변경사항은 연결 복구 시 자동 동기화됩니다'; document.body.appendChild(b);
  }
  function hideOfflineBanner() { var b = document.getElementById('offlineBanner'); if (b) { b.style.background = '#10b981'; b.innerHTML = '✅ 인터넷 연결 복구'; setTimeout(function() { b.remove(); }, 2500); } }
  window.addEventListener('online', hideOfflineBanner); window.addEventListener('offline', showOfflineBanner);
  if (!navigator.onLine) showOfflineBanner();
}

// ★ 학부모 전용 UI 적용
function applyParentUI() {
  var isMobile = window.innerWidth <= 767;
  var staffTabs = document.querySelector('.tabs:not(#parentTabs)');
  if (staffTabs) staffTabs.style.display = 'none';
  var parentTabs = document.getElementById('parentTabs');
  if (parentTabs) parentTabs.style.cssText = isMobile ? 'display:flex !important;' : 'display:none !important;';
  var sidebar = document.getElementById('appSidebar');
  if (sidebar) sidebar.style.display = 'none';
  var sidebarToggle = document.getElementById('sidebarToggleBtn');
  if (sidebarToggle) sidebarToggle.style.display = 'none';
  var breadcrumb = document.querySelector('.breadcrumb-bar');
  if (breadcrumb) breadcrumb.style.display = 'none';
  var deployBtn = document.getElementById('headerDeployBtn');
  if (deployBtn) deployBtn.style.display = 'none';
  var floatBtn = document.getElementById('floatBtn');
  if (floatBtn) floatBtn.style.display = 'none';
  var chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.style.display = 'none';
  document.querySelectorAll('.tab-panel, .sub-panel').forEach(function(el) {
    if (!el.id.startsWith('parentPanel')) el.style.display = 'none';
  });
  if (!isMobile) _initParentSidebar();
  switchParentTab('home');
}

function _initParentSidebar() {
  var existing = document.getElementById('parentSidebar');
  if (existing) { existing.style.display = 'flex'; return; }
  var sb = document.createElement('div');
  sb.id = 'parentSidebar';
  sb.innerHTML =
    '<button id="ptBtnHome" class="psb-btn" onclick="switchParentTab(\'home\')">' +
    '<span class="psb-icon">🏠</span><span class="psb-label">홈</span></button>' +
    '<button id="ptBtnSched" class="psb-btn" onclick="switchParentTab(\'sched\')">' +
    '<span class="psb-icon">📅</span><span class="psb-label">일정</span></button>' +
    '<button id="ptBtnReport" class="psb-btn" onclick="switchParentTab(\'report\')">' +
    '<span class="psb-icon">📋</span><span class="psb-label">리포트</span></button>' +
    '<button id="ptBtnNotice" class="psb-btn" onclick="switchParentTab(\'notice\')">' +
    '<span class="psb-icon">📢</span><span class="psb-label">공지</span></button>';
  var _appLayout = document.querySelector('.app-layout');
  if (_appLayout) {
    _appLayout.insertBefore(sb, _appLayout.firstChild);
    sb.setAttribute('style',
      'width:68px;display:flex;flex-direction:column;align-items:center;' +
      'padding:12px 0;gap:2px;background:white;border-right:1px solid #e2e8f0;' +
      'flex-shrink:0;z-index:100;box-shadow:2px 0 8px rgba(0,0,0,0.06);overflow-y:auto;'
    );
  } else {
    document.body.appendChild(sb);
    var _hdr = document.querySelector('.header');
    var _topPx = _hdr ? (_hdr.offsetTop + _hdr.offsetHeight) : 60;
    sb.setAttribute('style',
      'position:fixed !important;left:0 !important;top:' + _topPx + 'px !important;bottom:0 !important;' +
      'width:68px;display:flex !important;flex-direction:column;align-items:center;' +
      'padding:12px 0;gap:2px;background:white;border-right:1px solid #e2e8f0;' +
      'z-index:9000;box-shadow:2px 0 8px rgba(0,0,0,0.06);'
    );
  }
  var _btnStyle = 'display:flex;flex-direction:column;align-items:center;gap:3px;width:56px;' +
    'padding:10px 4px;border:none;background:none;border-radius:10px;cursor:pointer;color:#64748b;font-family:inherit;';
  sb.querySelectorAll('button').forEach(function(btn) { btn.style.cssText = _btnStyle; });
  sb.querySelectorAll('.psb-icon').forEach(function(el) { el.style.cssText = 'font-size:20px;line-height:1;'; });
  sb.querySelectorAll('.psb-label').forEach(function(el) { el.style.cssText = 'font-size:10px;font-weight:700;'; });
}

function resetParentUI() {
  var psb = document.getElementById('parentSidebar'); if (psb) psb.style.display = 'none';
  var staffTabs = document.querySelector('.tabs:not(#parentTabs)');
  if (staffTabs) staffTabs.style.display = '';
  var parentTabs = document.getElementById('parentTabs');
  if (parentTabs) { parentTabs.style.cssText = ''; parentTabs.style.display = 'none'; }
  var sidebar = document.getElementById('appSidebar');
  if (sidebar) sidebar.style.display = '';
  var sidebarToggle = document.getElementById('sidebarToggleBtn');
  if (sidebarToggle) sidebarToggle.style.display = '';
  var breadcrumb = document.querySelector('.breadcrumb-bar');
  if (breadcrumb) breadcrumb.style.display = '';
  document.querySelectorAll('.tab-panel, .sub-panel').forEach(function(el) {
    if (!el.id.startsWith('parentPanel')) el.style.display = '';
  });
  var floatBtn = document.getElementById('floatBtn');
  if (floatBtn) floatBtn.style.display = '';
  var chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.style.display = '';
  var appMain = document.getElementById('appMain'); if (appMain) appMain.style.paddingLeft = '';
}

function loadParentDashboard() {
  if (!currentUser || currentUser.role !== 'parent') return;
  supaFetch('madi_parent_children?parent_user_id=eq.' + currentUser.id + '&select=child_id,center_id', 'GET')
    .then(function(links) { if (!Array.isArray(links) || links.length === 0) return; window._parentChildId = links[0].child_id; window._parentCenterId = links[0].center_id; })
    .catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}

function toggleMoreMenu(e) { if (e) e.stopPropagation(); var menu = document.getElementById('moreMenu'); if (!menu) return; menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none'; }
function closeMoreMenu() { var menu = document.getElementById('moreMenu'); if (menu) menu.style.display = 'none'; }
document.addEventListener('click', function(e) {
  var menu = document.getElementById('moreMenu'); if (!menu || menu.style.display === 'none') return;
  var moreBtn = document.getElementById('tabBtnMore'); if (moreBtn && moreBtn.contains(e.target)) return;
  if (menu.contains(e.target)) return; closeMoreMenu();
});

function getRoleFlags(user) {
  user = user || (typeof currentUser !== 'undefined' ? currentUser : null);
  if (!user || !user.role) return { isAuth:false, isSuper:false, isAdmin:false, isTeacher:false, isParent:false, isAdminOrSuper:false };
  var r = user.role;
  return { isAuth:true, isSuper:r==='superadmin', isAdmin:r==='admin', isTeacher:r==='teacher', isParent:r==='parent', isAdminOrSuper:r==='admin'||r==='superadmin' };
}
function validatePasswordStrength(pw) {
  // 테스트 기간 — 정책 단순 유지 (4자 최소)
  // 운영 전환 시 8자+영숫자 권장. 강화 패치는 git 이력 fc9febe 참고.
  if (!pw || pw.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
  return null;
}

// ─────── ID 생성 유틸 (cowork #5 개선: 충돌 확률 1/10,000 → 1/1,000,000) ───────
function generateClientId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    var arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    // 초 단위 타임스탬프(10자리) × 10^6 + 랜덤 6자리 → 16자리 숫자
    // Number.MAX_SAFE_INTEGER(9.0×10^15) 범위 내 유지, DB 타입 호환
    return Math.floor(Date.now() / 1000) * 1000000 + (arr[0] % 1000000);
  }
  return Date.now() + Math.floor(Math.random() * 10000);
}

function applyUserUI() {
  if (!currentUser) return;
  var headerUser = document.getElementById('headerUser');
  var headerUserName = document.getElementById('headerUserName');
  var headerUserBadge = document.getElementById('headerUserBadge');
  if (!headerUser || !headerUserName || !headerUserBadge) return;
  headerUserName.textContent = currentUser.name;
  if (currentUser.role === 'parent') {
    headerUserBadge.textContent = '학부모';
    headerUserBadge.style.background = 'rgba(245,158,11,0.25)';
    headerUserBadge.style.borderColor = 'rgba(245,158,11,0.5)';
    applyParentUI();
  } else {
    headerUserBadge.textContent = currentUser.role === 'superadmin' ? '대장님 👑' : currentUser.role === 'admin' ? '원장님 🏥' : '선생님 👩‍⚕️';
    if (typeof resetParentUI === 'function') resetParentUI();
  }
  headerUser.style.display = 'flex';
  if (typeof updateSidebarAdminVisibility === 'function') updateSidebarAdminVisibility();
}
