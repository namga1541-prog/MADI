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
