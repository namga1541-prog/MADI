
// ─────── 상수 ───────
var MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
var MODEL_SONNET = 'claude-sonnet-4-6';
var AI_MODEL_PREF = localStorage.getItem('madi_ai_model') || 'lite';

// ─────── 권한 관리 ───────
var DEFAULT_PERMS = { viewOtherChildren:true, deleteSession:true, useAI:true };
function canDo(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  var p = currentUser.permissions || {};
  return p[perm] !== false;
}

// 현재 사용자가 담당하는 아동인지 판별
function isMyChild(childId) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  var myName = currentUser.name;
  var hasSession = (typeof sessionDB !== 'undefined') &&
    sessionDB.some(function(s){ return s.childId === childId && s.teacher === myName; });
  if (hasSession) return true;
  var hasSchedule = (typeof scheduleDB !== 'undefined') &&
    scheduleDB.some(function(s){ return s.childId === childId && s.teacher === myName; });
  return hasSchedule;
}
function applyPermissions() {
  if (!currentUser) return;
  var isAdminOrSuper = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  var settingsBtn = document.getElementById('tabBtn5');
  if (settingsBtn) settingsBtn.style.display = isAdminOrSuper ? '' : 'none';
  var svcBtn = document.getElementById('tabBtn4');
  if (svcBtn) svcBtn.style.display = isAdminOrSuper ? '' : 'none';
  if (isAdminOrSuper) return;
  if (!canDo('useAI')) {
    var aiSubBtn = document.getElementById('ptBtn_ai');
    if (aiSubBtn) aiSubBtn.style.display = 'none';
  }
}
function getAIModel() { return AI_MODEL_PREF === 'pro' ? MODEL_SONNET : MODEL_HAIKU; }
function setAIModel(val) {
  AI_MODEL_PREF = val;
  localStorage.setItem('madi_ai_model', val);
  var badge = document.getElementById('aiModelBadge');
  if (badge) badge.textContent = val === 'pro' ? '⚡ PRO (Sonnet)' : '✨ 라이트 (Haiku)';
  showToast(val === 'pro' ? '⚡ PRO 모드 (Sonnet)로 변경됐어요' : '✨ 라이트 모드 (Haiku)로 변경됐어요');
}
var DISORDER_EMOJI = {
  '언어발달장애':'🗣️','조음음운장애':'👄','유창성장애':'💬',
  '자폐스펙트럼':'🌈','지적장애':'🧩','청각장애':'👂','기타':'📋'
};
var CHILD_COLORS = ['#0ea5a0','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981'];

// ─────── DB ───────
// ─────── 선생님 색상 팔레트 ───────
var TEACHER_COLORS = [
  '#0ea5a0','#6366f1','#f59e0b','#ef4444','#10b981',
  '#8b5cf6','#f97316','#06b6d4','#84cc16','#ec4899',
  '#14b8a6','#a855f7','#eab308','#3b82f6','#f43f5e'
];
var _teacherColorMap = {};
function getTeacherColor(name) {
  if (!name) return '#94a3b8';
  if (!_teacherColorMap[name]) {
    var idx = Object.keys(_teacherColorMap).length % TEACHER_COLORS.length;
    _teacherColorMap[name] = TEACHER_COLORS[idx];
  }
  return _teacherColorMap[name];
}

// ─────── Supabase 설정 ───────
var SUPA_URL  = 'https://ujxdhafzjyrglaclarwe.supabase.co';
var EDGE_URL  = 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1';
var _madiToken = null;
var SUPA_REALTIME_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeGRoYWZ6anlyZ2xhY2xhcndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODA3ODgsImV4cCI6MjA5Mjk1Njc4OH0.V0chvVlTG1M_pD_c2obJpNP41WuaYOtAHQt4Fg_nbig';

function getToken()   { return _madiToken || localStorage.getItem('madi_token') || ''; }
function setToken(t)  { _madiToken = t; localStorage.setItem('madi_token', t); }
function clearToken() { _madiToken = null; localStorage.removeItem('madi_token'); }

function supaFetch(path, method, body) {
  return fetchWithRetry(EDGE_URL + '/api', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_REALTIME_KEY,
      'Authorization': 'Bearer ' + getToken()
    },
    body: JSON.stringify({ path: path, method: method || 'GET', body: body || null })
  }, {
    retries: 2,
    allowPostRetry: true,
    label: 'Supabase ' + (method || 'GET') + ' ' + path.split('?')[0]
  }).then(function(r) {
    if (!r.ok && r.status !== 200 && r.status !== 201) {
      return r.text().then(function(t){ throw new Error(r.status + ': ' + t); });
    }
    var ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  });
}

// ─────── 현재 로그인 사용자 ───────
var currentUser = null;

function hashPassword(pw) {
  var enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(pw))
    .then(function(buf) {
      return Array.from(new Uint8Array(buf))
        .map(function(b){ return b.toString(16).padStart(2, '0'); })
        .join('');
    });
}

function getCenterId() {
  return (currentUser && currentUser.center_id) ? currentUser.center_id : '';
}

function centerFilter() {
  if (currentUser && currentUser.role === 'admin') return 'center_id=not.is.null';
  var cid = getCenterId();
  if (!cid) return 'center_id=eq.INVALID';
  return 'center_id=eq.' + cid;
}

// ─────── 로그인 화면 ───────
function showLanding() {
  var el = document.getElementById('landingScreen');
  if (el) el.style.display = 'flex';
}
function backToLanding() {
  document.getElementById('loginScreen').style.display = 'none';
  var ss = document.getElementById('signupScreen');
  if (ss) ss.style.display = 'none';
  showLanding();
}
function hideLanding() {
  var el = document.getElementById('landingScreen');
  if (el) el.style.display = 'none';
}
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  loadUserList();
}

function hideLoginScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  showDashboard();
}

function loadUserList() {
  var un  = document.getElementById('loginUsernameInput');
  var pw  = document.getElementById('loginPwInput');
  var err = document.getElementById('loginError');
  var lastId = localStorage.getItem('madi_last_id') || '';
  if (un) un.value = lastId;
  if (pw) pw.value = '';
  if (err) err.textContent = '';
  if (lastId) {
    if (pw) setTimeout(function(){ pw.focus(); }, 200);
  } else {
    if (un) setTimeout(function(){ un.focus(); }, 200);
  }
}

// ─────── 신규 가입 ───────
var _inviteCheckTimer = null;
function onInviteCodeInput() {
  if (_inviteCheckTimer) clearTimeout(_inviteCheckTimer);
  var label = document.getElementById('signupCenterName');
  var code  = (document.getElementById('signupInviteCode').value || '').trim().toUpperCase();
  if (!code) { label.textContent = ''; return; }
  if (code.length < 5) { label.textContent = ''; return; }
  label.style.color = 'var(--text2)';
  label.textContent = '확인 중...';
  _inviteCheckTimer = setTimeout(function() {
    supaFetch('madi_centers?invite_code=eq.' + encodeURIComponent(code) + '&select=name,invite_expires_at', 'GET')
      .then(function(centers) {
        if (Array.isArray(centers) && centers.length > 0) {
          var c = centers[0];
          if (c.invite_expires_at) {
            var exp = new Date(c.invite_expires_at);
            if (!isNaN(exp.getTime()) && exp - new Date() < 0) {
              label.style.color = '#ef4444';
              label.textContent = '⛔ 만료된 초대 코드입니다';
              return;
            }
          }
          label.style.color = 'var(--mint)';
          label.textContent = '✅ ' + c.name;
        } else {
          label.style.color = '#ef4444';
          label.textContent = '⚠️ 유효하지 않은 코드입니다';
        }
      })
      .catch(function() { label.textContent = ''; });
  }, 500);
}

function showSignupScreen() {
  hideLanding();
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('signupScreen').style.display = 'flex';
  ['signupInviteCode','signupName','signupUsername','signupPassword','signupPasswordConfirm'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('signupError').textContent = '';
  document.getElementById('signupCenterName').textContent = '';
  setTimeout(function(){
    var inv = document.getElementById('signupInviteCode');
    if (inv) inv.focus();
  }, 200);
}

function backToLoginFromSignup() {
  document.getElementById('signupScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function doSignup() {
  var errEl = document.getElementById('signupError');
  var btn   = document.getElementById('signupSubmitBtn');
  errEl.textContent = '';

  var inviteCode = (document.getElementById('signupInviteCode').value || '').trim().toUpperCase();
  var name       = (document.getElementById('signupName').value || '').trim();
  var username   = (document.getElementById('signupUsername').value || '').trim();
  var pw         = document.getElementById('signupPassword').value || '';
  var pwConfirm  = document.getElementById('signupPasswordConfirm').value || '';

  if (!inviteCode) { errEl.textContent = '초대 코드를 입력해주세요.'; return; }
  if (!name)       { errEl.textContent = '이름을 입력해주세요.'; return; }
  if (!username)   { errEl.textContent = '아이디를 입력해주세요.'; return; }
  if (!pw)         { errEl.textContent = '비밀번호를 입력해주세요.'; return; }
  if (!pwConfirm)  { errEl.textContent = '비밀번호 확인을 입력해주세요.'; return; }

  if (username.length < 4) { errEl.textContent = '아이디는 4자 이상이어야 합니다.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = '아이디는 영문/숫자/언더바(_)만 사용 가능합니다.'; return; }
  if (pw.length < 4) { errEl.textContent = '비밀번호는 4자 이상이어야 합니다.'; return; }
  if (pw !== pwConfirm) { errEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }

  btn.disabled = true;
  btn.textContent = '확인 중...';

  supaFetch('madi_centers?invite_code=eq.' + encodeURIComponent(inviteCode) + '&select=id,name,invite_expires_at', 'GET')
    .then(function(centers) {
      if (!Array.isArray(centers) || centers.length === 0) {
        throw new Error('유효하지 않은 초대 코드입니다.');
      }
      var center = centers[0];
      if (center.invite_expires_at) {
        var exp = new Date(center.invite_expires_at);
        if (!isNaN(exp.getTime()) && exp - new Date() < 0) {
          throw new Error('만료된 초대 코드입니다. 관리자에게 새 코드를 요청해주세요.');
        }
      }
      return supaFetch('madi_users?username=eq.' + encodeURIComponent(username) + '&select=id', 'GET')
        .then(function(rows) {
          if (Array.isArray(rows) && rows.length > 0) {
            throw new Error('이미 사용 중인 아이디입니다.');
          }
          return center;
        });
    })
    .then(function(center) {
      return hashPassword(pw).then(function(hashed) {
        var newUser = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          username: username,
          name: name,
          password: hashed,
          role: 'teacher',
          center_id: center.id,
          color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
          permissions: { viewOtherChildren:true, deleteSession:true, useAI:true }
        };
        return supaFetch('madi_users', 'POST', [newUser])
          .then(function(){ return { center: center, user: newUser }; });
      });
    })
    .then(function(result) {
      btn.disabled = false;
      btn.textContent = '✨ 가입하기';
      currentUser = {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        role: result.user.role,
        color: result.user.color,
        center_id: result.user.center_id,
        permissions: result.user.permissions
      };
      try { localStorage.setItem('madi_user', JSON.stringify(currentUser)); } catch(e) {}
      document.getElementById('signupScreen').style.display = 'none';
      hideLoginScreen();
      if (typeof applyUserUI === 'function') applyUserUI();
      if (typeof applyRoleUI === 'function') applyRoleUI();
      if (typeof loadCenterApiKey === 'function') loadCenterApiKey();
      if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase();
      if (typeof initRealtime === 'function') initRealtime();
      showToast('🎉 환영합니다, ' + result.user.name + ' 선생님! (' + result.center.name + ')');
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = '✨ 가입하기';
      errEl.textContent = '❌ ' + (err.message || '가입에 실패했습니다.');
    });
}

function doLogin() {
  var unEl = document.getElementById('loginUsernameInput');
  var pwEl = document.getElementById('loginPwInput');
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginSubmitBtn');
  var un = unEl ? unEl.value.trim() : '';
  var pw = pwEl ? pwEl.value : '';

  if (errEl) errEl.textContent = '';
  if (!un) { if (errEl) errEl.textContent = '아이디를 입력해주세요.'; return; }
  if (!pw) { if (errEl) errEl.textContent = '비밀번호를 입력해주세요.'; return; }

  if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }

  fetchWithRetry(EDGE_URL + '/login', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_REALTIME_KEY
    },
    body: JSON.stringify({ username: un, password: pw })
  }, { retries: 1, label: '로그인' })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (btn) { btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (data.error) {
      if (errEl) errEl.textContent = data.error;
      return;
    }
    setToken(data.token);
    currentUser = data.user;
    localStorage.setItem('madi_user', JSON.stringify(currentUser));
    localStorage.setItem('madi_last_id', un);
    hideLoginScreen();
    applyUserUI();
    applyRoleUI();
    loadCenterApiKey();
    loadDBFromSupabase();
    initRealtime();
  }).catch(function() {
    if (btn) { btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (errEl) errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  });
}

// ─────── 마디 로고 SVG 단일 관리 함수 ───────
function getMadiLogoSVG(w, h) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="' + w + '" height="' + h + '">'
    + '<rect width="130" height="130" rx="28" fill="#0ea5a0"/>'
    + '<rect x="28" y="54" width="10" height="22" rx="4" fill="white"/>'
    + '<rect x="44" y="40" width="10" height="50" rx="4" fill="white"/>'
    + '<rect x="60" y="30" width="10" height="70" rx="4" fill="white"/>'
    + '<rect x="76" y="45" width="10" height="40" rx="4" fill="white"/>'
    + '<rect x="92" y="56" width="10" height="18" rx="4" fill="white"/>'
    + '</svg>';
}

document.addEventListener('DOMContentLoaded', function() {
  restoreSidebarState();

  var lpNav = document.querySelector('.lp-nav-logo-icon');
  if (lpNav) lpNav.innerHTML = getMadiLogoSVG(20, 20);
  document.querySelectorAll('.login-logo-icon').forEach(function(el) {
    el.innerHTML = getMadiLogoSVG(34, 34);
  });
  var logoIcon = document.querySelector('.logo-icon');
  if (logoIcon) logoIcon.innerHTML = getMadiLogoSVG(22, 22);

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

function applyUserUI() {
  if (!currentUser) return;
  var headerUser = document.getElementById('headerUser');
  var headerUserName = document.getElementById('headerUserName');
  var headerUserBadge = document.getElementById('headerUserBadge');
  if (!headerUser || !headerUserName || !headerUserBadge) return;
  headerUserName.textContent = currentUser.name;
  headerUserBadge.textContent = (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? '관리자' : '선생님';
  headerUser.style.display = 'flex';
  if (typeof updateSidebarAdminVisibility === 'function') updateSidebarAdminVisibility();
}

function showLogoutMenu() {
  if (confirm(currentUser.name + '님, 로그아웃 하시겠습니까?')) {
    stopRealtime();
    currentUser = null;
    clearToken();
    localStorage.removeItem('madi_user');
    childDB=[]; sessionDB=[]; scheduleDB=[]; assessmentDB=[];
    renderChildGrid();
    document.getElementById('headerUser').style.display = 'none';
    showLoginScreen();
  }
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
    function safeMap(arr) {
      if (!Array.isArray(arr)) return [];
      return arr.filter(function(r){ return r && r.data; })
                .map(function(r){ var d=r.data; d.id=r.id; return d; });
    }
    var supaCh  = safeMap(results[0]);
    var supaSe  = safeMap(results[1]);
    var supaSch = safeMap(results[2]);
    var supaAs  = safeMap(results[3]);

    var localCh = [];
    try { localCh = JSON.parse(localStorage.getItem('cn3_children') || '[]'); } catch(e){}

    if (supaCh.length === 0 && localCh.length > 0) {
      childDB = localCh;
      try { sessionDB    = JSON.parse(localStorage.getItem('cn3_sessions') || '[]'); } catch(e){ sessionDB=[]; }
      try { scheduleDB   = JSON.parse(localStorage.getItem('cn3_schedule') || '[]'); } catch(e){ scheduleDB=[]; }
      try { assessmentDB = JSON.parse(localStorage.getItem('cn3_assess')   || '[]'); } catch(e){ assessmentDB=[]; }
      saveChildren(); saveSessions(); saveSchedule(); saveAssess();
      showToast('☁️ 기존 데이터 ' + childDB.length + '명 → Supabase 자동 업로드 완료!');
    } else {
      childDB      = supaCh;
      sessionDB    = supaSe;
      scheduleDB   = supaSch;
      assessmentDB = supaAs;
      if (silent) showToast('🔄 데이터 업데이트됨');
      else showToast('✅ 데이터 로드 완료 (아동 ' + childDB.length + '명)');
    }

    renderChildGrid();
    populateChildSelects();
    renderGoalRows();
    renderSessionList();
    renderUnwrittenAlert();
    renderStaffCard();
    if (typeof renderSchedView === 'function') renderSchedView();
    if (typeof renderDashboard === 'function') renderDashboard();
    loadActivitiesFromSupa();
    loadIEPFromSupa();
    setTimeout(function() {
      if (typeof loadNotices === 'function') loadNotices();
    }, 600);
  }).catch(function(e) {
    console.error('loadDB 실패:', e);
    showToast('❌ 데이터 로드 실패 — 로컬 데이터로 표시합니다');
    loadDB();
    renderChildGrid();
    populateChildSelects();
  });
}

function saveChildren() {
  markMyChange();
  _optionsCacheKey = null;
  localStorage.setItem('cn3_children', JSON.stringify(childDB));
  if (childDB.length === 0) return;
  var cid = getCenterId();
  var rows = childDB.map(function(c){ return { id: c.id, center_id: cid, data: c }; });
  var batches = [];
  for (var i = 0; i < rows.length; i += 50) { batches.push(rows.slice(i, i + 50)); }
  batches.reduce(function(p, batch) {
    return p.then(function() {
      return supaFetch('madi_children?on_conflict=id', 'POST', batch);
    });
  }, Promise.resolve()).catch(function(e) {
    console.error('아동 저장 실패:', e);
    showToast('❌ 서버 저장 실패 — 인터넷 연결 확인 후 다시 시도해주세요');
  });
}
function saveSessions() {
  markMyChange();
  localStorage.setItem('cn3_sessions', JSON.stringify(sessionDB));
  if (sessionDB.length === 0) return;
  var cid = getCenterId();
  var rows = sessionDB.map(function(s){ return { id: s.id, center_id: cid, data: s }; });
  var batches = [];
  for (var i = 0; i < rows.length; i += 50) { batches.push(rows.slice(i, i + 50)); }
  batches.reduce(function(p, batch) {
    return p.then(function() { return supaFetch('madi_sessions?on_conflict=id', 'POST', batch); });
  }, Promise.resolve()).catch(function(e) { showToast('❌ 세션 저장 실패'); });
}
function saveSchedule() {
  markMyChange();
  localStorage.setItem('cn3_schedule', JSON.stringify(scheduleDB));
  if (scheduleDB.length === 0) return;
  var cid = getCenterId();
  var rows = scheduleDB.map(function(s){ return { id: s.id, center_id: cid, data: s }; });
  var batches = [];
  for (var i = 0; i < rows.length; i += 50) { batches.push(rows.slice(i, i + 50)); }
  batches.reduce(function(p, batch) {
    return p.then(function() { return supaFetch('madi_schedules?on_conflict=id', 'POST', batch); });
  }, Promise.resolve()).catch(function(e) { showToast('❌ 스케줄 저장 실패'); });
}
function saveAssess() {
  markMyChange();
  localStorage.setItem('cn3_assess', JSON.stringify(assessmentDB));
  if (assessmentDB.length === 0) return;
  var cid = getCenterId();
  var rows = assessmentDB.map(function(a){ return { id: a.id, center_id: cid, data: a }; });
  var batches = [];
  for (var i = 0; i < rows.length; i += 50) { batches.push(rows.slice(i, i + 50)); }
  batches.reduce(function(p, batch) {
    return p.then(function() { return supaFetch('madi_assessments?on_conflict=id', 'POST', batch); });
  }, Promise.resolve()).catch(function(e) { showToast('❌ 검사 저장 실패'); });
}

var childDB = [], sessionDB = [], scheduleDB = [], assessmentDB = [], activityDB = [], iepDB = [];

function loadDB() {
  try { childDB      = JSON.parse(localStorage.getItem('cn3_children')    || '[]'); } catch(e) { childDB = []; }
  try { sessionDB    = JSON.parse(localStorage.getItem('cn3_sessions')    || '[]'); } catch(e) { sessionDB = []; }
  try { scheduleDB   = JSON.parse(localStorage.getItem('cn3_schedule')    || '[]'); } catch(e) { scheduleDB = []; }
  try { assessmentDB = JSON.parse(localStorage.getItem('cn3_assess')      || '[]'); } catch(e) { assessmentDB = []; }
  try { activityDB   = JSON.parse(localStorage.getItem('cn3_activities')  || '[]'); } catch(e) { activityDB = []; }
  try { iepDB        = JSON.parse(localStorage.getItem('cn3_iep')         || '[]'); } catch(e) { iepDB = []; }
}

function saveIEP() {
  localStorage.setItem('cn3_iep', JSON.stringify(iepDB));
  var cid = getCenterId();
  var rows = iepDB.map(function(r){ return { id: r.id, center_id: cid, data: r }; });
  if (rows.length === 0) return;
  supaFetch('madi_iep_history?on_conflict=id', 'POST', rows).catch(function(){});
}

function loadIEPFromSupa() {
  supaFetch('madi_iep_history?' + centerFilter() + '&select=id,data&order=id.desc', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      var parsed = rows.filter(function(r){ return r && r.data; })
                       .map(function(r){ var d=r.data; d.id=r.id; return d; });
      if (parsed.length > 0) {
        iepDB = parsed;
        localStorage.setItem('cn3_iep', JSON.stringify(iepDB));
        renderIEPHistory(parseInt(document.getElementById('iepChild').value) || 0);
      }
    })
    .catch(function(){});
}

function saveActivities() {
  localStorage.setItem('cn3_activities', JSON.stringify(activityDB));
  var cid = getCenterId();
  var rows = activityDB.map(function(a){ return Object.assign({}, a, { center_id: cid }); });
  supaFetch('madi_activities?on_conflict=id', 'POST', rows).catch(function(){});
}

function loadActivitiesFromSupa() {
  supaFetch('madi_activities?' + centerFilter() + '&order=id.asc', 'GET')
    .then(function(rows) {
      if (Array.isArray(rows) && rows.length > 0) {
        activityDB = rows;
        localStorage.setItem('cn3_activities', JSON.stringify(activityDB));
        renderActivityCatalog();
      }
    })
    .catch(function(){});
}

// ─────── 견고함 보강: 재시도 + 오프라인 감지 ───────
function fetchWithRetry(url, options, opts) {
  opts = opts || {};
  var maxRetries = opts.retries !== undefined ? opts.retries : 3;
  var baseDelay  = opts.delay   !== undefined ? opts.delay   : 1000;
  var label      = opts.label   || '요청';
  var onSlow     = opts.onSlow;

  if ((options.method || 'GET').toUpperCase() === 'POST' && !opts.allowPostRetry) {
    maxRetries = 0;
  }

  var attempt = 0;
  var slowTimer = setTimeout(function() {
    if (typeof onSlow === 'function') onSlow();
  }, 5000);

  function doFetch() {
    return fetch(url, options).then(function(res) {
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
        throw new Error('RETRY:' + res.status);
      }
      clearTimeout(slowTimer);
      return res;
    }).catch(function(err) {
      var isRetriable = err.message && err.message.startsWith('RETRY:');
      var isNetwork   = err.message && err.message.includes('Failed to fetch');

      if ((isRetriable || isNetwork) && attempt < maxRetries) {
        attempt++;
        var delay = baseDelay * Math.pow(2, attempt - 1);
        return new Promise(function(resolve) { setTimeout(resolve, delay); }).then(doFetch);
      }
      clearTimeout(slowTimer);
      throw err;
    });
  }

  return doFetch();
}

function callClaude(apiKey, system, user, maxTokens, model) {
  return fetchWithRetry(EDGE_URL + '/ai-proxy', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_REALTIME_KEY,
      'Authorization': 'Bearer ' + getToken()
    },
    body: JSON.stringify({
      model:      model || MODEL_SONNET,
      max_tokens: maxTokens || 1500,
      system:     system,
      messages:   [{ role: 'user', content: user }]
    })
  }, {
    retries: 3,
    allowPostRetry: true,
    label: 'Claude API',
    onSlow: function() { showToast('🐢 응답이 늦어지고 있습니다... 잠시만 기다려주세요'); }
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(e.error ? e.error.message : 'HTTP ' + res.status); });
    return res.json();
  })
  .then(function(data) {
    if (data.usage) {
      var usedModel = (data.model || model || MODEL_SONNET);
      recordApiUsage(usedModel, data.usage.input_tokens || 0, data.usage.output_tokens || 0);
    }
    return (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
  });
}

function parseJSON(raw) {
  var cleaned = raw.replace(/```json|```/g, '').trim();
  var s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s < 0 || e < 0) {
    s = cleaned.indexOf('['); e = cleaned.lastIndexOf(']');
  }
  if (s >= 0 && e >= s) {
    try { return JSON.parse(cleaned.slice(s, e + 1)); } catch(ignored) {}
  }
  try {
    var fragment = s >= 0 ? cleaned.slice(s) : cleaned;
    var depth = 0, inStr = false, escape = false, cutAt = fragment.length;
    for (var i = 0; i < fragment.length; i++) {
      var ch = fragment[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inStr) { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { cutAt = i + 1; break; } }
    }
    if (depth > 0) {
      var partial = fragment.slice(0, cutAt);
      var lastComma = partial.lastIndexOf(',');
      var closing = '';
      var checkDepth = 0;
      for (var k = 0; k < partial.length; k++) {
        var c = partial[k];
        if (c === '"') { var q = partial.indexOf('"', k+1); if (q > k) k = q; continue; }
        if (c === '{' || c === '[') checkDepth++;
        else if (c === '}' || c === ']') checkDepth--;
      }
      if (lastComma > 0 && checkDepth > 0) {
        partial = partial.slice(0, lastComma);
        for (var d = 0; d < checkDepth; d++) closing += (fragment[0] === '[' ? ']' : '}');
        try { return JSON.parse(partial + closing); } catch(e2) {}
      }
    }
  } catch(ignored2) {}
  throw new Error('JSON 응답 파싱 실패 — 응답이 너무 길거나 형식이 올바르지 않습니다.');
}
