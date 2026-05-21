// ══════════════════════
// madi-15.js — 학부모 포털 전용 로직
// ══════════════════════

var _parentCurrentTab = 'home';

// VAPID 공개키 — vapid-keygen.html 로 생성 후 아래 값 교체
var MADI_VAPID_PUBLIC_KEY = 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';

// ─── 탭 전환 ───
function switchParentTab(tab) {
  _parentCurrentTab = tab;
  window._parentActiveTab = tab; // setActiveParentChild 가 재로드 대상 판별에 사용
  var tabs = ['home','sched','report','notice'];
  tabs.forEach(function(t) {
    var panel = document.getElementById('parentPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
    // ★ 중복 ID 처리: parentTabs + 사이드바 버튼 모두 active 업데이트
    var btnId = 'ptBtn' + t.charAt(0).toUpperCase() + t.slice(1);
    document.querySelectorAll('[id="' + btnId + '"]').forEach(function(btn) {
      btn.classList.toggle('active', t === tab);
    });
  });
  if (tab === 'home')   loadParentHome();
  if (tab === 'sched')  loadParentSched();
  if (tab === 'report') loadParentReport();
  if (tab === 'notice') loadParentNotice();
}

// ─── 내 아동 정보 가져오기 (공통) ───
// 다자녀 학부모 지원: window._parentChildren 에 전체 배열 캐싱, _parentActiveIdx 로 활성 자녀 추적
// onNoChild: 아동 미연결 시 호출되는 콜백 (온보딩용)
function getMyChildInfo(callback, onNoChild) {
  if (!currentUser || currentUser.role !== 'parent') return;

  function _emit() {
    var arr = window._parentChildren;
    var idx = window._parentActiveIdx || 0;
    if (!arr || arr.length === 0) {
      if (typeof onNoChild === 'function') onNoChild();
      return;
    }
    if (idx < 0 || idx >= arr.length) idx = 0;
    var c = arr[idx];
    // 하위 호환 캐시 (window._parentChildId / Center / Name 을 보는 기존 코드용)
    window._parentChildId   = c.child_id;
    window._parentCenterId  = c.center_id;
    window._parentChildName = c.name || '';
    callback(c.child_id, c.center_id);
  }

  // 캐시 유효성 — currentUser.id 가 캐싱된 시점과 동일할 때만 신뢰
  if (window._parentChildren && window._parentCacheUserId === currentUser.id) {
    _emit();
    return;
  }
  // 캐시 무효 → 재조회
  window._parentChildren    = null;
  window._parentActiveIdx   = 0;
  window._parentChildId     = null;
  window._parentCenterId    = null;
  window._parentChildName   = '';
  window._parentCacheUserId = null;

  supaFetch('madi_parent_children?parent_user_id=eq.' + encodeURIComponent(currentUser.id) + '&select=child_id,center_id', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        window._parentChildren = [];
        window._parentCacheUserId = currentUser.id;
        if (typeof onNoChild === 'function') onNoChild();
        return;
      }
      // 자녀 이름까지 함께 조회 후 캐싱
      var ids = rows.map(function(r){ return encodeURIComponent(r.child_id); }).join(',');
      return supaFetch('madi_children?id=in.(' + ids + ')&select=id,data', 'GET')
        .then(function(children) {
          var nameMap = {};
          if (Array.isArray(children)) {
            children.forEach(function(c){ nameMap[String(c.id)] = (c.data && c.data.name) || ''; });
          }
          window._parentChildren = rows.map(function(r){
            return { child_id: r.child_id, center_id: r.center_id, name: nameMap[String(r.child_id)] || '' };
          });
          window._parentActiveIdx   = 0;
          window._parentCacheUserId = currentUser.id;
          _emit();
        });
    }).catch(function(e){
      if(window.console&&console.warn)console.warn('[silent madi-15]',e&&e.message);
      if (typeof onNoChild === 'function') onNoChild();
    });
}

// 활성 자녀 변경 — 셀렉터 UI 에서 호출
function setActiveParentChild(idx) {
  if (!window._parentChildren) return;
  idx = parseInt(idx, 10);
  if (isNaN(idx) || idx < 0 || idx >= window._parentChildren.length) return;
  if (idx === window._parentActiveIdx) return;
  window._parentActiveIdx = idx;
  // 활성 자녀 표시 라벨 즉시 갱신
  var c = window._parentChildren[idx];
  window._parentChildId   = c.child_id;
  window._parentCenterId  = c.center_id;
  window._parentChildName = c.name || '';
  // 홈 페르소나 캐시 무효화 (자녀별 데이터) — 모든 자녀별 캐시 함께 리셋
  window._parentVoucherUsed = null;
  window._parentChildData = null;
  window._parentUpcoming = null;
  window._parentSessionsCache = null;
  window._parentPortfolioCount = 0;
  window._parentUpcomingCount = 0;
  document.querySelectorAll('.parentChildNameLabel').forEach(function(el){ el.textContent = c.name || ''; });
  renderParentChildSwitcher();
  // 현재 활성 탭 다시 로드
  var active = window._parentActiveTab || 'home';
  if (active === 'home'   && typeof loadParentHome   === 'function') loadParentHome();
  if (active === 'sched'  && typeof loadParentSched  === 'function') loadParentSched();
  if (active === 'report' && typeof loadParentReport === 'function') loadParentReport();
  if (active === 'notice' && typeof loadParentNotice === 'function') loadParentNotice();
}

// 다자녀 셀렉터 UI — 자녀 2명 이상일 때만 표시
function renderParentChildSwitcher() {
  var arr = window._parentChildren;
  var home = document.getElementById('parentPanelHome');
  if (!home) return;
  var existing = document.getElementById('parentChildSwitcher');
  if (!arr || arr.length < 2) {
    if (existing) existing.remove();
    return;
  }
  var html = '<div id="parentChildSwitcher" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;margin-bottom:8px;background:var(--bg);border-radius:10px;">'
    + '<span style="font-size:11px;color:var(--text2);align-self:center;margin-right:2px;">자녀:</span>';
  arr.forEach(function(c, i){
    var active = (i === (window._parentActiveIdx || 0));
    html += '<button data-idx="' + i + '" onclick="setActiveParentChild(this.getAttribute(\'data-idx\'))" '
      + 'style="padding:5px 12px;border-radius:16px;border:1.5px solid ' + (active ? 'var(--mint)' : 'var(--border)') + ';'
      + 'background:' + (active ? 'var(--mint)' : 'white') + ';color:' + (active ? 'white' : 'var(--text)') + ';'
      + 'font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">'
      + escHtml(c.name || ('자녀 ' + (i + 1))) + '</button>';
  });
  html += '</div>';
  if (existing) {
    existing.outerHTML = html;
  } else {
    home.insertAdjacentHTML('afterbegin', html);
  }
}

// ─── 홈 (페르소나 ⑦) ───
// 새 디자인: 자녀 히어로 + 이번 주 세션 + 선생님 메시지 + 발달 그래프 + 가정 활동 + 바우처
function loadParentHome() {
  // 온보딩 카드가 잔존하고 있다면 제거 (이전 미연결 상태에서 연결로 전환된 케이스)
  var _ob = document.getElementById('parentOnboardingCard');
  if (_ob && _ob.parentNode) _ob.parentNode.removeChild(_ob);
  // 자녀 정보가 있을 때를 가정하고 모든 페르소나 패널을 일단 다시 보이게 — 미연결이면 onNoChild 콜백에서 다시 숨김
  ['parentChildHero','parentChartPanel'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  document.querySelectorAll('#parentPanelHome .dp-grid-2, #parentPanelHome .dp-grid-2-eq').forEach(function(el){
    el.style.display = '';
  });
  // 알림 카드 먼저 로드 (홈 진입 시마다)
  loadParentNotifications();
  loadParentPushToggle();
  getMyChildInfo(function(childId, centerId) {
    renderParentChildSwitcher();
    var today = getTodayKST();
    var hero = document.getElementById('parentChildHero');
    if (hero) hero.style.display = '';

    // 1) 자녀 정보 → 히어로 카드
    supaFetch('madi_children?id=eq.' + encodeURIComponent(childId) + '&select=data', 'GET')
      .then(function(rows) {
        if (!rows || !rows[0]) return;
        var d = rows[0].data || {};
        window._parentChildName = d.name || '';
        document.querySelectorAll('.parentChildNameLabel').forEach(function(el) {
          el.textContent = d.name || '';
        });
        _renderParentHero(d);
        _renderParentVoucher(d);
      })
      .catch(function(e){ if(window.console&&console.warn) console.warn('[silent madi-15 child]', e && e.message); });

    // 2) 다음 일정 + 이번 주 일정 (히어로 다음 세션 + 바우처 패널 다가오는 예약)
    supaFetch('madi_schedules?center_id=eq.' + encodeURIComponent(centerId)
      + '&child_id=eq.' + encodeURIComponent(childId) + '&order=id.asc&limit=50', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) rows = [];
        var upcoming = rows.map(function(s){ return s.data || s; })
          .filter(function(s){ return (s.date || '') >= today; })
          .sort(function(a,b){ return a.date < b.date ? -1 : 1; });
        _renderParentNextSchedule(upcoming);
        _renderParentVoucherUpcoming(upcoming);
      })
      .catch(function(e){
        if (window.console && console.warn) console.warn('[silent madi-15 sched]', e && e.message);
        var nEl = document.getElementById('parentNextSchedText');
        var sEl = document.getElementById('parentNextSchedSub');
        if (nEl) nEl.textContent = '일정 로드 실패';
        if (sEl) sEl.textContent = '';
      });

    // 3) ★ 세션 기록 직접 노출 차단 (선생님 보호 정책 — 2026-05-21)
    //    madi_sessions 는 학부모에게 Edge Function 단에서 차단됨.
    //    대신 '공개된 포트폴리오' 패널을 렌더 + 평가 데이터로 그래프 fallback.
    window._parentSessionsCache = []; // 세션 캐시 비우기
    _renderParentRecentPortfolios(childId);
    _loadParentAssessments(childId, centerId, []);

    // 4) 선생님 메시지 (라운지 private_admin 중 본인 외 작성자)
    _loadParentTeacherMessages();

    // 5) 가정 활동 — 최신 세션의 메모 기반 활동 추출
    _renderParentHomeActivities();
  }, _showParentOnboarding);
}

// 자녀 히어로 — 이름, 진단, 회차, 발달 점수
function _renderParentHero(d) {
  var name = d.name || '자녀';
  var navEl = document.getElementById('parentHomeTitle');
  var greetEl = document.getElementById('parentHomeGreeting');
  var subEl = document.getElementById('parentHomeSub');
  var t = new Date();
  var wd = ['일','월','화','수','목','금','토'];
  if (greetEl) greetEl.textContent = t.getFullYear() + '년 ' + (t.getMonth()+1) + '월 ' + t.getDate() + '일 ' + wd[t.getDay()] + '요일';
  // 학부모 호칭은 성별 미특정이므로 "보호자님" 사용 (어머님/아버님 무관)
  if (navEl)   navEl.innerHTML = '안녕하세요, ' + escHtml(name) + ' 보호자님 🌸';
  if (subEl)   subEl.textContent = name + '의 활동 상황과 다음 세션을 확인하세요.';

  var avEl = document.getElementById('parentHeroAv');
  if (avEl) avEl.textContent = (name.charAt(0) || '?');

  var ageTagEl = document.getElementById('parentHeroAgeTag');
  if (ageTagEl) {
    var age = _calcAge(d.birth);
    var parts = [];
    if (age != null) parts.push(age + '세');
    if (d.gender) parts.push(d.gender);
    ageTagEl.textContent = parts.join(' · ') || '';
  }

  var diagEl = document.getElementById('parentHeroDiag');
  if (diagEl) {
    var diag = d.type || d.diagnosis || '평가 진행';
    var teacher = d.teacher || d.therapist || '';
    diagEl.innerHTML = '진단: <b>' + escHtml(diag) + '</b>' + (teacher ? ' · 담당 ' + escHtml(teacher) + ' 선생님' : '');
  }

  var statusEl = document.getElementById('parentHeroStatus');
  if (statusEl) {
    var st = d.status || '진행 중';
    statusEl.textContent = st === '등록' ? '진행 중' : st;
  }
}

// 자녀 발달 통계 (히어로 stats) — 세션·평가 기반
// 히어로 통계 — 세션 직접 노출 차단 후, 포트폴리오·일정 기반으로 재구성
// (sessions 인자는 하위 호환을 위해 받지만 사용하지 않음 — _renderParentRecentPortfolios 가 캐싱한 값 사용)
function _renderParentHeroStats(_unusedSessions) {
  var statsEl = document.getElementById('parentHeroStats');
  if (!statsEl) return;
  var portfolioCount = (typeof window._parentPortfolioCount === 'number') ? window._parentPortfolioCount : 0;
  var upcomingCount  = (typeof window._parentUpcomingCount === 'number')  ? window._parentUpcomingCount  : 0;
  statsEl.innerHTML = ''
    + '<div class="dp-p-hero-stat"><b>' + portfolioCount + '<small style="font-size:11px;font-weight:600;color:#94a3b8;"> 권</small></b>공개 포트폴리오</div>'
    + '<div class="dp-p-hero-stat"><b>' + upcomingCount + '<small style="font-size:11px;font-weight:600;color:#94a3b8;"> 건</small></b>다가오는 일정</div>'
    + '<div class="dp-p-hero-stat"><b class="good">↗</b>꾸준히 진행 중</div>';
}

// 공개된 포트폴리오 — 홈 상단 패널 (이번 주 세션 → 포트폴리오 카드로 교체)
// Edge Function 에서 parent_visible=true 강제되므로 클라이언트는 추가 필터 불필요.
function _renderParentRecentPortfolios(_childId) {
  var el      = document.getElementById('parentWeekDetails');
  var rangeEl = document.getElementById('parentWeekRange');
  if (!el) return;

  supaFetch('madi_portfolios?select=id,month,content,opened_at,created_by_name'
    + '&order=month.desc&limit=4', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows)) rows = [];
      window._parentPortfolioCount = rows.length;
      // 통계 영역도 갱신 (포트폴리오 권 수 반영)
      _renderParentHeroStats();
      if (rangeEl) {
        rangeEl.textContent = rows.length > 0
          ? '최신 ' + rows.length + '권 공개 중'
          : '공개된 포트폴리오 없음';
      }
      if (rows.length === 0) {
        el.innerHTML = '<div class="dp-empty">선생님이 월간 포트폴리오를 공개하면 이곳에 표시됩니다.</div>';
        return;
      }
      el.innerHTML = rows.slice(0, 3).map(function(r){
        var content = r.content || {};
        var ai      = content.ai || {};
        var month   = r.month || '';
        var preview = (ai.overview || ai.parentMessage || '').toString().slice(0, 90);
        var who     = r.created_by_name ? '담당 ' + escHtml(r.created_by_name) + ' 선생님' : '';
        return ''
          + '<div class="dp-p-sess" onclick="switchParentTab(\'report\')">'
          +   '<div class="dp-p-sess-date">'
          +     '<div class="dp-p-sess-date-num">📁</div>'
          +     '<div class="dp-p-sess-date-day">' + escHtml(month.slice(2)) + '</div>'  // 'YY-MM'
          +   '</div>'
          +   '<div class="dp-p-sess-content">'
          +     '<div class="dp-p-sess-title">' + escHtml(month) + ' 포트폴리오</div>'
          +     (preview ? '<div class="dp-p-sess-desc">' + escHtml(preview) + (preview.length >= 90 ? '...' : '') + '</div>' : '')
          +     (who ? '<div class="dp-p-sess-desc" style="margin-top:2px;font-size:11px;">' + who + '</div>' : '')
          +   '</div>'
          + '</div>';
      }).join('');
    })
    .catch(function(){
      el.innerHTML = '<div class="dp-empty">불러오기 실패</div>';
      window._parentPortfolioCount = 0;
      _renderParentHeroStats();
    });
}

// 다음 세션 — 히어로 우측 카드
function _renderParentNextSchedule(upcoming) {
  // 다가오는 일정 카운트 캐싱 — 히어로 통계에 사용
  window._parentUpcomingCount = (upcoming && upcoming.length) || 0;
  // 히어로 통계 갱신 (다른 비동기 호출이 끝났을 수 있어 즉시 재렌더 안전)
  _renderParentHeroStats();

  var timeEl = document.getElementById('parentNextSchedText');
  var dateEl = document.getElementById('parentNextSchedSub');
  var teacherEl = document.getElementById('parentNextSchedTeacher');
  if (upcoming.length === 0) {
    if (timeEl) timeEl.textContent = '예정 없음';
    if (dateEl) dateEl.textContent = '담당 선생님께 문의';
    if (teacherEl) teacherEl.textContent = '';
    return;
  }
  var next = upcoming[0];
  var time = (next.startTime || next.time || '').slice(0,5) || '--:--';
  var dt = new Date(next.date);
  var wd = ['일','월','화','수','목','금','토'];
  if (timeEl) timeEl.textContent = time;
  if (dateEl) dateEl.textContent = (dt.getMonth()+1) + '월 ' + dt.getDate() + '일 (' + wd[dt.getDay()] + ')';
  if (teacherEl) teacherEl.textContent = '👩‍⚕️ ' + escHtml((next.therapist || next.teacher || '담당')) + ' 선생님';
}

// 이번 주 세션 기록 (최근 7일)
function _renderParentWeekSessions(sessions) {
  var el = document.getElementById('parentWeekDetails');
  var rangeEl = document.getElementById('parentWeekRange');
  if (!el) return;

  // 히어로 통계 갱신
  _renderParentHeroStats(sessions);

  var today = new Date(getTodayKST());
  var weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  var weekAgoStr = weekAgo.toISOString().slice(0,10);
  var weekSessions = sessions.filter(function(s){ return s.date >= weekAgoStr; })
    .sort(function(a,b){ return a.date < b.date ? 1 : -1; });

  if (rangeEl) {
    var fmt = function(d){ return (d.getMonth()+1) + '/' + d.getDate(); };
    rangeEl.textContent = fmt(weekAgo) + ' ~ ' + fmt(today) + ' · ' + weekSessions.length + '회 진행';
  }

  if (weekSessions.length === 0) {
    el.innerHTML = '<div class="dp-empty">이번 주 진행된 세션이 없습니다</div>';
    return;
  }
  el.innerHTML = weekSessions.slice(0,4).map(function(s){
    var dt = new Date(s.date);
    var wd = ['일','월','화','수','목','금','토'];
    var note = (s.aiNote || s.note || s.parentNote || '').toString();
    var preview = note.slice(0, 100);
    var goal = s.goal || s.title || '세션 진행';
    return ''
      + '<div class="dp-p-sess" onclick="switchParentTab(\'report\')">'
      +   '<div class="dp-p-sess-date">'
      +     '<div class="dp-p-sess-date-num">' + dt.getDate() + '</div>'
      +     '<div class="dp-p-sess-date-day">' + wd[dt.getDay()] + '요일</div>'
      +   '</div>'
      +   '<div class="dp-p-sess-content">'
      +     '<div class="dp-p-sess-title">' + escHtml(goal) + '</div>'
      +     (preview ? '<div class="dp-p-sess-desc">' + escHtml(preview) + (note.length > 100 ? '...' : '') + '</div>' : '')
      +   '</div>'
      + '</div>';
  }).join('');
}

// 선생님 메시지 (라운지) — 학부모는 private_admin 글 중 받은 것
function _loadParentTeacherMessages() {
  var el = document.getElementById('parentTeacherMsgs');
  var subEl = document.getElementById('parentTeacherMsgSub');
  if (!el) return;
  supaFetch('madi_lounge_posts?visibility=eq.private_admin&order=created_at.desc&limit=10', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows)) rows = [];
      var received = rows.filter(function(p){
        if (!p) return false;
        if (p.author_id && String(p.author_id) === String(currentUser.id)) return false;
        if (!p.author_id && p.author_name && p.author_name === currentUser.name) return false;
        return true;
      });
      if (subEl) subEl.textContent = received.length ? '받은 메시지 ' + received.length + '개' : '받은 메시지 없음';
      if (received.length === 0) {
        el.innerHTML = '<div class="dp-empty">받은 메시지가 없습니다.<br>선생님께 게시판에서 문의해 보세요.</div>';
        return;
      }
      el.innerHTML = received.slice(0, 3).map(function(p){
        var from = p.author_name || '선생님';
        var when = p.created_at ? p.created_at.slice(0,10) : '';
        var days = when ? Math.floor((new Date() - new Date(when)) / 86400000) : 0;
        var timeText = days === 0 ? '오늘' : days + '일 전';
        var title = (p.title || '').toString();
        var body = (p.content || '').toString().slice(0, 120);
        return ''
          + '<div class="dp-p-msg" onclick="switchParentTab(\'notice\')">'
          +   '<div class="dp-p-msg-head">'
          +     '<div class="dp-p-msg-av dp-av-1">' + escHtml(from.charAt(0)) + '</div>'
          +     '<div class="dp-p-msg-from">' + escHtml(from) + '</div>'
          +     '<div class="dp-p-msg-time">' + timeText + '</div>'
          +   '</div>'
          +   '<div class="dp-p-msg-body">'
          +     (title ? '<b>' + escHtml(title) + '</b><br>' : '')
          +     escHtml(body) + (body.length >= 120 ? '...' : '')
          +   '</div>'
          + '</div>';
      }).join('');
    })
    .catch(function(e){
      if (window.console && console.warn) console.warn('[silent madi-15 msg]', e && e.message);
      if (subEl) subEl.textContent = '불러오기 실패';
      el.innerHTML = '<div class="dp-empty">메시지를 불러오지 못했습니다</div>';
    });
}

// 평가 점수 조회 → 점수 기반 그래프, 실패/빈 경우 세션 기반 fallback
function _loadParentAssessments(childId, centerId, sessionsFallback) {
  supaFetch('madi_assessments?child_id=eq.' + encodeURIComponent(childId)
    + '&order=id.desc&limit=30', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows)) rows = [];
      // 2차 필터 (server 우회 방어선)
      var mine = rows.filter(function(a){
        var d = a.data || a;
        return String(d.childId || d.child_id || a.child_id) === String(childId);
      }).map(function(a){
        var d = a.data || a;
        // scores: {언어이해:75, 표현언어:68, ...} 또는 단일 score
        var avg = null;
        if (d.scores && typeof d.scores === 'object') {
          var sum = 0, cnt = 0;
          Object.keys(d.scores).forEach(function(k){
            var v = parseFloat(d.scores[k]);
            if (isFinite(v)) { sum += v; cnt++; }
          });
          if (cnt > 0) avg = sum / cnt;
        } else if (d.score != null && isFinite(parseFloat(d.score))) {
          avg = parseFloat(d.score);
        }
        return { date: d.date || a.date || '', score: avg };
      }).filter(function(a){ return a.date && a.score != null; });

      if (mine.length === 0) {
        // fallback — 평가가 없으면 세션 카운트 차트
        _renderParentChart(sessionsFallback || []);
        return;
      }
      _renderParentChartByScore(mine);
    })
    .catch(function(e){
      if (window.console && console.warn) console.warn('[silent madi-15 assess]', e && e.message);
      _renderParentChart(sessionsFallback || []);
    });
}

// 평가 점수 기반 발달 그래프 (월별 평균)
function _renderParentChartByScore(assessments) {
  var bodyEl = document.getElementById('parentChartBody');
  var subEl = document.getElementById('parentChartSub');
  if (!bodyEl) return;

  // 월별 평균 — 최근 5개월
  var now = new Date();
  var months = [];
  for (var i = 4; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'),
      label: (d.getMonth()+1) + '월',
      sum: 0, count: 0, avg: null
    });
  }
  assessments.forEach(function(a){
    var ym = (a.date || '').slice(0,7);
    months.forEach(function(m){ if (m.key === ym) { m.sum += a.score; m.count++; } });
  });
  months.forEach(function(m){ if (m.count > 0) m.avg = m.sum / m.count; });

  // 빈 월은 직전 값으로 보간 (그래프 연속성)
  var lastVal = null;
  months.forEach(function(m){
    if (m.avg == null && lastVal != null) m.avg = lastVal;
    if (m.avg != null) lastVal = m.avg;
  });
  // 앞쪽도 후속 값으로 채움
  var firstVal = null;
  months.forEach(function(m){ if (m.avg != null && firstVal == null) firstVal = m.avg; });
  if (firstVal != null) {
    months.forEach(function(m){ if (m.avg == null) m.avg = firstVal; });
  }
  if (firstVal == null) {
    // 평가는 있지만 최근 5개월 안에 없음 → 세션 fallback
    _renderParentChart(window._parentSessionsCache || []);
    return;
  }

  // maxY 동적 계산 — 표준 100점 만점 가정하되 데이터가 그보다 크면 확장
  var maxScore = 100;
  months.forEach(function(m){ if (m.avg != null && m.avg > maxScore) maxScore = m.avg; });
  var maxY = maxScore;
  var W = 600, H = 160;
  var step = W / (months.length - 1 || 1);
  var pts = months.map(function(m, i){
    var x = i * step;
    var y = H - (m.avg / maxY) * H;
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  var areaPts = ['0,' + H].concat(pts).concat([W + ',' + H]);

  if (subEl) subEl.textContent = '최근 5개월 평가 점수 평균 (100점 만점)';

  var html = ''
    + '<div class="dp-p-chart-area">'
    +   '<div class="dp-p-chart-grid"><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div></div>'
    +   '<svg class="dp-p-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
    +     '<defs><linearGradient id="dpPGradScore" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.3"/><stop offset="100%" stop-color="#ec4899" stop-opacity="0"/></linearGradient></defs>'
    +     '<polygon points="' + areaPts.join(' ') + '" fill="url(#dpPGradScore)"/>'
    +     '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#ec4899" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + months.map(function(m, i){
        var x = i * step;
        var y = H - (m.avg / maxY) * H;
        var isLast = i === months.length - 1;
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isLast ? 6 : 5) + '" fill="' + (isLast ? '#ec4899' : 'white') + '" stroke="' + (isLast ? 'white' : '#ec4899') + '" stroke-width="2.5"/>';
      }).join('')
    +   '</svg>'
    + '</div>'
    + '<div class="dp-p-chart-x">' + months.map(function(m){ return '<span>' + m.label + '</span>'; }).join('') + '</div>';

  // 요약 셀
  var current = months[months.length - 1].avg;
  var first = months[0].avg;
  var delta = current - first;
  var deltaTxt = delta >= 0 ? '↑ +' + delta.toFixed(0) + '점' : delta.toFixed(0) + '점';
  html += ''
    + '<div class="dp-p-chart-sum">'
    +   '<div class="dp-p-chart-cell"><div class="dp-p-chart-num ' + (delta >= 0 ? 'good' : '') + '">' + deltaTxt + '</div><div class="dp-p-chart-label">5개월 누적</div></div>'
    +   '<div class="dp-p-chart-cell"><div class="dp-p-chart-num">' + Math.round(current) + '<small style="font-size:11px;color:#94a3b8;font-weight:600;">점</small></div><div class="dp-p-chart-label">현재 평균</div></div>'
    +   '<div class="dp-p-chart-cell"><div class="dp-p-chart-num">' + assessments.length + '<small style="font-size:11px;color:#94a3b8;font-weight:600;"> 회</small></div><div class="dp-p-chart-label">평가 누적</div></div>'
    + '</div>';

  bodyEl.innerHTML = html;
}

// 발달 추이 그래프 (월별 세션 수 — 평가 점수가 있으면 우선 사용)
function _renderParentChart(sessions) {
  var bodyEl = document.getElementById('parentChartBody');
  var subEl = document.getElementById('parentChartSub');
  if (!bodyEl) return;
  if (!sessions || sessions.length === 0) {
    bodyEl.innerHTML = '<div class="dp-empty">평가 점수가 등록되면 발달 추이가 표시됩니다.<br>선생님이 평가를 진행 중이에요.</div>';
    return;
  }

  // 월별 집계 — 최근 5개월
  var now = new Date();
  var months = [];
  for (var i = 4; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'),
      label: (d.getMonth()+1) + '월',
      count: 0
    });
  }
  sessions.forEach(function(s){
    var ym = (s.date || '').slice(0,7);
    months.forEach(function(m){ if (m.key === ym) m.count++; });
  });

  var maxY = 1;
  months.forEach(function(m){ if (m.count > maxY) maxY = m.count; });
  var W = 600, H = 160;
  var step = W / (months.length - 1 || 1);
  var pts = months.map(function(m, i){
    var x = i * step;
    var y = H - (m.count / maxY) * H;
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  var areaPts = ['0,' + H].concat(pts).concat([W + ',' + H]);

  if (subEl) subEl.textContent = '최근 5개월 진행 세션 수';

  var html = ''
    + '<div class="dp-p-chart-area">'
    +   '<div class="dp-p-chart-grid"><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div><div class="dp-p-chart-grid-line"></div></div>'
    +   '<svg class="dp-p-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
    +     '<defs><linearGradient id="dpPGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.3"/><stop offset="100%" stop-color="#ec4899" stop-opacity="0"/></linearGradient></defs>'
    +     '<polygon points="' + areaPts.join(' ') + '" fill="url(#dpPGrad)"/>'
    +     '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#ec4899" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + months.map(function(m, i){
        var x = i * step;
        var y = H - (m.count / maxY) * H;
        var isLast = i === months.length - 1;
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isLast ? 6 : 5) + '" fill="' + (isLast ? '#ec4899' : 'white') + '" stroke="' + (isLast ? 'white' : '#ec4899') + '" stroke-width="2.5"/>';
      }).join('')
    +   '</svg>'
    + '</div>'
    + '<div class="dp-p-chart-x">' + months.map(function(m){ return '<span>' + m.label + '</span>'; }).join('') + '</div>';

  // 요약 셀
  var totalCount = sessions.length;
  var thisMonth = months[months.length - 1].count;
  var prevMonth = months[months.length - 2] ? months[months.length - 2].count : 0;
  var deltaTxt = prevMonth > 0
    ? ((thisMonth - prevMonth) >= 0 ? '↑ +' : '') + (thisMonth - prevMonth) + '회'
    : '첫 달';
  html += ''
    + '<div class="dp-p-chart-sum">'
    +   '<div class="dp-p-chart-cell"><div class="dp-p-chart-num good">' + deltaTxt + '</div><div class="dp-p-chart-label">전월 대비</div></div>'
    +   '<div class="dp-p-chart-cell"><div class="dp-p-chart-num">' + thisMonth + '<small style="font-size:11px;color:#94a3b8;font-weight:600;"> 회</small></div><div class="dp-p-chart-label">이번 달</div></div>'
    +   '<div class="dp-p-chart-cell"><div class="dp-p-chart-num">' + totalCount + '<small style="font-size:11px;color:#94a3b8;font-weight:600;"> 회</small></div><div class="dp-p-chart-label">누적 세션</div></div>'
    + '</div>';

  bodyEl.innerHTML = html;
}

// 바우처 정보 — 자녀 데이터 기반
function _renderParentVoucher(d) {
  // 한 번에 다시 그릴 때를 위해 데이터를 캐시
  window._parentChildData = d;
  _redrawParentVoucherPanel();
}

// 다가오는 예약 + 바우처 패널 통합 (둘 다 render 시점이 다르므로 합성 함수)
function _renderParentVoucherUpcoming(upcoming) {
  window._parentUpcoming = upcoming;
  _redrawParentVoucherPanel();
}

function _redrawParentVoucherPanel() {
  var el = document.getElementById('parentVoucherPanel');
  if (!el) return;
  var d = window._parentChildData || {};
  var upcoming = window._parentUpcoming || [];

  var html = '';

  // 바우처
  var vLimit = parseInt(d.voucherLimit || 0, 10);
  if (vLimit > 0) {
    var vUsed = window._parentVoucherUsed != null ? window._parentVoucherUsed : 0;
    var pct = Math.min(100, Math.round(vUsed / vLimit * 100));
    var vType = d.voucherType || '바우처';
    html += ''
      + '<div class="dp-p-voucher">'
      +   '<div class="dp-p-voucher-top">'
      +     '<div class="dp-p-voucher-label">' + escHtml(vType) + '</div>'
      +     '<div class="dp-p-voucher-val"><b>' + vUsed + '</b> / ' + vLimit + ' 회</div>'
      +   '</div>'
      +   '<div class="dp-p-voucher-prog"><div class="dp-p-voucher-prog-bar" style="width:' + pct + '%;"></div></div>'
      +   '<div class="dp-p-voucher-foot"><span>사용 ' + vUsed + '회</span><span>잔여 ' + (vLimit - vUsed) + '회</span></div>'
      + '</div>';
  } else {
    html += '<div class="dp-p-voucher" style="text-align:center;color:#94a3b8;font-size:12px;">바우처 정보가 등록되어 있지 않아요.<br>담당 센터에 문의해 주세요.</div>';
  }

  // 다가오는 예약 (최대 3개)
  html += '<div style="font-size:11.5px;color:#64748b;font-weight:700;letter-spacing:0.3px;margin:12px 0 8px;">📅 다가오는 예약</div>';
  if (upcoming.length === 0) {
    html += '<div class="dp-empty" style="padding:14px;">예정된 세션이 없습니다</div>';
  } else {
    upcoming.slice(0, 3).forEach(function(s){
      var dt = new Date(s.date);
      var wd = ['일','월','화','수','목','금','토'];
      var st = (s.startTime || s.time || '').slice(0,5);
      var et = (s.endTime || '').slice(0,5);
      var teacher = s.therapist || s.teacher || '';
      html += ''
        + '<div class="dp-p-next-row">'
        +   '<div class="dp-p-next-day">'
        +     '<div class="dp-p-next-day-num">' + dt.getDate() + '</div>'
        +     '<div class="dp-p-next-day-mo">' + (dt.getMonth()+1) + '월 (' + wd[dt.getDay()] + ')</div>'
        +   '</div>'
        +   '<div class="dp-p-next-info">'
        +     '<div class="dp-p-next-time">' + escHtml(st || '--:--') + (et ? ' ~ ' + escHtml(et) : '') + '</div>'
        +     '<div class="dp-p-next-teacher">' + (teacher ? '👩‍⚕️ ' + escHtml(teacher) + ' 선생님' : '담당 미정') + '</div>'
        +   '</div>'
        + '</div>';
    });
  }

  el.innerHTML = html;

  // 사용 회차 계산 — madi_sessions 는 학부모 차단되어 madi_schedules 의 과거 일정 수로 대체
  // (정확도는 약간 떨어지지만 학부모가 보는 바우처 잔여 추정으로 충분)
  if (vLimit > 0 && window._parentVoucherUsed == null && window._parentChildId) {
    var centerId = window._parentCenterId;
    var todayStr = getTodayKST();
    supaFetch('madi_schedules?center_id=eq.' + encodeURIComponent(centerId)
      + '&child_id=eq.' + encodeURIComponent(window._parentChildId)
      + '&select=id,data&limit=300', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) rows = [];
        var past = rows.filter(function(r){
          var d = r.data || r;
          return (d.date || '') < todayStr;
        });
        window._parentVoucherUsed = past.length;
        _redrawParentVoucherPanel();
      })
      .catch(function(){});
  }
}

// 가정 활동 — 최신 세션의 메모에서 추출 시도 (없으면 일반 가이드)
function _renderParentHomeActivities() {
  var el = document.getElementById('parentHomeActivities');
  if (!el) return;
  // 현재는 정적 가이드 — 추후 madi_home_activities 테이블 연동 가능
  var defaults = [
    { title: '식사 시간에 메뉴 이름 따라 말하기', desc: '밥, 국, 김치 등 익숙한 단어부터 시작해 보세요.' },
    { title: '그림책 읽고 등장인물 한 문장 만들기', desc: '"토끼가 뛰어요" 같이 두 단어 조합부터 자연스럽게 유도해 보세요.' },
    { title: '하루 한 가지 일과를 두 문장으로 말해보기', desc: '"오늘 어린이집에서 뭐 했어?" 같은 열린 질문을 활용해 보세요.' }
  ];
  // 자녀별·주별 체크 상태 localStorage (자녀 전환·새로고침에도 유지)
  var childKey = window._parentChildId || 'me';
  var weekKey = (function(){
    var d = new Date();
    var yr = d.getFullYear();
    // 연 시작 일 + 7일 단위 주차
    var diff = Math.floor((d - new Date(yr, 0, 1)) / 86400000);
    return yr + 'w' + Math.floor(diff / 7);
  })();
  var storeKey = 'madi_parent_acts_' + childKey + '_' + weekKey;
  var checked = {};
  try { checked = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch(e) { checked = {}; }
  el.innerHTML = defaults.map(function(a, i){
    var isDone = checked[i] === true;
    return ''
      + '<div class="dp-p-act">'
      +   '<div class="dp-p-act-num">' + (i+1) + '</div>'
      +   '<div class="dp-p-act-text">'
      +     '<b>' + escHtml(a.title) + '</b>'
      +     '<span>' + escHtml(a.desc) + '</span>'
      +   '</div>'
      +   '<div class="dp-p-act-check ' + (isDone ? 'done' : '') + '" data-act-idx="' + i + '" '
      +     'onclick="_toggleParentActivity(this, \'' + storeKey + '\', ' + i + ')">' + (isDone ? '✓' : '') + '</div>'
      + '</div>';
  }).join('')
  + '<div style="margin-top:12px;font-size:11px;color:#94a3b8;text-align:center;">담당 선생님이 곧 맞춤 활동을 제안해 드릴 예정이에요 🌱</div>';
}

// 가정 활동 체크박스 토글 — localStorage 영속화 (자녀별·주차별 분리)
function _toggleParentActivity(el, storeKey, idx) {
  var isDone = el.classList.contains('done');
  if (isDone) { el.classList.remove('done'); el.textContent = ''; }
  else        { el.classList.add('done');    el.textContent = '✓'; }
  try {
    var s = JSON.parse(localStorage.getItem(storeKey) || '{}') || {};
    if (isDone) delete s[idx]; else s[idx] = true;
    localStorage.setItem(storeKey, JSON.stringify(s));
  } catch(e) { /* 저장 실패 — UI 만 토글 */ }
}

// 만 나이 계산
function _calcAge(birthYmd) {
  if (!birthYmd) return null;
  var b = new Date(birthYmd);
  if (isNaN(b.getTime())) return null;
  var now = new Date();
  var a = now.getFullYear() - b.getFullYear();
  var m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

// ★ 학부모 온보딩 카드 — 아동 미연결 시 표시
function _showParentOnboarding() {
  var homePanel = document.getElementById('parentPanelHome');
  if (!homePanel) return;
  // 자녀 미연결이면 페르소나 카드들 숨김
  ['parentChildHero','parentChartPanel'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // 2열 그리드들도 숨김
  document.querySelectorAll('#parentPanelHome .dp-grid-2, #parentPanelHome .dp-grid-2-eq').forEach(function(el){
    el.style.display = 'none';
  });
  if (document.getElementById('parentOnboardingCard')) return;
  var card = document.createElement('div');
  card.id = 'parentOnboardingCard';
  card.className = 'card';
  card.style.cssText = 'margin:16px;text-align:center;padding:32px 20px;';
  card.innerHTML =
    '<div style="font-size:48px;margin-bottom:16px;">🌱</div>'
    + '<div style="font-size:17px;font-weight:700;color:var(--navy);margin-bottom:10px;">환영합니다!</div>'
    + '<div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:20px;">'
    + '담당 선생님이 아이 정보를 연결해드리면<br>'
    + '일정과 월간 포트폴리오를 확인하실 수 있습니다.<br><br>'
    + '연결이 완료되면 알림으로 안내드립니다. 😊'
    + '</div>'
    + '<div style="background:#f0fdfa;border-radius:10px;padding:12px 16px;font-size:12px;color:#0f766e;">'
    + '📞 연결이 늦어지는 경우 담당 센터에 문의해주세요.'
    + '</div>';
  var content = homePanel.querySelector('.dp-parent') || homePanel;
  content.appendChild(card);
}

// ─── 일정 탭 ───
function loadParentSched() {
  var el = document.getElementById('parentSchedList');
  var nameEl = document.getElementById('parentSchedChildName');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>불러오는 중...</p></div>';

  getMyChildInfo(function(childId, centerId) {
    if (nameEl && window._parentChildName) nameEl.textContent = window._parentChildName + ' 아동';
    var today = getTodayKST();

    supaFetch('madi_schedules?center_id=eq.' + centerId + '&child_id=eq.' + childId + '&order=id.asc&limit=50', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) { el.innerHTML = '<div class="empty"><p>일정 없음</p></div>'; return; }
        var mine = rows.filter(function(s) {
          var d = s.data || s;
          return (d.date || s.date) >= today;
        });
        if (mine.length === 0) {
          el.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><p>예정된 치료 일정이 없습니다</p></div>';
          return;
        }
        el.innerHTML = mine.slice(0,20).map(function(s) {
          var d = s.data || s;
          var date    = d.date || '';
          var dayIdx  = new Date(date).getDay();
          var dayName = ['일','월','화','수','목','금','토'][dayIdx];
          var time    = (d.startTime || d.time || '').slice(0,5);
          var teacher = d.therapist || d.teacher || '';
          var isToday = date === today;
          return '<div class="session-item" style="border-left-color:' + (isToday ? 'var(--amber)' : 'var(--mint)') + ';margin-bottom:8px;">'
            + '<div class="session-header">'
            + '<span class="session-date">' + escHtml(date) + ' (' + dayName + ')' + (isToday ? ' 🌟 오늘' : '') + '</span>'
            + (time ? '<span style="font-size:12px;color:var(--mint);font-weight:700;">' + escHtml(time) + '</span>' : '')
            + '</div>'
            + (teacher ? '<div style="font-size:12px;color:var(--text2);">👩‍⚕️ ' + escHtml(teacher) + ' 선생님</div>' : '')
            + '</div>';
        }).join('');
      }).catch(function() { el.innerHTML = '<div class="empty"><p>불러오기 실패</p></div>'; });
  });
}

// ─── 리포트 탭 ───
// ─── 학부모 포트폴리오 탭 ───
// 선생님이 "학부모 공개" 토글을 켠 포트폴리오만 노출.
// Edge Function api/index.ts 에서 parent_visible=eq.true 강제 + child_id=eq.X.
// 세션 기록(madi_sessions) 은 학부모에게 차단 — 정제된 포트폴리오만 유일한 채널.
function loadParentPortfolio() {
  var el     = document.getElementById('parentReportList');
  var nameEl = document.getElementById('parentReportChildName');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>불러오는 중...</p></div>';

  getMyChildInfo(function(childId, centerId) {
    if (nameEl && window._parentChildName) nameEl.textContent = window._parentChildName + ' 아동';

    supaFetch('madi_portfolios?select=id,month,content,opened_at,created_at,created_by_name'
      + '&order=month.desc&limit=24', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          el.innerHTML = '<div class="empty"><div class="empty-icon">📁</div>'
            + '<p style="font-size:14px;font-weight:600;margin-bottom:4px;">공개된 포트폴리오가 없습니다</p>'
            + '<p style="font-size:12px;color:var(--text2);line-height:1.6;">선생님이 월간 포트폴리오를 작성하고 공개로 설정하면 이곳에 표시됩니다.</p>'
            + '</div>';
          return;
        }
        el.innerHTML = rows.map(_renderParentPortfolioCard).join('');
      })
      .catch(function() { el.innerHTML = '<div class="empty"><p>불러오기 실패</p></div>'; });
  });
}

// 하위 호환 — 기존 코드 진입점 (스위치/사이드바) 그대로 동작하도록 alias 유지
function loadParentReport() { loadParentPortfolio(); }

// 포트폴리오 카드 렌더링 (학부모 친화적 본문)
function _renderParentPortfolioCard(row) {
  var content = row.content || {};
  var ai      = content.ai || {};
  var month   = row.month || '';
  var byTxt   = row.created_by_name ? '담당 ' + escHtml(row.created_by_name) + ' 선생님' : '담당 선생님';
  var opened  = (row.opened_at || row.created_at || '').slice(0,10);

  var bodyHtml = '';
  if (ai.overview) {
    bodyHtml += '<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">📝 종합 평가</div>'
      + '<div style="font-size:13px;line-height:1.75;color:var(--text2);">' + escHtml(ai.overview) + '</div></div>';
  }
  if (ai.keyAchievements && ai.keyAchievements.length > 0) {
    bodyHtml += '<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">🌟 주요 성취</div>'
      + '<ul style="padding-left:18px;font-size:12.5px;line-height:1.75;color:var(--text2);margin:0;">'
      + ai.keyAchievements.map(function(a){ return '<li>' + escHtml(a) + '</li>'; }).join('')
      + '</ul></div>';
  }
  if (ai.parentMessage) {
    bodyHtml += '<div style="margin-bottom:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:10px;padding:10px 12px;">'
      + '<div style="font-size:12px;font-weight:700;color:#b45309;margin-bottom:4px;">💛 보호자님께</div>'
      + '<div style="font-size:13px;line-height:1.75;color:#78350f;">' + escHtml(ai.parentMessage) + '</div></div>';
  }
  if (ai.nextMonthPlan) {
    bodyHtml += '<div style="margin-bottom:4px;"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">🗓️ 다음 달 방향</div>'
      + '<div style="font-size:12.5px;line-height:1.75;color:var(--text2);">' + escHtml(ai.nextMonthPlan) + '</div></div>';
  }
  if (!bodyHtml) {
    bodyHtml = '<div style="font-size:12px;color:var(--text2);font-style:italic;">본문이 비어 있습니다.</div>';
  }

  return '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px;flex-wrap:wrap;">'
    +   '<div style="font-size:15px;font-weight:800;color:var(--text);">📁 ' + escHtml(month) + ' 월간 포트폴리오</div>'
    +   '<div style="font-size:11px;color:var(--text2);">공개 ' + escHtml(opened) + ' · ' + byTxt + '</div>'
    + '</div>'
    + bodyHtml
    + '</div>';
}

// ─── 공지 탭 ───
function loadParentNotice() {
  var el = document.getElementById('parentNoticeList');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>불러오는 중...</p></div>';

  getMyChildInfo(function(childId, centerId) {
    supaFetch('madi_notices?center_id=eq.' + centerId + '&order=created_at.desc&limit=20', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          el.innerHTML = '<div class="empty"><div class="empty-icon">📢</div><p>등록된 공지사항이 없습니다</p></div>';
          return;
        }
        el.innerHTML = rows.map(function(r) {
          var d = r.data || r;
          return '<div class="notice-card' + (d.pinned ? ' pinned' : '') + '">'
            + (d.pinned ? '<span class="notice-badge pin">📌 고정</span>' : '')
            + '<div style="font-size:14px;font-weight:700;margin-bottom:6px;">' + escHtml(d.title||'') + '</div>'
            + '<div style="font-size:12px;color:var(--text2);">' + escHtml(d.content||'') + '</div>'
            + '<div style="font-size:11px;color:var(--text2);margin-top:8px;">' + escHtml(d.created_at||r.created_at||'').slice(0,10) + '</div>'
            + '</div>';
        }).join('');
      }).catch(function() { el.innerHTML = '<div class="empty"><p>불러오기 실패</p></div>'; });
  });
}

// ═════════════════════════════════════════════════════════
// 🔔 학부모 앱 내 알림 카드 (Phase 1A)
// ═════════════════════════════════════════════════════════

function loadParentNotifications() {
  if (!currentUser || currentUser.role !== 'parent') return;
  supaFetch('madi_notifications?user_id=eq.' + currentUser.id
    + '&order=created_at.desc&limit=10', 'GET')
    .then(function(rows) {
      var list = Array.isArray(rows) ? rows : [];
      renderParentNotifList(list);
    })
    .catch(function() {
      var card = document.getElementById('parentNotifCard');
      if (card) card.style.display = 'none';
    });
}

function renderParentNotifList(rows) {
  var card    = document.getElementById('parentNotifCard');
  var listEl  = document.getElementById('parentNotifList');
  var badgeEl = document.getElementById('parentNotifBadge');
  if (!card || !listEl || !badgeEl) return;

  window._parentNotifCache = {};
  rows.forEach(function(n){
    window._parentNotifCache[n.id] = { type: n.type, link: n.link };
  });

  var unread = rows.filter(function(n){ return !n.read_at; });
  if (unread.length === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  badgeEl.textContent = unread.length;

  var show = unread.slice(0, 3);
  listEl.innerHTML = show.map(function(n){
    var icon = (n.type === 'notice') ? '📌'
             : (n.type === 'session') ? '✅'
             : (n.type === 'report')  ? '📊'
             : '🔔';
    var timeAgo = formatTimeAgo(n.created_at);
    return ''
      + '<div data-nid="' + n.id + '" style="cursor:pointer;padding:8px 4px;border-bottom:1px solid var(--border);">'
      +   '<div style="display:flex;align-items:start;gap:8px;">'
      +     '<div style="font-size:16px;line-height:1.4;">' + icon + '</div>'
      +     '<div style="flex:1;min-width:0;">'
      +       '<div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escHtml(n.title||'') + '</div>'
      +       (n.body ? '<div style="font-size:12px;color:var(--text2);margin-top:2px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escHtml(n.body) + '</div>' : '')
      +       '<div style="font-size:11px;color:var(--text2);margin-top:4px;">' + timeAgo + '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }).join('');
  listEl.onclick = function(e) {
    var item = e.target.closest('[data-nid]');
    if (item) openParentNotif(item.getAttribute('data-nid'));
  };
}

function openParentNotif(notifId) {
  supaFetch('madi_notifications?id=eq.' + notifId,
    'PATCH', { read_at: new Date().toISOString() })
    .then(function(){
      loadParentNotifications();
    })
    .catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-15]',e&&e.message);});

  if (window._parentNotifCache) {
    var n = window._parentNotifCache[notifId];
    if (n && n.type === 'notice') switchParentTab('notice');
    else if (n && n.type === 'report') switchParentTab('report');
    else if (n && n.type === 'session') switchParentTab('sched');
  }
}

function markAllNotifRead() {
  if (!currentUser || currentUser.role !== 'parent') return;
  supaFetch('madi_notifications?user_id=eq.' + currentUser.id + '&read_at=is.null',
    'PATCH', { read_at: new Date().toISOString() })
    .then(function(){
      loadParentNotifications();
      showToast('✅ 모든 알림을 읽음 처리했습니다');
    })
    .catch(function(e){ showToast('❌ 처리 실패: ' + (e.message||'')); });
}

function formatTimeAgo(isoTs) {
  if (!isoTs) return '';
  var ms = Date.now() - new Date(isoTs).getTime();
  if (ms < 0) ms = 0;
  var min  = Math.floor(ms / 60000);
  if (min < 1)  return '방금 전';
  if (min < 60) return min + '분 전';
  var hr = Math.floor(min / 60);
  if (hr < 24)  return hr + '시간 전';
  var day = Math.floor(hr / 24);
  if (day < 7)  return day + '일 전';
  return isoTs.slice(0, 10);
}

// ══════════════════════════════════════════════════════════════
// ★ 학부모 자동 가입 (핸드폰 번호 매칭 방식)
// ══════════════════════════════════════════════════════════════

var _parentSignupMatchedChildren = []; // lookup 결과 캐시

// ─── 화면 전환: 학부모 가입 화면 표시 ───
function showParentSignupScreen() {
  // 기존 화면 모두 숨기기
  var screens = ['landingScreen', 'loginScreen', 'signupScreen'];
  screens.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var ps = document.getElementById('parentSignupScreen');
  if (ps) ps.style.display = '';
  // 초기화
  resetParentSignup();
}

// ─── 학부모 가입 → 로그인 화면 복귀 ───
function backToLoginFromParentSignup() {
  var ps = document.getElementById('parentSignupScreen');
  if (ps) ps.style.display = 'none';
  var ls = document.getElementById('loginScreen');
  if (ls) ls.style.display = '';
  resetParentSignup();
}

// ─── 입력 시 자동 하이픈 (010-1234-5678) ───
function formatParentPhone(input) {
  if (!input) return;
  var raw = input.value.replace(/[^0-9]/g, '');
  if (raw.length > 11) raw = raw.slice(0, 11);
  var formatted = raw;
  if (raw.length >= 4 && raw.length <= 7) {
    formatted = raw.slice(0, 3) + '-' + raw.slice(3);
  } else if (raw.length >= 8) {
    formatted = raw.slice(0, 3) + '-' + raw.slice(3, 7) + '-' + raw.slice(7);
  }
  input.value = formatted;
}

// ─── 단계 2 → 단계 1로 되돌리기 ───
function resetParentSignup() {
  var step1 = document.getElementById('parentSignupStep1');
  var step2 = document.getElementById('parentSignupStep2');
  if (step1) step1.style.display = '';
  if (step2) step2.style.display = 'none';
  var fields = ['parentPhoneInput', 'parentSignupPassword', 'parentSignupPasswordConfirm'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var errors = ['parentLookupError', 'parentSignupError'];
  errors.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  _parentSignupMatchedChildren = [];
}

// ─── 액션 1: 핸드폰 번호로 아동 조회 ───
function parentLookup() {
  var phoneInput = document.getElementById('parentPhoneInput');
  var errEl = document.getElementById('parentLookupError');
  var btn = document.getElementById('parentLookupBtn');
  if (!phoneInput || !errEl || !btn) return;

  var phone = phoneInput.value.replace(/[^0-9]/g, '');
  if (phone.length < 10 || phone.length > 11) {
    errEl.textContent = '⚠️ 올바른 핸드폰 번호를 입력해주세요';
    return;
  }
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '⏳ 조회 중...';

  fetch(EDGE_URL + '/parent-auth', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'lookup', phone: phone })
  })
    .then(function(r) { return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      btn.disabled = false;
      btn.textContent = '🔍 내 아이 찾기';
      if (!res.ok) {
        errEl.textContent = '❌ ' + (res.data.error || '조회 실패');
        return;
      }
      if (res.data.alreadyJoined) {
        errEl.textContent = '⚠️ 이미 가입된 번호입니다. 로그인 화면에서 로그인해주세요.';
        return;
      }
      if (!res.data.children || res.data.children.length === 0) {
        errEl.textContent = '❌ 등록된 아동이 없습니다. 센터에 보호자 번호 등록을 요청해주세요.';
        return;
      }
      // 매칭 성공 → 단계 2로 전환
      _parentSignupMatchedChildren = res.data.children;
      var matchedEl = document.getElementById('parentMatchedChildren');
      if (matchedEl) {
        matchedEl.innerHTML = res.data.children.map(function(c) {
          return '<div>👶 ' + escHtml(c.name) + '</div>';
        }).join('');
      }
      document.getElementById('parentSignupStep1').style.display = 'none';
      document.getElementById('parentSignupStep2').style.display = '';
      // 비밀번호 입력란에 포커스
      setTimeout(function() {
        var pwEl = document.getElementById('parentSignupPassword');
        if (pwEl) pwEl.focus();
      }, 100);
    })
    .catch(function(e) {
      btn.disabled = false;
      btn.textContent = '🔍 내 아이 찾기';
      errEl.textContent = '❌ 네트워크 오류: ' + (e.message || '');
    });
}

// ─── 액션 2: 학부모 가입 처리 ───
function parentSignup() {
  var phoneInput = document.getElementById('parentPhoneInput');
  var pwInput = document.getElementById('parentSignupPassword');
  var pw2Input = document.getElementById('parentSignupPasswordConfirm');
  var errEl = document.getElementById('parentSignupError');
  var btn = document.getElementById('parentSignupBtn');
  if (!phoneInput || !pwInput || !pw2Input || !errEl || !btn) return;

  var phone = phoneInput.value.replace(/[^0-9]/g, '');
  var pw = pwInput.value;
  var pw2 = pw2Input.value;

  if (!pw || pw.length < 4) {
    errEl.textContent = '⚠️ 비밀번호는 4자 이상 입력해주세요';
    return;
  }
  if (pw !== pw2) {
    errEl.textContent = '⚠️ 비밀번호가 일치하지 않습니다';
    return;
  }
  if (!_parentSignupMatchedChildren || _parentSignupMatchedChildren.length === 0) {
    errEl.textContent = '⚠️ 매칭된 아동 정보가 없습니다. 다시 조회해주세요.';
    return;
  }

  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '⏳ 가입 중...';

  var childIds = _parentSignupMatchedChildren.map(function(c) { return c.childId; });

  fetch(EDGE_URL + '/parent-auth', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'signup',
      phone: phone,
      password: pw,
      childIds: childIds
    })
  })
    .then(function(r) { return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      btn.disabled = false;
      btn.textContent = '✨ 가입 완료';
      if (!res.ok) {
        errEl.textContent = '❌ ' + (res.data.error || '가입 실패');
        return;
      }
      // 가입 성공 → 토스트 + 로그인 화면으로 이동 + 아이디 자동 입력
      showToast('🎉 가입 완료! 자동으로 로그인 화면으로 이동합니다', { duration: 3000 });
      setTimeout(function() {
        backToLoginFromParentSignup();
        // 아이디 자동 입력
        var unEl = document.getElementById('loginUsernameInput');
        var pwEl2 = document.getElementById('loginPwInput');
        if (unEl) unEl.value = phone;
        if (pwEl2) {
          pwEl2.value = '';
          setTimeout(function(){ pwEl2.focus(); }, 200);
        }
      }, 1500);
    })
    .catch(function(e) {
      btn.disabled = false;
      btn.textContent = '✨ 가입 완료';
      errEl.textContent = '❌ 네트워크 오류: ' + (e.message || '');
    });
}

// ══════════════════════════════════════════════════════════════════════
// Web Push 알림 구독 (학부모 전용)
// ══════════════════════════════════════════════════════════════════════

function _b64UrlToUint8(b64url) {
  var pad = '='.repeat((4 - b64url.length % 4) % 4);
  var b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(b64);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function loadParentPushToggle() {
  var container = document.getElementById('parentPushToggleArea');
  if (!container) return;
  if (!('Notification' in window) || !navigator.serviceWorker || !window.PushManager) {
    container.innerHTML = ''; return;
  }
  if (!currentUser || currentUser.role !== 'parent') { container.innerHTML = ''; return; }
  if (!MADI_VAPID_PUBLIC_KEY || MADI_VAPID_PUBLIC_KEY === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY') {
    container.innerHTML = ''; return;
  }

  navigator.serviceWorker.ready.then(function(reg) {
    reg.pushManager.getSubscription().then(function(sub) {
      var on = !!sub;
      container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;' +
        'background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;gap:12px;">' +
        '<div>' +
        '<div style="font-size:13px;font-weight:600;color:#111827;">🔔 내일 치료 예약 알림</div>' +
        '<div style="font-size:11px;color:#6b7280;margin-top:2px;">치료 전날 저녁 이 기기로 알림을 보내드립니다</div>' +
        '</div>' +
        '<button id="pushToggleBtn" onclick="onPushToggleTap()" style="' +
        'background:' + (on ? 'var(--mint,#64d9c0)' : '#e5e7eb') + ';' +
        'color:' + (on ? '#fff' : '#6b7280') + ';' +
        'border:none;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">' +
        (on ? '알림 켜짐' : '알림 받기') +
        '</button>' +
        '</div>';
    });
  }).catch(function() { /* SW 미준비 시 조용히 skip */ });
}

function onPushToggleTap() {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then(function(reg) {
    reg.pushManager.getSubscription().then(function(sub) {
      if (sub) { _unsubscribePush(sub); }
      else     { _subscribePush(reg); }
    });
  });
}

function _subscribePush(reg) {
  if (Notification.permission === 'denied') {
    showToast('⚠️ 브라우저 알림이 차단됐습니다. 브라우저 설정에서 허용 후 다시 시도해주세요.');
    return;
  }
  Notification.requestPermission().then(function(perm) {
    if (perm !== 'granted') {
      showToast('⚠️ 알림 권한이 필요합니다.');
      return;
    }
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _b64UrlToUint8(MADI_VAPID_PUBLIC_KEY)
    }).then(function(sub) {
      var j = sub.toJSON();
      supaFetch('madi_push_subscriptions', 'POST', {
        user_id:   currentUser.id,
        center_id: currentUser.center_id || window._parentCenterId || '',
        endpoint:  j.endpoint,
        p256dh:    j.keys.p256dh,
        auth_key:  j.keys.auth
      }).then(function() {
        showToast('✅ 알림이 설정됐습니다');
        loadParentPushToggle();
      }).catch(function(e) {
        showToast('⚠️ 알림 저장 실패: ' + (e.message || ''));
        sub.unsubscribe();
      });
    }).catch(function() {
      showToast('⚠️ 알림 구독에 실패했습니다.');
    });
  });
}

function _unsubscribePush(sub) {
  var endpoint = sub.endpoint;
  sub.unsubscribe().then(function() {
    supaFetch(
      'madi_push_subscriptions?user_id=eq.' + encodeURIComponent(currentUser.id)
      + '&endpoint=eq.' + encodeURIComponent(endpoint),
      'DELETE'
    ).then(function() {
      showToast('🔕 알림이 해제됐습니다');
      loadParentPushToggle();
    }).catch(function() {
      showToast('⚠️ 알림 해제 중 오류가 발생했습니다');
    });
  });
}
