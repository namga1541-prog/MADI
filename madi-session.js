// ─────── 보안: API 키 마스킹 / 토글 ───────
function maskApiKey(key) {
  if (!key || key.length < 12) return key || '';
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}

function showMaskedApiKey() {
  var input = document.getElementById('apiKey');
  var masked = document.getElementById('apiKeyMasked');
  var eye = document.getElementById('apiKeyEye');
  if (!input || !masked || !eye) return;
  if (input.value && input.value.startsWith('sk-')) {
    input.style.display = 'none';
    eye.style.display = 'none';
    masked.style.display = 'block';
    masked.textContent = maskApiKey(input.value);
  }
}

function editApiKey() {
  var input = document.getElementById('apiKey');
  var masked = document.getElementById('apiKeyMasked');
  var eye = document.getElementById('apiKeyEye');
  if (!input || !masked || !eye) return;
  input.style.display = 'block';
  eye.style.display = 'block';
  masked.style.display = 'none';
  input.type = 'password';
  setTimeout(function() { input.focus(); }, 50);
}

function onApiKeyFocus() { /* 입력 모드 유지 */ }
function onApiKeyBlur() {
  // 빈 값이거나 형식이 맞으면 마스킹 모드로
  var input = document.getElementById('apiKey');
  if (input && input.value && input.value.startsWith('sk-')) {
    setTimeout(showMaskedApiKey, 200); // 클릭 이벤트 우선 처리
  }
}

function toggleApiKeyVisibility() {
  var input = document.getElementById('apiKey');
  var eye = document.getElementById('apiKeyEye');
  if (!input || !eye) return;
  if (input.type === 'password') {
    input.type = 'text';
    eye.textContent = '🙈';
  } else {
    input.type = 'password';
    eye.textContent = '👁️';
  }
}

// PII 마스킹 (로그용)
function maskPII(str) {
  if (!str) return str;
  return String(str)
    .replace(/(\d{3})-?(\d{3,4})-?(\d{4})/g, '$1-****-$3')  // 전화번호
    .replace(/(\d{4})-?(\d{2})-?(\d{2})/g, '$1-**-**');     // 생년월일
}

// ─────── 운영 모니터링: 에러 로깅 + 토큰 사용량 ───────
var ERROR_LOG_MAX = 100;
var apiUsage = { calls: 0, inputTokens: 0, outputTokens: 0, byModel: {} };

function loadApiUsage() {
  try {
    var saved = JSON.parse(localStorage.getItem('madi_api_usage') || '{}');
    if (saved.calls !== undefined) apiUsage = saved;
  } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
}

function saveApiUsage() {
  try { localStorage.setItem('madi_api_usage', JSON.stringify(apiUsage)); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
}

function recordApiUsage(model, inputTokens, outputTokens) {
  apiUsage.calls = (apiUsage.calls || 0) + 1;
  apiUsage.inputTokens  = (apiUsage.inputTokens  || 0) + (inputTokens  || 0);
  apiUsage.outputTokens = (apiUsage.outputTokens || 0) + (outputTokens || 0);
  if (!apiUsage.byModel[model]) apiUsage.byModel[model] = { calls: 0, inputTokens: 0, outputTokens: 0 };
  apiUsage.byModel[model].calls++;
  apiUsage.byModel[model].inputTokens  += (inputTokens  || 0);
  apiUsage.byModel[model].outputTokens += (outputTokens || 0);
  saveApiUsage();
}

function estimateCost() {
  // Anthropic 가격 (USD per 1M tokens) — 2026.05 기준, 변경 시 수정 필요
  // 최신 가격: https://www.anthropic.com/pricing
  var prices = {
    'claude-sonnet-4-6':           { input: 3.00,  output: 15.00 },
    'claude-haiku-4-5-20251001':   { input: 0.80,  output: 4.00  }
  };
  var totalUSD = 0;
  Object.keys(apiUsage.byModel || {}).forEach(function(m) {
    var p = prices[m] || prices['claude-sonnet-4-6'];
    var u = apiUsage.byModel[m];
    totalUSD += (u.inputTokens / 1000000) * p.input + (u.outputTokens / 1000000) * p.output;
  });
  return totalUSD;
}

function resetApiUsage() {
  showConfirm('API 사용량 통계를 초기화할까요?', function() {
    apiUsage = { calls: 0, inputTokens: 0, outputTokens: 0, byModel: {} };
    saveApiUsage();
    renderDebugInfo();
    showToast('🔄 API 사용량 초기화됨');
  }, { danger: false });
}

// 에러 로그에 토큰·비밀번호·API 키가 흘러들어가지 않도록 마스킹
function _sanitizeForErrorLog(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/sk-ant-[A-Za-z0-9_\-]{20,}/g, 'sk-ant-***')
    .replace(/eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}/g, 'JWT_***')
    .replace(/Bearer\s+[A-Za-z0-9_\-\.=+\/]{20,}/gi, 'Bearer ***')
    .replace(/(password|pwd|secret|token|api[_\-]?key)\s*[:=]\s*"?[^"\s,&]+/gi, '$1=***')
    .replace(/[?&](password|pwd|token|api[_\-]?key)=[^&\s]*/gi, '&$1=***');
}

// 에러 로그 저장
function pushErrorLog(entry) {
  // 1) 기존 sessionStorage 저장 (즉시 조회 가능, 변경 없음)
  try {
    var arr = JSON.parse(sessionStorage.getItem('madi_error_log') || '[]');
    arr.push(entry);
    if (arr.length > ERROR_LOG_MAX) arr = arr.slice(-ERROR_LOG_MAX);
    sessionStorage.setItem('madi_error_log', JSON.stringify(arr));
  } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }

  // 2) Supabase에도 비동기 저장 (영구 보관 + 슈퍼어드민 조회용)
  if (window._errorLogSending) return;   // 무한 루프 방지
  if (!window.currentUser) return;        // 로그인 전 에러는 서버 저장 안 함
  window._errorLogSending = true;
  try {
    var payload = {
      user_id:    String((window.currentUser && window.currentUser.id) || ''),
      username:   String((window.currentUser && window.currentUser.username) || ''),
      message:    _sanitizeForErrorLog(entry.message).slice(0, 1000),
      source:     _sanitizeForErrorLog(entry.source).slice(0, 200),
      user_agent: (navigator.userAgent || '').slice(0, 300),
      url:        location.pathname,
      ts:         entry.ts
    };
    // ES5 호환: .finally() 미지원 환경 대비 — .then/.catch 양쪽에서 플래그 해제
    supaFetch('madi_error_logs', 'POST', [payload])
      .then(function() { window._errorLogSending = false; },
            function() { window._errorLogSending = false; }); // 의도적 무음: 에러 로그 전송 자체의 실패에 warn 찍으면 무한 루프 위험
  } catch(e) {
    window._errorLogSending = false;
  }
}

function getErrorLog() {
  try { return JSON.parse(sessionStorage.getItem('madi_error_log') || '[]'); } catch(e) { return []; }
}

function clearErrorLog() {
  showConfirm('에러 로그를 모두 삭제할까요?', function() {
    sessionStorage.removeItem('madi_error_log');
    renderDebugInfo();
    showToast('🗑️ 에러 로그 삭제됨');
  });
}

// 디버그 정보 카드 렌더
function renderDebugInfo() {
  var el = document.getElementById('debugInfoBody');
  if (!el) return;

  var logs = getErrorLog();
  var totalTokens = (apiUsage.inputTokens || 0) + (apiUsage.outputTokens || 0);
  var costUSD = estimateCost();
  var costKRW = Math.round(costUSD * 1380); // 환율 1380원/달러 (2026.05 기준)

  var statCard = function(val, label, color) {
    return '<div style="flex:1;min-width:80px;background:#f8fafc;border-radius:10px;padding:10px;text-align:center;">'
      + '<div style="font-size:18px;font-weight:900;color:' + color + ';">' + val + '</div>'
      + '<div style="font-size:10px;font-weight:700;color:var(--text2);margin-top:2px;">' + label + '</div>'
      + '</div>';
  };

  var modelHtml = '';
  Object.keys(apiUsage.byModel || {}).forEach(function(m) {
    var u = apiUsage.byModel[m];
    var label = m.includes('haiku') ? 'Haiku' : m.includes('sonnet') ? 'Sonnet' : m;
    modelHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f8fafc;border-radius:7px;margin-bottom:4px;font-size:12px;">'
      + '<span style="font-weight:700;">' + escHtml(label) + '</span>'
      + '<span style="color:var(--text2);">' + escHtml(String(u.calls)) + '회 · 입력 ' + escHtml(u.inputTokens.toLocaleString()) + ' / 출력 ' + escHtml(u.outputTokens.toLocaleString()) + '</span>'
      + '</div>';
  });

  var html = '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;">📡 API 사용량</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">'
    + statCard((apiUsage.calls || 0) + '회', '총 호출', 'var(--mint)')
    + statCard(totalTokens.toLocaleString(), '총 토큰', 'var(--purple)')
    + statCard('$' + costUSD.toFixed(2), '예상 비용', costUSD > 5 ? 'var(--amber)' : 'var(--green)')
    + statCard('₩' + costKRW.toLocaleString(), '원화 환산', costUSD > 5 ? 'var(--amber)' : 'var(--green)')
    + '</div>'
    + (modelHtml ? '<div style="margin-bottom:12px;">' + modelHtml + '</div>' : '')
    + '<div style="display:flex;gap:6px;margin-bottom:14px;">'
    + '<button class="btn-ghost" style="flex:1;font-size:12px;" onclick="resetApiUsage()">🔄 사용량 초기화</button>'
    + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px;">🐞 에러 로그 (최근 ' + logs.length + '건)</div>';

  if (logs.length === 0) {
    html += '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px;">기록된 에러가 없습니다.</div>';
  } else {
    var recent = logs.slice(-5).reverse();
    html += recent.map(function(e) {
      var d = new Date(e.ts).toLocaleString('ko-KR');
      return '<div style="padding:7px 10px;background:#fef2f2;border-radius:7px;margin-bottom:4px;font-size:11px;line-height:1.5;">'
        + '<div style="color:#dc2626;font-weight:700;">' + escHtml(e.message || '오류') + '</div>'
        + '<div style="color:var(--text2);margin-top:2px;">' + escHtml(d) + (e.source ? ' · ' + escHtml(e.source) : '') + '</div>'
        + '</div>';
    }).join('');
    html += '<div style="display:flex;gap:6px;margin-top:8px;">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px;" onclick="copyErrorLog()">📋 전체 로그 복사</button>'
      + '<button class="btn-del" style="flex:0.5;" onclick="clearErrorLog()">🗑️ 삭제</button>'
      + '</div>';
  }

  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

function copyErrorLog() {
  var logs = getErrorLog();
  var usage = apiUsage;
  var text = '=== 마디 디버그 정보 ===\n'
    + '시간: ' + new Date().toLocaleString('ko-KR') + '\n'
    + 'UA: ' + navigator.userAgent + '\n\n'
    + '--- API 사용량 ---\n'
    + '총 호출: ' + (usage.calls || 0) + '회\n'
    + '입력 토큰: ' + (usage.inputTokens || 0) + '\n'
    + '출력 토큰: ' + (usage.outputTokens || 0) + '\n'
    + '예상 비용: $' + estimateCost().toFixed(2) + '\n\n'
    + '--- 에러 로그 ---\n'
    + logs.map(function(e) {
        return '[' + new Date(e.ts).toISOString() + '] ' + (e.message || '?') + (e.source ? ' @ ' + e.source : '');
      }).join('\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('📋 디버그 정보 복사됨 — 붙여넣기로 전달하세요');
    }).catch(function() {
      showToast('⚠️ 클립보드 복사 실패');
    });
  } else {
    showToast('클립보드 미지원 — 설정 > 디버그 화면을 캡처해 전달해주세요');
  }
}

function setupGlobalErrorHandler() {
  window.addEventListener('error', function(e) {
    // CORS 등 무관한 에러는 무시
    if (!e.message || e.message === 'Script error.') return;
    var filename = (e.filename || '').split('/').pop() || '(unknown)';
    var src = filename + ':' + (e.lineno || '?') + (e.colno ? ':' + e.colno : '');
    if (window.console && console.error) console.error('[Global Error]', maskPII(e.message), src);
    pushErrorLog({
      ts: Date.now(),
      message: maskPII(e.message),
      source: src
    });
    // 디버깅 편의: 30초에 1회 (이전 5분에서 단축) — 진단 완료 후 다시 늘릴 것
    if (!window._lastErrorToast || Date.now() - window._lastErrorToast > 30000) {
      window._lastErrorToast = Date.now();
      try {
        var shortMsg = (e.message || '').slice(0, 70);
        showToast('⚠️ 오류: ' + shortMsg, { duration: 7000 });
      } catch (e2) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    }
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    if (window.console && console.error) console.error('[Unhandled Promise]', maskPII(msg));
    pushErrorLog({ ts: Date.now(), message: 'Promise: ' + maskPII(msg), source: 'unhandledrejection' });
    if (!window._lastErrorToast || Date.now() - window._lastErrorToast > 30000) {
      window._lastErrorToast = Date.now();
      try {
        showToast('⚠️ 비동기 오류: ' + maskPII(msg).slice(0, 80), { duration: 7000 });
      } catch (e2) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    }
  });
}

// ─────── 데이터 안전망: IndexedDB 자동 백업 ───────
var BACKUP_DB_NAME = 'madi_backup_db';
var BACKUP_STORE   = 'daily_backups';
var BACKUP_KEEP    = 7; // 7일치 보관

function openBackupDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(BACKUP_DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

function putBackup(record) {
  return openBackupDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(BACKUP_STORE, 'readwrite');
      var store = tx.objectStore(BACKUP_STORE);
      var req = store.put(record);
      req.onsuccess = function() { resolve(); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  });
}

function listBackups() {
  return openBackupDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(BACKUP_STORE, 'readonly');
      var store = tx.objectStore(BACKUP_STORE);
      var req = store.getAll();
      req.onsuccess = function() {
        var arr = req.result || [];
        // 날짜 내림차순
        arr.sort(function(a, b) { return safeCmp(b.id, a.id); });
        resolve(arr);
      };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
}

function getBackup(id) {
  return openBackupDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(BACKUP_STORE, 'readonly');
      var req = tx.objectStore(BACKUP_STORE).get(id);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  });
}

function deleteBackup(id) {
  return openBackupDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(BACKUP_STORE, 'readwrite');
      var req = tx.objectStore(BACKUP_STORE).delete(id);
      req.onsuccess = function() { resolve(); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  });
}

// 간단한 체크섬 (FNV-1a 32bit) — 무결성 확인용
function quickHash(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16);
}

function buildBackupSnapshot() {
  var data = {
    children:    childDB    || [],
    sessions:    sessionDB  || [],
    schedule:    scheduleDB || [],
    assessments: assessmentDB || [],
    activities:  activityDB || [],
    iep:         iepDB      || []
  };
  var json = JSON.stringify(data);
  return {
    data: data,
    size: json.length,
    counts: {
      children:    data.children.length,
      sessions:    data.sessions.length,
      schedule:    data.schedule.length,
      assessments: data.assessments.length,
      activities:  data.activities.length,
      iep:         data.iep.length
    },
    checksum: quickHash(json)
  };
}

// 전체 로드 완료 여부 — 부분 스냅샷 백업 방지(수정1).
//   1) 메인 로드 완료: window._dataLoadedAt (loadDBFromSupabase 가 children/sessions/schedule/assessments 머지 후 설정)
//   2) 과거 데이터 머지 완료: window._olderHistoryLoaded (boot+1.5s 비동기 _loadOlderHistory 가 90일+/30일+ 세션·일정 머지)
//   둘 중 하나라도 미완료면 부분 스냅샷이므로 백업하지 않는다(스킵 후 재시도는 호출부 maybeAutoBackup 책임).
function isFullLoadComplete() {
  if (typeof window === 'undefined') return false;
  if (!window._dataLoadedAt) return false;          // 메인 로드 전
  if (window._olderHistoryLoaded !== true) return false;  // 과거 머지 전(메인 로드가 false 로 리셋)
  return true;
}

// 직전 일간 백업 대비 컬렉션 급감 감지 — 완료 신호가 불확실하거나 일시적 로드 실패로
//   인메모리가 비정상 축소된 상태를 백업이 박제하는 것을 방지(보수적 2차 가드).
//   기존 백업에 N>0 건이 있었는데 현재가 그 절반 미만이면 부분/손상 스냅샷으로 간주.
function looksLikePartialSnapshot(snapshot) {
  return listBackups().then(function(arr) {
    var prev = null, i;
    for (i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id && String(arr[i].id).indexOf('safety_') !== 0 && arr[i].counts) { prev = arr[i]; break; }
    }
    if (!prev) return false;  // 비교 대상 없음 → 통과
    var keys = ['children', 'sessions', 'schedule', 'assessments', 'activities', 'iep'];
    var cur = snapshot.counts;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var pc = (prev.counts[k] || 0), cc = (cur[k] || 0);
      if (pc >= 4 && cc < pc * 0.5) return true;  // 의미있는 양이 절반 미만으로 급감
    }
    return false;
  }).catch(function() { return false; });  // 비교 실패는 차단하지 않음(백업 자체는 진행)
}

function autoBackup() {
  // 데이터가 아예 없으면 백업 스킵
  if ((childDB || []).length === 0 && (sessionDB || []).length === 0) return Promise.resolve();

  // 수정1: 전체 로드 미완료면 부분 스냅샷 박제 방지 — 저장하지 않고 다음 기회로 미룬다.
  if (!isFullLoadComplete()) {
    if (window.console && console.debug) console.debug('[자동 백업] 전체 로드 미완료 — 스킵(다음 기회 재시도)');
    return Promise.resolve(false);
  }

  var dateKey = getTodayKST();
  var snapshot = buildBackupSnapshot();

  return looksLikePartialSnapshot(snapshot).then(function(partial) {
    if (partial) {
      if (window.console && console.warn) console.warn('[자동 백업] 컬렉션 급감 감지 — 부분/손상 의심으로 스킵');
      return false;
    }
    var record = Object.assign({ id: dateKey, createdAt: Date.now() }, snapshot);
    return putBackup(record)
      .then(pruneOldBackups)
      .then(function() {
        localStorage.setItem('madi_last_backup', dateKey);
        if (window.console && console.debug) console.debug('[자동 백업] ' + dateKey + ' 저장됨 (' + Math.round(snapshot.size/1024) + 'KB)');
        return true;
      });
  }).catch(function(err) {
    if (window.console && console.error) console.error('[자동 백업 실패]', err);
    return false;
  });
}

function pruneOldBackups() {
  // 일간 백업(날짜 id)과 safety 백업(safety_* — 복원 직전 자동 백업)을 분리해 각각 보관.
  //   과거: listBackups 가 id localeCompare 내림차순이라 'safety_*' 가 날짜 id 보다 위로 정렬돼
  //   prune 시 최근 일간 백업이 먼저 삭제되던 버그. createdAt 기준으로 각 그룹 최신 N개만 보존.
  return listBackups().then(function(arr) {
    var daily = [], safety = [];
    arr.forEach(function(b) {
      if (b && b.id && String(b.id).indexOf('safety_') === 0) safety.push(b);
      else daily.push(b);
    });
    function byCreatedDesc(a, b) {
      var ax = (a && typeof a.createdAt === 'number') ? a.createdAt : 0;
      var bx = (b && typeof b.createdAt === 'number') ? b.createdAt : 0;
      if (ax !== bx) return bx - ax;            // 최신 우선
      return safeCmp(b.id, a.id);               // createdAt 동률 시 id 내림차순(결정성)
    }
    daily.sort(byCreatedDesc);
    safety.sort(byCreatedDesc);
    var toDelete = daily.slice(BACKUP_KEEP).concat(safety.slice(BACKUP_KEEP));
    if (toDelete.length === 0) return;
    return Promise.all(toDelete.map(function(b) { return deleteBackup(b.id); }));
  });
}

function maybeAutoBackup() {
  var last;
  try { last = localStorage.getItem('madi_last_backup'); } catch (_e) { last = null; }
  var todayKey = getTodayKST();
  if (last === todayKey) return; // 오늘 이미 백업
  // 수정1: 전체 로드(메인 + 과거 머지 + activities/iep)가 끝날 때까지 기다렸다 백업한다.
  //   _loadOlderHistory 는 boot+1.5s 비동기이므로 단발 5초 타이머는 미완료 스냅샷을 박제할 수 있다.
  //   완료될 때까지 폴링하되, 무한 대기 방지를 위해 시도 횟수를 제한한다(완료 안 되면 그냥 스킵).
  var attempts = 0;
  var MAX_ATTEMPTS = 24;           // 5s + 24*2.5s ≈ 65s 까지 대기
  function tryBackup() {
    // autoBackup 내부에서 isFullLoadComplete() 로 한 번 더 가드하지만,
    //   여기서 먼저 확인해 미완료면 putBackup 자체를 호출하지 않고 재시도한다.
    if (typeof isFullLoadComplete === 'function' && !isFullLoadComplete()) {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        if (window.console && console.warn) console.warn('[자동 백업] 로드 완료 신호 미도달 — 오늘 백업 보류');
        return;
      }
      setTimeout(tryBackup, 2500);
      return;
    }
    autoBackup();
  }
  setTimeout(tryBackup, 5000);
}

// ─────── 백업 복원 ───────
// 두 가지 복원 모드(수정2):
//   • 머지(기본)        : 백업 내용을 인메모리에 덮어쓰고 서버에 upsert. 백업 이후 추가된
//                         서버 행은 그대로 유지된다(삭제 없음).
//   • 완전 복원(선택)   : 위 + center_id 범위 내에서 "백업에 없는 서버 행"을 DELETE 하여
//                         백업 시점 그대로 되돌린다. 백업 이후 추가된 데이터가 영구 삭제될 수 있어
//                         별도 확인 + 삭제 건수 고지 후에만 실행한다.
function restoreFromBackup(id) {
  showConfirm('⚠️ 백업 ' + id + ' 으로 복원하시겠습니까?\n\n복원 직전 자동으로 현재 상태도 백업됩니다.', function() {
    // 1차 모드 선택: 완전 복원 여부. 기본(취소) = 머지.
    showConfirm(
      '복원 방식을 선택해주세요.\n\n' +
      '[확인] 완전 복원 — 백업 이후 추가된 데이터까지 삭제하고 백업 시점 그대로 되돌립니다. (추가된 데이터 영구 삭제)\n' +
      '[취소] 머지 — 기존 데이터는 유지되고 백업 내용이 덮어써집니다. (삭제 없음, 안전)',
      function() {
        // 완전 복원 경로 — 삭제 대상 산출 후 건수 고지 + 최종 확인은 _execRestoreFromBackup 내부에서.
        _execRestoreFromBackup(id, true);
      },
      {
        danger: true,
        okLabel: '완전 복원(삭제 포함)',
        cancelLabel: '머지(삭제 없음)',
        onCancel: function() {
          showConfirm('머지 복원을 진행합니다.\n\n기존 데이터는 유지되고 백업 내용이 덮어써집니다. 이 작업은 되돌릴 수 없습니다.', function() {
            _execRestoreFromBackup(id, false);
          }, { danger: true, okLabel: '복원' });
        }
      }
    );
  }, { danger: true });
}

function _execRestoreFromBackup(id, fullRestore) {
  // 1. 현재 상태를 안전 백업
  var safetyKey = 'safety_' + Date.now();
  var safetySnapshot = buildBackupSnapshot();
  var safetyRecord = Object.assign({ id: safetyKey, createdAt: Date.now(), label: '복원 직전 자동 백업' }, safetySnapshot);

  putBackup(safetyRecord).then(function() {
    return getBackup(id);
  }).then(function(backup) {
    if (!backup || !backup.data) throw new Error('백업 데이터가 손상되었습니다.');

    function applyBackup() {
      // 모든 DB 교체
      childDB      = backup.data.children    || [];
      sessionDB    = backup.data.sessions    || [];
      scheduleDB   = backup.data.schedule    || [];
      assessmentDB = backup.data.assessments || [];
      activityDB   = backup.data.activities  || [];
      iepDB        = backup.data.iep         || [];
      _optionsCacheKey = null;  // 성능: 캐시 무효화
      refreshChildAges();   // 백업 시점 age → 오늘 기준 갱신
      // 로컬 저장 + 서버 upsert (Promise<boolean> 반환). 완전 복원 시 upsert 완료 후 잉여행 삭제.
      var saves = [saveChildren(), saveSessions(), saveSchedule(), saveAssess(), saveActivities(), saveIEP()];
      // 화면 갱신
      renderChildGrid(); populateChildSelects(); renderSessionList();
      if (typeof renderSchedView === 'function') renderSchedView();

      if (!fullRestore) {
        showToast('✅ 백업 ' + id + ' 으로 복원(머지) 완료!');
        setTimeout(function() { renderBackupList(); }, 500);
        return;
      }

      // ── 완전 복원: 백업에 없는 서버 행을 center_id 범위에서 삭제 ──
      showToast('📡 복원 적용 중... (잉여 데이터 정리)');
      Promise.all(saves).then(function() {
        return _deleteOrphanServerRows(backup.data);
      }).then(function(report) {
        if (!report) { // 산출 불가 — 삭제 생략, 머지로 안전 종료
          showToast('✅ 백업 ' + id + ' 복원 완료 (잉여행 정리는 건너뜀)');
          setTimeout(function() { renderBackupList(); }, 500);
          return;
        }
        if (report.total === 0) {
          showToast('✅ 백업 ' + id + ' 으로 완전 복원 완료! (삭제할 잉여 데이터 없음)');
          setTimeout(function() { renderBackupList(); }, 500);
          return;
        }
        // 삭제 건수 고지 + 최종 확인
        var lines = report.perTable.filter(function(t){ return t.ids.length > 0; }).map(function(t) {
          return '· ' + t.label + ': ' + t.ids.length + '건';
        }).join('\n');
        showConfirm(
          '⚠️ 백업 이후 추가된 서버 데이터 ' + report.total + '건을 영구 삭제합니다.\n\n' + lines +
          '\n\n이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?',
          function() {
            _execOrphanDeletes(report.perTable).then(function(deleted) {
              if (typeof loadDBFromSupabase === 'function') loadDBFromSupabase(true); // 서버 기준 재동기화
              showToast('✅ 완전 복원 완료! (잉여 ' + deleted + '건 삭제)');
              setTimeout(function() { renderBackupList(); }, 500);
            }).catch(function(e) {
              showToast('⚠️ 일부 삭제 실패 — ' + _userErrMsg(e, '잉여행 삭제') + ' (복원 내용은 적용됨)');
            });
          },
          { danger: true, okLabel: '삭제하고 완전 복원', cancelLabel: '삭제 취소(머지로 종료)',
            onCancel: function() {
              showToast('✅ 백업 ' + id + ' 복원(머지) 완료 — 잉여행은 유지됨');
              setTimeout(function() { renderBackupList(); }, 500);
            } }
        );
      }).catch(function(e) {
        showToast('⚠️ ' + _userErrMsg(e, '완전 복원') + ' (백업 내용은 적용됨)');
        setTimeout(function() { renderBackupList(); }, 500);
      });
    }

    // 무결성 검증
    var json = JSON.stringify(backup.data);
    if (backup.checksum && quickHash(json) !== backup.checksum) {
      showConfirm('⚠️ 백업 무결성 검증 실패. 그래도 복원하시겠습니까?', applyBackup, { danger: true });
    } else {
      applyBackup();
    }
  }).catch(function(err) {
    showToast('❌ ' + _userErrMsg(err, '백업 복원'));
  });
}

// 완전 복원 — 백업↔서버 테이블 매핑. 백업 키 / 서버 테이블 / 사용자 라벨.
var _RESTORE_TABLES = [
  { key: 'children',    table: 'madi_children',    label: '아동' },
  { key: 'sessions',    table: 'madi_sessions',    label: '세션' },
  { key: 'schedule',    table: 'madi_schedules',   label: '일정' },
  { key: 'assessments', table: 'madi_assessments', label: '검사' },
  { key: 'activities',  table: 'madi_activities',  label: '활동' },
  { key: 'iep',         table: 'madi_iep_history', label: 'IEP' }
];

// 각 테이블에서 "현재 center 의 서버 id 집합 − 백업 id 집합" = 삭제 후보 id 목록 산출.
//   삭제는 절대 자동 실행하지 않고 목록·건수만 반환(최종 확인은 호출부).
//   ⚠️ 단일 center 로만 스코프: superadmin(전 센터) 또는 center_id 부재 시 null 반환(삭제 미수행).
function _deleteOrphanServerRows(backupData) {
  var cid = getCenterId();
  if (!cid || (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'superadmin')) {
    // 안전: 단일 center 스코프를 보장할 수 없으면 삭제 자체를 포기.
    return Promise.resolve(null);
  }
  var scope = 'center_id=eq.' + encodeURIComponent(cid);
  // 각 테이블의 서버 id 목록을 center 스코프로 조회.
  var fetches = _RESTORE_TABLES.map(function(t) {
    return _supaFetchAll(t.table + '?' + scope + '&select=id')
      .then(function(rows) { return Array.isArray(rows) ? rows : []; });
  });
  return Promise.all(fetches).then(function(resultsArr) {
    var perTable = [], total = 0;
    _RESTORE_TABLES.forEach(function(t, idx) {
      var serverRows = resultsArr[idx] || [];
      var backupList = (backupData && backupData[t.key]) || [];
      var backupIds = {};
      backupList.forEach(function(r) { if (r && r.id != null) backupIds[String(r.id)] = true; });
      var orphanIds = [];
      serverRows.forEach(function(r) {
        if (r && r.id != null && !backupIds[String(r.id)]) orphanIds.push(String(r.id));
      });
      perTable.push({ table: t.table, label: t.label, scope: scope, ids: orphanIds });
      total += orphanIds.length;
    });
    return { perTable: perTable, total: total };
  });
}

// 산출된 orphan id 들을 center_id 스코프 + id=in.(...) 로 DELETE.
//   각 DELETE 는 반드시 center_id 조건을 동반(타 센터·전체삭제 방지). 100개씩 배치.
//   하나라도 실패하면 reject(호출부에서 중단·안내).
function _execOrphanDeletes(perTable) {
  var cid = getCenterId();
  if (!cid) return Promise.reject(new Error('center_id 없음 — 삭제 중단'));
  var scope = 'center_id=eq.' + encodeURIComponent(cid);
  var jobs = [];
  perTable.forEach(function(t) {
    if (!t.ids || t.ids.length === 0) return;
    for (var i = 0; i < t.ids.length; i += 100) {
      (function(batchTable, batchIds) {
        jobs.push(function() {
          var inList = batchIds.map(function(x) { return encodeURIComponent(x); }).join(',');
          // 이중 안전장치: center_id 스코프를 항상 포함.
          return supaFetch(batchTable + '?' + scope + '&id=in.(' + inList + ')', 'DELETE');
        });
      })(t.table, t.ids.slice(i, i + 100));
    }
  });
  return jobs.reduce(function(p, job) {
    return p.then(function() { return job(); });
  }, Promise.resolve()).then(function() {
    // 실제 삭제 건수 = 산출된 orphan id 총합(배치는 단지 분할 전송).
    var actual = 0;
    perTable.forEach(function(t) { actual += (t.ids ? t.ids.length : 0); });
    return actual;
  });
}

function renderBackupList() {
  var el = document.getElementById('backupList');
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px;">불러오는 중...</div>';

  listBackups().then(function(arr) {
    if (arr.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px;">저장된 자동 백업이 없습니다.</div>';
      return;
    }
    var html = arr.map(function(b) {
      var sizeKB = Math.round((b.size||0)/1024);
      var dateLabel = b.id.startsWith('safety_')
        ? '🛡️ ' + new Date(parseInt(b.id.replace('safety_',''))).toLocaleString('ko-KR') + ' (수동)'
        : '📅 ' + b.id;
      return '<div style="padding:10px 12px;background:#f8fafc;border-radius:9px;margin-bottom:6px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--navy);">' + escHtml(dateLabel) + '</div>'
        + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">'
        + '아동 ' + escHtml(String(b.counts ? b.counts.children : '?')) + ' · '
        + '세션 ' + escHtml(String(b.counts ? b.counts.sessions : '?')) + ' · '
        + escHtml(String(sizeKB)) + 'KB</div>'
        + '</div>'
        + '<button class="btn-del" onclick="deleteBackupConfirm(\'' + jsArg(String(b.id)) + '\')">삭제</button>'
        + '</div>'
        + '<button class="btn-ghost" style="width:100%;font-size:12px;padding:6px 4px;color:var(--mint);border-color:#a7f3d0;" '
        + 'onclick="restoreFromBackup(\'' + jsArg(String(b.id)) + '\')">↻ 이 백업으로 복원</button>'
        + '</div>';
    }).join('');
    // eslint-disable-next-line no-unsanitized/property
    el.innerHTML = html;
  }).catch(function() {
    el.innerHTML = '<div style="font-size:12px;color:var(--red);text-align:center;padding:10px;">⚠️ 백업을 불러오지 못했습니다. 앱을 새로고침해 주세요.</div>';
  });
}

function deleteBackupConfirm(id) {
  showConfirm('백업 ' + id + ' 을 삭제할까요?', function() {
    deleteBackup(id).then(function() {
      showToast('🗑️ 백업 삭제됨');
      renderBackupList();
    }).catch(function(e) {
      showToast('⚠️ ' + _userErrMsg(e, '백업 삭제'));
    });
  });
}

function callClaude(system, user, maxTokens, model) {
  return fetchWithRetry(EDGE_URL + '/ai-proxy', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      model || MODEL_HAIKU,
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
    if (!res.ok) return res.json().then(function(e) {
      var msg = e.error ? (typeof e.error === 'string' ? e.error : (e.error.message || JSON.stringify(e.error))) : ('HTTP ' + res.status);
      throw new Error(msg);
    }).catch(function(err) { if (err.message) throw err; throw new Error('HTTP ' + res.status); });
    return res.json();
  })
  .then(function(data) {
    // 토큰 사용량 추적
    if (data.usage) {
      var usedModel = (data.model || model || MODEL_HAIKU);
      recordApiUsage(usedModel, data.usage.input_tokens || 0, data.usage.output_tokens || 0);
    }
    return (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
  });
}

function parseJSON(raw) {
  if (!raw || typeof raw !== 'string') return {};
  var cleaned = raw.replace(/```json|```/g, '').trim();

  // 정상 파싱 시도
  var s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s < 0 || e < 0) {
    s = cleaned.indexOf('['); e = cleaned.lastIndexOf(']');
  }
  if (s >= 0 && e >= s) {
    try { return JSON.parse(cleaned.slice(s, e + 1)); } catch (ignored) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  }

  // 잘린 JSON 복구 시도: 배열/객체 괄호 균형 맞추기
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
      // 잘린 경우 — 열린 배열/객체 닫기
      var partial = fragment.slice(0, cutAt);
      // 마지막 완전한 콤마 이후 불완전 항목 제거
      var lastComma = partial.lastIndexOf(',');
      var closing = '';
      // 남은 depth 만큼 닫기
      var checkDepth = 0;
      for (var k = 0; k < partial.length; k++) {
        var c = partial[k];
        if (c === '"') {
          // 이스케이프 따옴표(\") 를 건너뛰며 문자열 끝 탐색
          var q = k + 1;
          while (q < partial.length) {
            if (partial[q] === '"' && partial[q - 1] !== '\\') break;
            q++;
          }
          k = q; continue;
        }
        if (c === '{' || c === '[') checkDepth++;
        else if (c === '}' || c === ']') checkDepth--;
      }
      if (lastComma > 0 && checkDepth > 0) {
        partial = partial.slice(0, lastComma);
        for (var d = 0; d < checkDepth; d++) closing += (fragment[0] === '[' ? ']' : '}');
        try { return JSON.parse(partial + closing); } catch (e2) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
      }
    }
  } catch (ignored2) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }

  throw new Error('JSON 응답 파싱 실패 — 응답이 너무 길거나 형식이 올바르지 않습니다.');
}

// ─────── 센터 API 키 관리 (선택지 2) ───────