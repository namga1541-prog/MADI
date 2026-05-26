// ─────── 대시보드 렌더링 (madi-03.js 에서 분리, 2026-05-23) ───────
// 진입점 renderDashboard() 는 madi-03.js 에 남아 있고, 여기엔 역할별 구현만.
// 의존: childDB, sessionDB, scheduleDB, currentUser, escHtml, supaFetch, _dpFreshnessLabel 등

// ═══════════════════════════════════════════════════════════════════════
// 페르소나별 대시보드 렌더러 (Teacher ⑥ / Admin ⑧)
// - 미리보기: design-previews/06-teacher-home.html, 08-admin-home.html
// - 진입: renderDashboard() → role 분기
// - 학부모는 별도 진입(parentPanelHome / loadParentHome) 사용
// ═══════════════════════════════════════════════════════════════════════

// 공통 유틸 — 이름 첫 글자 + 결정론적 아바타 색상 클래스
function _dpInitial(name) {
  var s = (name || '?').trim();
  return s ? s.charAt(0) : '?';
}
function _dpAvatarClass(seed) {
  var s = String(seed || '');
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return 'dp-av-' + ((Math.abs(h) % 6) + 1);
}
function _dpMonday(d) {
  var x = new Date(d);
  var day = x.getDay(); // 0=일
  var diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}
function _dpSunday(d) {
  var m = _dpMonday(d);
  m.setDate(m.getDate() + 6);
  return m;
}
function _dpFmtMD(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
function _dpAge(birthYmd) {
  if (!birthYmd) return null;
  var b = new Date(birthYmd);
  if (isNaN(b.getTime())) return null;
  var now = nowKST();
  var a = now.getFullYear() - b.getFullYear();
  var m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}
function _dpGreetingFor(name, role) {
  var h = nowKST().getHours();
  var em = h < 12 ? '☕' : h < 18 ? '☀️' : '🌙';
  var head = h < 12 ? '좋은 아침이에요' : h < 18 ? '즐거운 오후 되세요' : '오늘 하루도 수고하셨어요';
  var roleLabel = role === 'superadmin' ? '👑' : role === 'admin' ? '🎯' : '👩‍⚕️';
  return head + ', ' + escHtml(name || '') + '님 ' + roleLabel + ' ' + em;
}
function _dpTodayBanner() {
  var t = nowKST();
  var wd = ['일','월','화','수','목','금','토'];
  return t.getFullYear() + '년 ' + (t.getMonth()+1) + '월 ' + t.getDate() + '일 ' + wd[t.getDay()] + '요일';
}

// 데이터 갱신 시각 표시 — _dataLoadedAt 기반
function _dpFreshnessLabel() {
  var ts = window._dataLoadedAt;
  if (!ts) return '';
  var d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5)   return '데이터 갱신: 방금 전';
  if (d < 60)  return '데이터 갱신: ' + d + '초 전';
  if (d < 3600) return '데이터 갱신: ' + Math.floor(d/60) + '분 전';
  return '데이터 갱신: ' + Math.floor(d/3600) + '시간 전';
}

// 신선도 라벨 30초마다 자동 갱신 — 폴링이 10초 간격이지만 라벨 자체는 분 단위로 변하므로 30초면 충분
// 백그라운드에서는 정지 (모바일 배터리 절약)
function _startDpFreshnessTimer() {
  if (typeof window === 'undefined' || window._dpFreshnessTimer) return;
  window._dpFreshnessTimer = setInterval(function() {
    var labels = document.querySelectorAll('.dp-freshness');
    if (!labels.length) return;
    var txt = _dpFreshnessLabel();
    for (var i = 0; i < labels.length; i++) {
      labels[i].textContent = txt ? ' · ' + txt : '';
    }
  }, 30000);
}
function _stopDpFreshnessTimer() {
  if (typeof window !== 'undefined' && window._dpFreshnessTimer) {
    clearInterval(window._dpFreshnessTimer);
    window._dpFreshnessTimer = null;
  }
}
_startDpFreshnessTimer();
if (typeof window !== 'undefined' && !window._dpFreshnessUnloadBound) {
  window._dpFreshnessUnloadBound = true;
  window.addEventListener('beforeunload', _stopDpFreshnessTimer);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') _stopDpFreshnessTimer();
    else _startDpFreshnessTimer();
  });
}

// ────────────────────────────────────────────────────────────────
// Teacher 홈 (⑥)
// ────────────────────────────────────────────────────────────────
function renderDashboardTeacher() {
  var root = document.getElementById('dashTeacher');
  if (!root) return;
  // 안전 가드 — 전역 DB 미초기화 / 빈 배열 케이스 모두 안전
  var _children = (typeof childDB !== 'undefined' && Array.isArray(childDB)) ? childDB : [];
  var _sessions = (typeof sessionDB !== 'undefined' && Array.isArray(sessionDB)) ? sessionDB : [];
  var _schedules = (typeof scheduleDB !== 'undefined' && Array.isArray(scheduleDB)) ? scheduleDB : [];
  var _assessments = (typeof assessmentDB !== 'undefined' && Array.isArray(assessmentDB)) ? assessmentDB : [];
  var myName = (currentUser && currentUser.name) || '';
  var todayStr = ymd(nowKST());
  var today = nowKST(); today.setHours(0,0,0,0);
  var mon = _dpMonday(today), sun = _dpSunday(today);
  var monStr = ymd(mon), sunStr = ymd(sun);

  // 데이터 계산
  var mySched = _schedules.filter(function(s){ return s.teacher === myName; });
  var mySession = _sessions.filter(function(s){ return s.teacher === myName; });
  var todaySched = mySched.filter(function(s){ return s.date === todayStr; })
    .sort(function(a,b){ return (a.startTime||'') < (b.startTime||'') ? -1 : 1; });

  // 내 담당 아동 (등록 상태 + 내가 일정/세션 기록한 적 있는 아동)
  var myChildIds = {};
  mySched.forEach(function(s){ if (s.childId) myChildIds[s.childId] = true; });
  mySession.forEach(function(s){ if (s.childId) myChildIds[s.childId] = true; });
  var myChildren = _children.filter(function(c){ return myChildIds[c.id] && c.status !== '종결'; });

  // 이번 주 작성률 — 미래 일정은 분모에서 제외 (작성 의무 도래 전)
  var weekSched = mySched.filter(function(s){ return s.date >= monStr && s.date <= sunStr; });
  var weekSchedDue = weekSched.filter(function(s){ return s.date <= todayStr; }); // 오늘까지 도래한 일정
  var weekSchedFuture = weekSched.length - weekSchedDue.length;
  var weekDone = weekSchedDue.filter(function(s){
    return _sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
  }).length;
  var weekPending = weekSchedDue.length - weekDone;
  var weekRatePct = weekSchedDue.length > 0 ? Math.round(weekDone / weekSchedDue.length * 100) : null;

  // 미작성 세션 (내 것만)
  var unwrittenAll = (typeof getUnwrittenSessions === 'function') ? getUnwrittenSessions() : [];
  var unwritten = (Array.isArray(unwrittenAll) ? unwrittenAll : []).filter(function(u){ return u.teacher === myName; });

  // 최근 만난 순 4명 (오늘 일정 우선, 그다음 최근 세션 날짜)
  var lastMet = {};
  mySession.forEach(function(s){
    if (!s.childId) return;
    if (!lastMet[s.childId] || lastMet[s.childId] < s.date) lastMet[s.childId] = s.date;
  });
  mySched.forEach(function(s){
    if (!s.childId || s.date > todayStr) return;
    if (!lastMet[s.childId] || lastMet[s.childId] < s.date) lastMet[s.childId] = s.date;
  });
  var recentChildren = myChildren.slice().sort(function(a,b){
    return (lastMet[b.id] || '') < (lastMet[a.id] || '') ? -1 : 1;
  }).slice(0,4);

  // 이번 주 활동 요약
  var thisWeekSessions = mySession.filter(function(s){ return s.date >= monStr && s.date <= sunStr; });
  // 평가는 user_id 로 식별 (assessmentDB 에는 teacher 필드 없음)
  var myUserId = currentUser && currentUser.id;
  var thisWeekEvals = _assessments.filter(function(a){
    if (a.date < monStr || a.date > sunStr) return false;
    return myUserId && String(a.user_id) === String(myUserId);
  });

  // ── HTML ──
  var titleText = _dpGreetingFor(myName, 'teacher');
  var nearest = todaySched.length ? todaySched.find(function(s){ return !_sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; }); }) || todaySched[0] : null;
  var nearestChild = nearest ? _children.find(function(c){ return c.id === nearest.childId; }) : null;
  var _nearestTime = nearest ? (nearest.startTime||'').slice(0,5) : '';
  var _nearestName = escHtml(nearestChild ? nearestChild.name : '?');
  var subText = todaySched.length === 0
    ? '오늘 예정된 세션은 없어요. 다음 주 일정을 미리 확인해 보세요.'
    : '오늘 <b>' + todaySched.length + '건</b>의 세션이 예정되어 있어요.'
      + (nearest ? ' 가장 가까운 일정은 <b>' + (_nearestTime ? escHtml(_nearestTime) + ' ' : '') + _nearestName + '</b>이에요.' : '');

  var freshness = _dpFreshnessLabel();
  var html = ''
    + '<div class="dp-head">'
    +   '<div class="dp-greeting">' + escHtml(_dpTodayBanner())
    +     '<span class="dp-freshness" style="color:#94a3b8;">' + (freshness ? ' · ' + escHtml(freshness) : '') + '</span>'
    +   '</div>'
    +   '<h1 class="dp-title">' + titleText + '</h1>'
    +   '<p class="dp-sub">' + subText + '</p>'
    + '</div>';

  // 시급 배너 (미작성 있을 때만)
  if (unwritten.length > 0) {
    var sample = unwritten.slice(0,3).map(function(u){ return escHtml((u.date||'').slice(5).replace('-','/')) + ' (' + escHtml(u.childName) + ')'; }).join(', ');
    html += ''
      + '<div class="dp-urgent">'
      +   '<div class="dp-urgent-ic">⚠️</div>'
      +   '<div class="dp-urgent-info">'
      +     '<div class="dp-urgent-title">미작성 세션 ' + unwritten.length + '건이 있어요</div>'
      +     '<div class="dp-urgent-text">' + sample + (unwritten.length > 3 ? ' 외 ' + (unwritten.length - 3) + '건' : '') + ' 세션 기록이 작성 대기 중입니다.</div>'
      +   '</div>'
      +   '<button class="dp-urgent-action" onclick="switchTab(2)">→ 지금 작성</button>'
      + '</div>';
  }

  // KPI 4개
  var todayTimesShort = todaySched.slice(0,3).map(function(s){ return (s.startTime||'').slice(0,5); }).filter(Boolean).join(' · ');
  html += ''
    + '<div class="dp-kpi-grid">'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-blue">👶</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">내 담당 아동</div>'
    +     '<div class="dp-kpi-num">' + myChildren.length + '<em> 명</em></div>'
    +     '<div class="dp-kpi-delta flat">전체 ' + _children.length + '명 중</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-green">📅</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">오늘 세션</div>'
    +     '<div class="dp-kpi-num">' + todaySched.length + '<em> 건</em></div>'
    +     '<div class="dp-kpi-delta flat">' + (todayTimesShort || '없음') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-purple">📝</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">이번 주 작성</div>'
    +     '<div class="dp-kpi-num">' + weekDone + '<em> / ' + weekSchedDue.length + (weekRatePct != null ? ' · ' + weekRatePct + '%' : '') + '</em></div>'
    +     '<div class="dp-kpi-delta ' + (weekPending ? 'warn' : 'flat') + '">' + (weekPending ? weekPending + '건 미작성' : (weekSchedDue.length ? '모두 작성 완료' : '도래한 일정 없음')) + (weekSchedFuture ? ' · 남은 일정 ' + weekSchedFuture + '건' : '') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-rose">💬</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">답변 대기 메시지</div>'
    +     '<div class="dp-kpi-num" id="dpTeacherMsgKpi">-<em> 건</em></div>'
    +     '<div class="dp-kpi-delta flat" id="dpTeacherMsgKpiSub">불러오는 중...</div>'
    +   '</div></div>'
    + '</div>';

  // 2열: 오늘 타임라인 + 받은 메시지
  var wd = ['일','월','화','수','목','금','토'];
  var weekNum = Math.ceil(((today - new Date(today.getFullYear(), 0, 1)) / 86400000 + new Date(today.getFullYear(),0,1).getDay() + 1) / 7);
  var doneCnt = todaySched.filter(function(s){ return _sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; }); }).length;

  html += '<div class="dp-grid-2">';

  // 오늘 일정 패널
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📅 오늘의 일정</div>'
    +       '<div class="dp-panel-sub">' + (todaySched.length ? todaySched.length + '개 세션' : '오늘 일정 없음') + '</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(0)">주간 보기 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-day-sum">'
    +       '<div class="dp-day-num">' + today.getDate() + '</div>'
    +       '<div class="dp-day-text"><b>' + wd[today.getDay()] + '요일</b>' + today.getFullYear() + '년 ' + (today.getMonth()+1) + '월 · ' + weekNum + '주차</div>'
    +       '<div class="dp-day-right">예정 <b>' + todaySched.length + '</b> · 완료 <b>' + doneCnt + '</b></div>'
    +     '</div>';

  if (todaySched.length === 0) {
    html += '<div class="dp-empty">오늘 예정된 세션이 없습니다</div>';
  } else {
    html += todaySched.slice(0, 6).map(function(s){
      var c = _children.find(function(cc){ return cc.id === s.childId; });
      var nm = c ? c.name : '?';
      var done = _sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
      var st = (s.startTime || '').slice(0,5);
      var et = (s.endTime || '').slice(0,5);
      var age = c ? _dpAge(c.birth) : null;
      var meta = (c ? (c.type || '') : '') + (age ? (c && c.type ? ' · ' : '') + age + '세' : '');
      var tag = done ? '<span class="dp-tl-tag done">완료</span>' : '<span class="dp-tl-tag upcoming">예정</span>';
      var cls = done ? 'done' : 'upcoming';
      return ''
        + '<div class="dp-tl-row ' + cls + '" onclick="switchTab(2)">'
        +   '<div class="dp-tl-time">' + escHtml(st || '--:--') + (et ? '<em>~ ' + escHtml(et) + '</em>' : '') + '</div>'
        +   '<div class="dp-tl-dot"></div>'
        +   '<div class="dp-tl-card">'
        +     '<div class="dp-tl-av ' + _dpAvatarClass(nm) + '">' + escHtml(_dpInitial(nm)) + '</div>'
        +     '<div class="dp-tl-info">'
        +       '<div class="dp-tl-name">' + escHtml(nm) + '</div>'
        +       '<div class="dp-tl-meta">' + escHtml(meta || '세션') + '</div>'
        +     '</div>'
        +     tag
        +   '</div>'
        + '</div>';
    }).join('');
    if (todaySched.length > 6) html += '<div class="dp-empty" style="padding:8px;">+ ' + (todaySched.length - 6) + '개 더</div>';
  }
  html += '</div></div>';

  // 답변 대기 메시지 (async — placeholder 후 채움)
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">💬 답변 대기 메시지</div>'
    +       '<div class="dp-panel-sub">받은 메시지 · 미응답</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(7)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body" id="dpTeacherMsgs">'
    +     '<div class="dp-empty">불러오는 중...</div>'
    +   '</div>'
    + '</div>';
  html += '</div>'; // grid-2 end

  // 내 담당 아동 (가로 카드 4개)
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">👥 내 담당 아동</div>'
    +       '<div class="dp-panel-sub">최근 만난 순 · 총 ' + myChildren.length + '명</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(1)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">';
  if (recentChildren.length === 0) {
    html += '<div class="dp-empty">담당 중인 아동이 없습니다.<br>일정·세션 기록을 시작하면 여기에 표시됩니다.</div>';
  } else {
    html += '<div class="dp-children">' + recentChildren.map(function(c){
      var age = _dpAge(c.birth);
      var nm = c.name || '?';
      var last = lastMet[c.id];
      var lastText = last
        ? (last === todayStr ? '<b>오늘</b> 만남' : '<b>' + last.slice(5).replace('-','/') + '</b> 마지막 만남')
        : '<b>일정 미등록</b>';
      var meta = [c.type, age ? age + '세' : ''].filter(Boolean).join(' · ');
      return ''
        + '<div class="dp-child" onclick="openChildDetail(\'' + escHtml(String(c.id)) + '\')">'
        +   '<div class="dp-child-head">'
        +     '<div class="dp-child-av ' + _dpAvatarClass(nm) + '">' + escHtml(_dpInitial(nm)) + '</div>'
        +     '<div style="flex:1;min-width:0;">'
        +       '<div class="dp-child-name">' + escHtml(nm) + '</div>'
        +       '<div class="dp-child-meta">' + escHtml(meta || c.status || '등록') + '</div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="dp-child-last">' + lastText + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }
  html += '</div></div>';

  // 하단 2열: 이번 주 활동 + 빠른 액션
  html += '<div class="dp-grid-2-eq">';

  // 이번 주 활동
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📊 내 이번 주 활동</div>'
    +       '<div class="dp-panel-sub">' + _dpFmtMD(mon) + ' ~ ' + _dpFmtMD(sun) + '</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-week">'
    +       '<div class="dp-week-item"><div class="dp-week-num">' + thisWeekSessions.length + '</div><div class="dp-week-label">완료 세션</div></div>'
    +       '<div class="dp-week-item"><div class="dp-week-num">' + thisWeekEvals.length + '</div><div class="dp-week-label">평가 완료</div></div>'
    +       '<div class="dp-week-item"><div class="dp-week-num">' + weekSched.length + '</div><div class="dp-week-label">주간 일정</div></div>'
    +       '<div class="dp-week-item"><div class="dp-week-num ' + (weekPending ? '' : '') + '">' + weekPending + '</div><div class="dp-week-label">미작성</div></div>'
    +     '</div>'
    +     (weekSchedFuture ? '<div style="margin-top:10px;font-size:11px;color:#94a3b8;text-align:center;">남은 일정 ' + weekSchedFuture + '건은 아직 작성 의무 도래 전이에요</div>' : '')
    +   '</div>'
    + '</div>';

  // 빠른 액션
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">⚡ 빠른 액션</div>'
    +       '<div class="dp-panel-sub">자주 쓰는 작업</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:none;cursor:pointer;" onclick="switchTab(2)">'
    +       '<div class="dp-tl-av dp-av-2">📝</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">세션 기록 작성</div><div class="dp-tl-meta">' + (unwritten.length ? unwritten.length + '건 미작성 — 우선 처리' : '오늘 일정에서 시작') + '</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(0)">'
    +       '<div class="dp-tl-av dp-av-1">📅</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">캘린더 관리</div><div class="dp-tl-meta">주간 일정·새 일정 추가</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(7)">'
    +       '<div class="dp-tl-av dp-av-3">💬</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">게시판·메시지</div><div class="dp-tl-meta">학부모 · 동료 라운지</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  html += '</div>'; // grid-2-eq end

  // eslint-disable-next-line no-unsanitized/property
  root.innerHTML = html;

  // ── 비동기: 라운지 답변 대기 메시지 ──
  _dpLoadTeacherMessages();
}

// 라운지 1:1 메시지(private_admin) 중 본인이 보낸 게 아닌 것 = 받은 메시지
function _dpLoadTeacherMessages() {
  var msgEl = document.getElementById('dpTeacherMsgs');
  var kpiEl = document.getElementById('dpTeacherMsgKpi');
  var kpiSub = document.getElementById('dpTeacherMsgKpiSub');
  if (!msgEl) return;
  if (!currentUser || !currentUser.id) {
    msgEl.innerHTML = '<div class="dp-empty">로그인 정보 확인 필요</div>';
    return;
  }
  var loungeUrl = currentUser.role === 'superadmin'
    ? 'madi_lounge_posts?visibility=eq.private_admin&order=created_at.desc&limit=20'
    : 'madi_lounge_posts?visibility=eq.private_admin&center_id=eq.' + encodeURIComponent(currentUser.center_id) + '&order=created_at.desc&limit=20';
  supaFetch(loungeUrl, 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows)) rows = [];
      var received = rows.filter(function(p){
        if (!p) return false;
        // 본인이 작성한 글 제외
        if (p.author_id && String(p.author_id) === String(currentUser.id)) return false;
        if (!p.author_id && p.author_name && p.author_name === currentUser.name) return false;
        return true;
      });
      // KPI 갱신
      // eslint-disable-next-line no-unsanitized/property
      if (kpiEl) kpiEl.innerHTML = received.length + '<em> 건</em>';
      if (kpiSub) {
        if (received.length === 0) { kpiSub.textContent = '받은 메시지 없음'; kpiSub.className = 'dp-kpi-delta flat'; }
        else {
          // 가장 오래된 일 차이
          var oldest = received[received.length - 1];
          var dStr = oldest && oldest.created_at ? oldest.created_at.slice(0,10) : '';
          var d = dStr ? Math.floor((nowKST() - new Date(dStr)) / 86400000) : 0;
          kpiSub.textContent = '가장 오래된 ' + d + '일 전';
          kpiSub.className = 'dp-kpi-delta warn';
        }
      }
      if (received.length === 0) {
        msgEl.innerHTML = '<div class="dp-empty">받은 메시지가 없습니다</div>';
        return;
      }
      // eslint-disable-next-line no-unsanitized/property
      msgEl.innerHTML = received.slice(0,4).map(function(p){
        var from = p.author_name || '익명';
        var when = p.created_at ? p.created_at.slice(0,10) : '';
        var preview = (p.content || p.title || '').toString().slice(0,80);
        var days = when ? Math.floor((nowKST() - new Date(when)) / 86400000) : 0;
        var timeText = days === 0 ? '오늘' : days + '일 전';
        return ''
          + '<div class="dp-msg-row" onclick="switchTab(7)">'
          +   '<div class="dp-msg-av ' + _dpAvatarClass(from) + '">' + escHtml(_dpInitial(from)) + '</div>'
          +   '<div class="dp-msg-info">'
          +     '<div class="dp-msg-top">'
          +       '<div class="dp-msg-from">' + escHtml(from) + '</div>'
          +       '<div class="dp-msg-unread"></div>'
          +       '<div class="dp-msg-time">' + timeText + '</div>'
          +     '</div>'
          +     '<div class="dp-msg-preview">' + escHtml(preview) + '</div>'
          +   '</div>'
          + '</div>';
      }).join('');
    })
    .catch(function() {
      if (kpiEl) kpiEl.innerHTML = '-<em> 건</em>';
      if (kpiSub) { kpiSub.textContent = '불러오기 실패'; kpiSub.className = 'dp-kpi-delta flat'; }
      msgEl.innerHTML = '<div class="dp-empty">메시지를 불러오지 못했습니다</div>';
    });
}

// ────────────────────────────────────────────────────────────────
// Admin / Super 홈 (⑧)
// ────────────────────────────────────────────────────────────────

// 바우처 단가 추정표 (Option ⓒ — 실제 정산 테이블 미구현 상태 추정값)
var _DP_VOUCHER_PRICE = {
  '발달재활바우처':          33000,
  '우리아이심리지원서비스바우처': 40000,
  '꿈E든카드바우처':         30000,
  '나래사랑카드바우처':       35000,
  '일반':                  40000,
  '':                      40000
};
function _dpEstSessionPrice(child) {
  if (!child) return _DP_VOUCHER_PRICE['일반'];
  var v = child.voucherType || '일반';
  return _DP_VOUCHER_PRICE[v] != null ? _DP_VOUCHER_PRICE[v] : _DP_VOUCHER_PRICE['일반'];
}
function _dpFmtWon(n) {
  if (!isFinite(n)) return '0';
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}

// 매출 추정 산식 펼침/접기 토글 (폴링 재렌더 시에도 상태 유지)
function _dpToggleRevBreakdown() {
  var el = document.getElementById('dpRevBreakdown');
  if (!el) return;
  var isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : '';
  window._dpRevOpen = !isOpen;
  // 트리거 버튼 텍스트 갱신 (자세히 ▾ ↔ 접기 ▴)
  var btn = document.getElementById('dpRevToggleBtn');
  if (btn) btn.textContent = '📌 바우처 단가 × 완료 세션 추정값 · ' + (isOpen ? '자세히 ▾' : '접기 ▴');
}

function renderDashboardAdmin() {
  var root = document.getElementById('dashAdmin');
  if (!root) return;
  // 안전 가드 — 전역 DB 미초기화 / 빈 배열 케이스 모두 안전
  var _children = (typeof childDB !== 'undefined' && Array.isArray(childDB)) ? childDB : [];
  var _sessions = (typeof sessionDB !== 'undefined' && Array.isArray(sessionDB)) ? sessionDB : [];
  var _schedules = (typeof scheduleDB !== 'undefined' && Array.isArray(scheduleDB)) ? scheduleDB : [];
  var myName = (currentUser && currentUser.name) || '';
  var role = (currentUser && currentUser.role) || 'admin';
  var todayDate = nowKST(); todayDate.setHours(0,0,0,0);
  var todayStr = ymd(todayDate);
  var mon = _dpMonday(todayDate), sun = _dpSunday(todayDate);
  var monStr = ymd(mon), sunStr = ymd(sun);
  // 이번 달
  var monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  var monthEnd   = new Date(todayDate.getFullYear(), todayDate.getMonth()+1, 0);
  var monthStartStr = ymd(monthStart), monthEndStr = ymd(monthEnd);
  // 지난 달
  var lastMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth()-1, 1);
  var lastMonthEnd   = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
  var lastMonthStartStr = ymd(lastMonthStart), lastMonthEndStr = ymd(lastMonthEnd);

  // ── 데이터 계산 ──
  var thisMonthSessions = _sessions.filter(function(s){ return s.date >= monthStartStr && s.date <= monthEndStr; });
  var thisMonthSched = _schedules.filter(function(s){ return s.date >= monthStartStr && s.date <= monthEndStr; });
  // 진도율 분모: 오늘까지 도래한 일정만 (미래 일정은 아직 진행 의무 도래 전)
  var thisMonthSchedDue = thisMonthSched.filter(function(s){ return s.date <= todayStr; });

  // 미작성 세션 (이번 달 중 일정은 지났는데 세션 매칭 안 된 것) — 운영 알림용
  var pendingSched = thisMonthSched.filter(function(s){
    if (s.date > todayStr) return false;
    return !_sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
  });

  // KPI
  var kRegistered = _children.filter(function(c){ return c.status === '등록'; }).length;
  var kWaiting    = _children.filter(function(c){ return c.status === '대기'; }).length;
  var kClosedThisMonth = _children.filter(function(c){
    if (c.status !== '종결') return false;
    var d = c.updatedAt || c.closedAt || c.endDate || '';
    return d && d.slice(0,7) === monthStartStr.slice(0,7);
  }).length;
  var kTotal = _children.length;

  // 이번 주 변동
  var weekChildren = _children.filter(function(c){
    var d = c.updatedAt || c.createdAt || c.regDate || '';
    return d && d.slice(0,10) >= monStr && d.slice(0,10) <= sunStr;
  });
  var newThisWeek    = weekChildren.filter(function(c){ return c.status === '등록'; }).length;
  var closedThisWeek = weekChildren.filter(function(c){ return c.status === '종결'; }).length;
  var waitThisWeek   = weekChildren.filter(function(c){ return c.status === '대기'; }).length;

  // 선생님 활동 — 일단 sessionDB / scheduleDB 의 teacher 이름들로 집계 (사용자 테이블 조회 없이 즉시)
  var teacherStats = {};
  _schedules.forEach(function(s){
    if (!s.teacher) return;
    if (!teacherStats[s.teacher]) teacherStats[s.teacher] = { children:{}, weekSched:0, weekSession:0, unwritten:0 };
    teacherStats[s.teacher].children[s.childId] = true;
    if (s.date >= monStr && s.date <= sunStr) teacherStats[s.teacher].weekSched++;
  });
  _sessions.forEach(function(s){
    if (!s.teacher) return;
    if (!teacherStats[s.teacher]) teacherStats[s.teacher] = { children:{}, weekSched:0, weekSession:0, unwritten:0 };
    teacherStats[s.teacher].children[s.childId] = true;
    if (s.date >= monStr && s.date <= sunStr) teacherStats[s.teacher].weekSession++;
  });
  (typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : []).forEach(function(u){
    if (!u.teacher) return;
    if (!teacherStats[u.teacher]) teacherStats[u.teacher] = { children:{}, weekSched:0, weekSession:0, unwritten:0 };
    teacherStats[u.teacher].unwritten++;
  });
  var teacherList = Object.keys(teacherStats).map(function(name){
    var s = teacherStats[name];
    return { name:name, count: Object.keys(s.children).length, weekSched:s.weekSched, weekSession:s.weekSession, unwritten:s.unwritten };
  }).sort(function(a,b){ return b.count - a.count; });

  // 일별 카운트 (이번 달 추이 — 계획 vs 실제)
  var daysInMonth = monthEnd.getDate();
  var planByDay = [], realByDay = [];
  for (var _i = 0; _i <= daysInMonth; _i++) { planByDay.push(0); realByDay.push(0); }
  thisMonthSched.forEach(function(s){ if (!s.date) return; var d = parseInt(s.date.slice(8,10), 10); if (d >= 1 && d <= daysInMonth) planByDay[d]++; });
  thisMonthSessions.forEach(function(s){ if (!s.date) return; var d = parseInt(s.date.slice(8,10), 10); if (d >= 1 && d <= daysInMonth) realByDay[d]++; });

  // ── HTML ──
  var titleText = _dpGreetingFor(myName, role);
  var _progressPct = thisMonthSchedDue.length ? Math.round(thisMonthSessions.length / thisMonthSchedDue.length * 100) : null;
  var subText = '이번 달 세션 <b>' + thisMonthSessions.length + '건</b> 완료'
    + (thisMonthSched.length ? ' · 월 계획 <b>' + thisMonthSched.length + '건</b>' : '')
    + (_progressPct != null ? ' · 진도율 <b>' + _progressPct + '%</b>' : '')
    + (pendingSched.length > 0 ? ' · 미작성 <b style="color:#a16207;">' + pendingSched.length + '건</b>' : '');

  var freshness = _dpFreshnessLabel();
  var html = ''
    + '<div class="dp-head">'
    +   '<div class="dp-greeting">' + escHtml(_dpTodayBanner())
    +     (role === 'superadmin' ? ' · <span style="color:#d97706;font-weight:700;">전체 센터 집계</span>' : '')
    +     '<span class="dp-freshness" style="color:#94a3b8;">' + (freshness ? ' · ' + escHtml(freshness) : '') + '</span>'
    +   '</div>'
    +   '<h1 class="dp-title">' + titleText + '</h1>'
    +   '<p class="dp-sub">' + subText + '</p>'
    + '</div>';

  // KPI
  html += ''
    + '<div class="dp-kpi-grid">'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-green">👶</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">활동 중인 아동</div>'
    +     '<div class="dp-kpi-num">' + kRegistered + '</div>'
    +     '<div class="dp-kpi-delta ' + (newThisWeek ? '' : 'flat') + '">' + (newThisWeek ? '↑ +' + newThisWeek + ' 이번 주' : '변동 없음') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-amber">⏳</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">대기 / 초기 면담</div>'
    +     '<div class="dp-kpi-num">' + kWaiting + '</div>'
    +     '<div class="dp-kpi-delta ' + (waitThisWeek ? 'warn' : 'flat') + '">' + (waitThisWeek ? '+' + waitThisWeek + ' 이번 주 신규' : '변동 없음') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-blue">✓</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">이번 달 종결</div>'
    +     '<div class="dp-kpi-num">' + kClosedThisMonth + '</div>'
    +     '<div class="dp-kpi-delta flat">2026년 ' + (todayDate.getMonth()+1) + '월</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-purple">🌳</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">전체 누적</div>'
    +     '<div class="dp-kpi-num">' + kTotal + '</div>'
    +     '<div class="dp-kpi-delta flat">아동 등록 합계</div>'
    +   '</div></div>'
    + '</div>';

  // 2열: 선생님 활동 + 변동 아동
  html += '<div class="dp-grid-2">';

  // 선생님 활동표 — placeholder, 이후 _dpLoadAdminTeacherTable() 가 madi_users 조회 후 갱신
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">👥 선생님별 활동 현황</div>'
    +       '<div class="dp-panel-sub" id="dpAdminTeacherSub">이번 주 (' + _dpFmtMD(mon) + ' ~ ' + _dpFmtMD(sun) + ') · 불러오는 중</div></div>'
    +     '<button class="dp-panel-link" onclick="goToAdmin(\'service\')">관리 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body" id="dpAdminTeacherTable">'
    +     _dpRenderTeacherRows(teacherList, /*placeholder=*/true)
    +   '</div>'
    + '</div>';

  // 변동 아동
  var sortedChanges = _children.filter(function(c){
    var d = c.updatedAt || c.createdAt || c.regDate || '';
    return d && d.slice(0,10) >= monStr && d.slice(0,10) <= sunStr;
  }).sort(function(a,b){
    var da = (a.updatedAt || a.createdAt || a.regDate || '').slice(0,10);
    var db = (b.updatedAt || b.createdAt || b.regDate || '').slice(0,10);
    return da < db ? 1 : -1;
  });

  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">🔄 이번 주 아동 변동</div>'
    +       '<div class="dp-panel-sub">신규·종결·대기 전환</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(1)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-change-sum">'
    +       '<div class="dp-change-cell"><div class="dp-change-num up">+' + newThisWeek + '</div><div class="dp-change-label">신규 등록</div></div>'
    +       '<div class="dp-change-cell"><div class="dp-change-num done">' + closedThisWeek + '</div><div class="dp-change-label">종결</div></div>'
    +       '<div class="dp-change-cell"><div class="dp-change-num flat">+' + waitThisWeek + '</div><div class="dp-change-label">대기 추가</div></div>'
    +     '</div>';

  if (sortedChanges.length === 0) {
    html += '<div class="dp-empty">이번 주 변동된 아동이 없습니다</div>';
  } else {
    sortedChanges.slice(0, 5).forEach(function(c){
      var age = _dpAge(c.birth);
      var nm = c.name || '?';
      var tagClass = c.status === '종결' ? 'done' : c.status === '대기' ? 'wait' : 'new';
      var tagLabel = c.status === '종결' ? '종결' : c.status === '대기' ? '대기' : '신규';
      var detail = (c.type || '미지정') + (age ? ' · ' + age + '세' : '');
      html += ''
        + '<div class="dp-change-row" onclick="openChildDetail(\'' + escHtml(String(c.id)) + '\')" style="cursor:pointer;">'
        +   '<div class="dp-tav ' + _dpAvatarClass(nm) + '">' + escHtml(_dpInitial(nm)) + '</div>'
        +   '<div class="dp-change-content">'
        +     '<div class="dp-change-title">' + escHtml(nm) + (age ? ' (' + age + '세)' : '') + '</div>'
        +     '<div class="dp-change-detail">' + escHtml(detail) + '</div>'
        +   '</div>'
        +   '<div class="dp-change-tag ' + tagClass + '">' + tagLabel + '</div>'
        + '</div>';
    });
  }
  html += '</div></div>';
  html += '</div>'; // grid-2 end

  // 추이 그래프 (계획 vs 실제 · SVG)
  var maxY = 1;
  for (var i = 1; i <= daysInMonth; i++) {
    if (planByDay[i] > maxY) maxY = planByDay[i];
    if (realByDay[i] > maxY) maxY = realByDay[i];
  }
  var chartW = 700, chartH = 180;
  function _pt(i, v) {
    var x = ((i - 1) / Math.max(daysInMonth - 1, 1)) * chartW;
    var y = chartH - (v / maxY) * chartH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }
  var planPts = [], realPts = [], realArea = ['0,' + chartH];
  for (var d = 1; d <= daysInMonth; d++) {
    planPts.push(_pt(d, planByDay[d]));
    realPts.push(_pt(d, realByDay[d]));
    realArea.push(_pt(d, realByDay[d]));
  }
  realArea.push(chartW + ',' + chartH);
  var progressPct = thisMonthSchedDue.length ? Math.round(thisMonthSessions.length / thisMonthSchedDue.length * 100) : 0;

  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📊 이번 달 세션 추이</div>'
    +       '<div class="dp-panel-sub">' + (monthStart.getMonth()+1) + '월 일별 세션 (계획 vs 실제)</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-chart">'
    +       '<div class="dp-chart-grid"><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div></div>'
    +       '<svg class="dp-chart-svg" viewBox="0 0 ' + chartW + ' ' + chartH + '" preserveAspectRatio="none">'
    +         '<defs><linearGradient id="dpGradActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f3b66" stop-opacity="0.2"/><stop offset="100%" stop-color="#0f3b66" stop-opacity="0"/></linearGradient></defs>'
    +         '<polyline points="' + planPts.join(' ') + '" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>'
    +         '<polygon points="' + realArea.join(' ') + '" fill="url(#dpGradActual)"/>'
    +         '<polyline points="' + realPts.join(' ') + '" fill="none" stroke="#0f3b66" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    +       '</svg>'
    +     '</div>'
    +     '<div class="dp-chart-x">'
    +       '<span>1일</span><span>' + Math.round(daysInMonth/4) + '일</span><span>' + Math.round(daysInMonth/2) + '일</span><span>' + Math.round(daysInMonth*3/4) + '일</span><span>' + daysInMonth + '일</span>'
    +     '</div>'
    +     '<div class="dp-chart-legend">'
    +       '<div class="dp-chart-leg"><div class="dp-chart-leg-dot" style="background:#0f3b66;"></div>실제 (누적 ' + thisMonthSessions.length + '회)</div>'
    +       '<div class="dp-chart-leg"><div class="dp-chart-leg-dot" style="background:#94a3b8;"></div>계획 (목표 ' + thisMonthSched.length + '회)</div>'
    +       '<div class="dp-chart-leg ok">진도율 ' + progressPct + '%</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  // 상단 html 먼저 root 에 set, 이후 하단 패널을 append
  // eslint-disable-next-line no-unsanitized/property
  root.innerHTML = html;

  // ── 하단 2열: 운영 알림 + 빠른 액션 ──
  // 알림 목록 자동 구성: 미작성 (전체 합산) + 이번 달 미작성 + 최근 공지 1건
  var alerts = [];
  if (pendingSched.length > 0) {
    alerts.push({
      ic: '⚠️', cls: 'warn',
      title: '이번 달 미작성 세션 ' + pendingSched.length + '건',
      text: '일정은 지났지만 아직 세션 기록이 작성되지 않았어요. 보고서 탭에서 작성할 수 있습니다.',
      time: '이번 달 누적'
    });
  }
  var totalUnwritten = (typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : []);
  if (totalUnwritten.length > 0) {
    // 선생님별 카운트 집계
    var byTeacher = {};
    totalUnwritten.forEach(function(u){ byTeacher[u.teacher || '미배정'] = (byTeacher[u.teacher || '미배정'] || 0) + 1; });
    var byTeacherText = Object.keys(byTeacher).slice(0,3).map(function(t){ return escHtml(t) + ' ' + byTeacher[t] + '건'; }).join(' / ');
    alerts.push({
      ic: '💬', cls: 'info',
      title: '미작성 세션 ' + totalUnwritten.length + '건 (전체 선생님)',
      text: byTeacherText + (Object.keys(byTeacher).length > 3 ? ' 외' : '') + '. 선생님께 리마인드 전송 가능합니다.',
      time: '최근 7일 기준'
    });
  }
  if (_bannerNotices && _bannerNotices.length > 0) {
    var topNotice = _bannerNotices[0];
    var noticeContent = (topNotice.content || '').toString();
    alerts.push({
      ic: topNotice.notice_type === 'imp' ? '🔴' : '📢', cls: 'ok',
      title: topNotice.title || '공지',
      // 사용자 입력 — escape 필수
      text: escHtml(noticeContent.slice(0, 80)) + (noticeContent.length > 80 ? '...' : ''),
      time: topNotice.created_at ? topNotice.created_at.slice(0,10) : ''
    });
  }

  html = '<div class="dp-grid-2-eq">';

  // 운영 알림
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📢 운영 알림</div>'
    +       '<div class="dp-panel-sub">' + (alerts.length ? '조치가 필요한 항목 ' + alerts.length + '건' : '모두 정상') + '</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(1)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">';
  if (alerts.length === 0) {
    html += '<div class="dp-empty">📭 처리할 알림이 없어요. 모든 항목이 정상이에요.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:8px;">' + alerts.slice(0,4).map(function(a){
      return ''
        + '<div class="dp-alert-big dp-alert-' + a.cls + '">'
        +   '<div class="dp-alert-ic">' + a.ic + '</div>'
        +   '<div class="dp-alert-body">'
        +     '<div class="dp-alert-title">' + escHtml(a.title) + '</div>'
        // eslint-disable-next-line no-unsanitized/property -- a.text는 생성 시점에 escHtml 처리된 값(하드코딩 문자열 or escHtml() 래핑)으로만 구성됨
        +     '<div class="dp-alert-text">' + a.text + '</div>'
        +     (a.time ? '<div class="dp-alert-time">' + escHtml(a.time) + '</div>' : '')
        +   '</div>'
        + '</div>';
    }).join('') + '</div>';
  }
  html += '</div></div>';

  // 빠른 액션
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">⚡ 빠른 액션</div>'
    +       '<div class="dp-panel-sub">자주 쓰는 운영 작업</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:none;cursor:pointer;" onclick="switchTab(2)">'
    +       '<div class="dp-tl-av dp-av-2" style="background:#fef3c7;color:#a16207;">📝</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">' + (pendingSched.length ? '미작성 세션 ' + pendingSched.length + '건 작성' : '세션 기록 작성') + '</div><div class="dp-tl-meta">' + (pendingSched.length ? '이번 달 미작성 — 우선 처리 권장' : '대기 건 없음') + '</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(7)">'
    +       '<div class="dp-tl-av dp-av-6" style="background:#dbeafe;color:#1e40af;">💬</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">선생님 라운지·메시지</div><div class="dp-tl-meta">미작성 리마인드 / 공지 전송</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="goToAdmin(\'service\')">'
    +       '<div class="dp-tl-av dp-av-1" style="background:#dcfce7;color:#15803d;">➕</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">선생님 관리·초대</div><div class="dp-tl-meta">관리자 콘솔에서 권한 설정</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(2)">'
    +       '<div class="dp-tl-av dp-av-3" style="background:#ede9fe;color:#6d28d9;">📤</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">월간 보고서·포트폴리오</div><div class="dp-tl-meta">' + (todayDate.getMonth()+1) + '월 성과 출력</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  html += '</div>'; // grid-2-eq end

  // 안전하게 append (innerHTML += 보다 빠르고 안정적)
  // eslint-disable-next-line no-unsanitized/method
  root.insertAdjacentHTML('beforeend', html);

  // 비동기: madi_users 에서 선생님 전체 가져와 활동 0건 선생님도 포함
  _dpLoadAdminTeacherTable(teacherStats, monStr, sunStr);
}

// 선생님 활동표 행 렌더 (헬퍼)
// rows: [{name, count, weekSched, weekSession, unwritten, inactive}, ...]
function _dpRenderTeacherRows(rows, placeholder) {
  if (!rows || rows.length === 0) {
    if (placeholder) return '<div class="dp-empty">불러오는 중...</div>';
    return '<div class="dp-empty">등록된 선생님이 없습니다</div>';
  }
  var head = ''
    + '<div class="dp-trow head">'
    +   '<div></div><div>선생님</div>'
    +   '<div class="dp-tstat"><div class="dp-tstat-label">담당</div></div>'
    +   '<div class="dp-tstat"><div class="dp-tstat-label">세션/주</div></div>'
    +   '<div class="dp-tstat"><div class="dp-tstat-label">미작성</div></div>'
    + '</div>';
  var body = rows.slice(0, 10).map(function(t){
    var meta = t.inactive ? '활동 없음' : '활동 중';
    var nameStyle = t.inactive ? 'color:#94a3b8;' : '';
    return ''
      + '<div class="dp-trow">'
      +   '<div class="dp-tav ' + _dpAvatarClass(t.name) + '" style="' + (t.inactive ? 'opacity:0.55;' : '') + '">' + escHtml(_dpInitial(t.name)) + '</div>'
      +   '<div class="dp-tinfo"><div class="dp-tname" style="' + nameStyle + '">' + escHtml(t.name) + '</div><div class="dp-tmeta">' + meta + '</div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num">' + (t.count || 0) + '</div><div class="dp-tstat-label">명</div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num">' + (t.weekSession || 0) + '<small style="color:#94a3b8;font-weight:600;">/' + (t.weekSched || 0) + '</small></div><div class="dp-tstat-label"></div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num ' + (t.unwritten ? 'warn' : '') + '">' + (t.unwritten || 0) + '</div><div class="dp-tstat-label">건</div></div>'
      + '</div>';
  }).join('');
  return head + body;
}

// madi_users 조회 후 활동 통계와 머지 (이름 매칭)
// 캐시: madi_users 는 자주 안 바뀜 → 60초 TTL 캐시로 폴링 시 재호출 방지
function _dpLoadAdminTeacherTable(teacherStats, monStr, sunStr) {
  var tableEl = document.getElementById('dpAdminTeacherTable');
  var subEl = document.getElementById('dpAdminTeacherSub');
  if (!tableEl) return;
  // 슈퍼관리자는 전 센터, admin 은 본인 센터
  var role = (currentUser && currentUser.role) || '';
  var query = 'madi_users?role=eq.teacher&select=id,name,username&order=name.asc';
  if (role === 'admin' && currentUser.center_id) {
    query += '&center_id=eq.' + encodeURIComponent(currentUser.center_id);
  }
  // role=superadmin 은 필터 없이 전체 가져옴

  // 캐시 사용 (60초 TTL, 같은 query 한정)
  var cache = window._dpTeachersCache;
  if (cache && cache.query === query && (Date.now() - cache.ts) < 60000) {
    _dpRenderTeacherTable(cache.rows, teacherStats, tableEl, subEl);
    return;
  }

  supaFetch(query, 'GET')
    .then(function(rows) {
      if (Array.isArray(rows)) {
        window._dpTeachersCache = { query: query, rows: rows, ts: Date.now() };
      }
      _dpRenderTeacherTable(rows, teacherStats, tableEl, subEl);
    })
    .catch(function(e) {
      if (window.console && console.warn) console.warn('[silent dpAdmin teachers]', e && e.message);
      showToast('⚠️ 데이터 로드 실패');
      var fallback = Object.keys(teacherStats).map(function(name){
        var s = teacherStats[name];
        return {
          name: name, count: Object.keys(s.children).length,
          weekSched: s.weekSched, weekSession: s.weekSession, unwritten: s.unwritten,
          inactive: false
        };
      }).sort(function(a,b){ return b.count - a.count; });
      // eslint-disable-next-line no-unsanitized/property
      tableEl.innerHTML = _dpRenderTeacherRows(fallback);
      if (subEl) subEl.textContent = '이번 주 · 선생님 ' + fallback.length + '명 (활동 데이터 기반)';
    });
}

// madi_users rows + teacherStats 머지·렌더 (캐시 / 실패 fallback 양쪽에서 호출)
function _dpRenderTeacherTable(rows, teacherStats, tableEl, subEl) {
  if (!Array.isArray(rows)) rows = [];
  // 머지: madi_users 의 모든 선생님 + 활동 통계
  var merged = rows.map(function(u){
    var name = u.name || u.username || '?';
    var s = teacherStats[name];
    if (s) {
      return {
        name: name,
        count: Object.keys(s.children).length,
        weekSched: s.weekSched,
        weekSession: s.weekSession,
        unwritten: s.unwritten,
        inactive: false
      };
    }
    return { name: name, count: 0, weekSched: 0, weekSession: 0, unwritten: 0, inactive: true };
  });
  // madi_users 에 없는 활동 이름 (외부 자료 import 등) — orphan 으로 같이 표시
  var knownNames = {};
  rows.forEach(function(u){ knownNames[u.name || u.username || ''] = true; });
  Object.keys(teacherStats).forEach(function(name){
    if (!knownNames[name]) {
      var s = teacherStats[name];
      merged.push({
        name: name,
        count: Object.keys(s.children).length,
        weekSched: s.weekSched,
        weekSession: s.weekSession,
        unwritten: s.unwritten,
        inactive: false
      });
    }
  });
  // 정렬: 활동 있는 순 → 담당 아동 수 내림차순
  merged.sort(function(a, b){
    if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
    return b.count - a.count;
  });
  // eslint-disable-next-line no-unsanitized/property
  tableEl.innerHTML = _dpRenderTeacherRows(merged);
  if (subEl) {
    var active = merged.filter(function(t){ return !t.inactive; }).length;
    subEl.textContent = '이번 주 · 선생님 ' + merged.length + '명 (활동 ' + active + '명)';
  }
}
