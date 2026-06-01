#!/usr/bin/env node
/*
 * check-patterns.js — 재발 버그 패턴 권고 검사 (advisory)
 *
 * 과거에 실제로 터진 버그 클래스를 자동 감지해 경고한다.
 * 기본은 **비차단(exit 0)** — 오탐으로 커밋을 막는 사고를 피한다.
 *   환경변수 CHECK_STRICT=1 이면 발견 시 exit 1(차단)로 전환.
 * 실행: node tools/check-patterns.js   (pre-commit 훅이 자동 호출)
 */
var fs = require('fs');
var path = require('path');
var ROOT = process.cwd();

// [패턴] 파일필터 / 정규식 / 설명 / 권장
var RULES = [
  { name: 'console.log',  files: /^madi-.*\.js$/, re: /\bconsole\.log\s*\(/,
    why: '운영 코드 console.log 금지', fix: 'console.warn/디버그 제거 또는 _reportClientError 사용' },
  { name: 'overscroll',   files: /\.css$/,        re: /overscroll-behavior/,
    why: '안드로이드 스크롤 차단 유발(과거 버그)', fix: 'body 에 overscroll-behavior 금지' },
  { name: 'date-UTC',     files: /^madi-.*\.js$/, re: /toISOString\(\)\s*\.\s*(slice|substring)\s*\(\s*0/,
    why: 'toISOString()(UTC)을 날짜로 사용 → KST 새벽 하루 어긋남', fix: 'ymd(nowKST()) 사용' },
];

var files = fs.readdirSync(ROOT).filter(function (f) {
  return /^madi-.*\.js$/.test(f) || /\.css$/.test(f);
});

var hits = [];
files.forEach(function (file) {
  var lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  RULES.forEach(function (rule) {
    if (!rule.files.test(file)) return;
    for (var i = 0; i < lines.length; i++) {
      if (rule.re.test(lines[i])) hits.push({ file: file, line: i + 1, rule: rule, code: lines[i].trim().slice(0, 80) });
    }
  });
});

if (!hits.length) {
  console.log('[check-patterns] 재발 버그 패턴 없음 ✓');
  process.exit(0);
}

console.log('\n[check-patterns] ⚠️ 재발 버그 패턴 ' + hits.length + '건 (권고):');
hits.forEach(function (h) {
  console.log('  · ' + h.file + ':' + h.line + ' [' + h.rule.name + '] ' + h.rule.why);
  console.log('      ' + h.code + '   → ' + h.rule.fix);
});
process.exit(process.env.CHECK_STRICT === '1' ? 1 : 0);
