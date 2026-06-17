// ─────── 본인 세션 판별 (teacher_id 우선, 레거시는 이름 폴백) ───────
function _isMySession(s) {
  if (!s || !currentUser) return false;
  if (s.teacher_id) return String(s.teacher_id) === String(currentUser.id);
  return !!s.teacher && s.teacher === currentUser.name;
}

// ─────── 세션 저장 ───────
var _sessionSaveBusy = false; // 더블탭 중복 저장 방지
function saveSession(aiNote) {
  if (currentUser && currentUser.role === 'parent') { showToast('⚠️ 세션 기록 권한이 없습니다'); return; }
  var elChild = document.getElementById('sessionChild');
  if (!elChild) return;
  var elDate = document.getElementById('sessionDate');
  if (!elDate) return;
  var elMemo = document.getElementById('sessionMemo');
  if (!elMemo) return;
  var childId = String(elChild.value);
  var date = elDate.value;
  var memo = elMemo.value.trim();
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!date) { showToast('날짜를 선택해주세요.'); return; }
  // 검증 통과 후에만 더블탭 가드 — 연타로 동일 세션이 중복 저장되는 것 차단
  if (_sessionSaveBusy) return;
  _sessionSaveBusy = true;
  setTimeout(function() { _sessionSaveBusy = false; }, 1000);

  var goals = goalRows.filter(function(r) { return r.name; }).map(function(r) {
    return { name: r.name, score: r.score !== '' ? parseFloat(r.score) : null };
  });

  var sessionId = generateClientId();
  var _newSession = { id: sessionId, childId: childId, date: date, teacher: (currentUser && currentUser.name) || '', teacher_id: (currentUser && currentUser.id != null) ? String(currentUser.id) : '', goals: goals, memo: memo, aiNote: aiNote || '', phonemes: getPhonemeSnapshot() };
  sessionDB.push(_newSession);
  // 서버 저장 결과를 받아 토스트를 정직하게 표시 (실패 시 거짓 "✅ 저장 완료" 방지)
  // 단건 upsert — 동시 편집 lost-update 방지(H2)
  var _savePromise = saveOneSession(_newSession);
  // 저장된 날짜를 기억 (소급 입력 시 다음 세션도 같은 날짜로 편의 제공)
  try { localStorage.setItem('madi_last_session_date', date); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  // 화면 갱신·폼 초기화는 즉시(데이터는 메모리+localStorage 에 이미 보존 — 중복/유실 없음)
  renderSessionList();
  renderChildGrid();
  elMemo.value = '';
  goalRows.forEach(function(r) { r.score = ''; });
  renderGoalRows();
  resetPhonemeMatrix();
  updateCloneBtnState(childId);
  // 성공/실패에 따라 안내 분기 — 성공 시에만 ✅·학부모 알림·후속 제안 실행
  _savePromise.then(function(ok) {
    // 실패 시: ❌ 원인별 토스트는 saveSessions 내부에서 표시됨. 거짓 "✅" 를 띄우지 않는 것이 핵심.
    //   데이터는 메모리+localStorage 에 보존되어 연결 회복 시 재동기화되므로 폼은 그대로 비운다(중복 방지).
    if (!ok) return;
    showToast('✅ 세션 저장 완료!');
    vibrate(40);  // UX: 햅틱 피드백
    // 학부모 알림 fanout (fire-and-forget — 실패해도 세션 저장에 영향 없음)
    if (typeof fanoutSessionNotification === 'function') {
      fanoutSessionNotification(sessionDB[sessionDB.length - 1]);
    }
    setTimeout(function() { suggestHomeActivities(sessionId); }, 300);
    setTimeout(function() { showPostSessionBriefing(sessionId); }, 800);
    setTimeout(function() { checkAutoStagnation(childId); }, 1200);
  });
}

function saveSessionAI() {
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var elChild2 = document.getElementById('sessionChild');
  if (!elChild2) return;
  var elDate2 = document.getElementById('sessionDate');
  if (!elDate2) return;
  var elAiInput = document.getElementById('aiInput');
  if (!elAiInput) return;
  var childId = String(elChild2.value);
  var date = elDate2.value;
  var aiText = elAiInput.value.trim();
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!date) { showToast('날짜를 선택해주세요.'); return; }
  if (!aiText) { showToast('세션 내용을 입력해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) { showToast('⚠️ 아동 정보를 찾을 수 없습니다.'); return; }
  var btn = document.getElementById('aiSaveBtn');
  if (!btn) { showToast('⚠️ 페이지를 새로고침 후 다시 시도해주세요'); return; }
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ AI 정리 중...';

  // 진단별 임상 용어 가이드 (madi-vocab.js)
  var _diagGuide = (typeof getClinicalGuideForDiagnosis === 'function')
    ? getClinicalGuideForDiagnosis(child.type) : '';
  var _clinicalGuide = (typeof SLP_PROMPT_CLINICAL_GUIDE !== 'undefined') ? SLP_PROMPT_CLINICAL_GUIDE : '';
  var _phonoGuide = '';
  if (child.type === '조음음운장애' && typeof SLP_PROMPT_PHONO_GUIDE !== 'undefined') {
    _phonoGuide = SLP_PROMPT_PHONO_GUIDE;
  }
  var SYSTEM = '당신은 한국 언어치료 임상 현장의 1급 언어재활사 보조 AI입니다.'
    + ' 치료사의 자유로운 메모를 분석해 JSON으로 정리하세요. 순수 JSON만:'
    + ' {"goals":[{"name":"항목명","score":0-100숫자}],"memo":"세션 핵심 2-3문장","aiNote":"치료사용 전문 메모"}'
    + '\n【aiNote 작성 규칙】'
    + ' - 임상 약어 사용 가능: MLU, SLD, PCC, SR, U-TAP 등.'
    + ' - 진단별 핵심 용어 권장 (있다면 적용).'
    + ' - 회기 구조 표기 권장: "도입-전개-마무리".'
    + ' - 자료/활동명 구체적으로 (예: "그림카드 20장", "Bag-task", "단어 모방 과제").'
    + ' - 조음음운장애 케이스에서 음운 오류가 보고되면 반드시 오류 패턴을 분석 (파열음화/전방화/후방화 등),'
    + '   한 오류에 여러 패턴이 동시 적용되면 모두 나열, 발달적/비발달적 판단까지 포함.'
    + '\n' + _clinicalGuide
    + (_diagGuide ? '\n' + _diagGuide : '')
    + (_phonoGuide ? '\n' + _phonoGuide : '')
    + AI_NAME_RULE;
  var USER = '아동: ' + aliasName() + ' (' + child.age + ', ' + child.type + ')\n목표: ' + ((child.goals || []).join(', ') || '없음') + '\n\n치료사 입력:\n' + aiText;

  // ES5 호환: .finally() 미지원 환경 대응 — 양 분기에서 동일 cleanup
  function _resetAISaveBtn() {
    btn.dataset.busy = '';
    btn.disabled = false;
    btn.textContent = '🤖 AI 정리 후 저장';
  }
  callClaude(SYSTEM, USER, 1200, MODEL_HAIKU)
    .then(function(raw) {
      var p = parseJSON(restoreName(raw, child.name));
      // 후처리: 비표준 용어 자동 치환 (치료사용 → 'clinical')
      var _san = (typeof sanitizeSLPOutput === 'function') ? sanitizeSLPOutput : function(t){ return t; };
      var sessionId = generateClientId();
      var _newSession = {
        id: sessionId, childId: childId, date: date,
        teacher: (currentUser && currentUser.name) || '',
        teacher_id: (currentUser && currentUser.id != null) ? String(currentUser.id) : '',
        goals: p.goals || [],
        memo: _san(p.memo || aiText, 'clinical'),
        aiNote: _san(p.aiNote || '', 'clinical'),
        phonemes: getPhonemeSnapshot()
      };
      sessionDB.push(_newSession);
      saveOneSession(_newSession);  // 단건 upsert (H2)
      // 저장된 날짜를 기억
      try { localStorage.setItem('madi_last_session_date', date); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
      renderSessionList();
      vibrate(40);  // UX: 햅틱 피드백
      // 학부모 알림 fanout (fire-and-forget — 실패해도 세션 저장에 영향 없음)
      if (typeof fanoutSessionNotification === 'function') {
        fanoutSessionNotification(sessionDB[sessionDB.length - 1]);
      }
      resetPhonemeMatrix();
      setTimeout(function() { suggestHomeActivities(sessionId); }, 300);
      setTimeout(function() { showPostSessionBriefing(sessionId); }, 800);
      setTimeout(function() { checkAutoStagnation(childId); }, 1200);
      _resetAISaveBtn();
    })
    .catch(function(err) { if(window.console&&console.warn)console.warn('[madi-07 callClaude]',err&&err.message); showToast('❌ AI 처리 중 오류가 발생했습니다.'); _resetAISaveBtn(); });
}

// ─────── 기능 2: 가정 활동 추천 AI ───────
function suggestHomeActivities(sessionId) {
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var session = sessionDB.find(function(s) { return s.id === sessionId; });
  if (!session) return;
  var child = childDB.find(function(c) { return c.id === session.childId; });
  if (!child) return;

  var resultEl = document.getElementById('lastSessionRec');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="ai-response-box">'
    + '<div class="ai-response-label">⏳ AI가 가정 활동을 추천 중...</div>'
    + '</div>';

  var goalsText = (session.goals || []).map(function(g) { return g.name + (g.score !== null ? ' ' + g.score + '%' : ''); }).join(', ');

  // 달성률 낮은 목표 추출 (60% 미만)
  var weakGoals = (session.goals || []).filter(function(g) {
    return g.score !== null && parseFloat(g.score) < 60;
  }).map(function(g) { return g.name; });

  // 카탈로그 필터 강화: 진단명 + 달성률 낮은 목표 태그 매칭
  var catalogCtx = '';
  if (activityDB.length > 0) {
    var scored = activityDB.map(function(a) {
      var diagOk = !a.diagnosis || a.diagnosis === '전체' || a.diagnosis === child.type;
      if (!diagOk) return null;
      var tagScore = 0;
      if (a.tags && weakGoals.length > 0) {
        weakGoals.forEach(function(g) {
          if (a.tags.indexOf(g) !== -1) tagScore += 2;
        });
      }
      return { a: a, score: tagScore };
    }).filter(Boolean);
    scored.sort(function(x, y) { return y.score - x.score; });
    var matched = scored.slice(0, 15).map(function(x) { return x.a; });
    if (matched.length > 0) {
      catalogCtx = '\n\n[등록된 활동 카탈로그]\n'
        + matched.map(function(a) {
            return '- ' + a.name
              + (a.diagnosis ? ' [' + a.diagnosis + ']' : '')
              + (a.duration ? ' ' + a.duration + '분' : '')
              + ((a.tags && a.tags.length) ? ' #' + (Array.isArray(a.tags) ? a.tags.join(' #') : String(a.tags).replace(/,/g, ' #')) : '');
          }).join('\n')
        + '\n달성률이 낮은 목표와 관련된 활동을 우선 추천하세요. 카탈로그에 없으면 일반 활동도 가능합니다.';
    }
  }

  var NL = String.fromCharCode(10);
  var _parentGuide = (typeof SLP_PROMPT_PARENT_GUIDE !== 'undefined') ? SLP_PROMPT_PARENT_GUIDE : '';
  var SYSTEM = '당신은 한국 언어치료 임상 현장의 베테랑 언어재활사입니다. 오늘 세션 결과를 바탕으로 부모가 집에서 아이와 실천할 수 있는 활동 3가지를 추천하세요.'
    + ' 달성률이 낮은 목표를 보완하는 활동을 우선하고, 각 활동은 5-10분 내 일상에서 바로 쓸 수 있어야 합니다.'
    + ' 순수 JSON만 출력: {"activities":[{"title":"활동명","reason":"이 활동을 추천하는 이유 1문장","steps":"진행 방법 2-3문장","level":"쉬움/보통/어려움","tip":"부모 팁"}]}\n\n'
    + _parentGuide + AI_NAME_RULE;
  var USER = '아동: ' + aliasName() + ' (' + child.age + ', ' + child.type + ')' + NL
    + '오늘 세션 목표: ' + goalsText + NL
    + (weakGoals.length ? '달성률 60% 미만(집중 보완 필요): ' + weakGoals.join(', ') + NL : '')
    + '메모: ' + session.memo
    + catalogCtx;

  callClaude(SYSTEM, USER, 1000, MODEL_HAIKU)
    .then(function(raw) {
      // 학부모 대상 — 자동 치환
      if (typeof sanitizeSLPOutput === 'function') raw = sanitizeSLPOutput(raw, 'parent');
      raw = restoreName(raw, child.name);
      var p = parseJSON(raw);
      var html = '<div class="ai-response-box">'
        + '<div class="ai-response-label">🏠 오늘 세션 기반 가정 활동 추천</div>';
      var levelColor = { '쉬움':'#10b981','보통':'#f59e0b','어려움':'#ef4444' };
      (p.activities || []).forEach(function(a, i) {
        var lc = levelColor[a.level] || '#94a3b8';
        html += '<div style="margin-top:10px;padding:11px 12px;background:white;border-radius:10px;border:1px solid #e2e8f0;">'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">'
          + '<div style="font-weight:700;font-size:13px;color:var(--purple);">'
          + escHtml(String(i + 1)) + '. ' + escHtml(a.title) + '</div>'
          + (a.level ? '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:' + escHtml(lc) + '20;color:' + escHtml(lc) + ';font-weight:700;">' + escHtml(a.level) + '</span>' : '')
          + '</div>'
          + (a.reason ? '<div style="font-size:11px;color:#0ea5a0;margin-bottom:5px;font-weight:600;">✅ ' + escHtml(a.reason) + '</div>' : '')
          + '<div style="font-size:12px;line-height:1.65;color:var(--text);">' + escHtml(a.steps) + '</div>'
          + (a.tip ? '<div style="font-size:11px;line-height:1.5;color:var(--text2);margin-top:5px;font-style:italic;">💡 ' + escHtml(a.tip) + '</div>' : '')
          + '</div>';
      });
      html += '</div>';
      // eslint-disable-next-line no-unsanitized/property
      resultEl.innerHTML = html;
    })
    .catch(function(err) {
      if(window.console&&console.warn)console.warn('[madi-07 suggestHomeActivities]',err&&err.message);
      resultEl.innerHTML = '<div class="ai-response-box"><div class="ai-response-label">⚠️ AI 추천 생성 중 오류가 발생했습니다.</div></div>';
    });
}

// ─────── 세션 목록 ───────
// 카운터 클릭 시 최근 20개 ↔ 전체 토글
var sessionListExpanded = false;
function toggleSessionListExpand() {
  sessionListExpanded = !sessionListExpanded;
  renderSessionList();
}

function renderSessionList() {
  var c = document.getElementById('sessionList');
  if (!c) return;
  // 권한별 필터: admin은 전체, 그 외는 본인 세션만 (teacher 필드 없으면 admin만 노출)
  var visible = sessionDB.slice().reverse();
  if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
    visible = visible.filter(function(s){ return _isMySession(s); });
  }
  // 펼치기 상태에 따라 최근 20개 또는 전체
  var recent = sessionListExpanded ? visible : visible.slice(0, 20);
  // 카드 제목 옆 카운터 갱신 (권한별 라벨 + 표시/전체 개수 + 펼치기 토글)
  var countEl = document.getElementById('sessionListCount');
  if (countEl) {
    var isAdmin   = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    var label     = isAdmin ? '전체' : '본인';
    var canToggle = visible.length > 20;
    var arrow     = canToggle ? (sessionListExpanded ? ' ▲' : ' ▼') : '';
    var sub       = canToggle
      ? (sessionListExpanded ? ' 모두 표시' : ' · 최근 20개')
      : '';
    countEl.textContent = '(' + label + ' ' + visible.length + '개' + sub + arrow + ')';
    if (canToggle) {
      countEl.style.cursor = 'pointer';
      countEl.style.userSelect = 'none';
      countEl.onclick = toggleSessionListExpand;
      countEl.title = sessionListExpanded ? '클릭하여 최근 20개만 보기' : '클릭하여 전체 보기';
    } else {
      countEl.style.cursor = '';
      countEl.onclick = null;
      countEl.title = '';
    }
  }
  if (recent.length === 0) {
    c.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>아직 기록된 세션이 없습니다.</p></div>';
    return;
  }
  var html = '';
  recent.forEach(function(s) {
    var ch = childDB.find(function(c) { return c.id === s.childId; });
    var cName = ch ? ch.name : '알수없음';
    var cColor = ch ? ch.color : '#64748b';

    // 목표 달성도
    var goalHtml = '';
    if (s.goals && s.goals.length > 0) {
      var validGoals = s.goals.filter(function(g){ return g.name; });
      if (validGoals.length > 0) {
        goalHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">';
        validGoals.forEach(function(g) {
          var sc = (g.score !== null && g.score !== undefined && g.score !== '') ? g.score : null;
          var bg = sc === null ? '#f1f5f9' : (sc >= 70 ? '#dcfce7' : sc >= 40 ? '#fef9c3' : '#fee2e2');
          var tc = sc === null ? '#64748b' : (sc >= 70 ? '#16a34a' : sc >= 40 ? '#ca8a04' : '#dc2626');
          goalHtml += '<span style="background:' + bg + ';color:' + tc + ';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">'
            + escHtml(g.name) + (sc !== null ? ' <b>' + sc + '%</b>' : '')
            + '</span>';
        });
        goalHtml += '</div>';
      }
    }

    var safeCColor = escHtml(cColor || '#ccc');
    html += '<div style="background:white;border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border-left:4px solid ' + safeCColor + ';">'
      // 헤더: 아동명 + 날짜 + 버튼
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
      + '<span style="font-size:15px;font-weight:700;color:' + safeCColor + ';">' + escHtml(cName) + '</span>'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<span style="font-size:12px;color:#64748b;">📅 ' + s.date + '</span>'
      + '<button class="btn-ghost" style="padding:7px 10px;font-size:11px;" onclick="editSessionDate(\'' + jsArg(String(s.id)) + '\')">✏️</button>'
      + (canDo('deleteSession') ? '<button class="btn-del" style="padding:7px 12px;font-size:11px;" onclick="deleteSession(\'' + jsArg(String(s.id)) + '\')">삭제</button>' : '')
      + '</div></div>'
      // 목표 달성도
      + goalHtml
      // 음소 데이터 뱃지
      + (s.phonemes && Object.keys(s.phonemes).length > 0
          ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">'
            + Object.keys(s.phonemes).map(function(p) {
                var d = s.phonemes[p];
                var parts = [];
                if (d.initial !== null && d.initial !== undefined) parts.push('초:' + d.initial + '%');
                if (d.medial  !== null && d.medial  !== undefined) parts.push('중:' + d.medial  + '%');
                if (d.final   !== null && d.final   !== undefined) parts.push('말:' + d.final   + '%');
                var avg = parts.length > 0
                  ? Math.round([d.initial, d.medial, d.final].filter(function(v){ return v !== null && v !== undefined; }).reduce(function(a,b){ return a+b; }, 0) / parts.length)
                  : null;
                var col = avg === null ? '#94a3b8' : avg >= 70 ? '#15803d' : avg >= 40 ? '#b45309' : '#dc2626';
                var bg  = avg === null ? '#f1f5f9' : avg >= 70 ? '#f0fdf4' : avg >= 40 ? '#fffbeb' : '#fef2f2';
                return '<span style="font-size:11px;padding:3px 8px;background:' + bg + ';color:' + col + ';border-radius:12px;font-weight:700;">'
                  + '🎯 ' + escHtml(p) + ' ' + parts.join(' / ') + '</span>';
              }).join('')
            + '</div>'
          : '')
      // 메모
      + (s.memo ? '<div style="font-size:13px;color:#334155;margin-top:8px;line-height:1.6;padding:8px 10px;background:#f8fafc;border-radius:8px;">' + escHtml(s.memo) + '</div>' : '')
      // AI 노트
      + (s.aiNote ? '<div style="font-size:12px;color:#7c3aed;margin-top:8px;padding:8px 10px;background:#f5f3ff;border-radius:8px;line-height:1.6;">🤖 ' + escHtml(s.aiNote) + '</div>' : '')
      // 작성자 라벨 (admin이 다른 선생님 세션을 식별할 수 있도록 — admin + teacher 필드 있을 때만)
      + ((currentUser && currentUser.role === 'admin' && s.teacher)
          ? '<div style="font-size:11px;color:#64748b;margin-top:8px;text-align:right;">👤 작성자 <span style="font-weight:700;color:' + escHtml(getTeacherColor(s.teacher)) + ';">' + escHtml(s.teacher) + '</span></div>'
          : '')
      + '</div>';
  });
  // eslint-disable-next-line no-unsanitized/property
  c.innerHTML = html;
}

function editSessionDate(id) {
  var s = sessionDB.find(function(x){ return x.id === id; });
  if (!s) return;
  showInputPrompt({
    title: '세션 날짜 변경',
    label: '날짜를 선택해주세요',
    type: 'date',
    value: s.date,
    okLabel: '저장',
    validate: function(v) {
      if (!v || !v.match(/^\d{4}-\d{2}-\d{2}$/)) return '날짜 형식이 올바르지 않습니다 (예: 2026-04-29)';
      // 거짓 날짜 차단: new Date('2026-02-30') 은 3/2 로 자동 보정되므로 라운드트립 검증
      var p = new Date(v + 'T00:00:00');
      if (isNaN(p.getTime())
          || p.getFullYear() !== parseInt(v.slice(0,4), 10)
          || (p.getMonth() + 1) !== parseInt(v.slice(5,7), 10)
          || p.getDate() !== parseInt(v.slice(8,10), 10)) {
        return '유효하지 않은 날짜입니다';
      }
      return null;
    },
    onOk: function(newDate) {
      s.date = newDate;
      renderSessionList();  // 날짜는 메모리+localStorage 에 이미 반영 — 서버 결과와 무관하게 즉시 갱신
      // 성공 시에만 ✅ — 실패 시 saveOneSession 이 ❌ 토스트를 이미 표시(거짓 성공 방지, 37번 패턴과 동일)
      saveOneSession(s).then(function(ok) { if (ok) showToast('✅ 날짜 수정 완료!'); });
    }
  });
}

// ─────── 삭제 확인 모달 ───────
var _dcmCallback = null;
var _dcmEscHandler = null;
function showDeleteConfirm(title, subtitle, keyword, onConfirm) {
  var dcm = document.getElementById('deleteConfirmModal');
  if (!dcm) return;
  var dcmTitle = document.getElementById('dcmTitle');
  if (!dcmTitle) return;
  var dcmSubtitle = document.getElementById('dcmSubtitle');
  if (!dcmSubtitle) return;
  var dcmKeyword = document.getElementById('dcmKeyword');
  if (!dcmKeyword) return;
  var dcmInput = document.getElementById('dcmInput');
  if (!dcmInput) return;
  var btn = document.getElementById('dcmConfirmBtn');
  if (!btn) return;
  _dcmCallback = onConfirm;
  dcmTitle.textContent = title;
  dcmSubtitle.textContent = subtitle;
  dcmKeyword.textContent = keyword;
  dcmInput.value = '';
  btn.disabled = true;
  btn.style.opacity = '0.4';
  var modal = dcm;
  modal.style.display = 'flex';
  if (_dcmEscHandler) document.removeEventListener('keydown', _dcmEscHandler);
  _dcmEscHandler = function(e) { if (e.key === 'Escape') closeDcmModal(); };
  document.addEventListener('keydown', _dcmEscHandler);
  setTimeout(function(){ dcmInput.focus(); }, 200);
}
function checkDcmInput() {
  var dcmInput = document.getElementById('dcmInput');
  var dcmKeyword = document.getElementById('dcmKeyword');
  var dcmConfirmBtn = document.getElementById('dcmConfirmBtn');
  if (!dcmInput || !dcmKeyword || !dcmConfirmBtn) return;
  var val = dcmInput.value;
  var kw  = dcmKeyword.textContent;
  var match = (val === kw);
  dcmConfirmBtn.disabled = !match;
  dcmConfirmBtn.style.opacity = match ? '1' : '0.4';
}
function closeDcmModal() {
  var m = document.getElementById('deleteConfirmModal');
  if (m) m.style.display = 'none';
  _dcmCallback = null;
  if (_dcmEscHandler) { document.removeEventListener('keydown', _dcmEscHandler); _dcmEscHandler = null; }
}
function executeDcm() {
  if (_dcmCallback) _dcmCallback();
  closeDcmModal();
}

function deleteSession(id) {
  if (!canDo('deleteSession')) {
    showToast('⚠️ 세션 삭제 권한이 없습니다');
    return;
  }
  var backup = sessionDB.find(function(s) { return s.id === id; });
  if (!backup) return;
  showDeleteConfirm(
    '세션 기록을 삭제하시겠습니까?',
    '삭제된 세션은 복구할 수 없습니다.\n' + (backup.date || '') + ' 세션 기록이 삭제됩니다.',
    '세션삭제확인',
    function() {
      supaFetch('madi_sessions?id=eq.' + encodeURIComponent(id) + '&center_id=eq.' + encodeURIComponent(currentUser.center_id), 'DELETE')
        .then(function() {
          // 서버 삭제 성공 시에만 로컬 반영 (실패 시 부활 방지)
          sessionDB = sessionDB.filter(function(s) { return s.id !== id; });
          saveSessions();
          renderSessionList();
          renderChildGrid();
          showToast('🗑️ 세션 삭제됨', {
            undo: function() {
              // undo 전용 raw POST 는 세션 필드를 data(JSONB)로 래핑하지 않아 최상위 컬럼 전송 →
              //   PostgREST 400 → 복원 실패(검사 undo 와 동일 회귀). 표준 저장 경로(saveSessions)로
              //   backup 을 메모리에 되돌린 뒤 통째 재저장해 회귀를 차단한다.
              if (!sessionDB.some(function(s){ return String(s.id) === String(backup.id); })) {
                sessionDB.push(backup);
              }
              renderSessionList();
              renderChildGrid();
              saveSessions().then(function(ok) { if (ok !== false) showToast('↩️ 세션 복원됨'); });
            }
          });
        })
        .catch(function(e) {
          if(window.console&&console.warn)console.warn('[madi-07 deleteSession]',e&&e.message);
          showToast('❌ 세션 삭제 실패 — 다시 시도해주세요');
        });
    }
  );
}

// ─────── 차트 ───────
var devChartObj = null;
function renderChart() {
  var el = document.getElementById('chartChild');
  if (!el) return;
  var childId = String(el.value);
  if (!childId) return;
  var child = childDB.find(function(c) { return c.id === childId; });
  var allSessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });

  // 다운샘플링: 50회 초과 시 평균치로 압축 (성능 + 가독성 향상)
  var sessions = allSessions;
  var isDownsampled = false;
  if (allSessions.length > 50) {
    isDownsampled = true;
    var bucketSize = Math.ceil(allSessions.length / 50);
    sessions = [];
    for (var bi = 0; bi < allSessions.length; bi += bucketSize) {
      var bucket = allSessions.slice(bi, bi + bucketSize);
      // 버킷 안에서 마지막 세션 기준으로 통합 (날짜는 마지막)
      var merged = { date: bucket[bucket.length - 1].date, goals: [] };
      // 목표별로 평균
      var goalSum = {};
      bucket.forEach(function(s) {
        (s.goals || []).forEach(function(g) {
          if (!g.name || g.score === null || g.score === undefined) return;
          if (!goalSum[g.name]) goalSum[g.name] = { sum: 0, count: 0 };
          goalSum[g.name].sum += parseFloat(g.score);
          goalSum[g.name].count++;
        });
      });
      Object.keys(goalSum).forEach(function(name) {
        var cnt = goalSum[name].count;
        merged.goals.push({ name: name, score: cnt > 0 ? Math.round(goalSum[name].sum / cnt) : 0 });
      });
      sessions.push(merged);
    }
  }

  var chartTitle = document.getElementById('chartTitle');
  if (!chartTitle) return;
  chartTitle.textContent = (child ? child.name : '') + ' 발달 추이'
    + (isDownsampled ? ' (' + allSessions.length + '회 → ' + sessions.length + '구간 평균)' : '');

  var goalMap = {};
  sessions.forEach(function(s) {
    (s.goals || []).forEach(function(g) {
      if (!g.name || g.score === null || g.score === undefined) return;
      if (!goalMap[g.name]) goalMap[g.name] = [];
      goalMap[g.name].push({ date: s.date, score: parseFloat(g.score) });
    });
  });

  var labels = sessions.map(function(s) { return s.date ? s.date.slice(5) : ''; });
  var palette = ['#0ea5a0', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
  var datasets = [], gi = 0;
  for (var name in goalMap) {
    var sm = {};
    goalMap[name].forEach(function(p) { sm[p.date] = p.score; });
    datasets.push({
      label: name,
      data: sessions.map(function(s) { return sm[s.date] !== undefined ? sm[s.date] : null; }),
      borderColor: palette[gi % palette.length],
      backgroundColor: palette[gi % palette.length] + '20',
      tension: 0.35, fill: false, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2.5, spanGaps: true
    });
    gi++;
  }

  if (devChartObj) { devChartObj.destroy(); devChartObj = null; }
  var chartCard = document.getElementById('chartCard');
  if (!chartCard) return;
  var wrap = chartCard.querySelector('.chart-wrap');
  if (!wrap) return;
  if (datasets.length === 0 || labels.length < 2) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>세션 데이터가 2회 이상 있어야 차트가 표시됩니다.</p></div>';
  } else {
    wrap.innerHTML = '<canvas id="devChart"></canvas>';
    ensureChart().then(function() {
      var el = document.getElementById('devChart');
      if (!el) return;
      devChartObj = new Chart(el.getContext('2d'), {
        type: 'line', data: { labels: labels, datasets: datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12 } } },
          scales: {
            y: { min: 0, max: 100, ticks: { callback: function(v) { return v + '%'; }, font: { size: 11 } }, grid: { color: '#f1f5f9' } },
            x: { ticks: { font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    }).catch(function(e) {
      if (window.console && console.warn) console.warn('[차트 로드]', e);
      wrap.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>' + escHtml(_userErrMsg(e, '차트 로드')) + '</p></div>';
    });
  }

  var bars = '';
  for (var n in goalMap) {
    var pts = goalMap[n];
    var last = pts[pts.length - 1].score;
    var color = last >= 70 ? '#10b981' : last >= 40 ? '#f59e0b' : '#ef4444';
    bars += '<div class="score-row"><div class="score-label">' + escHtml(n) + '</div>'
      + '<div class="score-bar"><div class="score-fill" style="width:' + escHtml(String(last)) + '%;background:' + escHtml(color) + '"></div></div>'
      + '<div class="score-val" style="color:' + escHtml(color) + '">' + escHtml(String(last)) + '%</div></div>';
  }
  var sb = document.getElementById('scoreBars');
  // eslint-disable-next-line no-unsanitized/property
  if (sb) sb.innerHTML = bars || '<div class="empty"><p>달성도 데이터가 없습니다.</p></div>';

  // 음소 추이 차트 연동
  _selectedPhonemes = null; // 아동 바뀌면 선택 초기화
  renderPhonemeChart(childId);
}

// ─────── 기능 3: 발달 정체 자동 감지 + W7 액션 제안 ───────
var phonemeChartObj = null;
var _phonemePos = 'all'; // 'all' | 'initial' | 'medial' | 'final'
var _selectedPhonemes = null; // null = 전체

function renderPhonemeChart(childId) {
  var card = document.getElementById('phonemeChartCard');
  if (!card) return;

  // 해당 아동 세션 중 음소 데이터 있는 것만
  var sessions = sessionDB
    .filter(function(s) { return s.childId === childId && s.phonemes && Object.keys(s.phonemes).length > 0; })
    .sort(function(a, b) { return (a.date||'').localeCompare(b.date||''); });

  if (sessions.length === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  // 전체 등장 음소 목록 (최신 세션 기준 정렬)
  var allPhonemes = [];
  sessions.forEach(function(s) {
    Object.keys(s.phonemes).forEach(function(p) {
      if (allPhonemes.indexOf(p) === -1) allPhonemes.push(p);
    });
  });
  if (_selectedPhonemes === null) _selectedPhonemes = allPhonemes.slice();

  // 필터 칩 렌더링
  var filterEl = document.getElementById('phonemeChartFilter');
  if (filterEl) {
    // eslint-disable-next-line no-unsanitized/property
    filterEl.innerHTML = allPhonemes.map(function(p) {
      var active = _selectedPhonemes.indexOf(p) > -1;
      return '<span onclick="togglePhonemeFilter(\'' + jsArg(p) + '\')" '
        + 'style="font-size:12px;padding:4px 10px;border-radius:20px;cursor:pointer;font-weight:700;'
        + 'background:' + escHtml(active ? '#db2777' : '#f1f5f9') + ';'
        + 'color:' + escHtml(active ? 'white' : '#94a3b8') + ';'
        + 'border:1.5px solid ' + escHtml(active ? '#db2777' : '#e2e8f0') + ';">' + escHtml(p) + '</span>';
    }).join('');
  }

  // 위치 버튼 상태
  ['All','Init','Med','Fin'].forEach(function(k) {
    var el = document.getElementById('pos' + k);
    if (!el) return;
    var isActive = (k === 'All' && _phonemePos === 'all')
      || (k === 'Init' && _phonemePos === 'initial')
      || (k === 'Med'  && _phonemePos === 'medial')
      || (k === 'Fin'  && _phonemePos === 'final');
    el.style.background = isActive ? '#db2777' : '';
    el.style.color      = isActive ? 'white' : '';
    el.style.borderColor = isActive ? '#db2777' : '';
  });

  // 데이터셋 구성
  var labels = sessions.map(function(s) { return s.date ? s.date.slice(5) : ''; });
  var palette = ['#db2777','#0ea5a0','#8b5cf6','#f59e0b','#3b82f6','#10b981','#ef4444'];
  var posKeys = _phonemePos === 'all'
    ? ['initial','medial','final']
    : [_phonemePos];
  var posLabels = { initial:'어두', medial:'어중', final:'어말' };
  var datasets = [];
  var ci = 0;

  _selectedPhonemes.forEach(function(p) {
    posKeys.forEach(function(pos) {
      var data = sessions.map(function(s) {
        var d = s.phonemes[p];
        if (!d) return null;
        var v = d[pos];
        return (v !== null && v !== undefined && v !== '') ? v : null;
      });
      if (data.every(function(v){ return v === null; })) return;
      var col = palette[ci % palette.length];
      var label = posKeys.length > 1 ? p + ' ' + posLabels[pos] : p;
      datasets.push({
        label: label,
        data: data,
        borderColor: col,
        backgroundColor: col + '22',
        tension: 0.35, fill: false, pointRadius: 5,
        pointHoverRadius: 8, borderWidth: 2.5, spanGaps: true,
        borderDash: pos === 'medial' ? [4,3] : pos === 'final' ? [1,2] : []
      });
      ci++;
    });
  });

  // 차트 그리기
  if (phonemeChartObj) { phonemeChartObj.destroy(); phonemeChartObj = null; }
  var wrap = document.getElementById('phonemeChart_init');
  if (!wrap) return;

  if (datasets.length === 0) {
    wrap.parentNode.innerHTML = '<div class="empty" style="padding:16px;text-align:center;font-size:13px;color:var(--text2);">선택한 음소의 데이터가 없습니다.</div><canvas id="phonemeChart_init"></canvas>';
    return;
  }

  ensureChart().then(function() {
    var wrapEl = document.getElementById('phonemeChart_init');
    if (!wrapEl) return;
    phonemeChartObj = new Chart(wrapEl, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11, family: 'Noto Sans KR' }, boxWidth: 14 } },
          tooltip: { callbacks: {
            label: function(ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y + '%' : '—'); }
          }}
        },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: function(v){ return v + '%'; }, font: { size: 11 } },
               grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }).catch(function(e) {
    if (typeof showError === 'function') showError(e, '차트 로드');
  });

  // 최신 매트릭스 테이블 (가장 최근 세션 기준)
  renderPhonemeMatrixTable(sessions[sessions.length - 1], allPhonemes);
}

function renderPhonemeMatrixTable(session, allPhonemes) {
  var el = document.getElementById('phonemeMatrixTable');
  if (!el || !session.phonemes) return;

  var posLabels = ['어두','어중','어말'];
  var posKeys   = ['initial','medial','final'];

  var html = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px;">최근 세션(' + escHtml(session.date || '') + ') 음소 현황</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<tr style="border-bottom:2px solid var(--border);">'
    + '<th style="padding:6px 8px;text-align:left;color:var(--text2);font-weight:700;width:52px;">음소</th>'
    + posLabels.map(function(l){ return '<th style="padding:6px;text-align:center;color:var(--text2);font-weight:700;">' + l + '</th>'; }).join('')
    + '</tr>';

  allPhonemes.forEach(function(p) {
    var d = session.phonemes[p] || {};
    html += '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 8px;font-size:15px;font-weight:700;color:#db2777;">' + escHtml(p) + '</td>'
      + posKeys.map(function(pos) {
          var v = d[pos];
          var hasVal = v !== null && v !== undefined && v !== '';
          var n = hasVal ? parseInt(v) : null;
          var bg  = !hasVal ? '' : n >= 70 ? '#f0fdf4' : n >= 40 ? '#fffbeb' : '#fef2f2';
          var col = !hasVal ? 'var(--text2)' : n >= 70 ? '#15803d' : n >= 40 ? '#b45309' : '#dc2626';
          return '<td style="padding:7px 4px;text-align:center;background:' + bg + ';font-weight:700;color:' + col + ';">'
            + (hasVal ? n + '%' : '—') + '</td>';
        }).join('')
      + '</tr>';
  });

  html += '</table>';
  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

function togglePhonemeFilter(phoneme) {
  if (!_selectedPhonemes) return;
  var idx = _selectedPhonemes.indexOf(phoneme);
  if (idx > -1) {
    if (_selectedPhonemes.length === 1) return; // 최소 1개
    _selectedPhonemes.splice(idx, 1);
  } else {
    _selectedPhonemes.push(phoneme);
  }
  var childId = String(document.getElementById('chartChild').value);
  if (childId) renderPhonemeChart(childId);
}

function setPhonemePos(pos) {
  _phonemePos = pos;
  var childId = String(document.getElementById('chartChild').value);
  if (childId) renderPhonemeChart(childId);
}

function detectStagnation(btnEl) {
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String(document.getElementById('chartChild').value);
  if (!childId) { showToast('아동을 선택해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  var sessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });

  if (sessions.length < 3) { showToast('최소 3회 세션이 필요합니다.'); return; }

  var resultEl = document.getElementById('stagnationResult');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="stagnation-card"><div class="stagnation-title">⏳ AI 분석 중...</div></div>';

  var sessionLog = sessions.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + ':' + (g.score !== null ? g.score : 'N/A'); }).join(', ');
    return s.date + ' [' + g + ']';
  }).join('\n');

  var NL = String.fromCharCode(10);
  var SYSTEM = '당신은 언어치료 데이터 분석 전문가입니다. 아동의 세션별 목표 달성도 추이를 분석해 정체된 목표를 찾아내고, '
    + '치료 전략 변경이 필요한지 판단하세요. 순수 JSON만 출력하세요:' + NL
    + '{"summary":"전반적 진행 상황 1-2문장","urgency":"low|medium|high",'
    + '"stagnations":[{"goal":"목표명","reason":"정체 판단 이유","suggestion":"새 접근법"}],'
    + '"strengths":["잘되고 있는 점들"],'
    + '"actions":[{"type":"iep|report|activity|schedule","label":"액션 제목(10자 이내)","detail":"치료사에게 구체적 지시 1문장"}]}' + NL
    + 'actions는 정체가 있을 때만 최대 3개, 없으면 빈 배열. urgency는 정체 심각도에 따라 설정.' + AI_NAME_RULE;
  var USER = '아동: ' + aliasName() + ' (' + child.age + ', ' + child.type + ')\n\n세션별 달성도:\n' + sessionLog;

  var stagnBtn = btnEl || document.querySelector('[onclick*="detectStagnation"]');
  if (stagnBtn) { if (stagnBtn.dataset.busy === '1') return; stagnBtn.dataset.busy = '1'; stagnBtn.disabled = true; }

  // ES5 호환: .finally() 미지원 환경 대응
  function _resetStagnBtn() {
    if (stagnBtn) { stagnBtn.dataset.busy = ''; stagnBtn.disabled = false; }
  }
  callClaude(SYSTEM, USER, 1800, getAIModel())
    .then(function(raw) {
      var p = parseJSON(restoreName(raw, child.name));
      renderStagnationResult(p, child.name, childId);
      _resetStagnBtn();
    })
    .catch(function(err) {
      if(window.console&&console.warn)console.warn('[madi-07 checkAutoStagnation]',err&&err.message);
      resultEl.innerHTML = '<div class="stagnation-card"><div class="stagnation-text">⚠️ AI 분석 중 오류가 발생했습니다.</div></div>';
      _resetStagnBtn();
    });
}

function renderStagnationResult(p, childName, childId) {
  var urgencyColor = p.urgency === 'high' ? '#dc2626' : p.urgency === 'medium' ? '#f59e0b' : '#10b981';
  var urgencyLabel = p.urgency === 'high' ? '🔴 즉시 전략 변경 필요' : p.urgency === 'medium' ? '🟡 주의 관찰 필요' : '🟢 양호';

  var html = '<div class="stagnation-card">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
    + '<div class="stagnation-title" style="margin-bottom:0;">📊 AI 정체 분석 결과</div>'
    + '<span style="font-size:11px;font-weight:700;color:' + urgencyColor + ';">' + urgencyLabel + '</span>'
    + '</div>'
    + '<div class="stagnation-text">' + escHtml(p.summary || '') + '</div>';

  if (p.stagnations && p.stagnations.length > 0) {
    html += '<div style="margin-top:10px;font-size:12px;font-weight:700;color:#dc2626;">⚠️ 정체 감지된 목표</div>';
    p.stagnations.forEach(function(s) {
      html += '<div style="margin-top:8px;padding:10px;background:white;border-radius:8px;">'
        + '<div style="font-weight:700;font-size:13px;">' + escHtml(s.goal) + '</div>'
        + '<div style="font-size:12px;color:var(--text2);margin-top:3px;">📍 ' + escHtml(s.reason) + '</div>'
        + '<div style="font-size:12px;color:var(--mint);margin-top:5px;font-weight:600;">💡 ' + escHtml(s.suggestion) + '</div>'
        + '</div>';
    });
  } else {
    html += '<div style="margin-top:10px;padding:10px;background:white;border-radius:8px;font-size:12px;color:var(--green);font-weight:600;">✅ 모든 목표가 정체 없이 진행 중입니다.</div>';
  }

  if (p.strengths && p.strengths.length > 0) {
    html += '<div style="margin-top:10px;font-size:12px;font-weight:700;color:var(--green);">✨ 강점</div>'
      + '<ul style="margin-top:4px;padding-left:18px;font-size:12px;line-height:1.7;">';
    p.strengths.forEach(function(s) { html += '<li>' + escHtml(s) + '</li>'; });
    html += '</ul>';
  }

  // W7 — 액션 카드
  if (p.actions && p.actions.length > 0) {
    html += '<div style="margin-top:14px;padding-top:12px;border-top:1.5px solid #fed7aa;">'
      + '<div style="font-size:12px;font-weight:700;color:#b45309;margin-bottom:10px;">⚡ 지금 할 수 있는 액션</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    p.actions.forEach(function(a) {
      var meta = stagnationActionMeta(a.type, childId);
      html += '<div style="flex:1;min-width:140px;background:white;border-radius:10px;padding:11px 12px;border:1.5px solid ' + escHtml(meta.color) + '20;">'
        + '<div style="font-size:16px;margin-bottom:4px;">' + escHtml(meta.icon) + '</div>'
        + '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:3px;">' + escHtml(a.label) + '</div>'
        + '<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:8px;">' + escHtml(a.detail) + '</div>'
        /* safe: meta.onclick is hardcoded JS in stagnationActionMeta(), not user input; childId is escHtml-sanitized as safeId */
        + '<button class="btn-ghost" style="width:100%;font-size:11px;padding:6px 4px;color:' + escHtml(meta.color) + ';border-color:' + escHtml(meta.color) + '40;" onclick="' + escHtml(meta.onclick) + '">' + escHtml(meta.btnLabel) + '</button>'
        + '</div>';
    });
    html += '</div></div>';
  }

  html += '</div>';
  var stagnEl = document.getElementById('stagnationResult');
  if (!stagnEl) return;
  // eslint-disable-next-line no-unsanitized/property
  stagnEl.innerHTML = html;
}

function stagnationActionMeta(type, childId) {
  var safeId = escHtml(String(childId));
  var map = {
    iep:      { icon: '📋', color: '#8b5cf6', btnLabel: 'IEP 생성하기', onclick: 'switchTab(2);setTimeout(function(){switchReportTab("report");var el=document.getElementById("iepChild");if(el){el.value=' + safeId + ';renderIEPHistory(' + safeId + ');}},300);' },
    report:   { icon: '📨', color: '#0ea5a0', btnLabel: '리포트 작성', onclick: 'switchTab(2);setTimeout(function(){switchReportTab("report");var el=document.getElementById("reportChild");if(el)el.value=' + safeId + ';},300);' },
    activity: { icon: '🎮', color: '#10b981', btnLabel: '활동 카탈로그', onclick: 'switchTab(3);setTimeout(function(){switchPortfolioTab("ai");},200);' },
    schedule: { icon: '📅', color: '#f59e0b', btnLabel: '일정 확인', onclick: 'switchTab(0);' }
  };
  return map[type] || map['activity'];
}

// ─────── 기능 4: 부모 보고서 ───────