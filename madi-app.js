/* ───────────────────────────────────────────────────────────
   madi-app.js — 데이터 로드 / 앱 UI / 네트워크
   - loadDBFromSupabase 및 save / load 도메인 함수
   - showConfirm / debounce / showToast / vibrate
   - 다크모드 / 헤더 시계 / 네트워크 모니터
   - 학부모 UI / 권한 적용 / 더보기 메뉴

   분리 사유: madi-core.js 가 1,062 라인으로 비대.
   ─────────────────────────────────────────────────────────── */

// ─────── Supabase DB 로드 / 저장 ───────
// 최적화 (2026-05-21): 최근 90일 우선 로드 → 백그라운드에서 과거 데이터 머지
// 운영 1년차 이후 첫 화면 fetch 1~3초 단축, 메모리·jsonb 페이로드 절감
function _isoDaysAgo(n) {
  // KST 기준 — toISOString()(UTC)은 KST 새벽에 하루 어긋나므로 nowKST()+ymd() 사용
  var d = nowKST(); d.setDate(d.getDate() - n);
  return ymd(d);
}

// Supabase 응답 행 정규화 — data 추출 + id/childId String 화. childId String 컨벤션(회귀버그
//   방지)을 한 곳에서만 관리하도록 loadDBFromSupabase·_loadOlderHistory 의 중복 nested 함수를 통합.
function _normalizeRows(arr) { if (!Array.isArray(arr)) return []; return arr.filter(function(r){ return r && r.data; }).map(function(r){ var d=r.data; d.id=String(r.id); if (d.childId !== undefined) d.childId=String(d.childId); return d; }); }

// Supabase 기본 max-rows(1000) 초과 컬렉션 전량 로드 — offset 페이지네이션.
//   limit=1000 한 페이지씩 받아 합치고, 반환 < 1000 이면 마지막 페이지로 종료(소규모 테이블은 요청 1회).
//   ⚠️ basePath 에 order=... 가 반드시 포함돼야 페이지 경계가 안정적(중복·누락 방지).
//   재발 버그(2026-06-02): 2년 반복 일정 누적으로 madi_schedules 1700+행 → order=id.asc 1000행 컷에
//   가장 최근(큰 id) 일정이 잘려 "새 일정이 새로고침하면 사라짐" 증상 발생. 페이지네이션으로 해소.
function _supaFetchAll(basePath) {
  var PAGE = 1000;
  var acc = [];
  function _page(offset) {
    var sep = basePath.indexOf('?') > -1 ? '&' : '?';
    return supaFetch(basePath + sep + 'limit=' + PAGE + '&offset=' + offset, 'GET').then(function(rows) {
      if (!Array.isArray(rows)) return acc;
      acc = acc.concat(rows);
      if (rows.length < PAGE) return acc;
      return _page(offset + PAGE);
    });
  }
  return _page(0);
}

// _supaFetchAll 로 로드한 컬렉션의 렌더스킵 시그니처 — 페이지별 supaFetch GET 캐시 해시를 연결한다.
//   _supaFetchAll 의 페이지 경로 규칙(basePath + sep + 'limit=PAGE&offset=N')을 그대로 재현해
//   캐시에 보관된 해시(_supaCacheHashOf)를 offset 0,1000,... 순으로 잇는다.
//   한 페이지라도 캐시 미스면 null 반환 → 호출부가 보수적으로 렌더(스킵 금지)하게 한다.
//   ⚠️ _supaFetchAll 의 PAGE/경로 조합이 바뀌면 이 함수도 함께 고쳐야 한다(시그니처 정합).
function _bpCacheSig(basePath) {
  var PAGE = 1000;
  var sep = basePath.indexOf('?') > -1 ? '&' : '?';
  var parts = [], offset = 0;
  for (;;) {
    var h = _supaCacheHashOf(basePath + sep + 'limit=' + PAGE + '&offset=' + offset);
    if (h === null) {
      // offset 0 미스 = 컬렉션 전체 캐시 미스 → null. offset>0 미스 = 정상 종료(마지막 페이지 다음).
      if (offset === 0) return null;
      break;
    }
    parts.push(h);
    offset += PAGE;
  }
  return parts.join(',');
}

function loadDBFromSupabase(silent) {
  // 학부모 계정은 이 함수로 데이터를 로드하지 않음.
  // madi_sessions 이 PARENT_BLOCKED_TABLES 에 포함되어 있어 Edge Function 이 403 을 반환하고
  // Promise.all 전체가 reject 되는 버그 방지.
  // 학부모 포털 데이터(아동·일정·포트폴리오 등)는 madi-parent-home.js 가 자체적으로 로드한다.
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'parent') return;

  if (!silent) showToast('📡 데이터 불러오는 중...');
  _optionsCacheKey = null;
  // 세션: 최근 90일, 일정: 최근 30일~미래 전체 (캘린더는 미래 일정 필요)
  var d90 = _isoDaysAgo(90);
  var d30 = _isoDaysAgo(30);
  var _bpCh  = 'madi_children?'    + centerFilter() + '&select=id,data&order=id.asc';
  var _bpSe  = 'madi_sessions?'    + centerFilter() + '&data->>date=gte.' + d90 + '&select=id::text,data&order=id.asc';
  var _bpSch = 'madi_schedules?'   + centerFilter() + '&data->>date=gte.' + d30 + '&select=id::text,data&order=id.asc';
  var _bpAs  = 'madi_assessments?' + centerFilter() + '&select=id::text,data&order=id.asc';
  Promise.all([
    _supaFetchAll(_bpCh),
    _supaFetchAll(_bpSe),
    _supaFetchAll(_bpSch),
    _supaFetchAll(_bpAs)
  ]).then(function(results) {
    var supaCh = _normalizeRows(results[0]), supaSe = _normalizeRows(results[1]), supaSch = _normalizeRows(results[2]), supaAs = _normalizeRows(results[3]);
    childDB = supaCh; sessionDB = supaSe; scheduleDB = supaSch; assessmentDB = supaAs;
    // ⚠️ 매 로드마다 과거 데이터 재머지 허용 — 위에서 sessionDB/scheduleDB 를 최근치로 덮어썼으므로,
    //   _olderHistoryLoaded 를 리셋하지 않으면 폴링·탭복귀 두 번째 호출부터 _loadOlderHistory 가
    //   조기 return 해 과거 세션(>90일)·일정(>30일)이 인메모리에서 영구 소실된다. 과거 쿼리는
    //   supaFetch 5분 캐시로 흡수돼 부하는 작다.
    window._olderHistoryLoaded = false;
    refreshChildAges();   // 등록 시점 age → 오늘 기준으로 인메모리 갱신
    window._dataLoadedAt = Date.now();
    if (!silent) showToast('✅ 데이터 로드 완료 (아동 ' + childDB.length + '명)');
    // 폴링(silent) 무변경 시 전체 풀렌더 스킵 — H6. 4개 컬렉션 JSON 해시를 직전 로드와 비교해
    //   동일하면 renderChildGrid 등(innerHTML 통째 교체 + reflow)을 건너뛴다. GET 5분 캐시라 폴링은
    //   대부분 동일 데이터인데도 30초마다 DOM 전체를 재구축하던 비용 제거. 비-silent(최초·수동 로드)는 항상 렌더.
    //   해시는 supaFetch GET 캐시가 set 시점에 1회 계산해 보관 → 여기선 페이지별 보관 해시만 연결(재직렬화 0).
    //   _bpCacheSig 가 캐시 미스(예: noCache·캐시퇴출)를 만나면 null 을 돌려주고, 그 경우는 비교 불가이므로
    //   반드시 렌더(스킵 안 함) — 기존 "변경 시 렌더" 의미를 보수적으로 유지.
    var _newSig = _bpCacheSig(_bpCh) + '|' + _bpCacheSig(_bpSe) + '|' + _bpCacheSig(_bpSch) + '|' + _bpCacheSig(_bpAs);
    var _renderSkip = (silent && window._lastDataSig === _newSig && _newSig.indexOf('null') === -1);
    window._lastDataSig = _newSig;
    if (!_renderSkip) {
      // 폴링(silent) 재렌더 전 .open 카드 id 목록 보존 → 재렌더 후 복원.
      //   renderChildGrid 가 innerHTML 통째 교체라, toggleChildCard 가 DOM-only 로 .open 을 관리해
      //   30초 폴링마다 펼친 카드가 결정적으로 닫히던 문제 해소.
      var _openIds = [];
      if (silent) {
        document.querySelectorAll('.child-card.open').forEach(function(el) {
          if (el.id) _openIds.push(el.id);  // id="cc_<childId>" 패턴
        });
      }
      if (typeof renderChildGrid === 'function') renderChildGrid(); if (typeof populateChildSelects === 'function') populateChildSelects(); if (typeof renderGoalRows === 'function') renderGoalRows(); if (typeof renderSessionList === 'function') renderSessionList(); if (typeof renderUnwrittenAlert === 'function') renderUnwrittenAlert();
      // .open 카드 복원
      if (_openIds.length) {
        _openIds.forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.classList.add('open');
        });
      }
      if (typeof renderSchedView === 'function') renderSchedView();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
    loadActivitiesFromSupa(); loadIEPFromSupa();
    setTimeout(function() { if (typeof loadNotices === 'function') loadNotices(); }, 600);
    // 백그라운드: 과거 데이터 추가 로드 후 머지 (사용자 인지 없이)
    setTimeout(function() { _loadOlderHistory(d90, d30); }, 1500);
  }).catch(function(e) {
    if (window.console && console.error) console.error('loadDB 실패:', e); showToast('❌ 데이터 로드 실패 — 로컬 데이터로 표시합니다');
    loadDB(); if (typeof renderChildGrid === 'function') renderChildGrid(); if (typeof populateChildSelects === 'function') populateChildSelects();
  });
}

// 90일 이전 세션 + 30일 이전 일정 백그라운드 로드 → 머지
// 성장 기록·포트폴리오·연간 통계 등 과거 데이터 필요 영역을 위함
function _loadOlderHistory(d90, d30) {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'parent') return;
  if (window._olderHistoryLoaded) return;
  window._olderHistoryLoaded = true;
  Promise.all([
    _supaFetchAll('madi_sessions?'  + centerFilter() + '&data->>date=lt.' + d90 + '&select=id::text,data&order=id.desc'),
    _supaFetchAll('madi_schedules?' + centerFilter() + '&data->>date=lt.' + d30 + '&select=id::text,data&order=id.desc')
  ]).then(function(results) {
    var oldSe  = _normalizeRows(results[0]);
    var oldSch = _normalizeRows(results[1]);
    var addedSe = 0, addedSch = 0;
    var seenSe = {}; sessionDB.forEach(function(s){ seenSe[s.id] = true; });
    oldSe.forEach(function(s){ if (!seenSe[s.id]) { sessionDB.push(s); addedSe++; } });
    var seenSch = {}; scheduleDB.forEach(function(s){ seenSch[s.id] = true; });
    oldSch.forEach(function(s){ if (!seenSch[s.id]) { scheduleDB.push(s); addedSch++; } });
    // 머지된 신규 항목이 0건이면 동일 화면 재렌더(innerHTML 전체 교체) 생략 — 초기 2회 풀렌더 제거(H-7)
    if (addedSe   > 0 && typeof renderSessionList === 'function') try { renderSessionList(); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
    if (addedSch  > 0 && typeof renderSchedView   === 'function') try { renderSchedView();   } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  }).catch(function(e) {
    if (window.console && console.warn) console.warn('[older history] silent:', e && e.message);
  });
}

// 경량 문자열 해시(djb2) — 폴링 변경 시그니처 비교용. 32bit unsigned 반환.
function _hashStr(s) {
  var h = 5381, i = s.length;
  while (i) { h = (h * 33) ^ s.charCodeAt(--i); }
  return h >>> 0;
}

// ── 컬렉션 저장 공통 헬퍼 ──
// localStorage 미러 → 서버 배치 upsert(50개씩). 반환 Promise<boolean>(true=성공).
// 실패 시 ❌ 토스트는 내부에서 표시. 호출부는 .then(ok) 로 성공 시에만 ✅ 표시(거짓 성공 방지).
/**
 * @param {{db:any[], lsKey:string, table:string, label:string, mapRow?:Function, before?:Function}} o
 * @returns {Promise<boolean>}
 */
function _saveCollection(o) {
  markMyChange();
  if (o.before) o.before();
  safeSetItem(o.lsKey, JSON.stringify(o.db));
  if (o.db.length === 0) return Promise.resolve(true);
  var cid = getCenterId();
  var mapRow = o.mapRow || function(x) { return { id: x.id, center_id: cid, data: x }; };
  return _saveRowsBatched(o.table, o.db.map(mapRow), o.label);
}
// 임의 row 배열을 50개씩 나눠 순차 upsert — _saveCollection 과 신규 다건 추가(반복일정 saveSchedules)가
// 공유하는 배치 헬퍼(M-6). 항목마다 개별 POST(N회 라운드트립·부분실패) 대신 배치로 묶는다.
// @returns {Promise<boolean>} 모든 배치 성공 시 true, 실패 시 친화 토스트 후 false.
function _saveRowsBatched(table, rows, label) {
  if (!rows || rows.length === 0) return Promise.resolve(true);
  var batches = [];
  for (var i = 0; i < rows.length; i += 50) batches.push(rows.slice(i, i + 50));
  return batches.reduce(function(p, batch) {
    return p.then(function() { return supaFetch(table + '?on_conflict=id', 'POST', batch); });
  }, Promise.resolve())
    .then(function() { return true; })
    .catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, label)); return false; });
}
/** @returns {Promise<boolean>} */
function saveChildren() {
  return _saveCollection({ db: childDB, lsKey: 'cn3_children', table: 'madi_children', label: '아동',
    before: function() { _optionsCacheKey = null; } });
}
/** 아동 단건 저장 (변경 row 만 upsert) — saveChildren 의 lost-update 안전 버전. @returns {Promise<boolean>} */
function saveOneChild(row) {
  return _saveOneRow({ db: childDB, row: row, lsKey: 'cn3_children', table: 'madi_children', label: '아동',
    before: function() { _optionsCacheKey = null; } });
}
// ── 단건 행 저장 헬퍼 (H2 lost-update 완화) ──
// 변경된 row 하나만 서버에 upsert + localStorage 미러 갱신. 컬렉션 통째 upsert(_saveCollection)가
// 다중 사용자 환경에서 무관한 타 row 의 stale 사본으로 동시 편집을 덮어쓰던 lost-update 를,
// 단건 add/edit 경로에서 제거한다. _saveCollection 과 동일한 Promise<boolean> 계약.
/**
 * @param {{db:any[], row:any, lsKey:string, table:string, label:string, mapRow?:Function, before?:Function}} o
 * @returns {Promise<boolean>}
 */
function _saveOneRow(o) {
  markMyChange();
  if (o.before) o.before();
  safeSetItem(o.lsKey, JSON.stringify(o.db)); // 로컬 미러는 전체(로컬 전용·동시성 무관)
  if (!o.row) return Promise.resolve(true);
  var cid = getCenterId();
  var mapRow = o.mapRow || function(x) { return { id: x.id, center_id: cid, data: x }; };
  return supaFetch(o.table + '?on_conflict=id', 'POST', [mapRow(o.row)])
    .then(function() { return true; })
    .catch(function(e) { showToast('❌ ' + getSaveErrMsg(e, o.label)); return false; });
}
function getSaveErrMsg(e, label) {
  var msg = e && e.message ? e.message : '';
  if (!navigator.onLine) return label + ' 저장 실패 — 인터넷 연결을 확인해주세요';
  if (msg.indexOf('403') !== -1 || msg.indexOf('401') !== -1) return label + ' 저장 권한 없음 — 관리자에게 문의해주세요';
  if (msg.indexOf('timeout') !== -1 || msg.indexOf('RETRY') !== -1) return label + ' 저장 실패 — 서버 응답 없음, 잠시 후 재시도해주세요';
  return label + ' 저장 실패 — 잠시 후 다시 시도해주세요';
}
// 범용 사용자 노출 에러 — supaFetch 원문(상태코드+PostgREST 본문, 테이블/컬럼명 포함)을
//   숨기고 상태 기반 친화 문구만 반환. 원문은 호출부에서 console.warn 으로 별도 로깅 권장.
function _userErrMsg(e, action) {
  var msg = (e && e.message) ? String(e.message) : '';
  if (!navigator.onLine) return action + ' 실패 — 인터넷 연결을 확인해주세요';
  if (msg.indexOf('403') !== -1 || msg.indexOf('401') !== -1) return action + ' 권한이 없습니다';
  if (msg.indexOf('409') !== -1) return action + ' 실패 — 이미 처리되었거나 중복된 요청입니다';
  if (msg.indexOf('timeout') !== -1 || msg.indexOf('RETRY') !== -1) return action + ' 실패 — 서버 응답이 없습니다. 잠시 후 다시 시도해주세요';
  return action + '에 실패했습니다. 잠시 후 다시 시도해주세요';
}
// 범용 에러 핸들러 — Promise .catch 의 일관 진입점. 사용: .catch(showError) 또는 .catch(function(e){ showError(e, '저장'); })
//   _userErrMsg 로 서버 원문(상태코드·테이블/컬럼명)을 숨긴 친화 토스트를 띄우고, 원문은 console.warn 으로 디버깅 로깅.
//   파일마다 제각각이던 .catch 처리(토스트 누락·원문 노출)를 한 줄로 표준화.
function showError(err, action) {
  console.warn('[' + (action || 'error') + ']', err);
  showToast('⚠️ ' + _userErrMsg(err, action || '요청'));
}
// 음성 인식 SpeechRecognition.onerror 의 영문 코드를 사용자 친화 한국어로 변환 (SSOT — chat·child-detail 공용)
function voiceErrMsg(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed': return '🎤 마이크 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요';
    case 'no-speech':           return '🎤 음성이 감지되지 않았습니다. 다시 시도해주세요';
    case 'audio-capture':       return '🎤 마이크를 찾을 수 없습니다. 장치 연결을 확인해주세요';
    case 'network':             return '🎤 네트워크 오류로 음성 인식에 실패했습니다';
    case 'aborted':             return '🎤 음성 입력이 중단되었습니다';
    case 'language-not-supported': return '🎤 해당 언어는 음성 인식을 지원하지 않습니다';
    default:                    return '🎤 음성 인식에 실패했습니다. 다시 시도해주세요';
  }
}
/** @returns {Promise<boolean>} */
function saveSessions() {
  return _saveCollection({ db: sessionDB, lsKey: 'cn3_sessions', table: 'madi_sessions', label: '세션' });
}
/** 세션 단건 저장 (변경 row 만 upsert) — saveSessions 의 lost-update 안전 버전. @returns {Promise<boolean>} */
function saveOneSession(row) {
  return _saveOneRow({ db: sessionDB, row: row, lsKey: 'cn3_sessions', table: 'madi_sessions', label: '세션' });
}
/** @returns {Promise<boolean>} */
function saveSchedule() {
  return _saveCollection({ db: scheduleDB, lsKey: 'cn3_schedule', table: 'madi_schedules', label: '일정' });
}
/** 일정 단건 저장 (변경 row 만 upsert) — saveSchedule 의 lost-update 안전 버전. @returns {Promise<boolean>} */
function saveOneSchedule(row) {
  return _saveOneRow({ db: scheduleDB, row: row, lsKey: 'cn3_schedule', table: 'madi_schedules', label: '일정' });
}
/** @returns {Promise<boolean>} */
function saveAssess() {
  return _saveCollection({ db: assessmentDB, lsKey: 'cn3_assess', table: 'madi_assessments', label: '검사',
    mapRow: function(a) { return { id: a.id, center_id: getCenterId(), user_id: a.user_id || null, data: a }; } });
}

/** @type {Child[]} */       var childDB = [];
/** @type {Session[]} */     var sessionDB = [];
/** @type {Schedule[]} */    var scheduleDB = [];
/** @type {any[]} */         var assessmentDB = [];
/** @type {any[]} */         var activityDB = [];
/** @type {any[]} */         var iepDB = [];
function loadDB() {
  // cn3_* localStorage 캐시 비활성 — PII 평문 저장 금지. 인메모리로 시작, loadDBFromSupabase 가 채움.
  childDB = []; sessionDB = []; scheduleDB = []; assessmentDB = []; activityDB = []; iepDB = [];
}

// ── 아동 연령 실시간 갱신 ────────────────────────────────────────────────
// DB 에 저장된 age 는 '등록 시점' 기준 — 로드·복원·임포트 후 항상 호출해
// 오늘 기준 연령으로 인메모리만 교체 (DB 는 saveChildren() 호출 시 반영)
// calcAgeFromBirth 는 madi-schedule.js 에 정의 → typeof 가드 필수
function refreshChildAges() {
  if (typeof calcAgeFromBirth !== 'function') return;
  childDB.forEach(function(c) {
    if (c.birth) {
      var fresh = calcAgeFromBirth(c.birth);
      if (fresh) c.age = fresh;
    }
  });
}
/** @returns {Promise<boolean>} 복원 경로 Promise.all 이 완료를 기다리도록 Promise 반환(저장 미완 중 orphan 삭제 방지) */
function saveIEP() {
  if (!currentUser || currentUser.role === 'parent') return Promise.resolve(false);
  safeSetItem('cn3_iep', JSON.stringify(iepDB));
  var cid = getCenterId(), rows = iepDB.map(function(r){ return { id: r.id, center_id: cid, data: r }; });
  if (rows.length === 0) return Promise.resolve(true);
  return supaFetch('madi_iep_history?on_conflict=id', 'POST', rows).then(function(){ return true; }).catch(function(e){
    if(window.console&&console.warn)console.warn('[madi-01 saveIEP]',e&&e.message);
    showToast('⚠️ IEP 저장 중 오류가 발생했습니다');
    return false;
  });
}
// 무변경 폴링(30초)에서 IEP/활동 DOM 통째 재구축 방지 — 직전 직렬화 결과와 동일하면 render 생략.
//   safeSetItem 용 JSON.stringify 를 그대로 시그니처로 재사용하므로 추가 직렬화 비용 0.
var _lastIepJson = null, _lastActivitiesJson = null;
function loadIEPFromSupa() {
  _supaFetchAll('madi_iep_history?' + centerFilter() + '&select=id,data&order=id.desc')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      var parsed = rows.filter(function(r){ return r && r.data; }).map(function(r){ var d=r.data; d.id=String(r.id); return d; });
      if (parsed.length > 0) {
        iepDB = parsed;
        var _j = JSON.stringify(iepDB); safeSetItem('cn3_iep', _j);
        if (_j !== _lastIepJson) { _lastIepJson = _j; var _iepEl = document.getElementById('iepChild'); if (_iepEl && typeof renderIEPHistory === 'function') renderIEPHistory(String(_iepEl.value || '')); }
      }
    }).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}
/** @returns {Promise<boolean>} 복원 경로 Promise.all 동기화를 위해 Promise 반환 */
function saveActivities() {
  safeSetItem('cn3_activities', JSON.stringify(activityDB));
  var cid = getCenterId(), rows = activityDB.map(function(a){ return Object.assign({}, a, { center_id: cid }); });
  return supaFetch('madi_activities?on_conflict=id', 'POST', rows).then(function(){ return true; }).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message); showToast('⚠️ ' + _userErrMsg(e, '활동 저장')); return false;});
}
function loadActivitiesFromSupa() {
  _supaFetchAll('madi_activities?' + centerFilter() + '&order=id.asc')
    .then(function(rows) {
      if (Array.isArray(rows) && rows.length > 0) {
        activityDB = rows;
        var _j = JSON.stringify(activityDB); safeSetItem('cn3_activities', _j);
        if (_j !== _lastActivitiesJson) { _lastActivitiesJson = _j; if (typeof renderActivityCatalog === 'function') renderActivityCatalog(); }
      }
    })
    .catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-01]',e&&e.message);});
}

// ── 커스텀 confirm 모달 (브라우저 confirm 대체) ──
/* ─── 모달 공통 a11y 헬퍼 ───────────────────────────────────────────
   ESC 닫기 + 포커스 트래핑(Tab 순환) + 호출 전 활성 요소로 포커스 복원.
   사용:
     var release = attachModalA11y(overlayElement, onClose);
     // 모달 닫을 때:
     release();   // 리스너 제거 + 포커스 복원
   ─────────────────────────────────────────────────────────────── */
function attachModalA11y(overlay, onClose) {
  if (!overlay) return function(){};
  var prevFocus = document.activeElement;
  function focusables() {
    return overlay.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
      'textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (typeof onClose === 'function') onClose();
      return;
    }
    if (e.key === 'Tab') {
      var list = focusables();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }
  document.addEventListener('keydown', onKey, true);
  return function release() {
    document.removeEventListener('keydown', onKey, true);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
  };
}

/* ─── 인풋 모달 (날짜·텍스트 등 단일 입력) ─────────────────────────
   기존 native prompt() 대체. 모바일에서 네이티브 데이트픽커가 뜨고,
   탭/ESC/오버레이 클릭 모두 정상 동작. */
function showInputPrompt(opts) {
  opts = opts || {};
  var title    = opts.title    || '입력';
  var label    = opts.label    || '';
  var initial  = opts.value    || '';
  var type     = opts.type     || 'text';  // text | date | number
  var placeholder = opts.placeholder || '';
  var okLabel  = opts.okLabel  || '확인';
  var cancelLabel = opts.cancelLabel || '취소';
  var onOk     = opts.onOk     || function(){};
  var onCancel = opts.onCancel || function(){};
  var validate = opts.validate || null;  // function(value) -> errMsg or null

  var ov = document.createElement('div');
  ov.className = 'confirm-ov';
  // eslint-disable-next-line no-unsanitized/property
  ov.innerHTML = '<div class="confirm-box" role="dialog" aria-modal="true" aria-labelledby="ipTitle">'
    + '<p id="ipTitle" class="confirm-msg" style="font-weight:700;">' + escHtml(title) + '</p>'
    + (label ? '<label for="ipInput" style="display:block;font-size:12px;color:var(--text2,#64748b);margin:6px 0 4px;">' + escHtml(label) + '</label>' : '')
    + '<input id="ipInput" type="' + escHtml(type) + '" value="' + escHtml(initial) + '" placeholder="' + escHtml(placeholder) + '" '
    + 'style="width:100%;padding:11px 12px;font-size:16px;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;font-family:inherit;box-sizing:border-box;">'
    + '<div id="ipErr" style="color:#ef4444;font-size:12px;margin-top:6px;min-height:14px;"></div>'
    + '<div class="confirm-btns">'
    + '<button class="btn btn-ghost confirm-cancel">' + escHtml(cancelLabel) + '</button>'
    + '<button class="btn btn-primary confirm-ok">' + escHtml(okLabel) + '</button>'
    + '</div></div>';
  document.body.appendChild(ov);

  var input = ov.querySelector('#ipInput');
  var errBox = ov.querySelector('#ipErr');
  var release = null;

  function close() {
    if (release) release();
    if (ov.parentNode) document.body.removeChild(ov);
  }
  function doCancel() { close(); onCancel(); }
  function doOk() {
    var v = input.value;
    if (validate) {
      var err = validate(v);
      if (err) { errBox.textContent = err; input.focus(); return; }
    }
    close(); onOk(v);
  }

  ov.querySelector('.confirm-cancel').onclick = doCancel;
  ov.querySelector('.confirm-ok').onclick = doOk;
  ov.addEventListener('click', function(e) { if (e.target === ov) doCancel(); });
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') doOk(); });
  release = attachModalA11y(ov, doCancel);
  setTimeout(function() { input.focus(); if (type !== 'date') input.select(); }, 50);
}

function showConfirm(msg, onOk, opts) {
  opts = opts || {};
  var okLabel     = opts.okLabel     || '확인';
  var cancelLabel = opts.cancelLabel || '취소';
  var danger      = opts.danger !== false;
  var ov = document.createElement('div');
  ov.className = 'confirm-ov';
  // eslint-disable-next-line no-unsanitized/property
  ov.innerHTML = '<div class="confirm-box" role="alertdialog" aria-modal="true">'
    + '<p class="confirm-msg">' + escHtml(msg).replace(/\n/g,'<br>') + '</p>'
    + '<div class="confirm-btns">'
    + '<button class="btn btn-ghost confirm-cancel">' + escHtml(cancelLabel) + '</button>'
    + '<button class="btn ' + escHtml(danger ? 'btn-del' : 'btn-primary') + ' confirm-ok">' + escHtml(okLabel) + '</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  var release = null;
  function close() { if (release) release(); if (ov.parentNode) document.body.removeChild(ov); }
  function doCancel() { close(); if (opts.onCancel) opts.onCancel(); }
  ov.querySelector('.confirm-cancel').onclick = doCancel;
  ov.querySelector('.confirm-ok').onclick = function() { close(); onOk(); };
  ov.addEventListener('click', function(e) { if (e.target === ov) doCancel(); });
  release = attachModalA11y(ov, doCancel);
  setTimeout(function() { var b = ov.querySelector('.confirm-ok'); if (b) b.focus(); }, 50);
}

var toastTimer = null, toastForceTimer = null, toastLocked = false;
function debounce(fn, delay) { var timer = null; return function() { var ctx = this, args = arguments; clearTimeout(timer); timer = setTimeout(function() { fn.apply(ctx, args); }, delay); }; }
var CHILD_PAGE_SIZE = 50, _childCurrentPage = 1, _optionsCacheKey = null, _optionsCacheHtml = '';

function showToast(msg, opts) {
  opts = opts || {}; if (toastLocked && !opts.force) return;
  var el = document.getElementById('toast'); if (!el) return;
  if (opts.undo && typeof opts.undo === 'function') {
    el.innerHTML = '<span>' + escHtml(msg) + '</span> <span style="display:inline-block;margin-left:8px;padding:3px 10px;background:rgba(255,255,255,0.18);border-radius:14px;color:#5eead4;font-size:12px;cursor:pointer;pointer-events:auto;" id="toastUndoBtn">↩️ 실행취소</span>';
    el.style.pointerEvents = 'auto';
    setTimeout(function() { var b = document.getElementById('toastUndoBtn'); if (b) b.onclick = function(e) { e.stopPropagation(); opts.undo(); el.classList.remove('show'); toastLocked = false; }; }, 0);
  } else { el.textContent = msg; el.style.pointerEvents = 'auto'; }
  el.onclick = function() { el.classList.remove('show'); clearTimeout(toastTimer); clearTimeout(toastForceTimer); toastTimer = null; toastForceTimer = null; toastLocked = false; };
  // duration 미명시 호출은 메시지 길이에 비례해 가산(긴 showError 문장이 너무 빨리 사라지던 UX M).
  //   기본 3000ms + 글자수×40, 7000ms 상한. ❌/⚠️ 경고는 최소 4000ms 보장. duration 명시 호출은 존중.
  var duration;
  if (opts.duration) duration = opts.duration;
  else if (opts.undo) duration = 5000;
  else {
    var _m = String(msg == null ? '' : msg);
    duration = Math.min(7000, 3000 + _m.length * 40);
    // 경고/오류(❌·⚠️ 로 시작)는 최소 4000ms — 멀티코드포인트 이모지라 indexOf===0 로 판별.
    if ((_m.indexOf('❌') === 0 || _m.indexOf('⚠️') === 0) && duration < 4000) duration = 4000;
  }
  var wasShowing = el.classList.contains('show'); el.classList.add('show');
  if (!wasShowing) {
    clearTimeout(toastForceTimer);
    // 강제 종료 타이머는 표시 duration 보다 먼저 꺼지면 안 됨 — 길이 가산된 duration 을 하한으로.
    var maxDuration = opts.lock ? (opts.duration || 8000) : Math.max(5000, duration);
    toastForceTimer = setTimeout(function() { el.classList.remove('show'); toastLocked = false; toastForceTimer = null; }, maxDuration);
  }
  clearTimeout(toastTimer);
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
  var isDark = document.body.classList.toggle('dark-mode');
  try { localStorage.setItem('madi_dark', isDark ? '1' : '0'); } catch (_e) {}
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', isDark ? '#020617' : '#0ea5a0');
  showToast(isDark ? '🌙 다크 모드' : '☀️ 라이트 모드');
}
function loadDarkMode() {
  // ⛔ BETA: 다크모드 봉인 — 라이트 전용 운영. 저장값 무시하고 라이트 강제.
  //   베타 후 복원: 아래 remove 줄 삭제하고 주석 블록 되살리면 됨.
  document.body.classList.remove('dark-mode');
  // var saved; try { saved = localStorage.getItem('madi_dark'); } catch (_e) { saved = null; }
  // if (saved === '1') { document.body.classList.add('dark-mode'); var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', '#020617'); }
}
var _clockSchedCache = { day: '', sig: -1, list: [] };
function updateHeaderClock() {
  var timeEl = document.getElementById('clockTime'), nextEl = document.getElementById('clockNext');
  if (!timeEl || !nextEl) return;
  var now = nowKST(); timeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  var today = ymd(now), nowMin = now.getHours()*60+now.getMinutes();
  var allSched = (typeof scheduleDB !== 'undefined' ? scheduleDB : []);
  // 오늘 일정(startTime 보유)만 1회 필터·정렬해 캐시 — 날짜 또는 일정 건수 변화 시에만 재구축.
  //   1분/포커스마다 scheduleDB(최대 수천 행) 전체를 재필터·재정렬하던 비용 제거.
  //   (헤더 시계는 보조 표시라, 건수 불변 in-place 시간편집은 다음 갱신에 자연 반영된다.)
  if (_clockSchedCache.day !== today || _clockSchedCache.sig !== allSched.length) {
    _clockSchedCache.day = today;
    _clockSchedCache.sig = allSched.length;
    _clockSchedCache.list = allSched
      .filter(function(s){ if (s.date !== today || !s.startTime) return false; var p = s.startTime.split(':'); return p && p.length >= 2; })
      .sort(function(a,b){ return safeCmp(a.startTime, b.startTime); });
  }
  // 캐시된 오늘 정렬목록에서 현재시각 이후 첫 일정만 선형 탐색
  var next = null;
  for (var i = 0; i < _clockSchedCache.list.length; i++) {
    var s = _clockSchedCache.list[i], sp = s.startTime.split(':');
    if (parseInt(sp[0])*60+parseInt(sp[1]) >= nowMin) { next = s; break; }
  }
  if (next) {
    var child = (typeof childDB !== 'undefined' ? childDB : []).find(function(c){ return c.id === next.childId; });
    var p = next.startTime.split(':'); if (!p || p.length < 2) { nextEl.textContent = ''; return; }
    var name = child ? child.name : '?', diff = (parseInt(p[0])*60+parseInt(p[1]))-nowMin;
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
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:calc(8px + env(safe-area-inset-top,0px)) 14px 8px;font-size:12px;font-weight:700;text-align:center;z-index:10001;box-shadow:0 2px 8px rgba(0,0,0,0.2);'; /* 10001: 모달(10000) 위에 표시 */
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
      'flex-shrink:0;z-index:100;box-shadow:2px 0 8px rgba(0,0,0,0.06);align-self:stretch;overflow-y:auto;'
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
    if (el.id.startsWith('parentPanel')) el.style.display = 'none'; // 학부모 패널 강제 숨김
    else el.style.display = '';
  });
  var floatBtn = document.getElementById('floatBtn');
  if (floatBtn) floatBtn.style.display = '';
  var chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.style.display = '';
  var appMain = document.getElementById('appMain'); if (appMain) appMain.style.paddingLeft = '';
}

// loadParentDashboard 제거(전수감사 정리): 호출부 0건 죽은 함수 + 자녀식별 SSOT 는
//   madi-parent-home.js(다자녀 정식 처리). 첫 링크만 보던 열화 중복 버전이라 삭제.

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
  // 베타 기간: 최소 4자 유지 (정식 배포 시 8자+영숫자 혼합으로 강화 예정)
  if (!pw || pw.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
  return null;
}

// ─────── ID 생성 유틸 (단조 카운터 — 대량 생성에도 충돌 불가) ───────
//   과거 '초*1e6 + 난수' 방식은 같은 초에 수백 건 생성 시 생일역설로 충돌 위험이 있어,
//   반복 일정 id 가 별도 방식으로 분리돼 있었다(드리프트·이번 일정 버그의 한 축).
//   밀리초*1000 + 프로세스 내 단조 카운터(하위 3자리)로 통일 → 같은 ms 1000건까지 충돌
//   불가(반복 일정 최대 ~730건 안전). id 는 불투명 PK(서버가 center_id 로 격리)라
//   난수 예측가능성과 무관. 항상 문자열 반환(safeMap 의 String 정규화와 타입 일관).
var _clientIdCounter = 0;
function generateClientId() {
  _clientIdCounter = (_clientIdCounter + 1) % 1000;
  return String(Date.now() * 1000 + _clientIdCounter);
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

/* ─── iOS ITP 대응 ────────────────────────────────────────────────
   Safari 13.1+ 는 7일 비활성 사이트의 localStorage 를 자동 삭제.
   매 진입 시 last-seen 타임스탬프 갱신 → 활성 사이트로 인식되어 데이터 보호.
   장기 미접속(>=7일) 후 재진입 감지 시 사용자에게 한 번 안내. */
(function trackITPLastSeen() {
  try {
    var KEY = 'madi_last_seen_at';
    var SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    var prev = parseInt(localStorage.getItem(KEY) || '0', 10);
    var now = Date.now();
    if (prev && (now - prev) > SEVEN_DAYS) {
      // 7일 이상 비활성 — 자동 wipe 가능성 안내 (실제 wipe 시엔 prev 자체가 사라져 이 분기 안 탐)
      setTimeout(function() {
        if (typeof showToast === 'function') {
          showToast('👋 오랜만이에요! 로그인이 풀려있다면 다시 들어와주세요.', { duration: 4000 });
        }
      }, 1500);
    }
    localStorage.setItem(KEY, String(now));
  } catch (e) { /* private mode / storage 차단 — silent */ }
})();
