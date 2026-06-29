// ─────────────────────────────────────────────────────────────
// 인라인 script 구문 검사 + 리터럴 라인구분자(U+2028 / U+2029) 차단
//   ESLint 는 madi-*.js 만 검사해 admin/index.html 인라인 스크립트는 무검사였던 게이트 공백 보완.
//   재발 방지(2026-06-29): admin.html escJs 의 정규식에 U+2028 코드포인트가 raw 로 들어가
//   script 블록 전체가 SyntaxError -> 서비스관리 페이지 전 기능 먹통.
//   JS 는 U+2028 / U+2029 를 줄바꿈으로 취급하므로 소스 내 raw 사용은 항상 위험 — 코드포인트로만 다룬다.
// ─────────────────────────────────────────────────────────────
var fs = require('fs'), vm = require('vm'), path = require('path');
var root = path.resolve(__dirname, '..');
var targets = ['index.html', 'admin.html'];
var LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
var failed = 0;

targets.forEach(function (rel) {
  var p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  var html = fs.readFileSync(p, 'utf8');

  var lines = html.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(LS) !== -1 || lines[i].indexOf(PS) !== -1) {
      console.error('[check-inline-scripts] ' + rel + ':' + (i + 1) + ' 리터럴 U+2028/U+2029(라인구분자) 발견 - 이스케이프 시퀀스로 교체하세요.');
      failed++;
    }
  }

  var re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, m;
  while ((m = re.exec(html))) {
    var startLine = html.slice(0, m.index).split('\n').length;
    try { new vm.Script(m[1]); }
    catch (e) {
      console.error('[check-inline-scripts] ' + rel + ' ~L' + startLine + ' 인라인 script 구문 오류: ' + e.message);
      failed++;
    }
  }
});

if (failed) { console.error('[check-inline-scripts] ' + failed + '건 - 커밋 차단'); process.exit(1); }
console.log('[check-inline-scripts] 인라인 스크립트 구문/문자 검사 통과 ✓');
