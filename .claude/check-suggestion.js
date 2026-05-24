#!/usr/bin/env node
/* Stop hook — 마지막 assistant 응답에 "🔮 추가 개선 제안" 섹션이 있는지 검증.
 * CLAUDE.md 규칙(작업 완료 시 개선 제안 2건+ 첨부) 자동 강제.
 *
 * 입력: stdin 으로 hook payload JSON
 *   { "transcript_path": "...", "stop_hook_active": bool, ... }
 *
 * 동작:
 *   - stop_hook_active=True → 무한 루프 방지, 조용히 종료
 *   - transcript 없음/읽기 실패 → 조용히 종료
 *   - 짧은 응답(<200자) → 강제 안 함 (대화·짧은 답)
 *   - 마지막 assistant 텍스트에 "🔮" 있음 → 확인 메시지
 *   - 없음 → exit 2 + stderr (Claude 가 다음 응답에 반영하도록)
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
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var msg;
    try { msg = JSON.parse(line); } catch (e) { continue; }
    if (msg.type !== 'assistant') continue;
    var content = (msg.message && msg.message.content) || [];
    for (var j = 0; j < content.length; j++) {
      var c = content[j];
      if (c && c.type === 'text' && typeof c.text === 'string') {
        lastText = c.text;
      }
    }
  }

  // 빈 응답·도구 호출만 → 검증 면제
  if (!lastText.trim()) process.exit(0);

  // 짧은 응답(<200자) → 단순 대화로 간주, 강제 안 함
  if (lastText.length < 200) process.exit(0);

  if (lastText.indexOf('🔮') !== -1) {
    process.stdout.write("[제안 검증] ✓ '🔮 추가 개선 제안' 포함\n");
    process.exit(0);
  }

  // 누락 — exit 2 + stderr 로 Claude 에게 알림 (자기 검증 + 다음 응답에 반영)
  process.stderr.write(
    "[제안 검증] ⚠️ '🔮 추가 개선 제안' 섹션이 누락된 것 같습니다. " +
    "CLAUDE.md '작업 완료 시 개선 제안' 규칙 확인 후 응답을 보강하세요.\n"
  );
  process.exit(2);
});

// stdin 이 닫혀있는 환경(직접 호출 등) 대응 — 5초 안에 입력 없으면 그냥 종료
setTimeout(function () { process.exit(0); }, 5000);
