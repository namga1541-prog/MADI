#!/usr/bin/env node
/*
 * check-sw-sync.js — SW_LINES(madi-deploy.js) ↔ sw.js 로직 동등성 검사
 * ────────────────────────────────────────────────────────────────────
 * madi-deploy.js 의 폴백 SW(SW_LINES 배열)는 실제 sw.js 를 손으로 복제한 사본이다.
 * 한쪽만 고치면 폴백 경로(폴더 read 실패·Blob 등록 폴백)가 stale 로직을 배포한다 —
 * SCHEMA.md 사본 드리프트와 동일한 종류의 사고. 이 검사가 두 정의의 "동작 로직"이
 * 갈라지면 커밋을 차단한다(캐시명 타임스탬프·주석·따옴표·공백 차이는 무시).
 *
 * tools/ 스크립트는 pre-commit ESLint 대상(^madi-*.js$)이 아니므로 Function 평가 허용.
 */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '..');

function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }

// 1) madi-deploy.js 에서 SW_LINES 배열 리터럴 추출 → SW_BUILD 주입 후 평가 → join
var deploy = read('madi-deploy.js');
// 닫는 ']' 는 줄 시작(\n];)으로 한정 — 배열 내부 문자열의 인라인 ']'(예: SKIP_HOSTS=[...])에서 잘리지 않게.
var m = deploy.match(/var SW_LINES = (\[[\s\S]*?\n\]);/);
if (!m) {
  console.error('[check-sw-sync] ❌ madi-deploy.js 에서 SW_LINES 배열을 찾지 못함');
  process.exit(1);
}
var swLines;
try {
  // SW_BUILD 는 정규화 단계에서 어차피 치환되므로 임의 상수 주입
  swLines = new Function('SW_BUILD', 'return ' + m[1] + ';')('madi-v5-00000000-000000');
} catch (e) {
  console.error('[check-sw-sync] ❌ SW_LINES 평가 실패:', e.message);
  process.exit(1);
}
var fallbackCode = swLines.join('\n');

// 2) 실제 sw.js
var realCode = read('sw.js');

// 3) 정규화 — 캐시명 타임스탬프 치환·주석 제거·따옴표 통일·공백 축약
//   (sw.js·SW_LINES 문자열 리터럴에 '//' 가 없음을 전제 — 둘 다 URL 조각에 // 미포함)
function normalize(s) {
  return s
    .replace(/madi-v5-[0-9]{8}-[0-9]+/g, 'CACHE')  // 캐시명 타임스탬프 차이 무시
    .replace(/\/\*[\s\S]*?\*\//g, ' ')             // 블록 주석 제거
    .replace(/\/\/[^\n]*/g, ' ')                   // 라인 주석 제거
    .replace(/['"]/g, '"')                         // 따옴표 통일
    .replace(/\s+/g, ' ')                          // 공백 축약
    .replace(/\{\s*\}/g, '{}')                     // 주석 제거로 남은 빈 블록 '{ }' → '{}'
    .replace(/\(\s*\)/g, '()')                     // 빈 인자 '( )' → '()'
    .trim();
}

var nFallback = normalize(fallbackCode);
var nReal = normalize(realCode);

if (nFallback !== nReal) {
  var i = 0;
  while (i < nFallback.length && i < nReal.length && nFallback[i] === nReal[i]) i++;
  console.error('\n[check-sw-sync] ❌ SW_LINES(madi-deploy.js) ↔ sw.js 로직 드리프트 감지');
  console.error('  폴백 SW 와 실제 sw.js 의 동작이 갈라졌습니다.');
  console.error('  한쪽만 수정하면 폴백 경로(폴더 read 실패·Blob 등록 폴백)가 stale 로직을 배포합니다.');
  console.error('  → 두 정의를 동일 로직으로 맞춘 뒤 다시 커밋하세요. 첫 불일치 부근:');
  console.error('    sw.js    …' + JSON.stringify(nReal.slice(Math.max(0, i - 50), i + 50)));
  console.error('    SW_LINES …' + JSON.stringify(nFallback.slice(Math.max(0, i - 50), i + 50)));
  process.exit(1);
}
console.log('[check-sw-sync] SW_LINES ↔ sw.js 로직 동등 ✓');
