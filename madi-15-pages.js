/* ───────────────────────────────────────────────────────────
   madi-15-pages.js — 학부모 포털 후반부
   - 일정 / 포트폴리오 / 리포트 / 공지 / 알림
   - 학부모 가입 (조회·매칭·가입)
   - Web Push 구독 토글

   분리 사유: madi-15.js 가 1,368 라인으로 비대 → 홈(대시보드) 렌더링
   계열은 madi-15.js 에 유지, 그 외 페이지/계정/푸시는 본 파일로 분리.
   동일 글로벌 스코프(defer 로드)이므로 함수 참조는 분리 전과 동일.
   ─────────────────────────────────────────────────────────── */

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

    // child_id 미연결 학부모 처리
    if (!childId) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>'
        + '<p style="font-size:14px;font-weight:600;margin-bottom:4px;">아동 연결 정보가 없습니다</p>'
        + '<p style="font-size:12px;color:var(--text2);line-height:1.6;">담당 선생님에게 계정 연결을 요청해주세요.</p>'
        + '</div>';
      return;
    }

    // child_id 필터 필수 — 없으면 센터 내 모든 공개 포트폴리오가 내려와 타 아동 열람 가능 (PIPA 위반)
    supaFetch('madi_portfolios?select=id,month,content,opened_at,created_at,created_by_name'
      + '&child_id=eq.' + encodeURIComponent(childId)
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
      .catch(function(err) {
        var isNet = err && err.message && err.message.toLowerCase().indexOf('fetch') !== -1;
        var msg   = isNet
          ? '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
          : '포트폴리오를 불러오지 못했습니다. 앱을 새로고침 해보세요.';
        el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>'
          + '<p style="font-size:13px;color:var(--text2);">' + msg + '</p></div>';
      });
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
  // iOS Safari 탭에서는 Web Push 미지원 — iOS 16.4+ 라도 홈화면 PWA 로 설치되어야 동작
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone = (window.navigator.standalone === true)
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (isIOS && !isStandalone) {
    showToast('📲 iOS에서는 먼저 "홈 화면에 추가" 후 알림을 켤 수 있어요. Safari 공유 → 홈 화면에 추가', { duration: 6000 });
    return;
  }
  if (typeof Notification === 'undefined' || !Notification) {
    showToast('⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다.');
    return;
  }
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
        auth:      j.keys.auth
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
