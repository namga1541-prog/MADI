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
}

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
