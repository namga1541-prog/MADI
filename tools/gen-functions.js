#!/usr/bin/env node
/*
 * gen-functions.js — 코드 위치 인덱스(FUNCTIONS.md) 자동 생성
 *
 * 목적: Claude(및 사람)가 grep·전체읽기 없이 "이름 → 파일:라인" 으로 바로 점프.
 *       파일이 커질수록 위치 탐색에 드는 시간·토큰을 줄인다.
 * 내용: ① 전역 변수 정의 위치  ② 파일별 섹션 목차 + 함수 목록
 * 실행: node tools/gen-functions.js   (pre-commit 훅이 자동 호출)
 * 의존: Node 내장 모듈만 (fs, path)
 */
var fs   = require('fs');
var path = require('path');
var ROOT = process.cwd();

var targets = fs.readdirSync(ROOT).filter(function (f) { return /^madi-.*\.js$/.test(f); }).sort();
['index.html', 'admin.html'].forEach(function (h) { if (fs.existsSync(path.join(ROOT, h))) targets.push(h); });

var declRe    = /^\s{0,6}function\s+([A-Za-z0-9_$]+)\s*\(/;       // function name(
var assignRe  = /^\s{0,6}(?:var\s+)?([A-Za-z0-9_$]+)\s*=\s*function\s*\(/; // name = function(
var globalRe  = /^var\s+[A-Za-z0-9_$]/;                            // 최상위(들여쓰기 0) var
var sectionRe = /^\s*\/\/\s*[─=—\-]{2,}\s*(.+?)\s*[─=—\-]{2,}\s*$/; // // ─── 텍스트 ───

var out = [
  '# 코드 위치 인덱스 (자동 생성 — 직접 수정 금지)',
  '',
  '`tools/gen-functions.js` 가 pre-commit 훅에서 생성. 탐색 비용(시간·토큰) 절감용.',
  'Claude 는 여기서 줄번호를 찾아 **해당 줄 ±15줄만 Read** 한다 (전체 통독 금지).',
  '',
];

// ── ① 전역 변수 ──
var globals = [];
targets.forEach(function (file) {
  if (!/\.js$/.test(file)) return;
  var lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (globalRe.test(lines[i])) globals.push({ file: file, line: i + 1, text: lines[i].trim().replace(/\s+/g, ' ').slice(0, 90) });
  }
});
out.push('## 전역 변수 (' + globals.length + ')', '');
globals.forEach(function (g) { out.push('- `' + g.text + '` — ' + g.file + ':' + g.line); });
out.push('');

// ── ② 파일별 섹션 + 함수 ──
var totalFns = 0;
targets.forEach(function (file) {
  var lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  var items = [];
  var seen = {};
  for (var i = 0; i < lines.length; i++) {
    var sm = sectionRe.exec(lines[i]);
    if (sm && sm[1].length <= 40) { items.push({ type: 'sec', line: i + 1, text: sm[1] }); continue; }
    var fm = declRe.exec(lines[i]) || assignRe.exec(lines[i]);
    if (fm) {
      var key = fm[1] + '@' + (i + 1);
      if (seen[key]) continue;
      seen[key] = 1;
      items.push({ type: 'fn', line: i + 1, name: fm[1] });
    }
  }
  var fnCount = items.filter(function (x) { return x.type === 'fn'; }).length;
  if (!fnCount) return;
  totalFns += fnCount;
  out.push('## ' + file + ' (' + fnCount + '함수)');
  items.forEach(function (x) {
    if (x.type === 'sec') out.push('  ▸ _' + x.text + '_ — L' + x.line);
    else out.push('- `' + x.name + '` — ' + file + ':' + x.line);
  });
  out.push('');
});

fs.writeFileSync(path.join(ROOT, 'FUNCTIONS.md'), out.join('\n'));
console.log('[gen-functions] FUNCTIONS.md: ' + targets.length + '파일, 전역 ' + globals.length + '개, 함수 ' + totalFns + '개');
