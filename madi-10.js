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
  var selChildId = parseInt(document.getElementById('sessionChild') && document.getElementById('sessionChild').value) || 0;
  var unwritten = getUnwrittenSessions();
  if (selChildId) {
    unwritten = unwritten.filter(function(u) {
      var ch = childDB.find(function(c){ return c.id === selChildId; });
      return ch && u.childName === ch.name;
    });
  }
  if (unwritten.length === 0) { el.innerHTML = ''; return; }

  // 선생님별 그룹화
  var byTeacher = {};
  unwritten.forEach(function(u) {
    var t = u.teacher || '미지정';
    if (!byTeacher[t]) byTeacher[t] = [];
    byTeacher[t].push(u);
  });

  var html = '<div class="unwritten-card">'
    + '<div class="unwritten-title" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;" '
    + 'onclick="toggleUwBody()" data-uwbody="uwBody">'
    + '<span>⚠️ 미작성 세션 ' + unwritten.length + '개</span>'
    + '<span class="uw-arrow" style="font-size:11px;color:var(--text2);">▼</span>'
    + '</div>'
    + '<div id="uwBody" style="display:none;">';

  Object.keys(byTeacher).sort().forEach(function(teacher) {
    var items = byTeacher[teacher];
    var uid = 'uw_' + teacher.replace(/[^a-zA-Z0-9\uAC00-\uD7A3]/g, '_');
    html += '<div style="margin-top:8px;">'
      + '<div onclick="toggleUwTeacher(this)" data-uwid="' + uid + '" '
      + 'style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--mint2,#f0fdfa);border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;color:var(--mint,#0ea5a0);">'
      + '<span>👤 ' + escHtml(teacher) + '</span>'
      + '<span style="display:flex;align-items:center;gap:6px;">'
      + '<span style="font-size:11px;font-weight:400;color:var(--text2);">' + items.length + '건</span>'
      + '<span class="uw-t-arrow" style="font-size:11px;">▶</span>'
      + '</span></div>'
      + '<div id="' + uid + '" style="display:none;margin-top:2px;">';
    items.forEach(function(u) {
      html += '<div class="unwritten-item">'
        + '<span>📅 ' + u.date + ' · ' + escHtml(u.childName) + '</span>'
        + '<button class="btn-ghost" style="font-size:11px;padding:7px 12px;" onclick="quickFillSession(this)" data-date="' + u.date + '" data-schedid="' + u.schedId + '">지금 작성</button>'
        + '</div>';
    });
    html += '</div></div>';
  });

  html += '</div></div>';
  el.innerHTML = html;
}

// ─── 미작성 세션 토글 함수 (12계명 13번 준수) ───
function toggleUwBody() {
  var b = document.getElementById('uwBody');
  if (!b) return;
  var titleDiv = document.querySelector('[data-uwbody="uwBody"]');
  var a = titleDiv ? titleDiv.querySelector('.uw-arrow') : null;
  if (b.style.display === 'none') {
    b.style.display = 'block';
    if (a) a.textContent = '▲';
  } else {
    b.style.display = 'none';
    if (a) a.textContent = '▼';
  }
}
function toggleUwTeacher(el) {
  var uid = el.dataset.uwid;
  if (!uid) return;
  var b = document.getElementById(uid);
  if (!b) return;
  var a = el.querySelector('.uw-t-arrow');
  if (b.style.display === 'none') {
    b.style.display = 'block';
    if (a) a.textContent = '▲';
  } else {
    b.style.display = 'none';
    if (a) a.textContent = '▶';
  }
}
function quickFillSession(el) {
  var date    = el.dataset.date;
  var schedId = Number(el.dataset.schedid);
  var sched = scheduleDB.find(function(s) { return s.id === schedId; });
  if (!sched) return;
  // 보고서 탭 → 세션기록 서브탭으로 이동
  if (typeof switchTab === 'function') switchTab(2);
  if (typeof switchReportTab === 'function') switchReportTab('session');
  // 아동 + 날짜 자동 설정 (탭 렌더링 후 실행)
  setTimeout(function() {
    var childEl = document.getElementById('sessionChild');
    var dateEl  = document.getElementById('sessionDate');
    if (childEl) { childEl.value = sched.childId; childEl.dispatchEvent(new Event('change')); }
    if (dateEl)  dateEl.value = date;
    if (typeof loadGoalRows === 'function') loadGoalRows(sched.childId);
    // 세션 기록 폼으로 스크롤
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
  ['month','week','day'].forEach(function(tab) {
    var btn = document.getElementById('viewBtn_' + tab);
    if (btn) btn.classList[v === tab ? 'add' : 'remove']('active');
  });
  // 하위 호환: 구형 viewBtnMonth/viewBtnWeek ID
  var mBtn = document.getElementById('viewBtnMonth');
  if (mBtn) mBtn.classList[v==='month'?'add':'remove']('active');
  var wBtn = document.getElementById('viewBtnWeek');
  if (wBtn) { wBtn.classList[v==='week'?'add':'remove']('active'); wBtn.textContent = '주간'; }
  // 각 뷰 wrap 표시 제어
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

// ─────── 선생님 필터 ───────
var _schedTeacherFilter = '전체';
var _weekViewMode  = 'therapist'; // 'therapist' | 'child'
var _weekDupOnly   = false;        // 중복 수업 아동만 보기

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

// ─────── 월간/주간에서 날짜 클릭 시 일일 뷰로 이동 ───────
function switchToDay(dateStr) {
  schedCurrentDate = new Date(dateStr + 'T00:00:00');
  setSchedView('day');
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
  else if (schedView === 'week') renderWeekGrid();
  else renderDayGrid();
}

function renderMonthGrid() {
  var year  = schedCurrentDate.getFullYear();
  var month = schedCurrentDate.getMonth();
  var today = new Date().toISOString().slice(0, 10);
  document.getElementById('schedNavLabel').textContent = year + '년 ' + (month + 1) + '월';
  var firstDay = new Date(year, month, 1).getDay();
  var lastDate = new Date(year, month + 1, 0).getDate();
  var cells = [];
  function toLocal(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  }
  for (var i = 0; i < firstDay; i++) {
    var pd = new Date(year, month, -(firstDay - i - 1));
    cells.push({ date: toLocal(pd), other: true });
  }
  for (var d = 1; d <= lastDate; d++) {
    var dt = new Date(year, month, d);
    cells.push({ date: toLocal(dt), other: false });
  }
  while (cells.length % 7 !== 0) {
    var nd = new Date(year, month + 1, cells.length - firstDay - lastDate + 1);
    cells.push({ date: toLocal(nd), other: true });
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
      var therapist = s.therapist || s.teacher || '';
      var color = therapist ? getTeacherColor(therapist) : (child ? child.color : '#64748b');
      var lbl = ((s.startTime||s.time) ? (s.startTime||s.time).slice(0,5)+' ' : '');
      if (therapist) lbl += therapist;
      if (child) lbl += '(' + child.name + ')';
      html += '<span class="sched-tag" style="background:' + color + '33;color:' + color + ';border-left:3px solid ' + color + ';font-weight:600;"'
        + ' onclick="event.stopPropagation();switchToDay(\'' + cell.date + '\')">' + escHtml(lbl) + '</span>';
    });
    if (extra > 0) html += '<span class="sched-more">+' + extra + '개 더</span>';
    if (hiddenByFilter > 0) html += '<span class="sched-more" style="color:#94a3b8;">외 ' + hiddenByFilter + '건 숨김</span>';
    html += '</div>';
  });
  document.getElementById('monthGrid').innerHTML = html;
  renderSessionListForPeriod();
}

// ─────── 주간 뷰 (7일 컬럼) ───────
function toggleWeekViewMode() {
  _weekViewMode = (_weekViewMode === 'therapist') ? 'child' : 'therapist';
  renderWeekGrid();
}

function renderWeekGrid() {
  var d = schedCurrentDate;
  // 해당 주의 월요일 기준으로 7일 계산
  var dow = d.getDay(); // 0=일
  var mondayOffset = (dow === 0) ? -6 : 1 - dow;
  var weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
  var dayNames = ['월','화','수','목','금','토','일'];
  var todayStr = new Date().toISOString().slice(0,10);

  // 7일 날짜 배열
  var weekDates = [];
  for (var i = 0; i < 7; i++) {
    var dd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    weekDates.push({
      str: dd.getFullYear() + '-' + String(dd.getMonth()+1).padStart(2,'0') + '-' + String(dd.getDate()).padStart(2,'0'),
      day: dd.getDate(),
      dayName: dayNames[i],
      isToday: false,
      isSun: i === 6,
      isSat: i === 5
    });
  }
  weekDates.forEach(function(w){ w.isToday = (w.str === todayStr); });

  var endDate = weekDates[6];
  document.getElementById('schedNavLabel').textContent =
    (weekStart.getMonth()+1) + '월 ' + weekStart.getDate() + '일 ~ ' +
    (endDate.str.slice(5,7).replace(/^0/,'')) + '월 ' + endDate.day + '일';

  renderTeacherFilter();

  // 뷰 모드 토글 버튼 렌더링
  var toggleWrap = document.getElementById('weekViewToggle');
  if (!toggleWrap) {
    toggleWrap = document.createElement('div');
    toggleWrap.id = 'weekViewToggle';
    toggleWrap.style.cssText = 'display:flex;gap:6px;margin:8px 0 4px;';
    var wgElRef = document.getElementById('weekGrid');
    if (wgElRef && wgElRef.parentNode) wgElRef.parentNode.insertBefore(toggleWrap, wgElRef);
  }
  toggleWrap.innerHTML =
    '<button onclick="_weekViewMode=\'therapist\';renderWeekGrid()" style="font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-family:inherit;'
    + (_weekViewMode === 'therapist' ? 'background:#0ea5a0;color:#fff;font-weight:700;border-color:#0ea5a0;' : 'background:#fff;color:#64748b;') + '">👩‍⚕️ 치료사 기준</button>'
    + '<button onclick="_weekViewMode=\'child\';_weekDupOnly=false;renderWeekGrid()" style="font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-family:inherit;'
    + (_weekViewMode === 'child' && !_weekDupOnly ? 'background:#0ea5a0;color:#fff;font-weight:700;border-color:#0ea5a0;' : 'background:#fff;color:#64748b;') + '">👶 아동 기준</button>'
    + '<button onclick="_weekViewMode=\'child\';_weekDupOnly=true;renderWeekGrid()" style="font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-family:inherit;'
    + (_weekDupOnly ? 'background:#f97316;color:#fff;font-weight:700;border-color:#f97316;' : 'background:#fff;color:#64748b;') + '">🔴 중복 수업만</button>';

  // 주간 내 모든 일정
  var allWeekScheds = scheduleDB.filter(function(s) {
    return weekDates.some(function(w){ return w.str === s.date; });
  });
  var weekScheds = _schedTeacherFilter === '전체' ? allWeekScheds
    : allWeekScheds.filter(function(s){ return (s.therapist||s.teacher) === _schedTeacherFilter; });

  // 치료사 목록
  var therapists = [];
  weekScheds.forEach(function(s) {
    var t = s.therapist || s.teacher || '';
    if (t && therapists.indexOf(t) < 0) therapists.push(t);
  });
  therapists.sort();

  // 아동 기준 뷰 분기
  if (_weekViewMode === 'child') {
    renderWeekGridByChild(weekDates, weekScheds);
    return;
  }

  var wgEl = document.getElementById('weekGrid');
  if (wgEl) { wgEl.style.display = 'block'; wgEl.style.width = '100%'; }

  var html = '<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">';

  if (weekScheds.length === 0) {
    html += '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px 0;">이번 주 일정이 없습니다.</div>';
  } else {
    // 날짜 헤더 + 치료사별 행
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px;">';
    // 날짜 헤더 행
    html += '<thead><tr><th style="padding:6px 4px;background:#f8fafc;border:1px solid #e2e8f0;font-size:10px;color:var(--text2);width:60px;min-width:60px;position:sticky;left:0;z-index:3;">치료사</th>';
    weekDates.forEach(function(w) {
      var bg = w.isToday ? 'var(--mint2,#e0f7f6)' : '#f8fafc';
      var col = w.isToday ? 'var(--mint,#0ea5a0)' : (w.isSun ? '#ef4444' : (w.isSat ? '#3b82f6' : 'var(--text2)'));
      html += '<th style="padding:6px 4px;background:' + bg + ';border:1px solid #e2e8f0;color:' + col + ';font-weight:700;text-align:center;cursor:pointer;" onclick="switchToDay(\'' + w.str + '\')">'
        + w.dayName + '<br><span style="font-size:12px;">' + w.day + '</span></th>';
    });
    html += '</tr></thead><tbody>';

    // 날짜별 중복 아동 계산 (같은 날 2명 이상 치료사에게 있는 아동)
    var duplicateMap = {};
    weekDates.forEach(function(w) {
      var dayScheds = weekScheds.filter(function(s){ return s.date === w.str; });
      var childCount = {};
      dayScheds.forEach(function(s) {
        if (s.childId) childCount[s.childId] = (childCount[s.childId] || 0) + 1;
      });
      var dupIds = [];
      Object.keys(childCount).forEach(function(id) {
        if (childCount[id] >= 2) dupIds.push(parseInt(id));
      });
      duplicateMap[w.str] = dupIds;
    });

    // 치료사별 행
    therapists.forEach(function(t) {
      var color = getTeacherColor(t);
      html += '<tr>';
      html += '<td style="padding:5px 6px;border:1px solid #e2e8f0;font-weight:700;font-size:11px;color:' + color + ';background:' + color + '10;white-space:nowrap;vertical-align:top;position:sticky;left:0;z-index:1;">' + escHtml(t) + '</td>';
      weekDates.forEach(function(w) {
        var cells = weekScheds.filter(function(s){ return s.date === w.str && (s.therapist||s.teacher||'') === t; })
          .sort(function(a,b){ return ((a.startTime||a.time)||'') < ((b.startTime||b.time)||'') ? -1 : 1; });
        if (cells.length === 0) {
          html += '<td style="padding:4px;border:1px solid #e2e8f0;height:44px;"></td>';
        } else {
          var items = cells.map(function(s) {
            var child = childDB.find(function(c){ return c.id === s.childId; });
            var cname = child ? escHtml(child.name) : '?';
            var time  = (s.startTime||s.time||'').slice(0,5);
            return '<div style="font-size:11px;cursor:pointer;line-height:1.3;padding:1px 0;" onclick="openEditSchedModal(\'' + s.id + '\')">'
              + (time ? '<span style="color:var(--text2);font-size:10px;">' + time + '</span><br>' : '')
              + '<span style="font-weight:700;">' + cname + '</span>'
              + '</div>';
          }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:2px 0;">');
          html += '<td style="padding:4px 5px;border:1px solid #e2e8f0;background:' + color + '15;vertical-align:top;">' + items + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  html += '</div>';
  document.getElementById('weekGrid').innerHTML = html;
  renderSessionListForPeriod(weekDates.map(function(w){ return w.str; }));
}

function renderDayGrid() {
  var todayD = new Date();
  var today = todayD.getFullYear() + '-' + String(todayD.getMonth()+1).padStart(2,'0') + '-' + String(todayD.getDate()).padStart(2,'0');
  var d = schedCurrentDate;
  var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  var dayNames = ['일','월','화','수','목','금','토'];
  var dayName = dayNames[d.getDay()];

  document.getElementById('schedNavLabel').textContent =
    (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + dayName + ')';

  renderTeacherFilter();

  var allScheds = scheduleDB.filter(function(s) { return s.date === dateStr; })
    .sort(function(a, b) {
      var ta = a.startTime || a.time || '';
      var tb = b.startTime || b.time || '';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

  var dayScheds = _schedTeacherFilter === '전체' ? allScheds
    : allScheds.filter(function(s){ return (s.therapist||s.teacher) === _schedTeacherFilter; });

  // weekGrid의 grid 레이아웃 해제 (테이블이 전체폭 차지하도록)
  var wgEl = document.getElementById('dayGrid');
  if (wgEl) {
    wgEl.style.display = 'block';
    wgEl.style.width = '100%';
  }

  var therapists = [];
  dayScheds.forEach(function(s) {
    var t = s.therapist || s.teacher || '';
    if (t && therapists.indexOf(t) < 0) therapists.push(t);
  });

  // 설정된 세션 단위로 표준 시간대 생성 (09:00~18:40)
  var interval = (typeof CENTER_SESSION_INTERVAL !== 'undefined') ? CENTER_SESSION_INTERVAL : 40;
  var stdTimes = [];
  for (var mm = 9*60; mm <= 18*60+40; mm += interval) {
    var hh = Math.floor(mm/60);
    var mi = mm % 60;
    stdTimes.push(String(hh).padStart(2,'0') + ':' + String(mi).padStart(2,'0'));
  }

  // groupOrder는 stdTimes 기반으로만 구성 (비표준 시간 행 생성 방지)
  var groups = {};
  var groupOrder = stdTimes.slice();
  groupOrder.forEach(function(t){ groups[t] = []; });

  // 각 스케줄을 가장 가까운 stdTime에 배치
  dayScheds.forEach(function(s) {
    var rawTime = (s.startTime || s.time || '').slice(0, 5);
    if (!rawTime || rawTime.length < 5) {
      if (!groups['시간미정']) { groups['시간미정'] = []; groupOrder.push('시간미정'); }
      groups['시간미정'].push(s); return;
    }
    var rawMm = parseInt(rawTime.slice(0,2)) * 60 + parseInt(rawTime.slice(3,5));
    // 가장 가까운 stdTime 찾기 (동률이면 이른 시간)
    var closestTime = stdTimes.reduce(function(best, t) {
      var tMm   = parseInt(t.slice(0,2)) * 60 + parseInt(t.slice(3,5));
      var bestMm = parseInt(best.slice(0,2)) * 60 + parseInt(best.slice(3,5));
      return Math.abs(tMm - rawMm) < Math.abs(bestMm - rawMm) ? t : best;
    }, stdTimes[0]);
    groups[closestTime].push(s);
  });

  var html = '<div style="width:100%;">';

  if (dayScheds.length === 0) {
    html += '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px 0;">일정이 없습니다.</div>';
  } else {
    var tableW = therapists.length * 120 + 60;
    html += '<table style="width:' + tableW + 'px;border-collapse:collapse;font-size:11px;table-layout:fixed;margin:0 auto;">';
    // 컬럼 너비 균등 분배
    var colW = Math.floor(100 / (therapists.length + 1));
    html += '<colgroup><col style="width:44px;">';
    therapists.forEach(function(){ html += '<col>'; });
    html += '</colgroup>';
    // 헤더: 시간 + 치료사 컬럼
    html += '<thead><tr>'
      + '<th style="padding:5px 6px;background:#f8fafc;border:1px solid #e2e8f0;font-size:10px;color:var(--text2);width:44px;min-width:44px;">시간</th>';
    therapists.forEach(function(t) {
      var color = getTeacherColor(t);
      html += '<th style="padding:5px 6px;background:' + color + '18;border:1px solid #e2e8f0;color:' + color + ';font-weight:700;white-space:nowrap;">' + escHtml(t) + '</th>';
    });
    html += '</tr></thead><tbody>';

    // 행: 시간대별
    groupOrder.forEach(function(timeKey, ri) {
      var rowBg = ri % 2 === 0 ? '#ffffff' : '#f8fafc';
      html += '<tr>';
      html += '<td style="padding:4px 5px;border:1px solid #e2e8f0;font-weight:700;color:var(--text2);font-size:10px;background:#f8fafc;white-space:nowrap;vertical-align:top;position:sticky;left:0;z-index:1;">' + escHtml(timeKey) + '</td>';
      therapists.forEach(function(t) {
        var cell = groups[timeKey].filter(function(s){ return (s.therapist||s.teacher||'') === t; });
        if (cell.length === 0) {
          html += '<td style="padding:4px 5px;border:1px solid #e2e8f0;background:' + rowBg + ';height:48px;"></td>';
        } else {
          var color = getTeacherColor(t);
          var items = cell.map(function(s) {
            var child = childDB.find(function(c){ return c.id === s.childId; });
            var cname = child ? escHtml(child.name) : '?';
            var type = escHtml(s.type || '');
            return '<div style="cursor:pointer;padding:2px 0;" onclick="openEditSchedModal(\'' + s.id + '\')">'
              + '<span style="font-weight:700;">' + cname + '</span>'
              + (type ? '<br><span style="color:#64748b;font-size:10px;">' + type + '</span>' : '')
              + '</div>';
          }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:2px 0;">');
          html += '<td style="padding:4px 5px;border:1px solid #e2e8f0;background:' + color + '15;vertical-align:top;">' + items + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  html += '<button class="sched-add-btn" onclick="openSchedModal(\'' + dateStr + '\',null)" style="margin-top:10px;">+</button></div>';

  document.getElementById('dayGrid').innerHTML = html;
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
    + '<input class="form-input" type="time" id="editSchedStart" step="300" value="' + escHtml((s.startTime||s.time)||'') + '" onclick="try{this.showPicker();}catch(e){}"></div>'
    + '<div style="flex:1;"><label class="form-label">치료 시간(분)</label>'
    + '<input class="form-input" type="number" id="editSchedDur" value="' + (s.duration||'') + '" min="5" max="180" placeholder="예: 40"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">담당 선생님</label>'
    + '<select class="form-input" id="editSchedTeacher">' + buildTeacherOptions(s.teacher||'') + '</select></div>'
    + '<div class="form-group"><label class="form-label">메모</label>'
    + '<textarea class="form-input" id="editSchedNote" style="min-height:60px;" placeholder="특이사항 (예: 체험학습으로 인한 캔슬)">' + escHtml(s.note||'') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;margin-top:8px;">'
    + '<button class="btn btn-primary" style="flex:1;margin-top:0;background:var(--blue);border-color:var(--blue);" onclick="goToSessionFromSched(\'' + id + '\')">📝 회기기록</button>'
    + (currentUser && currentUser.role === 'admin'
      ? '<button class="btn btn-primary" style="flex:1;margin-top:0;" onclick="saveEditSched(\'' + id + '\')">💾 수정</button>'
      + '<button class="btn-del" style="flex:0.6;padding:11px 10px;font-size:13px;" onclick="confirmSchedDelete(\'' + id + '\',' + (hasGroup?1:0) + ')">🗑️ 삭제</button>'
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

function renderWeekGridByChild(weekDates, weekScheds) {
  var wgEl = document.getElementById('weekGrid');
  if (!wgEl) return;
  wgEl.style.display = 'block';
  wgEl.style.width = '100%';

  // 아동 목록 수집 (일정에 등장하는 아동만)
  var childIds = [];
  weekScheds.forEach(function(s) {
    if (s.childId && childIds.indexOf(s.childId) < 0) childIds.push(s.childId);
  });

  // 중복 수업 아동만 보기 필터 (_weekDupOnly)
  if (_weekDupOnly) {
    childIds = childIds.filter(function(cid) {
      // 같은 날짜에 2개 이상 일정이 있는 아동만
      return weekDates.some(function(w) {
        var cnt = weekScheds.filter(function(s){ return s.date === w.str && s.childId === cid; }).length;
        return cnt >= 2;
      });
    });
  }

  // 아동 이름 기준 정렬
  childIds.sort(function(a, b) {
    var ca = childDB.find(function(c){ return c.id === a; });
    var cb = childDB.find(function(c){ return c.id === b; });
    var na = ca ? ca.name : '';
    var nb = cb ? cb.name : '';
    return na < nb ? -1 : 1;
  });

  if (childIds.length === 0) {
    wgEl.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px 0;">' + (_weekDupOnly ? '이번 주에 같은 날 중복 수업 아동이 없습니다.' : '이번 주 일정이 없습니다.') + '</div>';
    return;
  }

  var html = '<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px;">';

  // 날짜 헤더
  var todayStr = new Date().toISOString().slice(0,10);
  html += '<thead><tr><th style="padding:6px 4px;background:#f8fafc;border:1px solid #e2e8f0;font-size:10px;color:var(--text2);width:64px;min-width:64px;position:sticky;left:0;z-index:3;">아동</th>';
  weekDates.forEach(function(w) {
    var bg  = w.isToday ? 'var(--mint2,#e0f7f6)' : '#f8fafc';
    var col = w.isToday ? 'var(--mint,#0ea5a0)' : (w.isSun ? '#ef4444' : (w.isSat ? '#3b82f6' : 'var(--text2)'));
    html += '<th style="padding:6px 4px;background:' + bg + ';border:1px solid #e2e8f0;color:' + col + ';font-weight:700;text-align:center;cursor:pointer;" onclick="switchToDay(\'' + w.str + '\')">'
      + w.dayName + '<br><span style="font-size:12px;">' + w.day + '</span></th>';
  });
  html += '</tr></thead><tbody>';

  // 아동별 행
  childIds.forEach(function(childId) {
    var child = childDB.find(function(c){ return c.id === childId; });
    var cname = child ? escHtml(child.name) : '?';
    var cage  = child ? escHtml(child.age || '') : '';
    var ccolor = (child && child.color) ? child.color : '#0ea5a0';

    html += '<tr>';
    html += '<td style="padding:5px 6px;border:1px solid #e2e8f0;font-weight:700;font-size:11px;'
      + 'color:' + ccolor + ';background:' + ccolor + '10;white-space:nowrap;vertical-align:top;position:sticky;left:0;z-index:1;">'
      + cname
      + (cage ? '<br><span style="font-size:9px;font-weight:400;color:var(--text2);">' + cage + '</span>' : '')
      + '</td>';

    weekDates.forEach(function(w) {
      var daySched = weekScheds.filter(function(s){
        return s.date === w.str && s.childId === childId;
      }).sort(function(a,b){
        return ((a.startTime||a.time)||'') < ((b.startTime||b.time)||'') ? -1 : 1;
      });

      if (daySched.length === 0) {
        html += '<td style="padding:4px;border:1px solid #e2e8f0;height:40px;"></td>';
      } else {
        var items = daySched.map(function(s) {
          var t = s.therapist || s.teacher || '';
          var tcolor = getTeacherColor(t);
          var time = (s.startTime||s.time||'').slice(0,5);
          return '<div style="font-size:11px;cursor:pointer;line-height:1.4;padding:2px 0;" onclick="openEditSchedModal(\'' + s.id + '\')">'
            + (time ? '<span style="color:var(--text2);font-size:10px;">' + time + '</span><br>' : '')
            + '<span style="font-weight:700;color:' + tcolor + ';background:' + tcolor + '15;border-radius:4px;padding:0 4px;">'
            + escHtml(t) + '</span>'
            + '</div>';
        }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:2px 0;">');
        // 같은 날 2명 이상이면 셀 배경 강조
        var bgStyle = daySched.length >= 2
          ? 'background:#fff7ed;border:1px solid #fed7aa;'
          : 'border:1px solid #e2e8f0;';
        html += '<td style="padding:4px 5px;' + bgStyle + 'vertical-align:top;">' + items + '</td>';
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  wgEl.innerHTML = html;
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
    + '<button class="btn btn-primary" style="flex:1;margin-top:0;background:#ef4444;border-color:#ef4444;" onclick="execSchedDeleteChoice(\'' + id + '\')">네, 삭제하겠습니다</button>'
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
  toDeleteIds.forEach(function(did) { supaFetch('madi_schedules?id=eq.' + did, 'DELETE').catch(function(e){ console.warn('일정 삭제 실패 id=' + did, e); }); });
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

// ─────── 표준화 검사 ───────