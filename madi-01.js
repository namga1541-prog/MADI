
// ─────── 상수 ───────
var MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
var MODEL_SONNET = 'claude-sonnet-4-6';

// ─────── 권한 관리 ───────
var DEFAULT_PERMS = { viewOtherChildren:true, deleteSession:true, useAI:true };
function canDo(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  var p = currentUser.permissions || {};
  return p[perm] !== false;
}

// 현재 사용자가 담당하는 아동인지 판별
// 기준: 내가 작성한 세션이 있거나, 내 이름으로 등록된 일정이 있는 아동
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
  // 설정/서비스 탭은 관리자·슈퍼관리자만
  var settingsBtn = document.getElementById('tabBtn5');
  if (settingsBtn) settingsBtn.style.display = isAdminOrSuper ? '' : 'none';
  var svcBtn = document.getElementById('tabBtn4');
  if (svcBtn) svcBtn.style.display = isAdminOrSuper ? '' : 'none';
  if (isAdminOrSuper) return;
  if (!canDo('useAI')) {
    var aiSubBtn = document.getElementById('ptBtn_ai');
    if (aiSubBtn) aiSubBtn.style.display = 'none';
  }
} // 기본값: 라이트(Haiku)
function getAIModel() { return MODEL_HAIKU; }
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
var CENTER_SESSION_INTERVAL = 40; // 기본값 40분

function loadCenterSessionInterval() {
  var cid = getCenterId();
  if (!cid) return;
  supaFetch('madi_centers?id=eq.' + encodeURIComponent(cid) + '&select=session_interval', 'GET')
    .then(function(rows) {
      if (rows && rows[0] && rows[0].session_interval) {
        CENTER_SESSION_INTERVAL = parseInt(rows[0].session_interval) || 40;
      }
    }).catch(function(){});
}
var EDGE_URL  = 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1';
var _madiToken = null; // JWT 토큰 (메모리 캐시)
// Realtime 전용 anon key (REST API는 Edge Function 사용 — 이 키로 DB 직접 접근 불가)
var SUPA_REALTIME_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeGRoYWZ6anlyZ2xhY2xhcndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODA3ODgsImV4cCI6MjA5Mjk1Njc4OH0.V0chvVlTG1M_pD_c2obJpNP41WuaYOtAHQt4Fg_nbig';

// JWT 토큰 관리
function getToken()       { return _madiToken || localStorage.getItem('madi_token') || ''; }
function setToken(t)      { _madiToken = t; localStorage.setItem('madi_token', t); }
function clearToken()     { _madiToken = null; localStorage.removeItem('madi_token'); }

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

// 현재 사용자의 center_id 반환 헬퍼
// SHA-256 해싱 (Web Crypto API — 브라우저 내장)
function hashPassword(pw) {
  var enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(pw))
    .then(function(buf) {
      return Array.from(new Uint8Array(buf))
        .map(function(b){ return b.toString(16).padStart(2, '0'); })
        .join('');
    });
}

// 현재 센터 ID 반환 — 로그인 안 됐으면 빈 문자열 (데이터 접근 차단)
function getCenterId() {
  return (currentUser && currentUser.center_id) ? currentUser.center_id : '';
}

// center_id 필터 쿼리 파라미터 반환
function centerFilter() {
  if (currentUser && currentUser.role === 'admin') return 'center_id=not.is.null'; // 관리자는 전체 센터 조회
  var cid = getCenterId();
  if (!cid) return 'center_id=eq.INVALID'; // 로그인 전 데이터 접근 차단
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

// selectUser / backToUserList — 계정 목록 방식 폐지로 제거됨

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
          // 만료 검증
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
      .catch(function() {
        label.textContent = '';
      });
  }, 500);
}

function showSignupScreen() {
  hideLanding();
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('signupScreen').style.display = 'flex';
  // 입력 초기화
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

  // 1) 빈 칸 검사
  if (!inviteCode) { errEl.textContent = '초대 코드를 입력해주세요.'; return; }
  if (!name)       { errEl.textContent = '이름을 입력해주세요.'; return; }
  if (!username)   { errEl.textContent = '아이디를 입력해주세요.'; return; }
  if (!pw)         { errEl.textContent = '비밀번호를 입력해주세요.'; return; }
  if (!pwConfirm)  { errEl.textContent = '비밀번호 확인을 입력해주세요.'; return; }

  // 2) 형식 검사
  if (username.length < 4) { errEl.textContent = '아이디는 4자 이상이어야 합니다.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = '아이디는 영문/숫자/언더바(_)만 사용 가능합니다.'; return; }
  if (pw.length < 4) { errEl.textContent = '비밀번호는 4자 이상이어야 합니다.'; return; }
  if (pw !== pwConfirm) { errEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }

  // 진행 중 표시 + 더블클릭 차단
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '확인 중...';

  // 3) 초대 코드 검증 (만료 포함)
  supaFetch('madi_centers?invite_code=eq.' + encodeURIComponent(inviteCode) + '&select=id,name,invite_expires_at', 'GET')
    .then(function(centers) {
      if (!Array.isArray(centers) || centers.length === 0) {
        throw new Error('유효하지 않은 초대 코드입니다.');
      }
      var center = centers[0];
      // 만료 검증
      if (center.invite_expires_at) {
        var exp = new Date(center.invite_expires_at);
        if (!isNaN(exp.getTime()) && exp - new Date() < 0) {
          throw new Error('만료된 초대 코드입니다. 관리자에게 새 코드를 요청해주세요.');
        }
      }
      // 4) 아이디 중복 검사
      return supaFetch('madi_users?username=eq.' + encodeURIComponent(username) + '&select=id', 'GET')
        .then(function(rows) {
          if (Array.isArray(rows) && rows.length > 0) {
            throw new Error('이미 사용 중인 아이디입니다.');
          }
          return center;
        });
    })
    .then(function(center) {
      // 5) 비밀번호 해싱 후 INSERT
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
      // 6) 자동 로그인 — currentUser 세팅 + 메인 화면 진입
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '✨ 가입하기';
      // 비밀번호 제외하고 currentUser에 저장
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
      // 가입 화면 + 로그인 화면 모두 숨김
      document.getElementById('signupScreen').style.display = 'none';
      hideLoginScreen();
      // 메인 화면 초기화 (doLogin과 동일 흐름)
      if (typeof applyUserUI === 'function') applyUserUI();
      if (typeof applyRoleUI === 'function') applyRoleUI();
      if (typeof loadCenterApiKey === 'function') loadCenterApiKey();
      if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase();
      if (typeof initRealtime === 'function') initRealtime();
      showToast('🎉 환영합니다, ' + result.user.name + ' 선생님! (' + result.center.name + ')');
    })
    .catch(function(err) {
      btn.dataset.busy = '';
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

  if (btn) {
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    btn.disabled = true;
    btn.textContent = '로그인 중...';
  }

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
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
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
    // 세션 시간 단위 로드
    loadCenterSessionInterval();
  }).catch(function() {
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (errEl) errEl.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  });
}

// 엔터키 로그인
// ─────── 마디 로고 SVG 단일 관리 함수 ───────
// 로고를 수정할 때 이 함수 하나만 고치면 4곳(헤더·랜딩·로그인·가입) 전체 반영됩니다.
function getMadiLogoSVG(w, h) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="' + w + '" height="' + h + '">' 
    + '<rect width="130" height="130" rx="28" fill="#e8f5f0"/>'
    + '<rect x="18" y="14" width="94" height="76" rx="18" fill="#2d6a4f"/>'
    + '<path d="M 26 90 L 16 112 L 52 90 Z" fill="#2d6a4f"/>'
    + '<rect x="61" y="38" width="8" height="38" rx="4" fill="white"/>'
    + '<path d="M 65 62 C 65 62 36 60 38 38 C 40 26 62 34 65 52 Z" fill="white"/>'
    + '<path d="M 65 54 C 65 54 92 52 91 32 C 90 20 68 28 65 44 Z" fill="white"/>'
    + '</svg>';
}

document.addEventListener('DOMContentLoaded', function() {
  // 사이드바 접힘 상태 복원
  restoreSidebarState();

  // SVG 로고 4곳 자동 주입
  var lpNav = document.querySelector('.lp-nav-logo-icon');
  if (lpNav) lpNav.innerHTML = getMadiLogoSVG(44, 44);
  document.querySelectorAll('.login-logo-icon').forEach(function(el) {
    el.innerHTML = getMadiLogoSVG(34, 34);
  });
  var logoIcon = document.querySelector('.logo-icon');
  if (logoIcon) logoIcon.innerHTML = getMadiLogoSVG(22, 22);

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
  _optionsCacheKey = null;  // 성능: 외부 데이터 로드 시 캐시 무효화
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

    // ── Supabase 비어있고 로컬에 데이터 있으면 자동 마이그레이션 ──
    var localCh = [];
    try { localCh = JSON.parse(localStorage.getItem('cn3_children') || '[]'); } catch(e){}

    // 부분동기화 감지: 서버 데이터가 로컬의 70% 미만이면 차단
    if (supaCh.length > 0 && localCh.length > 0 && supaCh.length < localCh.length * 0.7) {
      console.warn('[loadDB] 부분동기화 차단 — 서버:', supaCh.length, '/ 로컬:', localCh.length);
      showToast('⚠️ 서버 데이터 불일치 감지 — 로컬 데이터 유지');
      childDB      = localCh;
      try { sessionDB    = JSON.parse(localStorage.getItem('cn3_sessions') || '[]'); } catch(e){ sessionDB=[]; }
      try { scheduleDB   = JSON.parse(localStorage.getItem('cn3_schedule') || '[]'); } catch(e){ scheduleDB=[]; }
      try { assessmentDB = JSON.parse(localStorage.getItem('cn3_assess')   || '[]'); } catch(e){ assessmentDB=[]; }
    } else if (supaCh.length === 0 && localCh.length > 0) {
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
      if (silent) { /* 백그라운드 폴링 — 토스트 없음 */ }
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
    // 로그인 직후 공지 배너 자동 표시
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
// ─────── 저장 실패 메시지 헬퍼 ───────
function getSaveErrMsg(e, label) {
  var msg = e && e.message ? e.message : '';
  if (!navigator.onLine) return label + ' 저장 실패 — 인터넷 연결을 확인해주세요';
  if (msg.indexOf('403') !== -1 || msg.indexOf('401') !== -1) return label + ' 저장 권한 없음 — 관리자에게 문의해주세요';
  if (msg.indexOf('timeout') !== -1 || msg.indexOf('RETRY') !== -1) return label + ' 저장 실패 — 서버 응답 없음, 잠시 후 재시도해주세요';
  return label + ' 저장 실패 — 잠시 후 다시 시도해주세요';
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
  }, Promise.resolve()).catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, '세션')); });
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
  }, Promise.resolve()).catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, '일정')); });
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
  }, Promise.resolve()).catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, '검사')); });
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

// ─────── Toast ───────
var toastTimer       = null;
var toastForceTimer  = null; // 강제 숨김 타이머: 첫 표시 후 절대 리셋되지 않음
var toastLocked      = false; // lock 중 다른 toast 차단 (배포완료 등 중요 메시지 보호)
// ─────── 성능 최적화: debounce + 페이징 + 옵션 캐시 ───────
function debounce(fn, delay) {
  var timer = null;
  return function() {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

// 아동 그리드 페이징
var CHILD_PAGE_SIZE = 50;
var _childCurrentPage = 1;

// select 옵션 HTML 캐시
var _optionsCacheKey = null;
var _optionsCacheHtml = '';

function showToast(msg, opts) {
  opts = opts || {};
  // lock 중이면 새 toast 무시 (중요 메시지가 덮어써지는 것 방지)
  if (toastLocked && !opts.force) return;
  var el = document.getElementById('toast');
  if (opts.undo && typeof opts.undo === 'function') {
    el.innerHTML = '<span>' + msg + '</span> <span style="display:inline-block;margin-left:8px;padding:3px 10px;background:rgba(255,255,255,0.18);border-radius:14px;color:#5eead4;font-size:12px;cursor:pointer;pointer-events:auto;" id="toastUndoBtn">↩️ 실행취소</span>';
    el.style.pointerEvents = 'auto';
    setTimeout(function() {
      var b = document.getElementById('toastUndoBtn');
      if (b) b.onclick = function(e) {
        e.stopPropagation();
        opts.undo();
        el.classList.remove('show');
        toastLocked = false;
      };
    }, 0);
  } else {
    el.textContent = msg;
    el.style.pointerEvents = 'auto';
  }
  // 클릭하면 즉시 닫기
  el.onclick = function() {
    el.classList.remove('show');
    clearTimeout(toastTimer); clearTimeout(toastForceTimer);
    toastTimer = null; toastForceTimer = null; toastLocked = false;
  };

  // 토스트가 새로 표시되는 경우(이미 표시중이 아닐 때)만 강제 숨김 타이머 시작
  // 이 타이머는 새 showToast 호출이 와도 절대 리셋되지 않음 → 최대 5초 보장
  var wasShowing = el.classList.contains('show');
  el.classList.add('show');
  if (!wasShowing) {
    clearTimeout(toastForceTimer);
    var maxDuration = opts.lock ? (opts.duration || 8000) : 5000;
    toastForceTimer = setTimeout(function() {
      el.classList.remove('show');
      toastLocked = false;
      toastForceTimer = null;
    }, maxDuration);
  }

  // 짧은 자동 숨김 (덮어써질 수 있음, 일반 토스트의 자연스러운 표시 시간)
  clearTimeout(toastTimer);
  var duration = opts.duration || (opts.undo ? 5000 : 2500);
  if (opts.lock) toastLocked = true;
  toastTimer = setTimeout(function() { el.classList.remove('show'); toastLocked = false; }, duration);
}
// 탭 전환 후 돌아올 때 잔류 토스트 강제 숨김
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    clearTimeout(toastTimer); clearTimeout(toastForceTimer);
    toastTimer = null; toastForceTimer = null; toastLocked = false;
    var el = document.getElementById('toast');
    if (el) el.classList.remove('show');
  }
});

// ─────── UX: 진동 피드백 (모바일) ───────
function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern || 30);
  } catch(e) {}
}

// ─────── UX: 다크 모드 ───────
function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('madi_dark', isDark ? '1' : '0');
  // 메타 테마 컬러도 변경
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? '#020617' : '#0ea5a0');
  showToast(isDark ? '🌙 다크 모드' : '☀️ 라이트 모드');
}

function loadDarkMode() {
  var saved = localStorage.getItem('madi_dark');
  if (saved === '1') {
    document.body.classList.add('dark-mode');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#020617');
  }
}

// ─────── UX: 헤더 시계 + 다음 세션 카운트다운 ───────
function updateHeaderClock() {
  var timeEl = document.getElementById('clockTime');
  var nextEl = document.getElementById('clockNext');
  if (!timeEl || !nextEl) return;

  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = hh + ':' + mm;

  // 다음 세션 찾기 (오늘 일정 중 현재 시각 이후)
  var today = now.toISOString().slice(0, 10);
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var upcoming = (typeof scheduleDB !== 'undefined' ? scheduleDB : [])
    .filter(function(s) {
      if (s.date !== today || !s.startTime) return false;
      var parts = s.startTime.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]) >= nowMin;
    })
    .sort(function(a, b) { return a.startTime.localeCompare(b.startTime); });

  if (upcoming.length > 0) {
    var next = upcoming[0];
    var child = (typeof childDB !== 'undefined' ? childDB : []).find(function(c){ return c.id === next.childId; });
    var name = child ? child.name : '?';
    var p = next.startTime.split(':');
    var diff = (parseInt(p[0]) * 60 + parseInt(p[1])) - nowMin;
    var label;
    if (diff === 0) label = '🔔 ' + name + ' 지금';
    else if (diff < 60) label = '⏱️ ' + name + ' ' + diff + '분 후';
    else label = '📅 ' + name + ' ' + next.startTime;
    nextEl.textContent = label;
  } else {
    var count = (typeof childDB !== 'undefined' ? childDB.length : 0);
    nextEl.textContent = count > 0 ? '아동 ' + count + '명' : '오늘 일정 없음';
  }
}

// 1분마다 갱신 + 페이지 표시될 때마다 즉시 갱신
var _clockTimer = null;
function startHeaderClock() {
  updateHeaderClock();
  if (_clockTimer) clearInterval(_clockTimer);
  _clockTimer = setInterval(updateHeaderClock, 60000);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) updateHeaderClock();
  });
}

// ─────── 공통 AI 호출 ───────
// ─────── 견고함 보강: 재시도 + 오프라인 감지 ───────
function fetchWithRetry(url, options, opts) {
  opts = opts || {};
  var maxRetries = opts.retries !== undefined ? opts.retries : 3;
  var baseDelay  = opts.delay   !== undefined ? opts.delay   : 1000;
  var label      = opts.label   || '요청';
  var onSlow     = opts.onSlow;

  // POST는 멱등성 보장 안 됨 → 명시적 허용 시에만 재시도
  if ((options.method || 'GET').toUpperCase() === 'POST' && !opts.allowPostRetry) {
    maxRetries = 0;
  }

  var attempt = 0;
  var slowTimer = setTimeout(function() {
    if (typeof onSlow === 'function') onSlow();
  }, 5000);

  function doFetch() {
    return fetch(url, options).then(function(res) {
      // 5xx 또는 429는 재시도 대상
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
        console.log('[' + label + '] 재시도 ' + attempt + '/' + maxRetries + ' (' + delay + 'ms 후)');
        return new Promise(function(resolve) { setTimeout(resolve, delay); }).then(doFetch);
      }
      clearTimeout(slowTimer);
      throw err;
    });
  }

  return doFetch();
}

// ─────── 오프라인 감지 ───────
function setupNetworkMonitor() {
  function showOfflineBanner() {
    if (document.getElementById('offlineBanner')) return;
    var b = document.createElement('div');
    b.id = 'offlineBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:8px 14px;font-size:12px;font-weight:700;text-align:center;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    b.innerHTML = '🔌 인터넷 연결 끊김 — 변경사항은 연결 복구 시 자동 동기화됩니다';
    document.body.appendChild(b);
  }
  function hideOfflineBanner() {
    var b = document.getElementById('offlineBanner');
    if (b) {
      b.style.background = '#10b981';
      b.innerHTML = '✅ 인터넷 연결 복구';
      setTimeout(function() { b.remove(); }, 2500);
    }
  }
  window.addEventListener('online',  hideOfflineBanner);
  window.addEventListener('offline', showOfflineBanner);
  // 초기 상태 확인
  if (!navigator.onLine) showOfflineBanner();
}

// ─────── 글로벌 에러 핸들러 ───────