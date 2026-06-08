// ═══════════════════════════════════════════════════════════════════════════
// madi-pii.js — AI 개인정보(PII) 가명화 단일 진실 공급원(SSOT)
//   외부 LLM(Anthropic)으로 아동 실명을 전송하지 않기 위한 다중 아동 인덱스 마스커.
//   기존에 madi-parent.js·madi-chat.js 가 각자 복붙해 표류하던 '아동N' 가명 로직을 하나로 통합.
//   (단일 아동 '○○' 치환은 madi-core.js 의 aliasName()/restoreName() — 별개 용도라 그대로 둠.)
//
//   ⚠️ 로드 순서: madi-core.js 직후 — 이를 호출하는 madi-parent.js·madi-chat.js 보다 앞.
//   ⚠️ 컨벤션: 새 AI 다중 아동 호출부는 반드시 이 마스커를 경유 (복붙 금지 — 보안 불변식 누락 방지).
// ═══════════════════════════════════════════════════════════════════════════

// madiNameMasker([children], [prefix]) → { alias, mask, restore }
//   · seedChildren(선택): {name} 배열을 미리 등록(사전 시딩) — 인덱스 순서로 '<prefix>1'..'<prefix>N'.
//   · prefix(선택)  : 별칭 접두어. 기본 '아동'. 치료사 등 다른 종류는 '치료사' 등으로 분리(별칭 충돌 방지).
//   · alias(name)   : 단일 이름 → 별칭. 미등록이면 즉석 부여(지연 생성, 등장 순서 번호). chat 의 _chatAlias 대체.
//   · mask(text)    : 자유 텍스트 내 등록된 실명 → 별칭. 부분겹침('김민'⊂'김민수') 방지 위해 길이 내림차순.
//   · restore(text) : 자유 텍스트 내 별칭 → 실명. '아동1'⊂'아동10' 접두 충돌 방지 위해 길이 내림차순.
//   양방향 모두 같은 매핑을 공유하므로 mask→LLM→restore 왕복이 정확히 보존된다.
function madiNameMasker(seedChildren, prefix) {
  var realToAlias = {};   // 실명 → 별칭 (mask·복원용 매핑의 정본)
  var aliasToReal = {};   // 별칭 → 실명 (restore 용)
  var n = 0;
  var _prefix = prefix || '아동';

  function _register(name) {
    if (!name) return name;
    var key = String(name);
    if (realToAlias[key]) return realToAlias[key];
    n++;
    var a = _prefix + n;
    realToAlias[key] = a;
    aliasToReal[a] = key;
    return a;
  }

  // 사전 시딩 — childDB 등 고정 목록을 인덱스 순서로 등록(parent 패턴: '아동'+(i+1) 헤더와 정렬).
  if (seedChildren && seedChildren.length) {
    for (var i = 0; i < seedChildren.length; i++) {
      if (seedChildren[i] && seedChildren[i].name) _register(seedChildren[i].name);
    }
  }

  function _maskText(text) {
    if (text == null) return text;
    var s = String(text);
    var names = Object.keys(realToAlias).sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < names.length; i++) s = s.split(names[i]).join(realToAlias[names[i]]);
    return s;
  }

  function _restoreText(text) {
    if (text == null) return text;
    var s = String(text);
    var aliases = Object.keys(aliasToReal).sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < aliases.length; i++) s = s.split(aliases[i]).join(aliasToReal[aliases[i]]);
    return s;
  }

  return { alias: _register, mask: _maskText, restore: _restoreText };
}

// Node(smoke 테스트)·브라우저 양쪽 노출
if (typeof module !== 'undefined' && module.exports) module.exports = { madiNameMasker: madiNameMasker };
