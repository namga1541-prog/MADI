var inputMode = 0;
function setInputMode(m) {
  inputMode = m;
  document.getElementById('modeBtn0').classList[m === 0 ? 'add' : 'remove']('active');
  document.getElementById('modeBtn1').classList[m === 1 ? 'add' : 'remove']('active');
  document.getElementById('directMode').style.display = m === 0 ? 'block' : 'none';
  document.getElementById('aiMode').style.display = m === 1 ? 'block' : 'none';
}

// ─────── 음성 입력 ───────
var recognition = null, isRecording = false;
function toggleVoiceInput() {
  var btn = document.getElementById('voiceBtn');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome 권장)');
    return;
  }

  if (isRecording) {
    if (recognition) recognition.stop();
    return;
  }

  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = function() {
    isRecording = true;
    btn.classList.add('recording');
    btn.textContent = '🔴 녹음 중... (탭하면 종료)';
  };
  recognition.onresult = function(ev) {
    var area = document.getElementById('aiInput');
    var newText = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      newText += ev.results[i][0].transcript + ' ';
    }
    area.value = (area.value + ' ' + newText).trim();
  };
  recognition.onerror = function(ev) {
    showToast('음성 인식 오류: ' + ev.error);
    isRecording = false;
    btn.classList.remove('recording');
    btn.textContent = '🎤 음성 입력 시작';
  };
  recognition.onend = function() {
    isRecording = false;
    btn.classList.remove('recording');
    btn.textContent = '🎤 음성 입력 시작';
  };

  recognition.start();
}

// ─────── 목표 입력 행 ───────
var goalRows = [];
function loadGoalRows(childId) {
  var child = childDB.find(function(c) { return c.id === childId; });
  goalRows = [];
  if (child && child.goals && child.goals.length > 0) {
    child.goals.forEach(function(g) { goalRows.push({ name: g, score: '' }); });
  } else {
    goalRows = [{ name: '', score: '' }];
  }
  renderGoalRows();
  updateCloneBtnState(childId);
}

function updateCloneBtnState(childId) {
  var btn = document.getElementById('cloneLastBtn');
  if (!btn) return;
  var last = getLastSessionForChild(childId);
  if (last && last.goals && last.goals.length > 0) {
    btn.disabled = false;
    btn.title = '지난 세션(' + last.date + ')의 목표 ' + last.goals.length + '개 불러오기';
  } else {
    btn.disabled = true;
    btn.title = '지난 세션이 없습니다';
  }
}

function getLastSessionForChild(childId) {
  if (!childId) return null;
  var ss = sessionDB.filter(function(s) { return s.childId === childId; });
  if (ss.length === 0) return null;
  // 날짜 내림차순 → 같은 날이면 id 큰 순
  ss.sort(function(a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.id || 0) - (a.id || 0);
  });
  return ss[0];
}

// ─────── 음소 오류 매트릭스 ───────
var phonemeData = {}; // { 'ㅅ': {initial:70, medial:40, final:30}, ... }

var COMMON_PHONEMES = ['ㅅ','ㄹ','ㄷ','ㄴ','ㅈ','ㅊ','ㅆ','ㅉ','ㅎ','ㄱ','ㅋ','ㅌ','ㅍ','ㅂ'];

function initPhonemeChips() {
  var el = document.getElementById('phonemeChips');
  if (!el) return;
  el.innerHTML = COMMON_PHONEMES.map(function(p) {
    return '<span class="phoneme-chip' + (phonemeData[p] ? ' added' : '') + '" '
      + 'id="chip_' + p + '" onclick="addPhonemeRow(\'' + p + '\')">' + p + '</span>';
  }).join('');
}

function togglePhonemeMatrix() {
  var matrix = document.getElementById('phonemeMatrix');
  var btn    = document.getElementById('phonemeToggleBtn');
  if (!matrix) return;
  var isOpen = matrix.style.display !== 'none';
  matrix.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '🎯 조음 데이터 입력' : '🎯 조음 데이터 닫기';
  btn.style.background = isOpen ? '#fff0f6' : '#db2777';
  btn.style.color      = isOpen ? '#db2777' : 'white';
  if (!isOpen) initPhonemeChips();
  updatePhonemeCount();
}

function addPhonemeRow(phoneme) {
  if (!phoneme) return;
  phoneme = phoneme.trim();
  if (!phoneme) return;

  // 이미 있으면 스킵
  if (document.getElementById('pr_' + phoneme)) {
    showToast(phoneme + ' 은(는) 이미 추가되어 있습니다.');
    return;
  }

  if (!phonemeData[phoneme]) phonemeData[phoneme] = { initial: '', medial: '', final: '' };

  var row = document.createElement('div');
  row.className = 'phoneme-row';
  row.id = 'pr_' + phoneme;

  var NL = String.fromCharCode(10);
  row.innerHTML = '<div class="phoneme-label">' + escHtml(phoneme) + '</div>'
    + makePhonemeCell(phoneme, 'initial')
    + makePhonemeCell(phoneme, 'medial')
    + makePhonemeCell(phoneme, 'final')
    + '<button onclick="removePhonemeRow(\'' + phoneme + '\')" '
    + 'style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:0;line-height:1;">×</button>';

  document.getElementById('phonemeRows').appendChild(row);

  // 칩 비활성화
  var chip = document.getElementById('chip_' + phoneme);
  if (chip) chip.classList.add('added');

  updatePhonemeCount();
}

function makePhonemeCell(phoneme, pos) {
  var val = (phonemeData[phoneme] || {})[pos];
  return '<input class="phoneme-input' + getPhonemeClass(val) + '" '
    + 'type="number" min="0" max="100" placeholder="—" '
    + 'value="' + (val !== '' && val !== null && val !== undefined ? val : '') + '" '
    + 'oninput="onPhonemeInput(this,\'' + phoneme + '\',\'' + pos + '\')">';
}

function getPhonemeClass(val) {
  if (val === '' || val === null || val === undefined) return '';
  var n = parseInt(val);
  if (isNaN(n)) return '';
  if (n >= 70) return ' filled-good';
  if (n >= 40) return ' filled-mid';
  return ' filled-bad';
}

function onPhonemeInput(el, phoneme, pos) {
  var val = el.value.trim();
  var n = val !== '' ? parseInt(val) : '';
  if (!phonemeData[phoneme]) phonemeData[phoneme] = {};
  phonemeData[phoneme][pos] = n;
  // 색상 즉시 반영
  el.className = 'phoneme-input' + getPhonemeClass(n);
  updatePhonemeCount();
}

function removePhonemeRow(phoneme) {
  var row = document.getElementById('pr_' + phoneme);
  if (row) row.remove();
  delete phonemeData[phoneme];
  var chip = document.getElementById('chip_' + phoneme);
  if (chip) chip.classList.remove('added');
  updatePhonemeCount();
}

function updatePhonemeCount() {
  var keys = Object.keys(phonemeData).filter(function(k) {
    var d = phonemeData[k];
    return d.initial !== '' || d.medial !== '' || d.final !== '';
  });
  var el = document.getElementById('phonemeCount');
  if (!el) return;
  if (keys.length > 0) {
    el.textContent = '측정 음소 ' + keys.length + '개';
    el.style.display = 'inline';
  } else {
    el.style.display = 'none';
  }
}

function getPhonemeSnapshot() {
  // 저장 시 사용할 스냅샷 (값 있는 음소만)
  var result = {};
  Object.keys(phonemeData).forEach(function(k) {
    var d = phonemeData[k];
    if (d.initial !== '' || d.medial !== '' || d.final !== '') {
      result[k] = {
        initial: d.initial !== '' ? parseInt(d.initial) : null,
        medial:  d.medial  !== '' ? parseInt(d.medial)  : null,
        final:   d.final   !== '' ? parseInt(d.final)   : null
      };
    }
  });
  return Object.keys(result).length > 0 ? result : null;
}

function resetPhonemeMatrix() {
  phonemeData = {};
  var rows = document.getElementById('phonemeRows');
  if (rows) rows.innerHTML = '';
  // 칩 초기화
  COMMON_PHONEMES.forEach(function(p) {
    var chip = document.getElementById('chip_' + p);
    if (chip) chip.classList.remove('added');
  });
  updatePhonemeCount();
  // 매트릭스 닫기
  var matrix = document.getElementById('phonemeMatrix');
  var btn    = document.getElementById('phonemeToggleBtn');
  if (matrix) matrix.style.display = 'none';
  if (btn) { btn.textContent = '🎯 조음 데이터 입력'; btn.style.background = '#fff0f6'; btn.style.color = '#db2777'; }
}

function cloneLastSession() {
  var sel = document.getElementById('sessionChild');
  if (!sel || !sel.value) { showToast('아동을 먼저 선택해주세요.'); return; }
  var childId = parseInt(sel.value);
  var last = getLastSessionForChild(childId);
  if (!last || !last.goals || last.goals.length === 0) {
    showToast('지난 세션이 없습니다.');
    return;
  }
  // 목표 이름만 복사, 점수는 빈 칸
  goalRows = last.goals
    .filter(function(g) { return g.name; })
    .map(function(g) { return { name: g.name, score: '' }; });
  if (goalRows.length === 0) goalRows = [{ name: '', score: '' }];
  renderGoalRows();

  // 음소 구조 복제 — 지난 세션에 음소 데이터 있으면 행 구조만 복원 (점수 빈칸)
  if (last.phonemes && Object.keys(last.phonemes).length > 0) {
    resetPhonemeMatrix();
    // 매트릭스 열기
    var matrix = document.getElementById('phonemeMatrix');
    var btn    = document.getElementById('phonemeToggleBtn');
    if (matrix) matrix.style.display = 'block';
    if (btn) { btn.textContent = '🎯 조음 데이터 닫기'; btn.style.background = '#db2777'; btn.style.color = 'white'; }
    initPhonemeChips();
    // 지난 세션 음소 행 추가 (점수는 빈칸)
    Object.keys(last.phonemes).forEach(function(p) {
      phonemeData[p] = { initial: '', medial: '', final: '' };
      addPhonemeRow(p);
    });
    showToast('↻ 목표 ' + goalRows.length + '개 + 음소 ' + Object.keys(last.phonemes).length + '개 복제됨');
  } else {
    showToast('↻ 지난 세션 목표 ' + goalRows.length + '개 불러옴 (' + last.date + ')');
  }
}
function renderGoalRows() {
  var c = document.getElementById('goalInputList');
  var html = '';
  goalRows.forEach(function(row, i) {
    html += '<div class="goal-input-row">'
      + '<input class="goal-name-input" type="text" placeholder="목표 항목" value="' + escHtml(row.name) + '" oninput="goalRows[' + i + '].name=this.value">'
      + '<input class="goal-score-input" type="number" min="0" max="100" placeholder="%" value="' + (row.score !== '' ? row.score : '') + '" oninput="goalRows[' + i + '].score=this.value">'
      + '<span style="font-size:11px;color:#94a3b8">%</span>'
      + '<button onclick="removeGoalRow(' + i + ')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:0 4px;">×</button>'
      + '</div>';
  });
  c.innerHTML = html;
}
function addGoalRow() { goalRows.push({ name: '', score: '' }); renderGoalRows(); }
function removeGoalRow(i) {
  if (goalRows.length <= 1) { showToast('최소 1개 항목은 필요합니다.'); return; }
  goalRows.splice(i, 1);
  renderGoalRows();
}

function addRecommendedGoal(goalText) {
  var input = document.getElementById('childGoals');
  var cur = input.value.trim();
  input.value = cur ? cur + ', ' + goalText : goalText;
  showToast('✅ "' + goalText + '" 추가됨');
}

// ─────── 아동 등록 ───────
var _addChildLock = false;

// 치료 기간 계산 헬퍼
function getTreatDuration(startDate) {
  if (!startDate) return '';
  var start = new Date(startDate);
  var today = new Date();
  var diffMs = today - start;
  if (diffMs < 0) return '';
  var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  var months = Math.floor(diffDays / 30);
  var days   = diffDays % 30;
  if (months > 0) return '치료 ' + months + '개월 ' + days + '일째';
  return '치료 ' + diffDays + '일째';
}

// 종결 아동 전용: 시작일 → 종결일 사이 총 치료기간 계산
function getClosedDuration(startDate, closedAt) {
  if (!startDate || !closedAt) return '';
  var start = new Date(startDate);
  var end   = new Date(closedAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
  var diffMs = end - start;
  if (diffMs < 0) return '';
  var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  var months = Math.floor(diffDays / 30);
  var days   = diffDays % 30;
  if (months > 0) return '총 ' + months + '개월 ' + days + '일';
  return '총 ' + diffDays + '일';
}

// 이번 달 사용 바우처 횟수 계산
function getVoucherUsed(childId) {
  var now = new Date();
  var ym  = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  return sessionDB.filter(function(s) {
    return s.childId === childId && s.date && s.date.slice(0, 7) === ym;
  }).length;
}

function deleteChild(id) {
  var c = childDB.find(function(c) { return c.id === id; });
  if (!c) return;
  if (!confirm(c.name + ' 정보와 모든 세션·일정을 삭제할까요?')) return;
  // Supabase 삭제
  supaFetch('madi_children?id=eq.' + id, 'DELETE');
  var sessIds = sessionDB.filter(function(s){ return s.childId === id; }).map(function(s){ return s.id; });
  if (sessIds.length > 0) supaFetch('madi_sessions?id=in.(' + sessIds.join(',') + ')', 'DELETE');
  var schedIds = scheduleDB.filter(function(s){ return s.childId === id; }).map(function(s){ return s.id; });
  if (schedIds.length > 0) supaFetch('madi_schedules?id=in.(' + schedIds.join(',') + ')', 'DELETE');
  // 로컬 삭제
  childDB    = childDB.filter(function(c) { return c.id !== id; });
  sessionDB  = sessionDB.filter(function(s) { return s.childId !== id; });
  scheduleDB = scheduleDB.filter(function(s) { return s.childId !== id; });
  saveChildren(); saveSessions(); saveSchedule();
  renderChildGrid();
  showToast('🗑️ 삭제 완료 (세션·일정 포함)');
}

// 아동 종결 처리
function closeChild(id) {
  var c = childDB.find(function(c) { return c.id === id; });
  if (!c) return;
  if (!confirm(c.name + ' 아동을 종결 처리할까요?\n종결 탭에서 다시 확인할 수 있어요.')) return;
  c.status = '종결';
  c.closedAt = new Date().toISOString().slice(0,10);
  saveChildren();
  renderChildGrid();
  showToast('🔒 ' + c.name + ' 종결 처리 완료');
}

// 아동 재등록 (종결 → 등록)
function reopenChild(id) {
  var c = childDB.find(function(c) { return c.id === id; });
  if (!c) return;
  if (!confirm(c.name + ' 아동을 다시 등록 상태로 변경할까요?')) return;
  c.status = '등록';
  delete c.closedAt;
  saveChildren();
  renderChildGrid();
  showToast('↩️ ' + c.name + ' 재등록 완료');
}

function renderChildGrid() {
  var c = document.getElementById('childGrid');
  updateHeaderClock(); // 헤더 시계+다음 세션 동시 갱신

  // 상태별 뱃지 카운트 업데이트 (권한에 따라 본인 아동만)
  var visibleForBadge = canDo('viewOtherChildren')
    ? childDB
    : childDB.filter(function(c){ return isMyChild(c.id); });
  ['등록','대기','종결'].forEach(function(s){
    var el = document.getElementById('badge_' + s);
    if (el) el.textContent = visibleForBadge.filter(function(c){ return (c.status||'등록') === s; }).length;
  });

  if (childDB.length === 0) {
    c.innerHTML = '<div class="empty" style="padding:30px 16px;">'
      + '<div class="empty-icon" style="font-size:48px;">👶</div>'
      + '<p style="font-size:15px;font-weight:700;color:var(--text);margin-top:8px;">아직 등록된 아동이 없습니다</p>'
      + '<p style="font-size:12px;color:var(--text2);line-height:1.7;margin-top:8px;">화면 상단 <strong style="color:var(--mint);">[+ 아동 등록]</strong> 버튼을 눌러<br>첫 아동을 추가해보세요.</p>'
      + '<p style="font-size:11px;color:var(--text2);margin-top:14px;background:var(--mint2);color:var(--mint);padding:10px 14px;border-radius:9px;display:inline-block;">💡 등록 후 세션 기록·추이 차트·부모 리포트를<br>모두 자동으로 관리할 수 있어요</p>'
      + '</div>';
    return;
  }

  // 검색 필터 + 상태 필터
  var q = ((document.getElementById('childSearchInput') || {}).value || '').trim().toLowerCase();
  var sortBy = ((document.getElementById('childSortSel') || {}).value) || 'name';

  var list = childDB.filter(function(child) {
    var childStatus = child.status || '등록';
    if (childStatus !== _childStatusFilter) return false;
    // viewOtherChildren 권한 OFF인 선생님은 본인 담당 아동만
    if (!canDo('viewOtherChildren') && !isMyChild(child.id)) return false;
    if (!q) return true;
    return child.name.toLowerCase().indexOf(q) > -1
      || (child.phone || '').replace(/-/g,'').indexOf(q.replace(/-/g,'')) > -1;
  });

  // 정렬
  if (sortBy === 'name') {
    list.sort(function(a, b) { return a.name.localeCompare(b.name, 'ko'); });
  } else if (sortBy === 'recent') {
    list.sort(function(a, b) {
      var sa = sessionDB.filter(function(s){return s.childId===a.id;});
      var sb = sessionDB.filter(function(s){return s.childId===b.id;});
      var da = sa.length ? sa[sa.length-1].date : '0000-00-00';
      var db2 = sb.length ? sb[sb.length-1].date : '0000-00-00';
      return da < db2 ? 1 : -1;
    });
  }
  // 등록순은 기본 순서 유지

  var today = new Date().toISOString().slice(0, 10);
  var totalCount = list.length;
  var totalPages = Math.max(1, Math.ceil(totalCount / CHILD_PAGE_SIZE));
  if (_childCurrentPage > totalPages) _childCurrentPage = totalPages;
  if (_childCurrentPage < 1) _childCurrentPage = 1;
  var startIdx = (_childCurrentPage - 1) * CHILD_PAGE_SIZE;
  var visibleList = list.slice(startIdx, startIdx + CHILD_PAGE_SIZE);
  // 일괄 처리용: 현재 화면에 렌더되는 아동 ID 캐시
  _currentVisibleIds = visibleList.map(function(c){ return c.id; });

  var html = '';

  // 종결 탭 전용 요약 통계 카드
  if (_childStatusFilter === '종결' && list.length > 0) {
    var totalSess = 0;
    var totalDays = 0;
    var countWithDuration = 0;
    list.forEach(function(c) {
      var sessCount = sessionDB.filter(function(s){ return s.childId === c.id; }).length;
      totalSess += sessCount;
      if (c.startDate && c.closedAt) {
        var d = Math.floor((new Date(c.closedAt) - new Date(c.startDate)) / (1000*60*60*24));
        if (d >= 0) { totalDays += d; countWithDuration++; }
      }
    });
    var avgSess = list.length > 0 ? Math.round(totalSess / list.length) : 0;
    var avgMonths = countWithDuration > 0 ? Math.floor(totalDays / countWithDuration / 30) : 0;
    var avgDays   = countWithDuration > 0 ? Math.floor(totalDays / countWithDuration % 30) : 0;
    var avgDurStr = countWithDuration > 0
      ? (avgMonths > 0 ? avgMonths + '개월 ' + avgDays + '일' : Math.floor(totalDays/countWithDuration) + '일')
      : '-';
    html += '<div style="grid-column:1/-1;background:linear-gradient(135deg,#1e293b,#334155);border-radius:14px;padding:16px;margin-bottom:4px;">'
      + '<div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:10px;">📊 종결 아동 통계</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">'
      + '<div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 6px;">'
      +   '<div style="font-size:20px;font-weight:900;color:#5eead4;">' + list.length + '</div>'
      +   '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">총 종결 아동</div>'
      + '</div>'
      + '<div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 6px;">'
      +   '<div style="font-size:16px;font-weight:900;color:#fbbf24;">' + avgDurStr + '</div>'
      +   '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">평균 치료기간</div>'
      + '</div>'
      + '<div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 6px;">'
      +   '<div style="font-size:20px;font-weight:900;color:#a78bfa;">' + avgSess + '</div>'
      +   '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">평균 세션 수</div>'
      + '</div>'
      + '</div></div>';
  }

  visibleList.forEach(function(child) {
    var ss       = sessionDB.filter(function(s) { return s.childId === child.id; });
    var lastDate = ss.length > 0 ? ss[ss.length - 1].date : '세션 없음';
    var duration = getTreatDuration(child.startDate);

    // 종결 탭 전용 정보
    var closedInfoHtml = '';
    if (_childStatusFilter === '종결') {
      var closedDur = getClosedDuration(child.startDate, child.closedAt);
      closedInfoHtml = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">'
        + (child.closedAt ? '<span style="font-size:11px;background:#fef2f2;color:#dc2626;padding:3px 8px;border-radius:8px;font-weight:600;">🔒 종결일 ' + child.closedAt + '</span>' : '')
        + (closedDur     ? '<span style="font-size:11px;background:#f0fdf4;color:#16a34a;padding:3px 8px;border-radius:8px;font-weight:600;">📅 ' + closedDur + '</span>' : '')
        + '<span style="font-size:11px;background:#eff6ff;color:#2563eb;padding:3px 8px;border-radius:8px;font-weight:600;">📝 총 ' + ss.length + '회 세션</span>'
        + (child.closedReason ? '<span style="font-size:11px;background:#fdf4ff;color:#7c3aed;padding:3px 8px;border-radius:8px;font-weight:600;">💬 ' + escHtml(child.closedReason) + '</span>' : '')
        + '</div>';
    }
    var vUsed    = getVoucherUsed(child.id);
    var vLimit   = child.voucherLimit || 0;
    var vPct     = vLimit > 0 ? Math.min(100, Math.round(vUsed / vLimit * 100)) : 0;
    var vColor   = vPct >= 90 ? '#ef4444' : vPct >= 70 ? '#f59e0b' : '#10b981';
    var voucherHtml = '';
    if (vLimit > 0) {
      voucherHtml = '<div class="voucher-bar">'
        + '<div class="voucher-track"><div class="voucher-fill" style="width:' + vPct + '%;background:' + vColor + '"></div></div>'
        + '<span class="voucher-label" style="color:' + vColor + '">바우처 ' + vUsed + '/' + vLimit + '</span>'
        + '</div>';
    }

    // 현재 진행 중인 스케줄 (오늘 포함 이후 최근 3개)
    var upcoming = scheduleDB.filter(function(s) { return s.childId === child.id && s.date >= today; })
      .sort(function(a,b){ return a.date<b.date?-1:1; }).slice(0, 2);
    var schedHtml = '';
    if (upcoming.length > 0) {
      schedHtml = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">';
      upcoming.forEach(function(s) {
        var tColor = getTeacherColor(s.teacher);
        var label  = s.date.slice(5).replace('-','/') + (s.startTime ? ' ' + s.startTime.slice(0,5) : '');
        if (s.teacher) label += ' · ' + s.teacher;
        schedHtml += '<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:' + tColor + '22;color:' + tColor + ';border:1px solid ' + tColor + '44;font-weight:600;">📅 ' + escHtml(label) + '</span>';
      });
      schedHtml += '</div>';
    }

    var cardSelected = !!_bulkSelected[child.id];
    var rowOnclick = _bulkMode
      ? 'bulkToggleSelect(' + child.id + ')'
      : 'toggleChildCard(' + child.id + ')';
    var checkboxHtml = _bulkMode
      ? '<input type="checkbox" class="bulk-checkbox" id="bulkChk_' + child.id + '"'
        + (cardSelected ? ' checked' : '')
        + ' onclick="event.stopPropagation();bulkToggleSelect(' + child.id + ')">'
      : '';

    html += '<div class="child-card' + (cardSelected ? ' bulk-selected' : '') + '" id="cc_' + child.id + '">'
      // 항상 보이는 헤더 (이름 + 기본 정보)
      + '<div class="child-card-row" onclick="' + rowOnclick + '">'
      + checkboxHtml
      + '<div class="child-avatar" style="background:' + child.color + '22">' + (DISORDER_EMOJI[child.type] || '📋') + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      + '<div class="child-name">' + escHtml(child.name) + '</div>'
      + '<div style="font-size:12px;color:var(--mint);font-weight:700;">' + escHtml(child.age) + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">'
      + (child.birth ? '<span style="font-size:11px;color:var(--text2);">🎂 ' + child.birth + '</span>' : '')
      + (child.phone ? '<span style="font-size:11px;color:var(--text2);">📞 ' + escHtml(child.phone) + '</span>' : '')
      + '</div>'
      + '</div>'
      + '<span class="child-expand-icon" style="flex-shrink:0;">▼</span>'
      + '</div>'
      // 펼쳐지는 상세 영역
      + '<div class="child-detail">'
      + '<div class="child-meta" style="margin-top:6px;">' + escHtml(child.type) + '</div>'
      + '<div class="child-session-count">세션 ' + ss.length + '회 | 최근: ' + lastDate + '</div>'
      + (_childStatusFilter !== '종결' && duration ? '<div class="treat-duration">📅 ' + duration + '</div>' : '')
      + closedInfoHtml
      + voucherHtml
      + schedHtml
      + '<div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;">'
      + '<button class="btn-ghost" onclick="event.stopPropagation();goToSession(' + child.id + ')">📝 기록</button>'
      + '<button class="btn-ghost" style="color:var(--blue);border-color:var(--blue);" onclick="event.stopPropagation();openEditModal(' + child.id + ')">✏️ 편집</button>'
      + '<button class="btn-ghost" onclick="event.stopPropagation();openChildDetail(' + child.id + ')">🔍 상세</button>'
      + (_childStatusFilter !== '종결'
          ? '<button class="btn-ghost" style="color:#f59e0b;border-color:#f59e0b;" onclick="event.stopPropagation();closeChild(' + child.id + ')">🔒 종결</button>'
          : '<button class="btn-ghost" style="color:var(--mint);border-color:var(--mint);" onclick="event.stopPropagation();reopenChild(' + child.id + ')">↩️ 재등록</button>')
      + '</div>'
      + '</div></div>';
  });

  if (!html) {
    if (q) {
      // 검색어 있고 결과 없음
      html = '<div class="empty" style="grid-column:1/-1"><p>검색 결과가 없습니다.</p></div>';
    } else if (!canDo('viewOtherChildren') && currentUser && currentUser.role !== 'admin') {
      // 권한 OFF + 담당 아동 없음
      html = '<div class="empty" style="grid-column:1/-1;padding:30px 16px;">'
        + '<div class="empty-icon" style="font-size:48px;">👀</div>'
        + '<p style="font-size:15px;font-weight:700;color:var(--text);margin-top:8px;">담당 아동이 없습니다</p>'
        + '<p style="font-size:12px;color:var(--text2);line-height:1.7;margin-top:8px;">'
        +   '다른 선생님이 담당하는 아동은 표시되지 않습니다.<br>'
        +   '아동에게 <strong style="color:var(--mint);">일정을 등록</strong>하거나 '
        +   '<strong style="color:var(--mint);">세션 기록</strong>을 작성하면<br>본인 담당 아동으로 자동 표시됩니다.'
        + '</p>'
        + '<p style="font-size:11px;color:var(--text2);margin-top:14px;background:var(--mint2);color:var(--mint);padding:10px 14px;border-radius:9px;display:inline-block;">'
        +   '💡 권한 변경이 필요하면 관리자에게 문의해 주세요'
        + '</p>'
        + '</div>';
    } else {
      // 그 외 (해당 상태 탭에 아동 없음)
      var statusLabel = _childStatusFilter || '등록';
      html = '<div class="empty" style="grid-column:1/-1"><p>' + statusLabel + ' 상태의 아동이 없습니다.</p></div>';
    }
  }

  // 페이지 번호 페이징 UI (총 2페이지 이상일 때만 표시)
  if (totalPages > 1) {
    var endIdx = Math.min(startIdx + CHILD_PAGE_SIZE, totalCount);
    html += '<div style="grid-column:1/-1;padding:14px 8px 8px;text-align:center;">';
    html += '<div style="display:inline-flex;flex-wrap:wrap;justify-content:center;gap:4px;align-items:center;">';
    // 이전 버튼
    var prevDisabled = _childCurrentPage <= 1 ? 'disabled' : '';
    html += '<button class="pg-btn" ' + prevDisabled + ' onclick="goToChildPage(' + (_childCurrentPage - 1) + ')">‹ 이전</button>';
    // 페이지 번호 (현재 ±2 + 첫/끝)
    var pages = getPageNumbers(_childCurrentPage, totalPages);
    pages.forEach(function(p) {
      if (p === '...') {
        html += '<span style="padding:0 4px;color:var(--text2);font-size:12px;">···</span>';
      } else {
        var act = (p === _childCurrentPage) ? ' pg-btn-active' : '';
        html += '<button class="pg-btn' + act + '" onclick="goToChildPage(' + p + ')">' + p + '</button>';
      }
    });
    // 다음 버튼
    var nextDisabled = _childCurrentPage >= totalPages ? 'disabled' : '';
    html += '<button class="pg-btn" ' + nextDisabled + ' onclick="goToChildPage(' + (_childCurrentPage + 1) + ')">다음 ›</button>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text2);margin-top:8px;">'
      + (startIdx + 1) + '-' + endIdx + ' / 총 ' + totalCount + '명 (' + _childCurrentPage + '/' + totalPages + ' 페이지)</div>';
    html += '</div>';
  } else if (totalCount > 0) {
    html += '<div style="grid-column:1/-1;text-align:center;padding:8px;font-size:11px;color:var(--text2);">'
      + '✓ ' + totalCount + '명 모두 표시됨</div>';
  }
  c.innerHTML = html;
}

// 페이지 번호 배열 생성 헬퍼 (현재 ±2 + 양 끝)
function getPageNumbers(current, total) {
  var pages = [];
  if (total <= 7) {
    for (var i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (current > 4) pages.push('...');
  var start = Math.max(2, current - 2);
  var end   = Math.min(total - 1, current + 2);
  for (var j = start; j <= end; j++) pages.push(j);
  if (current < total - 3) pages.push('...');
  pages.push(total);
  return pages;
}

function goToChildPage(page) {
  _childCurrentPage = page;
  renderChildGrid();
}

// 검색 입력: 즉시 페이지 1로 리셋 후 debounce로 렌더
var _searchDebounced = debounce(function() { renderChildGrid(); }, 250);
function onChildSearchInput() {
  _childCurrentPage = 1;
  _searchDebounced();
}

var _childStatusFilter = '등록';

// ─────── 아동 일괄 처리 모드 ───────
var _bulkMode = false;
var _bulkSelected = {}; // { childId: true }
var _currentVisibleIds = []; // renderChildGrid에서 채워짐

function toggleBulkMode() {
  _bulkMode = !_bulkMode;
  _bulkSelected = {};
  var btn = document.getElementById('bulkToggleBtn');
  var bar = document.getElementById('bulkActionBar');
  if (btn) btn.classList.toggle('active', _bulkMode);
  if (bar) bar.style.display = _bulkMode ? 'flex' : 'none';
  document.body.classList.toggle('bulk-mode', _bulkMode);
  updateBulkCountLabel();
  renderChildGrid();
  if (_bulkMode) {
    showToast('☑️ 일괄 처리 모드 — 카드를 눌러 선택');
  }
}

function bulkToggleSelect(id) {
  if (_bulkSelected[id]) {
    delete _bulkSelected[id];
  } else {
    _bulkSelected[id] = true;
  }
  // 카드만 부분 갱신 (전체 렌더 안 함 — 펼침 상태 유지)
  var card = document.getElementById('cc_' + id);
  if (card) card.classList.toggle('bulk-selected', !!_bulkSelected[id]);
  var cb = document.getElementById('bulkChk_' + id);
  if (cb) cb.checked = !!_bulkSelected[id];
  updateBulkCountLabel();
}

// 화면에 보이는 아동 전체 선택 / 전체 해제 (토글)
function bulkSelectAllVisible() {
  if (!_currentVisibleIds || _currentVisibleIds.length === 0) {
    showToast('⚠️ 표시된 아동이 없습니다');
    return;
  }
  // 현재 화면 아동이 모두 선택돼 있으면 → 해제, 아니면 → 모두 선택
  var allSelected = _currentVisibleIds.every(function(id){ return !!_bulkSelected[id]; });
  if (allSelected) {
    _currentVisibleIds.forEach(function(id){ delete _bulkSelected[id]; });
  } else {
    _currentVisibleIds.forEach(function(id){ _bulkSelected[id] = true; });
  }
  updateBulkCountLabel();
  renderChildGrid();
  showToast(allSelected ? '🔲 전체 선택 해제' : '☑️ ' + _currentVisibleIds.length + '명 전체 선택');
}

function updateBulkCountLabel() {
  var n = Object.keys(_bulkSelected).length;
  var lbl = document.getElementById('bulkCountLabel');
  if (lbl) lbl.textContent = n + '명 선택';
}

function bulkChangeStatus(newStatus) {
  var ids = Object.keys(_bulkSelected).map(function(s){ return parseInt(s, 10); });
  if (ids.length === 0) {
    showToast('⚠️ 선택된 아동이 없습니다');
    return;
  }
  // 종결은 종결일 입력 모달로 위임
  if (newStatus === '종결') {
    openBulkClosedDateModal(ids);
    return;
  }
  if (!confirm(ids.length + '명을 [' + newStatus + ']로 변경할까요?')) return;
  applyBulkStatus(ids, newStatus, null);
}

// 실제 일괄 상태 적용 (ids 배열, 새 상태, 종결일 또는 null, 종결 사유)
function applyBulkStatus(ids, newStatus, closedAt, reason) {
  var changed = 0;
  ids.forEach(function(id) {
    var c = childDB.find(function(c){ return c.id === id; });
    if (!c) return;
    c.status = newStatus;
    if (newStatus === '종결') {
      c.closedAt = closedAt;
      c.closedReason = reason || '';
    } else {
      delete c.closedAt;
      delete c.closedReason;
    }
    changed++;
  });
  saveChildren();
  _bulkSelected = {};
  updateBulkCountLabel();
  renderChildGrid();
  showToast('✅ ' + changed + '명을 [' + newStatus + ']로 변경 완료');
}

// ─────── 일괄 종결일 입력 모달 ───────