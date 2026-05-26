// 일정 모달 A11y release 핸들러
var _schedModalRelease = null;

// ─────── 생년월일 숫자 입력 처리 ───────
function formatBirthInput(el) {
  el.value = el.value.replace(/[^0-9]/g, '').slice(0, 8);
}

function parseBirth(val) {
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

// escHtml 정의는 madi-01.js 로 통합됨 (외부 리뷰 R1, 2026-05-23)

// ─────── 미작성 세션 알림 ───────
function getUnwrittenSessions() {
  if (scheduleDB.length === 0) return [];
  var today = getTodayKST();
  var unwritten = [];
  scheduleDB.forEach(function(s) {
    if (s.date >= today) return;
    var diffDays = Math.floor((new Date(today) - new Date(s.date)) / 86400000);
    if (diffDays > 7) return;
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
  var selChildId = parseInt(document.getElementById('sessionChild') && document.getElementById('sessionChild').value) || 0;
  var unwritten = getUnwrittenSessions();
  if (selChildId) {
    unwritten = unwritten.filter(function(u) {
      var ch = childDB.find(function(c){ return c.id === selChildId; });
      return ch && u.childName === ch.name;
    });
  }
  if (unwritten.length === 0) { el.innerHTML = ''; return; }
  var byTeacher = {};
  unwritten.forEach(function(u) {
    var t = u.teacher || '미지정';
    if (!byTeacher[t]) byTeacher[t] = [];
    byTeacher[t].push(u);
  });
  var html = '<div class="unwritten-card">'
    + '<div class="unwritten-title" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="toggleUwBody()" data-uwbody="uwBody">'
    + '<span>⚠️ 미작성 세션 ' + unwritten.length + '개</span>'
    + '<span class="uw-arrow" style="font-size:11px;color:var(--text2);">▼</span>'
    + '</div><div id="uwBody" style="display:none;">';
  Object.keys(byTeacher).sort().forEach(function(teacher) {
    var items = byTeacher[teacher];
    var uid = 'uw_' + teacher.replace(/[^a-zA-Z0-9\uAC00-\uD7A3]/g, '_');
    html += '<div style="margin-top:8px;">'
      + '<div onclick="toggleUwTeacher(this)" data-uwid="' + uid + '" style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--mint2,#f0fdfa);border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;color:var(--mint,#0ea5a0);">'
      + '<span>👤 ' + escHtml(teacher) + '</span>'
      + '<span style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;font-weight:400;color:var(--text2);">' + items.length + '건</span><span class="uw-t-arrow" style="font-size:11px;">▶</span></span></div>'
      + '<div id="' + uid + '" style="display:none;margin-top:2px;">';
    items.forEach(function(u) {
      html += '<div class="unwritten-item"><span>📅 ' + u.date + ' · ' + escHtml(u.childName) + '</span>'
        + '<button class="btn-ghost" style="font-size:11px;padding:7px 12px;" onclick="quickFillSession(this)" data-date="' + u.date + '" data-schedid="' + u.schedId + '">지금 작성</button></div>';
    });
    html += '</div></div>';
  });
  html += '</div></div>';
  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

function toggleUwBody() {
  var b = document.getElementById('uwBody');
  if (!b) return;
  var titleDiv = document.querySelector('[data-uwbody="uwBody"]');
  var a = titleDiv ? titleDiv.querySelector('.uw-arrow') : null;
  if (b.style.display === 'none') { b.style.display = 'block'; if (a) a.textContent = '▲'; }
  else { b.style.display = 'none'; if (a) a.textContent = '▼'; }
}
function toggleUwTeacher(el) {
  var uid = el.dataset.uwid;
  if (!uid) return;
  var b = document.getElementById(uid);
  if (!b) return;
  var a = el.querySelector('.uw-t-arrow');
  if (b.style.display === 'none') { b.style.display = 'block'; if (a) a.textContent = '▲'; }
  else { b.style.display = 'none'; if (a) a.textContent = '▶'; }
}
function quickFillSession(el) {
  var date    = el.dataset.date;
  var schedId = Number(el.dataset.schedid);
  var sched = scheduleDB.find(function(s) { return s.id === schedId; });
  if (!sched) return;
  if (typeof switchTab === 'function') switchTab(2);
  if (typeof switchReportTab === 'function') switchReportTab('session');
  setTimeout(function() {
    var childEl = document.getElementById('sessionChild');
    var dateEl  = document.getElementById('sessionDate');
    if (childEl) { childEl.value = sched.childId; childEl.dispatchEvent(new Event('change')); }
    if (dateEl)  dateEl.value = date;
    if (typeof loadGoalRows === 'function') loadGoalRows(sched.childId);
    var form = document.getElementById('sessionFormCard') || document.getElementById('unwrittenAlert');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('📝 ' + date + ' · 아동 자동 설정됨');
  }, 200);
}

// ─────── 스케줄 ───────
var schedView = 'month';
var schedCurrentDate = new Date();

function setSchedView(v) {
  schedView = v;
  // HTML ID: viewBtnMonth(카멜), viewBtnWeek(카멜), viewBtn_day(스네이크)
  var mBtn = document.getElementById('viewBtnMonth');
  if (mBtn) mBtn.classList[v==='month'?'add':'remove']('active');
  var wBtn = document.getElementById('viewBtnWeek');
  if (wBtn) { wBtn.classList[v==='week'?'add':'remove']('active'); wBtn.textContent = '주간'; }
  var dBtn = document.getElementById('viewBtn_day');
  if (dBtn) dBtn.classList[v==='day'?'add':'remove']('active');
  var monthWrap = document.getElementById('monthViewWrap');
  var weekWrap  = document.getElementById('weekViewWrap');
  var dayWrap   = document.getElementById('dayViewWrap');
  if (monthWrap) monthWrap.style.display = v==='month' ? 'block' : 'none';
  if (weekWrap)  weekWrap.style.display  = v==='week'  ? 'block' : 'none';
  if (dayWrap)   dayWrap.style.display   = v==='day'   ? 'block' : 'none';
  renderSchedView();
}

function moveSchedPeriod(dir) {
  if (schedView === 'month') {
    schedCurrentDate = new Date(schedCurrentDate.getFullYear(), schedCurrentDate.getMonth() + dir, 1);
  } else if (schedView === 'week') {
    schedCurrentDate = new Date(schedCurrentDate.getTime() + dir * 7 * 86400000);
  } else {
    schedCurrentDate = new Date(schedCurrentDate.getTime() + dir * 86400000);
  }
  renderSchedView();
}

var _schedTeacherFilter = '전체';
var _weekViewMode  = 'therapist';
var _weekDupOnly   = false;

function renderTeacherFilter() {
  var bar = document.getElementById('teacherFilterBar');
  if (!bar) return;
  var teachers = [];
  scheduleDB.forEach(function(s) {
    if (s.teacher && teachers.indexOf(s.teacher) < 0) teachers.push(s.teacher);
  });
  teachers.sort();
  var html = '';
  ['전체'].concat(teachers).forEach(function(t) {
    var color = t === '전체' ? 'var(--mint)' : getTeacherColor(t);
    var active = _schedTeacherFilter === t;
    // 따옴표 포함 이름이 inline onclick 을 깨뜨리지 않도록 data-* 사용
    html += '<button data-teacher="' + escHtml(t) + '" onclick="setTeacherFilter(this.getAttribute(\'data-teacher\'))" style="padding:5px 12px;border-radius:20px;border:2px solid ' + color + ';background:' + (active ? color : 'white') + ';color:' + (active ? 'white' : color) + ';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap;">'
      + (t === '전체' ? '전체' : escHtml(t)) + '</button>';
  });
  // eslint-disable-next-line no-unsanitized/property
  bar.innerHTML = html;
}

function setTeacherFilter(teacher) {
  _schedTeacherFilter = teacher;
  renderTeacherFilter();
  renderSchedView();
}

function switchToDay(dateStr) {
  schedCurrentDate = new Date(dateStr + 'T00:00:00');
  setSchedView('day');
}

var _teacherList = [];

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
  supaFetch('madi_users?' + centerFilter() + '&select=name,role&order=name.asc')
    .then(function(users) {
      if (Array.isArray(users)) _teacherList = users.filter(function(u){ return u.name; });
      if (callback) callback();
    }).catch(function() { if (callback) callback(); showToast('⚠️ 선생님 목록 불러오기 실패'); });
}

function renderSchedView() {
  if (schedView === 'month') renderMonthGrid();
  else if (schedView === 'week') renderWeekGrid();
  else renderDayGrid();
}

function renderMonthGrid() {
  var year  = schedCurrentDate.getFullYear();
  var month = schedCurrentDate.getMonth();
  var today = getTodayKST();
  var lbl = document.getElementById('schedNavLabel');
  if (lbl) lbl.textContent = year + '년 ' + (month + 1) + '월';
  var firstDay = new Date(year, month, 1).getDay();
  var lastDate = new Date(year, month + 1, 0).getDate();
  var cells = [];
  function toLocal(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  }
  for (var i = 0; i < firstDay; i++) {
    cells.push({ date: toLocal(new Date(year, month, -(firstDay - i - 1))), other: true });
  }
  for (var d = 1; d <= lastDate; d++) {
    cells.push({ date: toLocal(new Date(year, month, d)), other: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: toLocal(new Date(year, month + 1, cells.length - firstDay - lastDate + 1)), other: true });
  }
  renderTeacherFilter();
  var html = '';
  cells.forEach(function(cell) {
    var allScheds = scheduleDB.filter(function(s) { return s.date === cell.date; })
      .sort(function(a, b) { return (a.startTime||'') < (b.startTime||'') ? -1 : 1; });
    var dayScheds = _schedTeacherFilter === '전체' ? allScheds
      : allScheds.filter(function(s){ return s.teacher === _schedTeacherFilter; });
    var isToday = cell.date === today;
    html += '<div class="month-cell' + (isToday?' today':'') + (cell.other?' other-month':'') + '" onclick="switchToDay(\'' + cell.date + '\')">' + '<span class="month-date-num">' + parseInt(cell.date.slice(8)) + '</span>';
    var shown = dayScheds.slice(0, 3);
    var extra = dayScheds.length - shown.length;
    var hiddenByFilter = allScheds.length - dayScheds.length;
    shown.forEach(function(s) {
      var child = childDB.find(function(c) { return c.id === s.childId; });
      var therapist = s.therapist || s.teacher || '';
      var color = therapist ? getTeacherColor(therapist) : (child ? child.color : '#64748b');
      var lbl = ((s.startTime||s.time) ? (s.startTime||s.time).slice(0,5)+' ' : '');
      if (therapist) lbl += therapist;
      if (child) lbl += '(' + child.name + ')';
      html += '<span class="sched-tag" style="background:' + color + '33;color:' + color + ';border-left:3px solid ' + color + ';font-weight:600;" onclick="event.stopPropagation();switchToDay(\'' + cell.date + '\')">' + escHtml(lbl) + '</span>';
    });
    if (extra > 0) html += '<span class="sched-more">+' + extra + '개 더</span>';
    if (hiddenByFilter > 0) html += '<span class="sched-more" style="color:#94a3b8;">외 ' + hiddenByFilter + '건 숨김</span>';
    html += '</div>';
  });
  var grid = document.getElementById('monthGrid');
  if (!grid) return;
  // eslint-disable-next-line no-unsanitized/property
  grid.innerHTML = html;
  renderSessionListForPeriod();
}

function toggleWeekViewMode() {
  _weekViewMode = (_weekViewMode === 'therapist') ? 'child' : 'therapist';
  renderWeekGrid();
}

function renderWeekGrid() {
  var d = schedCurrentDate;
  var dow = d.getDay();
  var mondayOffset = (dow === 0) ? -6 : 1 - dow;
  var weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
  var dayNames = ['월','화','수','목','금','토','일'];
  var todayStr = getTodayKST();
  var weekDates = [];
  for (var i = 0; i < 7; i++) {
    var dd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    weekDates.push({
      str: dd.getFullYear() + '-' + String(dd.getMonth()+1).padStart(2,'0') + '-' + String(dd.getDate()).padStart(2,'0'),
      day: dd.getDate(), dayName: dayNames[i], isToday: false, isSun: i===6, isSat: i===5
    });
  }
  weekDates.forEach(function(w){ w.isToday = (w.str === todayStr); });
  var endDate = weekDates[6];
  var lbl = document.getElementById('schedNavLabel');
  if (lbl) lbl.textContent =
    (weekStart.getMonth()+1) + '월 ' + weekStart.getDate() + '일 ~ ' +
    (endDate.str.slice(5,7).replace(/^0/,'')) + '월 ' + endDate.day + '일';
  renderTeacherFilter();
  var toggleWrap = document.getElementById('weekViewToggle');
  if (!toggleWrap) {
    toggleWrap = document.createElement('div');
    toggleWrap.id = 'weekViewToggle';
    toggleWrap.style.cssText = 'display:flex;gap:6px;margin:8px 0 4px;';
    var wgElRef = document.getElementById('weekGrid');
    if (wgElRef && wgElRef.parentNode) wgElRef.parentNode.insertBefore(toggleWrap, wgElRef);
  }
  // eslint-disable-next-line no-unsanitized/property
  toggleWrap.innerHTML =
    '<button onclick="_weekViewMode=\'therapist\';renderWeekGrid()" style="font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-family:inherit;' + (_weekViewMode==='therapist'?'background:#0ea5a0;color:#fff;font-weight:700;border-color:#0ea5a0;':'background:#fff;color:#64748b;') + '">👩‍⚕️ 치료사 기준</button>'
    + '<button onclick="_weekViewMode=\'child\';_weekDupOnly=false;renderWeekGrid()" style="font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-family:inherit;' + (_weekViewMode==='child'&&!_weekDupOnly?'background:#0ea5a0;color:#fff;font-weight:700;border-color:#0ea5a0;':'background:#fff;color:#64748b;') + '">👶 아동 기준</button>'
    + '<button onclick="_weekViewMode=\'child\';_weekDupOnly=true;renderWeekGrid()" style="font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-family:inherit;' + (_weekDupOnly?'background:#f97316;color:#fff;font-weight:700;border-color:#f97316;':'background:#fff;color:#64748b;') + '">🔴 중복 수업만</button>';
  var allWeekScheds = scheduleDB.filter(function(s) { return weekDates.some(function(w){ return w.str === s.date; }); });
  var weekScheds = _schedTeacherFilter === '전체' ? allWeekScheds
    : allWeekScheds.filter(function(s){ return (s.therapist||s.teacher) === _schedTeacherFilter; });
  var therapists = [];
  weekScheds.forEach(function(s) {
    var t = s.therapist || s.teacher || '';
    if (t && therapists.indexOf(t) < 0) therapists.push(t);
  });
  therapists.sort();
  if (_weekViewMode === 'child') { renderWeekGridByChild(weekDates, weekScheds); return; }
  var wgEl = document.getElementById('weekGrid');
  if (wgEl) { wgEl.style.display = 'block'; wgEl.style.width = '100%'; }
  var html = '<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
  if (weekScheds.length === 0) {
    html += '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px 0;">이번 주 일정이 없습니다.</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px;">';
    html += '<thead><tr><th style="padding:6px 4px;background:#f8fafc;border:1px solid #e2e8f0;font-size:10px;color:var(--text2);width:60px;min-width:60px;position:sticky;left:0;z-index:3;">치료사</th>';
    weekDates.forEach(function(w) {
      var bg = w.isToday ? 'var(--mint2,#e0f7f6)' : '#f8fafc';
      var col = w.isToday ? 'var(--mint,#0ea5a0)' : (w.isSun ? '#ef4444' : (w.isSat ? '#3b82f6' : 'var(--text2)'));
      html += '<th style="padding:6px 4px;background:' + bg + ';border:1px solid #e2e8f0;color:' + col + ';font-weight:700;text-align:center;cursor:pointer;" onclick="switchToDay(\'' + w.str + '\')">' + w.dayName + '<br><span style="font-size:12px;">' + w.day + '</span></th>';
    });
    html += '</tr></thead><tbody>';
    therapists.forEach(function(t) {
      var color = getTeacherColor(t);
      html += '<tr><td style="padding:5px 6px;border:1px solid #e2e8f0;font-weight:700;font-size:11px;color:' + color + ';background:' + color + '10;white-space:nowrap;vertical-align:top;position:sticky;left:0;z-index:1;">' + escHtml(t) + '</td>';
      weekDates.forEach(function(w) {
        var cells = weekScheds.filter(function(s){ return s.date === w.str && (s.therapist||s.teacher||'') === t; })
          .sort(function(a,b){ return ((a.startTime||a.time)||'') < ((b.startTime||b.time)||'') ? -1 : 1; });
        if (cells.length === 0) {
          html += '<td style="padding:4px;border:1px solid #e2e8f0;height:44px;"></td>';
        } else {
          var items = cells.map(function(s) {
            var child = childDB.find(function(c){ return c.id === s.childId; });
            var time  = (s.startTime||s.time||'').slice(0,5);
            return '<div style="font-size:11px;cursor:pointer;line-height:1.3;padding:1px 0;" onclick="openEditSchedModal(\'' + escHtml(String(s.id)) + '\')">'
              + (time ? '<span style="color:var(--text2);font-size:10px;">' + time + '</span><br>' : '')
              + '<span style="font-weight:700;">' + escHtml(child ? child.name : '?') + '</span></div>';
          }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:2px 0;">');
          html += '<td style="padding:4px 5px;border:1px solid #e2e8f0;background:' + color + '15;vertical-align:top;">' + items + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';
  var wgGrid = document.getElementById('weekGrid');
  if (!wgGrid) return;
  // eslint-disable-next-line no-unsanitized/property
  wgGrid.innerHTML = html;
  renderSessionListForPeriod(weekDates.map(function(w){ return w.str; }));
}

// ─────── 일일 뷰 ───────
function renderDayGrid() {
  var d = schedCurrentDate;
  var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  var dayNames = ['일','월','화','수','목','금','토'];
  var lbl = document.getElementById('schedNavLabel');
  if (lbl) lbl.textContent = (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + dayNames[d.getDay()] + ')';
  renderTeacherFilter();

  var allScheds = scheduleDB.filter(function(s) { return s.date === dateStr; })
    .sort(function(a, b) {
      return (a.startTime||a.time||'') < (b.startTime||b.time||'') ? -1 : 1;
    });
  var dayScheds = _schedTeacherFilter === '전체' ? allScheds
    : allScheds.filter(function(s){ return (s.therapist||s.teacher) === _schedTeacherFilter; });

  var wgEl = document.getElementById('dayGrid');
  if (!wgEl) return;
  wgEl.style.display = 'block'; wgEl.style.width = '100%'; wgEl.style.minWidth = '0';

  var isMobile = window.innerWidth < 768;
  var html = '<div style="width:100%;">';

  if (dayScheds.length === 0) {
    html += '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px 0;">일정이 없습니다.</div>';

  } else if (isMobile) {
    // ── 모바일: 치료사별 카드 리스트 ──
    var therapistMap = {};
    var therapistOrder = [];
    dayScheds.forEach(function(s) {
      var t = s.therapist || s.teacher || '미지정';
      if (!therapistMap[t]) { therapistMap[t] = []; therapistOrder.push(t); }
      therapistMap[t].push(s);
    });
    therapistOrder.forEach(function(t) {
      var color = getTeacherColor(t);
      var scheds = therapistMap[t];
      html += '<div style="margin-bottom:10px;border-radius:10px;overflow:hidden;border:1.5px solid ' + color + '40;background:white;">';
      html += '<div style="background:' + color + '15;padding:10px 14px;border-bottom:1px solid ' + color + '30;display:flex;align-items:center;gap:8px;">';
      html += '<span style="width:10px;height:10px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block;"></span>';
      html += '<span style="font-size:14px;font-weight:700;color:' + color + ';">' + escHtml(t) + '</span>';
      html += '<span style="margin-left:auto;font-size:11px;background:' + color + '20;color:' + color + ';padding:2px 8px;border-radius:10px;font-weight:700;">' + scheds.length + '건</span>';
      html += '</div>';
      scheds.forEach(function(s, idx) {
        var child = childDB.find(function(c){ return c.id === s.childId; });
        var cname = child ? escHtml(child.name) : '?';
        var time = (s.startTime || s.time || '').slice(0, 5);
        var type = escHtml(s.type || '언어재활');
        var border = idx < scheds.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : '';
        html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;' + border + 'background:white;" onclick="openEditSchedModal(\'' + escHtml(String(s.id)) + '\')">'
          + '<div style="font-size:12px;color:var(--text2);min-width:40px;font-weight:600;font-variant-numeric:tabular-nums;">' + time + '</div>'
          + '<div style="width:3px;height:36px;border-radius:2px;background:' + color + ';flex-shrink:0;"></div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:14px;font-weight:700;color:var(--text);">' + cname + '</div>'
          + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">' + type + '</div>'
          + '</div>'
          + '<div style="font-size:20px;color:#cbd5e1;">›</div>'
          + '</div>';
      });
      html += '</div>';
    });

  } else {
    // ── PC: 기존 테이블 ──
    var therapists = [];
    dayScheds.forEach(function(s) {
      var t = s.therapist || s.teacher || '';
      if (t && therapists.indexOf(t) < 0) therapists.push(t);
    });
    var interval = (typeof CENTER_SESSION_INTERVAL !== 'undefined') ? CENTER_SESSION_INTERVAL : 40;
    interval = interval > 0 ? interval : 30; // 0이면 기본값 30분 (무한루프 방지)
    var stdTimes = [];
    for (var mm = 9*60; mm <= 18*60+40; mm += interval) {
      stdTimes.push(String(Math.floor(mm/60)).padStart(2,'0') + ':' + String(mm%60).padStart(2,'0'));
    }
    if (stdTimes.length === 0) return;
    var groups = {};
    var groupOrder = stdTimes.slice();
    groupOrder.forEach(function(t){ groups[t] = []; });
    dayScheds.forEach(function(s) {
      var rawTime = (s.startTime || s.time || '').slice(0, 5);
      if (!rawTime || rawTime.length < 5) {
        if (!groups['시간미정']) { groups['시간미정'] = []; groupOrder.push('시간미정'); }
        groups['시간미정'].push(s); return;
      }
      var rawMm = parseInt(rawTime.slice(0,2))*60 + parseInt(rawTime.slice(3,5));
      var closestTime = stdTimes.reduce(function(best, t) {
        return Math.abs(parseInt(t.slice(0,2))*60 + parseInt(t.slice(3,5)) - rawMm)
             < Math.abs(parseInt(best.slice(0,2))*60 + parseInt(best.slice(3,5)) - rawMm) ? t : best;
      }, stdTimes[0]);
      groups[closestTime].push(s);
    });
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed;">';
    html += '<colgroup><col style="width:60px;">';
    therapists.forEach(function(){ html += '<col>'; });
    html += '</colgroup><thead><tr><th style="padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;color:var(--text2);">시간</th>';
    therapists.forEach(function(t) {
      var color = getTeacherColor(t);
      html += '<th style="padding:6px 8px;background:' + color + '18;border:1px solid #e2e8f0;color:' + color + ';font-weight:700;">' + escHtml(t) + '</th>';
    });
    html += '</tr></thead><tbody>';
    groupOrder.forEach(function(timeKey, ri) {
      var rowBg = ri % 2 === 0 ? '#ffffff' : '#f8fafc';
      html += '<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:700;color:var(--text2);font-size:11px;background:#f8fafc;white-space:nowrap;vertical-align:top;">' + escHtml(timeKey) + '</td>';
      therapists.forEach(function(t) {
        var cell = groups[timeKey].filter(function(s){ return (s.therapist||s.teacher||'') === t; });
        if (cell.length === 0) {
          html += '<td style="padding:5px 8px;border:1px solid #e2e8f0;background:' + rowBg + ';height:52px;"></td>';
        } else {
          var color = getTeacherColor(t);
          var items = cell.map(function(s) {
            var child = childDB.find(function(c){ return c.id === s.childId; });
            var type = escHtml(s.type || '');
            return '<div style="cursor:pointer;padding:2px 0;" onclick="openEditSchedModal(\'' + escHtml(String(s.id)) + '\')">' + '<span style="font-weight:700;">' + escHtml(child ? child.name : '?') + '</span>' + (type ? '<br><span style="color:#64748b;font-size:10px;">' + type + '</span>' : '') + '</div>';
          }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:2px 0;">');
          html += '<td style="padding:5px 8px;border:1px solid #e2e8f0;background:' + color + '15;vertical-align:top;">' + items + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  html += '<button class="sched-add-btn" onclick="openSchedModal(\'' + dateStr + '\',null)" style="margin-top:10px;">+</button></div>';
  // eslint-disable-next-line no-unsanitized/property
  wgEl.innerHTML = html;
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
    var last = new Date(year, month+1, 0).getDate();
    for (var d = 1; d <= last; d++) targetDates.push(ymd(new Date(year, month, d)));
  }
  targetDates.forEach(function(date) {
    scheduleDB.filter(function(s){ return s.date === date; }).forEach(function(s) {
      var child = childDB.find(function(c){ return c.id === s.childId; });
      var hasNote = sessionDB.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
      all.push({ date: date, child: child, sched: s, hasNote: hasNote });
    });
  });
  if (all.length === 0) {
    // eslint-disable-next-line no-unsanitized/property
    el.innerHTML = '<div class="empty"><p>이 기간에 일정이 없습니다.</p></div>';
    return;
  }
  var html = '';
  all.slice(0, 30).forEach(function(item) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">'
      + '<div><div style="font-size:13px;font-weight:700;">' + escHtml(item.child ? item.child.name : '?') + '</div>'
      + '<div style="font-size:11px;color:var(--text2);">📅 ' + item.date
      + (item.sched.startTime ? ' ' + item.sched.startTime.slice(0,5) : '')
      + (item.sched.endTime ? '~' + item.sched.endTime.slice(0,5) : '') + '</div></div>'
      + '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;'
      + (item.hasNote ? 'background:#f0fdf4;color:#15803d' : 'background:#fef2f2;color:#dc2626') + '">'
      + (item.hasNote ? '✅ 기록완료' : '⚠️ 미작성') + '</span></div>';
  });
  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

var _schedModalDate = null;

// 아동 카드 "📅 일정" 버튼 → 해당 아동 미리 선택된 채로 모달 오픈
function openSchedModalForChild(childId) {
  openSchedModal(getTodayKST(), null);
  // 모달이 DOM에 추가된 직후 아동 선택기 값 설정
  setTimeout(function() {
    var sel = document.getElementById('schedChildSel');
    if (sel) {
      sel.value = String(childId);
      // makeSearchable 이 _ssInp 을 달아둔 경우 표시 텍스트도 갱신
      if (sel._ssInp) {
        var c = childDB.find(function(x){ return x.id === String(childId); });
        if (c) sel._ssInp.value = c.name;
      }
    }
  }, 0);
}

function openSchedModal(date, schedId) {
  if (currentUser && currentUser.role === 'parent') { showToast('⚠️ 일정 추가 권한이 없습니다'); return; }
  _schedModalDate = date;
  var opts = childDB.length === 0 ? '<option value="">아동 없음</option>'
    : childDB.map(function(c){ return '<option value="' + c.id + '">' + escHtml(c.name) + '</option>'; }).join('');
  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.id = 'schedModal';
  overlay.onclick = function(e){ if (e.target === overlay) closeSchedModal(); };
  // eslint-disable-next-line no-unsanitized/property
  overlay.innerHTML = '<div class="sched-modal">'
    + '<div class="sched-modal-title">📅 일정 추가</div>'
    + '<div class="form-group"><label class="form-label">아동</label><select class="form-input" id="schedChildSel">' + opts + '</select></div>'
    + '<div class="form-group"><label class="form-label">날짜</label><input class="form-input" type="date" id="schedDateInput" value="' + (date || getTodayKST()) + '"></div>'
    + '<div class="form-row">'
    + '<div style="flex:1;"><label class="form-label">시작 시간</label><input class="form-input" type="time" id="schedStartTime" step="300" onclick="try{this.showPicker();}catch(e){}" oninput="autoCalcEndTime()"></div>'
    + '<div style="flex:1;"><label class="form-label">치료 시간(분)</label><input class="form-input" type="number" id="schedDuration" placeholder="예:40" min="5" max="180" oninput="autoCalcEndTime()"></div></div>'
    + '<div class="form-group"><label class="form-label">종료 시간 <span style="color:var(--mint);font-size:11px;">(자동 계산)</span></label><input class="form-input" type="time" id="schedEndTime" step="300" style="background:#f8fafc;color:var(--mint);font-weight:700;"></div>'
    + '<div class="form-group"><label class="form-label">반복</label><select class="form-input" id="schedRepeat" onchange="toggleRepeatOpt()"><option value="none">반복 없음</option><option value="weekly">매주 반복</option></select></div>'
    + '<div id="schedRepeatOpt" style="display:none;">'
    + '<div class="form-group"><label class="form-label">반복 요일</label><div style="display:flex;gap:7px;margin-top:6px;flex-wrap:wrap;">'
    + '<button type="button" class="day-chip" data-day="0" onclick="toggleDayChip(this)">일</button>'
    + '<button type="button" class="day-chip" data-day="1" onclick="toggleDayChip(this)">월</button>'
    + '<button type="button" class="day-chip" data-day="2" onclick="toggleDayChip(this)">화</button>'
    + '<button type="button" class="day-chip" data-day="3" onclick="toggleDayChip(this)">수</button>'
    + '<button type="button" class="day-chip" data-day="4" onclick="toggleDayChip(this)">목</button>'
    + '<button type="button" class="day-chip" data-day="5" onclick="toggleDayChip(this)">금</button>'
    + '<button type="button" class="day-chip" data-day="6" onclick="toggleDayChip(this)">토</button>'
    + '</div></div>'
    + '<div class="form-group"><label class="form-label">반복 종료일 <span style="color:var(--mint);font-size:11px;">기본 5년</span></label><input class="form-input" type="date" id="schedRepeatUntil"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">담당 선생님</label><select class="form-input" id="schedTeacher"><option value="">불러오는 중...</option></select></div>'
    + '<div class="form-group"><label class="form-label">메모</label><input class="form-input" type="text" id="schedNote" placeholder="특이사항"></div>'
    + '<button class="btn btn-primary" style="margin-top:4px;" onclick="saveSchedFromModal()">✅ 저장</button></div>';
  document.body.appendChild(overlay);
  if (typeof attachModalA11y === 'function') {
    _schedModalRelease = attachModalA11y(overlay, closeSchedModal);
  }
  loadTeacherList(function() {
    var sel = document.getElementById('schedTeacher');
    // eslint-disable-next-line no-unsanitized/property
    if (sel) sel.innerHTML = buildTeacherOptions('');
  });
  makeSearchable('schedChildSel');
}

function autoCalcEndTime() {
  if (!document.getElementById('schedStartTime')) return;
  var st = document.getElementById('schedStartTime').value;
  var dur = parseInt(document.getElementById('schedDuration').value, 10);
  var endEl = document.getElementById('schedEndTime');
  if (!st || !dur || dur <= 0 || !endEl) return;
  if (!/^\d{1,2}:\d{2}$/.test(st)) return; // 형식 검증
  var p = st.split(':');
  var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return;
  var total = h * 60 + m + dur;
  endEl.value = String(Math.floor(total/60)%24).padStart(2,'0') + ':' + String(total%60).padStart(2,'0');
}

function toggleRepeatOpt() {
  var repEl = document.getElementById('schedRepeat');
  var optEl = document.getElementById('schedRepeatOpt');
  if (!repEl || !optEl) return;
  var v = repEl.value;
  optEl.style.display = v === 'none' ? 'none' : 'block';
  if (v !== 'none') {
    var dateVal = document.getElementById('schedDateInput').value;
    if (dateVal) {
      var dow = new Date(dateVal + 'T00:00:00').getDay();
      document.querySelectorAll('.day-chip').forEach(function(c){ if (parseInt(c.dataset.day) === dow) c.classList.add('sel'); });
    }
    var untilEl = document.getElementById('schedRepeatUntil');
    if (untilEl && !untilEl.value) {
      var base = dateVal ? new Date(dateVal + 'T00:00:00') : nowKST();
      base.setFullYear(base.getFullYear() + 5);
      untilEl.value = ymd(base);
    }
  }
}

function toggleDayChip(btn) { btn.classList.toggle('sel'); }
function closeSchedModal() {
  if (_schedModalRelease) { _schedModalRelease(); _schedModalRelease = null; }
  var m = document.getElementById('schedModal'); if (m) m.remove();
}

function saveSchedFromModal() {
  var _saveBtn = document.querySelector('#schedModal .btn-primary');
  if (_saveBtn && _saveBtn.dataset.busy) return;
  if (_saveBtn) _saveBtn.dataset.busy = '1';
  var childSelEl  = document.getElementById('schedChildSel');
  var dateEl      = document.getElementById('schedDateInput');
  var startTimeEl = document.getElementById('schedStartTime');
  var durationEl  = document.getElementById('schedDuration');
  var endTimeEl   = document.getElementById('schedEndTime');
  var repeatEl    = document.getElementById('schedRepeat');
  var noteEl      = document.getElementById('schedNote');
  if (!childSelEl || !dateEl || !startTimeEl || !durationEl || !endTimeEl || !repeatEl || !noteEl) {
    if (_saveBtn) delete _saveBtn.dataset.busy;
    return;
  }
  var childId   = String(childSelEl.value);
  var date      = dateEl.value;
  var startTime = startTimeEl.value;
  var duration  = parseInt(durationEl.value) || 0;
  var endTime   = endTimeEl.value;
  var repeat    = repeatEl.value;
  var until     = repeat !== 'none' ? document.getElementById('schedRepeatUntil').value : '';
  var note      = noteEl.value.trim();
  var teacher   = (document.getElementById('schedTeacher') || {}).value || '';
  if (!childId) { if (_saveBtn) delete _saveBtn.dataset.busy; showToast('아동을 선택해주세요.'); return; }
  if (!date)    { if (_saveBtn) delete _saveBtn.dataset.busy; showToast('날짜를 선택해주세요.'); return; }
  var entries = [];
  var groupId = Date.now();
  if (repeat === 'weekly' && until && until >= date) {
    var selDays = [];
    document.querySelectorAll('.day-chip.sel').forEach(function(c){ selDays.push(parseInt(c.dataset.day)); });
    if (selDays.length === 0) selDays.push(new Date(date + 'T00:00:00').getDay());
    var cur = new Date(date + 'T00:00:00');
    var end = new Date(until + 'T00:00:00');
    var idx = 0;
    while (cur <= end) {
      if (selDays.indexOf(cur.getDay()) > -1) {
        entries.push({ id: Date.now() + idx * 1000, groupId: groupId, childId: childId,
          date: ymd(cur), startTime: startTime, duration: duration,
          endTime: endTime, note: note, teacher: teacher.trim() });
        idx++;
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    entries.push({ id: Date.now() + Math.floor(Math.random() * 1000), childId: childId, date: date,
      startTime: startTime, duration: duration, endTime: endTime, note: note, teacher: teacher.trim() });
  }
  entries.forEach(function(e){ scheduleDB.push(e); });
  if (_saveBtn) delete _saveBtn.dataset.busy;
  saveSchedule(); closeSchedModal(); renderSchedView(); renderUnwrittenAlert();
  showToast('✅ ' + entries.length + '개 일정 추가!');
}

function openEditSchedModal(id) {
  var s = scheduleDB.find(function(x){ return x.id === id; });
  if (!s) { showToast('⚠️ 일정 정보를 찾을 수 없습니다'); return; }
  var child = childDB.find(function(c){ return c.id === s.childId; });
  var hasGroup = s.groupId && scheduleDB.filter(function(x){ return x.groupId === s.groupId && x.date >= s.date; }).length > 1;
  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay'; overlay.id = 'editSchedOverlay';
  overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };
  // eslint-disable-next-line no-unsanitized/property
  overlay.innerHTML = '<div class="sched-modal">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    + '<div class="sched-modal-title" style="margin-bottom:0;">📅 일정 상세</div>'
    + '<button onclick="document.getElementById(\'editSchedOverlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;">'
    + '<div style="font-size:15px;font-weight:700;color:var(--mint);">' + escHtml(child ? child.name : '?') + '</div>'
    + (s.teacher ? '<div style="font-size:12px;color:var(--text2);">👤 ' + escHtml(s.teacher) + '</div>' : '') + '</div>'
    + '<div class="form-group"><label class="form-label">날짜</label><input class="form-input" type="date" id="editSchedDate" value="' + escHtml(s.date||'') + '"></div>'
    + '<div class="form-row">'
    + '<div style="flex:1;"><label class="form-label">시작 시간</label><input class="form-input" type="time" id="editSchedStart" step="300" value="' + escHtml((s.startTime||s.time)||'') + '" onclick="try{this.showPicker();}catch(e){}"></div>'
    + '<div style="flex:1;"><label class="form-label">치료 시간(분)</label><input class="form-input" type="number" id="editSchedDur" value="' + (s.duration||'') + '" min="5" max="180" placeholder="예:40"></div></div>'
    + '<div class="form-group"><label class="form-label">담당 선생님</label><select class="form-input" id="editSchedTeacher">' + buildTeacherOptions(s.teacher||'') + '</select></div>'
    + '<div class="form-group"><label class="form-label">메모</label><textarea class="form-input" id="editSchedNote" style="min-height:60px;">' + escHtml(s.note||'') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;margin-top:8px;">'
    + '<button class="btn btn-primary" style="flex:1;margin-top:0;background:var(--blue);border-color:var(--blue);" onclick="goToSessionFromSched(\'' + escHtml(String(id)) + '\')">📝 회기기록</button>'
    + (currentUser && currentUser.role === 'admin'
      ? '<button class="btn btn-primary" style="flex:1;margin-top:0;" onclick="saveEditSched(\'' + escHtml(String(id)) + '\')">💾 수정</button>'
      + '<button class="btn-del" style="flex:0.6;padding:11px 10px;font-size:13px;" onclick="confirmSchedDelete(\'' + escHtml(String(id)) + '\',' + (hasGroup?1:0) + ')">🗑️ 삭제</button>' : '')
    + '</div></div>';
  document.body.appendChild(overlay);
  if (typeof attachModalA11y === 'function') {
    attachModalA11y(overlay, function() { overlay.remove(); });
  }
  loadTeacherList(function() {
    var sel = document.getElementById('editSchedTeacher');
    // eslint-disable-next-line no-unsanitized/property
    if (sel) sel.innerHTML = buildTeacherOptions(s.teacher||'');
  });
}

function goToSessionFromSched(schedId) {
  var s = scheduleDB.find(function(x){ return x.id === schedId; });
  if (!s) { showToast('⚠️ 일정 정보를 찾을 수 없습니다'); return; }
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
    var dateEl = document.getElementById('sessionDate');
    if (s.date && dateEl) dateEl.value = s.date;
  }, 200);
}

function renderWeekGridByChild(weekDates, weekScheds) {
  var wgEl = document.getElementById('weekGrid');
  if (!wgEl) return;
  wgEl.style.display = 'block'; wgEl.style.width = '100%';
  var childIds = [];
  weekScheds.forEach(function(s){ if (s.childId && childIds.indexOf(s.childId) < 0) childIds.push(s.childId); });
  if (_weekDupOnly) {
    childIds = childIds.filter(function(cid){
      return weekDates.some(function(w){ return weekScheds.filter(function(s){ return s.date===w.str&&s.childId===cid; }).length >= 2; });
    });
  }
  childIds.sort(function(a, b){
    var ca = childDB.find(function(c){ return c.id===a; });
    var cb = childDB.find(function(c){ return c.id===b; });
    return (ca ? ca.name : '') < (cb ? cb.name : '') ? -1 : 1;
  });
  if (childIds.length === 0) {
    // eslint-disable-next-line no-unsanitized/property
    wgEl.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px 0;">' + (_weekDupOnly ? '이번 주에 같은 날 중복 수업 아동이 없습니다.' : '이번 주 일정이 없습니다.') + '</div>';
    return;
  }
  var html = '<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px;">';
  var todayStr = getTodayKST();
  html += '<thead><tr><th style="padding:6px 4px;background:#f8fafc;border:1px solid #e2e8f0;font-size:10px;color:var(--text2);width:64px;min-width:64px;position:sticky;left:0;z-index:3;">아동</th>';
  weekDates.forEach(function(w) {
    var bg  = w.isToday ? 'var(--mint2,#e0f7f6)' : '#f8fafc';
    var col = w.isToday ? 'var(--mint,#0ea5a0)' : (w.isSun ? '#ef4444' : (w.isSat ? '#3b82f6' : 'var(--text2)'));
    html += '<th style="padding:6px 4px;background:' + bg + ';border:1px solid #e2e8f0;color:' + col + ';font-weight:700;text-align:center;cursor:pointer;" onclick="switchToDay(\'' + w.str + '\')">' + w.dayName + '<br><span style="font-size:12px;">' + w.day + '</span></th>';
  });
  html += '</tr></thead><tbody>';
  childIds.forEach(function(childId) {
    var child = childDB.find(function(c){ return c.id === childId; });
    var cname = child ? escHtml(child.name) : '?';
    var cage  = child ? escHtml(child.age || '') : '';
    var ccolor = (child && child.color) ? child.color : '#0ea5a0';
    html += '<tr><td style="padding:5px 6px;border:1px solid #e2e8f0;font-weight:700;font-size:11px;color:' + ccolor + ';background:' + ccolor + '10;white-space:nowrap;vertical-align:top;position:sticky;left:0;z-index:1;">'
      + cname + (cage ? '<br><span style="font-size:9px;font-weight:400;color:var(--text2);">' + cage + '</span>' : '') + '</td>';
    weekDates.forEach(function(w) {
      var daySched = weekScheds.filter(function(s){ return s.date===w.str && s.childId===childId; })
        .sort(function(a,b){ return ((a.startTime||a.time)||'') < ((b.startTime||b.time)||'') ? -1 : 1; });
      if (daySched.length === 0) {
        html += '<td style="padding:4px;border:1px solid #e2e8f0;height:40px;"></td>';
      } else {
        var items = daySched.map(function(s) {
          var t = s.therapist || s.teacher || '';
          var tcolor = getTeacherColor(t);
          var time = (s.startTime||s.time||'').slice(0,5);
          return '<div style="font-size:11px;cursor:pointer;line-height:1.4;padding:2px 0;" onclick="openEditSchedModal(\'' + escHtml(String(s.id)) + '\')">' + (time ? '<span style="color:var(--text2);font-size:10px;">' + time + '</span><br>' : '') + '<span style="font-weight:700;color:' + tcolor + ';background:' + tcolor + '15;border-radius:4px;padding:0 4px;">' + escHtml(t) + '</span></div>';
        }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:2px 0;">');
        var bgStyle = daySched.length >= 2 ? 'background:#fff7ed;border:1px solid #fed7aa;' : 'border:1px solid #e2e8f0;';
        html += '<td style="padding:4px 5px;' + bgStyle + 'vertical-align:top;">' + items + '</td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  // eslint-disable-next-line no-unsanitized/property
  wgEl.innerHTML = html;
}

function confirmSchedDelete(id, hasGroup) {
  var s = scheduleDB.find(function(x){ return x.id===id; });
  if (!s) return;
  if (!hasGroup) {
    showConfirm('이 일정을 삭제할까요?', function() {
      var ol = document.getElementById('editSchedOverlay'); if (ol) ol.remove();
      execSchedDelete(id, false);
    });
    return;
  }
  var delOv = document.createElement('div');
  delOv.id = 'delSchedOverlay';
  delOv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;';
  delOv.innerHTML = '<div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:320px;">'
    + '<div style="text-align:center;font-size:32px;margin-bottom:12px;">⚠️</div>'
    + '<div style="font-size:16px;font-weight:700;text-align:center;margin-bottom:6px;">삭제하시겠습니까?</div>'
    + '<div style="font-size:13px;color:var(--text2);text-align:center;margin-bottom:18px;">이후의 반복 일정도 삭제하시겠습니까?</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">'
    + '<label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid var(--mint);border-radius:10px;cursor:pointer;"><input type="radio" name="delOpt" value="one" checked style="accent-color:var(--mint);width:16px;height:16px;"> <div><div style="font-weight:700;font-size:14px;">이번일정만</div></div></label>'
    + '<label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;"><input type="radio" name="delOpt" value="future" style="accent-color:var(--mint);width:16px;height:16px;"> <div><div style="font-weight:700;font-size:14px;">이후 반복일정포함</div></div></label>'
    + '</div><div style="display:flex;gap:8px;">'
    + '<button class="btn-ghost" style="flex:1;" onclick="document.getElementById(\'delSchedOverlay\').remove();document.removeEventListener(\'keydown\',_delEsc)">아니요</button>'
    + '<button class="btn btn-primary" style="flex:1;margin-top:0;background:#ef4444;border-color:#ef4444;" onclick="execSchedDeleteChoice(\'' + escHtml(String(id)) + '\')">네, 삭제하겠습니다</button>'
    + '</div></div>';
  document.body.appendChild(delOv);
  var _delEsc = function(e) {
    var ol = document.getElementById('delSchedOverlay');
    if (!ol) { document.removeEventListener('keydown', _delEsc); return; }
    if (e.key === 'Escape') { ol.remove(); document.removeEventListener('keydown', _delEsc); }
  };
  document.addEventListener('keydown', _delEsc);
}

function execSchedDeleteChoice(id) {
  var opt = document.querySelector('input[name="delOpt"]:checked');
  var future = opt && opt.value === 'future';
  var ol1 = document.getElementById('editSchedOverlay');
  var ol2 = document.getElementById('delSchedOverlay');
  if (ol1) ol1.remove(); if (ol2) ol2.remove();
  execSchedDelete(id, future);
}

function execSchedDelete(id, future) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ 관리자만 일정을 삭제할 수 있습니다.');
    return;
  }
  var s = scheduleDB.find(function(x){ return x.id === id; });
  if (!s) return;
  var toDeleteItems = future && s.groupId
    ? scheduleDB.filter(function(x){ return x.groupId === s.groupId && x.date >= s.date; })
    : [s];
  var toDeleteIds = toDeleteItems.map(function(x){ return x.id; });
  var snapshot = toDeleteItems.map(function(x){ return Object.assign({}, x); });
  var failedIds = [];
  // 서버 DELETE 모두 시도 후 실패한 id는 로컬에서도 복원 (서버/로컬 불일치 방지)
  Promise.all(toDeleteIds.map(function(did){
    return supaFetch('madi_schedules?id=eq.' + did + '&center_id=eq.' + currentUser.center_id, 'DELETE')
      .catch(function(e){ console.warn('일정 삭제 실패 id=' + did, e); failedIds.push(did); });
  })).then(function(){
    scheduleDB = scheduleDB.filter(function(x){ return toDeleteIds.indexOf(x.id) === -1 || failedIds.indexOf(x.id) !== -1; });
    // 실패한 항목은 snapshot에서 다시 복원
    if (failedIds.length > 0) {
      snapshot.forEach(function(item){
        if (failedIds.indexOf(item.id) !== -1) {
          if (!scheduleDB.find(function(x){ return x.id === item.id; })) scheduleDB.push(item);
        }
      });
    }
    saveSchedule(); renderSchedView();
    var cn = (childDB.find(function(c){ return c.id === s.childId; }) || {}).name || '';
    var okCount = toDeleteIds.length - failedIds.length;
    if (failedIds.length > 0) {
      showToast('⚠️ ' + okCount + '개 삭제, ' + failedIds.length + '개 실패 (네트워크 확인)');
    } else {
      showToast('🗑️ ' + (cn ? cn + ' ' : '') + okCount + '개 일정 삭제됨', {
        undo: function(){
          snapshot.forEach(function(item){ scheduleDB.push(item); });
          saveSchedule(); renderSchedView();
          showToast('↩️ 일정이 복원되었습니다');
        }
      });
    }
  }).catch(function(e){ showToast('⚠️ 일정 삭제 중 오류: ' + e.message); });
}

function saveEditSched(id) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ 관리자만 일정을 수정할 수 있습니다.');
    return;
  }
  var idx = scheduleDB.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var date    = (document.getElementById('editSchedDate')||{}).value || '';
  var start   = (document.getElementById('editSchedStart')||{}).value || '';
  var dur     = parseInt((document.getElementById('editSchedDur')||{}).value) || 0;
  var teacher = (document.getElementById('editSchedTeacher')||{}).value.trim();
  var note    = (document.getElementById('editSchedNote')||{}).value.trim();
  var endTime = '';
  if (start && dur) {
    var parts = start.split(':');
    if (!parts || parts.length < 2) { saveSchedule(); var ol2 = document.getElementById('editSchedOverlay'); if (ol2) ol2.remove(); renderSchedView(); showToast('✅ 일정 수정 완료!'); return; }
    var mins  = parseInt(parts[0]) * 60 + parseInt(parts[1]) + dur;
    endTime = String(Math.floor(mins/60)%24).padStart(2,'0') + ':' + String(mins%60).padStart(2,'0');
  }
  scheduleDB[idx] = Object.assign({}, scheduleDB[idx], { date:date, startTime:start, duration:dur, endTime:endTime, teacher:teacher, note:note });
  saveSchedule();
  var ol = document.getElementById('editSchedOverlay'); if (ol) ol.remove();
  renderSchedView();
  showToast('✅ 일정 수정 완료!');
}

// ─────── 일정 내보내기 ───────
function openScheduleExportModal() {
  var modal = document.getElementById('schedExportModal');
  if (!modal) return;

  // 기본 날짜: 이번 달 1일 ~ 말일
  var today = new Date();
  var y = today.getFullYear(), m = today.getMonth();
  var firstDay = new Date(y, m, 1);
  var lastDay  = new Date(y, m + 1, 0);
  function fmt(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  var fromEl = document.getElementById('exportDateFrom');
  var toEl   = document.getElementById('exportDateTo');
  if (fromEl) fromEl.value = fmt(firstDay);
  if (toEl)   toEl.value   = fmt(lastDay);

  // 선생님 필터 옵션 채우기
  var sel = document.getElementById('exportTeacherFilter');
  if (sel) {
    var teachers = [];
    (scheduleDB || []).forEach(function(s) { if (s.teacher && teachers.indexOf(s.teacher) === -1) teachers.push(s.teacher); });
    teachers.sort();
    // eslint-disable-next-line no-unsanitized/property
    sel.innerHTML = '<option value="">전체</option>'
      + teachers.map(function(t){ return '<option value="'+escHtml(t)+'">'+escHtml(t)+'</option>'; }).join('');
    if (currentUser && currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
      sel.value = currentUser.name || '';
    }
  }

  modal.style.display = 'flex';
}

function closeScheduleExportModal() {
  var modal = document.getElementById('schedExportModal');
  if (modal) modal.style.display = 'none';
}

function _getExportRows() {
  var from    = (document.getElementById('exportDateFrom') || {}).value || '';
  var to      = (document.getElementById('exportDateTo')   || {}).value || '';
  var teacher = (document.getElementById('exportTeacherFilter') || {}).value || '';
  if (!from || !to) { showToast('⚠️ 날짜 범위를 선택해주세요'); return null; }
  if (from > to)    { showToast('⚠️ 종료일이 시작일보다 앞입니다'); return null; }

  var rows = (scheduleDB || []).filter(function(s) {
    return s.date >= from && s.date <= to && (!teacher || s.teacher === teacher);
  }).sort(function(a, b) {
    var d = (a.date||'').localeCompare(b.date||'');
    return d !== 0 ? d : ((a.startTime||'') < (b.startTime||'') ? -1 : 1);
  });

  if (!rows.length) { showToast('⚠️ 해당 기간에 일정이 없습니다'); return null; }
  return rows.map(function(s) {
    var child = (childDB || []).find(function(c){ return String(c.id) === String(s.childId); });
    return {
      날짜:        s.date || '',
      시작시간:    (s.startTime || '').slice(0, 5),
      종료시간:    (s.endTime   || '').slice(0, 5),
      이용자:      child ? (child.name || '') : ('ID:' + s.childId),
      선생님:      s.teacher || '',
      프로그램유형: child ? (child.type || child.program || '') : '',
      바우처:      child ? (child.voucherType || '일반') : '일반',
      메모:        s.note || ''
    };
  });
}

function exportSchedule(format) {
  var rows = _getExportRows();
  if (!rows) return;
  var fromEl = document.getElementById('exportDateFrom');
  var toEl   = document.getElementById('exportDateTo');
  if (!fromEl || !toEl) return;
  var from = fromEl.value;
  var to   = toEl.value;
  var label = from + '~' + to;

  if (format === 'excel') {
    if (typeof showToast === 'function') showToast('📥 엑셀 모듈 준비 중...');
    ensureXLSX().then(function() {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        {wch:12},{wch:8},{wch:8},{wch:12},{wch:10},{wch:14},{wch:8},{wch:24}
      ];
      XLSX.utils.book_append_sheet(wb, ws, '일정');
      XLSX.writeFile(wb, '아이마디아이_일정_' + label + '.xlsx');
      showToast('✅ 엑셀 파일이 저장됐습니다');
      closeScheduleExportModal();
    }).catch(function(e) { showToast('⚠️ ' + (e && e.message ? e.message : e)); });

  } else if (format === 'pdf') {
    _printSchedule(rows, label);

  } else if (format === 'hwp') {
    _exportScheduleRtf(rows, label);
  }
}

function _printSchedule(rows, label) {
  var eh   = escHtml; // XSS 방어 — document.write 대상이므로 필수
  var html = '<html><head><meta charset="utf-8"><title>일정표 ' + eh(label) + '</title>'
    + '<style>'
    + 'body{font-family:"맑은 고딕","Malgun Gothic",sans-serif;font-size:12px;padding:20px;}'
    + 'h2{font-size:16px;margin-bottom:12px;}'
    + 'table{width:100%;border-collapse:collapse;}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}'
    + 'th{background:#e8f5f0;font-weight:700;}'
    + 'tr:nth-child(even){background:#f9fafb;}'
    + '@media print{@page{margin:15mm;}}'
    + '</style></head><body>'
    + '<h2>📅 일정표 (' + eh(label) + ')</h2>'
    + '<table><thead><tr>'
    + '<th>날짜</th><th>시작</th><th>종료</th><th>이용자</th><th>선생님</th><th>프로그램유형</th><th>바우처</th><th>메모</th>'
    + '</tr></thead><tbody>'
    + rows.map(function(r) {
        return '<tr><td>'+eh(r.날짜||'')+'</td><td>'+eh(r.시작시간||'')+'</td><td>'+eh(r.종료시간||'')+'</td>'
          +'<td>'+eh(r.이용자||'')+'</td><td>'+eh(r.선생님||'')+'</td><td>'+eh(r.프로그램유형||'')+'</td>'
          +'<td>'+eh(r.바우처||'')+'</td><td>'+eh(r.메모||'')+'</td></tr>';
      }).join('')
    + '</tbody></table>'
    + '<p style="font-size:10px;color:#999;margin-top:12px;">출력일: ' + new Date().toLocaleDateString('ko-KR') + ' | 아이마디아이</p>'
    + '</body></html>';

  var win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { showToast('⚠️ 팝업 차단을 해제하고 다시 시도해주세요'); return; }
  // eslint-disable-next-line no-unsanitized/method
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function(){ win.print(); }, 400);
  closeScheduleExportModal();
}

function _exportScheduleRtf(rows, label) {
  // RTF 형식 — 한글(HWP) 에서 열기 가능
  var lines = [
    '{\\rtf1\\ansi\\ansicpg949\\deff0',
    '{\\fonttbl{\\f0\\fnil\\fcharset129 \\\'b8\\\'cb\\\'c0\\\'ba \\\'b0\\\'ed\\\'b5\\\'f1;}}',
    '\\f0\\fs22',
    '\\b \\u51068?\\u35519?\\ud45c (' + label + ')\\b0\\par',
    '\\par',
    '{\\trowd'
  ];

  // 단순 탭 구분 텍스트로 생성 (HWP에서 열면 표 복사 가능)
  var header = '날짜\t시작시간\t종료시간\t이용자\t선생님\t프로그램유형\t바우처\t메모';
  var body = rows.map(function(r){
    return [r.날짜, r.시작시간, r.종료시간, r.이용자, r.선생님, r.프로그램유형, r.바우처, r.메모].join('\t');
  }).join('\n');

  var content = '일정표 (' + label + ')\r\n\r\n' + header + '\r\n' + body + '\r\n\r\n출력일: ' + new Date().toLocaleDateString('ko-KR') + ' | 아이마디아이';
  var blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = '아이마디아이_일정_' + label + '_한글용.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('💡 .txt 파일을 한글(HWP)에서 열어 표로 변환하세요');
  closeScheduleExportModal();
}

// ─────── 표준화 검사 ───────
