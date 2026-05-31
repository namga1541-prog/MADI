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
      var _uploadJwt = (typeof getToken === 'function') ? getToken() : '';
      var _uploadHeaders = { 'Content-Type': 'application/json' };
      if (_uploadJwt) _uploadHeaders['Authorization'] = 'Bearer ' + _uploadJwt;
      fetch(EDGE_URL + '/upload-image', {
        method:      'POST',
        credentials: 'include',
        headers:     _uploadHeaders,
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

// URL 프로토콜 화이트리스트 검증 (javascript: 등 위험 프로토콜 차단)
function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  var lower = url.trim().toLowerCase();
  return lower.indexOf('https://') === 0 || lower.indexOf('/') === 0;
}

// 이미지 URL 배열을 가로 스크롤 썸네일로 렌더
function renderImageThumbs(urls) {
  if (!urls || urls.length === 0) return '';
  return '<div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0;margin-top:6px;-webkit-overflow-scrolling:touch;">'
    + urls.map(function(url) {
        if (!isSafeUrl(url)) return '';
        var safeUrl = escHtml(url);
        return '<a href="' + safeUrl + '" target="_blank" rel="noopener" style="flex-shrink:0;">'
          + '<img src="' + safeUrl + '" alt="첨부 이미지" loading="lazy" '
          + 'style="height:110px;width:auto;max-width:180px;border-radius:8px;object-fit:cover;border:1px solid var(--border);" '
          + 'onerror="this.remove()">'
          + '</a>';
      }).join('')
    + '</div>';
}

// ─────── board-images 서명 URL 통합 ───────
// 버킷 비공개 전환 대비. public/서명 URL 또는 경로에서 'board-images/' 이후
// 경로(<folder>/<uuid>.<ext>)만 추출 — 쿼리스트링 제거. board-images 가 아니면 ''.
function _boardImgPath(url) {
  if (!url || typeof url !== 'string') return '';
  var marker = 'board-images/';
  var idx = url.indexOf(marker);
  if (idx === -1) return '';
  var rest = url.slice(idx + marker.length);
  // 쿼리스트링·프래그먼트 제거
  var q = rest.indexOf('?');
  if (q !== -1) rest = rest.slice(0, q);
  var h = rest.indexOf('#');
  if (h !== -1) rest = rest.slice(0, h);
  return rest;
}

// 입력 URL/경로 배열에서 board-images 경로만 모아 서명 URL 발급 요청.
// cb(mapFn) 형태로 콜백 — mapFn(originalUrl) 은 "서명 URL 있으면 서명, 없으면
// originalUrl 그대로(폴백)". board-images 가 아닌 외부 URL 은 그대로 통과.
// ★ 무중단 원칙: 서명 실패·미응답 경로는 반드시 원본 public URL 유지.
function signBoardImages(urlsOrPaths, cb) {
  function _noopMap(u) { return u; }
  if (typeof cb !== 'function') return;
  var list = urlsOrPaths || [];
  var paths = [];
  var i, p;
  for (i = 0; i < list.length; i++) {
    p = _boardImgPath(list[i]);
    if (p && paths.indexOf(p) === -1) paths.push(p);
  }
  // board-images 경로가 하나도 없으면 서명 불필요 — 원본 그대로
  if (paths.length === 0) { cb(_noopMap); return; }

  supaFetch('__sign_board_images__', 'POST', { paths: paths })
    .then(function(resp) {
      var urls = (resp && resp.urls) ? resp.urls : {};
      cb(function _mapFn(originalUrl) {
        var path = _boardImgPath(originalUrl);
        // board-images 아니면 원본(외부 URL) 그대로 통과
        if (!path) return originalUrl;
        var signed = urls[path];
        // 서명 URL 있으면 교체, 없으면 원본 유지 (폴백)
        return (signed && typeof signed === 'string') ? signed : originalUrl;
      });
    })
    .catch(function() {
      // 네트워크 실패 등 — 전부 원본 유지
      cb(_noopMap);
    });
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
    // eslint-disable-next-line no-unsanitized/property
    previewEl.innerHTML = files.map(function(f, i) {
      var url = URL.createObjectURL(f);
      return '<div style="position:relative;display:inline-block;">'
        + '<img src="' + escHtml(url) + '" style="height:80px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">'
        + '<button type="button" onclick="removeLoungeImage(' + escHtml(String(i)) + ')" '
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
    // eslint-disable-next-line no-unsanitized/property
    previewEl.innerHTML = _loungePostImages.map(function(f, i) {
      var url = URL.createObjectURL(f);
      return '<div style="position:relative;display:inline-block;">'
        + '<img src="' + escHtml(url) + '" style="height:80px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">'
        + '<button type="button" onclick="removeLoungeImage(' + escHtml(String(i)) + ')" '
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

  // eslint-disable-next-line no-unsanitized/property
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
  var _safeGNId = escHtml(String(n.id));
  var editBtn = _isMyPost(n)
    ? '<button onclick="editGlobalNotice(\'' + _safeGNId + '\')" style="padding:5px 10px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0c4a6e;border:1px solid #38bdf8;border-radius:6px;cursor:pointer;">✏️ 수정</button>'
    : '';
  if (isSuperAdmin) {
    var togglLabel = n.show_as_login_popup ? '🔕 팝업 해제' : '🔔 팝업으로 표시';
    var togglBg    = n.show_as_login_popup ? '#fef9c3' : '#f1f5f9';
    var togglCol   = n.show_as_login_popup ? '#854d0e' : '#475569';
    adminBtns =
        editBtn
      + '<button onclick="togglePopupNotice(\'' + _safeGNId + '\',' + (n.show_as_login_popup ? 'true' : 'false') + ')" '
      +   'style="padding:5px 10px;font-size:11px;font-weight:700;background:' + togglBg + ';color:' + togglCol + ';border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;">'
      +   togglLabel
      + '</button>'
      + '<button class="btn-del" style="padding:5px 10px;font-size:11px;" onclick="deleteGlobalNotice(\'' + _safeGNId + '\')">삭제</button>';
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
  // superadmin: 필터 없음 (모든 센터)
  // admin/teacher: 자기 센터만 (RLS 이중 방어)
  if (!currentUser) return;
  var query = 'madi_notices?order=pinned.desc,created_at.desc&limit=100';
  if (currentUser.role !== 'superadmin') {
    if (!currentUser.center_id) {
      var c = document.getElementById('bdCenterList');
      if (c) c.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>센터 정보가 없어 공지를 불러올 수 없습니다.</p></div>';
      return;
    }
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

  // eslint-disable-next-line no-unsanitized/property
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
  var _safeCNId = escHtml(String(n.id));
  var editBtn = _isMyPost(n)
    ? '<button onclick="editCenterNotice(\'' + _safeCNId + '\')" style="padding:5px 10px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0c4a6e;border:1px solid #38bdf8;border-radius:6px;cursor:pointer;">✏️ 수정</button>'
    : '';
  var deleteBtn = isAdminOrSuper
    ? '<button class="btn-del" style="padding:5px 10px;font-size:11px;" onclick="deleteCenterNotice(\'' + _safeCNId + '\')">삭제</button>'
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
  // superadmin: 모든 글 삭제 허용
  // admin: 본인이 작성한 글만 삭제 허용
  if (currentUser.role === 'admin') {
    var target = (centerNoticesDB || []).filter(function(n) { return String(n.id) === String(id); })[0];
    if (!target) { showToast('❌ 공지를 찾을 수 없습니다'); return; }
    if (!_isMyPost(target)) { showToast('❌ 본인이 작성한 공지만 삭제할 수 있습니다'); return; }
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

