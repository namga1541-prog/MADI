// ─────── 권한 설정 모달 ───────
var _permUserId = null;
var _permData = {};

var PERM_LIST = [
  { key:'viewOtherChildren', icon:'👀', label:'다른 선생님 아동 조회',   desc:'같은 센터 내 다른 선생님이 담당하는 아동 목록을 볼 수 있어요.', active:true },
  { key:'deleteSession',     icon:'📋', label:'세션 기록 삭제',           desc:'작성한 세션 기록을 삭제할 수 있어요.', active:true },
  { key:'useAI',             icon:'🤖', label:'AI 기능 사용',             desc:'장단기계획(IEP) 생성, 포트폴리오, 부모 리포트 등 AI 분석 기능을 사용할 수 있어요.', active:true }
];

function openPermModal(userId, userName, role) {
  _permUserId = userId;
  supaFetch('madi_users?id=eq.' + userId + '&select=permissions').then(function(rows) {
    _permData = {};
    if (Array.isArray(rows) && rows[0] && rows[0].permissions) {
      try { _permData = typeof rows[0].permissions === 'object' ? rows[0].permissions : JSON.parse(rows[0].permissions); } catch(e){}
    }
    var isAdmin = role === 'admin';
    var overlay = document.createElement('div');
    overlay.className = 'sched-modal-overlay';
    overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
    var rows_html = PERM_LIST.map(function(p) {
      var allowed = isAdmin ? true : (_permData[p.key] !== false);
      var badgeHtml = p.active
        ? '<span style="font-size:9px;font-weight:700;color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 6px;border-radius:6px;margin-left:6px;vertical-align:middle;">✅ 적용 중</span>'
        : '<span style="font-size:9px;font-weight:700;color:#94a3b8;background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:6px;margin-left:6px;vertical-align:middle;">🚧 준비 중</span>';
      return '<div style="padding:14px 0;border-bottom:1px solid var(--border);">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span style="font-size:18px;width:24px;text-align:center;">' + p.icon + '</span>'
        + '<div style="flex:1;">'
        + '<div style="font-size:14px;font-weight:700;color:var(--navy);">' + p.label + badgeHtml + '</div>'
        + '<div style="font-size:12px;color:var(--text2);margin-top:2px;">' + p.desc + '</div>'
        + '</div>'
        + '<label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;">'
        + '<input type="checkbox" id="perm_' + p.key + '" ' + (allowed ? 'checked' : '') + (isAdmin ? ' disabled' : '')
        + ' onchange="updatePermToggle(this,\'' + p.key + '\')"'
        + ' style="opacity:0;width:0;height:0;">'
        + '<span id="permTrack_' + p.key + '" style="position:absolute;cursor:pointer;inset:0;border-radius:24px;background:' + (allowed ? 'var(--mint)' : '#cbd5e1') + ';transition:.2s;">'
        + '<span style="position:absolute;height:18px;width:18px;left:' + (allowed ? '22' : '3') + 'px;bottom:3px;background:white;border-radius:50%;transition:.2s;"></span>'
        + '</span></label>'
        + '</div></div>';
    }).join('');
    overlay.innerHTML = '<div class="sched-modal" style="max-height:85vh;overflow-y:auto;">'
      + '<div class="sched-modal-title">🔐 ' + escHtml(userName) + ' 선생님 권한 설정'
      + (isAdmin ? '<div style="font-size:11px;color:var(--mint);font-weight:400;margin-top:4px;">관리자 계정은 모든 권한이 자동으로 허용됩니다</div>' : '') + '</div>'
      + (isAdmin ? '' : '<div style="font-size:12px;color:var(--text2);background:var(--bg);border-radius:8px;padding:10px;margin-bottom:12px;">⚠️ 관리자 권한을 가진 계정은 이 설정과 무관하게 모든 기능을 사용할 수 있습니다.</div>')
      + rows_html
      + (isAdmin ? '' : '<div style="display:flex;gap:8px;margin-top:16px;">'
        + '<button class="btn-ghost" onclick="this.closest(\'.sched-modal-overlay\').remove()" style="flex:1;">취소</button>'
        + '<button class="btn-primary" onclick="savePermissions()" style="flex:1;">저장</button>'
        + '</div>')
      + (isAdmin ? '<button class="btn-ghost" onclick="this.closest(\'.sched-modal-overlay\').remove()" style="width:100%;margin-top:16px;">닫기</button>' : '')
      + '</div>';
    document.body.appendChild(overlay);
  }).catch(function() {
    showToast('⚠️ 권한 정보를 불러오지 못했습니다.');
  });
}

function updatePermToggle(el, key) {
  _permData[key] = el.checked;
  var track = document.getElementById('permTrack_' + key);
  if (track) {
    track.style.background = el.checked ? 'var(--mint)' : '#cbd5e1';
    var thumb = track.querySelector('span');
    if (thumb) thumb.style.left = el.checked ? '22px' : '3px';
  }
}

function savePermissions() {
  if (!_permUserId) return;
  supaFetch('madi_users?id=eq.' + _permUserId, 'PATCH', { permissions: _permData })
    .then(function() {
      showToast('✅ 권한 저장 완료');
      document.querySelector('.sched-modal-overlay').remove();
    }).catch(function() { showToast('❌ 저장 실패'); });
}

// ─────── 선생님 계정 관리 (관리자 전용) ───────
function renderStaffCard() {
  var card = document.getElementById('staffCard');
  var deployCard = document.getElementById('deployCard');
  if (!card) return;
  var isAdmin = currentUser && currentUser.role === 'admin';
  card.style.display = isAdmin ? 'block' : 'none';
  if (deployCard) deployCard.style.display = isAdmin ? 'block' : 'none';
  if (!isAdmin) return;
  supaFetch('madi_users?select=id,username,name,role,color&order=role.desc,name.asc')
    .then(function(users) {
      if (!Array.isArray(users)) return;
      var html = '';
      users.forEach(function(u) {
        var color = u.color || '#0ea5a0';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;">'
          + '<div style="width:34px;height:34px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;">' + u.name.slice(0,1) + '</div>'
          + '<div style="flex:1;"><div style="font-size:14px;font-weight:700;">' + escHtml(u.name) + '</div>'
          + '<div style="font-size:11px;color:var(--text2);">@' + escHtml(u.username) + ' · ' + (u.role==='admin'?'👑 관리자':'👩‍⚕️ 선생님') + '</div></div>'
          + (u.id !== currentUser.id
            ? '<div style="display:flex;gap:6px;">'
              + '<button class="btn-ghost" style="font-size:11px;padding:4px 8px;color:var(--mint);border-color:var(--mint);" onclick="openPermModal(\'' + u.id + '\',\'' + escHtml(u.name) + '\',\'' + u.role + '\')">\uad8c\ud55c</button>'
              + '<button class="btn-del" onclick="deleteStaff(\'' + u.id + '\',\'' + escHtml(u.name) + '\')">\uc0ad\uc81c</button>'
              + '</div>'
            : '<span style="font-size:11px;color:var(--mint);">나</span>')
          + '</div>';
      });
      document.getElementById('staffList').innerHTML = html || '<div style="font-size:13px;color:var(--text2);text-align:center;padding:12px;">등록된 계정 없음</div>';
    }).catch(function() {
      showToast('⚠️ 직원 목록을 불러오지 못했습니다.');
    });
}

function saveNewStaff(btn) {
  var modal    = btn.closest('.sched-modal-overlay');
  var name     = modal.querySelector('#newStaffName').value.trim();
  var username = modal.querySelector('#newStaffId').value.trim();
  var password = modal.querySelector('#newStaffPw').value.trim();
  var role     = modal.querySelector('#newStaffRole').value;
  var errEl    = modal.querySelector('#addStaffError');
  if (!name || !username || !password) { if(errEl) errEl.textContent = '모든 항목을 입력해주세요.'; return; }
  var color = TEACHER_COLORS[Math.floor(Math.random() * TEACHER_COLORS.length)];
  if (errEl) errEl.textContent = '';
  hashPassword(password).then(function(hashed) {
    return supaFetch('madi_users', 'POST', [{
      username: username, password: hashed, name: name,
      role: role, color: color, center_id: getCenterId()
    }]);
  }).then(function(r) {
    if (r && r[0] && r[0].id) {
      _teacherList = [];
      modal.remove();
      renderStaffCard();
      loadStaffMgmtList();
      showToast('✅ ' + escHtml(name) + ' 계정 추가 완료!');
    } else {
      if (errEl) errEl.textContent = '추가 실패 (아이디 중복일 수 있음)';
    }
  }).catch(function(e){ if(errEl) errEl.textContent = '서버 오류: ' + (e.message||''); });
}

function deleteStaff(id, name) {
  showDeleteConfirm(
    '이용자를 삭제하시겠습니까?',
    '데이터가 완전히 삭제되고 복구할 수 없음을 확인하였습니다.',
    '삭제확인',
    function() {
      supaFetch('madi_users?id=eq.' + id, 'DELETE').then(function() {
        _teacherList = [];
        renderStaffCard();
        showToast('🗑️ ' + name + ' 계정 삭제됨');
      }).catch(function() {
        showToast('❌ 계정 삭제에 실패했습니다. 다시 시도해주세요.');
      });
    }
  );
}

// ─────── Supabase Realtime 실시간 동기화 ───────
var _supaClient = null;
var _realtimeChannel = null;
var _reloadTimer = null;

function initRealtime() {
  try {
    if (typeof supabase === 'undefined' || !supabase.createClient) return;
    _supaClient = supabase.createClient(SUPA_URL, SUPA_REALTIME_KEY);
    subscribeRealtime();
  } catch(e) {
    console.warn('Realtime 초기화 실패:', e);
  }
}

function subscribeRealtime() {
  if (!_supaClient) return;
  if (_realtimeChannel) {
    _supaClient.removeChannel(_realtimeChannel);
  }
  _realtimeChannel = _supaClient
    .channel('madi-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'madi_children' },    onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'madi_sessions' },    onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'madi_schedules' },   onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'madi_assessments' }, onRemoteChange)
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime 연결됨');
      }
    });
}

function onRemoteChange(payload) {
  if (_myChangeTs && Date.now() < _myChangeTs + 2000) return;
  clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(function() {
    loadDBFromSupabase(true);
  }, 800);
}

var _myChangeTs = 0;
function markMyChange() { _myChangeTs = Date.now(); }

function stopRealtime() {
  if (_realtimeChannel && _supaClient) {
    _supaClient.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

// ─────── 마디 폴더 핸들 관리 (IndexedDB) ───────
function _openMadiDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('madi_deploy', 1);
    req.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function() { reject(req.error); };
  });
}
function _saveFolderHandle(handle) {
  return _openMadiDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'madiFolder');
      tx.oncomplete = resolve;
      tx.onerror = function() { reject(tx.error); };
    });
  });
}
function _loadFolderHandle() {
  return _openMadiDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction('handles', 'readonly');
      var req = tx.objectStore('handles').get('madiFolder');
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror = function() { resolve(null); };
    });
  });
}
function getMadiFolderHandle() {
  return _loadFolderHandle().then(function(handle) {
    if (!handle) {
      showToast('📁 마디 폴더를 선택해주세요');
      return window.showDirectoryPicker({ mode: 'read' })
        .then(function(h) { return _saveFolderHandle(h).then(function() { return h; }); });
    }
    return handle.queryPermission({ mode: 'read' }).then(function(perm) {
      if (perm === 'granted') return handle;
      return handle.requestPermission({ mode: 'read' }).then(function(p) {
        if (p === 'granted') return handle;
        showToast('📁 폴더 접근 권한이 필요합니다. 다시 선택해주세요');
        return window.showDirectoryPicker({ mode: 'read' })
          .then(function(h) { return _saveFolderHandle(h).then(function() { return h; }); });
      });
    });
  });
}

// ─────── GitHub 자동 배포 ───────
var GITHUB_OWNER = 'namga1541-prog';
var GITHUB_REPO  = 'MADI';
var GITHUB_FILE  = 'index.html';
var GITHUB_SW    = 'sw.js';

var _swNow = new Date();
var SW_BUILD = 'madi-v4-' + _swNow.toISOString().slice(0,10).replace(/-/g,'')
             + '-' + String(_swNow.getHours()).padStart(2,'0')
             + String(_swNow.getMinutes()).padStart(2,'0');
var SW_LINES = [
  'var CACHE_NAME = "' + SW_BUILD + '";',
  'var SKIP_URLS = ["api.anthropic.com","supabase.co","googleapis.com","cdnjs","jsdelivr","fonts.g"];',
  'self.addEventListener("install", function(e) { self.skipWaiting(); });',
  'self.addEventListener("activate", function(e) {',
  '  e.waitUntil(',
  '    caches.keys().then(function(keys) {',
  '      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));',
  '    }).then(function(){ return clients.claim(); })',
  '  );',
  '});',
  'self.addEventListener("fetch", function(e) {',
  '  var url = e.request.url;',
  '  if (SKIP_URLS.some(function(s){ return url.includes(s); })) return;',
  '  if (e.request.method !== "GET") return;',
  '  e.respondWith(',
  '    fetch(e.request).then(function(res) {',
  '      if (!res || res.status !== 200 || res.type === "opaque") return res;',
  '      var clone = res.clone();',
  '      caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });',
  '      return res;',
  '    }).catch(function() {',
  '      return caches.match(e.request);',
  '    })',
  '  );',
  '});'
];
var SW_CODE = SW_LINES.join(String.fromCharCode(10));

function getGithubToken() {
  return localStorage.getItem('madi_gh_token') || '';
}

function deployFileToGitHub(token, filename, textContent, commitMsg) {
  var apiBase = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + filename;
  var headers  = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
  var b64      = btoa(unescape(encodeURIComponent(textContent)));

  return fetch(apiBase, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(info) {
      var body = { message: commitMsg, content: b64 };
      if (info.sha) body.sha = info.sha;
      return fetch(apiBase, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.content && res.content.sha) return res;
      throw new Error(res.message || filename + ' 업로드 실패');
    });
}

// ─────── 배포 대상 파일 자동 스캔 ───────
// 폴더 핸들에서 madi-NN.js 패턴 자동 감지 → 자연 정렬 → madi.css는 마지막에
// 새 madi-XX.js 추가해도 자동 포함 (하드코딩 제거)
function scanMadiFiles(folderHandle) {
  var iterator = folderHandle.values();
  var jsFiles = [];
  var hasCss = false;
  function next() {
    return iterator.next().then(function(result) {
      if (result.done) return;
      var entry = result.value;
      if (entry.kind === 'file') {
        if (/^madi-\d+\.js$/.test(entry.name)) jsFiles.push(entry.name);
        else if (entry.name === 'madi.css') hasCss = true;
      }
      return next();
    });
  }
  return next().then(function() {
    // 자연 정렬: madi-01 < madi-02 < ... < madi-13
    jsFiles.sort(function(a, b) {
      var na = parseInt(a.match(/\d+/)[0], 10);
      var nb = parseInt(b.match(/\d+/)[0], 10);
      return na - nb;
    });
    if (hasCss) jsFiles.push('madi.css');
    return jsFiles;
  });
}

// ─────── 파일 내용 → Git blob SHA-1 계산 ───────
// GitHub의 blob SHA 알고리즘: SHA1('blob {size}\0{content}')
// 동일 SHA = 동일 내용 (mtime만 바뀌고 내용 같으면 같은 SHA)
function gitBlobSha(content) {
  var enc    = new TextEncoder();
  var body   = enc.encode(content);
  var header = enc.encode('blob ' + body.length + '\0');
  var data   = new Uint8Array(header.length + body.length);
  data.set(header, 0);
  data.set(body, header.length);
  return crypto.subtle.digest('SHA-1', data).then(function(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function(b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  });
}

// ─────── GitHub Pages 빌드 상태 폴링 ───────
// 배포 후 자동으로 빌드 진행 상황을 확인하여 사용자에게 알림
function pollGithubPagesBuild(token, deployStartTs) {
  var attempts    = 0;
  var MAX_TRY     = 30;     // 최대 30회 (5초 간격 = 약 2분 30초)
  var INTERVAL_MS = 5000;
  function poll() {
    return fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/pages/builds/latest', {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(build) {
      attempts++;
      var buildTs = build.created_at ? new Date(build.created_at).getTime() : 0;
      // 이번 배포 이후의 빌드인지 확인 (이전 빌드는 무시)
      if (buildTs < deployStartTs) {
        if (attempts >= MAX_TRY) { showToast('⏰ 빌드 시작 대기 시간 초과', { duration: 5000 }); return; }
        return new Promise(function(r){ setTimeout(r, INTERVAL_MS); }).then(poll);
      }
      if (build.status === 'built') {
        showToast('🌐 GitHub Pages 반영 완료! 새로고침하면 보입니다.', { duration: 7000 });
      } else if (build.status === 'errored') {
        var err = (build.error && build.error.message) || '알 수 없는 오류';
        showToast('❌ GitHub Pages 빌드 실패: ' + err, { duration: 9000 });
      } else {
        // queued, building → 계속 폴링
        if (attempts >= MAX_TRY) { showToast('⏰ 빌드 진행 중 — 잠시 후 사이트 확인', { duration: 5000 }); return; }
        return new Promise(function(r){ setTimeout(r, INTERVAL_MS); }).then(poll);
      }
    })
    .catch(function(e) {
      // 폴링 실패는 배포 자체 실패가 아니므로 조용히 한 번만 알림
      showToast('⚠️ 빌드 상태 확인 불가: ' + (e.message || '네트워크 오류'), { duration: 5000 });
    });
  }
  // 첫 폴링은 5초 후 (GitHub이 빌드 큐에 등록할 시간 확보)
  setTimeout(poll, 5000);
}

function deployToGitHub() {
  var token = getGithubToken();
  if (!token) {
    var t = prompt('GitHub Token을 입력하세요:\n(한 번 입력하면 저장됩니다)');
    if (!t) return;
    localStorage.setItem('madi_gh_token', t.trim());
    token = t.trim();
  }

  var btn = document.getElementById('headerDeployBtn');
  if (!btn) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled    = true;
  btn.textContent = '⏳ 배포 중...';

  var commitTime = new Date().toLocaleString('ko-KR');

  if (!window.showDirectoryPicker) {
    btn.dataset.busy = '';
    btn.disabled = false; btn.textContent = '🚀 배포';
    showToast('❌ Chrome 또는 Edge에서만 사용 가능합니다.');
    return;
  }

  // 배포 대상 파일은 폴더 스캔 + SHA 변경 감지로 동적 결정
  var JS_FILES, ALL_FILES, TOTAL_FILES, FILES_TO_UPLOAD;
  var deployStartTs = Date.now(); // GitHub Pages 빌드 폴링 기준 시각

  showToast('📡 배포 준비 중...');

  getMadiFolderHandle()
    .then(function(folderHandle) {
      return scanMadiFiles(folderHandle).then(function(jsFiles) {
        if (jsFiles.length === 0) throw new Error('madi-*.js 파일을 찾을 수 없습니다');
        JS_FILES  = jsFiles;
        ALL_FILES = ['index.html', 'admin.html'].concat(JS_FILES);

        // 각 파일의 내용 + SHA 동시 계산 (이전 SHA와 비교해 변경 판정)
        var lastDeployIso = localStorage.getItem('madi_last_deploy');
        var prevShas      = {};
        try { prevShas = JSON.parse(localStorage.getItem('madi_deploy_shas') || '{}') || {}; } catch(e) {}

        return Promise.all(ALL_FILES.map(function(name) {
          return folderHandle.getFileHandle(name)
            .then(function(fh) { return fh.getFile(); })
            .then(function(f) {
              return f.text().then(function(content) {
                return gitBlobSha(content).then(function(sha) {
                  return {
                    name:    name,
                    content: content,
                    sha:     sha,
                    changed: prevShas[name] !== sha
                  };
                });
              });
            })
            .catch(function() { return { name: name, content: null, sha: '', changed: false }; });
        })).then(function(fileInfos) {
          // 유효 파일 필터 + index.html 존재 검사
          var valid    = fileInfos.filter(function(f){ return f.content !== null; });
          var hasIndex = valid.some(function(f){ return f.name === 'index.html'; });
          if (!hasIndex) throw new Error('index.html 읽기 실패 — 폴더에 없거나 접근 불가');

          var changed     = valid.filter(function(f){ return f.changed; });
          var unchanged   = valid.filter(function(f){ return !f.changed; });
          var firstDeploy = !lastDeployIso;
          var NL          = String.fromCharCode(10);
          var lastText    = lastDeployIso
            ? '마지막 배포: ' + new Date(lastDeployIso).toLocaleString('ko-KR')
            : '마지막 배포: 기록 없음 (첫 배포)';

          // 업로드 대상 결정: 첫 배포 또는 변경 0건이면 전체, 아니면 변경분만
          var willUpload;
          if (firstDeploy) {
            willUpload = valid;
          } else if (changed.length === 0) {
            var msg = lastText + NL + NL
                    + '⏸️ 마지막 배포 이후 내용이 변경된 파일이 없습니다.' + NL
                    + '(SHA-1 해시 비교 — 저장만 했고 내용 동일한 파일은 자동 제외됨)' + NL + NL
                    + '그래도 ' + valid.length + '개 파일을 모두 배포하시겠습니까?';
            if (!confirm(msg)) throw new Error('USER_CANCEL');
            willUpload = valid;
          } else {
            willUpload = changed;
          }

          // 미리보기 다이얼로그
          var lines = [lastText, ''];
          lines.push('✏️ 배포 대상 ' + willUpload.length + '개:');
          willUpload.forEach(function(f, i) { lines.push('  ' + (i + 1) + '. ' + f.name); });
          var skipped = valid.length - willUpload.length;
          if (skipped > 0) {
            lines.push('');
            lines.push('⏸️ 미변경 ' + skipped + '개 (SHA 동일, 건너뜀):');
            unchanged.forEach(function(f) { lines.push('  · ' + f.name); });
          }
          lines.push('', '+ sw.js (자동 캐시 갱신)', '', '진행하시겠습니까?');
          if (!confirm(lines.join(NL))) throw new Error('USER_CANCEL');

          FILES_TO_UPLOAD = willUpload;
          TOTAL_FILES     = willUpload.length + 1;
          // 모든 파일의 SHA 맵 (다음 배포 시 비교용으로 유지)
          var allShas = {};
          valid.forEach(function(f){ allShas[f.name] = f.sha; });
          FILES_TO_UPLOAD.allShas = allShas;
          return willUpload;
        });
      });
    })
    .then(function(filesToUpload) {
      // 순차 업로드 (커밋 메시지는 파일 종류에 따라)
      var step = 1;
      return filesToUpload.reduce(function(chain, fi) {
        return chain.then(function() {
          showToast('📡 ' + fi.name + ' 업로드 중... (' + step + '/' + TOTAL_FILES + ')');
          step++;
          var msg;
          if (fi.name === 'index.html')      msg = '마디 앱 업데이트 — ' + commitTime;
          else if (fi.name === 'admin.html') msg = '마디 관리자 업데이트 — ' + commitTime;
          else if (fi.name === 'madi.css')   msg = '마디 CSS 업데이트 — ' + commitTime;
          else                                msg = '마디 JS 업데이트 — ' + commitTime;
          return deployFileToGitHub(token, fi.name, fi.content, msg);
        });
      }, Promise.resolve());
    })
    .then(function() {
      // sw.js는 항상 업로드 (캐시 갱신 보장)
      showToast('📡 sw.js 업로드 중... (' + TOTAL_FILES + '/' + TOTAL_FILES + ')');
      return deployFileToGitHub(token, GITHUB_SW, SW_CODE, '마디 SW 업데이트 — ' + commitTime);
    })
    .then(function() {
      btn.dataset.busy = '';
      btn.disabled    = false;
      btn.textContent = '🚀 배포';
      showToast('🚀 배포 완료! ' + (FILES_TO_UPLOAD.length + 1) + '개 파일 1~2분 후 반영됩니다.', { duration: 5000 });
      localStorage.setItem('madi_last_deploy', new Date().toISOString());
      // 다음 배포 시 SHA 비교를 위해 모든 파일의 SHA 저장 (변경되지 않은 파일도 포함)
      try {
        if (FILES_TO_UPLOAD.allShas) {
          localStorage.setItem('madi_deploy_shas', JSON.stringify(FILES_TO_UPLOAD.allShas));
        }
      } catch(e) {}
      // GitHub Pages 빌드 상태 자동 폴링 (5초 후 시작)
      pollGithubPagesBuild(token, deployStartTs);
    })
    .catch(function(e) {
      btn.dataset.busy = '';
      btn.disabled    = false;
      btn.textContent = '🚀 배포';
      if (e.message === 'USER_CANCEL') {
        showToast('배포 취소됨');
      } else if (e.message && e.message.includes('Bad credentials')) {
        localStorage.removeItem('madi_gh_token');
        showToast('❌ Token 오류 — 다시 눌러 재입력해주세요.');
      } else {
        showToast('❌ 배포 실패: ' + (e.message || '오류'));
      }
    });
}

function processImportFile(file) {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;

  var resultEl = document.getElementById('importResult');
  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>파일을 읽는 중...</p></div>';

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var wb   = XLSX.read(data, { type: 'array', cellDates: true });

      var allRows = [];
      wb.SheetNames.forEach(function(sheetName) {
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        allRows = allRows.concat(rows);
      });

      if (!allRows.length) {
        resultEl.innerHTML = '<div class="import-warning">⚠️ 파일에서 데이터를 찾을 수 없습니다.</div>';
        return;
      }

      resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>데이터 변환 중... (애 ' + allRows.length + '행)</p></div>';

      var children = parseRowsToChildren(allRows);

      if (children.length > 0) {
        renderImportPreview({ children: children, sessions: [], unmapped: [], summary: children.length + '명 변환 완료' }, resultEl);
      } else {
        resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>컨럼 형식을 AI가 분석 중입니다...</p></div>';
        var wb2  = XLSX.read(data, { type: 'array' });
        var csv  = XLSX.utils.sheet_to_csv(wb2.Sheets[wb2.SheetNames[0]], { blankrows: false });
        var sample = csv.split('\n').slice(0, 30).join('\n');
        analyzeImportData(apiKey, sample, resultEl);
      }
    } catch(err) {
      resultEl.innerHTML = '<div class="import-warning">⚠️ 파일 읽기 실패: ' + escHtml(err.message || '오류') + '</div>';
    }
  };
  reader.onerror = function() { resultEl.innerHTML = '<div class="import-warning">⚠️ 파일을 읽을 수 없습니다.</div>'; };
  reader.readAsArrayBuffer(file);
}

function normalizeDisorderType(raw) {
  var s = String(raw || '').trim();
  if (!s || s === '미응답' || s === '-') return '기타';
  if (s.indexOf('조음') > -1) return '조음음운장애';
  if (s.indexOf('언어발달') > -1 || s.indexOf('언어지연') > -1) return '언어발달장애';
  if (s.indexOf('유창성') > -1 || s.indexOf('말더듬') > -1) return '유창성장애';
  if (s.indexOf('자폐') > -1 || s.indexOf('ASD') > -1) return '자폐스펙트럼';
  if (s.indexOf('지적') > -1) return '지적장애';
  if (s.indexOf('청각') > -1) return '청각장애';
  return '기타';
}

function parseRowsToChildren(rows) {
  if (!rows.length) return [];
  var keys = Object.keys(rows[0]);

  function findCol(candidates) {
    for (var ci = 0; ci < candidates.length; ci++) {
      for (var ki = 0; ki < keys.length; ki++) {
        if (keys[ki].trim().indexOf(candidates[ci]) > -1) return keys[ki];
      }
    }
    return null;
  }

  var colName   = findCol(['이용자','아동명','이름','성명']);
  if (!colName) return [];

  var colBirth  = findCol(['생년월일','birth','생일']);
  var colAge    = findCol(['개월수','연령','나이','age']);
  var colType   = findCol(['장애유형','장애','진단명','진단']);
  var colPhone  = findCol(['연락연락캘당자','연락처','전화번호','보호자연락첸','보호자 연락첸']);
  var colStatus = findCol(['상태','status']);
  var colMemo   = findCol(['메모','비고','특이사항']);

  var children = [];
  rows.forEach(function(row) {
    var name = String(row[colName] || '').trim();
    if (!name) return;

    var birth = '';
    if (colBirth && row[colBirth]) {
      var bRaw = row[colBirth];
      if (bRaw instanceof Date) {
        birth = bRaw.toISOString().slice(0, 10);
      } else {
        var bStr = String(bRaw).replace(/[./ ]/g, '-').trim();
        var bNum = bStr.replace(/-/g, '');
        if (/^[0-9]{8}$/.test(bNum)) birth = bNum.slice(0,4)+'-'+bNum.slice(4,6)+'-'+bNum.slice(6,8);
        else birth = bStr;
      }
    }

    var age    = colAge    ? String(row[colAge]    || '') : '';
    var phone  = colPhone  ? String(row[colPhone]  || '') : '';
    var memo   = colMemo   ? String(row[colMemo]   || '') : '';
    var rawStatus = colStatus ? String(row[colStatus] || '').trim() : '';

    var childStatus = '등록';
    if (rawStatus.indexOf('종결') > -1 || rawStatus.indexOf('퇴원') > -1 || rawStatus.indexOf('종료') > -1) {
      childStatus = '종결';
    } else if (rawStatus.indexOf('대기') > -1 || rawStatus.indexOf('접수') > -1 || rawStatus.indexOf('신규') > -1) {
      childStatus = '대기';
    } else if (rawStatus.indexOf('등록') > -1 || rawStatus.indexOf('재원') > -1 || rawStatus.indexOf('이용') > -1 || rawStatus.indexOf('진행') > -1) {
      childStatus = '등록';
    }

    children.push({
      name:   name,
      birth:  birth,
      age:    age,
      type:   normalizeDisorderType(colType ? row[colType] : ''),
      phone:  phone,
      goals:  [],
      memo:   memo,
      status: childStatus
    });
  });
  return children;
}

function analyzeImportData(apiKey, csvText, resultEl) {
  var SYSTEM = '당신은 언어치료 데이터 마이그레이션 전문가입니다. '
    + '케어플센터 또는 다른 언어치료 앱에서 내보렬 엑셀/CSV 데이터를 분석하여 아동 정보와 세션 기록을 추출하세요.\n\n'
    + '【케어플센터 이용자 파일 컨럼 매핑 규칙】\n'
    + '- "이용자" 컨럼 → name (아동명)\n'
    + '- "생년월일" 컨럼 → birth (YYYY-MM-DD 형식으로 변환. 예: 2022-06-14)\n'
    + '- "개월수" 컨럼 → age (예: "3세 10개월" 그대로 사용. birth가 있으면 age는 비워도 됨)\n'
    + '- "장애유형" 컨럼 → type. "미응답"이면 "기타"로 변환\n'
    + '- "연락첸" 컨럼 → phone (보호자 연락첸)\n'
    + '- "메모" 컨럼 → memo\n'
    + '- "상태"가 "퇴원" 또는 "종결"이면 memo에 "(종결)" 추가\n'
    + '- "이메일", "주소", "학교", "회원번호" 등 나머지 개인정보 → 무시\n\n'
    + '【장애유형 변환 규칙】\n'
    + '"조음"이 포함 → "조음음운장애" / "언어발달"이 포함 → "언어발달장애" / "유창성"이 포함 → "유창성장애" '
    + '/ "자폐" 포함 → "자폐스펙트럼" / "지적" 포함 → "지적장애" / "청각" 포함 → "청각장애" / 나머지 → "기타"\n\n'
    + '【세션 기록 파일 컨럼 매핑 규칙】(회기 데이터가 있을 경우)\n'
    + '- "이용자" 또는 "아동명" → childName\n'
    + '- "날짜" 또는 "회기일" → date (YYYY-MM-DD)\n'
    + '- "목표" 또는 "치료목표" → goals (문자열 배열)\n'
    + '- "내용" 또는 "회기내용" → memo\n\n'
    + '반드시 순수 JSON만 응답 (마크다운 없이):\n'
    + '{"children":[{"name":"아동명","birth":"2022-06-14","age":"3세 10개월","type":"조음음운장애","phone":"010-1234-5678","goals":[],"memo":""}],'
    + '"sessions":[],'
    + '"unmapped":[],'
    + '"summary":"N명 변환"}';

  var USER = '아래 데이터를 변환하세요. goals는 빈 배열로, memo는 꼭 필요한 것만, 간결하게 작성하세요.\n\n'
    + csvText;

  callClaude(apiKey, SYSTEM, USER, 4096, getAIModel())
    .then(function(raw) {
      var parsed = parseJSON(raw);
      renderImportPreview(parsed, resultEl);
    })
    .catch(function(err) {
      var msg = err.message;
      if (msg.includes('JSON') || msg.includes('position')) {
        msg = '아동 수가 너무 많아 응답이 잊혀졌습니다. 파일을 절반씩 나눠서 두 번 올려주세요.';
      }
      resultEl.innerHTML = '<div class="import-warning">⚠️ AI 분석 실패: ' + msg + '</div>';
    });
}

function renderImportPreview(data, resultEl) {
  var children = data.children || [];
  var sessions = data.sessions || [];
  var unmapped = data.unmapped || [];

  if (children.length === 0) {
    resultEl.innerHTML = '<div class="import-warning">⚠️ 아동 정보를 찾지 못했습니다. 파일 형식을 확인해주세요.<br>'
      + (data.summary ? '분석 결과: ' + escHtml(data.summary) : '') + '</div>';
    return;
  }

  var existingNames = childDB.map(function(c) { return c.name; });
  var html = '';

  if (data.summary) {
    html += '<div style="background:var(--mint2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--mint);font-weight:600;">'
      + '🤖 ' + escHtml(data.summary) + '</div>';
  }

  html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">👶 아동 ' + children.length + '명 · 📝 세션 ' + sessions.length + '개 발견</div>';

  children.forEach(function(c) {
    var isDup       = existingNames.indexOf(c.name) >= 0;
    var isTerminated = c.memo && c.memo.includes('(종결)');
    var sessionCnt  = sessions.filter(function(s) { return s.childName === c.name; }).length;
    html += '<div class="import-preview-item" style="' + (isDup ? 'border-left-color:var(--amber);' : isTerminated ? 'border-left-color:#94a3b8;opacity:0.75;' : '') + '">'
      + '<div class="import-preview-name">' + escHtml(c.name || '이름 없음')
      + (isDup        ? ' <span style="font-size:10px;background:#fef3c7;color:#b45309;padding:2px 7px;border-radius:10px;margin-left:4px;">이미 존재</span>' : '')
      + (isTerminated ? ' <span style="font-size:10px;background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:10px;margin-left:4px;">종결</span>' : '')
      + '</div>'
      + '<div class="import-preview-meta">' + escHtml(c.age || '나이 미상') + ' · ' + escHtml(c.type || '유형 미상')
      + (c.birth ? ' · 🎂 ' + escHtml(c.birth) : '')
      + (sessionCnt > 0 ? ' · 세션 ' + sessionCnt + '개' : '') + '</div>'
      + (c.phone ? '<div style="font-size:11px;color:var(--text2);margin-top:2px;">📞 ' + escHtml(c.phone) + '</div>' : '')
      + (c.goals && c.goals.length > 0 ? '<div class="import-preview-goals">목표: ' + c.goals.map(function(g){return escHtml(g);}).join(', ') + '</div>' : '')
      + (c.memo ? '<div style="font-size:11px;color:var(--text2);margin-top:3px;">' + escHtml(c.memo) + '</div>' : '')
      + '</div>';
  });

  if (unmapped.length > 0) {
    html += '<div class="import-warning">⚠️ 변환하지 못한 항목 ' + unmapped.length + '개: '
      + unmapped.slice(0, 3).map(function(u){return escHtml(String(u));}).join(', ')
      + (unmapped.length > 3 ? ' 외 ' + (unmapped.length - 3) + '개' : '') + '</div>';
  }

  window._importPreview = data;

  html += '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-primary" style="flex:1;" onclick="confirmImport()">✅ 이대로 가져오기</button>'
    + '<button class="btn-ghost" style="flex:0.4;" onclick="cancelImport()">취소</button>'
    + '</div>';

  resultEl.innerHTML = html;
}

function confirmImport() {
  var data = window._importPreview;
  if (!data) return;

  _myChangeTs = Date.now() + 8000;

  var children = data.children || [];
  var sessions  = data.sessions || [];
  var addedCount = 0, skippedCount = 0, sessionCount = 0;

  var nameToId = {};
  children.forEach(function(c) {
    var exists = childDB.find(function(existing) { return existing.name === c.name; });
    if (exists) {
      nameToId[c.name] = exists.id;
      skippedCount++;
    } else {
      var newId = Date.now() + Math.floor(Math.random() * 10000);
      var birthVal = c.birth || '';
      var ageVal   = birthVal ? (calcAgeFromBirth(birthVal) || c.age || '미상') : (c.age || '미상');
      childDB.push({
        id:           newId,
        name:         c.name   || '이름 없음',
        birth:        birthVal,
        age:          ageVal,
        type:         c.type   || '기타',
        phone:        c.phone  || '',
        goals:        Array.isArray(c.goals) ? c.goals : [],
        memo:         c.memo   || '',
        status:       c.status || '등록',
        startDate:    '',
        voucherLimit: 0,
        color:        CHILD_COLORS[childDB.length % CHILD_COLORS.length]
      });
      nameToId[c.name] = newId;
      addedCount++;
    }
  });
  saveChildren();

  sessions.forEach(function(s) {
    var childId = nameToId[s.childName];
    if (!childId) return;
    sessionDB.push({
      id:      Date.now() + Math.floor(Math.random() * 100000),
      childId: childId,
      date:    s.date    || new Date().toISOString().slice(0, 10),
      goals:   Array.isArray(s.goals) ? s.goals : [],
      memo:    s.memo    || '',
      aiNote:  ''
    });
    sessionCount++;
  });
  saveSessions();

  window._importPreview = null;
  renderChildGrid();
  populateChildSelects();

  document.getElementById('importResult').innerHTML =
    '<div style="background:#f0fdf4;border-radius:10px;padding:14px;border-left:4px solid var(--green);">'
    + '<div style="font-weight:700;color:var(--green);margin-bottom:6px;">✅ 가져오기 완료!</div>'
    + '<div style="font-size:13px;line-height:1.8;">'
    + '아동 추가: <strong>' + addedCount + '명</strong><br>'
    + (skippedCount > 0 ? '중복 스킵: <strong>' + skippedCount + '명</strong><br>' : '')
    + '세션 기록: <strong>' + sessionCount + '개</strong>'
    + '</div></div>';

  showToast('✅ ' + addedCount + '명 추가! 서버 저장 중...(잠시 기다려주세요)');
  setTimeout(function() {
    showToast('☁️ 서버 저장 완료! 아동 ' + childDB.length + '명');
  }, addedCount * 100 + 3000);
}

function cancelImport() {
  window._importPreview = null;
  document.getElementById('importResult').innerHTML = '';
  document.getElementById('importFileInput').value  = '';
}

// ─────── 초기화 ───────
function init() {
  // 배포 버튼이 "배포 중..." 상태로 저장된 경우 강제 정상화
  var _db = document.getElementById('headerDeployBtn');
  if (_db) { _db.disabled = false; _db.textContent = '🚀 배포'; }
  loadDarkMode();
  setTimeout(applyPermissions, 400);
  startHeaderClock();
  setupNetworkMonitor();
  setupGlobalErrorHandler();
  maybeAutoBackup();
  loadApiUsage();
  var today = new Date().toISOString().slice(0, 10);
  document.getElementById('sessionDate').value     = today;
  document.getElementById('portfolioMonth').value  = today.slice(0, 7);
  document.getElementById('assessDate').value      = today;
  schedCurrentDate = new Date();

  var saved = localStorage.getItem('cn3_apikey');
  if (saved) {
    document.getElementById('apiKey').value = saved;
    showMaskedApiKey();
  }
  document.getElementById('apiKey').addEventListener('input', function() {
    if (this.value.startsWith('sk-ant')) localStorage.setItem('cn3_apikey', this.value);
  });

  var savedUser  = localStorage.getItem('madi_user');
  var savedToken = localStorage.getItem('madi_token');
  if (savedUser && savedToken) {
    try {
      currentUser = JSON.parse(savedUser);
      _madiToken  = savedToken;
      applyUserUI();
      applyRoleUI();
      loadCenterApiKey();
      hideLoginScreen();
      loadDBFromSupabase();
      initRealtime();
    } catch(e) {
      clearToken();
      localStorage.removeItem('madi_user');
      showLanding();
    }
  } else {
    clearToken();
    localStorage.removeItem('madi_user');
    loadDB();
    renderChildGrid();
    populateChildSelects();
    renderGoalRows();
    renderSessionList();
    renderUnwrittenAlert();
    showLanding();
  }

  initPWA();
}

// ─────── PWA 지원 ───────
var _pwaPrompt = null;

function initPWA() {
  var NL = String.fromCharCode(10);

  var iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">'
    + '<rect width="130" height="130" rx="28" fill="#0ea5a0"/>'
    + '<rect x="18" y="100" width="94" height="18" rx="9" fill="rgba(255,255,255,0.3)"/>'
    + '<rect x="59" y="26" width="12" height="80" rx="6" fill="white"/>'
    + '<ellipse cx="36" cy="60" rx="32" ry="17" fill="white" transform="rotate(-40,36,60)"/>'
    + '<ellipse cx="94" cy="52" rx="32" ry="17" fill="white" transform="rotate(40,94,52)"/>'
    + '<circle cx="65" cy="22" r="13" fill="white"/>'
    + '<circle cx="65" cy="22" r="7" fill="#0ea5a0"/>'
    + '</svg>';
  var iconBlob = new Blob([iconSvg], { type: 'image/svg+xml' });
  var iconUrl  = URL.createObjectURL(iconBlob);

  var iconLink = document.getElementById('pwaIcon');
  if (iconLink) iconLink.href = iconUrl;

  var manifest = {
    name: '마디 — 언어치료 AI 비서',
    short_name: '마디',
    description: '언어치료사를 위한 AI 기반 세션 관리 앱',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#0f2942',
    theme_color: '#0ea5a0',
    orientation: 'portrait-primary',
    lang: 'ko',
    icons: [
      { src: iconUrl, sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' }
    ]
  };
  var manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  var manifestUrl  = URL.createObjectURL(manifestBlob);
  var manifestLink = document.getElementById('pwaManifest');
  if (manifestLink) manifestLink.href = manifestUrl;

  // ── Service Worker 등록: ./sw.js 우선, 실패 시 Blob URL 폴백 ──
  if ('serviceWorker' in navigator) {
    // SW 업데이트 감지 시 자동 새로고침
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
    // 1차 시도: 배포된 ./sw.js (GitHub Pages 환경)
    navigator.serviceWorker.register('./sw.js')
      .then(function(reg) {
        console.log('[마디 PWA] sw.js 등록 성공 — 오프라인 캐싱 활성화:', reg.scope);
      })
      .catch(function() {
        // 2차 시도: Blob URL (로컈 개발 / sw.js 미배포 환경)
        var swBlob = new Blob([SW_CODE], { type: 'text/javascript' });
        var swUrl  = URL.createObjectURL(swBlob);
        navigator.serviceWorker.register(swUrl)
          .then(function() { console.log('[마디 PWA] Blob URL SW 등록 (폴백)'); })
          .catch(function() {});
      });
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _pwaPrompt = e;
    showPWABanner('android');
  });

  window.addEventListener('appinstalled', function() {
    _pwaPrompt = null;
    hidePWABanner();
    showToast('✅ 마디 앱 설치 완료!');
  });

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
  var isStandalone = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    setTimeout(function() { showPWABanner('ios'); }, 2500);
  }
}

function showPWABanner(type) {
  if (document.getElementById('pwaBanner')) return;

  var banner = document.createElement('div');
  banner.id = 'pwaBanner';
  banner.className = 'pwa-banner';

  if (type === 'android') {
    banner.innerHTML = '<div class="pwa-banner-icon">🗒️</div>'
      + '<div class="pwa-banner-text">'
      + '<div class="pwa-banner-title">마디 앱 설치</div>'
      + '<div class="pwa-banner-desc">홈 화면에 추가하여 앱잘맼 빠르게 실행하세요</div>'
      + '</div>'
      + '<button class="pwa-install-btn" onclick="triggerPWAInstall()">설치</button>'
      + '<button class="pwa-close-btn" onclick="hidePWABanner()">✕</button>';
  } else {
    banner.innerHTML = '<div class="pwa-banner-icon">🗒️</div>'
      + '<div class="pwa-banner-text">'
      + '<div class="pwa-banner-title">홈 화면에 추가하기</div>'
      + '<div class="pwa-banner-desc">Safari 하단 <b>공유 버튼(⬆️)</b> → <b>홈 화면에 추가</b> 탭하세요</div>'
      + '</div>'
      + '<button class="pwa-close-btn" onclick="hidePWABanner()">✕</button>';
  }

  document.body.appendChild(banner);
  document.body.classList.add('pwa-banner-open');

  var toast = document.getElementById('toast');
  if (toast) toast.style.bottom = '90px';
}

function hidePWABanner() {
  var b = document.getElementById('pwaBanner');
  if (b) b.remove();
  document.body.classList.remove('pwa-banner-open');
  var toast = document.getElementById('toast');
  if (toast) toast.style.bottom = '';
}

function triggerPWAInstall() {
  if (!_pwaPrompt) { showToast('⚠️ 설치 프롬프트를 다시 시도해주세요.'); return; }
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(function(result) {
    if (result.outcome === 'accepted') showToast('📲 설치 중...');
    _pwaPrompt = null;
  });
  hidePWABanner();
}

document.addEventListener('DOMContentLoaded', function() {
  init();
  initFloatBtnDrag();
});


// ─────── 플로팅 AI 비서 ───────
var chatHistory = [];
var chatOpen    = false;
var chatWaiting = false;

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatWindow').classList[chatOpen ? 'add' : 'remove']('open');
  document.getElementById('unreadDot').classList.remove('show');

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

// ── 마로 버튼 드래그 이동 ──
function initFloatBtnDrag() {
  var btn = document.getElementById('floatBtn');
  if (!btn) return;

  var _dragging = false;
  var _moved    = false;
  var _startX, _startY, _startTop, _startRight;

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('madi_maro_pos') || 'null'); } catch(e) {}
  if (saved) {
    btn.style.top    = saved.top  + 'px';
    btn.style.bottom = 'auto';
    btn.style.right  = saved.right + 'px';
    btn.style.left   = 'auto';
    btn.style.transform = 'none';
  }

  function getPos(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                     : { x: e.clientX,             y: e.clientY };
  }

  function onStart(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    _dragging = true;
    _moved    = false;
    var pos   = getPos(e);
    _startX   = pos.x;
    _startY   = pos.y;
    var rect  = btn.getBoundingClientRect();
    _startTop   = rect.top;
    _startRight = window.innerWidth - rect.right;
    btn.classList.add('dragging');
    e.preventDefault();
  }

  function onMove(e) {
    if (!_dragging) return;
    var pos  = getPos(e);
    var dx   = pos.x - _startX;
    var dy   = pos.y - _startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _moved = true;
    if (!_moved) return;

    var newTop   = Math.max(0, Math.min(_startTop + dy, window.innerHeight - btn.offsetHeight));
    var newRight = Math.max(0, Math.min(_startRight - dx, window.innerWidth - btn.offsetWidth));

    btn.style.top    = newTop   + 'px';
    btn.style.bottom = 'auto';
    btn.style.right  = newRight + 'px';
    btn.style.left   = 'auto';
    btn.style.transform = 'none';
    e.preventDefault();
  }

  function onEnd(e) {
    if (!_dragging) return;
    _dragging = false;
    btn.classList.remove('dragging');

    if (_moved) {
      try {
        localStorage.setItem('madi_maro_pos', JSON.stringify({
          top:   parseInt(btn.style.top),
          right: parseInt(btn.style.right)
        }));
      } catch(err) {}
      btn.dataset.dragged = '1';
      setTimeout(function() { delete btn.dataset.dragged; }, 100);
    }
  }

  btn.addEventListener('mousedown',  onStart, { passive: false });
  document.addEventListener('mousemove', onMove,  { passive: false });
  document.addEventListener('mouseup',   onEnd);

  btn.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove',  onMove,  { passive: false });
  document.addEventListener('touchend',   onEnd);

  btn.removeAttribute('onclick');
  btn.addEventListener('click', function(e) {
    if (btn.dataset.dragged) return;
    toggleChat();
  });
}

function getChatGreeting() {
  var hour = new Date().getHours();
  var time = hour < 12 ? '오늘도 좋은 하루 시작해요' : hour < 18 ? '즐거운 오후 되세요' : '오늘 하루도 수고하셨어요';
  var cnt  = childDB.length;
  var uw   = getUnwrittenSessions().length;
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
  if (!chatOpen) document.getElementById('unreadDot').classList.add('show');
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
      + '<div class="msg-bubble">' + escHtml(msg.content).replace(/\n/g, '<br>') + '</div>'
      + '<div class="msg-time">' + now + '</div>'
      + '</div>'
      + (isUser ? '<div class="msg-avatar" style="background:#dbeafe;">😊</div>' : '')
      + '</div>';
  });
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
  document.getElementById('chatInput').value = text;
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
  var dur = a.duration || 40;
  var endTime = '';
  try {
    var parts = a.startTime.split(':');
    var totalMin = parseInt(parts[0]) * 60 + parseInt(parts[1]) + dur;
    endTime = String(Math.floor(totalMin / 60)).padStart(2, '0') + ':' + String(totalMin % 60).padStart(2, '0');
  } catch(e) { endTime = a.startTime; }
  var teacherName = '';
  var teacherColor = '';
  if (a.teacher && typeof a.teacher === 'string' && a.teacher.trim()) {
    teacherName = a.teacher.trim();
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
  switchTab(2);
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
  switchTab(2);
  switchReportTab('report');
  setTimeout(function() {
    var sel = document.getElementById('reportChild');
    if (sel) sel.value = a.childId;
  }, 200);
  if (chatOpen) toggleChat();
  showToast('📨 ' + child.name + ' 부모 리포트 화면으로 이동');
}

function actSwitchTab(a) {
  if (typeof a.tab !== 'number' || a.tab < 0 || a.tab > 6) return;
  switchTab(a.tab);
  if (chatOpen) toggleChat();
}

function actShowUnwritten() {
  switchTab(2);
  switchReportTab('session');
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
  var today = new Date().toISOString().slice(0, 10);
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
  var now = new Date();
  var dayOfWeek = now.getDay();
  var monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  var mondayStr = monday.toISOString().slice(0, 10);

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
  var fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  var cutoffStr = fourWeeksAgo.toISOString().slice(0, 10);
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
  var btn = document.getElementById('chatMicBtn');
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
    btn.classList.add('recording');
    btn.textContent = '🔴';
    btn.title = '녹음 중... (탭하면 종료)';
  };
  chatRecognition.onresult = function(ev) {
    var input = document.getElementById('chatInput');
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
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_REALTIME_KEY,
      'Authorization': 'Bearer ' + getToken()
    },
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
  .catch(function(err) {
    hideTypingIndicator();
    addAiMsg('오류가 발생했어요 😅\n' + err.message);
  })
  .finally(function() {
    chatWaiting = false;
    document.getElementById('chatSendBtn').disabled = false;
    document.getElementById('chatQuickBtns').style.display = 'flex';
  });
}

function buildChatContext() {
  var today = new Date().toISOString().slice(0, 10);
  var lines = ['📅 오늘: ' + today];

  if (currentUser) {
    var roleTxt = (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? '관리자' : '선생님';
    lines.push('🔑 현재 로그인: ' + currentUser.name + ' (' + roleTxt + ')');
  }
  lines.push('👶 등록 아동: ' + childDB.length + '명');

  var weekStart = new Date();
  var dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  var weekStartStr = weekStart.toISOString().slice(0, 10);

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

  childDB.forEach(function(c) {
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
  if (uw.length > 0) {
    lines.push('\n⚠️ 미작성 세션 ' + uw.length + '건:');
    uw.forEach(function(u) {
      var teacherTxt = u.teacher ? ' (담당: ' + u.teacher + ')' : '';
      lines.push('  - ' + u.date + ' ' + u.childName + teacherTxt);
    });
  }

  var todaySched = scheduleDB.filter(function(s) { return s.date === today; })
    .sort(function(a, b) { return (a.startTime || '').localeCompare(b.startTime || ''); });
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
