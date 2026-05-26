#!/usr/bin/env node
/* Stop hook — 응답 품질 검사 (강제 차단 아님, 경고만).
 * CLAUDE.md 규칙: 진짜 발견한 것만, 없으면 섹션 생략 가능 — 억지 강제 금지.
 *
 * 입력: stdin 으로 hook payload JSON
 *   { "transcript_path": "...", "stop_hook_active": bool, ... }
 *
 * 검사 항목:
 *   1. 🔮 추가 개선 제안 포함 여부 (확인 로그)
 *   2. 최근 Edit/Write 도구 호출에서 console.log 잔류 여부 (경고)
 *   3. 최근 Edit/Write 도구 호출에서 TODO / FIXME 잔류 여부 (경고)
 */

var fs = require('fs');

var input = '';
process.stdin.on('data', function (c) { input += c; });
process.stdin.on('end', function () {
  var data;
  try { data = JSON.parse(input || '{}'); } catch (e) { process.exit(0); }

  if (data.stop_hook_active) process.exit(0);

  var tp = data.transcript_path || '';
  if (!tp || !fs.existsSync(tp)) process.exit(0);

  var raw;
  try { raw = fs.readFileSync(tp, 'utf8'); } catch (e) { process.exit(0); }

  var lines = raw.split(/\r?\n/);
  var lastText = '';
  var editedSnippets = [];  // 이번 세션에서 Edit/Write 된 코드 조각

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var msg;
    try { msg = JSON.parse(line); } catch (e) { continue; }

    // assistant 텍스트 — 마지막 것만 유지
    if (msg.type === 'assistant') {
      var content = (msg.message && msg.message.content) || [];
      for (var j = 0; j < content.length; j++) {
        var c = content[j];
        if (c && c.type === 'text' && typeof c.text === 'string') {
          lastText = c.text;
        }
        // Edit/Write 도구 호출에서 new_string / content 추출
        if (c && c.type === 'tool_use' && (c.name === 'Edit' || c.name === 'Write')) {
          var inp = c.input || {};
          var snippet = inp.new_string || inp.content || '';
          if (snippet) editedSnippets.push({ file: inp.file_path || '?', code: snippet });
        }
      }
    }
  }

  // 빈 응답·도구 호출만 → 검증 면제
  if (!lastText.trim()) process.exit(0);

  // 짧은 응답(<200자) → 단순 대화로 간주
  if (lastText.length < 200) process.exit(0);

  // ── 검사 1: 🔮 개선 제안 ──────────────────────────────────────
  if (lastText.indexOf('🔮') !== -1) {
    process.stdout.write("[품질 검사] ✓ '🔮 추가 개선 제안' 포함\n");
  }

  // ── 검사 2: console.log 잔류 ───────────────────────────────────
  var consoleFiles = [];
  for (var k = 0; k < editedSnippets.length; k++) {
    var s = editedSnippets[k];
    // madi-*.js / index.ts 파일에서만 검사 (설정 파일·테스트 제외)
    if (!/madi.*\.(js|ts)$|index\.ts$/.test(s.file)) continue;
    if (/console\.(log|warn|error|info|debug)\s*\(/.test(s.code)) {
      consoleFiles.push(s.file.split(/[/\\]/).pop());
    }
  }
  if (consoleFiles.length > 0) {
    var uniqueConsole = consoleFiles.filter(function(v, i, a){ return a.indexOf(v) === i; });
    process.stdout.write(
      '[품질 검사] ⚠️  console.log 잔류 가능성: ' +
      uniqueConsole.join(', ') +
      ' — 운영 코드 console.log 금지 (CLAUDE.md)\n'
    );
  }

  // ── 검사 3: TODO / FIXME 잔류 ─────────────────────────────────
  var todoFiles = [];
  for (var m = 0; m < editedSnippets.length; m++) {
    var t = editedSnippets[m];
    if (!/madi.*\.(js|ts)$|index\.ts$/.test(t.file)) continue;
    if (/\/\/\s*(TODO|FIXME|HACK|XXX)\b/.test(t.code)) {
      todoFiles.push(t.file.split(/[/\\]/).pop());
    }
  }
  if (todoFiles.length > 0) {
    var uniqueTodo = todoFiles.filter(function(v, i, a){ return a.indexOf(v) === i; });
    process.stdout.write(
      '[품질 검사] ⚠️  TODO/FIXME 잔류: ' +
      uniqueTodo.join(', ') +
      ' — 미완성 항목 확인 필요\n'
    );
  }

  process.exit(0);
});

// stdin 이 닫혀있는 환경(직접 호출 등) 대응 — 5초 안에 입력 없으면 그냥 종료
setTimeout(function () { process.exit(0); }, 5000);
