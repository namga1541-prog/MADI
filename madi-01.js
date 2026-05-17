
// ─────── 상수 ───────
var MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
var MODEL_SONNET = 'claude-sonnet-4-6';

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
function getToken()   { return _madiToken || localStorage.getItem('madi_token') || ''; }
function setToken(t)  { _madiToken = t; localStorage.setItem('madi_token', t); }
function clearToken() { _madiToken = null; localStorage.removeItem('madi_token'); }

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (e) { console.error('localStorage 저장 실패:', key, e); if (e && e.name === 'QuotaExceededError') showToast('⚠️ 로컬 저장 공간 부족 — 데이터는 서버에 안전하게 저장됩니다'); return false; }
}

function supaFetch(path, method, body) {
  return fetchWithRetry(EDGE_URL + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
    body: JSON.stringify({ path: path, method: method || 'GET', body: body || null })
  }, { retries: 2, allowPostRetry: true, label: 'Supabase ' + (method || 'GET') + ' ' + path.split('?')[0] })
  .then(function(r) {
    if (!r.ok && r.status !== 200 && r.status !== 201) return r.text().then(function(t){ throw new Error(r.status + ': ' + t); });
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
  if (currentUser && currentUser.role === 'admin') return 'center_id=not.is.null';
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
      currentUser = { id: result.user.id, username: result.user.username, name: result.user.name, role: result.user.role, color: result.user.color, center_id: result.user.center_id, permissions: result.user.permissions };
      try { localStorage.setItem('madi_user', JSON.stringify(currentUser)); } catch(e) {}
      document.getElementById('signupScreen').style.display = 'none'; hideLoginScreen();
      if (typeof applyUserUI === 'function') applyUserUI();
      if (typeof applyRoleUI === 'function') applyRoleUI();
      if (typeof loadCenterApiKey === 'function') loadCenterApiKey();
      if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase();
      if (typeof initRealtime === 'function') initRealtime();
      var roleLabel = result.user.role === 'superadmin' ? '대장님 👑' : result.user.role === 'admin' ? '원장님 🏥' : '선생님 👩‍⚕️';
      showToast('🎉 환영합니다, ' + result.user.name + ' ' + roleLabel + '! (' + result.center.name + ')');
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
  var blockMsg = checkLoginBlocked(un); if (blockMsg) { if (errEl) errEl.textContent = blockMsg; return; }
  if (btn) { if (btn.dataset.busy === '1') return; btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '로그인 중...'; }
  fetchWithRetry(EDGE_URL + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: un, password: pw }) }, { retries: 1, label: '로그인' })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🔐 로그인'; }
    if (data.error) { recordLoginFail(un); if (errEl) errEl.textContent = data.error; return; }
    recordLoginSuccess(un); setToken(data.token); currentUser = data.user;
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
  var pwInput = document.getElementById('loginPwInput');
  if (pwInput) pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  var unInput = document.getElementById('loginUsernameInput');
  if (unInput) unInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') { var pw = document.getElementById('loginPwInput'); if (pw) pw.focus(); } });
});

function applyUserUI() {
  if (!currentUser) return;
  var headerUser = document.getElementById('headerUser'), headerUserName = document.getElementById('headerUserName'), headerUserBadge = document.getElementById('headerUserBadge');
  if (!headerUser || !headerUserName || !headerUserBadge) return;
  headerUserName.textContent = currentUser.name;
  if (currentUser.role === 'parent') {
    headerUserBadge.textContent = '학부모'; headerUserBadge.style.background = 'rgba(245,158,11,0.25)'; headerUserBadge.style.borderColor = 'rgba(245,158,11,0.5)';
    applyParentUI();
  } else {
    headerUserBadge.textContent = currentUser.role === 'superadmin' ? '대장님 👑' : currentUser.role === 'admin' ? '원장님 🏥' : '선생님 👩‍⚕️';
    if (typeof resetParentUI === 'function') resetParentUI();
  }
  headerUser.style.display = 'flex';
  if (typeof updateSidebarAdminVisibility === 'function') updateSidebarAdminVisibility();
}

function showLogoutMenu() {
  if (confirm(currentUser.name + '님, 로그아웃 하시겠습니까?')) {
    stopRealtime(); currentUser = null; clearToken(); localStorage.removeItem('madi_user');
    childDB=[]; sessionDB=[]; scheduleDB=[]; assessmentDB=[];
    renderChildGrid(); document.getElementById('headerUser').style.display = 'none'; showLoginScreen();
  }
}

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
    if (supaCh.length > 0 && localCh.length > 0 && supaCh.length < localCh.length * 0.7) {
      console.warn('[loadDB] 부분동기화 차단'); showToast('⚠️ 서버 데이터 불일치 감지 — 로컬 데이터 유지');
      childDB = localCh;
      try { sessionDB = JSON.parse(localStorage.getItem('cn3_sessions') || '[]'); } catch(e){ sessionDB=[]; }
      try { scheduleDB = JSON.parse(localStorage.getItem('cn3_schedule') || '[]'); } catch(e){ scheduleDB=[]; }
      try { assessmentDB = JSON.parse(localStorage.getItem('cn3_assess') || '[]'); } catch(e){ assessmentDB=[]; }
    } else if (supaCh.length === 0 && localCh.length > 0) {
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
  var cid = getCenterId(), rows = assessmentDB.map(function(a){ return { id: a.id, center_id: cid, data: a }; }), batches = [];
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
      if (parsed.length > 0) { iepDB = parsed; safeSetItem('cn3_iep', JSON.stringify(iepDB)); renderIEPHistory(parseInt(document.getElementById('iepChild').value) || 0); }
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
  var now = new Date(); timeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  var today = now.toISOString().slice(0,10), nowMin = now.getHours()*60+now.getMinutes();
  var upcoming = (typeof scheduleDB !== 'undefined' ? scheduleDB : [])
    .filter(function(s){ if (s.date !== today || !s.startTime) return false; var p = s.startTime.split(':'); return parseInt(p[0])*60+parseInt(p[1]) >= nowMin; })
    .sort(function(a,b){ return a.startTime.localeCompare(b.startTime); });
  if (upcoming.length > 0) {
    var next = upcoming[0], child = (typeof childDB !== 'undefined' ? childDB : []).find(function(c){ return c.id === next.childId; });
    var name = child ? child.name : '?', p = next.startTime.split(':'), diff = (parseInt(p[0])*60+parseInt(p[1]))-nowMin;
    nextEl.textContent = diff === 0 ? '🔔 '+name+' 지금' : diff < 60 ? '⏱️ '+name+' '+diff+'분 후' : '📅 '+name+' '+next.startTime;
  } else { var count = (typeof childDB !== 'undefined' ? childDB.length : 0); nextEl.textContent = count > 0 ? '아동 '+count+'명' : '오늘 일정 없음'; }
}
var _clockTimer = null;
function startHeaderClock() { updateHeaderClock(); if (_clockTimer) clearInterval(_clockTimer); _clockTimer = setInterval(updateHeaderClock, 60000); document.addEventListener('visibilitychange', function() { if (!document.hidden) updateHeaderClock(); }); }

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
      if ((isRetriable || isNetwork) && attempt < maxRetries) { attempt++; var delay = baseDelay * Math.pow(2, attempt-1); console.log('['+label+'] 재시도 '+attempt+'/'+maxRetries+' ('+delay+'ms 후)'); return new Promise(function(resolve){ setTimeout(resolve,delay); }).then(doFetch); }
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

// ★ 학부모 전용 UI 적용 (좌측 사이드바 버전)
function applyParentUI() {
  var staffTabs = document.querySelector('.tabs:not(#parentTabs)'); if (staffTabs) staffTabs.style.display = 'none';
  var parentTabs = document.getElementById('parentTabs'); if (parentTabs) parentTabs.style.cssText = 'display: none !important;';
  var sidebar = document.getElementById('appSidebar'); if (sidebar) sidebar.style.display = 'none';
  var sidebarToggle = document.getElementById('sidebarToggleBtn'); if (sidebarToggle) sidebarToggle.style.display = 'none';
  var breadcrumb = document.querySelector('.breadcrumb-bar'); if (breadcrumb) breadcrumb.style.display = 'none';
  var deployBtn = document.getElementById('headerDeployBtn'); if (deployBtn) deployBtn.style.display = 'none';
  document.querySelectorAll('.tab-panel, .sub-panel').forEach(function(el) { if (!el.id.startsWith('parentPanel')) el.style.display = 'none'; });
  _initParentSidebar();
  switchParentTab('home');
}

// ★ 학부모 좌측 사이드바 — .app-layout flex child로 삽입 (헤더 아래 자동 위치)
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
  // ★ body 대신 .app-layout 안에 삽입 → 헤더/배너 아래 flex로 자동 위치
  var _appLayout = document.querySelector('.app-layout');
  if (_appLayout) {
    _appLayout.insertBefore(sb, _appLayout.firstChild);
    sb.setAttribute('style',
      'width:68px;display:flex;flex-direction:column;align-items:center;' +
      'padding:12px 0;gap:2px;background:white;border-right:1px solid #e2e8f0;' +
      'flex-shrink:0;z-index:100;box-shadow:2px 0 8px rgba(0,0,0,0.06);overflow-y:auto;'
    );
  } else {
    // fallback: position:fixed + 헤더 높이 동적 계산
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

// ★ 학부모 UI 원복 — 다른 역할로 재로그인 시 호출
function resetParentUI() {
  var psb = document.getElementById('parentSidebar'); if (psb) psb.style.display = 'none';
  var staffTabs = document.querySelector('.tabs:not(#parentTabs)'); if (staffTabs) staffTabs.style.display = '';
  var sidebar = document.getElementById('appSidebar'); if (sidebar) sidebar.style.display = '';
  var sidebarToggle = document.getElementById('sidebarToggleBtn'); if (sidebarToggle) sidebarToggle.style.display = '';
  var breadcrumb = document.querySelector('.breadcrumb-bar'); if (breadcrumb) breadcrumb.style.display = '';
  document.querySelectorAll('.tab-panel, .sub-panel').forEach(function(el) { if (!el.id.startsWith('parentPanel')) el.style.display = ''; });
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
  if (!pw || pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (!/[a-zA-Z]/.test(pw)) return '비밀번호에 영문을 포함해주세요.';
  if (!/[0-9]/.test(pw))    return '비밀번호에 숫자를 포함해주세요.';
  return null;
}
function _getLoginBlockData(username) { try { var raw = localStorage.getItem('login_block_' + username); return raw ? JSON.parse(raw) : { attempts: 0, blockedUntil: 0 }; } catch(e) { return { attempts: 0, blockedUntil: 0 }; } }
function checkLoginBlocked(username) {
  if (!username) return null; var data = _getLoginBlockData(username);
  if (data.blockedUntil && data.blockedUntil > Date.now()) return '로그인 시도가 너무 많습니다. ' + Math.ceil((data.blockedUntil - Date.now()) / 60000) + '분 후 다시 시도해주세요.';
  return null;
}
function recordLoginFail(username) { if (!username) return; try { var data = _getLoginBlockData(username); data.attempts = (data.attempts||0)+1; if (data.attempts >= 5) data.blockedUntil = Date.now()+30*60*1000; localStorage.setItem('login_block_'+username, JSON.stringify(data)); } catch(e) {} }
function recordLoginSuccess(username) { if (!username) return; try { localStorage.removeItem('login_block_'+username); } catch(e) {} }
function generateClientId() {
  var rnd;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) { var arr = new Uint32Array(1); crypto.getRandomValues(arr); rnd = arr[0] % 10000; } else { rnd = Math.floor(Math.random() * 10000); }
  return Date.now() + rnd;
}
