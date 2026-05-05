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
  } catch(e) {}
}

function saveApiUsage() {
  try { localStorage.setItem('madi_api_usage', JSON.stringify(apiUsage)); } catch(e) {}
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
  if (!confirm('API 사용량 통계를 초기화할까요?')) return;
  apiUsage = { calls: 0, inputTokens: 0, outputTokens: 0, byModel: {} };
  saveApiUsage();
  renderDebugInfo();
  showToast('🔄 API 사용량 초기화됨');
}

// 에러 로그 저장
function pushErrorLog(entry) {
  try {
    var arr = JSON.parse(sessionStorage.getItem('madi_error_log') || '[]');
    arr.push(entry);
    if (arr.length > ERROR_LOG_MAX) arr = arr.slice(-ERROR_LOG_MAX);
    sessionStorage.setItem('madi_error_log', JSON.stringify(arr));
  } catch(e) {}
}

function getErrorLog() {
  try { return JSON.parse(sessionStorage.getItem('madi_error_log') || '[]'); } catch(e) { return []; }
}

function clearErrorLog() {
  if (!confirm('에러 로그를 모두 삭제할까요?')) return;
  sessionStorage.removeItem('madi_error_log');
  renderDebugInfo();
  showToast('🗑️ 에러 로그 삭제됨');
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
      + '<span style="font-weight:700;">' + label + '</span>'
      + '<span style="color:var(--text2);">' + u.calls + '회 · 입력 ' + u.inputTokens.toLocaleString() + ' / 출력 ' + u.outputTokens.toLocaleString() + '</span>'
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
        + '<div style="color:var(--text2);margin-top:2px;">' + d + (e.source ? ' · ' + escHtml(e.source) : '') + '</div>'
        + '</div>';
    }).join('');
    html += '<div style="display:flex;gap:6px;margin-top:8px;">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px;" onclick="copyErrorLog()">📋 전체 로그 복사</button>'
      + '<button class="btn-del" style="flex:0.5;" onclick="clearErrorLog()">🗑️ 삭제</button>'
      + '</div>';
  }

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
    });
  } else {
    showToast('클립보드 미지원 — 콘솔에 출력합니다');
    console.log(text);
  }
}

function setupGlobalErrorHandler() {
  window.addEventListener('error', function(e) {
    // CORS 등 무관한 에러는 무시
    if (!e.message || e.message === 'Script error.') return;
    console.error('[Global Error]', maskPII(e.message), e.filename + ':' + e.lineno);
    pushErrorLog({
      ts: Date.now(),
      message: maskPII(e.message),
      source: (e.filename || '').split('/').pop() + ':' + e.lineno
    });
    // 사용자에게는 너무 자주 알림 띄우지 않도록 5분에 1회만
    if (!window._lastErrorToast || Date.now() - window._lastErrorToast > 300000) {
      window._lastErrorToast = Date.now();
      try { showToast('⚠️ 오류 발생. 문제가 계속되면 새로고침해 주세요.'); } catch(e) {}
    }
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    console.error('[Unhandled Promise]', maskPII(msg));
    pushErrorLog({ ts: Date.now(), message: 'Promise: ' + maskPII(msg), source: 'unhandledrejection' });
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
        arr.sort(function(a, b) { return b.id.localeCompare(a.id); });
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

function autoBackup() {
  // 데이터가 아예 없으면 백업 스킵
  if ((childDB || []).length === 0 && (sessionDB || []).length === 0) return Promise.resolve();

  var dateKey = new Date().toISOString().slice(0, 10);
  var snapshot = buildBackupSnapshot();
  var record = Object.assign({ id: dateKey, createdAt: Date.now() }, snapshot);

  return putBackup(record)
    .then(pruneOldBackups)
    .then(function() {
      localStorage.setItem('madi_last_backup', dateKey);
      console.log('[자동 백업] ' + dateKey + ' 저장됨 (' + Math.round(snapshot.size/1024) + 'KB)');
    })
    .catch(function(err) {
      console.error('[자동 백업 실패]', err);
    });
}

function pruneOldBackups() {
  return listBackups().then(function(arr) {
    if (arr.length <= BACKUP_KEEP) return;
    var toDelete = arr.slice(BACKUP_KEEP);
    return Promise.all(toDelete.map(function(b) { return deleteBackup(b.id); }));
  });
}

function maybeAutoBackup() {
  var last = localStorage.getItem('madi_last_backup');
  var todayKey = new Date().toISOString().slice(0, 10);
  if (last === todayKey) return; // 오늘 이미 백업
  // 약간 늦게 실행 (앱 로드 방해 안 하기)
  setTimeout(function() { autoBackup(); }, 5000);
}

// ─────── 백업 복원 ───────
function restoreFromBackup(id) {
  if (!confirm('⚠️ 백업 ' + id + ' 으로 복원하시겠습니까?\n\n현재 모든 데이터가 백업으로 덮어써집니다.\n복원 직전 자동으로 현재 상태도 백업됩니다.')) return;
  if (!confirm('정말 진행하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

  // 1. 현재 상태를 안전 백업
  var safetyKey = 'safety_' + Date.now();
  var safetySnapshot = buildBackupSnapshot();
  var safetyRecord = Object.assign({ id: safetyKey, createdAt: Date.now(), label: '복원 직전 자동 백업' }, safetySnapshot);

  putBackup(safetyRecord).then(function() {
    return getBackup(id);
  }).then(function(backup) {
    if (!backup || !backup.data) throw new Error('백업 데이터가 손상되었습니다.');

    // 무결성 검증
    var json = JSON.stringify(backup.data);
    if (backup.checksum && quickHash(json) !== backup.checksum) {
      if (!confirm('⚠️ 백업 무결성 검증 실패. 그래도 복원하시겠습니까?')) return;
    }

    // 모든 DB 교체
    childDB      = backup.data.children    || [];
    sessionDB    = backup.data.sessions    || [];
    scheduleDB   = backup.data.schedule    || [];
    assessmentDB = backup.data.assessments || [];
    activityDB   = backup.data.activities  || [];
    iepDB        = backup.data.iep         || [];

    _optionsCacheKey = null;  // 성능: 캐시 무효화

    // 로컬 저장
    saveChildren(); saveSessions(); saveSchedule(); saveAssess();
    saveActivities(); saveIEP();

    // 화면 갱신
    renderChildGrid();
    populateChildSelects();
    renderSessionList();
    if (typeof renderSchedView === 'function') renderSchedView();

    showToast('✅ 백업 ' + id + ' 으로 복원 완료!');
    setTimeout(function() { renderBackupList(); }, 500);
  }).catch(function(err) {
    showToast('❌ 복원 실패: ' + err.message);
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
        + '아동 ' + (b.counts ? b.counts.children : '?') + ' · '
        + '세션 ' + (b.counts ? b.counts.sessions : '?') + ' · '
        + sizeKB + 'KB</div>'
        + '</div>'
        + '<button class="btn-del" onclick="deleteBackupConfirm(\'' + b.id + '\')">삭제</button>'
        + '</div>'
        + '<button class="btn-ghost" style="width:100%;font-size:12px;padding:6px 4px;color:var(--mint);border-color:#a7f3d0;" '
        + 'onclick="restoreFromBackup(\'' + b.id + '\')">↻ 이 백업으로 복원</button>'
        + '</div>';
    }).join('');
    el.innerHTML = html;
  }).catch(function(err) {
    el.innerHTML = '<div style="font-size:12px;color:var(--red);text-align:center;padding:10px;">⚠️ 백업 로드 실패: ' + escHtml(err.message || '오류') + '</div>';
  });
}

function deleteBackupConfirm(id) {
  if (!confirm('백업 ' + id + ' 을 삭제할까요?')) return;
  deleteBackup(id).then(function() {
    showToast('🗑️ 백업 삭제됨');
    renderBackupList();
  });
}

function manualBackupNow() {
  showToast('💾 백업 중...');
  autoBackup().then(function() {
    showToast('✅ 백업 완료!');
    renderBackupList();
  }).catch(function(err) {
    showToast('❌ ' + err.message);
  });
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
    // 토큰 사용량 추적
    if (data.usage) {
      var usedModel = (data.model || model || MODEL_SONNET);
      recordApiUsage(usedModel, data.usage.input_tokens || 0, data.usage.output_tokens || 0);
    }
    return (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
  });
}

function parseJSON(raw) {
  var cleaned = raw.replace(/```json|```/g, '').trim();

  // 정상 파싱 시도
  var s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s < 0 || e < 0) {
    s = cleaned.indexOf('['); e = cleaned.lastIndexOf(']');
  }
  if (s >= 0 && e >= s) {
    try { return JSON.parse(cleaned.slice(s, e + 1)); } catch(ignored) {}
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

// ─────── 센터 API 키 관리 (선택지 2) ───────