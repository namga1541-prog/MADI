/* ───────────────────────────────────────────────────────────
   madi-board.js — 게시판 후반부
   - 라운지(고객센터)
   - 자료실
   - 편집 모달 (openPostEditModal 및 4개 editXxx)

   분리 사유: madi-board-notice.js 가 1,375 라인으로 비대 → 공지(global/center)
   는 madi-board-notice.js 에 유지, 게시판·자료실은 본 파일로 분리.
   동일 글로벌 스코프(defer 로드)이므로 함수 참조는 분리 전과 동일.
   ─────────────────────────────────────────────────────────── */

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

// 라운지 글 목록의 image_urls[] 를 서명 URL 로 일괄 치환(폴백 유지) 후 done()
function _signLoungePostImages(posts, done) {
  if (typeof signBoardImages !== 'function') { done(); return; }
  var all = [];
  (posts || []).forEach(function(p) {
    if (p && p.image_urls && p.image_urls.length) {
      p.image_urls.forEach(function(u) { all.push(u); });
    }
  });
  if (all.length === 0) { done(); return; }
  signBoardImages(all, function(mapFn) {
    (posts || []).forEach(function(p) {
      if (p && p.image_urls && p.image_urls.length) {
        p.image_urls = p.image_urls.map(mapFn);
      }
    });
    done();
  });
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
      // board-images 표시 URL 을 서명 URL 로 치환(폴백 유지) 후 렌더
      _signLoungePostImages(loungePostsDB, function() {
        if (gen !== _boardLoadGen) return;
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
      });
    })
    .catch(function(err) {
      showToast('⚠️ 게시물 로드 실패');
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
      +   '<textarea id="loungeContent" class="form-input" placeholder="건의 내용을 자세히 적어주세요..." rows="5" maxlength="3000" style="resize:vertical;font-family:inherit;margin-bottom:0;"></textarea>'
      + '</div>'
      + '<div style="border:1.5px dashed var(--border,#cbd5e1);border-radius:10px;padding:10px 12px;background:var(--bg,#f8fafc);">'
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

  // eslint-disable-next-line no-unsanitized/property
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
  } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }

  var editBtn = isMine
    ? '<button class="btn-ghost" style="font-size:11px;color:#0c4a6e;border-color:#38bdf8;padding:4px 10px;flex-shrink:0;" onclick="editLoungePost(\'' + jsArg(String(post.id)) + '\')">✏️ 수정</button>'
    : '';
  var deleteBtn = canDelete
    ? '<button class="btn-ghost" style="font-size:11px;color:#ef4444;border-color:#ef4444;padding:4px 10px;flex-shrink:0;" onclick="deleteLoungePost(\'' + jsArg(String(post.id)) + '\')">삭제</button>'
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
    +   '<button class="btn-ghost" style="font-size:12px;padding:5px 12px;color:' + toColor + ';border-color:' + toColor + ';" onclick="toggleComments(\'' + jsArg(String(post.id)) + '\')">💬 답변 <span id="commentCount_' + escHtml(String(post.id)) + '"></span></button>'
    +   '<div id="commentArea_' + escHtml(String(post.id)) + '" style="display:none;margin-top:10px;"></div>'
    + '</div>'
    + '</div>';
}

function saveLoungePost() {
  if (currentUser && currentUser.role === 'parent') { showToast('⚠️ 접근 권한이 없습니다.'); return; }
  var visEl     = document.getElementById('loungeVisibility');
  var titleEl   = document.getElementById('loungeTitle');
  var contentEl = document.getElementById('loungeContent');
  if (!visEl || !titleEl || !contentEl) { showToast('⚠️ 페이지를 새로고침 후 다시 시도해주세요'); return; }

  var visibility = visEl.value;
  var title      = (titleEl.value || '').trim();
  var content    = (contentEl.value || '').trim();

  if (!title)               { showToast('⚠️ 제목을 입력해주세요'); return; }
  if (title.length > 100)   { showToast('⚠️ 제목은 100자 이하로 작성해주세요'); return; }
  if (content.length > 3000) { showToast('⚠️ 본문은 3000자 이하로 작성해주세요 (' + content.length + '/3000)'); return; }

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
      showToast('⚠️ ' + _userErrMsg(err, '등록'));
      if (btn) { btn.disabled = false; btn.textContent = '📨 건의 보내기'; }
    });
}

function deleteLoungePost(id) {
  var _lu = currentUser || {};
  if (!_lu.id) { showToast('⚠️ 로그인이 필요합니다'); return; }
  var post = (loungePostsDB || []).find(function(x) { return String(x.id) === String(id); });
  if (post && _lu.role !== 'superadmin' && String(post.author_id) !== String(_lu.id)) {
    showToast('⚠️ 본인 글만 삭제할 수 있습니다');
    return;
  }
  showConfirm('이 글을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.', function() {
    supaFetch('madi_lounge_posts?id=eq.' + encodeURIComponent(id), 'DELETE')
      .then(function() {
        showToast('🗑️ 글이 삭제됐습니다');
        loadLoungePosts();
      })
      .catch(function(err) {
        showToast('⚠️ ' + _userErrMsg(err, '삭제'));
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

  supaFetch('madi_lounge_comments?post_id=eq.' + encodeURIComponent(postId) + '&select=*&order=created_at.asc', 'GET')
    .then(function(data) {
      loungeCommentsCache[postId] = data || [];
      // 댓글 첨부 이미지(c.image_url)를 서명 URL 로 치환(폴백 유지) 후 렌더
      var _cs = loungeCommentsCache[postId];
      var _curls = [];
      _cs.forEach(function(c) { if (c && c.image_url) _curls.push(c.image_url); });
      if (typeof signBoardImages === 'function' && _curls.length > 0) {
        signBoardImages(_curls, function(mapFn) {
          _cs.forEach(function(c) { if (c && c.image_url) c.image_url = mapFn(c.image_url); });
          renderComments(postId);
        });
      } else {
        renderComments(postId);
      }
    })
    .catch(function(err) {
      showToast('⚠️ 댓글 로드 실패');
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
          + (canDelete ? '<button class="btn-ghost" style="font-size:10px;color:#ef4444;border-color:#ef4444;padding:2px 8px;" onclick="deleteComment(\'' + jsArg(String(postId)) + '\',\'' + jsArg(String(c.id)) + '\')">🗑️</button>' : '')
          + '</div>'
          + '<div style="font-size:13px;color:var(--text);line-height:1.55;white-space:pre-wrap;word-break:break-word;">' + escHtml(c.content) + '</div>'
        + (c.image_url && /^https?:\/\//.test(c.image_url) ? '<a href="' + escHtml(c.image_url) + '" target="_blank" rel="noopener">'
          + '<img src="' + escHtml(c.image_url) + '" loading="lazy" '
          + 'style="margin-top:6px;max-height:120px;max-width:100%;border-radius:8px;" '
          + 'onerror="this.remove()"></a>' : '')
          + '</div>';
      }).join('');

  // 작성 폼
  var formHtml = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">'
    + '<div style="display:flex;gap:6px;">'
    + '<input type="text" id="newComment_' + postId + '" class="form-input" placeholder="댓글을 입력하세요..." style="flex:1;font-size:13px;" onkeydown="if(event.key===\'Enter\'&&!event.isComposing) saveComment(\'' + jsArg(String(postId)) + '\')">'
    + '<button class="btn btn-primary" style="margin-top:0;font-size:13px;padding:8px 14px;white-space:nowrap;" onclick="saveComment(\'' + jsArg(String(postId)) + '\')">📝 등록</button>'
    + '</div>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);cursor:pointer;">'
    + '📎 이미지 <input type="file" accept="image/*" style="font-size:11px;" onchange="onCommentImageChange(\'' + jsArg(String(postId)) + '\',this)"></label>'
    + '</div>';

  // eslint-disable-next-line no-unsanitized/property
  area.innerHTML = listHtml + formHtml;
}

function saveComment(postId) {
  if (currentUser && currentUser.role === 'parent') { showToast('⚠️ 접근 권한이 없습니다.'); return; }
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
    center_id:   currentUser.center_id,
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
      showToast('⚠️ ' + _userErrMsg(err, '댓글 등록'));
    });
}

function deleteComment(postId, commentId) {
  var _cu = currentUser || {};
  if (!_cu.id) { showToast('⚠️ 로그인이 필요합니다'); return; }
  var comments = (loungeCommentsCache[postId] || []);
  var comment = comments.find(function(c) { return String(c.id) === String(commentId); });
  if (comment && _cu.role !== 'superadmin' && String(comment.author_id) !== String(_cu.id)) {
    showToast('⚠️ 본인 댓글만 삭제할 수 있습니다');
    return;
  }
  showConfirm('이 댓글을 삭제하시겠습니까?', function() {
    supaFetch('madi_lounge_comments?id=eq.' + encodeURIComponent(commentId), 'DELETE')
      .then(function() {
        showToast('🗑️ 댓글이 삭제됐습니다');
        loadComments(postId);
      })
      .catch(function(err) {
        showToast('⚠️ ' + _userErrMsg(err, '삭제'));
      });
  });
}

// ═══════════════════════════════════════════════════════════
// 📚 자료실
// ═══════════════════════════════════════════════════════════
var _libraryFiles = []; // 자료 첨부 File 객체 배열 (최대 5개)
var libraryPostsDB = []; // 자료실 데이터 캐시 (editLibraryPost에서 참조)

var LIBRARY_CATEGORIES = ['조음·음운', '언어발달', '유창성', '인지·학습', '부모교육', '평가도구', '기타'];

function renderLibrary() {
  var el = document.getElementById('bdLibraryContent');
  if (!el) return;
  // superadmin이 아닌 경우 center_id 없으면 안전 차단
  if (!currentUser) return;
  if (currentUser.role !== 'superadmin' && !currentUser.center_id) {
    el.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ 센터 정보가 없어 자료실을 불러올 수 없습니다.</p></div>';
    return;
  }
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>자료실을 불러오는 중...</p></div>';

  // superadmin: 전체 센터 조회, admin/teacher: 자기 센터만 (RLS 이중 방어)
  var _libPath = 'madi_lounge_posts?visibility=eq.resource&order=created_at.desc&limit=200';
  if (currentUser.role !== 'superadmin') {
    _libPath += '&center_id=eq.' + encodeURIComponent(currentUser.center_id);
  }

  supaFetch(_libPath, 'GET')
    .then(function(data) {
      libraryPostsDB = data || [];
      // 자료실 첨부 이미지(p.images[])를 서명 URL 로 치환(폴백 유지) 후 렌더
      _signLibraryImages(libraryPostsDB, function() {
        _renderLibraryUI(libraryPostsDB);
      });
    })
    .catch(function(err) {
      el.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(_userErrMsg(err, '자료실 로드')) + '</p></div>';
    });
}

// 자료실 글의 images(문자열 JSON 또는 배열)를 정규화 후 서명 URL 로 치환(폴백 유지)
function _signLibraryImages(posts, done) {
  if (typeof signBoardImages !== 'function') { done(); return; }
  var all = [];
  (posts || []).forEach(function(p) {
    if (!p) return;
    var imgs = p.images;
    if (typeof imgs === 'string') {
      try { imgs = JSON.parse(imgs); } catch (e) { imgs = []; }
    }
    if (!Array.isArray(imgs)) imgs = [];
    // 정규화한 배열을 다시 보관 — 렌더부와 일관성 유지
    p.images = imgs;
    imgs.forEach(function(u) { all.push(u); });
  });
  if (all.length === 0) { done(); return; }
  signBoardImages(all, function(mapFn) {
    (posts || []).forEach(function(p) {
      if (p && Array.isArray(p.images) && p.images.length) {
        p.images = p.images.map(mapFn);
      }
    });
    done();
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
        return '<button onclick="setLibCat(\''+jsArg(c).replace(/'/g, '&#39;')+'\')" style="padding:5px 12px;border-radius:20px;border:2px solid '+(activeCat===c?'var(--mint)':'var(--border)')+';background:'+(activeCat===c?'var(--mint)':'var(--card)')+';color:'+(activeCat===c?'white':'var(--text2)')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">'+escHtml(c)+'</button>';
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
      + '<div style="border:1.5px dashed var(--border,#cbd5e1);border-radius:10px;padding:10px 12px;background:var(--bg,#f8fafc);">'
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
      var imgs = [];
      if (p.images) {
        if (typeof p.images === 'string') {
          try { imgs = JSON.parse(p.images); } catch (e) { imgs = []; }
        } else {
          imgs = p.images;
        }
        if (!Array.isArray(imgs)) imgs = [];
      }
      var dt = p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '';
      var editBtn = isMine
        ? '<button onclick="editLibraryPost(\''+jsArg(String(p.id))+'\')" style="flex-shrink:0;padding:4px 10px;border-radius:6px;border:1px solid #38bdf8;background:#e0f2fe;color:#0c4a6e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✏️ 수정</button>'
        : '';
      var delBtn = canDel
        ? '<button onclick="deleteLibraryPost(\''+jsArg(String(p.id))+'\')" style="flex-shrink:0;padding:4px 10px;border-radius:6px;border:1px solid #ef4444;background:#fff;color:#ef4444;font-size:12px;cursor:pointer;font-family:inherit;">삭제</button>'
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

  // eslint-disable-next-line no-unsanitized/property
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
  // eslint-disable-next-line no-unsanitized/property
  if (preview) preview.innerHTML = _libraryFiles.map(function(f){ return '<div style="font-size:12px;color:var(--text2);">📄 '+escHtml(f.name)+'</div>'; }).join('');
}

function saveLibraryPost() {
  var _su = currentUser || {};
  if (!_su.id || (_su.role !== 'admin' && _su.role !== 'teacher' && _su.role !== 'superadmin')) {
    showToast('⚠️ 권한이 없습니다'); return;
  }
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
    showToast('⚠️ ' + _userErrMsg(err, '등록'));
  });
}

function deleteLibraryPost(id) {
  if (!currentUser) { showToast('⚠️ 로그인이 필요합니다.'); return; }
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
    ? '<div style="font-size:11px;color:var(--text2,#64748b);background:var(--bg,#f1f5f9);border-radius:6px;padding:6px 10px;margin-top:10px;">ℹ️ ' + escHtml(opts.noteHint) + '</div>'
    : '';

  var overlay = document.createElement('div');
  overlay.id = 'postEditModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  // eslint-disable-next-line no-unsanitized/property
  overlay.innerHTML =
      '<div style="background:var(--card-bg,#fff);border-radius:14px;width:100%;max-width:520px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.25);overflow:hidden;">'
    +   '<div style="padding:16px 22px;border-bottom:1px solid var(--border,#e2e8f0);font-size:15px;font-weight:700;color:var(--text,#1e293b);">' + escHtml(opts.header || '✏️ 글 수정') + '</div>'
    +   '<div style="padding:18px 22px;overflow-y:auto;flex:1;">'
    +     '<label style="font-size:12px;font-weight:600;color:var(--text2,#64748b);display:block;margin-bottom:4px;">제목</label>'
    +     '<input id="peTitle" class="form-input" maxlength="' + maxTitle + '" style="font-size:14px;padding:8px;width:100%;box-sizing:border-box;">'
    +     selectHtml
    +     '<label style="font-size:12px;font-weight:600;color:var(--text2,#64748b);display:block;margin:10px 0 4px;">본문</label>'
    +     '<textarea id="peContent" class="form-input" rows="6" style="font-size:13px;padding:8px;width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>'
    +     hintHtml
    +     '<div id="peError" style="font-size:12px;color:#ef4444;margin-top:8px;min-height:14px;word-break:break-word;"></div>'
    +   '</div>'
    +   '<div style="padding:14px 20px;border-top:1px solid var(--border,#e2e8f0);background:var(--bg,#f8fafc);display:flex;justify-content:flex-end;gap:8px;">'
    +     '<button id="peCancel" style="padding:9px 18px;border:1px solid var(--border,#cbd5e1);border-radius:8px;background:var(--card-bg,#fff);color:var(--text2,#475569);font-size:13px;font-weight:600;cursor:pointer;">취소</button>'
    +     '<button id="peSave" style="padding:9px 18px;border:none;border-radius:8px;background:#0ea5a0;color:white;font-size:13px;font-weight:700;cursor:pointer;">💾 저장</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(overlay);
  // 값 채우기는 createElement 후에 .value 로 — escHtml 한 문자열을 value 에 직접 넣지 않기 위함
  var titleEl   = document.getElementById('peTitle');
  var contentEl = document.getElementById('peContent');
  var peCancel  = document.getElementById('peCancel');
  var peSave    = document.getElementById('peSave');
  var peError   = document.getElementById('peError');
  if (!peCancel || !peSave) { overlay.remove(); return; }
  if (titleEl)   titleEl.value   = opts.currentTitle   || '';
  if (contentEl) contentEl.value = opts.currentContent || '';
  setTimeout(function(){ if (titleEl) titleEl.focus(); }, 50);

  function _close() {
    overlay.remove();
    document.removeEventListener('keydown', _onKey);
  }
  function _onKey(e) { if (e.key === 'Escape') _close(); }

  peCancel.addEventListener('click', _close);

  // 드래그·클릭 오닫힘 방지
  // textarea에서 텍스트를 선택하다 overlay까지 끌면 mouseup이 overlay에서 발생해
  // click 이벤트가 overlay에 올라와 창이 닫히는 문제를 차단한다.
  // 방법: mousedown이 박스(inner dialog) 안에서 시작됐으면 overlay의 click을 무시.
  var _mouseDownOnOverlay = false;
  overlay.addEventListener('mousedown', function(e) {
    _mouseDownOnOverlay = (e.target === overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay && _mouseDownOnOverlay) _close();
  });
  document.addEventListener('keydown', _onKey);

  peSave.addEventListener('click', function() {
    var errEl  = peError || document.getElementById('peError');
    if (errEl) errEl.textContent = '';
    var title    = (titleEl.value || '').trim();
    var content  = (contentEl.value || '').trim();
    var selEl    = document.getElementById('peSelect');
    var selValue = selEl ? selEl.value : null;
    if (!title)                  { if (errEl) errEl.textContent = '제목을 입력해 주세요.'; return; }
    if (!content)                { if (errEl) errEl.textContent = '본문을 입력해 주세요.'; return; }
    if (title.length > maxTitle) { if (errEl) errEl.textContent = '제목은 ' + maxTitle + '자 이내입니다.'; return; }
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
        .catch(function(e) { showToast('❌ ' + _userErrMsg(e, '수정')); });
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
        .catch(function(e) { showToast('❌ ' + _userErrMsg(e, '수정')); });
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
        .catch(function(e) { showToast('❌ ' + _userErrMsg(e, '수정')); });
    }
  });
}

// ── 자료실 수정 — note (카테고리) 도 함께 수정 ──
function editLibraryPost(id) {
  var p = (libraryPostsDB || []).find(function(x){ return String(x.id) === String(id); });
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
        .catch(function(e) { showToast('❌ ' + _userErrMsg(e, '수정')); });
    }
  });
}

// ═══════════════════════════════════════════════════════════
// 📋 어휘/표현 오류 신고 (현장 SLP 피드백 채널)
// 제출 → madi_audit_log (action='vocab_feedback')
// superadmin 은 admin.html 에서 피드백 목록 조회 가능
// ═══════════════════════════════════════════════════════════

/**
 * 신고 모달 열기.
 * @param {string} [prefillWrong] - AI 보고서 텍스트에서 선택한 문구를 미리 채워 넣을 때 사용
 */
function openVocabFeedback(prefillWrong) {
  if (!currentUser) { showToast('⚠️ 로그인이 필요합니다'); return; }
  var modal = document.getElementById('vocabFeedbackModal');
  if (!modal) { showToast('⚠️ 페이지를 새로고침 후 다시 시도해주세요'); return; }

  // 폼 초기화
  var typeEl    = document.getElementById('vfType');
  var wrongEl   = document.getElementById('vfWrong');
  var correctEl = document.getElementById('vfCorrect');
  var contextEl = document.getElementById('vfContext');
  var btnEl     = document.getElementById('vfSubmitBtn');
  if (typeEl)    typeEl.selectedIndex = 0;
  if (wrongEl)   wrongEl.value   = prefillWrong || '';
  if (correctEl) correctEl.value = '';
  if (contextEl) contextEl.value = '';
  if (btnEl)     { btnEl.disabled = false; btnEl.textContent = '📨 신고 제출'; }

  modal.style.display = 'flex';
  if (typeof attachModalA11y === 'function') attachModalA11y(modal, closeVocabFeedbackModal);
  setTimeout(function() { if (wrongEl) wrongEl.focus(); }, 80);
}

function closeVocabFeedbackModal() {
  var modal = document.getElementById('vocabFeedbackModal');
  if (modal) modal.style.display = 'none';
}

function submitVocabFeedback() {
  var type    = (document.getElementById('vfType')    || {}).value || '';
  var wrong   = ((document.getElementById('vfWrong')   || {}).value || '').trim();
  var correct = ((document.getElementById('vfCorrect') || {}).value || '').trim();
  var context = ((document.getElementById('vfContext') || {}).value || '').trim();

  if (!wrong) {
    showToast('⚠️ 잘못된 표현을 입력해주세요');
    var el = document.getElementById('vfWrong'); if (el) el.focus();
    return;
  }
  if (wrong.length > 600) { showToast('⚠️ 600자 이내로 입력해주세요'); return; }

  var btn = document.getElementById('vfSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 제출 중...'; }

  var payload = {
    actor_id:     currentUser.id,
    actor_role:   currentUser.role,
    action:       'vocab_feedback',
    table_name:   'vocab',
    row_id:       null,
    center_id:    currentUser.center_id,
    child_id:     null,
    changed_cols: [JSON.stringify({ type: type, wrong: wrong, correct: correct, context: context })]
  };

  // Edge Function /api 가 vocab_feedback action 화이트리스트 처리 → 성공/실패 분기
  supaFetch('madi_audit_log', 'POST', [payload]).then(function() {
    closeVocabFeedbackModal();
    showToast('📝 접수되었습니다. 검토 후 어휘 사전에 반영됩니다.', { duration: 4000 });
  }).catch(function(err) {
    if (btn) { btn.disabled = false; btn.textContent = '제출'; }
    showToast('⚠️ 접수 실패 — 다시 시도해주세요');
    showError(err, '어휘 피드백 제출');
  });
}
