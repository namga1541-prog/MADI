#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 스키마 사본 드리프트 검사 — SCHEMA.md 가 유일 정본
//
// 근거: 2026-06-10 전수감사 — AGENTS.md 공통 컨텍스트 블록과
//   .claude/workflows/madi-full-audit.js 브리핑의 손사본 컬럼 표가
//   정본과 갈라져(actor_name/record_id/madi_users.status 오기)
//   감사 에이전트 오탐을 유발. 손으로 관리되는 사본은 반드시 썩는다.
//
// 검출: 문서/브리핑 파일에서 "madi_테이블 : col, col, col," 류
//   컬럼 나열 라인(테이블명 뒤 콤마 구분 토큰 3개 이상).
//   발견 시 차단 — 표를 지우고 "SCHEMA.md 참조" 로 교체해야 한다.
// ─────────────────────────────────────────────────────────────
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

// 검사 대상: 루트 *.md + .claude/ 의 md/js (브리핑·워크플로)
var targets = [];
fs.readdirSync(ROOT).forEach(function (f) {
  if (/\.md$/i.test(f)) targets.push(f);
});
['.claude', path.join('.claude', 'workflows'), path.join('.claude', 'skills')].forEach(function (d) {
  var dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (f) {
    var full = path.join(dir, f);
    if (fs.statSync(full).isFile() && /\.(md|js)$/i.test(f)) targets.push(path.join(d, f));
  });
});

// 제외: 정본(SCHEMA.md), 자동생성 인덱스, 과거 인계문서(역사 기록), 이 스크립트 자신
var EXCLUDE = /^(SCHEMA\.md|FUNCTIONS\.md|마디_인계문서.*\.md)$/;

// 패턴: madi_테이블명 다음에 구분자(:|)와 콤마 구분 컬럼형 토큰 3개 이상
var PAT = /madi_[a-z_]+\s*[:|].*?[a-z_]{2,}\s*,\s*[a-z_]{2,}\s*,\s*[a-z_]{2,}\s*,/;

var hits = [];
targets.forEach(function (rel) {
  if (EXCLUDE.test(path.basename(rel))) return;
  var lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  lines.forEach(function (line, i) {
    if (PAT.test(line)) hits.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
  });
});

if (hits.length) {
  console.error('[check-schema-drift] ❌ SCHEMA.md 외 문서에서 컬럼 나열 사본 감지 (' + hits.length + '건):');
  hits.forEach(function (h) { console.error('   ' + h); });
  console.error('   → 사본 표를 삭제하고 "정본은 SCHEMA.md 참조" 로 교체하세요. 사본은 드리프트로 썩습니다.');
  process.exit(1);
}
console.log('[check-schema-drift] 스키마 사본 드리프트 없음 ✓');
