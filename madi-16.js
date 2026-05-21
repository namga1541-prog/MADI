// madi-16.js — ⚡ 빠른 기록 모드 (선생님 모바일 우선)
// 진입: 헤더 ⚡ 버튼 → openQuickPanel() → 카드 리스트 → 압축 기록 폼 → 저장 → 다음 카드

// ─────────────────────────────────────────────
// 전역 상태
// ─────────────────────────────────────────────
var _quickRec = null;          // SpeechRecognition 인스턴스
var _quickRecActive = false;   // 받아쓰기 진행 중 여부
var _quickCurrentSchedId = null;  // 현재 폼이 열린 스케줄 id
var _quickPhotoDataUrl = '';   // 사진 dataURL (선택 시)
var _quickNextGoals = [];      // 다음 목표 체크박스 상태 [{name, checked}]

// ─────────────────────────────────────────────
// 진입점: 패널 활성화 + 카드 리스트 렌더
// ─────────────────────────────────────────────
function openQuickPanel() {
  if (!currentUser || currentUser.role !== 'teacher') {
    if (typeof showToast === 'function') showToast('⚠️ 빠른 기록은 선생님 전용입니다');
    return;
  }
  // 모든 메인 패널 숨기기
  if (typeof ALL_PANELS_NEW !== 'undefined') {
    ALL_PANELS_NEW.forEach(function(id) {
      var p = document.getElementById(id);
      if (p) p.classList.remove('active');
    });
  }
  // 서브 패널도 정리
  ['panel1','panel3','panel4','panel5','panel6','panel7'].forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.classList.remove('sub-active');
  });
  // 탭 버튼 active 해제
  for (var i = 0; i < 8; i++) {
    var b = document.getElementById('tabBtn' + i);
    if (b) b.classList.remove('active');
  }
  var hb = document.getElementById('tabBtnHome');
  if (hb) hb.classList.remove('active');
  // panelQuick 활성화
  var tp = document.getElementById('panelQuick');
  if (tp) tp.classList.add('active');
  // 카드 리스트 렌더
  _showQuickCardList();
  renderQuickCards();
}

function _showQuickCardList() {
  var list = document.getElementById('quickCardList');
  var form = document.getElementById('quickFormPanel');
  if (list) list.style.display = '';
  if (form) form.style.display = 'none';
  _quickStopDictation();
}

// ─────────────────────────────────────────────
// 오늘 본인 담당 스케줄 + 기록 매칭
// ─────────────────────────────────────────────
function _quickGetMySchedules() {
  if (typeof getTodayKST !== 'function') return [];
  var today = getTodayKST();
  var myName = (currentUser && currentUser.name) || '';
  var all = (typeof scheduleDB !== 'undefined' && scheduleDB) ? scheduleDB : [];
  return all.filter(function(s) {
    if (!s || s.date !== today) return false;
    var t = s.therapist || s.teacher || '';
    return t === myName;
  }).sort(function(a, b) {
    return String(a.time || '').localeCompare(String(b.time || ''));
  });
}

function _quickFindSession(sched) {
  if (!sched) return null;
  var arr = (typeof sessionDB !== 'undefined' && sessionDB) ? sessionDB : [];
  var myName = (currentUser && currentUser.name) || '';
  for (var i = 0; i < arr.length; i++) {
    var se = arr[i];
    if (!se) continue;
    if (se.childId === sched.childId && se.date === sched.date && (se.teacher || '') === myName) return se;
  }
  return null;
}

function _quickFindChild(childId) {
  var arr = (typeof childDB !== 'undefined' && childDB) ? childDB : [];
  for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === childId) return arr[i];
  return null;
}

// ─────────────────────────────────────────────
// 카드 리스트 렌더
// ─────────────────────────────────────────────
function renderQuickCards() {
  var box = document.getElementById('quickCardList');
  if (!box) return;
  var scheds = _quickGetMySchedules();
  var sub = document.getElementById('quickHeaderSub');
  if (scheds.length === 0) {
    if (sub) sub.textContent = '오늘 본인 담당 수업이 없습니다';
    box.innerHTML =
      '<div class="card" style="text-align:center;padding:36px 16px;">'
      + '<div style="font-size:42px;margin-bottom:10px;">📭</div>'
      + '<div style="font-size:15px;color:var(--text);font-weight:700;">오늘 본인 담당 수업이 없습니다</div>'
      + '<div style="font-size:12px;color:var(--text2);margin-top:6px;">캘린더에서 일정이 본인 이름으로 등록되어 있는지 확인하세요</div>'
      + '</div>';
    return;
  }
  var done = 0, todo = 0;
  scheds.forEach(function(s) { if (_quickFindSession(s)) done++; else todo++; });
  if (sub) sub.textContent = '미기록 ' + todo + '건 · 완료 ' + done + '건 (총 ' + scheds.length + '건)';

  if (todo === 0) {
    box.innerHTML =
      '<div class="card" style="text-align:center;padding:36px 16px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #6ee7b7;">'
      + '<div style="font-size:42px;margin-bottom:10px;">🎉</div>'
      + '<div style="font-size:16px;color:#065f46;font-weight:800;">오늘 수업 다 기록했어요!</div>'
      + '<div style="font-size:12px;color:#047857;margin-top:6px;">총 ' + scheds.length + '건 완료</div>'
      + '</div>'
      + _quickRenderCards(scheds);
    return;
  }
  box.innerHTML = _quickRenderCards(scheds);
}

function _quickRenderCards(scheds) {
  var html = '<div class="quick-card-grid">';
  scheds.forEach(function(s) {
    var ch = _quickFindChild(s.childId);
    var name = ch ? ch.name : ('아동#' + s.childId);
    var age = ch ? (ch.age || '') : '';
    var diag = ch ? (ch.type || '') : '';
    var se = _quickFindSession(s);
    var done = !!se;
    var savedAgo = '';
    if (done && se.id) {
      var ts = parseInt(String(se.id).slice(0, 13));
      if (!isNaN(ts) && ts > 0) savedAgo = _quickTimeAgo(ts);
    }
    html += '<button class="quick-card ' + (done ? 'qc-done' : 'qc-todo') + '" onclick="openQuickForm(' + JSON.stringify(String(s.id)) + ')" type="button">'
      + '<div class="qc-row1">'
      +   '<span class="qc-time">' + escHtml(s.time || '') + '</span>'
      +   (done
            ? '<span class="qc-badge qc-badge-done">✅ 기록됨' + (savedAgo ? ' · ' + escHtml(savedAgo) : '') + '</span>'
            : '<span class="qc-badge qc-badge-todo">미기록</span>')
      + '</div>'
      + '<div class="qc-row2">'
      +   '<span class="qc-name">' + escHtml(name) + '</span>'
      +   (age ? '<span class="qc-meta">' + escHtml(age) + '</span>' : '')
      + '</div>'
      + (diag ? '<div class="qc-row3"><span class="qc-diag">' + escHtml(diag) + '</span></div>' : '')
      + '</button>';
  });
  html += '</div>';
  return html;
}

function _quickTimeAgo(ts) {
  var diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return Math.floor(diff / 60) + '분 전';
  if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
  return Math.floor(diff / 86400) + '일 전';
}

// ─────────────────────────────────────────────
// 압축 기록 폼
// ─────────────────────────────────────────────
function openQuickForm(schedId) {
  var scheds = _quickGetMySchedules();
  var sched = null;
  for (var i = 0; i < scheds.length; i++) {
    if (String(scheds[i].id) === String(schedId)) { sched = scheds[i]; break; }
  }
  if (!sched) { if (typeof showToast === 'function') showToast('⚠️ 수업 정보를 찾을 수 없습니다'); return; }
  _quickCurrentSchedId = String(schedId);
  _quickPhotoDataUrl = '';
  _quickNextGoals = _quickPrefillGoals(sched);

  var ch = _quickFindChild(sched.childId);
  var existing = _quickFindSession(sched);
  var name = ch ? ch.name : ('아동#' + sched.childId);
  var age = ch ? (ch.age || '') : '';
  var diag = ch ? (ch.type || '') : '';

  var list = document.getElementById('quickCardList');
  var form = document.getElementById('quickFormPanel');
  if (list) list.style.display = 'none';
  if (form) {
    form.style.display = '';
    form.innerHTML = _quickFormHtml(sched, name, age, diag, existing);
    _quickRenderNextGoals();
  }
}

function _quickPrefillGoals(sched) {
  // 1) 아동의 현재 목표 (childDB.goals) 우선 로드
  var ch = _quickFindChild(sched.childId);
  var seed = [];
  if (ch && ch.goals && ch.goals.length) {
    ch.goals.slice(0, 5).forEach(function(g) {
      if (g) seed.push({ name: String(g), checked: false });
    });
  }
  // 2) 직전 세션의 nextGoals 가 있으면 머지
  var arr = (typeof sessionDB !== 'undefined' && sessionDB) ? sessionDB : [];
  var prevWithNext = null;
  for (var i = arr.length - 1; i >= 0; i--) {
    var se = arr[i];
    if (se && se.childId === sched.childId && se.nextGoals && se.nextGoals.length) {
      prevWithNext = se; break;
    }
  }
  if (prevWithNext) {
    prevWithNext.nextGoals.forEach(function(g) {
      if (!g) return;
      var nm = typeof g === 'string' ? g : (g.name || '');
      if (!nm) return;
      var exists = false;
      for (var j = 0; j < seed.length; j++) if (seed[j].name === nm) { exists = true; break; }
      if (!exists) seed.push({ name: nm, checked: false });
    });
  }
  return seed;
}

function _quickFormHtml(sched, name, age, diag, existing) {
  var summary = existing ? (existing.summary || existing.memo || '') : '';
  var parentVisible = existing ? !!existing.parentVisible : false;
  var photoUrl = existing ? (existing.photoUrl || '') : '';
  if (photoUrl) _quickPhotoDataUrl = photoUrl;

  return ''
    + '<div class="card quick-form-card">'
    +   '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;">'
    +     '<div>'
    +       '<div style="font-size:18px;font-weight:800;color:var(--text);">🧒 ' + escHtml(name) + (age ? ' <span style="font-size:13px;color:var(--text2);font-weight:600;">(' + escHtml(age) + ')</span>' : '') + '</div>'
    +       '<div style="font-size:12px;color:var(--text2);margin-top:3px;">' + escHtml(sched.date) + ' · ' + escHtml(sched.time || '') + (sched.duration ? ' · ' + escHtml(sched.duration) + '분' : '') + (diag ? ' · ' + escHtml(diag) : '') + '</div>'
    +     '</div>'
    +     '<button type="button" class="btn" onclick="closeQuickForm()" style="padding:7px 12px;font-size:12px;background:var(--card-bg);border:1px solid var(--border);color:var(--text);">✕ 닫기</button>'
    +   '</div>'

    // 받아쓰기 + 한 줄 요약 입력
    +   '<div class="quick-section">'
    +     '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
    +       '<label class="form-label" style="margin:0;">📝 한 줄 요약</label>'
    +       '<div style="display:flex;gap:6px;">'
    +         '<button type="button" id="quickMicBtn" onclick="quickToggleDictation()" class="btn" style="padding:7px 12px;font-size:13px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-weight:700;">🎤 받아쓰기</button>'
    +         '<button type="button" id="quickAiBtn" onclick="quickAiClean()" class="btn" style="padding:7px 12px;font-size:13px;background:#ede9fe;border:1px solid #c4b5fd;color:#5b21b6;font-weight:700;">✨ AI 정리</button>'
    +       '</div>'
    +     '</div>'
    +     '<textarea id="quickSummary" class="form-input" rows="4" placeholder="예) /ㅅ/ 음소 단어 수준 산출 70% · 차례 기다리기 양호 · 다음 시간 문장 수준 진입">' + escHtml(summary) + '</textarea>'
    +     '<div style="font-size:11px;color:var(--text2);margin-top:5px;">🎤 받아쓰기는 한국어로 말한 내용을 자동으로 텍스트로 변환합니다 (Chrome/Edge/Safari)</div>'
    +   '</div>'

    // 사진 첨부
    +   '<div class="quick-section">'
    +     '<label class="form-label">📷 사진 (선택)</label>'
    +     '<div id="quickPhotoBox">' + _quickPhotoHtml() + '</div>'
    +     '<input type="file" id="quickPhotoInput" accept="image/*" onchange="quickPickPhoto(event)" style="display:none;">'
    +   '</div>'

    // 다음 목표 체크박스
    +   '<div class="quick-section">'
    +     '<label class="form-label">✅ 다음 목표</label>'
    +     '<div id="quickGoalsBox"></div>'
    +     '<div style="display:flex;gap:6px;margin-top:8px;">'
    +       '<input type="text" id="quickGoalInput" class="form-input" placeholder="새 목표 추가" style="flex:1;">'
    +       '<button type="button" onclick="quickAddGoal()" class="btn btn-secondary" style="padding:9px 14px;font-size:13px;">+ 추가</button>'
    +     '</div>'
    +   '</div>'

    // 학부모 공개 토글
    +   '<div class="quick-section" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;">'
    +     '<div>'
    +       '<div style="font-size:14px;font-weight:700;color:var(--text);">학부모 공개</div>'
    +       '<div style="font-size:11px;color:var(--text2);margin-top:2px;">기본 비공개. 메모(이번 기록 자체)는 학부모에게 노출되지 않습니다.</div>'
    +     '</div>'
    +     '<label class="switch" style="position:relative;display:inline-block;width:50px;height:28px;">'
    +       '<input type="checkbox" id="quickParentVisible" ' + (parentVisible ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">'
    +       '<span class="slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#cbd5e1;border-radius:14px;transition:.3s;"></span>'
    +     '</label>'
    +   '</div>'

    // 저장 버튼
    +   '<div style="margin-top:18px;display:flex;gap:8px;">'
    +     '<button type="button" class="btn btn-primary" onclick="quickSave()" style="flex:1;padding:14px;font-size:15px;font-weight:800;">💾 저장 → 다음 수업</button>'
    +   '</div>'

    + '</div>';
}

function _quickPhotoHtml() {
  if (_quickPhotoDataUrl) {
    return ''
      + '<div style="position:relative;display:inline-block;border:1px solid var(--border);border-radius:10px;overflow:hidden;">'
      +   '<img src="' + _quickPhotoDataUrl + '" alt="첨부 사진" style="max-width:200px;max-height:160px;display:block;">'
      +   '<button type="button" onclick="quickRemovePhoto()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;border:none;width:24px;height:24px;border-radius:12px;cursor:pointer;font-size:13px;line-height:1;">✕</button>'
      + '</div>';
  }
  return ''
    + '<button type="button" onclick="document.getElementById(\'quickPhotoInput\').click()" class="btn" '
    +   'style="padding:14px;border:1.5px dashed var(--border);background:var(--card-bg);color:var(--text2);width:100%;font-size:13px;">'
    +   '📷 사진 선택 (최대 1장)'
    + '</button>';
}

function _quickRenderNextGoals() {
  var box = document.getElementById('quickGoalsBox');
  if (!box) return;
  if (_quickNextGoals.length === 0) {
    box.innerHTML = '<div style="font-size:12px;color:var(--text2);padding:8px 0;">아직 다음 목표가 없습니다. 아래에서 추가하세요.</div>';
    return;
  }
  var html = '';
  _quickNextGoals.forEach(function(g, i) {
    html += '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-soft,#f1f5f9);">'
      + '<input type="checkbox" ' + (g.checked ? 'checked' : '') + ' onchange="_quickToggleGoal(' + i + ')" style="width:18px;height:18px;cursor:pointer;">'
      + '<span style="flex:1;font-size:14px;color:var(--text);">' + escHtml(g.name) + '</span>'
      + '<button type="button" onclick="_quickRemoveGoal(' + i + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:4px 6px;">✕</button>'
      + '</label>';
  });
  box.innerHTML = html;
}

function _quickToggleGoal(idx) {
  if (_quickNextGoals[idx]) _quickNextGoals[idx].checked = !_quickNextGoals[idx].checked;
  _quickRenderNextGoals();
}
function _quickRemoveGoal(idx) {
  _quickNextGoals.splice(idx, 1);
  _quickRenderNextGoals();
}
function quickAddGoal() {
  var inp = document.getElementById('quickGoalInput');
  if (!inp) return;
  var v = inp.value.trim();
  if (!v) return;
  _quickNextGoals.push({ name: v, checked: false });
  inp.value = '';
  _quickRenderNextGoals();
}

// ─────────────────────────────────────────────
// 사진 선택 / 제거
// ─────────────────────────────────────────────
function quickPickPhoto(ev) {
  var f = ev && ev.target && ev.target.files && ev.target.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('⚠️ 5MB 이하 이미지만 가능합니다');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    _quickPhotoDataUrl = String(e.target.result || '');
    var box = document.getElementById('quickPhotoBox');
    if (box) box.innerHTML = _quickPhotoHtml();
  };
  reader.readAsDataURL(f);
}
function quickRemovePhoto() {
  _quickPhotoDataUrl = '';
  var box = document.getElementById('quickPhotoBox');
  if (box) box.innerHTML = _quickPhotoHtml();
  var inp = document.getElementById('quickPhotoInput');
  if (inp) inp.value = '';
}

// ─────────────────────────────────────────────
// Web Speech API 받아쓰기
// ─────────────────────────────────────────────
function quickToggleDictation() {
  if (_quickRecActive) { _quickStopDictation(); return; }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    if (typeof showToast === 'function') showToast('⚠️ 이 브라우저는 받아쓰기를 지원하지 않습니다 (Chrome/Edge/Safari 권장)');
    return;
  }
  try {
    _quickRec = new SR();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️ 받아쓰기 초기화 실패: ' + (e.message || e));
    return;
  }
  _quickRec.lang = 'ko-KR';
  _quickRec.continuous = true;
  _quickRec.interimResults = true;
  var ta = document.getElementById('quickSummary');
  var baseText = ta ? (ta.value || '') : '';
  var finalAppended = '';

  _quickRec.onresult = function(ev) {
    var interim = '';
    var newFinal = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) newFinal += t;
      else interim += t;
    }
    if (newFinal) finalAppended += newFinal;
    if (ta) {
      var sep = baseText && (baseText.charAt(baseText.length - 1) !== ' ') ? ' ' : '';
      ta.value = baseText + sep + finalAppended + (interim ? (finalAppended ? ' ' : sep) + interim : '');
    }
  };
  _quickRec.onerror = function(ev) {
    if (typeof showToast === 'function') showToast('⚠️ 받아쓰기 오류: ' + (ev.error || ''));
    _quickStopDictation();
  };
  _quickRec.onend = function() {
    if (_quickRecActive) {
      // 연속 모드에서 일부 브라우저가 자동 종료 — 자동 재시작
      try { _quickRec.start(); } catch (e) { _quickStopDictation(); }
    }
  };
  try {
    _quickRec.start();
    _quickRecActive = true;
    var btn = document.getElementById('quickMicBtn');
    if (btn) {
      btn.textContent = '⏹ 중지';
      btn.style.background = '#fee2e2';
      btn.style.borderColor = '#fca5a5';
      btn.style.color = '#991b1b';
    }
    if (typeof showToast === 'function') showToast('🎤 말씀하세요...');
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️ 마이크 권한이 필요합니다');
  }
}

function _quickStopDictation() {
  _quickRecActive = false;
  if (_quickRec) {
    try { _quickRec.stop(); } catch (e) {}
    _quickRec = null;
  }
  var btn = document.getElementById('quickMicBtn');
  if (btn) {
    btn.textContent = '🎤 받아쓰기';
    btn.style.background = '#fef3c7';
    btn.style.borderColor = '#fcd34d';
    btn.style.color = '#92400e';
  }
}

// ─────────────────────────────────────────────
// ✨ AI 한 줄 정리 (수동 실행)
// ─────────────────────────────────────────────
function quickAiClean() {
  if (typeof canDo === 'function' && !canDo('useAI')) {
    showToast('⚠️ AI 기능 사용 권한이 없습니다'); return;
  }
  if (typeof getApiKeyOrAlert === 'function' && !getApiKeyOrAlert()) return;
  var ta = document.getElementById('quickSummary');
  if (!ta) return;
  var raw = (ta.value || '').trim();
  if (!raw) {
    if (typeof showToast === 'function') showToast('먼저 텍스트를 입력하거나 받아쓰기 하세요');
    return;
  }
  if (typeof callClaude !== 'function') {
    if (typeof showToast === 'function') showToast('⚠️ AI 호출 함수가 없습니다');
    return;
  }
  var btn = document.getElementById('quickAiBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 정리 중...'; }
  var SYSTEM = '당신은 한국 언어치료 임상 메모 정리 보조 AI입니다.'
    + ' 치료사의 거친 메모/받아쓰기 텍스트를 받아 학부모/동료가 빠르게 읽을 수 있는 한 줄 임상 요약으로 정리합니다.'
    + ' 출력은 한 줄(60~120자), 임상 약어는 보존(/ㅅ/, MLU 등), 감정 단어·추측 제거,'
    + ' "오늘", "잘했어요" 같은 모호한 표현 대신 구체 행동/수치로 변환.'
    + ' 순수 텍스트만, 따옴표·마크다운 없이.';
  var USER = '원문:\n' + raw;
  callClaude(SYSTEM, USER, 300, (typeof MODEL_HAIKU !== 'undefined') ? MODEL_HAIKU : undefined)
    .then(function(out) {
      var clean = String(out || '').trim().replace(/^["']|["']$/g, '').replace(/\n+/g, ' ').slice(0, 240);
      if (clean) ta.value = clean;
      if (typeof showToast === 'function') showToast('✨ AI 정리 완료');
    })
    .catch(function(e) {
      if (typeof showToast === 'function') showToast('⚠️ AI 정리 실패: ' + (e && e.message ? e.message : e));
    })
    .then(function() {
      if (btn) { btn.disabled = false; btn.textContent = '✨ AI 정리'; }
    });
}

// ─────────────────────────────────────────────
// 저장 → 다음 미기록 카드로
// ─────────────────────────────────────────────
function quickSave() {
  if (!_quickCurrentSchedId) return;
  _quickStopDictation();
  var scheds = _quickGetMySchedules();
  var sched = null;
  for (var i = 0; i < scheds.length; i++) {
    if (String(scheds[i].id) === _quickCurrentSchedId) { sched = scheds[i]; break; }
  }
  if (!sched) { if (typeof showToast === 'function') showToast('⚠️ 수업 정보 없음'); return; }

  var ta = document.getElementById('quickSummary');
  var summary = ta ? ta.value.trim() : '';
  if (!summary) { if (typeof showToast === 'function') showToast('⚠️ 한 줄 요약을 입력하세요'); return; }

  var parentVisible = !!(document.getElementById('quickParentVisible') && document.getElementById('quickParentVisible').checked);
  var nextGoals = _quickNextGoals.filter(function(g) { return g && g.name; }).map(function(g) {
    return { name: g.name, checked: !!g.checked };
  });

  // goals 컬럼은 마디 표준 호환: 체크된 목표만 점수 100, 나머지 점수 null
  var goals = nextGoals.map(function(g) {
    return { name: g.name, score: g.checked ? 100 : null };
  });

  var existing = _quickFindSession(sched);
  var newRow = {
    id: existing ? existing.id : (typeof generateClientId === 'function' ? generateClientId() : Date.now()),
    childId: sched.childId,
    date: sched.date,
    teacher: (currentUser && currentUser.name) || '',
    goals: goals,
    memo: summary,
    aiNote: existing ? (existing.aiNote || '') : '',
    phonemes: existing ? (existing.phonemes || null) : null,
    // 빠른 기록 전용 필드 (jsonb 안)
    quickMode: true,
    summary: summary,
    nextGoals: nextGoals,
    photoUrl: _quickPhotoDataUrl || '',
    parentVisible: parentVisible,
    schedId: sched.id
  };

  // sessionDB 갱신
  if (existing) {
    for (var j = 0; j < sessionDB.length; j++) {
      if (sessionDB[j] && sessionDB[j].id === existing.id) { sessionDB[j] = newRow; break; }
    }
  } else {
    sessionDB.push(newRow);
  }
  if (typeof saveSessions === 'function') saveSessions();
  if (typeof showToast === 'function') showToast('✅ 저장됨');
  if (typeof vibrate === 'function') vibrate(40);

  // 다음 미기록 카드 찾기
  var idx = -1;
  for (var k = 0; k < scheds.length; k++) {
    if (String(scheds[k].id) === _quickCurrentSchedId) { idx = k; break; }
  }
  var next = null;
  for (var m = idx + 1; m < scheds.length; m++) {
    if (!_quickFindSession(scheds[m])) { next = scheds[m]; break; }
  }
  if (!next) {
    // 앞쪽도 검색
    for (var n = 0; n < idx; n++) {
      if (!_quickFindSession(scheds[n])) { next = scheds[n]; break; }
    }
  }
  setTimeout(function() {
    if (next) {
      openQuickForm(String(next.id));
    } else {
      _showQuickCardList();
      renderQuickCards();
    }
  }, 500);
}

function closeQuickForm() {
  _quickCurrentSchedId = null;
  _showQuickCardList();
  renderQuickCards();
}
