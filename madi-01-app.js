/* ───────────────────────────────────────────────────────────
   madi-01-app.js — 데이터 로드 / 앱 UI / 네트워크
   - loadDBFromSupabase 및 save / load 도메인 함수
   - showConfirm / debounce / showToast / vibrate
   - 다크모드 / 헤더 시계 / 네트워크 모니터
   - 학부모 UI / 권한 적용 / 더보기 메뉴

   분리 사유: madi-01.js 가 1,062 라인으로 비대.
   ─────────────────────────────────────────────────────────── */

// ─────── Supabase DB 로드 / 저장 ───────
// 최적화 (2026-05-21): 최근 90일 우선 로드 → 백그라운드에서 과거 데이터 머지
// 운영 1년차 이후 첫 화면 fetch 1~3초 단축, 메모리·jsonb 페이로드 절감
function _isoDaysAgo(n) {
  var d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function loadDBFromSupabase(silent) {
  if (!silent) showToast('📡 데이터 불러오는 중...');
  _optionsCacheKey = null;
  // 세션: 최근 90일, 일정: 최근 30일~미래 전체 (캘린더는 미래 일정 필요)
  var d90 = _isoDaysAgo(90);
  var d30 = _isoDaysAgo(30);
  Promise.all([
    supaFetch('madi_children?'    + centerFilter() + '&select=id,data&order=id.asc'),
    supaFetch('madi_sessions?'    + centerFilter() + '&data->>date=gte.' + d90 + '&select=id,data&order=id.asc'),
    supaFetch('madi_schedules?'   + centerFilter() + '&data->>date=gte.' + d30 + '&select=id,data&order=id.asc'),
    supaFetch('madi_assessments?' + centerFilter() + '&select=id,data&order=id.asc')
  ]).then(function(results) {
    function safeMap(arr) { if (!Array.isArray(arr)) return []; return arr.filter(function(r){ return r && r.data; }).map(function(r){ var d=r.data; d.id=r.id; return d; }); }
    var supaCh = safeMap(results[0]), supaSe = safeMap(results[1]), supaSch = safeMap(results[2]), supaAs = safeMap(results[3]);
    childDB = supaCh; sessionDB = supaSe; scheduleDB = supaSch; assessmentDB = supaAs;
    window._dataLoadedAt = Date.now();
    if (!silent) showToast('✅ 데이터 로드 완료 (아동 ' + childDB.length + '명)');
    renderChildGrid(); populateChildSelects(); renderGoalRows(); renderSessionList(); renderUnwrittenAlert(); renderStaffCard();
    if (typeof renderSchedView === 'function') renderSchedView();
    if (typeof renderDashboard === 'function') renderDashboard();
    loadActivitiesFromSupa(); loadIEPFromSupa();
    setTimeout(function() { if (typeof loadNotices === 'function') loadNotices(); }, 600);
    // 백그라운드: 과거 데이터 추가 로드 후 머지 (사용자 인지 없이)
    setTimeout(function() { _loadOlderHistory(d90, d30); }, 1500);
  }).catch(function(e) {
    console.error('loadDB 실패:', e); showToast('❌ 데이터 로드 실패 — 로컬 데이터로 표시합니다');
    loadDB(); renderChildGrid(); populateChildSelects();
  });
}

// 90일 이전 세션 + 30일 이전 일정 백그라운드 로드 → 머지
// 성장 기록·포트폴리오·연간 통계 등 과거 데이터 필요 영역을 위함
function _loadOlderHistory(d90, d30) {
  if (window._olderHistoryLoaded) return;
  window._olderHistoryLoaded = true;
  Promise.all([
    supaFetch('madi_sessions?'  + centerFilter() + '&data->>date=lt.' + d90 + '&select=id,data&order=id.desc'),
    supaFetch('madi_schedules?' + centerFilter() + '&data->>date=lt.' + d30 + '&select=id,data&order=id.desc')
  ]).then(function(results) {
    function safeMap(arr) { if (!Array.isArray(arr)) return []; return arr.filter(function(r){ return r && r.data; }).map(function(r){ var d=r.data; d.id=r.id; return d; }); }
    var oldSe  = safeMap(results[0]);
    var oldSch = safeMap(results[1]);
    var seenSe = {}; sessionDB.forEach(function(s){ seenSe[s.id] = true; });
    oldSe.forEach(function(s){ if (!seenSe[s.id]) sessionDB.push(s); });
    var seenSch = {}; scheduleDB.forEach(function(s){ seenSch[s.id] = true; });
    oldSch.forEach(function(s){ if (!seenSch[s.id]) scheduleDB.push(s); });
    // idle 머지 후 영향 가능 영역만 부분 리렌더
    if (typeof renderSessionList === 'function') try { renderSessionList(); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    if (typeof renderSchedView   === 'function') try { renderSchedView();   } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  }).catch(function(e) {
    if (window.console && console.warn) console.warn('[older history] silent:', e && e.message);
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
  // cn3_* localStorage 캐시 비활성 — PII 평문 저장 금지. 인메모리로 시작, loadDBFromSupabase 가 채움.
  childDB = []; sessionDB = []; scheduleDB = []; assessmentDB = []; activityDB = []; iepDB = [];
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

function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern || 30); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ } }
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
    '<span class="psb-icon">📁</span><span class="psb-label">포트폴리오</span></button>' +
    '<button id="ptBtnNotice" class="psb-btn" onclick="switchParentTab(\'notice\')">' +
    '<span class="psb-icon">📢</span><span class="psb-label">공지</span></button>';
  var _appLayout = document.querySelector('.app-layout');
  if (_appLayout) {
    _appLayout.insertBefore(sb, _appLayout.firstChild);
    sb.setAttribute('style',
      'width:68px;display:flex;flex-direction:column;align-items:center;' +
      'padding:12px 0;gap:2px;background:white;border-right:1px solid #e2e8f0;' +
      'flex-shrink:0;z-index:100;box-shadow:2px 0 8px rgba(0,0,0,0.06);align-self:flex-start;'
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
  // ⚡ 빠른 기록 버튼: 선생님 역할에만 노출 (admin/superadmin/parent 숨김)
  var qb = document.getElementById('headerQuickBtn');
  if (qb) qb.style.display = (currentUser.role === 'teacher') ? 'inline-flex' : 'none';
}

/* ─── 모바일 키보드 대응 (iOS / Android) ──────────────────────────────
   visualViewport.resize 로 가상 키보드 높이를 감지해
   body 의 --kb-offset 변수에 반영. CSS 측에서 모달 등이 padding-bottom 으로
   참조해 입력란이 키보드 뒤로 숨지 않도록 한다. */
(function setupKeyboardOffset() {
  if (!window.visualViewport) return;
  var vv = window.visualViewport;
  var lastOffset = 0;
  function updateKbOffset() {
    // 키보드가 올라오면 layout viewport - visual viewport 만큼 가려짐
    var kb = Math.max(0, (window.innerHeight - vv.height) - vv.offsetTop);
    // 50px 미만은 노이즈로 간주 (브라우저 주소창 토글 등)
    if (kb < 50) kb = 0;
    if (Math.abs(kb - lastOffset) < 8) return;
    lastOffset = kb;
    document.body.style.setProperty('--kb-offset', kb + 'px');
    // 키보드 표시 중에는 포커스된 인풋을 화면 안으로 스크롤
    if (kb > 0 && document.activeElement && document.activeElement.scrollIntoView) {
      try {
        var rect = document.activeElement.getBoundingClientRect();
        if (rect.bottom > vv.height - 40) {
          document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      } catch (e) {}
    }
  }
  vv.addEventListener('resize', updateKbOffset);
  vv.addEventListener('scroll', updateKbOffset);
})();
