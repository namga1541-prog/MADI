// ─────── 상수 ───────
var MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
var MODEL_SONNET = 'claude-sonnet-4-6';

// 역할 상수 — DB 컬럼 madi_users.role 값. 신규 코드는 이 상수만 사용.
// (점진 치환 정책: 기존 'admin'/'teacher'/'parent'/'superadmin' 리터럴은 다음 PR 부터 교체)
var ROLES = {
  ADMIN:      'admin',
  SUPERADMIN: 'superadmin',
  TEACHER:    'teacher',
  PARENT:     'parent'
};
// 역할 묶음 — `[ROLES.ADMIN, ROLES.SUPERADMIN].indexOf(role) !== -1` 대체 헬퍼
function isAdminRole(role) { return role === ROLES.ADMIN || role === ROLES.SUPERADMIN; }
function isStaffRole(role) { return role === ROLES.ADMIN || role === ROLES.SUPERADMIN || role === ROLES.TEACHER; }

/* ── XSS 방어: HTML escape 유틸 (공통 모듈) ──
   madi-core.js 는 모든 페이지의 첫 madi-* 모듈이므로 여기 두면
   madi-02 ~ madi-16 어떤 파일에서도 안전하게 사용 가능.
   ' 까지 escape — inline onclick='...' 안에 사용자 문자열 들어가도 안전.
   admin.html 은 별도 페이지(madi-*.js 미로딩)라 인라인 사본 유지. */
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ── KST(UTC+9) 날짜 유틸: 실행 환경 타임존과 무관하게 동작 ── */
function toKST(d)      { return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000); }
function nowKST()      { return toKST(new Date()); }
function ymd(d)        { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function getTodayKST() { return ymd(nowKST()); }
function getMonthKST() { return getTodayKST().slice(0, 7); }
/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' (한국 표기) */
function fmtDateKR(s) { if (!s) return ''; var p = s.split('-'); if (!p || p.length < 3) return s; return p[0] + '년 ' + parseInt(p[1]) + '월 ' + parseInt(p[2]) + '일'; }

var DEFAULT_PERMS = { viewOtherChildren:true, deleteSession:true, useAI:true };
function canDo(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin' || currentUser.role === 'superadmin') return true;
  var p = currentUser.permissions || {};
  return p[perm] !== false;
}
function isMyChild(childId) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin' || currentUser.role === 'superadmin') return true;
  var myName = currentUser.name;
  var hasSession = (typeof sessionDB !== 'undefined') && sessionDB.some(function(s){ return s.childId === childId && s.teacher === myName; });
  if (hasSession) return true;
  return (typeof scheduleDB !== 'undefined') && scheduleDB.some(function(s){ return s.childId === childId && s.teacher === myName; });
}
function applyPermissions() {
  if (!currentUser) return;
  var isAdminOrSuper = getRoleFlags().isAdminOrSuper;
  var settingsBtn = document.getElementById('sbTab5');
  if (settingsBtn) settingsBtn.style.display = isAdminOrSuper ? '' : 'none';
  var svcBtn = document.getElementById('sbTab4');
  if (svcBtn) svcBtn.style.display = isAdminOrSuper ? '' : 'none';
  if (isAdminOrSuper) return;
  if (!canDo('useAI')) { var aiSubBtn = document.getElementById('ptBtn_ai'); if (aiSubBtn) aiSubBtn.style.display = 'none'; }
}
function getAIModel() {
  try { var v = localStorage.getItem('madi_ai_model'); if (v === 'sonnet') return MODEL_SONNET; if (v === 'haiku') return MODEL_HAIKU; } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  return MODEL_HAIKU;
}
function saveAIModelChoice(choice) {
  if (choice !== 'haiku' && choice !== 'sonnet') return;
  try { localStorage.setItem('madi_ai_model', choice); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  updateAIModelUI();
  var label = choice === 'sonnet' ? '🎯 Sonnet 4.6 (임상 추론·정밀)' : '⚡ Haiku 4.5 (빠름·저렴)';
  if (typeof showToast === 'function') showToast('✅ AI 모델이 ' + label + ' 으로 설정됐습니다');
}
function updateAIModelUI() {
  var current = 'haiku';
  try { var v = localStorage.getItem('madi_ai_model'); if (v === 'sonnet') current = 'sonnet'; } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
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
// iOS Safari 는 Cross-Site httpOnly 쿠키를 ITP 로 차단하므로 sessionStorage 폴백 사용:
//   로그인 시 → sessionStorage('madi_sess') 저장
//   페이지 로드 시 → sessionStorage 에서 복원 (탭/브라우저 앱 종료 시 자동 소멸)
//   API 호출 시 → Authorization: Bearer 헤더로 함께 전송
function getToken()   { return _madiToken || ''; }
function setToken(t)  { _madiToken = t; }
function clearToken() { _madiToken = null; try { sessionStorage.removeItem('madi_sess'); } catch (_e) {} }

// iOS Safari 쿠키 차단 대응: sessionStorage 토큰 복원
try { var _ssRestore = sessionStorage.getItem('madi_sess'); if (_ssRestore) _madiToken = _ssRestore; } catch (_e) {}

function safeSetItem(key, value) {
  // 보안 보강 — cn3_* (아동·세션·일정·평가·IEP·활동) PII 캐시는 localStorage 에 저장하지 않음.
  // 모든 데이터는 Supabase + 인메모리로만 운용. DevTools / 공유 기기에서 PII 평문 노출 방지.
  if (typeof key === 'string' && key.indexOf('cn3_') === 0) return true;
  try { localStorage.setItem(key, value); return true; }
  catch (e) { if (e && e.name === 'QuotaExceededError') showToast('⚠️ 로컬 저장 공간 부족 — 데이터는 서버에 안전하게 저장됩니다'); return false; }
}

// 옛 cn3_* 잔존 캐시를 일소 — 로그인 직후 호출
function _purgeLegacyCnCache() {
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf('cn3_') === 0) localStorage.removeItem(k);
    }
  } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
}

// ─── 방어 유틸 함수 (Direction A — 반복 크래시 패턴 원천 차단) ───
// localStorage 안전 읽기 — private mode / 차단 환경에서 SecurityError 방지
function safeGetItem(key, fallback) {
  try { return localStorage.getItem(key); }
  catch (e) { return fallback !== undefined ? fallback : null; }
}
// sessionStorage 안전 읽기
function safeGetSessionItem(key, fallback) {
  try { return sessionStorage.getItem(key); }
  catch (e) { return fallback !== undefined ? fallback : null; }
}
// sessionStorage 안전 쓰기
function safeSetSessionItem(key, value) {
  try { sessionStorage.setItem(key, value); return true; }
  catch (e) { return false; }
}
// JSON 안전 파싱 — try-catch 없이 JSON.parse 직접 사용 금지
function safeJsonParse(str, fallback) {
  if (str === null || str === undefined) return fallback !== undefined ? fallback : null;
  try { return JSON.parse(str); }
  catch (e) { return fallback !== undefined ? fallback : null; }
}
// null/undefined 필드 안전 정렬 비교 — localeCompare TypeError 방지
// 사용법: arr.sort(function(a,b){ return safeCmp(a.name, b.name); })
//         arr.sort(function(a,b){ return safeCmp(a.date, b.date, 'desc'); })
function safeCmp(a, b, dir) {
  var av = (a === null || a === undefined) ? '' : String(a);
  var bv = (b === null || b === undefined) ? '' : String(b);
  var cmp = av.localeCompare(bv, 'ko');
  return dir === 'desc' ? -cmp : cmp;
}
// ─────────────────────────────────────────────────────────────────

// ─── supaFetch GET 캐시 (2026-05-21 최적화) ───
// 5분 TTL 메모리 캐시 + 쓰기 발생 시 해당 테이블 자동 무효화
// 효과: 탭 이동·재방문 시 중복 페치 제거 (notices/lounge/portfolio 등)
var _supaCache = {};
var SUPA_CACHE_TTL = 5 * 60 * 1000;
function _supaCacheClone(v) {
  // jsonb 데이터는 caller가 변형하므로 (예: var d=r.data; d.id=r.id;) 매 반환 시 복사
  return v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v));
}
function _supaCacheGet(path) {
  var c = _supaCache[path];
  if (!c) return null;
  if (Date.now() - c.ts > SUPA_CACHE_TTL) { delete _supaCache[path]; return null; }
  return _supaCacheClone(c.data);
}
function _supaCacheSet(path, data) {
  _supaCache[path] = { data: _supaCacheClone(data), ts: Date.now() };
}
function supaCacheInvalidate(pathOrTable) {
  var table = String(pathOrTable || '').split('?')[0];
  if (!table) { _supaCache = {}; return; }
  Object.keys(_supaCache).forEach(function(k) {
    if (k.split('?')[0] === table) delete _supaCache[k];
  });
}
function supaCacheClearAll() { _supaCache = {}; }

// ─── 오프라인 쓰기 큐 ───────────────────────────────────────────────
var _offlineQueue = [];
var _offlineQueueBusy = false;
(function(){
  try { var s = localStorage.getItem('_madiOQ'); if (s) _offlineQueue = JSON.parse(s); } catch(e){}
})();
function _oqSave(){ try { localStorage.setItem('_madiOQ', JSON.stringify(_offlineQueue)); } catch(e){} }
function _oqEnqueue(path, method, body){
  _offlineQueue.push({path: path, method: method, body: body});
  _oqSave();
  if (typeof showToast === 'function') showToast('📶 오프라인 상태 — 연결 시 자동 저장됩니다.');
}
function _oqFlush(){
  if (_offlineQueueBusy || !_offlineQueue.length) return;
  _offlineQueueBusy = true;
  var item = _offlineQueue[0];
  supaFetch(item.path, item.method, item.body)
    .then(function(){
      _offlineQueue.shift(); _oqSave(); _offlineQueueBusy = false;
      if (_offlineQueue.length) setTimeout(_oqFlush, 500);
      else if (typeof showToast === 'function') showToast('✅ 오프라인 기록이 저장되었습니다.');
    }).catch(function(){ _offlineQueueBusy = false; });
}
window.addEventListener('online', function(){ setTimeout(_oqFlush, 1000); });
// ─────────────────────────────────────────────────────────────────────

function supaFetch(path, method, body, opts) {
  var m = method || 'GET';
  opts = opts || {};
  // 오프라인 상태에서 쓰기 요청은 큐에 적재 후 즉시 반환
  if (!navigator.onLine && (m === 'POST' || m === 'PATCH' || m === 'DELETE')) {
    _oqEnqueue(path, m, body);
    return Promise.resolve({_queued: true});
  }
  // GET 캐시 hit 시 즉시 반환 (네트워크 우회)
  if (m === 'GET' && !opts.noCache) {
    var cached = _supaCacheGet(path);
    if (cached !== null) return Promise.resolve(cached);
  }
  // iOS Safari ITP 대응: 쿠키가 차단된 경우 Bearer 헤더로 인증 폴백
  var _sfHdrs = { 'Content-Type': 'application/json' };
  var _sfTok = getToken();
  if (_sfTok) _sfHdrs['Authorization'] = 'Bearer ' + _sfTok;
  return fetchWithRetry(EDGE_URL + '/api', {
    method: 'POST',
    credentials: 'include',
    headers: _sfHdrs,
    body: JSON.stringify({ path: path, method: m, body: body || null })
  }, {
    retries: 2,
    allowPostRetry: true,
    label: 'Supabase ' + m + ' ' + path.split('?')[0]
  }).then(function(r) {
    if (r.status === 401 && typeof currentUser !== 'undefined' && currentUser) {
      clearToken(); currentUser = null;
      try { localStorage.removeItem('madi_user'); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
      if (typeof showToast === 'function') showToast('⚠️ 세션이 만료되었습니다. 다시 로그인해주세요.', { duration: 3000 });
      setTimeout(function() { if (typeof showLoginScreen === 'function') showLoginScreen(); }, 1500);
      throw new Error('401: 세션 만료');
    }
    if (!r.ok && r.status !== 200 && r.status !== 201) {
      return r.text().then(function(t){ throw new Error(r.status + ': ' + t); });
    }
    var ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  }).then(function(data) {
    // GET 결과 캐시 / 쓰기 시 해당 테이블 무효화
    if (m === 'GET' && !opts.noCache) _supaCacheSet(path, data);
    else if (m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') supaCacheInvalidate(path);
    return data;
  });
}

var currentUser = null;
function hashPassword(pw) {
  var enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(pw))
    .then(function(buf) { return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join(''); });
}
function getCenterId() { return (currentUser && currentUser.center_id) ? currentUser.center_id : ''; }

// 외부 라이브러리 lazy loader (최적화 2026-05-21)
// 초기 페이로드에서 제외, 첫 사용 시 1회만 동적 다운로드
function _loadScriptOnce(promiseHolderKey, src, integrity, label) {
  if (window[promiseHolderKey]) return window[promiseHolderKey];
  window[promiseHolderKey] = new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer'; }
    s.onload = function() { resolve(); };
    s.onerror = function() {
      window[promiseHolderKey] = null;
      reject(new Error(label + ' 로드 실패 — 인터넷 연결을 확인해주세요'));
    };
    document.head.appendChild(s);
  });
  return window[promiseHolderKey];
}

// XLSX(~900KB) — 일정/정산 내보내기, 평가지 import 시점에만 로드
function ensureXLSX() {
  if (typeof XLSX !== 'undefined') return Promise.resolve();
  return _loadScriptOnce('_xlsxLoadingPromise',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw',
    '엑셀 모듈');
}

// Chart.js(~200KB) — 첫 차트 렌더 시점에만 로드
// 사용처: madi-04 선생님 통계, madi-07 발달 차트·음소 차트
function ensureChart() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  return _loadScriptOnce('_chartLoadingPromise',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
    'sha384-DhxhYObIMeMNGyAG7iK11OHzBIKyEIeRL0ad1iFPAOwZB8iirUlTT0O/WJJUk8+o',
    '차트 모듈');
}

function centerFilter() {
  if (currentUser && currentUser.role === 'superadmin') return 'center_id=not.is.null';
  var cid = getCenterId();
  return cid ? 'center_id=eq.' + cid : 'center_id=eq.INVALID';
}

// ─────── 글로벌 에러 모니터링 ───────
// 운영 중 JS 오류를 madi_audit_log(action='client_error')에 기록
// → admin.html에서 조회 가능, 재현·진단 근거로 활용
var _errReportCount = 0;
var _ERR_REPORT_MAX  = 5; // 세션당 최대 5건 — DB 폭주 방지

function _reportClientError(msg, src, lineno, colno, err) {
  // 세션 한도 초과 / 로그인 전 / 서드파티 스크립트 에러는 무시
  if (_errReportCount >= _ERR_REPORT_MAX) return;
  if (!currentUser || !currentUser.id) return;
  if (src && src.indexOf(location.hostname) === -1) return;
  // 무해한 노이즈 제거
  var m = String(msg || '');
  if (m.indexOf('Script error') === 0) return;
  if (m.indexOf('ResizeObserver') !== -1) return;
  if (m.indexOf('Non-Error promise rejection') !== -1) return;

  _errReportCount++;
  var payload = {
    actor_id:     currentUser.id,
    actor_role:   currentUser.role || 'unknown',
    action:       'client_error',
    table_name:   (src || location.pathname).slice(0, 200),
    changed_cols: [JSON.stringify({
      message: m.slice(0, 500),
      stack:   (err && err.stack) ? String(err.stack).slice(0, 1000) : '',
      line:    lineno || 0,
      col:     colno  || 0,
      ua:      navigator.userAgent.slice(0, 200),
      url:     location.href.slice(0, 200)
    })]
  };
  // supaFetch 대신 직접 fetch — 에러 리포터 자체가 에러를 일으키는 순환 방지
  try {
    fetch(EDGE_URL + '/api', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ path: 'madi_audit_log', method: 'POST', body: payload })
    }).catch(function() { /* silent: 리포팅 실패는 조용히 무시 */ });
  } catch (e) { /* silent */ }
}

if (typeof window !== 'undefined' && !window._madiErrorBound) {
  window._madiErrorBound = true;
  window.onerror = function(msg, src, lineno, colno, err) {
    _reportClientError(msg, src, lineno, colno, err);
    return false; // 브라우저 기본 콘솔 에러 출력 유지
  };
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason || {};
    _reportClientError(
      reason.message || String(reason),
      location.href,
      0, 0,
      reason instanceof Error ? reason : null
    );
  });
}

// ── MADI 네임스페이스 (점진적 캡슐화용) ──────────────────
// 현재는 기존 전역 변수 구조를 유지하면서 향후 마이그레이션을 위한 네임스페이스만 생성
window.MADI = window.MADI || {};
// TODO: childDB, sessionDB 등 전역 변수를 window.MADI.db.* 로 순차 이전
