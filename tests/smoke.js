// ─────────────────────────────────────────────
// 아이마디아이 유닛 스모크 테스트 (Node.js 실행)
// 사용: node tests/smoke.js
//
// tests/lib/madi-pure-utils.js 에서 madi-01.js 의 실제 구현을 로드한다.
// 파일이 없을 경우 인라인 폴백으로 동작하므로 환경 제약 없이 실행 가능하다.
// ─────────────────────────────────────────────
'use strict';

// ── madi-01.js 실제 소스 함수 로드 (폴백 포함) ──────────────────────
var _utils;
try { _utils = require('./lib/madi-pure-utils.js'); } catch (e) { _utils = null; }

// 실제 소스 구현을 우선 사용하고, 로드 실패 시 인라인 폴백으로 대체한다.
var escHtml = _utils ? _utils.escHtml : function(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

var ymd = _utils ? _utils.ymd : function(d) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
};

var getTodayKST = _utils ? _utils.getTodayKST : function() {
  var d = (function(x) { return new Date(x.getTime() + x.getTimezoneOffset() * 60000 + 9 * 3600000); })(new Date());
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
};

var restoreName = _utils ? _utils.restoreName : function(text, realName) {
  if (!realName || text == null) return text;
  if (String(realName).indexOf('"') !== -1 || String(realName).indexOf('\\') !== -1) return text;
  return String(text).split('○○').join(realName);
};

// 다중 아동 인덱스 마스커 SSOT (madi-pii.js) — parent·chat 공용. 폴백 없음(실패 시 테스트 skip).
var madiNameMasker; try { madiNameMasker = require('../madi-pii.js').madiNameMasker; } catch (e) { madiNameMasker = null; }

// 인라인 핸들러 JS 인자 이스케이프 (madi-core.js / madi-pure-utils.js)
var jsArg = _utils ? _utils.jsArg : function(s) { return String(s); };

// 임상 계산 함수 (실파일 구현 미러 — madi-pure-utils.js). 폴백 없음(없으면 skip).
var interpolatePct   = _utils ? _utils.interpolatePct   : null;
var parseBirth       = _utils ? _utils.parseBirth       : null;
var calcAgeFromBirth = _utils ? _utils.calcAgeFromBirth : null;
var weekDoneCount    = _utils ? _utils.weekDoneCount    : null;

var passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log('  ✅ ' + label);
    passed++;
  } else {
    console.error('  ❌ ' + label);
    failed++;
  }
}

function assertEq(label, actual, expected) {
  var ok = actual === expected;
  if (ok) {
    console.log('  ✅ ' + label);
    passed++;
  } else {
    console.error('  ❌ ' + label + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
    failed++;
  }
}

function section(name) { console.log('\n▸ ' + name); }

// validatePasswordStrength (madi-01.js 패턴)
function validatePasswordStrength(pw) {
  if (!pw || pw.length < 8) return '비밀번호는 8자 이상이어야 합니다';
  if (!/[a-zA-Z]/.test(pw)) return '영문자를 포함해야 합니다';
  if (!/[0-9]/.test(pw)) return '숫자를 포함해야 합니다';
  return null;
}

// centerFilter 논리 (admin.html)
function centerFilter(role, centerId) {
  if (role === 'superadmin') return 'center_id=not.is.null';
  return 'center_id=eq.' + centerId;
}

// 일정 내보내기 행 빌드 로직 (madi-10.js 추출)
function buildExportRow(sched, child) {
  return {
    날짜:        sched.date || '',
    시작시간:    (sched.startTime || '').slice(0, 5),
    종료시간:    (sched.endTime   || '').slice(0, 5),
    이용자:      child ? child.name : '',
    선생님:      sched.teacher || '',
    프로그램유형: child ? (child.type || '') : '',
    바우처:      child ? (child.voucherType || '일반') : '',
    메모:        sched.note || ''
  };
}

// 저장 흐름 순수 로직 (madi-app.js _saveCollection/_saveOneRow 추출)
function defaultMapRow(x, cid) { return { id: x.id, center_id: cid, data: x }; }
function chunkRows(rows, size) {
  var batches = [];
  for (var i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));
  return batches;
}
// 오프라인 큐 FIFO 계약 모델 (madi-core.js _oqFlush 불변식: 성공→shift, 실패→보존)
function oqStep(queue, ok) {
  var q = queue.slice();
  if (!q.length) return q;
  if (ok) q.shift();          // 성공: head 제거 (FIFO 전진)
  return q;                   // 실패: 큐 그대로 보존 (재시도 대상)
}

// ──────────────────────────────────
// 테스트 실행
// ──────────────────────────────────

section('escHtml XSS 방어');
assertEq('<script> 이스케이프', escHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
assertEq('따옴표 이스케이프', escHtml('"hello"'), '&quot;hello&quot;');
assertEq('일반 문자열 통과', escHtml('안녕하세요'), '안녕하세요');
assertEq('앰퍼샌드 이스케이프', escHtml('A&B'), 'A&amp;B');

section('날짜 유틸');
var d = new Date('2026-05-18T00:00:00+09:00');
assert('getTodayKST 형식 YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(getTodayKST()));

section('비밀번호 검증');
assertEq('8자 미만 거부', validatePasswordStrength('abc1'), '비밀번호는 8자 이상이어야 합니다');
assertEq('영문 없음 거부', validatePasswordStrength('12345678'), '영문자를 포함해야 합니다');
assertEq('숫자 없음 거부', validatePasswordStrength('abcdefgh'), '숫자를 포함해야 합니다');
assertEq('올바른 비밀번호 통과', validatePasswordStrength('abc12345'), null);
assertEq('빈 문자열 거부', validatePasswordStrength(''), '비밀번호는 8자 이상이어야 합니다');

section('센터 필터 (centerFilter)');
assertEq('superadmin → 전체', centerFilter('superadmin', 'ctr1'), 'center_id=not.is.null');
assertEq('admin → 본인 센터', centerFilter('admin', 'ctr-abc'), 'center_id=eq.ctr-abc');
assertEq('teacher → 본인 센터', centerFilter('teacher', 'ctr-xyz'), 'center_id=eq.ctr-xyz');

section('일정 내보내기 행 변환');
var sched = { date: '2026-05-18', startTime: '10:00:00', endTime: '10:50:00', teacher: '배다솔', note: '음운치료' };
var child = { name: '김아동', type: '조음음운장애', voucherType: '발달재활' };
var row = buildExportRow(sched, child);
assertEq('날짜 매핑', row.날짜, '2026-05-18');
assertEq('시작시간 5자리', row.시작시간, '10:00');
assertEq('종료시간 5자리', row.종료시간, '10:50');
assertEq('이용자명', row.이용자, '김아동');
assertEq('선생님명', row.선생님, '배다솔');
assertEq('프로그램유형', row.프로그램유형, '조음음운장애');
assertEq('바우처', row.바우처, '발달재활');
assertEq('메모', row.메모, '음운치료');

var schedNoChild = { date: '2026-05-19', startTime: '14:00', endTime: '', teacher: '남그', note: '' };
var rowNoChild = buildExportRow(schedNoChild, null);
assertEq('아동 없으면 이름 빈 문자열', rowNoChild.이용자, '');
assertEq('아동 없으면 바우처 빈 문자열', rowNoChild.바우처, '');

// ──────────────────────────────────
// 회귀 테스트 — 2026-06-01~02 수정한 버그 클래스 재발 방지
// (DOM/통합 버그는 e2e 영역, 여기선 순수 로직 컨벤션을 박제)
// ──────────────────────────────────
section('회귀: ID 문자열 컨벤션');
var _idDB = [{ id: '1717000001' }, { id: '1717000002' }];
// 수정본: String 비교 → 찾음
assert('String 비교로 childId 매칭됨',
  _idDB.find(function (c) { return String(c.id) === '1717000001'; }) !== undefined);
// 회귀 감지: parseInt/숫자 비교는 매칭이 깨진다 (madi-10:56·114 버그 클래스)
assert('parseInt/숫자비교는 매칭 실패(버그 클래스 박제)',
  _idDB.find(function (c) { return c.id === parseInt('1717000001', 10); }) === undefined);

section('회귀: 날짜 KST');
// ymd 는 로컬 컴포넌트 기반 — 어느 TZ에서 돌려도 동일 (CI=UTC 안전)
assertEq('ymd 포맷(YYYY-MM-DD)', ymd(new Date(2026, 5, 2)), '2026-06-02');
// toISOString()(UTC)을 날짜로 쓰면 KST 새벽에 하루 어긋남 — _isoDaysAgo 버그 클래스 박제
var _utcDawn = new Date('2026-06-01T20:00:00Z'); // KST 로는 06-02 05:00
assert('toISOString().slice 는 UTC라 날짜용 부적합(버그 클래스 박제)',
  _utcDawn.toISOString().slice(0, 10) === '2026-06-01');

section('회귀: escHtml 작은따옴표');
// 음소 oninput 등 inline 핸들러 인자 안전성 (madi-05 저장형 XSS 수정)
assert("작은따옴표(')를 이스케이프", escHtml("a'b").indexOf("'") === -1);

section('AI 가명화 복원 (restoreName, PII)');
// 실명을 외부 LLM 으로 보내지 않는 M2/H1 정책의 복원 로직 박제
assertEq('가명 ○○ → 실명 복원', restoreName('○○이는 잘해요. ○○ 화이팅', '김민준'), '김민준이는 잘해요. 김민준 화이팅');
assertEq('따옴표 포함 이름은 원문 유지(JSON 안전)', restoreName('○○ 잘함', '김"민준'), '○○ 잘함');
assertEq('역슬래시 포함 이름도 원문 유지', restoreName('○○', 'a\\b'), '○○');
assertEq('null 입력 안전', restoreName(null, '김민준'), null);
assertEq('실명 없으면 원문 유지', restoreName('○○ 보고서', ''), '○○ 보고서');

section('AI 다중아동 가명화 SSOT (madiNameMasker, madi-pii.js)');
if (!madiNameMasker) {
  assert('madi-pii.js 로드(SSOT 존재)', false);
} else {
  // 사전 시딩(parent 패턴) — childDB 인덱스 순서로 아동N
  var _mk = madiNameMasker([{ name: '김민수' }, { name: '이서연' }]);
  assertEq('시딩: 첫째 → 아동1', _mk.alias('김민수'), '아동1');
  assertEq('시딩: 둘째 → 아동2', _mk.alias('이서연'), '아동2');
  assertEq('mask: 텍스트 내 실명 → 별칭', _mk.mask('김민수와 이서연'), '아동1와 아동2');
  assertEq('restore: 별칭 → 실명 왕복', _mk.restore('아동1는 잘함, 아동2도 좋음'), '김민수는 잘함, 이서연도 좋음');
  // 부분겹침 방지: '김민'⊂'김민수' — 긴 이름 먼저 치환
  var _mk2 = madiNameMasker([{ name: '김민수' }, { name: '김민' }]);
  assertEq('부분겹침: 긴 실명 우선', _mk2.mask('김민수'), '아동1');
  // 접두 충돌 방지: '아동1'⊂'아동10' — 10명 시딩 후 아동10 복원
  var _ten = []; for (var _i = 1; _i <= 10; _i++) _ten.push({ name: '아이' + _i });
  var _mk3 = madiNameMasker(_ten);
  assertEq('접두 충돌: 아동10 정확 복원', _mk3.restore('아동10'), '아이10');
  assertEq('접두 충돌: 아동1 정확 복원', _mk3.restore('아동1'), '아이1');
  // 지연 생성(chat 패턴) — 시딩 없이 등장 순서로 번호 부여
  var _mkL = madiNameMasker();
  assertEq('지연: 첫 등장 → 아동1', _mkL.alias('박지훈'), '아동1');
  assertEq('지연: 같은 이름 재요청 → 동일 별칭', _mkL.alias('박지훈'), '아동1');
  assertEq('지연: 둘째 등장 → 아동2', _mkL.alias('최유나'), '아동2');
  assertEq('지연 후 restore 왕복', _mkL.restore('아동2가 아동1보다 빠름'), '최유나가 박지훈보다 빠름');
  // null 안전
  assertEq('mask null 안전', _mk.mask(null), null);
  assertEq('restore null 안전', _mk.restore(null), null);
  // 보안2: prefix 분리(치료사) — 아동 별칭과 충돌 없이 독립 매핑
  var _tm = madiNameMasker(null, '치료사');
  assertEq('치료사 prefix: 첫 등장 → 치료사1', _tm.alias('김선생'), '치료사1');
  assertEq('치료사 별칭 복원', _tm.restore('치료사1'), '김선생');
  assert('아동/치료사 별칭 접두 분리', _tm.alias('박선생') === '치료사2' && _mk.alias('박선생') === '아동3');
}

section('인라인 핸들러 XSS 차단 (jsArg, 저장형 XSS 박제)');
// escHtml 만으로는 HTML 파서가 &#39;→' 디코딩해 JS 문자열 탈출 가능 → jsArg 로 백슬래시 이스케이프 추가.
//   jsArg 출력은 디코딩돼도 \' (JS 이스케이프된 따옴표)라 onclick="fn('<jsArg>')" 를 깨지 못한다.
assertEq("따옴표를 백슬래시+HTML 이중 이스케이프", jsArg("a'b"), "a\\&#39;b");
assertEq('역슬래시 이스케이프(먼저)', jsArg('a\\b'), 'a\\\\b');
assert('페이로드의 닫는 따옴표가 백슬래시로 무력화', jsArg("');alert(1);('").indexOf("\\&#39;") !== -1);
assert('순수 텍스트는 안전 통과', jsArg('김민준') === '김민준');
assertEq('null 안전', jsArg(null), '');

section('저장 흐름: mapRow + 배치 분할 (lost-update 리팩토링 박제)');
var _mr = defaultMapRow({ id: 'x1', date: '2026-06-05' }, 'ctr1');
assertEq('mapRow id', _mr.id, 'x1');
assertEq('mapRow center_id', _mr.center_id, 'ctr1');
assert('mapRow data 원본 보존', _mr.data && _mr.data.date === '2026-06-05');
function _mkRows(n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: i }); return a; }
assertEq('50개 → 배치 1개', chunkRows(_mkRows(50), 50).length, 1);
assertEq('51개 → 배치 2개(경계)', chunkRows(_mkRows(51), 50).length, 2);
assertEq('51개 둘째 배치 1개', chunkRows(_mkRows(51), 50)[1].length, 1);
assertEq('100개 → 배치 2개', chunkRows(_mkRows(100), 50).length, 2);
assertEq('0개 → 배치 0개', chunkRows(_mkRows(0), 50).length, 0);

section('오프라인 큐 FIFO 계약 (_oqFlush 불변식)');
assertEq('성공 시 head 제거(FIFO 전진)', oqStep([{p:'a'},{p:'b'}], true).length, 1);
assertEq('성공 후 다음 head 는 b', oqStep([{p:'a'},{p:'b'}], true)[0].p, 'b');
assertEq('실패 시 큐 보존(재시도 대상)', oqStep([{p:'a'},{p:'b'}], false).length, 2);
assertEq('빈 큐는 그대로', oqStep([], true).length, 0);

// ──────────────────────────────────
// 회귀 테스트 — 2026-06-08 수정한 임상 계산 버그 박제
// ──────────────────────────────────

section('회귀: interpolatePct 백분위 보간 (madi-assessment.js)');
if (!interpolatePct) {
  assert('madi-pure-utils.js interpolatePct 로드', false);
} else {
  // 규준표 구조: [백분위, 수용점수(col1), 표현점수(col2)] — 실제 SELSI_PCT_TABLE 동형.
  // col1 단조증가, col2 에 동점 run(45·45)·상한 동점(60·60) 포함해 경계 검증.
  var _T = [
    [1,  3, 10],
    [5,  5, 20],
    [10, 5, 30],   // col1 동점 run 시작: 점수 5 가 백분위 5·10 두 행
    [25, 8, 45],
    [50, 12, 45],  // col2 동점 run: 점수 45 가 백분위 25·50 두 행
    [90, 18, 55],
    [99, 25, 60]
  ];
  // 하한 '미만'(strictly <) → sentinel -1
  assertEq('수용 하한 미만(2<3) → -1(미만 표시)', interpolatePct(_T, 2, 1), -1);
  // 최저행과 정확히 같음(==) → 정상 산출(미만 아님)
  assertEq('수용 최저행과 동일(3) → 백분위 1(미만 아님)', interpolatePct(_T, 3, 1), 1);
  // 동점 run(col1: 점수 5 → 백분위 5·10) → 중앙값 (짝수 2개 → round((5+10)/2)=8)
  assertEq('수용 동점 run(5) → 백분위 중앙값 8', interpolatePct(_T, 5, 1), 8);
  // 동점 run(col2: 점수 45 → 백분위 25·50) → 중앙값 round((25+50)/2)=38
  assertEq('표현 동점 run(45) → 백분위 중앙값 38', interpolatePct(_T, 45, 2), 38);
  // 정상 브래킷 보간 (수용 점수 10 은 8~12 사이, 백분위 25~50)
  assertEq('수용 보간(10 → 25~50 사이)', interpolatePct(_T, 10, 1), 38);
  // 상한 초과 → 최고 백분위
  assertEq('수용 상한 초과(99) → 최고 백분위 99', interpolatePct(_T, 99, 1), 99);
  assertEq('수용 상한 정확(25) → 최고 백분위 99', interpolatePct(_T, 25, 1), 99);
  // 동점 run 홀수 개 → 정확한 중앙값 (점수 45 가 col2 에서 3행이면 가운데)
  var _T2 = [[10,1,45],[50,2,45],[90,3,45]];
  assertEq('동점 run 홀수(3개) → 가운데값 50', interpolatePct(_T2, 45, 2), 50);
}

section('회귀: parseBirth 날짜 롤오버 거부 (madi-schedule.js)');
if (!parseBirth) {
  assert('madi-pure-utils.js parseBirth 로드', false);
} else {
  assertEq('2월30일(20260230) → null', parseBirth('20260230'), null);
  assertEq('13월(20261301) → null', parseBirth('20261301'), null);
  assertEq('4월31일(20260431) → null', parseBirth('20260431'), null);
  assertEq('빈 입력 → null', parseBirth(''), null);
  assertEq('8자리 아님(7자리) → null', parseBirth('2026010'), null);
  // 정상 8자리 → Date (하이픈 포함 입력도 정규화)
  var _pb = parseBirth('20200315');
  assert('정상(20200315) → Date 객체', _pb instanceof Date && !isNaN(_pb.getTime()));
  assert('정상 파싱 연·월·일 정확', _pb.getFullYear() === 2020 && _pb.getMonth() === 2 && _pb.getDate() === 15);
  var _pbDash = parseBirth('2020-03-15');
  assert('하이픈 포함도 정상 파싱', _pbDash instanceof Date && _pbDash.getDate() === 15);
  assert('윤년 2월29일(20240229) 정상 통과', parseBirth('20240229') instanceof Date);
  assertEq('비윤년 2월29일(20260229) → null', parseBirth('20260229'), null);
}

section('회귀: calcAgeFromBirth 만나이 계산 (madi-schedule.js)');
if (!calcAgeFromBirth) {
  assert('madi-pure-utils.js calcAgeFromBirth 로드', false);
} else {
  // 미래 생일 → 빈 문자열 (오늘+1년 기준 안전 마진)
  var _future = new Date(); _future.setFullYear(_future.getFullYear() + 1);
  var _fStr = _future.getFullYear()
    + String(_future.getMonth() + 1).padStart(2, '0')
    + String(_future.getDate()).padStart(2, '0');
  assertEq('미래 생일 → 빈 문자열', calcAgeFromBirth(_fStr), '');
  // 정확히 N세 (오늘로부터 정수 년 전 생일이면 'N세')
  var _today = new Date();
  var _exact = (_today.getFullYear() - 5)
    + String(_today.getMonth() + 1).padStart(2, '0')
    + String(_today.getDate()).padStart(2, '0');
  assertEq('5년 전 같은 날 → 5세', calcAgeFromBirth(_exact), '5세');
  // 생일 안 지남(월수 차감) — 고정 픽스처로 분기 직접 검증.
  //   기준일을 인자로 받지 않는 함수라 '오늘'에 의존하지만, 아래 케이스는
  //   '오늘이 생일 하루 전' 상황을 픽스처로 재현: birth = (오늘 - 5년 + 1일).
  //   → 만 4세여야 한다(5세 생일이 내일이라 아직 5세 아님). years 차감 분기 박제.
  var _almost5 = new Date(_today.getTime()); _almost5.setFullYear(_almost5.getFullYear() - 5); _almost5.setDate(_almost5.getDate() + 1);
  // 월/일 경계로 5년 정수가 깨지는 날(말일 등)만 회피하고 실행
  if (_almost5.getDate() !== 1 && _almost5.getMonth() === _today.getMonth()) {
    var _a5Str = _almost5.getFullYear()
      + String(_almost5.getMonth() + 1).padStart(2, '0')
      + String(_almost5.getDate()).padStart(2, '0');
    assertEq('5세 생일 내일 → 아직 4세(11개월, 일자 차감)', calcAgeFromBirth(_a5Str), '4세 11개월');
  }
  // 잘못된 생일(롤오버) → 빈 문자열
  assertEq('잘못된 생일(2월30일) → 빈 문자열', calcAgeFromBirth('20200230'), '');
}

section('회귀: weekDone 세션-일정 1:1 매칭 (madi-dashboard.js)');
if (!weekDoneCount) {
  assert('madi-pure-utils.js weekDoneCount 로드', false);
} else {
  // 같은 날 동일아동 2일정 + 1세션 → done=1 (세션 1건이 일정 2건 채우는 과대평가 방지)
  var _sch2 = [
    { childId: 'c1', date: '2026-06-08' },
    { childId: 'c1', date: '2026-06-08' }
  ];
  assertEq('2일정 + 1세션 → done=1(과대평가 방지)',
    weekDoneCount(_sch2, [{ childId: 'c1', date: '2026-06-08' }]), 1);
  // 같은 날 동일아동 2일정 + 2세션 → done=2 (각 세션이 각 일정 소비)
  assertEq('2일정 + 2세션 → done=2',
    weekDoneCount(_sch2, [
      { childId: 'c1', date: '2026-06-08' },
      { childId: 'c1', date: '2026-06-08' }
    ]), 2);
  // 세션 없음 → done=0
  assertEq('2일정 + 0세션 → done=0', weekDoneCount(_sch2, []), 0);
  // 다른 아동/날짜 세션은 매칭 안 됨
  assertEq('일정과 무관한 세션은 매칭 안 됨',
    weekDoneCount(_sch2, [{ childId: 'c2', date: '2026-06-08' }, { childId: 'c1', date: '2026-06-07' }]), 0);
  // 세션 과잉(2일정 + 3세션) → done=2 (일정 수가 상한)
  assertEq('2일정 + 3세션 → done=2(일정 수 상한)',
    weekDoneCount(_sch2, [
      { childId: 'c1', date: '2026-06-08' },
      { childId: 'c1', date: '2026-06-08' },
      { childId: 'c1', date: '2026-06-08' }
    ]), 2);
}

// ──────────────────────────────────
// 결과 출력
// ──────────────────────────────────
console.log('\n' + '═'.repeat(40));
console.log('테스트 결과: ' + passed + ' 통과 / ' + failed + ' 실패');
if (failed > 0) {
  console.error('❌ 일부 테스트 실패');
  process.exit(1);
} else {
  console.log('✅ 모든 테스트 통과');
  process.exit(0);
}
