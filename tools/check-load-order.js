#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// check-load-order.js — index.html 의 <script defer src="madi-*.js"> 로드 순서 계약 검증
//   로드 순서가 암묵적 의존성(전역 함수·상수)을 표현하므로, 순서가 어긋나면 런타임에
//   'undefined is not a function' 으로 깨진다. 그 회귀를 pre-commit 에서 사전 차단한다.
//   (CLAUDE.md: vocab 최상단 / core 가 소비자보다 앞 / pii 가 parent·chat 보다 앞.)
// 사용: node tools/check-load-order.js   (실패 시 exit 1)
// ─────────────────────────────────────────────────────────────
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var HTML = path.join(ROOT, 'index.html');

// 순서 제약: [먼저, 나중] — 먼저가 나중보다 앞서 로드되어야 함.
//   새 의존성이 생기면 여기에 한 줄 추가하면 된다(자기 문서화 계약).
var CONSTRAINTS = [
  ['madi-vocab.js', 'madi-core.js'],   // 어휘 사전: 다른 madi-* 보다 먼저
  ['madi-core.js',  'madi-pii.js'],    // 공통 유틸·상수
  ['madi-core.js',  'madi-app.js'],
  ['madi-pii.js',   'madi-parent.js'], // PII 마스커 SSOT → 소비자보다 앞
  ['madi-pii.js',   'madi-chat.js'],
  ['madi-pii.js',   'madi-ai.js'],
  ['madi-core.js',   'madi-deploy.js'],  // 배포: nowKST/ymd(core) 를 로드시점에 사용
  ['madi-deploy.js', 'madi-system.js']   // system 하단 _cleanupLegacyGithubToken()·PWA SW_CODE 가 deploy 정의에 의존
];

function fail(msg) {
  console.error('\n[BLOCKED] 스크립트 로드 순서 위반 — 커밋 취소.');
  console.error('  ' + msg);
  console.error('  → index.html 의 <script defer src="..."> 순서를 조정하세요.\n');
  process.exit(1);
}

var html;
try { html = fs.readFileSync(HTML, 'utf8'); }
catch (e) { console.error('[check-load-order] index.html 읽기 실패: ' + e.message); process.exit(1); }

// 로드 순서대로 madi-*.js 파일명 추출
var order = [];
var re = /<script[^>]*\bsrc=["']\.?\/?(madi-[\w-]+\.js)["']/g;
var m;
while ((m = re.exec(html)) !== null) order.push(m[1]);

function idx(name) { return order.indexOf(name); }

var violations = 0;
CONSTRAINTS.forEach(function(c) {
  var a = idx(c[0]), b = idx(c[1]);
  if (a === -1 || b === -1) return;  // 해당 파일이 없으면 그 제약은 건너뜀(부분 적용 안전)
  if (a > b) {
    violations++;
    fail("'" + c[0] + "' 가 '" + c[1] + "' 보다 뒤에 로드됨 (앞서야 함).");
  }
});

if (violations === 0) console.log('[check-load-order] 로드 순서 계약 통과 ✓ (' + order.length + '개 madi-*.js)');
process.exit(0);
