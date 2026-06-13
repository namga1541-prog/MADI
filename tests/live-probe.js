#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 라이브 프로브 — 정적 감사가 구조적으로 못 보는 라이브 상태를 읽기 전용 점검
//
// 근거: 2026-06-09 세션 id 정밀도 충돌(HIGH) — 9도메인 정적 감사로는 코드가
//   멀쩡해 절대 못 잡았고, 라이브 데이터를 직접 읽어서만 드러났다.
//   그 프로브 기법(id::text 대조, 타입 민감 필터)을 여기 박제한다.
//
// 사용:
//   MADI_PROBE_USER=<계정> MADI_PROBE_PW=<비밀번호> node tests/live-probe.js
//   자격증명 미설정 시 SKIP 출력 후 exit 0 (공개 레포 — 자격증명 하드코딩 금지).
//
// 불변식: GET 전용. POST/PATCH/DELETE 절대 금지(로그인 POST 제외).
// 출력: ✅(정상) / ⚠️(주의 — MEDIUM/LOW 후보) / ❌(결함 — HIGH 후보)
// 종료코드: ❌ 1건 이상이면 1, 아니면 0.
// ─────────────────────────────────────────────────────────────
var https = require('https');

var BASE = 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1';
var USER = process.env.MADI_PROBE_USER;
var PW   = process.env.MADI_PROBE_PW;

if (!USER || !PW) {
  console.log('SKIP: 자격증명 미설정 (MADI_PROBE_USER / MADI_PROBE_PW) — 라이브 프로브 생략');
  process.exit(0);
}

var pass = 0, warn = 0, fail = 0;
function ok(msg)   { pass++; console.log('  ✅ ' + msg); }
function warnLog(msg) { warn++; console.log('  ⚠️ ' + msg); }
function bad(msg)  { fail++; console.log('  ❌ ' + msg); }

function post(path, body, token) {
  return new Promise(function (resolve, reject) {
    var u = new URL(BASE + path);
    var b = JSON.stringify(body);
    var h = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) };
    if (token) h.Authorization = 'Bearer ' + token;
    var req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: h }, function (rs) {
      var x = '';
      rs.on('data', function (c) { x += c; });
      rs.on('end', function () { resolve({ status: rs.statusCode, body: x }); });
    });
    req.on('error', reject);
    req.write(b);
    req.end();
  });
}
// Edge /api 프록시 경유 읽기 (GET 전용)
function apiGet(path, token) { return post('/api', { path: path, method: 'GET' }, token); }

var CORE_TABLES = ['madi_children', 'madi_sessions', 'madi_schedules', 'madi_assessments', 'madi_iep_history'];

console.log('🔬 라이브 프로브 시작 (' + new Date().toISOString().slice(0, 16) + 'Z, 읽기 전용)');

post('/login', { username: USER, password: PW }).then(function (r) {
  var j; try { j = JSON.parse(r.body); } catch (e) { j = {}; }
  if (r.status !== 200 || !j.token) {
    bad('P1 로그인 실패 (status ' + r.status + ') — 이후 프로브 불가');
    finish(); return null;
  }
  ok('P1 로그인 정상 (role=' + ((j.user && j.user.role) || '?') + ')');
  var t = j.token;

  // P2: 코어 5테이블 도달성 + id::text 캐스팅 동작
  var p2 = Promise.all(CORE_TABLES.map(function (tb) {
    return apiGet(tb + '?select=id::text&limit=1', t).then(function (r) {
      if (r.status === 200) return null;
      return tb + ' → ' + r.status;
    });
  })).then(function (errs) {
    var e = errs.filter(Boolean);
    if (e.length === 0) ok('P2 코어 5테이블 도달 + id::text 캐스팅 정상');
    else bad('P2 코어 테이블 이상: ' + e.join(', '));
  });

  // P3: 세션 id 정밀도 — 최신 20건 표본에서 id::text 고유성(필수) + JS 반올림 잔량(정보)
  var p3 = apiGet('madi_sessions?select=id,id_str:id::text&order=id.desc&limit=20', t).then(function (r) {
    if (r.status !== 200) { warnLog('P3 세션 표본 조회 실패 (' + r.status + ') — 판정 불가'); return; }
    var rows; try { rows = JSON.parse(r.body); } catch (e) { rows = []; }
    if (!rows.length) { ok('P3 세션 0건 — 해당 없음'); return; }
    var txt = {}; var dup = 0, mism = 0;
    rows.forEach(function (x) {
      if (txt[x.id_str]) dup++; txt[x.id_str] = true;
      if (String(x.id) !== x.id_str) mism++;
    });
    if (dup > 0) bad('P3 id::text 표본 내 중복 ' + dup + '건 — DB 자체 무결성 의심(즉시 조사)');
    else ok('P3 세션 id::text 표본 20건 전부 고유');
    if (mism > 0) warnLog('P3 참고: JS number 반올림 표본 ' + mism + '/' + rows.length + '건 — 읽기 경로는 반드시 select=id::text (SCHEMA.md)');
  });

  // P4: SCHEMA.md 박제 사실 회귀 검사 — id 컬럼은 numeric (문자열 필터 400 / text 컬럼 200)
  var p4 = Promise.all([
    apiGet('madi_sessions?id=eq.notanumber&select=id&limit=1', t),
    apiGet('madi_sessions?center_id=eq.__probe__&select=id&limit=1', t)
  ]).then(function (rs) {
    var idNumeric = rs[0].status === 400;
    var centerText = rs[1].status === 200;
    if (idNumeric && centerText) ok('P4 id=numeric · center_id=text — SCHEMA.md 실측 사실 유지');
    else bad('P4 컬럼 타입 변화 의심 (id필터 ' + rs[0].status + ', center_id필터 ' + rs[1].status + ') — SCHEMA.md 재검증 필요');
  });

  // P5: 화이트리스트 테이블 계약 — programs 도달(200) / licenses 게이트(403) or 도달(200)
  var p5 = Promise.all([
    apiGet('madi_programs?select=id&limit=1', t),
    apiGet('madi_licenses?select=*&limit=1', t)
  ]).then(function (rs) {
    if (rs[0].status === 200) ok('P5 madi_programs 도달 정상');
    else bad('P5 madi_programs ' + rs[0].status + ' — 테이블/프록시 계약 깨짐 의심');
    if (rs[1].status === 200) ok('P5 madi_licenses 도달(admin 계정) — SCHEMA.md "존재 미확인" 행을 실측으로 교체할 것');
    else if (rs[1].status === 403) warnLog('P5 madi_licenses 403(권한 게이트) — 존재 여부 미확정, admin 자격증명으로 재실행 권장');
    else bad('P5 madi_licenses ' + rs[1].status + ' — 미존재 의심(라이선스 기능 전체 실패 가능)');
  });

  // P6: 미래날짜 placeholder 세션 잔존 (케어플 임포트 잔재 — 폴링 로드 부하)
  var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  var p6 = apiGet('madi_sessions?data->>date=gte.' + tomorrow + '&select=id::text&limit=1', t).then(function (r) {
    if (r.status !== 200) { warnLog('P6 미래세션 조회 실패 (' + r.status + ')'); return; }
    var rows; try { rows = JSON.parse(r.body); } catch (e) { rows = []; }
    if (rows.length > 0) warnLog('P6 미래날짜 placeholder 세션 존재 — d90 메인 로드에 매번 포함됨(부하). 정리 검토');
    else ok('P6 미래날짜 placeholder 세션 없음');
  });

  // P7: board 댓글 image_url 컬럼 실측 — board_image_columns_fix.sql 운영 적용 여부 확정(보류 #2)
  //   컬럼 존재 시 200, 부재 시 PostgREST 400(column does not exist).
  var p7 = apiGet('madi_lounge_comments?select=image_url&limit=1', t).then(function (r) {
    if (r.status === 200) ok('P7 madi_lounge_comments.image_url 존재 — board_image_columns_fix.sql 적용 확인(보류#2 해소)');
    else if (r.status === 400) bad('P7 image_url 컬럼 부재 — board_image_columns_fix.sql 미적용, 댓글 이미지 저장 실패(MIGRATIONS_RUNBOOK 순서대로 적용 필요)');
    else warnLog('P7 madi_lounge_comments image_url 판정 불가 (' + r.status + ')');
  });

  // P8: totp_last_step 컬럼 실측 — 부재 시 TOTP replay 방지가 조용히 비활성(totp/index.ts:228-240)
  //   madi_users 는 admin-only 테이블이라 admin 자격증명 필요. 200=컬럼 존재, 400=부재.
  var p8 = apiGet('madi_users?select=totp_last_step&limit=1', t).then(function (r) {
    if (r.status === 200) ok('P8 madi_users.totp_last_step 존재 — TOTP replay 방지 활성');
    else if (r.status === 400) warnLog('P8 totp_last_step 컬럼 부재 — TOTP replay 방지 비활성 상태(마이그레이션 적용 권장)');
    else if (r.status === 403) warnLog('P8 madi_users 403 — admin 자격증명으로 재실행해야 totp_last_step 판정 가능');
    else warnLog('P8 totp_last_step 판정 불가 (' + r.status + ')');
  });

  // P9: madi_settings.api_key 평문 키 잔존 확인 — ai-proxy 는 중앙 통합 키만 사용(폴백 제거).
  //   테넌트 읽기 가능 테이블에 평문 sk-ant 키가 남아 있으면 노출면. (oneoff_null_settings_api_key.sql)
  var p9 = apiGet('madi_settings?key=eq.api_key&select=value', t).then(function (r) {
    if (r.status !== 200) { warnLog('P9 madi_settings api_key 판정 불가 (' + r.status + ', admin 자격증명 필요)'); return; }
    var rows; try { rows = JSON.parse(r.body); } catch (e) { rows = []; }
    var v = rows && rows[0] && rows[0].value;
    if (!v) ok('P9 madi_settings.api_key 평문 키 없음(정리 완료 또는 미설정)');
    else bad('P9 madi_settings.api_key 평문 키 잔존 — oneoff_null_settings_api_key.sql 적용 필요(노출면)');
  });

  return Promise.all([p2, p3, p4, p5, p6, p7, p8, p9]).then(finish);
}).catch(function (e) {
  bad('프로브 실행 오류: ' + e.message);
  finish();
});

function finish() {
  console.log('────────────────────────────');
  console.log('라이브 프로브 결과: ✅ ' + pass + ' / ⚠️ ' + warn + ' / ❌ ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}
