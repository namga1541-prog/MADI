// ─────────────────────────────────────────────────────────────
// 아이마디아이 핵심 경로 계약 테스트 (Node.js 실행)
// 사용: node tests/core-paths.test.js
//
// smoke.js 의 복사-미러 방식과 달리, madi-core.js + madi-app.js 실제 소스를
// vm 샌드박스(브라우저 전역 스텁)에 그대로 로드해 "진짜 구현"을 검증한다.
// → 소스 수정 시 미러 갱신 누락으로 테스트가 헛도는 드리프트가 원천 불가능.
//
// 대상(돈이 걸린 경로):
//   A. 권한 분기      — canDo / isMyChild / getRoleFlags
//   B. 오프라인 큐    — supaFetch 쓰기 큐잉 / _oqFlush FIFO·dead-letter
//   C. 저장 경로      — _saveCollection 배치 upsert·PII 미저장·실패 계약
//   D. 로드·머지      — _supaFetchAll 페이지네이션 / _normalizeRows / _loadOlderHistory
// ─────────────────────────────────────────────────────────────
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');

var passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log('  ✅ ' + label); passed++; }
  else { console.error('  ❌ ' + label); failed++; }
}
function assertEq(label, actual, expected) {
  if (actual === expected) { console.log('  ✅ ' + label); passed++; }
  else { console.error('  ❌ ' + label + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')'); failed++; }
}
function section(name) { console.log('\n▸ ' + name); }

// ── 브라우저 전역 스텁 ─────────────────────────────────────────
function makeStorage(events, tag) {
  var m = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function(k, v) { m[k] = String(v); if (events) events.push({ ev: tag + ':set', key: k }); },
    removeItem: function(k) { delete m[k]; },
    clear: function() { m = {}; }
  };
}

function makeElement() {
  return {
    style: {}, dataset: {},
    classList: { add: function() {}, remove: function() {}, toggle: function() {}, contains: function() { return false; } },
    setAttribute: function() {}, getAttribute: function() { return null; }, removeAttribute: function() {},
    appendChild: function(c) { return c; }, removeChild: function() {}, remove: function() {}, insertBefore: function(c) { return c; },
    addEventListener: function() {}, removeEventListener: function() {},
    contains: function() { return false; },
    querySelector: function() { return null; }, querySelectorAll: function() { return []; },
    getBoundingClientRect: function() { return { top: 0, left: 0, width: 0, height: 0 }; },
    innerHTML: '', textContent: '', value: '', className: '',
    focus: function() {}, blur: function() {}, click: function() {}
  };
}

// madi-core.js → madi-app.js 를 index.html 과 같은 순서로 로드한 샌드박스 생성
function buildSandbox(events) {
  var timers = [];
  var sandbox = {
    console: { log: function() {}, warn: function() {}, error: function() {}, info: function() {} },
    navigator: { onLine: true, userAgent: 'node-test', language: 'ko-KR' },
    localStorage: makeStorage(events, 'ls'),
    sessionStorage: makeStorage(null, 'ss'),
    document: {
      addEventListener: function() {}, removeEventListener: function() {}, dispatchEvent: function() {},
      getElementById: function() { return null; },
      querySelector: function() { return null; }, querySelectorAll: function() { return []; },
      createElement: function() { return makeElement(); }, createTextNode: function() { return {}; },
      createDocumentFragment: function() { return makeElement(); },
      head: makeElement(), body: makeElement(), documentElement: makeElement(),
      visibilityState: 'visible', hidden: false, title: ''
    },
    location: { href: 'https://test.local/', origin: 'https://test.local', pathname: '/', search: '', hash: '', protocol: 'https:', hostname: 'test.local', reload: function() {} },
    history: { pushState: function() {}, replaceState: function() {}, back: function() {} },
    fetch: function() { return Promise.reject(new Error('fetch-not-mocked')); },
    setTimeout: function(fn, ms) { timers.push({ fn: fn, ms: ms || 0 }); return timers.length; },
    clearTimeout: function() {}, setInterval: function() { return 0; }, clearInterval: function() {},
    requestAnimationFrame: function() { return 0; }, cancelAnimationFrame: function() {},
    matchMedia: function() { return { matches: false, addListener: function() {}, addEventListener: function() {} }; },
    MutationObserver: function() { return { observe: function() {}, disconnect: function() {} }; },
    IntersectionObserver: function() { return { observe: function() {}, disconnect: function() {} }; },
    ResizeObserver: function() { return { observe: function() {}, disconnect: function() {} }; },
    addEventListener: function() {}, removeEventListener: function() {}, dispatchEvent: function() {},
    alert: function() {}, confirm: function() { return true; }, prompt: function() { return null; },
    performance: { now: function() { return Date.now(); } },
    URL: URL, URLSearchParams: URLSearchParams, TextEncoder: TextEncoder,
    atob: function(s) { return Buffer.from(s, 'base64').toString('binary'); },
    btoa: function(s) { return Buffer.from(s, 'binary').toString('base64'); },
    CustomEvent: function() {}, Event: function() {},
    // 미로드 파일(madi-system.js 등)의 함수 중 typeof 가드 없이 호출되는 것만 사전 정의
    markMyChange: function() { if (events) events.push({ ev: 'markMyChange' }); },
    __timers: timers
  };
  // _loadOlderHistory 의 typeof 가드 렌더 콜백 — 호출 횟수 계수 스텁
  sandbox.__renders = { sessionList: 0, schedView: 0 };
  sandbox.renderSessionList = function() { sandbox.__renders.sessionList++; };
  sandbox.renderSchedView = function() { sandbox.__renders.schedView++; };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['madi-core.js', 'madi-app.js'].forEach(function(f) {
    var src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, sandbox, { filename: f });
  });
  return sandbox;
}

// 캡처된 setTimeout 콜백 중 지연 <= maxMs 인 것을 실행 (체인 flush 진행용)
function runTimers(S, maxMs) {
  var t = S.__timers.splice(0);
  t.forEach(function(item) {
    if (item.ms <= maxMs) item.fn();
    else S.__timers.push(item);
  });
}
// 이벤트루프 양보 — vm 내부 프라미스 체인 정착 대기
function tick(n) {
  var p = Promise.resolve();
  for (var i = 0; i < (n || 6); i++) {
    p = p.then(function() { return new Promise(function(r) { setImmediate(r); }); });
  }
  return p;
}

// ──────────────────────────────────
// 테스트 실행
// ──────────────────────────────────
(async function main() {
  var events = [];
  var S;
  try {
    S = buildSandbox(events);
  } catch (e) {
    console.error('❌ 샌드박스 로드 실패: ' + e.message);
    console.error(e.stack);
    process.exit(1);
  }
  // 토스트는 전 구간 캡처 스텁으로 교체 (실 showToast 는 DOM 의존)
  var toasts = [];
  S.showToast = function(msg) { toasts.push(String(msg)); };

  // ════ A. 권한 분기 ════
  section('권한: canDo (실구현 — fail-closed 계약)');
  S.currentUser = null;
  assertEq('비로그인 → false', S.canDo('useAI'), false);
  S.currentUser = { role: 'admin' };
  assertEq('admin → true', S.canDo('useAI'), true);
  assertEq('admin → 미정의 키도 true', S.canDo('nonexistentPerm'), true);
  S.currentUser = { role: 'superadmin' };
  assertEq('superadmin → true', S.canDo('deleteSession'), true);
  S.currentUser = { role: 'parent', permissions: { useAI: true } };
  assertEq('parent → 명시 true 여도 차단', S.canDo('useAI'), false);
  S.currentUser = { role: 'teacher' };
  assertEq('teacher 기본값: useAI 허용', S.canDo('useAI'), true);
  assertEq('teacher 기본값: viewOtherChildren 허용', S.canDo('viewOtherChildren'), true);
  assertEq('미정의 권한 키(오타) → fail-closed 차단', S.canDo('typoPermKey'), false);
  S.currentUser = { role: 'teacher', permissions: { useAI: false } };
  assertEq('teacher 명시 false → 차단', S.canDo('useAI'), false);
  S.currentUser = { role: 'teacher', permissions: { deleteSession: true } };
  assertEq('teacher 명시 true → 허용', S.canDo('deleteSession'), true);

  section('권한: isMyChild (실구현 — ID 문자열 컨벤션 포함)');
  S.currentUser = { role: 'teacher', name: '김선생' };
  S.sessionDB = [{ childId: 'c1', teacher: '김선생' }];
  S.scheduleDB = [{ childId: 'c2', teacher: '김선생' }, { childId: 'c3', teacher: '박선생' }];
  assertEq('세션 담당 아동 → true', S.isMyChild('c1'), true);
  assertEq('일정 담당 아동 → true', S.isMyChild('c2'), true);
  assertEq('타 선생님 아동 → false', S.isMyChild('c3'), false);
  assertEq('무관 아동 → false', S.isMyChild('c9'), false);
  S.sessionDB = [{ childId: '7', teacher: '김선생' }];
  S.scheduleDB = [];
  assertEq('문자열 id 매칭 성공', S.isMyChild('7'), true);
  assertEq('숫자 id 는 매칭 실패(String 컨벤션 박제)', S.isMyChild(7), false);
  S.currentUser = { role: 'admin', name: '센터장' };
  assertEq('admin → 담당 무관 true', S.isMyChild('c9'), true);

  section('권한: getRoleFlags (실구현)');
  var fl = S.getRoleFlags({ role: 'teacher' });
  assert('teacher 플래그 정확', fl.isAuth && fl.isTeacher && !fl.isAdmin && !fl.isParent && !fl.isAdminOrSuper);
  fl = S.getRoleFlags({ role: 'superadmin' });
  assert('superadmin → isAdminOrSuper', fl.isSuper && fl.isAdminOrSuper && !fl.isAdmin);
  S.currentUser = null;
  fl = S.getRoleFlags();
  assert('비로그인 → isAuth false', !fl.isAuth && !fl.isAdminOrSuper);

  // ════ B. 오프라인 큐 ════
  section('오프라인 큐: supaFetch 쓰기 큐잉 (실구현)');
  S.currentUser = { role: 'teacher', name: '김선생', center_id: 'ctr1' };
  S.navigator.onLine = false;
  S._offlineQueue = [];
  var q1 = await S.supaFetch('madi_sessions?on_conflict=id', 'POST', [{ id: 's1' }]);
  assert('오프라인 POST → {_queued:true} 즉시 resolve', q1 && q1._queued === true);
  await S.supaFetch('madi_children?id=eq.c1', 'PATCH', { data: {} });
  assertEq('큐 2건 적재', S._offlineQueue.length, 2);
  assertEq('FIFO: head 는 첫 요청', S._offlineQueue[0].path, 'madi_sessions?on_conflict=id');
  assertEq('localStorage(_madiOQ) 영속화', JSON.parse(S.localStorage.getItem('_madiOQ')).length, 2);

  section('오프라인 큐: 실패 분류 _oqIsPermanentFailure (실구현)');
  assertEq('RETRY:503 → 일시(보존)', S._oqIsPermanentFailure(new Error('RETRY:503')), false);
  assertEq('Failed to fetch → 일시(보존)', S._oqIsPermanentFailure(new Error('Failed to fetch')), false);
  assertEq('400 → 영구(격리)', S._oqIsPermanentFailure(new Error('400: bad request')), true);
  assertEq('403 → 영구(격리)', S._oqIsPermanentFailure(new Error('403: forbidden')), true);
  assertEq('401 → 일시(재로그인 가능)', S._oqIsPermanentFailure(new Error('401: 세션 만료')), false);
  assertEq('429 → 일시(레이트리밋)', S._oqIsPermanentFailure(new Error('429: too many')), false);
  assertEq('500 → 일시(보존)', S._oqIsPermanentFailure(new Error('500: oops')), false);
  assertEq('상태 불명 → 일시(보존)', S._oqIsPermanentFailure(new Error('???')), false);

  section('오프라인 큐: _oqFlush 성공 배수 (실구현)');
  S.navigator.onLine = true;
  S._offlineQueueBusy = false;
  S.__timers.length = 0;
  var sent = [];
  S.supaFetch = function(p, m) { sent.push({ path: p, method: m }); return Promise.resolve([]); };
  var resyncCount = 0;
  S.loadDBFromSupabase = function() { resyncCount++; };
  S._oqFlush();
  await tick();
  assertEq('head 전송 후 큐 1건', S._offlineQueue.length, 1);
  runTimers(S, 500); // 체인 setTimeout(_oqFlush, 500)
  await tick();
  assertEq('체인 배수 후 큐 0건', S._offlineQueue.length, 0);
  assertEq('FIFO 순서로 전송', sent[0].path, 'madi_sessions?on_conflict=id');
  assertEq('배수 완료 후 서버 재동기화 1회', resyncCount, 1);
  assertEq('영속 큐도 비움', JSON.parse(S.localStorage.getItem('_madiOQ')).length, 0);

  section('오프라인 큐: 일시 실패 → 큐 보존 + 재시도 예약 (실구현)');
  S._offlineQueue = [{ path: 't?x', method: 'POST', body: {}, retryCount: 0 }];
  S._oqSave();
  S._offlineQueueBusy = false;
  S.__timers.length = 0;
  S.supaFetch = function() { return Promise.reject(new Error('Failed to fetch')); };
  S._oqFlush();
  await tick();
  assertEq('큐 보존(유실 없음)', S._offlineQueue.length, 1);
  assertEq('retryCount 증가·영속', JSON.parse(S.localStorage.getItem('_madiOQ'))[0].retryCount, 1);
  assert('30초 재시도 예약', S.__timers.some(function(t) { return t.ms === 30000; }));
  assert('dead-letter 미격리', !S.localStorage.getItem('cn3_oq_deadletter'));

  section('오프라인 큐: 영구 실패(4xx) → dead-letter 격리 후 전진 (실구현)');
  S._offlineQueue = [
    { path: 'bad?x', method: 'POST', body: {}, retryCount: 0 },
    { path: 'ok?y', method: 'POST', body: {}, retryCount: 0 }
  ];
  S._oqSave();
  S._offlineQueueBusy = false;
  S.__timers.length = 0;
  S.supaFetch = function(p) {
    return p.indexOf('bad') === 0 ? Promise.reject(new Error('403: forbidden')) : Promise.resolve([]);
  };
  S._oqFlush();
  await tick();
  assertEq('영구실패 항목 제거(후속 차단 방지)', S._offlineQueue.length, 1);
  var dl = JSON.parse(S.localStorage.getItem('cn3_oq_deadletter'));
  assertEq('dead-letter 1건 보관', dl.length, 1);
  assert('격리 사유 permanent', dl[0].reason.indexOf('permanent') === 0);
  runTimers(S, 500);
  await tick();
  assertEq('후속 정상 항목 전송 완료', S._offlineQueue.length, 0);

  section('오프라인 큐: 재시도 소진 → dead-letter (실구현)');
  S.localStorage.removeItem('cn3_oq_deadletter');
  S._offlineQueue = [{ path: 'flaky?x', method: 'POST', body: {}, retryCount: 5 }];
  S._offlineQueueBusy = false;
  S.__timers.length = 0;
  S.supaFetch = function() { return Promise.reject(new Error('RETRY:503')); };
  S._oqFlush();
  await tick();
  assertEq('상한 초과 → 큐에서 제거', S._offlineQueue.length, 0);
  dl = JSON.parse(S.localStorage.getItem('cn3_oq_deadletter'));
  assert('retry-exhausted 격리', dl.length === 1 && dl[0].reason.indexOf('retry-exhausted') === 0);

  // ════ C. 저장 경로 ════
  section('저장: _saveCollection 배치 upsert + PII 미저장 (실구현)');
  S.currentUser = { role: 'teacher', name: '김선생', center_id: 'ctr1' };
  events.length = 0;
  var calls = [];
  var okStub = function(p, m, b) { calls.push({ path: p, method: m, body: b }); events.push({ ev: 'net' }); return Promise.resolve([]); };
  S.supaFetch = okStub;
  S.sessionDB = [];
  for (var i = 0; i < 120; i++) S.sessionDB.push({ id: 's' + i, date: '2026-07-01' });
  var ok = await S.saveSessions();
  assertEq('성공 시 true 반환', ok, true);
  assertEq('120건 → 배치 3회(50/50/20)', calls.length, 3);
  assertEq('첫 배치 50건', calls[0].body.length, 50);
  assertEq('마지막 배치 20건', calls[2].body.length, 20);
  assertEq('경로 on_conflict=id upsert', calls[0].path, 'madi_sessions?on_conflict=id');
  assertEq('method POST', calls[0].method, 'POST');
  assertEq('row 매핑: center_id 부여', calls[0].body[0].center_id, 'ctr1');
  assertEq('row 매핑: data 에 원본 보존', calls[0].body[0].data.id, 's0');
  // 보안 계약(safeSetItem): cn3_* PII 캐시는 localStorage 에 저장되지 않는다 —
  //   DevTools/공유기기 평문 노출 방지. 오프라인 내구성은 로컬미러가 아니라 쓰기 큐가 담당.
  assertEq('PII 캐시(cn3_*) localStorage 미저장(보안 계약)', S.localStorage.getItem('cn3_sessions'), null);
  assertEq('safeSetItem: cn3_* 차단이지만 true 반환(저장 흐름 무중단)', S.safeSetItem('cn3_children', '[]'), true);
  assertEq('safeSetItem: 비 PII 키는 정상 저장', (S.safeSetItem('madi_pref', 'x'), S.localStorage.getItem('madi_pref')), 'x');

  section('저장: 서버 실패 시 false + 로컬 보존 (실구현 — 거짓 성공 방지)');
  toasts.length = 0;
  S.supaFetch = function() { return Promise.reject(new Error('500: db down')); };
  S.sessionDB = [{ id: 'x1' }];
  ok = await S.saveSessions();
  assertEq('실패 시 false 반환', ok, false);
  assert('❌ 실패 토스트 표시', toasts.some(function(t) { return t.indexOf('❌') === 0; }));
  assertEq('실패해도 PII 는 localStorage 에 없음(보안 계약 유지)', S.localStorage.getItem('cn3_sessions'), null);
  S.supaFetch = okStub;
  calls.length = 0;
  S.sessionDB = [];
  ok = await S.saveSessions();
  assertEq('빈 컬렉션 → 서버 호출 없이 true', ok, true);
  assertEq('빈 컬렉션 → 서버 호출 0회', calls.length, 0);

  section('저장: saveAssess user_id 매핑 / _saveOneRow 단건 (실구현)');
  calls.length = 0;
  S.assessmentDB = [{ id: 'a1', user_id: 'u9' }, { id: 'a2' }];
  ok = await S.saveAssess();
  assertEq('검사 row user_id 유지', calls[0].body[0].user_id, 'u9');
  assertEq('user_id 없으면 null', calls[0].body[1].user_id, null);
  calls.length = 0;
  S.sessionDB = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  ok = await S.saveOneSession(S.sessionDB[1]);
  assertEq('단건 저장 → 서버 호출 1회', calls.length, 1);
  assertEq('변경 row 만 전송(lost-update 방지)', calls[0].body.length, 1);
  assertEq('전송 row id 정확', calls[0].body[0].id, 's2');
  assertEq('단건 성공 → true', ok, true);

  // ════ D. 로드·머지 ════
  section('로드: _supaFetchAll 1000행 페이지네이션 (실구현 — 2026-06-02 회귀 박제)');
  var pageCalls = [];
  S.supaFetch = function(p) {
    pageCalls.push(p);
    var rows = [];
    if (pageCalls.length === 1) { for (var k = 0; k < 1000; k++) rows.push({ id: k, data: { id: k } }); }
    else { rows = [{ id: 9999, data: { id: 9999 } }]; }
    return Promise.resolve(rows);
  };
  var all = await S._supaFetchAll('madi_sessions?order=id.asc');
  assertEq('1000+1행 → 전량 로드(1001)', all.length, 1001);
  assertEq('페이지 요청 2회', pageCalls.length, 2);
  assert('offset 파라미터 정확(0 → 1000)',
    pageCalls[0].indexOf('limit=1000&offset=0') !== -1 && pageCalls[1].indexOf('offset=1000') !== -1);

  section('로드: _normalizeRows ID 문자열 정규화 (실구현)');
  var norm = S._normalizeRows([{ id: 123, data: { id: 123, childId: 456 } }, { id: 1, data: null }, null]);
  assertEq('data 없는 행 필터', norm.length, 1);
  assertEq('id String 화', norm[0].id, '123');
  assertEq('childId String 화', norm[0].childId, '456');
  assertEq('비배열 입력 → []', S._normalizeRows('x').length, 0);

  section('머지: _loadOlderHistory 중복 없이 병합 (실구현)');
  S.currentUser = { role: 'teacher', name: '김선생', center_id: 'ctr1' };
  S._olderHistoryLoaded = false;
  S.sessionDB = [{ id: '1', childId: 'c1' }];
  S.scheduleDB = [];
  S.__renders.sessionList = 0;
  S.__renders.schedView = 0;
  var fetchAllCalls = 0;
  S._supaFetchAll = function(p) {
    fetchAllCalls++;
    if (p.indexOf('madi_sessions') === 0) {
      return Promise.resolve([{ id: 1, data: { id: 1, childId: 'c1' } }, { id: 2, data: { id: 2, childId: 'c2' } }]);
    }
    return Promise.resolve([]);
  };
  S._loadOlderHistory('2026-04-01', '2026-06-01');
  await tick();
  assertEq('기존 id 중복 배제 후 신규만 머지 → 2건', S.sessionDB.length, 2);
  assert('신규 항목(id=2, String) 존재', S.sessionDB.some(function(s) { return s.id === '2'; }));
  assertEq('세션 추가됨 → renderSessionList 1회', S.__renders.sessionList, 1);
  assertEq('일정 무추가 → renderSchedView 생략(불필요 풀렌더 방지)', S.__renders.schedView, 0);
  fetchAllCalls = 0;
  S._loadOlderHistory('2026-04-01', '2026-06-01');
  await tick();
  assertEq('2회째 호출은 플래그로 조기 종료(서버 무호출)', fetchAllCalls, 0);
  S._olderHistoryLoaded = false;
  S.currentUser = { role: 'parent' };
  S._loadOlderHistory('2026-04-01', '2026-06-01');
  await tick();
  assertEq('parent 계정은 조기 종료(403 배치 방지)', fetchAllCalls, 0);

  // ──────────────────────────────────
  // 결과 출력
  // ──────────────────────────────────
  console.log('\n' + '═'.repeat(40));
  console.log('핵심 경로 테스트: ' + passed + ' 통과 / ' + failed + ' 실패');
  if (failed > 0) { console.error('❌ 일부 테스트 실패'); process.exit(1); }
  console.log('✅ 모든 테스트 통과');
  process.exit(0);
})().catch(function(e) {
  console.error('❌ 테스트 러너 오류: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
