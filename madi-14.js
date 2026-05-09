// ═══════════════════════════════════════════════════════════
// MADI 게시판 시스템
//   2단계: 골격 + 탭 전환                           ✅ 완료
//   3단계: 마디 공지사항 (작성/목록/삭제)           ← 현재 단계
//   4단계: 센터 공지사항 통합 (예정)
//   5단계: 라운지 글 (1:1 + 센터, 예정)
//   6단계: 라운지 댓글 + 이미지 업로드 (예정)
// ═══════════════════════════════════════════════════════════

// 현재 활성 서브탭 (global / center / lounge)
var currentBoardTab = 'global';

// 데이터 캐시 (단계별로 채워나감)
var globalNoticesDB = [];
var centerNoticesDB = [];
var loungePostsDB = [];
var centersByIdCache = null;  // null=미로드, {}=로드됨 (슈퍼어드민이 센터 이름 표시용)

// 게시판 진입 시 호출 (switchTab(7)에서 자동)
function initBoard() {
  switchBoardTab(currentBoardTab || 'global');
}

// 서브탭 전환
function switchBoardTab(name) {
  if (!name) return;
  currentBoardTab = name;

  ['global', 'center', 'lounge'].forEach(function(n) {
    var btn = document.getElementById('bdBtn_' + n);
    if (btn) btn.classList.remove('active');
    var pnl = document.getElementById('bdPanel_' + n);
    if (pnl) pnl.style.display = 'none';
  });

  var activeBtn = document.getElementById('bdBtn_' + name);
  if (activeBtn) activeBtn.classList.add('active');
  var activePnl = document.getElementById('bdPanel_' + name);
  if (activePnl) activePnl.style.display = 'block';

  if      (name === 'global') renderGlobalNotices();
  else if (name === 'center') renderCenterNotices();
  else if (name === 'lounge') renderLounge();
}

// ═══════════════════════════════════════════════════════════
// 🌐 마디 공지사항 (3단계)
// ═══════════════════════════════════════════════════════════

// 진입점 — 데이터 로드 후 UI 렌더
function renderGlobalNotices() {
  var c = document.getElementById('bdGlobalList');
  if (!c) return;
  c.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><p>불러오는 중...</p></div>';
  loadGlobalNotices();
}

// Supabase에서 공지 목록 조회 (pinned 우선, 최신순, 최대 100개)
function loadGlobalNotices() {
  return supaFetch('madi_global_notices?order=pinned.desc,created_at.desc&limit=100', 'GET')
    .then(function(rows) {
      globalNoticesDB = Array.isArray(rows) ? rows : [];
      renderGlobalNoticeUI();
    })
    .catch(function(e) {
      var c = document.getElementById('bdGlobalList');
      if (c) {
        c.innerHTML = '<div class="empty">'
          + '<div class="empty-icon">❌</div>'
          + '<p>불러오기 실패: ' + escHtml(e.message || '오류') + '</p>'
          + '<button class="btn btn-sm" onclick="loadGlobalNotices()" style="margin-top:8px;">🔄 다시 시도</button>'
          + '</div>';
      }
    });
}

// UI 렌더 — 작성 폼(슈퍼어드민) + 공지 목록
function renderGlobalNoticeUI() {
  var c = document.getElementById('bdGlobalList');
  if (!c) return;
  var isSuperAdmin = currentUser && currentUser.role === 'superadmin';
  var html = '';

  // ── 슈퍼어드민 전용 작성 폼 ──
  if (isSuperAdmin) {
    html += '<div style="margin-bottom:14px;padding:12px;background:#f0f9ff;border:1px dashed #38bdf8;border-radius:10px;">'
      + '<div style="font-size:13px;font-weight:700;color:#0c4a6e;margin-bottom:8px;">✏️ 새 공지 작성 (모든 센터에 발송)</div>'
      + '<div style="display:grid;gap:8px;">'
      + '<select id="bdGlobalType" class="form-input" style="font-size:13px;padding:8px;">'
      +   '<option value="info">📢 일반</option>'
      +   '<option value="pin">📍 중요 (상단 고정)</option>'
      +   '<option value="imp">🚨 긴급 (상단 고정)</option>'
      + '</select>'
      + '<input id="bdGlobalTitle" class="form-input" placeholder="제목 (필수)" maxlength="200" style="font-size:13px;padding:8px;">'
      + '<textarea id="bdGlobalContent" class="form-input" rows="3" placeholder="본문 (필수)" style="font-size:13px;padding:8px;resize:vertical;"></textarea>'
      + '<button class="btn btn-primary" onclick="saveGlobalNotice()" style="font-size:13px;padding:10px;">💾 등록</button>'
      + '</div></div>';
  }

  // ── 공지 목록 ──
  if (globalNoticesDB.length === 0) {
    html += '<div class="empty"><div class="empty-icon">📭</div><p>아직 등록된 마디 공지가 없습니다.</p></div>';
  } else {
    html += globalNoticesDB.map(function(n) { return renderGlobalNoticeCard(n, isSuperAdmin); }).join('');
  }

  c.innerHTML = html;
}

// 공지 카드 1개 렌더 (HTML 생성)
function renderGlobalNoticeCard(n, isSuperAdmin) {
  var typeBadge, borderColor;
  if (n.notice_type === 'imp') {
    typeBadge   = '<span style="background:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">🚨 긴급</span>';
    borderColor = '#ef4444';
  } else if (n.notice_type === 'pin') {
    typeBadge   = '<span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">📍 중요</span>';
    borderColor = '#f59e0b';
  } else {
    typeBadge   = '<span style="background:#e0f2fe;color:#0c4a6e;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">📢 일반</span>';
    borderColor = '#0ea5a0';
  }
  var when = n.created_at ? new Date(n.created_at).toLocaleString('ko-KR') : '';
  var deleteBtn = isSuperAdmin
    ? '<button class="btn-del" style="padding:5px 10px;font-size:11px;" onclick="deleteGlobalNotice(' + n.id + ')">삭제</button>'
    : '';

  return '<div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border-left:4px solid ' + borderColor + ';">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap;">'
    +   '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
    +     typeBadge
    +     '<span style="font-size:14px;font-weight:700;color:#1e293b;">' + escHtml(n.title || '') + '</span>'
    +   '</div>'
    +   deleteBtn
    + '</div>'
    + (n.content ? '<div style="font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;margin:8px 0 6px;">' + escHtml(n.content) + '</div>' : '')
    + '<div style="font-size:11px;color:#64748b;margin-top:6px;">👤 ' + escHtml(n.author_name || '익명') + ' · ' + escHtml(when) + '</div>'
    + '</div>';
}

// 새 공지 등록
function saveGlobalNotice() {
  if (!currentUser || currentUser.role !== 'superadmin') { showToast('❌ 슈퍼어드민만 등록할 수 있습니다'); return; }

  var title   = (document.getElementById('bdGlobalTitle')   || {value:''}).value.trim();
  var content = (document.getElementById('bdGlobalContent') || {value:''}).value.trim();
  var ntype   = (document.getElementById('bdGlobalType')    || {value:'info'}).value;
  if (!title)   { showToast('⚠️ 제목을 입력해 주세요'); return; }
  if (!content) { showToast('⚠️ 본문을 입력해 주세요'); return; }
  if (title.length > 200) { showToast('⚠️ 제목은 200자 이하로 작성해 주세요'); return; }

  // pin/imp는 자동으로 상단 고정
  var pinned = (ntype !== 'info');

  return supaFetch('madi_global_notices', 'POST', [{
    notice_type: ntype,
    pinned:      pinned,
    title:       title,
    content:     content,
    author_name: currentUser.name || '슈퍼어드민'
  }])
    .then(function() {
      var t = document.getElementById('bdGlobalTitle');   if (t) t.value = '';
      var b = document.getElementById('bdGlobalContent'); if (b) b.value = '';
      var s = document.getElementById('bdGlobalType');    if (s) s.value = 'info';
      showToast('✅ 마디 공지가 등록됐습니다');
      loadGlobalNotices();
    })
    .catch(function(e) { showToast('❌ 저장 실패: ' + (e.message || '')); });
}

// 공지 삭제
function deleteGlobalNotice(id) {
  if (!currentUser || currentUser.role !== 'superadmin') { showToast('❌ 슈퍼어드민만 삭제할 수 있습니다'); return; }
  if (!confirm('이 공지를 삭제할까요? 모든 센터에서 사라집니다.')) return;

  return supaFetch('madi_global_notices?id=eq.' + encodeURIComponent(id), 'DELETE')
    .then(function() {
      showToast('🗑️ 공지가 삭제됐습니다');
      loadGlobalNotices();
    })
    .catch(function(e) { showToast('❌ 삭제 실패: ' + (e.message || '')); });
}

// ═══════════════════════════════════════════════════════════
// 📌 센터 공지사항 (4단계) — 기존 madi_notices 테이블 활용
// ═══════════════════════════════════════════════════════════

// 진입점 — 슈퍼어드민이면 센터 정보도 함께 로드
function renderCenterNotices() {
  var c = document.getElementById('bdCenterList');
  if (!c) return;
  c.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><p>불러오는 중...</p></div>';

  var isSuperAdmin = currentUser && currentUser.role === 'superadmin';
  if (isSuperAdmin && !centersByIdCache) {
    // 슈퍼어드민: 센터 이름 캐시 후 공지 로드
    loadCentersByIdCache().then(function(){ loadCenterNotices(); });
  } else {
    loadCenterNotices();
  }
}

// 슈퍼어드민용: 모든 센터 정보 1회 캐싱
function loadCentersByIdCache() {
  return supaFetch('madi_centers?select=id,name', 'GET')
    .then(function(rows) {
      centersByIdCache = {};
      (rows || []).forEach(function(r) { centersByIdCache[r.id] = r.name; });
    })
    .catch(function() { centersByIdCache = {}; });
}

// 센터 공지 목록 조회
function loadCenterNotices() {
  // teacher: Edge Function이 자동 필터 (center_id=eq.X)
  // admin: 클라이언트에서 직접 필터 (admin.html 패턴)
  // superadmin: 필터 없음 (모든 센터)
  var query = 'madi_notices?order=pinned.desc,created_at.desc&limit=100';
  if (currentUser && currentUser.role === 'admin' && currentUser.center_id) {
    query = 'madi_notices?center_id=eq.' + encodeURIComponent(currentUser.center_id)
          + '&order=pinned.desc,created_at.desc&limit=100';
  }

  return supaFetch(query, 'GET')
    .then(function(rows) {
      centerNoticesDB = Array.isArray(rows) ? rows : [];
      renderCenterNoticeUI();
    })
    .catch(function(e) {
      var c = document.getElementById('bdCenterList');
      if (c) {
        c.innerHTML = '<div class="empty">'
          + '<div class="empty-icon">❌</div>'
          + '<p>불러오기 실패: ' + escHtml(e.message || '오류') + '</p>'
          + '<button class="btn btn-sm" onclick="loadCenterNotices()" style="margin-top:8px;">🔄 다시 시도</button>'
          + '</div>';
      }
    });
}

// UI 렌더 — 작성 폼(admin/superadmin) + 공지 목록
function renderCenterNoticeUI() {
  var c = document.getElementById('bdCenterList');
  if (!c) return;
  var role = (currentUser && currentUser.role) || '';
  var isAdminOrSuper = role === 'admin' || role === 'superadmin';
  var isSuperAdmin   = role === 'superadmin';
  var html = '';

  // ── admin/superadmin 작성 폼 ──
  if (isAdminOrSuper) {
    if (!currentUser.center_id) {
      html += '<div style="margin-bottom:14px;padding:12px;background:#fef3c7;border:1px dashed #f59e0b;border-radius:10px;font-size:12px;color:#92400e;">'
        + '⚠️ 센터 정보가 없어 공지를 작성할 수 없습니다.'
        + '</div>';
    } else {
      html += '<div style="margin-bottom:14px;padding:12px;background:#fefce8;border:1px dashed #eab308;border-radius:10px;">'
        + '<div style="font-size:13px;font-weight:700;color:#854d0e;margin-bottom:8px;">✏️ 새 센터 공지 작성 (본인 센터에 발송)</div>'
        + '<div style="display:grid;gap:8px;">'
        + '<select id="bdCenterType" class="form-input" style="font-size:13px;padding:8px;">'
        +   '<option value="info">📢 일반</option>'
        +   '<option value="pin">📍 중요 (상단 고정)</option>'
        +   '<option value="imp">🚨 긴급 (상단 고정)</option>'
        + '</select>'
        + '<input id="bdCenterTitle" class="form-input" placeholder="제목 (필수)" maxlength="200" style="font-size:13px;padding:8px;">'
        + '<textarea id="bdCenterContent" class="form-input" rows="3" placeholder="본문 (필수)" style="font-size:13px;padding:8px;resize:vertical;"></textarea>'
        + '<button class="btn btn-primary" onclick="saveCenterNotice()" style="font-size:13px;padding:10px;">💾 등록</button>'
        + '</div></div>';
    }
  }

  // ── 공지 목록 ──
  if (centerNoticesDB.length === 0) {
    html += '<div class="empty"><div class="empty-icon">📭</div><p>아직 등록된 센터 공지가 없습니다.</p></div>';
  } else {
    html += centerNoticesDB.map(function(n) {
      return renderCenterNoticeCard(n, isAdminOrSuper, isSuperAdmin);
    }).join('');
  }

  c.innerHTML = html;
}

// 카드 1개 렌더
function renderCenterNoticeCard(n, isAdminOrSuper, isSuperAdmin) {
  var typeBadge, borderColor;
  if (n.notice_type === 'imp') {
    typeBadge   = '<span style="background:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">🚨 긴급</span>';
    borderColor = '#ef4444';
  } else if (n.notice_type === 'pin') {
    typeBadge   = '<span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">📍 중요</span>';
    borderColor = '#f59e0b';
  } else {
    typeBadge   = '<span style="background:#e0f2fe;color:#0c4a6e;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">📢 일반</span>';
    borderColor = '#0ea5a0';
  }

  // 슈퍼어드민에게만 센터 이름 배지 표시
  var centerBadge = '';
  if (isSuperAdmin && centersByIdCache) {
    var centerName = centersByIdCache[n.center_id] || ('센터: ' + n.center_id);
    centerBadge = '<span style="background:#e0e7ff;color:#3730a3;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">🏢 ' + escHtml(centerName) + '</span>';
  }

  var when = n.created_at ? new Date(n.created_at).toLocaleString('ko-KR') : '';
  var deleteBtn = isAdminOrSuper
    ? '<button class="btn-del" style="padding:5px 10px;font-size:11px;" onclick="deleteCenterNotice(' + n.id + ')">삭제</button>'
    : '';

  return '<div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border-left:4px solid ' + borderColor + ';">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap;">'
    +   '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
    +     typeBadge
    +     centerBadge
    +     '<span style="font-size:14px;font-weight:700;color:#1e293b;">' + escHtml(n.title || '') + '</span>'
    +   '</div>'
    +   deleteBtn
    + '</div>'
    + (n.content ? '<div style="font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;margin:8px 0 6px;">' + escHtml(n.content) + '</div>' : '')
    + '<div style="font-size:11px;color:#64748b;margin-top:6px;">👤 ' + escHtml(n.author_name || '익명') + ' · ' + escHtml(when) + '</div>'
    + '</div>';
}

// 새 센터 공지 등록
function saveCenterNotice() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('❌ 작성 권한이 없습니다'); return;
  }
  if (!currentUser.center_id) { showToast('❌ 센터 정보가 없습니다'); return; }

  var title   = (document.getElementById('bdCenterTitle')   || {value:''}).value.trim();
  var content = (document.getElementById('bdCenterContent') || {value:''}).value.trim();
  var ntype   = (document.getElementById('bdCenterType')    || {value:'info'}).value;
  if (!title)   { showToast('⚠️ 제목을 입력해 주세요'); return; }
  if (!content) { showToast('⚠️ 본문을 입력해 주세요'); return; }
  if (title.length > 200) { showToast('⚠️ 제목은 200자 이하로 작성해 주세요'); return; }

  var pinned = (ntype !== 'info');

  return supaFetch('madi_notices', 'POST', [{
    center_id:   currentUser.center_id,
    notice_type: ntype,
    pinned:      pinned,
    title:       title,
    content:     content,
    author_name: currentUser.name || '관리자'
  }])
    .then(function() {
      var t = document.getElementById('bdCenterTitle');   if (t) t.value = '';
      var b = document.getElementById('bdCenterContent'); if (b) b.value = '';
      var s = document.getElementById('bdCenterType');    if (s) s.value = 'info';
      showToast('✅ 센터 공지가 등록됐습니다');
      loadCenterNotices();
    })
    .catch(function(e) { showToast('❌ 저장 실패: ' + (e.message || '')); });
}

// 센터 공지 삭제
function deleteCenterNotice(id) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('❌ 삭제 권한이 없습니다'); return;
  }
  if (!confirm('이 공지를 삭제할까요?')) return;

  return supaFetch('madi_notices?id=eq.' + encodeURIComponent(id), 'DELETE')
    .then(function() {
      showToast('🗑️ 공지가 삭제됐습니다');
      loadCenterNotices();
    })
    .catch(function(e) { showToast('❌ 삭제 실패: ' + (e.message || '')); });
}

// ═══════════════════════════════════════════════════════════
// 🍵 라운지 (5~6단계에서 구현)
// ═══════════════════════════════════════════════════════════
function renderLounge() {
  loadLoungePosts();
}

// ───────── 라운지 글 — 권한 기반 필터링 ─────────
// teacher는 Edge Function이 center_id 자동 필터, admin/superadmin은 클라이언트 필터
function filterLoungePosts(posts, user) {
  if (!user || !posts) return [];
  var role = user.role, name = user.name, cid = user.center_id;

  return posts.filter(function(p) {
    if (role === 'superadmin') {
      // 슈퍼어드민: 모든 center 라운지 + 모든 private_super 1:1
      return p.visibility === 'center' || p.visibility === 'private_super';
    }
    if (role === 'admin') {
      // 센터장: 자기 센터의 center/private_admin + 본인 발신 private_super
      if (p.center_id !== cid) return false;
      if (p.visibility === 'center') return true;
      if (p.visibility === 'private_admin') return true;
      if (p.visibility === 'private_super' && p.author_name === name) return true;
      return false;
    }
    // teacher: 자기 센터 center(이미 Edge 필터됨) + 본인 발신 private_*
    if (p.visibility === 'center') return true;
    if (p.author_name === name) return true;
    return false;
  });
}

// visibility 표시 메타 (라벨/아이콘/색상)
function visibilityMeta(vis) {
  if (vis === 'private_super') return { label: '1:1 슈퍼관리자', icon: '🔒', color: '#8b5cf6', bg: '#ede9fe' };
  if (vis === 'private_admin') return { label: '1:1 센터장', icon: '🔒', color: '#0ea5a0', bg: '#e0f7f6' };
  return { label: '라운지', icon: '📢', color: '#3b82f6', bg: '#dbeafe' };
}

function loadLoungePosts() {
  var ui = document.getElementById('bdPanel_lounge');
  if (!ui) return;
  ui.innerHTML = '<div class="loading"><div class="spinner"></div><p>라운지 글을 불러오는 중...</p></div>';

  // admin/superadmin은 다른 센터 글까지 봐야 하므로 limit 넉넉하게
  supaFetch('madi_lounge_posts?select=*&order=created_at.desc&limit=100', 'GET')
    .then(function(data) {
      loungePostsDB = data || [];
      // 슈퍼어드민이면 센터 이름 캐시 로드 (배지 표시용)
      if (currentUser && currentUser.role === 'superadmin') {
        loadCentersByIdCache().finally(function() { renderLoungeUI(); });
      } else {
        renderLoungeUI();
      }
    })
    .catch(function(err) {
      ui.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(err.message || '오류') + '</p></div>';
    });
}

function renderLoungeUI() {
  var ui = document.getElementById('bdPanel_lounge');
  if (!ui) return;

  var user = currentUser || {};
  var role = user.role;
  var posts = filterLoungePosts(loungePostsDB, user);

  // 역할별 작성 가능 visibility 옵션
  var visOpts = [];
  if (role === 'teacher') {
    visOpts = [
      { val: 'center',        label: '📢 라운지 (센터 모두에게 공개)' },
      { val: 'private_super', label: '🔒 1:1 슈퍼관리자에게' },
      { val: 'private_admin', label: '🔒 1:1 센터장에게' }
    ];
  } else if (role === 'admin') {
    visOpts = [
      { val: 'center',        label: '📢 라운지 (센터 모두에게 공개)' },
      { val: 'private_super', label: '🔒 1:1 슈퍼관리자에게' }
    ];
  } else if (role === 'superadmin') {
    visOpts = [
      { val: 'center',        label: '📢 라운지 (모든 센터 공통)' }
    ];
  }
  var visOptHtml = visOpts.map(function(o) {
    return '<option value="' + o.val + '">' + o.label + '</option>';
  }).join('');

  // 작성 폼
  var formHtml = visOpts.length === 0 ? '' :
      '<div class="card" style="margin-bottom:16px;">'
    + '<div class="card-title"><div class="card-title-left">✏️ 라운지 글 작성</div></div>'
    + '<div style="display:flex;flex-direction:column;gap:10px;">'
    + '<select id="loungeVisibility" class="form-input" style="font-size:14px;">' + visOptHtml + '</select>'
    + '<input type="text" id="loungeTitle" class="form-input" placeholder="제목 (100자 이내)" maxlength="100">'
    + '<textarea id="loungeContent" class="form-input" placeholder="내용을 입력하세요..." rows="4" style="resize:vertical;font-family:inherit;"></textarea>'
    + '<button class="btn btn-primary" onclick="saveLoungePost()" style="font-size:14px;">📝 작성하기</button>'
    + '</div>'
    + '</div>';

  // 글 목록
  var listHtml = posts.length === 0
    ? '<div style="text-align:center;padding:40px 20px;color:var(--text2);font-size:13px;">아직 등록된 글이 없습니다.</div>'
    : posts.map(function(p) { return renderLoungePostCard(p, user); }).join('');

  ui.innerHTML = formHtml + '<div style="display:flex;flex-direction:column;gap:10px;">' + listHtml + '</div>';
}

function renderLoungePostCard(post, user) {
  var canDelete = (user && (user.role === 'superadmin' || post.author_name === user.name));
  var meta = visibilityMeta(post.visibility);
  var roleBadge = post.author_role === 'superadmin' ? '👑 슈퍼관리자' :
                  post.author_role === 'admin'      ? '🎯 센터장'    : '👤 선생님';

  // 슈퍼어드민이 다른 센터 글 보는 경우 센터 이름 표시
  var centerBadge = '';
  if (user && user.role === 'superadmin' && post.center_id) {
    var centerName = (centersByIdCache && centersByIdCache[post.center_id]) || post.center_id;
    centerBadge = ' · <span style="font-size:11px;color:var(--text2);">🏢 ' + escHtml(centerName) + '</span>';
  }

  // 시간 표시
  var when = '';
  try {
    if (post.created_at) {
      var d = new Date(post.created_at);
      when = d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) { when = ''; }

  var deleteBtn = canDelete
    ? '<button class="btn-ghost" style="font-size:11px;color:#ef4444;border-color:#ef4444;padding:4px 10px;flex-shrink:0;" onclick="deleteLoungePost(' + post.id + ')">🗑️ 삭제</button>'
    : '';

  return '<div class="card" style="border-left:4px solid ' + meta.color + ';">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">'
    + '<div style="flex:1;min-width:0;">'
    +   '<span style="display:inline-block;font-size:11px;color:' + meta.color + ';font-weight:700;background:' + meta.bg + ';padding:3px 9px;border-radius:10px;">' + meta.icon + ' ' + meta.label + '</span>'
    +   '<div style="margin-top:6px;font-size:12px;color:var(--text2);">'
    +     '<span style="font-weight:600;color:var(--text);">' + escHtml(post.author_name || '익명') + '</span> · ' + roleBadge + centerBadge + ' · ' + when
    +   '</div>'
    + '</div>'
    + deleteBtn
    + '</div>'
    + '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">' + escHtml(post.title || '') + '</div>'
    + (post.content ? '<div style="font-size:13px;color:var(--text);line-height:1.65;white-space:pre-wrap;word-break:break-word;">' + escHtml(post.content) + '</div>' : '')
    + '</div>';
}

function saveLoungePost() {
  var visEl     = document.getElementById('loungeVisibility');
  var titleEl   = document.getElementById('loungeTitle');
  var contentEl = document.getElementById('loungeContent');
  if (!visEl || !titleEl || !contentEl) return;

  var visibility = visEl.value;
  var title      = (titleEl.value || '').trim();
  var content    = (contentEl.value || '').trim();

  if (!title)              { showToast('⚠️ 제목을 입력해주세요'); return; }
  if (title.length > 100)  { showToast('⚠️ 제목은 100자 이하로 작성해주세요'); return; }

  var user = currentUser || {};
  if (!user.name || !user.role) { showToast('⚠️ 로그인 정보를 확인해주세요'); return; }

  var post = {
    center_id:   user.center_id || '',
    author_name: user.name,
    author_role: user.role,
    visibility:  visibility,
    title:       title,
    content:     content
  };

  var btn = document.querySelector('button[onclick="saveLoungePost()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 등록 중...'; }

  supaFetch('madi_lounge_posts', 'POST', post)
    .then(function() {
      titleEl.value = '';
      contentEl.value = '';
      showToast('✅ 글이 등록됐습니다');
      loadLoungePosts();
    })
    .catch(function(err) {
      showToast('⚠️ 등록 실패: ' + (err.message || ''));
      if (btn) { btn.disabled = false; btn.textContent = '📝 작성하기'; }
    });
}

function deleteLoungePost(id) {
  if (!confirm('이 글을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.')) return;

  supaFetch('madi_lounge_posts?id=eq.' + id, 'DELETE')
    .then(function() {
      showToast('🗑️ 글이 삭제됐습니다');
      loadLoungePosts();
    })
    .catch(function(err) {
      showToast('⚠️ 삭제 실패: ' + (err.message || ''));
    });
}
