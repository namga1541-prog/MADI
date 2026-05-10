// ══════════════════════════════════════
// madi-15.js — 학부모 포털 전용 로직
// ══════════════════════════════════════

var _parentCurrentTab = 'home';

// ─── 탭 전환 ───
function switchParentTab(tab) {
  _parentCurrentTab = tab;
  var tabs = ['home','sched','report','notice'];
  tabs.forEach(function(t) {
    var panel = document.getElementById('parentPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    var btn   = document.getElementById('ptBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  if (tab === 'home')   loadParentHome();
  if (tab === 'sched')  loadParentSched();
  if (tab === 'report') loadParentReport();
  if (tab === 'notice') loadParentNotice();
}

// ─── 내 아동 정보 가져오기 (공통) ───
function getMyChildInfo(callback) {
  if (!currentUser || currentUser.role !== 'parent') return;
  if (window._parentChildId) {
    callback(window._parentChildId, window._parentCenterId);
    return;
  }
  supaFetch('madi_parent_children?parent_user_id=eq.' + currentUser.id + '&select=child_id,center_id', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      window._parentChildId  = rows[0].child_id;
      window._parentCenterId = rows[0].center_id;
      callback(window._parentChildId, window._parentCenterId);
    }).catch(function() {});
}

// ─── 홈 ───
function loadParentHome() {
  getMyChildInfo(function(childId, centerId) {
    var today = new Date().toISOString().slice(0,10);

    // 아동 이름 조회
    supaFetch('madi_children?id=eq.' + childId + '&select=data', 'GET')
      .then(function(rows) {
        if (!rows || !rows[0]) return;
        var d = rows[0].data || {};
        window._parentChildName = d.name || '';
        document.querySelectorAll('.parentChildNameLabel').forEach(function(el) {
          el.textContent = d.name || '';
        });
      }).catch(function() {});

    // 다음 일정 조회
    supaFetch('madi_schedules?center_id=eq.' + centerId
      + '&order=date.asc&limit=20', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) return;
        var upcoming = rows.filter(function(s) {
          var data = s.data || s;
          var cid = data.childId || data.child_id;
          return String(cid) === String(childId) && (data.date || s.date) >= today;
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

        // 이번 주 일정
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
      }).catch(function() {});

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
      }).catch(function() {});
  });
}

// ─── 일정 탭 ───
function loadParentSched() {
  var el = document.getElementById('parentSchedList');
  var nameEl = document.getElementById('parentSchedChildName');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>불러오는 중...</p></div>';

  getMyChildInfo(function(childId, centerId) {
    if (nameEl && window._parentChildName) nameEl.textContent = window._parentChildName + ' 아동';
    var today = new Date().toISOString().slice(0,10);

    supaFetch('madi_schedules?center_id=eq.' + centerId + '&order=date.asc', 'GET')
      .then(function(rows) {
        if (!Array.isArray(rows)) { el.innerHTML = '<div class="empty"><p>일정 없음</p></div>'; return; }
        var mine = rows.filter(function(s) {
          var d = s.data || s;
          return String(d.childId || d.child_id) === String(childId) && (d.date || s.date) >= today;
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
