// ─────── 게시판 이미지 업로드 유틸 ───────
var _loungePostImages    = []; // 글 작성 폼 첨부 File 객체 배열 (최대 3장)
var _loungeCommentImages = {}; // { postId: File } 댓글 첨부 1장

// Supabase Storage board-images 버킷에 파일 업로드 → public URL 반환
// ★ 보안: anon key 직접 사용 제거 — Edge Function(upload-image)을 경유하여 업로드
function uploadBoardImage(file, folder) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onerror = function() { reject(new Error('파일 읽기 실패')); };
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1]; // data:mime;base64,<여기>
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      fetch(EDGE_URL + '/upload-image', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file:     base64,
          mimeType: file.type || 'application/octet-stream',
          folder:   folder,
          ext:      ext
        })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) throw new Error('이미지 업로드 실패: ' + data.error);
        resolve(data.url);
      })
      .catch(reject);
    };
    reader.readAsDataURL(file);
  });
}

// 이미지 URL 배열을 가로 스크롤 썸네일로 렌더
function renderImageThumbs(urls) {
  if (!urls || urls.length === 0) return '';
  return '<div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0;margin-top:6px;-webkit-overflow-scrolling:touch;">'
    + urls.map(function(url) {
        var safeUrl = escHtml(url);
        return '<a href="' + safeUrl + '" target="_blank" rel="noopener" style="flex-shrink:0;">'
          + '<img src="' + safeUrl + '" alt="첨부 이미지" loading="lazy" '
          + 'style="height:110px;width:auto;max-width:180px;border-radius:8px;object-fit:cover;border:1px solid var(--border);" '
          + 'onerror="this.remove()">'
          + '</a>';
      }).join('')
    + '</div>';
}

// 파일 input change → 미리보기 갱신 (글 작성 폼)
var MAX_IMG_BYTES = 5 * 1024 * 1024; // 5MB

var ALLOWED_IMAGE_MIMES = ['image/jpeg','image/png','image/gif','image/webp'];

function onLoungeImagesChange(input) {
  _loungePostImages = [];
  var previewEl = document.getElementById('loungeImgPreview');
  if (!input.files || input.files.length === 0) {
    if (previewEl) previewEl.innerHTML = '';
    return;
  }
  var files = Array.prototype.slice.call(input.files, 0, 3);
  var oversized = [], badType = [];
  files = files.filter(function(f) {
    if (ALLOWED_IMAGE_MIMES.indexOf(f.type) === -1) { badType.push(f.name); return false; }
    if (f.size > MAX_IMG_BYTES) { oversized.push(f.name); return false; }
    return true;
  });
  if (badType.length > 0) {
    showToast('\u26a0\ufe0f \uc774\ubbf8\uc9c0(JPG/PNG/GIF/WEBP)\ub9cc \ucca8\ubd80 \uac00\ub2a5\ud569\ub2c8\ub2e4: ' + badType.join(', '));
  }
  if (oversized.length > 0) {
    showToast('\u26a0\ufe0f 5MB \ucd08\uacfc \uc774\ubbf8\uc9c0\ub294 \uccca\ubd80\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4: ' + oversized.join(', '));
  }
  if (badType.length > 0 || oversized.length > 0) {
    input.value = '';
    if (files.length === 0) { if (previewEl) previewEl.innerHTML = ''; return; }
  }
  files.forEach(function(f) { _loungePostImages.push(f); });
  if (previewEl) {
    previewEl.innerHTML = files.map(function(f, i) {
      var url = URL.createObjectURL(f);
      return '<div style="position:relative;display:inline-block;">'
        + '<img src="' + url + '" style="height:80px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">'
        + '<button type="button" onclick="removeLoungeImage(' + i + ')" '
        + 'style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;font-weight:700;">×</button>'
        + '</div>';
    }).join('');
  }
}

function removeLoungeImage(idx) {
  _loungePostImages.splice(idx, 1);
  var input = document.getElementById('loungeImgInput');
  if (input) input.value = '';
  var previewEl = document.getElementById('loungeImgPreview');
  if (previewEl) {
    previewEl.innerHTML = _loungePostImages.map(function(f, i) {
      var url = URL.createObjectURL(f);
      return '<div style="position:relative;display:inline-block;">'
        + '<img src="' + url + '" style="height:80px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">'
        + '<button type="button" onclick="removeLoungeImage(' + i + ')" '
        + 'style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;font-weight:700;">×</button>'
        + '</div>';
    }).join('');
  }
}

// 댓글 이미지 첨부
function onCommentImageChange(postId, input) {
  if (input.files && input.files[0]) {
    var f = input.files[0];
    if (f.size > MAX_IMG_BYTES) {
      showToast('\u26a0\ufe0f \uc774\ubbf8\uc9c0\ub294 5MB \uc774\ud558\ub85c \ucca8\ubd80\ud574 \uc8fc\uc138\uc694');
      input.value = '';
      delete _loungeCommentImages[postId];
      return;
    }
    _loungeCommentImages[postId] = f;
  } else {
    delete _loungeCommentImages[postId];
  }
}

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
// 비동기 응답이 도착했을 때 사용자가 이미 다른 탭으로 옮겼는지 판별하는 토큰
var _boardLoadGen = 0;

// 데이터 캐시 (단계별로 채워나감)
var globalNoticesDB = [];
var centerNoticesDB = [];
var loungePostsDB = [];
var loungeCommentsCache = {};   // { post_id: [comments...] } 펼친 글의 댓글만
var loungeExpandedPosts = {};   // { post_id: true } 댓글 영역 펼친 글
var centersByIdCache = null;  // null=미로드, {}=로드됨 (슈퍼어드민이 센터 이름 표시용)

// 게시판 진입 시 호출 (switchTab(7)에서 자동)
function initBoard() {
  switchBoardTab(currentBoardTab || 'global');
}

// 서브탭 전환
function switchBoardTab(name) {
  if (!name) return;
  _boardLoadGen++;            // 이전 탭의 비동기 응답을 무효화
  currentBoardTab = name;

  ['global', 'center', 'lounge', 'library'].forEach(function(n) {
    var btn = document.getElementById('bdBtn_' + n);
    if (btn) btn.classList.remove('active');
    var pnl = document.getElementById('bdPanel_' + n);
    if (pnl) pnl.style.display = 'none';
  });

  var activeBtn = document.getElementById('bdBtn_' + name);
  if (activeBtn) activeBtn.classList.add('active');
  var activePnl = document.getElementById('bdPanel_' + name);
  if (activePnl) activePnl.style.display = 'block';

  if      (name === 'global')  renderGlobalNotices();
  else if (name === 'center')  renderCenterNotices();
  else if (name === 'lounge')  renderLounge();
  else if (name === 'library') renderLibrary();
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
  var gen = _boardLoadGen;
  return supaFetch('madi_global_notices?order=pinned.desc,created_at.desc&limit=100', 'GET')
    .then(function(rows) {
      if (gen !== _boardLoadGen) return; // 사용자가 이미 다른 탭으로 이동함
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
      + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#0c4a6e;cursor:pointer;padding:4px 2px;">'
      +   '<input type="checkbox" id="bdGlobalAsPopup" style="width:14px;height:14px;cursor:pointer;margin:0;">'
      +   '<span>🔔 로그인 팝업으로 표시 <span style="color:#64748b;font-weight:normal;">(한 번에 하나만 — 이전 팝업 자동 해제)</span></span>'
      + '</label>'
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
  // 로그인 팝업 활성 배지 (모든 사용자에게 보임)
  var popupBadge = n.show_as_login_popup
    ? '<span style="background:#fef9c3;color:#854d0e;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid #facc15;">🔔 로그인 팝업</span>'
    : '';
  var when = n.created_at ? new Date(n.created_at).toLocaleString('ko-KR') : '';

  // 슈퍼어드민: 팝업 토글 + 삭제 버튼  /  본인 글: 수정 버튼
  var adminBtns = '';
  var editBtn = _isMyPost(n)
    ? '<button onclick="editGlobalNotice(\'' + n.id + '\')" style="padding:5px 10px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0c4a6e;border:1px solid #38bdf8;border-radius:6px;cursor:pointer;">✏️ 수정</button>'
    : '';
  if (isSuperAdmin) {
    var togglLabel = n.show_as_login_popup ? '🔕 팝업 해제' : '🔔 팝업으로 표시';
    var togglBg    = n.show_as_login_popup ? '#fef9c3' : '#f1f5f9';
    var togglCol   = n.show_as_login_popup ? '#854d0e' : '#475569';
    adminBtns =
        editBtn
      + '<button onclick="togglePopupNotice(\'' + n.id + '\',' + (n.show_as_login_popup ? 'true' : 'false') + ')" '
      +   'style="padding:5px 10px;font-size:11px;font-weight:700;background:' + togglBg + ';color:' + togglCol + ';border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;">'
      +   togglLabel
      + '</button>'
      + '<button class="btn-del" style="padding:5px 10px;font-size:11px;" onclick="deleteGlobalNotice(\'' + n.id + '\')">삭제</button>';
  } else {
    adminBtns = editBtn;
  }

  return '<div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border-left:4px solid ' + borderColor + ';">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap;">'
    +   '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
    +     typeBadge
    +     popupBadge
    +     '<span style="font-size:14px;font-weight:700;color:#1e293b;">' + escHtml(n.title || '') + '</span>'
    +   '</div>'
    +   '<div style="display:flex;gap:4px;flex-shrink:0;">' + adminBtns + '</div>'
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
  var popupEl = document.getElementById('bdGlobalAsPopup');
  var asPopup = !!(popupEl && popupEl.checked);
  if (!title)   { showToast('⚠️ 제목을 입력해 주세요'); return; }
  if (!content) { showToast('⚠️ 본문을 입력해 주세요'); return; }
  if (title.length > 200) { showToast('⚠️ 제목은 200자 이하로 작성해 주세요'); return; }

  // pin/imp는 자동으로 상단 고정
  var pinned = (ntype !== 'info');

  // 팝업 ON 으로 등록 시 → 먼저 기존 활성 팝업 모두 OFF (한 번에 하나만 활성)
  var prep = asPopup
    ? supaFetch('madi_global_notices?show_as_login_popup=eq.true', 'PATCH', { show_as_login_popup: false })
    : Promise.resolve();

  return prep
    .then(function() {
      return supaFetch('madi_global_notices', 'POST', [{
        notice_type:         ntype,
        pinned:              pinned,
        title:               title,
        content:             content,
        author_id:           currentUser.id,
        author_name:         currentUser.name || '슈퍼어드민',
        show_as_login_popup: asPopup
      }]);
    })
    .then(function() {
      var t = document.getElementById('bdGlobalTitle');   if (t) t.value = '';
      var b = document.getElementById('bdGlobalContent'); if (b) b.value = '';
      var s = document.getElementById('bdGlobalType');    if (s) s.value = 'info';
      var p = document.getElementById('bdGlobalAsPopup'); if (p) p.checked = false;
      showToast(asPopup ? '✅ 공지 등록 + 로그인 팝업 활성화' : '✅ 마디 공지가 등록됐습니다');
      loadGlobalNotices();
    })
    .catch(function(e) { showToast('❌ 저장 실패: ' + (e.message || '')); });
}

// 기존 공지의 로그인 팝업 ON/OFF 토글
// current=true 면 해당 글을 OFF, current=false 면 다른 글 모두 OFF 후 해당 글만 ON
function togglePopupNotice(id, current) {
  if (!currentUser || currentUser.role !== 'superadmin') {
    showToast('❌ 슈퍼어드민만 변경할 수 있습니다'); return;
  }
  if (current) {
    // 현재 ON → OFF 만 하면 됨
    supaFetch('madi_global_notices?id=eq.' + encodeURIComponent(id), 'PATCH', { show_as_login_popup: false })
      .then(function() {
        showToast('🔕 로그인 팝업 해제됨');
        loadGlobalNotices();
      })
      .catch(function(e) { showToast('❌ 변경 실패: ' + (e.message || '')); });
  } else {
    // 현재 OFF → 모든 글 OFF 후 해당 글만 ON
    supaFetch('madi_global_notices?show_as_login_popup=eq.true', 'PATCH', { show_as_login_popup: false })
      .then(function() {
        return supaFetch('madi_global_notices?id=eq.' + encodeURIComponent(id), 'PATCH', { show_as_login_popup: true });
      })
      .then(function() {
        showToast('🔔 로그인 팝업으로 활성화됨');
        loadGlobalNotices();
      })
      .catch(function(e) { showToast('❌ 변경 실패: ' + (e.message || '')); });
  }
}

// 공지 삭제
function deleteGlobalNotice(id) {
  if (!currentUser || currentUser.role !== 'superadmin') { showToast('❌ 슈퍼어드민만 삭제할 수 있습니다'); return; }
  showConfirm('이 공지를 삭제할까요? 모든 센터에서 사라집니다.', function() {
    supaFetch('madi_global_notices?id=eq.' + encodeURIComponent(id), 'DELETE')
      .then(function() {
        showToast('🗑️ 공지가 삭제됐습니다');
        loadGlobalNotices();
      })
      .catch(function(e) { showToast('❌ 삭제 실패: ' + (e.message || '')); });
  });
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

  var gen = _boardLoadGen;
  return supaFetch(query, 'GET')
    .then(function(rows) {
      if (gen !== _boardLoadGen) return;
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
  var editBtn = _isMyPost(n)
    ? '<button onclick="editCenterNotice(\'' + n.id + '\')" style="padding:5px 10px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0c4a6e;border:1px solid #38bdf8;border-radius:6px;cursor:pointer;">✏️ 수정</button>'
    : '';
  var deleteBtn = isAdminOrSuper
    ? '<button class="btn-del" style="padding:5px 10px;font-size:11px;" onclick="deleteCenterNotice(\'' + n.id + '\')">삭제</button>'
    : '';

  return '<div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border-left:4px solid ' + borderColor + ';">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap;">'
    +   '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
    +     typeBadge
    +     centerBadge
    +     '<span style="font-size:14px;font-weight:700;color:#1e293b;">' + escHtml(n.title || '') + '</span>'
    +   '</div>'
    +   '<div style="display:flex;gap:4px;flex-shrink:0;">' + editBtn + deleteBtn + '</div>'
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
    author_id:   currentUser.id,
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
  showConfirm('이 공지를 삭제할까요?', function() {
    supaFetch('madi_notices?id=eq.' + encodeURIComponent(id), 'DELETE')
      .then(function() {
        showToast('🗑️ 공지가 삭제됐습니다');
        loadCenterNotices();
      })
      .catch(function(e) { showToast('❌ 삭제 실패: ' + (e.message || '')); });
  });
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
  var role = user.role, uid = user.id, cid = user.center_id;

  return posts.filter(function(p) {
    if (role === 'superadmin') {
      // 슈퍼어드민: 모든 center 라운지 + 모든 private_super 1:1
      return p.visibility === 'center' || p.visibility === 'private_super';
    }
    var isMine = p.author_id === uid;
    if (role === 'admin') {
      // 센터장: 자기 센터의 center/private_admin + 본인 발신 private_super
      if (p.center_id !== cid) return false;
      if (p.visibility === 'center') return true;
      if (p.visibility === 'private_admin') return true;
      if (p.visibility === 'private_super' && isMine) return true;
      return false;
    }
    // teacher: 자기 센터 center(이미 Edge 필터됨) + 본인 발신 private_*
    if (p.visibility === 'center') return true;
    if (isMine) return true;
    return false;
  });
}

// visibility 표시 메타 (라벨/아이콘/색상)
function visibilityMeta(vis) {
  if (vis === 'private_super') return { label: '1:1 슈퍼관리자', icon: '🔒', color: '#8b5cf6', bg: '#ede9fe' };
  if (vis === 'private_admin') return { label: '1:1 센터장', icon: '🔒', color: '#0ea5a0', bg: '#e0f7f6' };
  return { label: '고객센터', icon: '📢', color: '#3b82f6', bg: '#dbeafe' };
}

function loadLoungePosts() {
  var ui = document.getElementById('bdPanel_lounge');
  if (!ui) return;
  ui.innerHTML = '<div class="loading"><div class="spinner"></div><p>고객센터 글을 불러오는 중...</p></div>';

  // superadmin은 전체 센터 조회, admin/teacher는 자기 센터만 (RLS 이중 방어)
  var _loungeUser = currentUser || {};
  var _loungePath = 'madi_lounge_posts?select=*&order=created_at.desc&limit=100';
  if (_loungeUser.role !== 'superadmin' && _loungeUser.center_id) {
    _loungePath += '&center_id=eq.' + encodeURIComponent(_loungeUser.center_id);
  }
  var gen = _boardLoadGen;
  supaFetch(_loungePath, 'GET')
    .then(function(data) {
      if (gen !== _boardLoadGen) return;
      loungePostsDB = data || [];
      // 슈퍼어드민이면 센터 이름 캐시 로드 (배지 표시용)
      if (currentUser && currentUser.role === 'superadmin') {
        // ES5 호환: .finally() 미지원 환경 — then/catch 양쪽에서 동일 렌더
        function _renderLoungeAfterCache() {
          if (gen !== _boardLoadGen) return;
          renderLoungeUI();
        }
        loadCentersByIdCache().then(_renderLoungeAfterCache, _renderLoungeAfterCache);
      } else {
        renderLoungeUI();
      }
    })
    .catch(function(err) {
      console.error('[loadLoungePosts]', err);
      ui.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p></div>';
    });
}

function renderLoungeUI() {
  var ui = document.getElementById('bdPanel_lounge');
  if (!ui) return;

  var user = currentUser || {};
  var role = user.role;
  var posts = filterLoungePosts(loungePostsDB, user);

  // ── 작성 폼 ──
  var formHtml = '';
  if (role === 'teacher' || role === 'admin') {
    var recipOpts = role === 'teacher'
      ? '<option value="private_admin">📋 센터장에게 건의</option>'
        + '<option value="private_super">📋 슈퍼관리자에게 건의</option>'
      : '<option value="private_super">📋 슈퍼관리자에게 건의</option>';

    formHtml = '<div class="card" style="margin-bottom:16px;border:1.5px solid var(--mint2);">'
      + '<div class="card-title"><div class="card-title-left">✉️ 건의 / 문의하기</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:10px;">'
      + '<div>'
      +   '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:5px;">수신자</label>'
      +   '<select id="loungeVisibility" class="form-input" style="font-size:14px;">' + recipOpts + '</select>'
      + '</div>'
      + '<div>'
      +   '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:5px;">제목</label>'
      +   '<input type="text" id="loungeTitle" class="form-input" placeholder="건의 제목을 입력해주세요" maxlength="100" style="margin-bottom:0;">'
      + '</div>'
      + '<div>'
      +   '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:5px;">내용</label>'
      +   '<textarea id="loungeContent" class="form-input" placeholder="건의 내용을 자세히 적어주세요..." rows="5" style="resize:vertical;font-family:inherit;margin-bottom:0;"></textarea>'
      + '</div>'
      + '<div style="border:1.5px dashed #cbd5e1;border-radius:10px;padding:10px 12px;background:#f8fafc;">'
      +   '<div style="font-size:12px;color:var(--text2);margin-bottom:6px;">📎 이미지 첨부 (최대 3장, 선택)</div>'
      +   '<input type="file" id="loungeImgInput" accept="image/*" multiple style="font-size:12px;" onchange="onLoungeImagesChange(this)">'
      +   '<div id="loungeImgPreview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;"></div>'
      + '</div>'
      + '<button class="btn btn-primary" onclick="saveLoungePost()" style="font-size:14px;">📨 건의 보내기</button>'
      + '</div>'
      + '</div>';
  } else if (role === 'superadmin') {
    // 슈퍼관리자는 작성 폼 없음 — 받은 건의만 열람/답변
    formHtml = '<div style="background:var(--mint2);border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--mint);font-weight:600;">'
      + '📞 모든 센터의 건의·문의를 수신합니다. 댓글로 답변해주세요.</div>';
  }

  // ── 글 목록 ──
  // 관리자: 받은 건의 / 내가 보낸 건의 구분
  var listHtml = '';
  if (role === 'admin') {
    var received = posts.filter(function(p){ return p.visibility === 'private_admin' && p.author_id !== user.id; });
    var sent     = posts.filter(function(p){ return p.author_id === user.id; });

    listHtml += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;margin-top:4px;">📥 받은 건의 (' + received.length + ')</div>';
    listHtml += received.length
      ? received.map(function(p){ return renderInquiryCard(p, user); }).join('')
      : '<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px;background:var(--bg);border-radius:10px;margin-bottom:12px;">받은 건의가 없습니다.</div>';

    listHtml += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;margin-top:16px;">📤 내가 보낸 건의 (' + sent.length + ')</div>';
    listHtml += sent.length
      ? sent.map(function(p){ return renderInquiryCard(p, user); }).join('')
      : '<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px;background:var(--bg);border-radius:10px;">보낸 건의가 없습니다.</div>';
  } else {
    listHtml = posts.length === 0
      ? '<div style="text-align:center;padding:40px 20px;color:var(--text2);font-size:13px;">등록된 건의가 없습니다.</div>'
      : posts.map(function(p){ return renderInquiryCard(p, user); }).join('');
  }

  ui.innerHTML = formHtml + '<div style="display:flex;flex-direction:column;gap:10px;">' + listHtml + '</div>';
}

function renderInquiryCard(post, user) {
  var isMine    = user && post.author_id === user.id;
  var canDelete = (user && (user.role === 'superadmin' || isMine));

  // 수신자 배지
  var toLabel = post.visibility === 'private_super' ? '👑 슈퍼관리자' :
                post.visibility === 'private_admin'  ? '🎯 센터장' : '📢 전체';
  var toColor = post.visibility === 'private_super' ? '#d97706' :
                post.visibility === 'private_admin'  ? '#0ea5a0' : '#3b82f6';
  var toBg    = post.visibility === 'private_super' ? '#fef3c7' :
                post.visibility === 'private_admin'  ? '#e0f7f6' : '#dbeafe';

  // 발신자 표시
  var fromLabel = post.author_role === 'superadmin' ? '👑 슈퍼관리자' :
                  post.author_role === 'admin'      ? '🎯 센터장'    : '👤 선생님';

  // 센터 이름 (슈퍼관리자용)
  var centerBadge = '';
  if (user && user.role === 'superadmin' && post.center_id) {
    var centerName = (centersByIdCache && centersByIdCache[post.center_id]) || post.center_id;
    centerBadge = '<span style="font-size:11px;color:var(--text2);margin-left:6px;">🏢 ' + escHtml(centerName) + '</span>';
  }

  var when = '';
  try {
    if (post.created_at) {
      var d = new Date(post.created_at);
      when = d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {}

  var editBtn = isMine
    ? '<button class="btn-ghost" style="font-size:11px;color:#0c4a6e;border-color:#38bdf8;padding:4px 10px;flex-shrink:0;" onclick="editLoungePost(\'' + post.id + '\')">✏️ 수정</button>'
    : '';
  var deleteBtn = canDelete
    ? '<button class="btn-ghost" style="font-size:11px;color:#ef4444;border-color:#ef4444;padding:4px 10px;flex-shrink:0;" onclick="deleteLoungePost(\'' + post.id + '\')">삭제</button>'
    : '';

  return '<div class="card" style="border-left:4px solid ' + toColor + ';margin-bottom:4px;">'
    // 헤더: 발신→수신 / 날짜 / 수정·삭제
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">'
    +   '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">'
    +     (isMine ? '' : '<span style="font-size:12px;font-weight:700;color:var(--text);">' + escHtml(post.author_name||'') + '</span>')
    +     '<span style="font-size:11px;color:var(--text2);">' + fromLabel + '</span>'
    +     centerBadge
    +     '<span style="font-size:11px;color:var(--text2);">→</span>'
    +     '<span style="font-size:11px;font-weight:700;color:' + toColor + ';background:' + toBg + ';padding:2px 8px;border-radius:10px;">' + toLabel + '</span>'
    +     (isMine ? '<span style="font-size:10px;color:var(--mint);background:var(--mint2);padding:2px 7px;border-radius:8px;font-weight:700;">내가 보낸 건의</span>' : '')
    +   '</div>'
    +   '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">'
    +     '<span style="font-size:11px;color:var(--text2);">' + when + '</span>'
    +     editBtn
    +     deleteBtn
    +   '</div>'
    + '</div>'
    // 제목
    + '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">' + escHtml(post.title || '') + '</div>'
    // 내용
    + (post.content ? '<div style="font-size:13px;color:var(--text);line-height:1.7;white-space:pre-wrap;word-break:break-word;margin-bottom:10px;padding:10px 12px;background:var(--bg);border-radius:8px;">' + escHtml(post.content) + '</div>' : '')
    + (post.image_urls && post.image_urls.length ? renderImageThumbs(post.image_urls) : '')
    // 댓글 (답변)
    + '<div style="border-top:1px dashed var(--border);padding-top:10px;margin-top:4px;">'
    +   '<button class="btn-ghost" style="font-size:12px;padding:5px 12px;color:' + toColor + ';border-color:' + toColor + ';" onclick="toggleComments(\'' + post.id + '\')">💬 답변 <span id="commentCount_' + post.id + '"></span></button>'
    +   '<div id="commentArea_' + post.id + '" style="display:none;margin-top:10px;"></div>'
    + '</div>'
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
    author_id:   user.id,
    author_name: user.name,
    author_role: user.role,
    visibility:  visibility,
    title:       title,
    content:     content
  };

  var btn = document.querySelector('button[onclick="saveLoungePost()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 등록 중...'; }

  // 이미지 업로드 후 글 저장
  var uploadPromises = _loungePostImages.map(function(f) {
    return uploadBoardImage(f, 'posts');
  });

  Promise.all(uploadPromises)
    .then(function(imageUrls) {
      if (imageUrls.length > 0) post.image_urls = imageUrls;
      return supaFetch('madi_lounge_posts', 'POST', post);
    })
    .then(function() {
      titleEl.value = '';
      contentEl.value = '';
      _loungePostImages = [];
      var imgInput = document.getElementById('loungeImgInput');
      if (imgInput) imgInput.value = '';
      var preview = document.getElementById('loungeImgPreview');
      if (preview) preview.innerHTML = '';
      showToast('✅ 글이 등록됐습니다');
      loadLoungePosts();
      // 성공(UI 재렌더) 후 btn은 이미 교체됐을 수 있으나 no-op으로 안전
      if (btn) { btn.disabled = false; btn.textContent = '📨 건의 보내기'; }
    })
    .catch(function(err) {
      showToast('⚠️ 등록 실패: ' + (err.message || ''));
      if (btn) { btn.disabled = false; btn.textContent = '📨 건의 보내기'; }
    });
}

function deleteLoungePost(id) {
  showConfirm('이 글을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.', function() {
    supaFetch('madi_lounge_posts?id=eq.' + encodeURIComponent(id), 'DELETE')
      .then(function() {
        showToast('🗑️ 글이 삭제됐습니다');
        loadLoungePosts();
      })
      .catch(function(err) {
        showToast('⚠️ 삭제 실패: ' + (err.message || ''));
      });
  });
}

// ───────── 라운지 댓글 (6단계) ─────────
function toggleComments(postId) {
  var area = document.getElementById('commentArea_' + postId);
  if (!area) return;

  if (loungeExpandedPosts[postId]) {
    // 접기
    area.style.display = 'none';
    loungeExpandedPosts[postId] = false;
  } else {
    // 펼치기 + 댓글 로드
    area.style.display = 'block';
    loungeExpandedPosts[postId] = true;
    loadComments(postId);
  }
}

function loadComments(postId) {
  var area = document.getElementById('commentArea_' + postId);
  if (!area) return;
  area.innerHTML = '<div style="font-size:11px;color:var(--text2);text-align:center;padding:8px;">댓글 불러오는 중...</div>';

  supaFetch('madi_lounge_comments?post_id=eq.' + postId + '&select=*&order=created_at.asc', 'GET')
    .then(function(data) {
      loungeCommentsCache[postId] = data || [];
      renderComments(postId);
    })
    .catch(function(err) {
      console.error('[loadComments]', err);
      area.innerHTML = '<div style="font-size:11px;color:#ef4444;padding:6px;">⚠️ 댓글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    });
}

function renderComments(postId) {
  var area = document.getElementById('commentArea_' + postId);
  var countEl = document.getElementById('commentCount_' + postId);
  if (!area) return;

  var comments = loungeCommentsCache[postId] || [];
  var user = currentUser || {};

  // 카운트 표시
  if (countEl) countEl.textContent = comments.length > 0 ? '(' + comments.length + ')' : '';

  // 댓글 목록 + 작성 폼
  var listHtml = comments.length === 0
    ? '<div style="font-size:11px;color:var(--text2);text-align:center;padding:8px;">아직 댓글이 없습니다.</div>'
    : comments.map(function(c) {
        var canDelete = (user.role === 'superadmin' || c.author_id === user.id);
        var roleBadge = c.author_role === 'superadmin' ? '👑' :
                        c.author_role === 'admin'      ? '🎯' : '👤';
        var when = '';
        try {
          if (c.created_at) {
            var d = new Date(c.created_at);
            when = d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          }
        } catch (e) { when = ''; }

        return '<div style="background:var(--bg);border-radius:8px;padding:8px 10px;margin-bottom:6px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">'
          +   '<div style="font-size:11px;color:var(--text2);">'
          +     '<span style="font-weight:600;color:var(--text);">' + roleBadge + ' ' + escHtml(c.author_name || '익명') + '</span> · ' + when
          +   '</div>'
          + (canDelete ? '<button class="btn-ghost" style="font-size:10px;color:#ef4444;border-color:#ef4444;padding:2px 8px;" onclick="deleteComment(\'' + postId + '\',\'' + c.id + '\')">🗑️</button>' : '')
          + '</div>'
          + '<div style="font-size:13px;color:var(--text);line-height:1.55;white-space:pre-wrap;word-break:break-word;">' + escHtml(c.content) + '</div>'
        + (c.image_url ? '<a href="' + escHtml(c.image_url) + '" target="_blank" rel="noopener">'
          + '<img src="' + escHtml(c.image_url) + '" loading="lazy" '
          + 'style="margin-top:6px;max-height:120px;max-width:100%;border-radius:8px;" '
          + 'onerror="this.remove()"></a>' : '')
          + '</div>';
      }).join('');

  // 작성 폼
  var formHtml = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">'
    + '<div style="display:flex;gap:6px;">'
    + '<input type="text" id="newComment_' + postId + '" class="form-input" placeholder="댓글을 입력하세요..." style="flex:1;font-size:13px;" onkeydown="if(event.key===\'Enter\'&&!event.isComposing) saveComment(\'' + postId + '\')">'
    + '<button class="btn btn-primary" style="margin-top:0;font-size:13px;padding:8px 14px;white-space:nowrap;" onclick="saveComment(\'' + postId + '\')">📝 등록</button>'
    + '</div>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);cursor:pointer;">'
    + '📎 이미지 <input type="file" accept="image/*" style="font-size:11px;" onchange="onCommentImageChange(\'' + postId + '\',this)"></label>'
    + '</div>';

  area.innerHTML = listHtml + formHtml;
}

function saveComment(postId) {
  var inputEl = document.getElementById('newComment_' + postId);
  if (!inputEl) return;
  var content = (inputEl.value || '').trim();

  if (!content) { showToast('⚠️ 댓글 내용을 입력해주세요'); return; }
  if (content.length > 500) { showToast('⚠️ 댓글은 500자 이하로'); return; }

  var user = currentUser || {};
  if (!user.name || !user.role) { showToast('⚠️ 로그인 정보를 확인해주세요'); return; }

  var comment = {
    post_id:     postId,
    author_id:   user.id,
    author_name: user.name,
    author_role: user.role,
    content:     content
  };

  // 이미지 첨부 있으면 업로드 후 저장
  var imgFile = _loungeCommentImages[postId] || null;
  var uploadP = imgFile ? uploadBoardImage(imgFile, 'comments') : Promise.resolve(null);

  uploadP
    .then(function(imageUrl) {
      if (imageUrl) comment.image_url = imageUrl;
      return supaFetch('madi_lounge_comments', 'POST', comment);
    })
    .then(function() {
      inputEl.value = '';
      delete _loungeCommentImages[postId];
      loadComments(postId);
    })
    .catch(function(err) {
      showToast('⚠️ 댓글 등록 실패: ' + (err.message || ''));
    });
}

function deleteComment(postId, commentId) {
  showConfirm('이 댓글을 삭제하시겠습니까?', function() {
    supaFetch('madi_lounge_comments?id=eq.' + encodeURIComponent(commentId), 'DELETE')
      .then(function() {
        showToast('🗑️ 댓글이 삭제됐습니다');
        loadComments(postId);
      })
      .catch(function(err) {
        showToast('⚠️ 삭제 실패: ' + (err.message || ''));
      });
  });
}

// ═══════════════════════════════════════════════════════════
// 📚 자료실
// ═══════════════════════════════════════════════════════════
var _libraryFiles = []; // 자료 첨부 File 객체 배열 (최대 5개)

var LIBRARY_CATEGORIES = ['조음·음운', '언어발달', '유창성', '인지·학습', '부모교육', '평가도구', '기타'];

function renderLibrary() {
  var el = document.getElementById('bdLibraryContent');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>자료실을 불러오는 중...</p></div>';

  supaFetch('madi_lounge_posts?visibility=eq.resource&order=created_at.desc&limit=200', 'GET')
    .then(function(data) {
      _renderLibraryUI(data || []);
    })
    .catch(function(err) {
      el.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(err.message || '오류') + '</p></div>';
    });
}

function _renderLibraryUI(posts) {
  var el = document.getElementById('bdLibraryContent');
  if (!el) return;
  var user = currentUser || {};
  var canWrite = user.role === 'teacher' || user.role === 'admin' || user.role === 'superadmin';

  // 카테고리 필터 상태
  var activeCat = window._libActiveCat || '';

  var catHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">'
    + '<button onclick="setLibCat(\'\')" style="padding:5px 12px;border-radius:20px;border:2px solid '+(activeCat===''?'var(--mint)':'var(--border)')+';background:'+(activeCat===''?'var(--mint)':'var(--card)')+';color:'+(activeCat===''?'white':'var(--text2)')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">전체</button>'
    + LIBRARY_CATEGORIES.map(function(c) {
        return '<button onclick="setLibCat(\''+c+'\')" style="padding:5px 12px;border-radius:20px;border:2px solid '+(activeCat===c?'var(--mint)':'var(--border)')+';background:'+(activeCat===c?'var(--mint)':'var(--card)')+';color:'+(activeCat===c?'white':'var(--text2)')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">'+c+'</button>';
      }).join('')
    + '</div>';

  var formHtml = '';
  if (canWrite) {
    formHtml = '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-title"><div class="card-title-left">📤 자료 올리기</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:10px;">'
      + '<select id="libCategory" class="form-input" style="font-size:14px;">'
      + LIBRARY_CATEGORIES.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('')
      + '</select>'
      + '<input type="text" id="libTitle" class="form-input" placeholder="자료 제목 (필수)" maxlength="100">'
      + '<textarea id="libContent" class="form-input" placeholder="자료 설명 (선택)" rows="3" style="resize:vertical;font-family:inherit;"></textarea>'
      + '<div style="border:1.5px dashed #cbd5e1;border-radius:10px;padding:10px 12px;background:#f8fafc;">'
      + '<div style="font-size:12px;color:var(--text2);margin-bottom:6px;">📎 파일 첨부 (이미지·PDF, 최대 5개)</div>'
      + '<input type="file" id="libFileInput" accept="image/*,application/pdf" multiple style="font-size:12px;" onchange="onLibFilesChange(this)">'
      + '<div id="libFilePreview" style="margin-top:6px;"></div>'
      + '</div>'
      + '<button class="btn btn-primary" onclick="saveLibraryPost()" style="font-size:14px;">📚 자료 등록</button>'
      + '</div>'
      + '</div>';
  }

  var filtered = activeCat ? posts.filter(function(p){ return (p.note||'') === activeCat; }) : posts;

  var listHtml = '';
  if (!filtered.length) {
    listHtml = '<div class="empty"><div class="empty-icon">📭</div><p>등록된 자료가 없습니다.</p></div>';
  } else {
    listHtml = filtered.map(function(p) {
      var isMine = !!(user && p.author_id === user.id);
      var canDel = user.role === 'superadmin' || isMine;
      var imgs = p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [];
      var dt = p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '';
      var editBtn = isMine
        ? '<button onclick="editLibraryPost(\''+p.id+'\')" style="flex-shrink:0;padding:4px 10px;border-radius:6px;border:1px solid #38bdf8;background:#e0f2fe;color:#0c4a6e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✏️ 수정</button>'
        : '';
      var delBtn = canDel
        ? '<button onclick="deleteLibraryPost(\''+p.id+'\')" style="flex-shrink:0;padding:4px 10px;border-radius:6px;border:1px solid #ef4444;background:#fff;color:#ef4444;font-size:12px;cursor:pointer;font-family:inherit;">삭제</button>'
        : '';
      return '<div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid var(--border);">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">'
        + '<div style="min-width:0;flex:1;">'
        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">'
        + '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--mint2);color:var(--mint);font-weight:700;">' + escHtml(p.note||'기타') + '</span>'
        + '<span style="font-size:13px;font-weight:700;">' + escHtml(p.title||'') + '</span>'
        + '</div>'
        + (p.content ? '<div style="font-size:12px;color:var(--text2);margin-bottom:6px;white-space:pre-wrap;">' + escHtml(p.content) + '</div>' : '')
        + (imgs.length ? renderImageThumbs(imgs) : '')
        + '<div style="font-size:11px;color:var(--text2);margin-top:6px;">' + escHtml(p.author_name||'') + ' · ' + dt + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">' + editBtn + delBtn + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  el.innerHTML = '<div class="card"><div class="card-title"><div class="card-title-left">📚 자료실</div><span style="font-size:11px;color:var(--text2);">언어치료 자료 공유</span></div>'
    + catHtml + '</div>'
    + formHtml
    + '<div id="libPostList">' + listHtml + '</div>';
}

function setLibCat(cat) {
  window._libActiveCat = cat;
  renderLibrary();
}

function onLibFilesChange(input) {
  _libraryFiles = [];
  var preview = document.getElementById('libFilePreview');
  if (!input.files || !input.files.length) { if (preview) preview.innerHTML = ''; return; }
  var allowed  = ALLOWED_IMAGE_MIMES.concat(['application/pdf']);
  var MAX_LIB  = 10 * 1024 * 1024; // 10MB
  var files    = Array.prototype.slice.call(input.files, 0, 5);
  var rejected = [];
  files.forEach(function(f){
    if (allowed.indexOf(f.type) === -1) { rejected.push(f.name + ' (형식)'); return; }
    if (f.size > MAX_LIB)                { rejected.push(f.name + ' (10MB 초과)'); return; }
    _libraryFiles.push(f);
  });
  if (rejected.length > 0) {
    showToast('⚠️ 첨부 거부: ' + rejected.join(', '));
    if (_libraryFiles.length === 0) input.value = '';
  }
  if (preview) preview.innerHTML = _libraryFiles.map(function(f){ return '<div style="font-size:12px;color:var(--text2);">📄 '+escHtml(f.name)+'</div>'; }).join('');
}

function saveLibraryPost() {
  var titleEl   = document.getElementById('libTitle');
  var contentEl = document.getElementById('libContent');
  var catEl     = document.getElementById('libCategory');
  if (!titleEl || !titleEl.value.trim()) { showToast('⚠️ 자료 제목을 입력해주세요'); return; }

  var title   = titleEl.value.trim();
  var content = contentEl ? contentEl.value.trim() : '';
  var cat     = catEl ? catEl.value : '기타';
  var user    = currentUser || {};

  var uploadAll = _libraryFiles.length
    ? Promise.all(_libraryFiles.map(function(f){ return uploadBoardImage(f, 'posts'); })) // 'library'는 허용 폴더 아님
    : Promise.resolve([]);

  showToast('⏳ 자료 등록 중...');
  uploadAll.then(function(urls) {
    var post = {
      id:          Date.now() + Math.floor(Math.random()*1000),
      center_id:   user.center_id || null,
      visibility:  'resource',
      title:       title,
      content:     content,
      note:        cat,
      author_id:   user.id,
      author_name: user.name || user.username,
      images:      JSON.stringify(urls)
    };
    return supaFetch('madi_lounge_posts', 'POST', post);
  }).then(function() {
    _libraryFiles = [];
    showToast('✅ 자료가 등록됐습니다');
    renderLibrary();
  }).catch(function(err) {
    showToast('⚠️ 등록 실패: ' + (err.message || ''));
  });
}

function deleteLibraryPost(id) {
  showConfirm('이 자료를 삭제할까요?', function() {
    supaFetch('madi_lounge_posts?id=eq.' + encodeURIComponent(id), 'DELETE')
      .then(function() { showToast('🗑️ 자료 삭제됨'); renderLibrary(); })
      .catch(function(err) { showToast('❌ 삭제 실패 — 다시 시도해주세요'); });
  });
}

// ═══════════════════════════════════════════════════════════
// ✏️ 글 수정 — 4개 게시판 공통
// ═══════════════════════════════════════════════════════════
// 정책 (사용자 결정 2026-05-21):
//  - 본인(author_id === currentUser.id) 만 수정 가능
//  - 텍스트만 수정 (제목·본문·종류/카테고리). 첨부 이미지는 그대로 유지
//  - visibility 는 변경 안 함 (보안·라우팅 혼란 방지)

function _isMyPost(post) {
  if (!currentUser || !post || !post.author_id) return false;
  return post.author_id === currentUser.id;
}

// 공통 글 수정 모달
// opts: {
//   header:         '✏️ 마디 공지 수정',           // 모달 상단 타이틀
//   currentTitle:   string,
//   currentContent: string,
//   selectField:    { label, current, options:[{value,label}] } | null,
//   noteHint:       '첨부는 그대로 유지됩니다',      // 안내 문구 (옵션)
//   maxTitle:       200,
//   onSave:         function(values, closeFn)       // values: { title, content, selectValue }
// }
function openPostEditModal(opts) {
  opts = opts || {};
  var existing = document.getElementById('postEditModal');
  if (existing) existing.remove();

  var maxTitle = opts.maxTitle || 200;

  var selectHtml = '';
  if (opts.selectField && opts.selectField.options && opts.selectField.options.length > 0) {
    var optsHtml = opts.selectField.options.map(function(o) {
      var sel = (String(o.value) === String(opts.selectField.current)) ? ' selected' : '';
      return '<option value="' + escHtml(String(o.value)) + '"' + sel + '>' + escHtml(o.label) + '</option>';
    }).join('');
    selectHtml =
        '<label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin:10px 0 4px;">' + escHtml(opts.selectField.label || '종류') + '</label>'
      + '<select id="peSelect" class="form-input" style="font-size:13px;padding:8px;width:100%;box-sizing:border-box;">' + optsHtml + '</select>';
  }

  var hintHtml = opts.noteHint
    ? '<div style="font-size:11px;color:#64748b;background:#f1f5f9;border-radius:6px;padding:6px 10px;margin-top:10px;">ℹ️ ' + escHtml(opts.noteHint) + '</div>'
    : '';

  var overlay = document.createElement('div');
  overlay.id = 'postEditModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
      '<div style="background:white;border-radius:14px;width:100%;max-width:520px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.25);overflow:hidden;">'
    +   '<div style="padding:16px 22px;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#1e293b;">' + escHtml(opts.header || '✏️ 글 수정') + '</div>'
    +   '<div style="padding:18px 22px;overflow-y:auto;flex:1;">'
    +     '<label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">제목</label>'
    +     '<input id="peTitle" class="form-input" maxlength="' + maxTitle + '" style="font-size:14px;padding:8px;width:100%;box-sizing:border-box;">'
    +     selectHtml
    +     '<label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin:10px 0 4px;">본문</label>'
    +     '<textarea id="peContent" class="form-input" rows="6" style="font-size:13px;padding:8px;width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>'
    +     hintHtml
    +     '<div id="peError" style="font-size:12px;color:#ef4444;margin-top:8px;min-height:14px;word-break:break-word;"></div>'
    +   '</div>'
    +   '<div style="padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:8px;">'
    +     '<button id="peCancel" style="padding:9px 18px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#475569;font-size:13px;font-weight:600;cursor:pointer;">취소</button>'
    +     '<button id="peSave" style="padding:9px 18px;border:none;border-radius:8px;background:#0ea5a0;color:white;font-size:13px;font-weight:700;cursor:pointer;">💾 저장</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(overlay);
  // 값 채우기는 createElement 후에 .value 로 — escHtml 한 문자열을 value 에 직접 넣지 않기 위함
  var titleEl   = document.getElementById('peTitle');
  var contentEl = document.getElementById('peContent');
  if (titleEl)   titleEl.value   = opts.currentTitle   || '';
  if (contentEl) contentEl.value = opts.currentContent || '';
  setTimeout(function(){ if (titleEl) titleEl.focus(); }, 50);

  function _close() {
    overlay.remove();
    document.removeEventListener('keydown', _onKey);
  }
  function _onKey(e) { if (e.key === 'Escape') _close(); }

  document.getElementById('peCancel').addEventListener('click', _close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) _close(); });
  document.addEventListener('keydown', _onKey);

  document.getElementById('peSave').addEventListener('click', function() {
    var errEl  = document.getElementById('peError');
    errEl.textContent = '';
    var title    = (titleEl.value || '').trim();
    var content  = (contentEl.value || '').trim();
    var selEl    = document.getElementById('peSelect');
    var selValue = selEl ? selEl.value : null;
    if (!title)                  { errEl.textContent = '제목을 입력해 주세요.'; return; }
    if (!content)                { errEl.textContent = '본문을 입력해 주세요.'; return; }
    if (title.length > maxTitle) { errEl.textContent = '제목은 ' + maxTitle + '자 이하로 작성해 주세요.'; return; }
    if (typeof opts.onSave === 'function') {
      opts.onSave({ title: title, content: content, selectValue: selValue }, _close);
    }
  });
}

var NOTICE_TYPE_OPTS = [
  { value: 'info', label: '📢 일반' },
  { value: 'pin',  label: '📍 중요 (상단 고정)' },
  { value: 'imp',  label: '🚨 긴급 (상단 고정)' }
];

// ── 마디 공지 수정 ──
function editGlobalNotice(id) {
  var n = (globalNoticesDB || []).find(function(x){ return String(x.id) === String(id); });
  if (!n) { showToast('⚠️ 글을 찾을 수 없습니다'); return; }
  if (!_isMyPost(n)) { showToast('❌ 본인이 작성한 글만 수정할 수 있습니다'); return; }
  openPostEditModal({
    header:         '✏️ 마디 공지 수정',
    currentTitle:   n.title || '',
    currentContent: n.content || '',
    selectField:    { label: '종류', current: n.notice_type || 'info', options: NOTICE_TYPE_OPTS },
    maxTitle:       200,
    onSave: function(v, close) {
      var ntype  = v.selectValue || 'info';
      var pinned = (ntype !== 'info');
      supaFetch('madi_global_notices?id=eq.' + encodeURIComponent(id), 'PATCH', {
        title:       v.title,
        content:     v.content,
        notice_type: ntype,
        pinned:      pinned
      })
        .then(function() { close(); showToast('✅ 수정됐습니다'); loadGlobalNotices(); })
        .catch(function(e) { showToast('❌ 수정 실패: ' + (e.message || '')); });
    }
  });
}

// ── 센터 공지 수정 ──
function editCenterNotice(id) {
  var n = (centerNoticesDB || []).find(function(x){ return String(x.id) === String(id); });
  if (!n) { showToast('⚠️ 글을 찾을 수 없습니다'); return; }
  if (!_isMyPost(n)) { showToast('❌ 본인이 작성한 글만 수정할 수 있습니다'); return; }
  openPostEditModal({
    header:         '✏️ 센터 공지 수정',
    currentTitle:   n.title || '',
    currentContent: n.content || '',
    selectField:    { label: '종류', current: n.notice_type || 'info', options: NOTICE_TYPE_OPTS },
    maxTitle:       200,
    onSave: function(v, close) {
      var ntype  = v.selectValue || 'info';
      var pinned = (ntype !== 'info');
      supaFetch('madi_notices?id=eq.' + encodeURIComponent(id), 'PATCH', {
        title:       v.title,
        content:     v.content,
        notice_type: ntype,
        pinned:      pinned
      })
        .then(function() { close(); showToast('✅ 수정됐습니다'); loadCenterNotices(); })
        .catch(function(e) { showToast('❌ 수정 실패: ' + (e.message || '')); });
    }
  });
}

// ── 고객센터(라운지) 수정 — visibility 는 변경 안 함 ──
function editLoungePost(id) {
  var p = (loungePostsDB || []).find(function(x){ return String(x.id) === String(id); });
  if (!p) { showToast('⚠️ 글을 찾을 수 없습니다'); return; }
  if (!_isMyPost(p)) { showToast('❌ 본인이 작성한 글만 수정할 수 있습니다'); return; }
  var hasImages = !!(p.image_urls && p.image_urls.length);
  openPostEditModal({
    header:         '✏️ 문의/건의 수정',
    currentTitle:   p.title || '',
    currentContent: p.content || '',
    noteHint:       hasImages ? '첨부 이미지는 그대로 유지됩니다 (텍스트만 수정 가능)' : '',
    maxTitle:       200,
    onSave: function(v, close) {
      supaFetch('madi_lounge_posts?id=eq.' + encodeURIComponent(id), 'PATCH', {
        title:   v.title,
        content: v.content
      })
        .then(function() { close(); showToast('✅ 수정됐습니다'); loadLoungePosts(); })
        .catch(function(e) { showToast('❌ 수정 실패: ' + (e.message || '')); });
    }
  });
}

// ── 자료실 수정 — note (카테고리) 도 함께 수정 ──
function editLibraryPost(id) {
  var p = (loungePostsDB || []).find(function(x){ return String(x.id) === String(id); });
  if (!p) { showToast('⚠️ 글을 찾을 수 없습니다'); return; }
  if (!_isMyPost(p)) { showToast('❌ 본인이 작성한 글만 수정할 수 있습니다'); return; }
  var hasFiles = !!(p.images && (typeof p.images === 'string' ? p.images.length > 2 : p.images.length));
  var catOptions = LIBRARY_CATEGORIES.map(function(c){ return { value: c, label: c }; });
  openPostEditModal({
    header:         '✏️ 자료 수정',
    currentTitle:   p.title || '',
    currentContent: p.content || '',
    selectField:    { label: '카테고리', current: p.note || LIBRARY_CATEGORIES[0], options: catOptions },
    noteHint:       hasFiles ? '첨부 파일은 그대로 유지됩니다 (텍스트만 수정 가능)' : '',
    maxTitle:       100,
    onSave: function(v, close) {
      supaFetch('madi_lounge_posts?id=eq.' + encodeURIComponent(id), 'PATCH', {
        title:   v.title,
        content: v.content,
        note:    v.selectValue || (p.note || '')
      })
        .then(function() { close(); showToast('✅ 수정됐습니다'); renderLibrary(); })
        .catch(function(e) { showToast('❌ 수정 실패: ' + (e.message || '')); });
    }
  });
}
