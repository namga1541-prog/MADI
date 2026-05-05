// ─────── 생년월일 숫자 입력 처리 ───────
function formatBirthInput(el) {
  // 숫자만 허용
  el.value = el.value.replace(/[^0-9]/g, '').slice(0, 8);
}

function parseBirth(val) {
  // YYYY-MM-DD 또는 YYYYMMDD 모두 허용
  if (!val) return null;
  var s = val.replace(/-/g, '');
  if (s.length !== 8) return null;
  var y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
  var dt = new Date(y + '-' + m + '-' + d + 'T00:00:00');
  return isNaN(dt.getTime()) ? null : dt;
}

function calcAgeFromBirth(birthStr) {
  var birth = parseBirth(birthStr);
  if (!birth) return '';
  var today = new Date();
  if (birth > today) return '';
  var years  = today.getFullYear() - birth.getFullYear();
  var months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 0) return '';
  return months === 0 ? years + '세' : years + '세 ' + months + '개월';
}

// 생년월일 입력 시 생활연령 즉시 표시
function updateAgeDisplay() {
  var birth = document.getElementById('childBirth').value;
  var el    = document.getElementById('ageDisplay');
  var age   = calcAgeFromBirth(birth);
  if (age) {
    el.textContent = age;
    el.style.color = 'var(--mint)';
    el.style.background = '#f0fdf4';
    el.style.borderColor = 'var(--mint)';
  } else {
    el.textContent = '생활연령';
    el.style.color = '#94a3b8';
    el.style.background = '#f8fafc';
    el.style.borderColor = 'var(--border)';
  }
}

// 하위 호환용 함수는 더 이상 필요하지 않음 (직접 호출 없음)

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────── 미작성 세션 알림 ───────
function getUnwrittenSessions() {
  if (scheduleDB.length === 0) return [];
  var today = new Date().toISOString().slice(0, 10);
  var unwritten = [];
  scheduleDB.forEach(function(s) {
    if (s.date >= today) return; // 오늘 이후는 제외
    var diffDays = Math.floor((new Date(today) - new Date(s.date)) / 86400000);
    if (diffDays > 7) return; // 7일 초과는 제외
    var hasSession = sessionDB.some(function(ss) {
      return ss.childId === s.childId && ss.date === s.date;
    });
    if (!hasSession) {
      var child = childDB.find(function(c) { return c.id === s.childId; });
      unwritten.push({ date: s.date, childName: child ? child.name : '알 수 없음', schedId: s.id, teacher: s.teacher || '' });
    }
  });
  return unwritten.sort(function(a, b) { return b.date < a.date ? -1 : 1; });
}

function renderUnwrittenAlert() {
  var el = document.getElementById('unwrittenAlert');
  if (!el) return;
  var unwritten = getUnwrittenSessions();
  if (unwritten.length === 0) { el.innerHTML = ''; return; }
  var html = '<div class="unwritten-card">'
    + '<div class="unwritten-title">⚠️ 미작성 세션 ' + unwritten.length + '개</div>';
  unwritten.forEach(function(u) {
    html += '<div class="unwritten-item">'
      + '<span>📅 ' + u.date + ' · ' + escHtml(u.childName) + '</span>'
      + '<button class="btn-ghost" style="font-size:11px;padding:7px 12px;" onclick="quickFillSession(\'' + u.date + '\',' + u.schedId + ')">지금 작성</button>'
      + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function quickFillSession(date, schedId) {
  var sched = scheduleDB.find(function(s) { return s.id === schedId; });
  if (!sched) return;
  document.getElementById('sessionChild').value = sched.childId;
  document.getElementById('sessionDate').value  = date;
  loadGoalRows(sched.childId);
  showToast('📝 날짜가 자동 설정되었습니다.');
  window.scrollTo(0, 0);
}

// ─────── 스케줄 ───────
var schedView = 'month';
var schedCurrentDate = new Date();

function setSchedView(v) {
  schedView = v;
  document.getElementById('viewBtnMonth').classList[v==='month'?'add':'remove']('active');
  document.getElementById('viewBtnWeek').classList[v==='week'?'add':'remove']('active');
  document.getElementById('monthViewWrap').style.display = v==='month' ? 'block' : 'none';
  document.getElementById('weekViewWrap').style.display  = v==='week'  ? 'block' : 'none';
  renderSchedView();
}

function moveSchedPeriod(dir) {
  if (schedView === 'month') {
    schedCurrentDate = new Date(schedCurrentDate.getFullYear(), schedCurrentDate.getMonth() + dir, 1);
  } else {
    schedCurrentDate = new Date(schedCurrentDate.getTime() + dir * 86400000);
  }
  renderSchedView();
}

// ─────── 선생님 필터 ───────
var _schedTeacherFilter = '전체';

function renderTeacherFilter() {
  var bar = document.getElementById('teacherFilterBar');
  if (!bar) return;
  // 스케줄에 등장하는 선생님 목록 추출
  var teachers = [];
  scheduleDB.forEach(function(s) {
    if (s.teacher && teachers.indexOf(s.teacher) < 0) teachers.push(s.teacher);
  });
  teachers.sort();
  var html = '';
  ['전체'].concat(teachers).forEach(function(t) {
    var color = t === '전체' ? 'var(--mint)' : getTeacherColor(t);
    var active = _schedTeacherFilter === t;
    html += '<button onclick="setTeacherFilter(\'' + escHtml(t) + '\')" style="'
      + 'padding:5px 12px;border-radius:20px;border:2px solid ' + color + ';'
      + 'background:' + (active ? color : 'white') + ';'
      + 'color:' + (active ? 'white' : color) + ';'
      + 'font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;'
      + 'touch-action:manipulation;white-space:nowrap;">'
      + (t === '전체' ? '전체' : escHtml(t))
      + '</button>';
  });
  bar.innerHTML = html;
}

function setTeacherFilter(teacher) {
  _schedTeacherFilter = teacher;
  renderTeacherFilter();
  renderSchedView();
}

// ─────── 월간에서 날짜 클릭 시 일일 뷰로 이동 ───────
function switchToDay(dateStr) {
  schedCurrentDate = new Date(dateStr + 'T00:00:00');
  setSchedView('week');
}

// ─────── 날짜 클릭 팝업 (아이디어 4) ───────
function openDayPopup(dateStr) {
  var dayScheds = scheduleDB.filter(function(s) {
    if (s.date !== dateStr) return false;
    if (_schedTeacherFilter !== '전체' && s.teacher !== _schedTeacherFilter) return false;
    return true;
  }).sort(function(a, b) { return (a.startTime||'') < (b.startTime||'') ? -1 : 1; });

  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  var d = new Date(dateStr + 'T00:00:00');
  var dayNames = ['일','월','화','수','목','금','토'];
  var title = (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + dayNames[d.getDay()] + ')';

  var listHtml = '';
  if (dayScheds.length === 0) {
    listHtml = '<div style="text-align:center;color:var(--text2);font-size:13px;padding:20px 0;">일정이 없습니다.</div>';
  } else {
    dayScheds.forEach(function(s) {
      var child = childDB.find(function(c){ return c.id === s.childId; });
      var color = s.teacher ? getTeacherColor(s.teacher) : (child ? child.color : '#94a3b8');
      var time  = s.startTime ? s.startTime.slice(0,5) + (s.endTime ? ' ~ ' + s.endTime.slice(0,5) : '') : '시간 미정';
      listHtml += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="openEditSchedModal(' + s.id + ')">'
        + '<div style="width:4px;height:44px;background:' + color + ';border-radius:4px;flex-shrink:0;"></div>'
        + '<div style="flex:1;">'
        + '<div style="font-size:14px;font-weight:700;">' + escHtml(child ? child.name : '?') + '</div>'
        + '<div style="font-size:12px;color:var(--text2);">⏰ ' + time
        + (s.teacher ? ' &nbsp;👤 ' + escHtml(s.teacher) : '')
        + (s.note ? ' &nbsp;📝 ' + escHtml(s.note) : '') + '</div>'
        + '</div></div>';
    });
  }

  overlay.innerHTML = '<div class="sched-modal">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div style="font-size:16px;font-weight:700;">📅 ' + title + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center;">'
    + '<span style="font-size:12px;color:var(--text2);">' + dayScheds.length + '건</span>'
    + '<button onclick="this.closest(\'.sched-modal-overlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button>'
    + '</div></div>'
    + listHtml
    + '<button class="btn btn-primary" style="margin-top:12px;" onclick="this.closest(\'.sched-modal-overlay\').remove();openSchedModal(\'' + dateStr + '\',null)">+ 이 날 일정 추가</button>'
    + '</div>';

  document.body.appendChild(overlay);
}

// ─────── 선생님 select 옵션 빌드 ───────
var _teacherList = []; // Supabase에서 불러온 선생님 목록 캐시

function buildTeacherOptions(selectedName) {
  var options = '<option value="">선택하세요</option>';
  _teacherList.forEach(function(u) {
    var sel = (selectedName && u.name === selectedName) ? ' selected' : '';
    options += '<option value="' + escHtml(u.name) + '"' + sel + '>' + escHtml(u.name) + '</option>';
  });
  return options;
}

function loadTeacherList(callback) {
  if (_teacherList.length > 0) { if (callback) callback(); return; }
  supaFetch('madi_users?select=name,role&order=name.asc')
    .then(function(users) {
      if (Array.isArray(users)) _teacherList = users.filter(function(u){ return u.name; });
      if (callback) callback();
    }).catch(function() { if (callback) callback(); });
}

function renderSchedView() {
  if (schedView === 'month') renderMonthGrid();
  else renderWeekGrid();
}

function getWeekStart(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(new Date(d).setDate(diff));
}

function renderMonthGrid() {
  var year  = schedCurrentDate.getFullYear();
  var month = schedCurrentDate.getMonth();
  var today = new Date().toISOString().slice(0, 10);
  document.getElementById('schedNavLabel').textContent = year + '년 ' + (month + 1) + '월';
  var firstDay = new Date(year, month, 1).getDay();
  var lastDate = new Date(year, month + 1, 0).getDate();
  var cells = [];
  for (var i = 0; i < firstDay; i++) {
    var pd = new Date(year, month, -(firstDay - i - 1));
    cells.push({ date: pd.toISOString().slice(0,10), other: true });
  }
  for (var d = 1; d <= lastDate; d++) {
    var dt = new Date(year, month, d);
    cells.push({ date: dt.toISOString().slice(0,10), other: false });
  }
  while (cells.length % 7 !== 0) {
    var nd = new Date(year, month + 1, cells.length - firstDay - lastDate + 1);
    cells.push({ date: nd.toISOString().slice(0,10), other: true });
  }
  // 선생님 필터 렌더링
  renderTeacherFilter();
  var html = '';
  cells.forEach(function(cell) {
    var allScheds = scheduleDB.filter(function(s) { return s.date === cell.date; })
      .sort(function(a, b) { return (a.startTime||'') < (b.startTime||'') ? -1 : 1; });
    // 필터 적용
    var dayScheds = _schedTeacherFilter === '전체' ? allScheds
      : allScheds.filter(function(s){ return s.teacher === _schedTeacherFilter; });
    var isToday = cell.date === today;
    // 날짜 클릭 → 일일 뷰로 이동
    var clickFn = 'switchToDay(\'' + cell.date + '\')';
    html += '<div class="month-cell' + (isToday?' today':'') + (cell.other?' other-month':'') + '"'
      + ' onclick="' + clickFn + '">'
      + '<span class="month-date-num">' + parseInt(cell.date.slice(8)) + '</span>';
    var shown = dayScheds.slice(0, 3);
    var extra = dayScheds.length - shown.length;
    // 필터 전체에서 숨겨진 일정 수
    var hiddenByFilter = allScheds.length - dayScheds.length;
    shown.forEach(function(s) {
      var child = childDB.find(function(c) { return c.id === s.childId; });
      var color = s.teacher ? getTeacherColor(s.teacher) : (child ? child.color : '#64748b');
      var lbl   = (s.startTime ? s.startTime.slice(0,5)+' ' : '') + (child ? child.name : '?');
      if (s.teacher) lbl += ' (' + s.teacher + ')';
      html += '<span class="sched-tag" style="background:' + color + '22;color:' + color + ';border-left:3px solid ' + color + ';"'
        + ' onclick="event.stopPropagation();openEditSchedModal(' + s.id + ')">' + escHtml(lbl) + '</span>';
    });
    if (extra > 0) html += '<span class="sched-more">+' + extra + '개 더</span>';
    if (hiddenByFilter > 0) html += '<span class="sched-more" style="color:#94a3b8;">외 ' + hiddenByFilter + '건 숨김</span>';
    html += '</div>';
  });
  document.getElementById('monthGrid').innerHTML = html;
  renderSessionListForPeriod();
}

function renderWeekGrid() {
  var today = new Date().toISOString().slice(0, 10);
  var dateStr = schedCurrentDate.toISOString().slice(0, 10);
  var d = schedCurrentDate;
  var dayNames = ['일','월','화','수','목','금','토'];
  var dayName = dayNames[d.getDay()];

  document.getElementById('schedNavLabel').textContent =
    (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + dayName + ')';

  // 선생님 필터 렌더링
  renderTeacherFilter();

  var allScheds = scheduleDB.filter(function(s) { return s.date === dateStr; })
    .sort(function(a, b) { return (a.startTime||'') < (b.startTime||'') ? -1 : 1; });

  var dayScheds = _schedTeacherFilter === '전체' ? allScheds
    : allScheds.filter(function(s){ return s.teacher === _schedTeacherFilter; });

  var html = '<div class="day-col" style="width:100%;min-width:0;">'
    + '<div class="day-header' + (dateStr===today?' today':'') + '">'
    + '<span class="day-name">' + dayName + '</span>'
    + '<span class="day-num">' + dateStr.slice(8) + '</span>'
    + '</div><div class="day-slots">';

  dayScheds.forEach(function(s) {
    var child  = childDB.find(function(c) { return c.id === s.childId; });
    var color  = s.teacher ? getTeacherColor(s.teacher) : (child ? child.color : '#94a3b8');
    html += '<div class="sched-block" style="background:' + color + '22;border-left:3px solid ' + color + ';">'
      + (s.startTime ? '<div style="font-size:10px;opacity:0.8;">' + s.startTime.slice(0,5) + (s.endTime ? '~'+s.endTime.slice(0,5) : '') + '</div>' : '')
      + '<div style="font-weight:700;">' + escHtml(child ? child.name : '?') + '</div>'
      + (s.teacher ? '<div style="font-size:10px;opacity:0.85;">👤 ' + escHtml(s.teacher) + '</div>' : '')
      + '<div style="display:flex;gap:3px;margin-top:3px;">'
      + '<button style="font-size:9px;padding:1px 5px;border:none;background:rgba(255,255,255,0.7);border-radius:4px;cursor:pointer;font-family:inherit;touch-action:manipulation;" onclick="event.stopPropagation();openEditSchedModal(' + s.id + ')">✏️</button>'
      + '<button style="font-size:9px;padding:1px 5px;border:none;background:rgba(255,100,100,0.15);color:#dc2626;border-radius:4px;cursor:pointer;font-family:inherit;touch-action:manipulation;" onclick="event.stopPropagation();deleteSchedConfirm(' + s.id + ')">🗑️</button>'
      + '</div></div>';
  });

  if (dayScheds.length === 0) {
    html += '<div style="text-align:center;color:var(--text2);font-size:13px;padding:30px 0;">일정이 없습니다.</div>';
  }

  html += '<button class="sched-add-btn" onclick="openSchedModal(\'' + dateStr + '\',null)">+</button></div></div>';

  document.getElementById('weekGrid').innerHTML = html;
  renderSessionListForPeriod([dateStr]);
}

function renderSessionListForPeriod(dates) {
  var el = document.getElementById('weekSessionList');
  if (!el) return;
  var all = [];
  var targetDates = dates || [];
  if (!dates) {
    var year = schedCurrentDate.getFullYear();
    var month = schedCurrentDate.getMonth();
    var last = new Date(year, month + 1, 0).getDate();
    for (var d = 1; d <= last; d++) {
      targetDates.push(new Date(year, month, d).toISOString().slice(0,10));
    }
  }
  targetDates.forEach(function(date) {
    scheduleDB.filter(function(s) { return s.date === date; }).forEach(function(s) {
      var child = childDB.find(function(c) { return c.id === s.childId; });
      var hasNote = sessionDB.some(function(ss) { return ss.childId === s.childId && ss.date === s.date; });
      all.push({ date: date, child: child, sched: s, hasNote: hasNote });
    });
  });
  if (all.length === 0) { el.innerHTML = '<div class="empty"><p>이 기간에 일정이 없습니다.</p></div>'; return; }
  var html = '';
  all.slice(0, 30).forEach(function(item) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">'
      + '<div><div style="font-size:13px;font-weight:700;">' + escHtml(item.child ? item.child.name : '?') + '</div>'
      + '<div style="font-size:11px;color:var(--text2);">📅 ' + item.date
      + (item.sched.startTime ? ' ' + item.sched.startTime.slice(0,5) : '')
      + (item.sched.endTime   ? '~' + item.sched.endTime.slice(0,5) : '') + '</div></div>'
      + '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;'
      + (item.hasNote ? 'background:#f0fdf4;color:#15803d' : 'background:#fef2f2;color:#dc2626') + '">'
      + (item.hasNote ? '✅ 기록완료' : '⚠️ 미작성') + '</span></div>';
  });
  el.innerHTML = html;
}

var _schedModalDate = null;
function openSchedModal(date, schedId) {
  _schedModalDate = date;
  var opts = childDB.length === 0 ? '<option value="">아동 없음</option>'
    : childDB.map(function(c) { return '<option value="' + c.id + '">' + escHtml(c.name) + '</option>'; }).join('');
  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.id = 'schedModal';
  overlay.onclick = function(e) { if (e.target === overlay) closeSchedModal(); };
  overlay.innerHTML = '<div class="sched-modal">'
    + '<div class="sched-modal-title">📅 일정 추가</div>'
    + '<div class="form-group"><label class="form-label">아동</label>'
    + '<select class="form-input" id="schedChildSel">' + opts + '</select></div>'
    + '<div class="form-group"><label class="form-label">날짜</label>'
    + '<input class="form-input" type="date" id="schedDateInput" value="' + (date || new Date().toISOString().slice(0,10)) + '"></div>'
    + '<div class="form-row">'
    + '<div style="flex:1;"><label class="form-label">시작 시간</label>'
    + '<input class="form-input" type="time" id="schedStartTime" step="300" onclick="try{this.showPicker();}catch(e){}" oninput="autoCalcEndTime()"></div>'
    + '<div style="flex:1;"><label class="form-label">치료 시간 (분)</label>'
    + '<input class="form-input" type="number" id="schedDuration" placeholder="예: 40" min="5" max="180" oninput="autoCalcEndTime()"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">종료 시간 <span style="color:var(--mint);font-size:11px;">(자동 계산)</span></label>'
    + '<input class="form-input" type="time" id="schedEndTime" step="300" style="background:#f8fafc;color:var(--mint);font-weight:700;"></div>'
    + '<div class="form-group"><label class="form-label">반복</label>'
    + '<select class="form-input" id="schedRepeat" onchange="toggleRepeatOpt()">'
    + '<option value="none">반복 없음</option>'
    + '<option value="weekly">매주 반복</option>'
    + '</select></div>'
    + '<div id="schedRepeatOpt" style="display:none;">'
    + '<div class="form-group"><label class="form-label">반복 요일 <span style="color:var(--text2);font-weight:400;font-size:11px;">(복수 선택 가능)</span></label>'
    + '<div style="display:flex;gap:7px;margin-top:6px;flex-wrap:wrap;">'
    + '<button type="button" class="day-chip" data-day="0" onclick="toggleDayChip(this)">일</button>'
    + '<button type="button" class="day-chip" data-day="1" onclick="toggleDayChip(this)">월</button>'
    + '<button type="button" class="day-chip" data-day="2" onclick="toggleDayChip(this)">화</button>'
    + '<button type="button" class="day-chip" data-day="3" onclick="toggleDayChip(this)">수</button>'
    + '<button type="button" class="day-chip" data-day="4" onclick="toggleDayChip(this)">목</button>'
    + '<button type="button" class="day-chip" data-day="5" onclick="toggleDayChip(this)">금</button>'
    + '<button type="button" class="day-chip" data-day="6" onclick="toggleDayChip(this)">토</button>'
    + '</div></div>'
    + '<div class="form-group"><label class="form-label">반복 종료일 <span style="color:var(--mint);font-size:11px;">기본 5년 — 특수한 경우만 수정 (예: 교육청 20회기)</span></label>'
    + '<input class="form-input" type="date" id="schedRepeatUntil"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">담당 선생님</label>'
    + '<select class="form-input" id="schedTeacher"><option value="">불러오는 중...</option></select></div>'
    + '<div class="form-group"><label class="form-label">메모</label>'
    + '<input class="form-input" type="text" id="schedNote" placeholder="특이사항"></div>'
    + '<button class="btn btn-primary" style="margin-top:4px;" onclick="saveSchedFromModal()">✅ 저장</button>'
    + '</div>';
  document.body.appendChild(overlay);
  // 선생님 목록 로드 후 select 채우기
  loadTeacherList(function() {
    var sel = document.getElementById('schedTeacher');
    if (sel) sel.innerHTML = buildTeacherOptions('');
  });
  makeSearchable('schedChildSel');
}

function autoCalcEndTime() {
  var st = document.getElementById('schedStartTime').value;
  var dur = parseInt(document.getElementById('schedDuration').value);
  var endEl = document.getElementById('schedEndTime');
  if (!st || !dur || dur <= 0 || !endEl) return;
  var p = st.split(':');
  var total = parseInt(p[0]) * 60 + parseInt(p[1]) + dur;
  endEl.value = String(Math.floor(total/60)%24).padStart(2,'0') + ':' + String(total%60).padStart(2,'0');
}

function toggleRepeatOpt() {
  var v   = document.getElementById('schedRepeat').value;
  var opt = document.getElementById('schedRepeatOpt');
  opt.style.display = v === 'none' ? 'none' : 'block';
  if (v !== 'none') {
    // 시작 날짜의 요일 자동 선택
    var dateVal = document.getElementById('schedDateInput').value;
    if (dateVal) {
      var dow = new Date(dateVal + 'T00:00:00').getDay();
      document.querySelectorAll('.day-chip').forEach(function(c) {
        if (parseInt(c.dataset.day) === dow) c.classList.add('sel');
      });
    }
    // 종료일 기본값: 시작일로부터 5년
    var untilEl = document.getElementById('schedRepeatUntil');
    if (untilEl && !untilEl.value) {
      var base = dateVal ? new Date(dateVal + 'T00:00:00') : new Date();
      base.setFullYear(base.getFullYear() + 5);
      untilEl.value = base.toISOString().slice(0, 10);
    }
  }
}

function toggleDayChip(btn) {
  btn.classList.toggle('sel');
}

function closeSchedModal() {
  var m = document.getElementById('schedModal');
  if (m) m.remove();
}

function saveSchedFromModal() {
  var childId   = parseInt(document.getElementById('schedChildSel').value);
  var date      = document.getElementById('schedDateInput').value;
  var startTime = document.getElementById('schedStartTime').value;
  var duration  = parseInt(document.getElementById('schedDuration').value) || 0;
  var endTime   = document.getElementById('schedEndTime').value;
  var repeat    = document.getElementById('schedRepeat').value;
  var until     = repeat !== 'none' ? document.getElementById('schedRepeatUntil').value : '';
  var note      = document.getElementById('schedNote').value.trim();
  var teacher   = (document.getElementById('schedTeacher') || {}).value || '';
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!date)    { showToast('날짜를 선택해주세요.'); return; }

  var entries = [];
  var groupId = Date.now(); // 반복 그룹 식별자
  if (repeat === 'weekly' && until && until >= date) {
    var selDays = [];
    document.querySelectorAll('.day-chip.sel').forEach(function(c) {
      selDays.push(parseInt(c.dataset.day));
    });
    if (selDays.length === 0) {
      selDays.push(new Date(date + 'T00:00:00').getDay());
    }
    var cur = new Date(date + 'T00:00:00');
    var end = new Date(until + 'T00:00:00');
    var idx = 0;
    while (cur <= end) {
      if (selDays.indexOf(cur.getDay()) > -1) {
        entries.push({ id: Date.now() + idx * 1000, groupId: groupId, childId: childId,
          date: cur.toISOString().slice(0, 10),
          startTime: startTime, duration: duration, endTime: endTime,
          note: note, teacher: teacher.trim() });
        idx++;
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    entries.push({ id: Date.now() + Math.floor(Math.random() * 1000), childId: childId, date: date,
      startTime: startTime, duration: duration, endTime: endTime,
      note: note, teacher: teacher.trim() });
  }
  entries.forEach(function(e) { scheduleDB.push(e); });
  saveSchedule();
  closeSchedModal();
  renderSchedView();
  renderUnwrittenAlert();
  showToast('✅ ' + entries.length + '개 일정 추가!');
}

function openEditSchedModal(id) {
  var s = scheduleDB.find(function(x){ return x.id === id; });
  if (!s) return;
  var child = childDB.find(function(c){ return c.id === s.childId; });
  var hasGroup = s.groupId && scheduleDB.filter(function(x){ return x.groupId === s.groupId && x.date >= s.date; }).length > 1;
  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.id = 'editSchedOverlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = '<div class="sched-modal">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    + '<div class="sched-modal-title" style="margin-bottom:0;">📅 일정 상세</div>'
    + '<button onclick="document.getElementById(\'editSchedOverlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button>'
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;">'
    + '<div style="font-size:15px;font-weight:700;color:var(--mint);">' + escHtml(child ? child.name : '?') + '</div>'
    + (s.teacher ? '<div style="font-size:12px;color:var(--text2);">👤 ' + escHtml(s.teacher) + '</div>' : '')
    + '</div>'
    + '<div class="form-group"><label class="form-label">날짜</label>'
    + '<input class="form-input" type="date" id="editSchedDate" value="' + escHtml(s.date||'') + '"></div>'
    + '<div class="form-row">'
    + '<div style="flex:1;"><label class="form-label">시작 시간</label>'
    + '<input class="form-input" type="time" id="editSchedStart" step="300" value="' + escHtml(s.startTime||'') + '" onclick="try{this.showPicker();}catch(e){}"></div>'
    + '<div style="flex:1;"><label class="form-label">치료 시간(분)</label>'
    + '<input class="form-input" type="number" id="editSchedDur" value="' + (s.duration||'') + '" min="5" max="180" placeholder="예: 40"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">담당 선생님</label>'
    + '<select class="form-input" id="editSchedTeacher">' + buildTeacherOptions(s.teacher||'') + '</select></div>'
    + '<div class="form-group"><label class="form-label">메모</label>'
    + '<textarea class="form-input" id="editSchedNote" style="min-height:60px;" placeholder="특이사항 (예: 체험학습으로 인한 캔슬)">' + escHtml(s.note||'') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;margin-top:8px;">'
    + '<button class="btn btn-primary" style="flex:1;margin-top:0;background:var(--blue);border-color:var(--blue);" onclick="goToSessionFromSched(' + id + ')">📝 회기기록</button>'
    + (currentUser && currentUser.role === 'admin'
      ? '<button class="btn btn-primary" style="flex:1;margin-top:0;" onclick="saveEditSched(' + id + ')">💾 수정</button>'
      + '<button class="btn-del" style="flex:0.6;padding:11px 10px;font-size:13px;" onclick="confirmSchedDelete(' + id + ',' + (hasGroup?1:0) + ')">🗑️ 삭제</button>'
      : '')
    + '</div></div>';
  document.body.appendChild(overlay);
  // 선생님 목록 로드 후 select 업데이트
  loadTeacherList(function() {
    var sel = document.getElementById('editSchedTeacher');
    if (sel) sel.innerHTML = buildTeacherOptions(s.teacher||'');
  });
}

function goToSessionFromSched(schedId) {
  var s = scheduleDB.find(function(x){ return x.id === schedId; });
  if (!s) return;
  var ol = document.getElementById('editSchedOverlay');
  if (ol) ol.remove();
  switchTab(2);
  setTimeout(function() {
    var sel = document.getElementById('sessionChild');
    if (sel) {
      sel.value = s.childId;
      if (sel._ssInp) {
        var ch = childDB.find(function(c){ return c.id === s.childId; });
        sel._ssInp.value = ch ? ch.name + ' (' + ch.age + ')' : '';
      }
      loadGoalRows(s.childId);
    }
    if (s.date) document.getElementById('sessionDate').value = s.date;
  }, 200);
}

function confirmSchedDelete(id, hasGroup) {
  var s = scheduleDB.find(function(x){ return x.id === id; });
  if (!s) return;
  if (!hasGroup) {
    if (!confirm('이 일정을 삭제할까요?')) return;
    var ol = document.getElementById('editSchedOverlay');
    if (ol) ol.remove();
    execSchedDelete(id, false);
    return;
  }
  var delOv = document.createElement('div');
  delOv.id = 'delSchedOverlay';
  delOv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;';
  delOv.innerHTML = '<div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:320px;">'
    + '<div style="text-align:center;font-size:32px;margin-bottom:12px;">⚠️</div>'
    + '<div style="font-size:16px;font-weight:700;text-align:center;margin-bottom:6px;">삭제하시겠습니까?</div>'
    + '<div style="font-size:13px;color:var(--text2);text-align:center;margin-bottom:18px;">이후의 반복계획된 일정도 삭제하시겠습니까?</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">'
    + '<label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid var(--mint);border-radius:10px;cursor:pointer;">'
    + '<input type="radio" name="delOpt" value="one" checked style="accent-color:var(--mint);width:16px;height:16px;"> <div><div style="font-weight:700;font-size:14px;">이번일정만</div></div></label>'
    + '<label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;">'
    + '<input type="radio" name="delOpt" value="future" style="accent-color:var(--mint);width:16px;height:16px;"> <div><div style="font-weight:700;font-size:14px;">이후 반복일정포함</div></div></label>'
    + '</div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button class="btn-ghost" style="flex:1;" onclick="document.getElementById(\'delSchedOverlay\').remove()">아니요</button>'
    + '<button class="btn btn-primary" style="flex:1;margin-top:0;background:#ef4444;border-color:#ef4444;" onclick="execSchedDeleteChoice(' + id + ')">네, 삭제하겠습니다</button>'
    + '</div></div>';
  document.body.appendChild(delOv);
}

function execSchedDeleteChoice(id) {
  var opt = document.querySelector('input[name="delOpt"]:checked');
  var future = opt && opt.value === 'future';
  var ol1 = document.getElementById('editSchedOverlay');
  var ol2 = document.getElementById('delSchedOverlay');
  if (ol1) ol1.remove();
  if (ol2) ol2.remove();
  execSchedDelete(id, future);
}

function execSchedDelete(id, future) {
  var s = scheduleDB.find(function(x){ return x.id === id; });
  if (!s) return;
  var toDeleteItems = future && s.groupId
    ? scheduleDB.filter(function(x){ return x.groupId === s.groupId && x.date >= s.date; })
    : [s];
  var toDeleteIds = toDeleteItems.map(function(x){ return x.id; });
  var snapshot = toDeleteItems.map(function(x){ return Object.assign({}, x); });
  toDeleteIds.forEach(function(did) { supaFetch('madi_schedules?id=eq.' + did, 'DELETE'); });
  scheduleDB = scheduleDB.filter(function(x){ return toDeleteIds.indexOf(x.id) === -1; });
  saveSchedule(); renderSchedView();
  var cn = (childDB.find(function(c){ return c.id === s.childId; }) || {}).name || '';
  showToast('🗑️ ' + (cn ? cn + ' ' : '') + toDeleteIds.length + '개 일정 삭제됨', {
    undo: function() {
      snapshot.forEach(function(item){ scheduleDB.push(item); });
      saveSchedule(); renderSchedView();
      showToast('↩️ 일정이 복원되었습니다');
    }
  });
}

function autoEditEndTime() {}

function saveEditSched(id) {
  var idx = scheduleDB.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var date    = (document.getElementById('editSchedDate')||{}).value || '';
  var start   = (document.getElementById('editSchedStart')||{}).value || '';
  var dur     = parseInt((document.getElementById('editSchedDur')||{}).value)||0;
  var teacher = (document.getElementById('editSchedTeacher')||{}).value.trim();
  var note    = (document.getElementById('editSchedNote')||{}).value.trim();
  var endTime = '';
  if (start && dur) {
    var parts = start.split(':');
    var mins  = parseInt(parts[0])*60 + parseInt(parts[1]) + dur;
    endTime = String(Math.floor(mins/60)%24).padStart(2,'0') + ':' + String(mins%60).padStart(2,'0');
  }
  scheduleDB[idx] = Object.assign({}, scheduleDB[idx], { date:date, startTime:start, duration:dur, endTime:endTime, teacher:teacher, note:note });
  saveSchedule();
  var ol = document.getElementById('editSchedOverlay');
  if (ol) ol.remove();
  renderSchedView();
  showToast('✅ 일정 수정 완료!');
}

function deleteSchedFromModal(id) { confirmSchedDelete(id, 0); }

function deleteSchedConfirm(id) {
  var s = scheduleDB.find(function(x){ return x.id === id; });
  if (!s) return;
  var snapshot = Object.assign({}, s);
  supaFetch('madi_schedules?id=eq.' + id, 'DELETE');
  scheduleDB = scheduleDB.filter(function(x){ return x.id !== id; });
  saveSchedule(); renderSchedView();
  var cn = (childDB.find(function(c){ return c.id === s.childId; }) || {}).name || '';
  showToast('🗑️ ' + (cn ? cn + ' ' : '') + '일정 삭제됨', {
    undo: function() {
      scheduleDB.push(snapshot);
      saveSchedule(); renderSchedView();
      showToast('↩️ 일정이 복원되었습니다');
    }
  });
}

// ─────── 표준화 검사 ───────