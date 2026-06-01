#!/usr/bin/env node
/*
 * deploy-fn.js — Edge Function 배포 래퍼
 *
 * --no-verify-jwt 플래그를 강제로 붙인다. (이 플래그 누락 시 Supabase 미들웨어가
 * 모든 요청을 401 로 차단하는 사고가 반복돼 왔음 — CLAUDE.md 경고 참조.)
 * 사용: npm run deploy:fn -- <function-name>     예) npm run deploy:fn -- login
 */
var cp = require('child_process');
var PROJECT_REF = 'ujxdhafzjyrglaclarwe';

var name = process.argv[2];
if (!name) {
  console.error('사용법: npm run deploy:fn -- <function-name>');
  console.error('  예:   npm run deploy:fn -- login');
  console.error('  배포 가능 함수: supabase/functions/ 하위 디렉토리명');
  process.exit(1);
}

var args = ['supabase', 'functions', 'deploy', name, '--project-ref', PROJECT_REF, '--no-verify-jwt'];
console.log('[deploy:fn] npx ' + args.join(' '));
var r = cp.spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status === 0) {
  console.log('[deploy:fn] ✅ ' + name + ' 배포 완료 — 엔드포인트 직접 호출로 동작 확인 권장');
}
process.exit(r.status == null ? 1 : r.status);
