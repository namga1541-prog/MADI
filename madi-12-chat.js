// ─────── 플로팅 AI 비서 (madi-12.js 에서 분리, 2026-05-23) ───────
// 의존: callClaude, currentUser, childDB, sessionDB, scheduleDB, supaFetch, escHtml,
//        addSchedule, openSessionModal, switchTab 등 (madi-01 ~ madi-11 의 전역들)
// 모든 전역은 다른 madi-*.js 가 로드된 뒤 호출되므로 함수 정의 순서는 무관.

// ─────── 플로팅 AI 비서 ───────
var chatHistory = [];
var chatOpen    = false;
var chatWaiting = false;

function toggleChat() {
  var chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  chatOpen = !chatOpen;
  chatWindow.classList[chatOpen ? 'add' : 'remove']('open');
  var unreadDot = document.getElementById('unreadDot');
  if (unreadDot) unreadDot.classList.remove('show');

  var floatBtn = document.getElementById('floatBtn');
  if (floatBtn) floatBtn.classList[chatOpen ? 'add' : 'remove']('chat-is-open');
  var ico  = document.querySelector('#floatBtn .float-ico');
  var name = document.querySelector('#floatBtn .float-name');
  var sub  = document.querySelector('#floatBtn .float-sub');
  if (ico)  ico.textContent  = chatOpen ? '✕' : '🤖';
  if (name) name.textContent = chatOpen ? '닫기' : '마로';
  if (sub)  sub.style.display = chatOpen ? 'none' : '';

  if (chatOpen && chatHistory.length === 0) {
    setTimeout(function() { addAiMsg(getChatGreeting()); }, 300);
  }
  if (chatOpen) {
    setTimeout(function() {
      var el = document.getElementById('chatInput');
      if (el) el.focus();
    }, 350);
  }
}

// ── 마로 버튼 드래그 이동 (Pointer Events API) ──
// setPointerCapture 를 사용하므로 document 레벨 리스너 불필요
// 마우스·터치·스타일러스를 단일 API 로 처리, iOS touchcancel 문제 원천 해결
function initFloatBtnDrag() {
  var btn = document.getElementById('floatBtn');
  if (!btn) return;

  // 키보드 접근성: Space / Enter 로 채팅창 토글 (VoiceOver, TalkBack, 키보드 내비게이션)
  btn.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleChat(); }
  });

  // 클릭 토글 — 데스크톱·모바일 공통 (드래그 중 클릭은 무시)
  btn.addEventListener('click', function() {
    if (btn.dataset.dragged) return;
    toggleChat();
  });

  // 데스크톱(≥768px): CSS 사이드 패널 탭 모드 — 드래그 비활성화
  // (CSS @media(min-width:768px) 가 버튼을 right:0 고정 탭으로 관리함)
  if (window.innerWidth >= 768) return;

  var _dragging = false;
  var _moved    = false;
  var _startX, _startY, _startTop, _startRight;

  // touch-action:none — 브라우저가 이 요소의 터치를 스크롤/줌 제스처로 가로채지 않도록 설정
  // Pointer Events 의 setPointerCapture 가 제대로 동작하려면 필수
  btn.style.touchAction = 'none';

  // ── 저장 위치 복원 (화면 회전·사이즈 변경 대비 클램핑) ──
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('madi_maro_pos') || 'null'); } catch (e) { /* silent: private mode / 구브라우저 */ }
  if (saved) {
    var bw = btn.offsetWidth  || 56;
    var bh = btn.offsetHeight || 56;
    var clampedTop   = Math.max(0, Math.min(saved.top,   window.innerHeight - bh));
    var clampedRight = Math.max(12, Math.min(saved.right, window.innerWidth  - bw - 12));
    btn.style.top   = clampedTop   + 'px';
    btn.style.setProperty('bottom', 'auto', 'important'); // CSS !important 규칙 덮어쓰기
    btn.style.right = clampedRight + 'px';
    btn.style.left  = 'auto';
    btn.style.transform = 'none';
    // 저장된 스냅 방향을 body 클래스에 반영 — 채팅창 위치 연동
    document.body.classList[clampedRight > window.innerWidth / 2 ? 'add' : 'remove']('maro-left');
  }

  // ── 화면 회전 / 리사이즈 시 위치 재클램핑 ──
  window.addEventListener('resize', function() {
    if (!btn.style.top) return; // 저장 위치 없음 — CSS 기본값 유지
    var bw2 = btn.offsetWidth  || 56;
    var bh2 = btn.offsetHeight || 56;
    btn.style.top   = Math.max(0, Math.min(parseFloat(btn.style.top),   window.innerHeight - bh2)) + 'px';
    btn.style.right = Math.max(0, Math.min(parseFloat(btn.style.right), window.innerWidth  - bw2)) + 'px';
  });

  function onStart(e) {
    // btn 내부의 텍스트 입력 요소를 터치한 경우 드래그 시작 안 함
    var t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;

    _dragging = true;
    _moved    = false;
    _startX   = e.clientX;
    _startY   = e.clientY;
    var rect  = btn.getBoundingClientRect();
    _startTop   = rect.top;
    _startRight = window.innerWidth - rect.right;
    btn.classList.add('dragging');

    // setPointerCapture: 버튼 밖에서 발생하는 이벤트도 btn 으로 라우팅 — document 리스너 불필요
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 구형 브라우저 폴백 */ }
  }

  function onMove(e) {
    if (!_dragging) return;
    var dx = e.clientX - _startX;
    var dy = e.clientY - _startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _moved = true;
    if (!_moved) return;

    var newTop   = Math.max(0, Math.min(_startTop + dy, window.innerHeight - btn.offsetHeight));
    var newRight = Math.max(0, Math.min(_startRight - dx, window.innerWidth - btn.offsetWidth));

    btn.style.top   = newTop   + 'px';
    btn.style.setProperty('bottom', 'auto', 'important'); // CSS !important 규칙 덮어쓰기
    btn.style.right = newRight + 'px';
    btn.style.left  = 'auto';
    btn.style.transform = 'none';
    // preventDefault 불필요: touch-action:none + setPointerCapture 가 스크롤 간섭 원천 차단
  }

  function onEnd(e) {
    if (!_dragging) return;
    _dragging = false;
    btn.classList.remove('dragging');

    if (!_moved) return;

    // ── 엣지 스냅: 버튼 중심 X 기준 가장 가까운 좌/우 엣지로 자동 흡착 ──
    var bw3      = btn.offsetWidth || 56;
    var curRight = parseFloat(btn.style.right) || 12;
    var centerX  = window.innerWidth - curRight - bw3 / 2;
    var isLeft   = centerX < window.innerWidth / 2;
    var snapRight = isLeft
      ? window.innerWidth - bw3 - 12   // 왼쪽 엣지 (12px 여백)
      : 12;                             // 오른쪽 엣지 (12px 여백)

    // 스냅 방향을 body 클래스에 반영 — 채팅창 위치 연동 (CSS body.maro-left .chat-window)
    document.body.classList[isLeft ? 'add' : 'remove']('maro-left');

    // CSS .float-btn.snapping 에 transition 정의 — 스냅 이동을 부드럽게
    btn.classList.add('snapping');
    btn.style.right = snapRight + 'px';
    setTimeout(function() { btn.classList.remove('snapping'); }, 230);

    // 스냅된 최종 위치 저장
    try {
      localStorage.setItem('madi_maro_pos', JSON.stringify({
        top:   parseInt(btn.style.top),
        right: snapRight
      }));
    } catch (err) { /* silent: private mode / 구브라우저 */ }

    btn.dataset.dragged = '1';
    setTimeout(function() { delete btn.dataset.dragged; }, 150);
  }

  // Pointer Events 4종: 마우스·터치·스타일러스 통합 — document 리스너 전혀 없음
  btn.addEventListener('pointerdown',   onStart);
  btn.addEventListener('pointermove',   onMove);
  btn.addEventListener('pointerup',     onEnd);
  btn.addEventListener('pointercancel', onEnd); // iOS 제스처 충돌·시스템 인터럽트 시 리셋

  btn.removeAttribute('onclick'); // 혹시 남아있을 inline onclick 제거
}

function getChatGreeting() {
  var hour = new Date().getHours();
  var time = hour < 12 ? '오늘도 좋은 하루 시작해요' : hour < 18 ? '즐거운 오후 되세요' : '오늘 하루도 수고하셨어요';
  var cnt  = childDB ? childDB.length : 0;
  var uw   = (typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : []).length;
  var msg  = time + '! 👋 저는 마디의 AI 길잡이 마로예요.\n현재 등록된 아동 ' + cnt + '명의 데이터를 알고 있어요.';
  if (uw > 0) msg += '\n\n⚠️ 미작성 세션이 ' + uw + '개 있어요. 확인해볼까요?';
  else        msg += '\n\n아동·세션·치료 계획 무엇이든 물어보세요!';
  msg += '\n\n아래 버튼으로 바로 시작할 수 있어요 👇\n• 오늘 요약 — 오늘 치료 현황 한눈에\n• 미작성 확인 — 빠뜨린 세션 체크\n• 바우쳐 현황 — 이달 바우쳐 사용량\n• 정체 확인 — 진전이 멈춰 아동\n\n💬 직접 입력도 돼요. 예) "서규민 마지막 세션 어때?"';
  return msg;
}

var CHAT_HISTORY_MAX = 100;

function trimChatHistory() {
  if (chatHistory.length > CHAT_HISTORY_MAX) {
    chatHistory = chatHistory.slice(-CHAT_HISTORY_MAX);
  }
}

function addAiMsg(text) {
  chatHistory.push({ role: 'assistant', content: text });
  trimChatHistory();
  renderChatMessages();
  if (!chatOpen) { var _dot = document.getElementById('unreadDot'); if (_dot) _dot.classList.add('show'); }
}

function addUserMsg(text) {
  chatHistory.push({ role: 'user', content: text });
  trimChatHistory();
  renderChatMessages();
}

function renderChatMessages() {
  var container = document.getElementById('chatMessages');
  if (!container) return;
  var html = '';
  chatHistory.forEach(function(msg) {
    var isUser = msg.role === 'user';
    var now    = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    html += '<div class="msg-row ' + (isUser ? 'user' : 'ai') + '">'
      + (isUser ? '' : '<div class="msg-avatar">🤖</div>')
      + '<div>'
      + '<div class="msg-bubble">' + escHtml(msg.content || '').replace(/\n/g, '<br>') + '</div>'
      + '<div class="msg-time">' + now + '</div>'
      + '</div>'
      + (isUser ? '<div class="msg-avatar" style="background:#dbeafe;">😊</div>' : '')
      + '</div>';
  });
  // eslint-disable-next-line no-unsanitized/property
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  var container = document.getElementById('chatMessages');
  if (!container) return;
  var el = document.createElement('div');
  el.id = 'typingIndicator';
  el.innerHTML = '<div class="msg-row ai"><div class="msg-avatar">🤖</div>'
    + '<div class="chat-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
  var el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function onChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function autoResizeChat(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
}

function sendQuick(text) {
  var inp = document.getElementById('chatInput');
  if (!inp) return;
  inp.value = text;
  sendChat();
}

// ─────── AI 비서 행동 명령 (W2) ───────
function parseAction(reply) {
  if (!reply) return { displayText: '', action: null };
  var match = reply.match(/```action\s*([\s\S]*?)```/);
  if (!match) return { displayText: reply, action: null };
  var displayText = reply.replace(/```action\s*[\s\S]*?```/, '').trim();
  try {
    var action = JSON.parse(match[1].trim());
    return { displayText: displayText, action: action };
  } catch(e) {
    console.warn('[Action] JSON 파싱 실패:', e);
    return { displayText: reply, action: null };
  }
}

function executeAction(action) {
  if (!action || !action.type) return;
  try {
    switch(action.type) {
      case 'addSchedule':         actAddSchedule(action); break;
      case 'openSessionForChild': actOpenSessionForChild(action); break;
      case 'openParentReport':    actOpenParentReport(action); break;
      case 'switchTab':           actSwitchTab(action); break;
      case 'showUnwritten':       actShowUnwritten(); break;
      default: console.warn('[Action] 알 수 없는 액션:', action.type);
    }
  } catch(e) {
    console.error('[Action] 실행 실패:', e);
    showToast('❌ 액션 실행 실패: ' + e.message);
  }
}

function actAddSchedule(a) {
  if (!a.childId || !a.date || !a.startTime) {
    showToast('❌ 일정 정보 부족 (아동/날짜/시간)');
    return;
  }
  var child = childDB.find(function(c) { return c.id === a.childId; });
  if (!child) { showToast('❌ 아동을 찾을 수 없습니다'); return; }
  // 날짜·시간 형식 검증 (AI 오출력 방지)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
    showToast('❌ 일정 날짜 형식 오류 — AI가 YYYY-MM-DD 형식을 반환하지 않았습니다'); return;
  }
  if (!/^\d{2}:\d{2}$/.test(a.startTime)) {
    showToast('❌ 시작 시간 형식 오류 — AI가 HH:MM 형식을 반환하지 않았습니다'); return;
  }
  var dur = a.duration || 40;
  var endTime = '';
  try {
    var parts = a.startTime.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return;
    var totalMin = h * 60 + m + dur;
    endTime = String(Math.floor(totalMin / 60)).padStart(2, '0') + ':' + String(totalMin % 60).padStart(2, '0');
  } catch(e) { endTime = a.startTime; }
  var teacherName = '';
  var teacherColor = '';
  if (a.teacher && typeof a.teacher === 'string' && a.teacher.trim()) {
    // 교사 이름 검증 — 알려진 교사가 아니면 현재 사용자로 대체
    var _reqName = a.teacher.trim();
    var _knownNames = {};
    scheduleDB.forEach(function(s) { if (s.teacher) _knownNames[s.teacher] = true; });
    if (currentUser) _knownNames[currentUser.name] = true;
    if (!_knownNames[_reqName]) {
      showToast('⚠️ AI가 생성한 교사 이름("' + _reqName + '")을 확인할 수 없어 현재 사용자로 대체합니다');
      teacherName = currentUser ? currentUser.name : '';
    } else {
      teacherName = _reqName;
    }
    var existing = scheduleDB.find(function(s) { return s.teacher === teacherName && s.teacherColor; });
    teacherColor = existing ? existing.teacherColor : (typeof getTeacherColor === 'function' ? getTeacherColor(teacherName) : '');
  } else if (currentUser) {
    teacherName = currentUser.name;
    teacherColor = currentUser.color || '';
  }

  var newSched = {
    id: 'sched_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    childId: child.id,
    date: a.date,
    startTime: a.startTime,
    endTime: endTime,
    teacher: teacherName,
    teacherColor: teacherColor,
    repeat: 'none'
  };
  scheduleDB.push(newSched);
  saveSchedule();
  if (typeof renderSchedView === 'function') renderSchedView();
  if (typeof renderUnwrittenAlert === 'function') renderUnwrittenAlert();
  var teacherTxt = teacherName ? ' [' + teacherName + ']' : '';
  showToast('✅ ' + child.name + ' 일정 추가 (' + a.date + ' ' + a.startTime + ')' + teacherTxt);
}

function actOpenSessionForChild(a) {
  if (!a.childId) return;
  var child = childDB.find(function(c) { return c.id === a.childId; });
  if (!child) { showToast('❌ 아동을 찾을 수 없습니다'); return; }
  if (typeof switchTab === 'function') switchTab(2);
  setTimeout(function() {
    var sel = document.getElementById('sessionChild');
    if (sel) {
      sel.value = a.childId;
      if (typeof loadGoalRows === 'function') loadGoalRows(a.childId);
    }
  }, 200);
  if (chatOpen) toggleChat();
  showToast('📝 ' + child.name + ' 세션 화면으로 이동');
}

function actOpenParentReport(a) {
  if (!a.childId) return;
  var child = childDB.find(function(c) { return c.id === a.childId; });
  if (!child) { showToast('❌ 아동을 찾을 수 없습니다'); return; }
  if (typeof switchTab === 'function') switchTab(2);
  if (typeof switchReportTab === 'function') switchReportTab('report');
  setTimeout(function() {
    var sel = document.getElementById('reportChild');
    if (sel) sel.value = a.childId;
  }, 200);
  if (chatOpen) toggleChat();
  showToast('📨 ' + child.name + ' 부모 리포트 화면으로 이동');
}

function actSwitchTab(a) {
  if (typeof a.tab !== 'number' || a.tab < 0 || a.tab > 6) return;
  if (typeof switchTab === 'function') switchTab(a.tab);
  if (chatOpen) toggleChat();
}

function actShowUnwritten() {
  if (typeof switchTab === 'function') switchTab(2);
  if (typeof switchReportTab === 'function') switchReportTab('session');
  setTimeout(function() {
    var alertEl = document.getElementById('unwrittenAlert');
    if (alertEl) alertEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 250);
  if (chatOpen) toggleChat();
}

// ─────── 매크로 시스템 (W3) ───────
var CHAT_MACROS = {
  '/도움말':    { emoji: '📖', desc: '매크로 목록 보기',     fn: macroHelp },
  '/오늘브리핑': { emoji: '☀️', desc: '오늘 일정·미작성·우선순위', fn: macroTodayBrief },
  '/미작성정리': { emoji: '⚠️', desc: '미작성 세션 목록',       fn: macroUnwritten },
  '/주간현황':  { emoji: '📊', desc: '이번 주 통계',          fn: macroWeeklyStatus },
  '/우수아동':  { emoji: '⭐', desc: '진전 우수 Top 3',        fn: macroTopProgress }
};

function macroHelp() {
  var lines = ['💡 사용 가능한 매크로:'];
  Object.keys(CHAT_MACROS).forEach(function(k) {
    var m = CHAT_MACROS[k];
    lines.push(m.emoji + ' ' + k + ' - ' + m.desc);
  });
  lines.push('\n자연어로도 명령 가능해요!');
  lines.push('예: "민준 다음 주 화요일 4시에 일정 추가해줘"');
  return lines.join('\n');
}

function macroTodayBrief() {
  var today = getTodayKST();
  var todayName = new Date().toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' });
  var todaySchedules = scheduleDB.filter(function(s) { return s.date === today; })
    .sort(function(a, b) { return (a.startTime || '').localeCompare(b.startTime || ''); });
  var unwritten = typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : [];

  var msg = '☀️ ' + todayName + ' 브리핑\n';
  if (currentUser) msg += '👤 ' + currentUser.name + ' 선생님\n';
  msg += '\n📅 오늘 일정 ' + todaySchedules.length + '건';
  if (todaySchedules.length > 0) {
    msg += '\n';
    todaySchedules.slice(0, 6).forEach(function(s) {
      var c = childDB.find(function(c) { return c.id === s.childId; });
      var teacherTxt = s.teacher ? ' · ' + s.teacher : '';
      msg += '  ' + (s.startTime || '') + ' ' + (c ? c.name : '?') + teacherTxt + '\n';
    });
  } else {
    msg += '\n';
  }
  msg += '\n⚠️ 미작성 ' + unwritten.length + '건';
  if (unwritten.length > 0) msg += ' — 빠르게 정리해드릴까요?';
  return msg.trim();
}

function macroUnwritten() {
  var uw = typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : [];
  if (uw.length === 0) return '✅ 미작성 세션 없어요! 깔끔하게 정리되어 있네요.';
  var lines = ['⚠️ 미작성 세션 ' + uw.length + '건:\n'];
  uw.slice(0, 10).forEach(function(u) { lines.push('  • ' + u.date + ' ' + u.childName); });
  if (uw.length > 10) lines.push('  ... 외 ' + (uw.length - 10) + '건');
  lines.push('\n세션 탭에서 빠른 입력 가능합니다.');
  return lines.join('\n');
}

function macroWeeklyStatus() {
  var now = nowKST();
  var dayOfWeek = now.getDay();
  var monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  var mondayStr = ymd(monday);

  var weekSessions = sessionDB.filter(function(s) { return s.date >= mondayStr; });
  var weekSched    = scheduleDB.filter(function(s) { return s.date >= mondayStr; });
  var uniqueChildren = {};
  weekSessions.forEach(function(s) { uniqueChildren[s.childId] = true; });

  return '📊 이번 주 현황 (' + mondayStr + '~)\n\n'
    + '• 진행 세션: ' + weekSessions.length + '회\n'
    + '• 등록 일정: ' + weekSched.length + '건\n'
    + '• 만난 아동: ' + Object.keys(uniqueChildren).length + '명\n'
    + '• 미작성: ' + (typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions().length : 0) + '건';
}

function macroTopProgress() {
  var fourWeeksAgo = nowKST(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  var cutoffStr = ymd(fourWeeksAgo);
  var ranked = [];
  childDB.forEach(function(c) {
    var ss = sessionDB.filter(function(s) { return s.childId === c.id && s.date >= cutoffStr; })
      .sort(function(a, b) { return a.date.localeCompare(b.date); });
    if (ss.length < 2) return;
    var first = ss[0], last = ss[ss.length - 1];
    var avg = function(sess) {
      var scores = (sess.goals || []).filter(function(g) { return typeof g.score === 'number'; }).map(function(g) { return g.score; });
      return scores.length ? scores.reduce(function(a, b) { return a + b; }, 0) / scores.length : null;
    };
    var fAvg = avg(first), lAvg = avg(last);
    if (fAvg === null || lAvg === null) return;
    ranked.push({ name: c.name, delta: lAvg - fAvg, last: lAvg });
  });
  ranked.sort(function(a, b) { return b.delta - a.delta; });

  if (ranked.length === 0) return '🌱 아직 비교할 데이터가 부족해요. 세션이 더 쓰이면 분석해드릴게요!';

  var top = ranked.slice(0, 3);
  var medals = ['🥇', '🥈', '🥉'];
  var msg = '⭐ 최근 4주 진전 우수 Top 3\n\n';
  top.forEach(function(r, i) {
    var sign = r.delta >= 0 ? '+' : '';
    msg += medals[i] + ' ' + r.name + ' (' + sign + r.delta.toFixed(1) + '%p, 현재 ' + r.last.toFixed(0) + '%)\n';
  });
  return msg.trim();
}

function tryMacro(text) {
  if (!text || text[0] !== '/') return false;
  var key = text.trim().split(/\s+/)[0];
  var macro = CHAT_MACROS[key];
  if (!macro) return false;
  addUserMsg(text);
  setTimeout(function() { addAiMsg(macro.fn()); }, 200);
  return true;
}

// ─────── 채팅 음성 입력 (W3) ───────
var chatRecognition = null;
var isChatRecording = false;

function toggleChatVoiceInput() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome 권장)');
    return;
  }
  if (isChatRecording) {
    if (chatRecognition) chatRecognition.stop();
    return;
  }

  chatRecognition = new SR();
  chatRecognition.lang = 'ko-KR';
  chatRecognition.continuous = false;
  chatRecognition.interimResults = false;

  chatRecognition.onstart = function() {
    isChatRecording = true;
    var btn = document.getElementById('chatMicBtn');
    if (!btn) return;
    btn.classList.add('recording');
    btn.textContent = '🔴';
    btn.title = '녹음 중... (탭하면 종료)';
  };
  chatRecognition.onresult = function(ev) {
    var input = document.getElementById('chatInput');
    if (!input) return;
    var newText = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      newText += ev.results[i][0].transcript + ' ';
    }
    input.value = (input.value + ' ' + newText).trim();
    autoResizeChat(input);
  };
  chatRecognition.onerror = function(ev) {
    showToast('음성 인식 오류: ' + ev.error);
    resetChatMicBtn();
  };
  chatRecognition.onend = function() { resetChatMicBtn(); };

  chatRecognition.start();
}

function resetChatMicBtn() {
  var btn = document.getElementById('chatMicBtn');
  isChatRecording = false;
  if (btn) {
    btn.classList.remove('recording');
    btn.textContent = '🎤';
    btn.title = '음성 입력';
  }
}

function sendChat() {
  if (chatWaiting) return;

  if (!currentUser) { showToast('⚠️ 로그인이 필요합니다.'); return; }

  // useAI 권한 검사 — 권한 없는 선생님이 마로 채팅을 통해 AI를 우회 사용하는 것 차단
  if (typeof canDo === 'function' && !canDo('useAI')) {
    addAiMsg('AI 기능 사용 권한이 없습니다. 센터장에게 문의해주세요. 🔒');
    return;
  }

  var input = document.getElementById('chatInput');
  var text  = input.value.trim();
  if (!text) return;

  if (tryMacro(text)) {
    input.value = '';
    input.style.height = 'auto';
    return;
  }

  var apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { addAiMsg('API 키를 상단에 먼저 입력해주세요! 🔑'); return; }

  input.value = '';
  input.style.height = 'auto';
  addUserMsg(text);

  chatWaiting = true;
  document.getElementById('chatSendBtn').disabled = true;
  document.getElementById('chatQuickBtns').style.display = 'none';
  showTypingIndicator();

  var ctx      = buildChatContext();
  var SYSTEM   = '당신은 마디(Madi) 언어치료 앱에 내장된 AI 비서 "마로"입니다. '
    + '치료사가 편하게 물어볼 수 있는 친근한 동료 역할을 합니다.\n\n'
    + '【현재 앱 데이터】\n' + ctx + '\n\n'
    + '【역할별 답변 기준 — 반드시 준수】\n'
    + '- 현재 로그인 사용자가 관리자(admin)인 경우: 모든 치료사·아동 데이터 기준으로 답변\n'
    + '- 현재 로그인 사용자가 선생님(teacher)인 경우: 해당 선생님 담당 데이터만 기준으로 답변\n'
    + '- "오늘 세션 요약", "오늘 치료" 같은 질문은 위 기준에 따라 정확하게 요약\n\n'
    + '【답변 규칙】\n'
    + '- 한국어 친근한 존댓말, 간결하게(3문장 내외)\n'
    + '- 데이터 기반으로 정확하게, 치료 전문 조언 가능\n'
    + '- 이모지 적절히 활용\n\n'
    + '【액션 사용 규칙 — 매우 중요】\n'
    + '- "마지막 세션 어때?", "~알려줘", "~있어?", "~벇 명?", "~요약해줘" 등 정보 조회 질문은\n'
    + '  절대로 액션 블록을 추가하지 말고 텍스트 답변만 하세요.\n'
    + '- 액션은 오직 "~해줘(실제 작업)", "~추가해줘", "~열어줘" 처럼 명시적 작업 요청일 때만 사용\n\n'
    + '【행동 명령 (Action) — 작업 요청 시만 사용】\n'
    + '형식 (반드시 ```action 펜스 안에 JSON):\n'
    + '```action\n{"type":"액션명","...":""}\n```\n\n'
    + '지원 액션:\n'
    + '1. addSchedule: 일정 추가 (위 데이터의 [id:xxx] 사용. teacher는 위 [치료사 목록]의 정확한 이름 또는 생략 시 현재 로그인 사용자)\n'
    + '   {"type":"addSchedule","childId":"<id>","date":"YYYY-MM-DD","startTime":"HH:MM","duration":40,"teacher":"<\uc120\uc0dd\ub2d8 \uc774\ub984>"}\n'
    + '2. openSessionForChild: 세션 기록 화면 열기 (명시적으로 "열어줘", "이동해줘" 요청 시만)\n'
    + '   {"type":"openSessionForChild","childId":"<id>"}\n'
    + '3. openParentReport: 부모 리포트 화면 열기\n'
    + '   {"type":"openParentReport","childId":"<id>"}\n'
    + '4. switchTab: 탭 전환 (0:캘린더 1:아동관리 2:보고서 3:포트폴리오 4:서비스 5:관리자)\n'
    + '   {"type":"switchTab","tab":3}\n'
    + '5. showUnwritten: 미작성 세션 강조\n'
    + '   {"type":"showUnwritten"}\n\n'
    + '치료사별 일정 질문 시 위 [치료사 목록]과 [오늘 스케줄]의 (담당: ___) 정보를 활용하세요. '
    + '액션 블록은 사용자에게 보이지 않고 자동 처리됩니다. 자연스러운 답변 + 필요시 액션블록 형식으로 응답하세요.';

  var messages = chatHistory.slice(0, -1).slice(-8).concat([{ role: 'user', content: text }]);

  fetchWithRetry(EDGE_URL + '/ai-proxy', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL_HAIKU, max_tokens: 600, system: SYSTEM, messages: messages })
  }, {
    retries: 2,
    allowPostRetry: true,
    label: 'AI 비서'
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(e.error ? e.error.message : 'HTTP ' + res.status); });
    return res.json();
  })
  .then(function(data) {
    if (data.usage) {
      var usedModel = (data.model || MODEL_HAIKU);
      recordApiUsage(usedModel, data.usage.input_tokens || 0, data.usage.output_tokens || 0);
    }
    var reply = (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
    hideTypingIndicator();
    var parsed = parseAction(reply);
    addAiMsg(parsed.displayText || '죄송해요, 다시 한번 물어보줘주세요.');
    if (parsed.action) {
      setTimeout(function() { executeAction(parsed.action); }, 600);
    }
  })
  .then(function() {
    chatWaiting = false;
    var _sendBtn = document.getElementById('chatSendBtn');
    if (_sendBtn) _sendBtn.disabled = false;
    var _quickBtns = document.getElementById('chatQuickBtns');
    if (_quickBtns) _quickBtns.style.display = 'flex';
  })
  .catch(function(err) {
    hideTypingIndicator();
    addAiMsg('오류가 발생했어요 😅\n' + (err && err.message ? err.message : '알 수 없는 오류가 발생했습니다.'));
    chatWaiting = false;
    var _sendBtn2 = document.getElementById('chatSendBtn');
    if (_sendBtn2) _sendBtn2.disabled = false;
    var _quickBtns2 = document.getElementById('chatQuickBtns');
    if (_quickBtns2) _quickBtns2.style.display = 'flex';
  });
}

function buildChatContext() {
  var today = getTodayKST();
  var lines = ['📅 오늘: ' + today];

  if (currentUser) {
    var roleTxt = getRoleFlags().isAdminOrSuper ? '관리자' : '선생님';
    lines.push('🔑 현재 로그인: ' + currentUser.name + ' (' + roleTxt + ')');
  }
  // 선생님 역할: 담당 아동만 컨텍스트에 포함 (타 아동 데이터 노출 방지)
  var _isAdminCtx = (typeof getRoleFlags === 'function') ? getRoleFlags().isAdminOrSuper
    : (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'));
  var _myName = currentUser ? currentUser.name : '';
  var visibleChildren = _isAdminCtx ? childDB : childDB.filter(function(c) {
    return scheduleDB.some(function(s) { return s.childId === c.id && s.teacher === _myName; })
      || sessionDB.some(function(s) { return s.childId === c.id && s.teacher === _myName; });
  });
  // 담당 아동이 없으면 (신규 선생님 등) 전체 표시
  if (!_isAdminCtx && visibleChildren.length === 0) visibleChildren = childDB;

  lines.push('👶 등록 아동: ' + visibleChildren.length + '명' + (!_isAdminCtx ? ' (담당)' : ''));

  var weekStart = nowKST();
  var dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  var weekStartStr = ymd(weekStart);

  var teachers = {};
  scheduleDB.forEach(function(s) {
    if (!s.teacher) return;
    if (!teachers[s.teacher]) teachers[s.teacher] = { todayCnt: 0, weekCnt: 0, totalCnt: 0 };
    teachers[s.teacher].totalCnt++;
    if (s.date === today)         teachers[s.teacher].todayCnt++;
    if (s.date >= weekStartStr)   teachers[s.teacher].weekCnt++;
  });
  var teacherNames = Object.keys(teachers);
  if (teacherNames.length > 0) {
    lines.push('\n👥 치료사 목록 (' + teacherNames.length + '명, 일정 기반):');
    teacherNames.forEach(function(name) {
      var t = teachers[name];
      lines.push('  - ' + name + ': 오늘 ' + t.todayCnt + '건, 이번 주 ' + t.weekCnt + '건, 전체 ' + t.totalCnt + '건');
    });
  }

  visibleChildren.forEach(function(c) {
    var ss    = sessionDB.filter(function(s) { return s.childId === c.id; });
    var last  = ss.length > 0 ? ss[ss.length - 1] : null;
    var vUsed = getVoucherUsed(c.id);
    var line  = '  - ' + c.name + ' [id:' + c.id + '] (' + c.age + ', ' + c.type + ') | 세션 ' + ss.length + '회';
    if (last)              line += ' | 최근 ' + last.date;
    if (c.voucherLimit > 0) line += ' | 바우쳐 ' + vUsed + '/' + c.voucherLimit;
    if (last && last.goals && last.goals.length > 0) {
      var g = last.goals.filter(function(g) { return g.score !== null; })
        .map(function(g) { return g.name + ' ' + g.score + '%'; }).join(', ');
      if (g) line += ' | 최근달성: ' + g;
    }
    lines.push(line);
  });

  var uw = getUnwrittenSessions();
  // 선생님: 본인 담당 미작성만 표시
  if (!_isAdminCtx) uw = uw.filter(function(u) { return u.teacher === _myName; });
  if (uw.length > 0) {
    lines.push('\n⚠️ 미작성 세션 ' + uw.length + '건:');
    uw.forEach(function(u) {
      var teacherTxt = u.teacher ? ' (담당: ' + u.teacher + ')' : '';
      lines.push('  - ' + u.date + ' ' + u.childName + teacherTxt);
    });
  }

  // 선생님: 본인 담당 일정만 표시
  var todaySched = scheduleDB.filter(function(s) {
    return s.date === today && (_isAdminCtx || s.teacher === _myName);
  }).sort(function(a, b) { return (a.startTime || '').localeCompare(b.startTime || ''); });
  if (todaySched.length > 0) {
    lines.push('\n📅 오늘 스케줄:');
    todaySched.forEach(function(s) {
      var c = childDB.find(function(c) { return c.id === s.childId; });
      var teacherTxt = s.teacher ? ' (담당: ' + s.teacher + ')' : '';
      lines.push('  - ' + (s.startTime || '') + ' ' + (c ? c.name : '?') + teacherTxt);
    });
  }

  if (assessmentDB.length > 0) {
    lines.push('\n📋 최근 검사: ' + assessmentDB.slice(-3).map(function(a) {
      var c = childDB.find(function(c) { return c.id === a.childId; });
      return (c ? c.name : '?') + ' ' + a.testName;
    }).join(', '));
  }

  return lines.join('\n');
}
