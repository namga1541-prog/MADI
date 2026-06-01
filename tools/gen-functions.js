#!/usr/bin/env node
/*
 * gen-functions.js — 함수 인덱스(FUNCTIONS.md) 자동 생성
 *
 * 목적: Claude(및 사람)가 grep·전체읽기 없이 "함수명 → 파일:라인" 으로 바로 점프.
 *       파일이 커질수록 위치 탐색에 드는 시간·토큰을 줄인다.
 * 실행: node tools/gen-functions.js   (pre-commit 훅이 자동 호출)
 * 의존: Node 내장 모듈만 (fs, path) — 정적 사이트 원칙상 npm 의존성 추가 금지.
 */
var fs   = require('fs');
var path = require('path');

var ROOT = process.cwd();

// 대상: madi-*.js 전체 + 인라인 스크립트가 큰 두 HTML
var targets = fs.readdirSync(ROOT).filter(function (f) {
  return /^madi-.*\.js$/.test(f);
}).sort();
['index.html', 'admin.html'].forEach(function (h) {
  if (fs.existsSync(path.join(ROOT, h))) targets.push(h);
});

// 함수 선언 패턴 (들여쓰기 0~6칸 — 최상위 + HTML 인라인 스크립트까지, 깊은 중첩 콜백은 제외해 신호 유지)
//  · function name(...)
//  · name = function(...)   /  var name = function(...)
var declRe   = /^\s{0,6}function\s+([A-Za-z0-9_$]+)\s*\(/;
var assignRe = /^\s{0,6}(?:var\s+)?([A-Za-z0-9_$]+)\s*=\s*function\s*\(/;

var out = [
  '# 함수 인덱스 (자동 생성 — 직접 수정 금지)',
  '',
  '`tools/gen-functions.js` 가 pre-commit 훅에서 생성합니다. `함수명 → 파일:라인`.',
  'Claude 가 grep/전체읽기 없이 해당 줄로 바로 점프해 탐색 비용을 줄이기 위한 인덱스입니다.',
  '',
];

var totalFns = 0;
targets.forEach(function (file) {
  var lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  var entries = [];
  var seen = {};
  for (var i = 0; i < lines.length; i++) {
    var m = declRe.exec(lines[i]) || assignRe.exec(lines[i]);
    if (!m) continue;
    var key = m[1] + '@' + (i + 1);
    if (seen[key]) continue;
    seen[key] = 1;
    entries.push({ name: m[1], line: i + 1 });
  }
  if (!entries.length) return;
  totalFns += entries.length;
  out.push('## ' + file + ' (' + entries.length + ')');
  entries.forEach(function (e) {
    out.push('- `' + e.name + '` — ' + file + ':' + e.line);
  });
  out.push('');
});

fs.writeFileSync(path.join(ROOT, 'FUNCTIONS.md'), out.join('\n'));
console.log('[gen-functions] FUNCTIONS.md 생성: ' + targets.length + '개 파일, ' + totalFns + '개 함수');
