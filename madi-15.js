// ══════════════════════
// madi-15.js — 학부모 포털 전용 로직
// ══════════════════════

var _parentCurrentTab = 'home';

// ─── 탭 전환 ───
function switchParentTab(tab) {
  _parentCurrentTab = tab;
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
// onNoChild: 아동 미연결 시 호출되는 콜백 (온보딩용)
function getMyChildInfo(callback, onNoChild) {
  if (!currentUser || currentUser.role !== 'parent') return;
  if (window._parentChildId) {
    callback(window._parentChildId, window._parentCenterId);
    return;
  }
  supaFetch('madi_parent_children?parent_user_id=eq.' + currentUser.id + '&select=child_id,center_id', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        if (typeof onNoChild === 'function') onNoChild();
        return;
      }
      window._parentChildId  = rows[0].child_id;
      window._parentCenterId = rows[0].center_id;
      callback(window._parentChildId, window._parentCenterId);
    }).catch(function(e){
      if(window.console&&console.warn)console.warn('[silent madi-15]',e&&e.message);
      if (typeof onNoChild === 'function') onNoChild();
    });
}

// ─── 홈 ───
function loadParentHome() {
  // 알림 카드 먼저 로드 (홈 진입 시마다)
  loadParentNotifications();
  getMyChildInfo(function(childId, centerId) {
    var today = getTodayKST();

    // 아동 이름 조회
    supaFetch('madi_children?id=eq.' + childId + '&select=data', 'GET')
      .then(function(rows) {
        if (!rows || !rows[0]) return;
        var d = rows[0].data || {};
        window._parentChildName = d.name || '';
        document.querySelectorAll('.parentChildNameLabel').forEach(function(el) {
          el.textContent = d.name || '';
        });
      }).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-15]',e&&e.message);});

    // 다음 일정 조회
    supaFetch('madi_schedules?center_id=eq.' + centerId
      + '&child_id=eq.' + childId + '&order=id.asc&limit=20', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) return;
        var upcoming = rows.filter(function(s) {
          var data = s.data || s;
          return (data.date || s.date) >= today;
        }).sort(function(a,b) {
          return (a.data||a).date < (b.data||b).date ? -1 : 1;
        });

        var nextEl  = document.getElementById('parentNextSchedText');
        var subEl   = document.getElementById('parentNextSchedSub');
        var weekEl  = document.getElementById('parentWeekSched');

        if (upcoming.length === 0) {
          if (nextEl) nextEl.textContent = '예정된 일정 없음';
          if (subEl)  subEl.textContent  = '';
          if (weekEl) weekEl.textContent = '이번 주 예정된 일정이 없습니다';
          return;
        }

        var next = upcoming[0].data || upcoming[0];
        var nextDate = new Date(next.date);
        var todayDate = new Date(today);
        var diff = Math.round((nextDate - todayDate) / 86400000);
        var dday = diff === 0 ? 'D-Day !' : 'D-' + diff;
        var dateStr = next.date + ' (' + ['일','월','화','수','목','금','토'][nextDate.getDay()] + ')';
        var timeStr = (next.startTime || next.time || '').slice(0,5);

        if (nextEl) nextEl.textContent = dday + ' — ' + dateStr;
        if (subEl)  subEl.textContent  = (timeStr ? timeStr + ' · ' : '') + (next.therapist || next.teacher || '') + ' 선생님';

        var weekEnd = new Date(todayDate);
        weekEnd.setDate(weekEnd.getDate() + 7);
        var weekScheds = upcoming.filter(function(s) {
          var d = (s.data||s).date;
          return d >= today && d <= weekEnd.toISOString().slice(0,10);
        });
        if (weekEl) {
          if (weekScheds.length === 0) {
            weekEl.textContent = '이번 주 예정 없음';
          } else {
            weekEl.innerHTML = weekScheds.slice(0,3).map(function(s) {
              var sd = s.data || s;
              return '<div class="dash-sched-item">'
                + '<span class="dash-sched-time">' + escHtml((sd.startTime||sd.time||'').slice(0,5)) + '</span>'
                + '<span class="dash-sched-name">' + escHtml(sd.date) + '</span>'
                + '</div>';
            }).join('');
          }
        }
      }).catch(function(e){
        if(window.console&&console.warn)console.warn('[silent madi-15]',e&&e.message);
        var _nEl=document.getElementById('parentNextSchedText');
        var _wEl=document.getElementById('parentWeekSched');
        var _sEl=document.getElementById('parentNextSchedSub');
        if(_nEl) _nEl.textContent='일정 로드 실패';
        if(_sEl) _sEl.textContent='';
        if(_wEl) _wEl.textContent='';
      });

    // 최근 리포트
    supaFetch('madi_sessions?center_id=eq.' + centerId
      + '&order=id.desc&limit=5', 'GET')
      .then(function(rows) {
        var el = document.getElementById('parentLatestReport');
        if (!el) return;
        if (!Array.isArray(rows) || rows.length === 0) {
          el.textContent = '작성된 리포트 없음'; return;
        }
        var mine = rows.filter(function(s) {
          var data = s.data || s;
          return String(data.childId || data.child_id) === String(childId);
        });
        if (mine.length === 0) { el.textContent = '작성된 리포트 없음'; return; }
        var latest = mine[0].data || mine[0];
        el.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--text);">'
          + escHtml(latest.date || '') + '</div>'
          + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">'
          + escHtml((latest.note||latest.aiNote||'').slice(0,30)) + '...</div>';
      }).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-15]',e&&e.message);});
  }, _showParentOnboarding);
}

// ★ 학부모 온보딩 카드 — 아동 미연결 시 표시
function _showParentOnboarding() {
  var homePanel = document.getElementById('parentPanelHome');
  if (!homePanel) return;
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
    + '일정과 치료 리포트를 확인하실 수 있습니다.<br><br>'
    + '연결이 완료되면 알림으로 안내드립니다. 😊'
    + '</div>'
    + '<div style="background:#f0fdfa;border-radius:10px;padding:12px 16px;font-size:12px;color:#0f766e;">'
    + '📞 연결이 늦어지는 경우 담당 센터에 문의해주세요.'
    + '</div>';
  homePanel.appendChild(card);
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
function loadParentReport() {
  var el     = document.getElementById('parentReportList');
  var nameEl = document.getElementById('parentReportChildName');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>불러오는 중...</p></div>';

  getMyChildInfo(function(childId, centerId) {
    if (nameEl && window._parentChildName) nameEl.textContent = window._parentChildName + ' 아동';

    supaFetch('madi_sessions?center_id=eq.' + centerId + '&order=id.desc&limit=30', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) { el.innerHTML = '<div class="empty"><p>리포트 없음</p></div>'; return; }
        var mine = rows.filter(function(s) {
          var d = s.data || s;
          return String(d.childId || d.child_id) === String(childId);
        });
        if (mine.length === 0) {
          el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>작성된 리포트가 없습니다</p></div>';
          return;
        }
        el.innerHTML = mine.map(function(s) {
          var d       = s.data || s;
          var date    = d.date || '';
          var note    = d.aiNote || d.note || '';
          var teacher = d.therapist || d.teacher || '';
          var goals   = d.goals || [];
          return '<div class="session-item" style="margin-bottom:10px;">'
            + '<div class="session-header">'
            + '<span class="session-date">📋 ' + escHtml(date) + '</span>'
            + (teacher ? '<span style="font-size:11px;color:var(--text2);">👩‍⚕️ ' + escHtml(teacher) + '</span>' : '')
            + '</div>'
            + (goals.length > 0
              ? '<div class="session-goals">'
                + goals.slice(0,3).map(function(g) {
                    var score = typeof g.score === 'number' ? g.score : 0;
                    var cls   = score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad';
                    return '<span class="goal-chip ' + cls + '">' + escHtml(g.name||'') + ' ' + score + '%</span>';
                  }).join('')
                + '</div>'
              : '')
            + (note ? '<div class="session-note" style="font-size:13px;color:var(--text2);">' + escHtml(note.slice(0,120)) + (note.length>120?'...':'') + '</div>' : '')
            + '</div>';
        }).join('');
      }).catch(function() { el.innerHTML = '<div class="empty"><p>불러오기 실패</p></div>'; });
  });
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

  var childIds = _parentSignupMatchedChildren.map(function(c) { return c.id; });

  fetch(EDGE_URL + '/parent-auth', {
    method: 'POST',
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
