function loadCenterApiKey(showFeedback) {
  // Supabase에서 센터 공용 API 키 로드
  // cowork High #4: 클라이언트 localStorage 캐싱 제거 (DevTools 추출 방지)
  return supaFetch('madi_settings?key=eq.api_key&select=value', 'GET')
    .then(function(rows) {
      if (!rows || rows.length === 0 || !rows[0].value) {
        if (showFeedback) showToast('ℹ️ Supabase에 저장된 키 없음');
        return;
      }
      var key = rows[0].value;
      document.getElementById('apiKey').value = key;
      showMaskedApiKey();
      if (showFeedback) showToast('✅ 센터 AI 키 불러옴');

      // 관리자 설정 탭 입력란에도 채우기
      var adminInput = document.getElementById('centerApiKeyInput');
      if (adminInput) {
        adminInput.value = key;
        var statusEl = document.getElementById('centerKeyStatus');
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--green);">✅ 현재 저장된 키: ' + maskApiKey(key) + '</span>';
      }
    })
    .catch(function(err) {
      console.error('센터 키 로드 실패:', err);
    });
}

function saveCenterApiKey() {
  var key = (document.getElementById('centerApiKeyInput') || {}).value || '';
  key = key.trim();
  if (!key.startsWith('sk-ant')) {
    showToast('❌ 유효한 Anthropic API 키를 입력해주세요 (sk-ant-로 시작)');
    return;
  }
  var statusEl = document.getElementById('centerKeyStatus');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text2);">저장 중...</span>';

  supaFetch('madi_settings', 'POST', [{ key: 'api_key', value: key }])
    .then(function() {
      // 현재 세션에도 즉시 적용 (DOM만, localStorage 캐싱 안 함)
      document.getElementById('apiKey').value = key;
      showMaskedApiKey();
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green);">✅ 저장 완료: ' + maskApiKey(key) + '</span>';
      showToast('✅ 센터 AI 키 저장됨 — 모든 선생님이 자동으로 사용합니다');
    })
    .catch(function(err) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);">❌ 저장 실패: ' + escHtml(err.message || '오류') + '</span>';
      showToast('❌ 저장 실패');
    });
}

function toggleCenterKeyVisibility() {
  var input = document.getElementById('centerApiKeyInput');
  var btn = document.getElementById('centerKeyEye');
  if (!input || !btn) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// ─────── 센터 관리 ───────
// 초대 코드 만료 상태 표시 헬퍼
function formatInviteExpiry(expiresAt) {
  if (!expiresAt) return { text:'♾️ 무기한', color:'var(--text2)', expired:false };
  var exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return { text:'', color:'var(--text2)', expired:false };
  var now = new Date();
  var diffMs = exp - now;
  var dateStr = ymd(toKST(exp));
  if (diffMs < 0) return { text:'⛔ 만료됨 (' + dateStr + ')', color:'#ef4444', expired:true };
  var diffDays = Math.ceil(diffMs / (1000*60*60*24));
  if (diffDays <= 3) return { text:'⚠️ ' + diffDays + '일 남음 (' + dateStr + ')', color:'#f59e0b', expired:false };
  return { text:'✅ ' + diffDays + '일 남음 (' + dateStr + ')', color:'#16a34a', expired:false };
}

function loadCenterInfo() {
  var cid = getCenterId();
  supaFetch('madi_centers?id=eq.' + encodeURIComponent(cid) + '&select=*', 'GET')
    .then(function(rows) {
      if (!rows || rows.length === 0) return;
      var center = rows[0];
      var nameEl = document.getElementById('centerName');
      var codeEl = document.getElementById('inviteCodeDisplay');
      var expEl  = document.getElementById('inviteExpiryDisplay');
      if (nameEl) nameEl.textContent = center.name || cid;
      if (codeEl) codeEl.textContent = center.invite_code || '없음';
      if (expEl) {
        if (!center.invite_code) {
          expEl.textContent = '';
        } else {
          var info = formatInviteExpiry(center.invite_expires_at);
          expEl.textContent = info.text;
          expEl.style.color = info.color;
        }
      }
    }).catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-03]',e&&e.message);});
}

function copyInviteCode() {
  var code = (document.getElementById('inviteCodeDisplay') || {}).textContent || '';
  if (!code || code === '------') { showToast('초대 코드가 없습니다.'); return; }
  navigator.clipboard.writeText(code).then(function() {
    showToast('📋 초대 코드 복사됨: ' + code);
  }).catch(function() {
    showToast('코드: ' + code);
  });
}

function regenInviteCode() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('⚠️ 관리자만 초대 코드를 재발급할 수 있습니다');
    return;
  }
  var daysSel = document.getElementById('inviteExpiryDays');
  var days = daysSel ? parseInt(daysSel.value, 10) : 30;
  if (isNaN(days)) days = 30;
  var expiryLabel = days === 0 ? '무기한' : days + '일 유효';
  showConfirm('초대 코드를 재발급할까요? (' + expiryLabel + ')\n기존 코드는 사용 불가가 됩니다.', function() {
  var cid = getCenterId();
  if (!cid) { showToast('⚠️ 센터 정보를 찾을 수 없습니다.'); return; }
  var newCode = cid.toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  var payload = { invite_code: newCode };
  if (days > 0) {
    var exp = new Date();
    exp.setDate(exp.getDate() + days);
    payload.invite_expires_at = exp.toISOString();
  } else {
    payload.invite_expires_at = null;
  }
  supaFetch('madi_centers?id=eq.' + encodeURIComponent(cid), 'PATCH', payload)
    .then(function() {
      var codeEl = document.getElementById('inviteCodeDisplay');
      var expEl  = document.getElementById('inviteExpiryDisplay');
      if (codeEl) codeEl.textContent = newCode;
      if (expEl) {
        var info = formatInviteExpiry(payload.invite_expires_at);
        expEl.textContent = info.text;
        expEl.style.color = info.color;
      }
      showToast('✅ 재발급 완료: ' + newCode + ' (' + expiryLabel + ')');
    }).catch(function(err) {
      showToast('❌ 재발급 실패: ' + escHtml(err.message || '오류'));
    });
  }, { danger: false, okLabel: '재발급' });
}

function addStaffAccount() {
  // 권한 가드 — admin / superadmin 만 (서버 RLS 외 클라이언트 1차 방어)
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('❌ 관리자만 계정을 추가할 수 있습니다');
    return;
  }
  var name     = ((document.getElementById('fixedStaffName')   || {value:''}).value || '').trim();
  var username = ((document.getElementById('newStaffUsername') || {value:''}).value || '').trim();
  var pw       = ((document.getElementById('fixedStaffPw')     || {value:''}).value || '').trim();
  var role     = ((document.getElementById('fixedStaffRole')   || {value:''}).value || '');
  var resultEl = document.getElementById('staffAddResult');
  if (!name || !username || !pw) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red);">❌ 이름·아이디·비밀번호를 모두 입력해주세요.</span>';
    return;
  }
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--text2);">추가 중...</span>';

  hashPassword(pw).then(function(hashed) {
    return supaFetch('madi_users', 'POST', [{
      id: generateClientId(),
      username: username,
      name: name,
      password: hashed,
      role: role,
      center_id: getCenterId(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')
    }]);
  }).then(function() {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--green);">✅ ' + escHtml(name) + ' 선생님 계정 추가됨</span>';
    document.getElementById('fixedStaffName').value = '';
    document.getElementById('newStaffUsername').value = '';
    document.getElementById('fixedStaffPw').value = '';
    loadStaffMgmtList();
  }).catch(function(err) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red);">❌ 추가 실패: ' + escHtml(err.message || '아이디 중복일 수 있습니다') + '</span>';
  });
}

function loadStaffMgmtList() {
  var el = document.getElementById('staffMgmtList');
  if (!el) return;
  var cid = getCenterId();
  supaFetch('madi_users?' + centerFilter() + '&select=id,name,username,role&order=name.asc', 'GET')
    .then(function(rows) {
      if (!rows || rows.length === 0) {
        el.innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px;">등록된 선생님이 없습니다.</div>';
        return;
      }
      el.innerHTML = rows.map(function(u) {
        var isSelf = currentUser && currentUser.id === u.id;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:5px;">'
          + '<div>'
          + '<span style="font-size:13px;font-weight:700;">' + escHtml(u.name) + '</span>'
          + '<span style="font-size:11px;color:var(--text2);margin-left:6px;">@' + escHtml(u.username) + '</span>'
          + '<span style="font-size:10px;margin-left:6px;padding:2px 7px;border-radius:10px;background:' + (u.role==='admin'?'var(--mint2)':'#f1f5f9') + ';color:' + (u.role==='admin'?'var(--mint)':'var(--text2)') + ';">' + (u.role==='admin'?'관리자':'선생님') + '</span>'
          + '</div>'
          + (!isSelf ? '<button class="btn-del" data-uid="' + u.id + '" data-uname="' + escHtml(u.name) + '" onclick="removeStaffAccountFromBtn(this)" style="font-size:11px;padding:5px 10px;">삭제</button>' : '<span style="font-size:11px;color:var(--text2);">나</span>')
          + '</div>';
      }).join('');
    }).catch(function(err) {
      el.innerHTML = '<div style="font-size:12px;color:var(--red);text-align:center;padding:10px;">로드 실패: ' + escHtml(err.message || '') + '</div>';
    });
}

function removeStaffAccountFromBtn(btn) {
  // C5 원칙: onclick 인라인 사용자 데이터 → data 속성 + 헬퍼로 분리
  removeStaffAccount(btn.dataset.uid, btn.dataset.uname);
}

function removeStaffAccount(id, name) {
  showConfirm(name + ' 선생님 계정을 삭제할까요?', function() {
    supaFetch('madi_users?id=eq.' + id, 'DELETE')
      .then(function() {
        showToast('🗑️ ' + name + ' 계정 삭제됨');
        loadStaffMgmtList();
      }).catch(function(err) {
        showToast('❌ 삭제 실패: ' + escHtml(err.message || '오류'));
      });
  });
}

// ── 관리자 페이지 이동 (TASK-008: admin.html 분리) ──
function goToAdmin(tab) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('⚠️ 관리자만 접근할 수 있어요');
    return;
  }
  window.location.href = 'admin.html?tab=' + (tab || 'service');
}

function applyRoleUI() {
  var flags          = getRoleFlags();
  var isAdminOrSuper = flags.isAdminOrSuper;
  var isSuperAdmin   = flags.isSuper;
  var apikeyBar  = document.getElementById('apikeyBar');
  var centerCard = document.getElementById('centerApiKeyCard');
  var mgmtCard   = document.getElementById('centerMgmtCard');
  var deployBtn  = document.getElementById('headerDeployBtn');
  if (apikeyBar)  apikeyBar.style.display  = 'none';
  if (centerCard) centerCard.style.display = isAdminOrSuper ? 'block' : 'none';
  if (mgmtCard)   mgmtCard.style.display   = isAdminOrSuper ? 'block' : 'none';
  // 배포 버튼: superadmin이고 로컬 파일일 때만 표시
  var isLocal = window.location.protocol === 'file:';
  if (deployBtn)  deployBtn.style.display  = (isSuperAdmin && isLocal) ? '' : 'none';
}


function resetMaroPos() {
  localStorage.removeItem('madi_maro_pos');
  var el = document.getElementById('maroResetResult');
  if (el) {
    el.textContent = '✅ 초기화 완료! 적용됩니다.';
    setTimeout(function() { if (el) el.textContent = ''; }, 3000);
  }
  var btn = document.getElementById('floatBtn');
  if (btn) { btn.style.inset = ''; btn.style.transform = ''; }
  showToast('✅ 마로 위치 초기화됨');
}

function getApiKeyOrAlert() {
  return true;
}

// ─────── 탭 전환 ───────
// ─── 새 탭 구조 (7개) ───
// 0:캘린더관리  1:공지사항  2:이용자관리
// 3:보고서       4:포트폴리오  5:서비스관리  6:관리자메뉴
// ─────── 홈 대시보드 ───────
function showDashboard() {
  ALL_PANELS_NEW.forEach(function(id){ var p=document.getElementById(id); if(p) p.classList.remove('active'); });
  ['panel1','panel3','panel4','panel5','panel6','panel7'].forEach(function(id){ var p=document.getElementById(id); if(p) p.classList.remove('sub-active'); });
  for(var i=0;i<6;i++){ var b=document.getElementById('tabBtn'+i); if(b) b.classList.remove('active'); }
  var hb=document.getElementById('tabBtnHome'); if(hb) hb.classList.add('active');
  var hp=document.getElementById('panelHome'); if(hp) hp.classList.add('active');
  // 배너 강제 숨김 제거 → 공지 있으면 배너 표시 (이전: ban.style.display='none')
  if (typeof startNoticeBanner === 'function' && typeof noticeDB !== 'undefined') {
    startNoticeBanner(noticeDB);
  }
  syncSidebarActive(-1);
  updateBreadcrumb(-1);
  renderDashboard();
  // admin.html 사이드 네비에서 전달된 대상 탭 1회 소비 (goToAppTab)
  try {
    var _pendingTab = localStorage.getItem('madi_pending_tab');
    if (_pendingTab !== null) {
      localStorage.removeItem('madi_pending_tab');
      var _ptIdx = parseInt(_pendingTab, 10);
      if (!isNaN(_ptIdx) && typeof switchTab === 'function') switchTab(_ptIdx);
    }
  } catch (e) {}
}
// ─── 대시보드 라우터 ───
// role 에 따라 페르소나별 컨테이너 하나만 보이게 하고 해당 렌더러 호출.
// 학부모는 별도 진입점(parentPanelHome/loadParentHome)이라 여기 안 들어옴.
function renderDashboard() {
  var hp = document.getElementById('panelHome');
  if (!hp || !hp.classList.contains('active')) return;

  var tEl = document.getElementById('dashTeacher');
  var aEl = document.getElementById('dashAdmin');
  var lEl = document.getElementById('dashLegacy');
  // 모두 숨김
  if (tEl) tEl.style.display = 'none';
  if (aEl) aEl.style.display = 'none';
  if (lEl) lEl.style.display = 'none';

  var role = (currentUser && currentUser.role) || '';
  // 학부모는 별도 진입점(parentPanelHome / loadParentHome)을 사용 → applyParentUI 가
  // 직후 panelHome 을 숨기므로 여기서는 아무 것도 그리지 않고 종료 (FOUC 방지)
  if (role === 'parent') return;

  if (role === 'teacher' && typeof renderDashboardTeacher === 'function') {
    if (tEl) tEl.style.display = '';
    renderDashboardTeacher();
    return;
  }
  if ((role === 'admin' || role === 'superadmin') && typeof renderDashboardAdmin === 'function') {
    if (aEl) aEl.style.display = '';
    renderDashboardAdmin();
    return;
  }
  // fallback — 알 수 없는 role 이거나 페르소나 렌더러 미정의면 레거시 단일 디자인
  if (lEl) lEl.style.display = '';
  renderDashboardLegacy();
}

// ─── 레거시 (이전 단일 디자인) — fallback 보존 ───
function renderDashboardLegacy() {
  var today=nowKST(); var todayStr=ymd(today);
  var wd=['일','월','화','수','목','금','토']; var h=today.getHours();
  var gr=h<12?'오늘도 좋은 하루 시작해요':h<18?'즐거운 오후 되세요':'오늘 하루도 수고하셨어요';
  var em=h<12?'🌅':h<18?'☀️':'🌙';
  var nm=(currentUser&&currentUser.name)||'';
  var wel=document.getElementById('dashWelcome'); var dt=document.getElementById('dashDate');
  var _role = (currentUser && currentUser.role) || '';
  var _roleLabel = _role === 'superadmin' ? '대장님 👑' : _role === 'admin' ? '원장님 🏥' : '선생님 👩‍⚕️';
  if(wel) wel.textContent=gr+', '+nm+' '+_roleLabel+'! '+em;
  if(dt) dt.textContent=todayStr.replace(/-/g,'.')+'('+wd[today.getDay()]+')';
  // 오늘의 일정
  var ts=scheduleDB.filter(function(s){return s.date===todayStr;});
  if(currentUser&&currentUser.role!=='admin') ts=ts.filter(function(s){return s.teacher===currentUser.name;});
  ts.sort(function(a,b){return (a.startTime||'')<(b.startTime||'')?-1:1;});
  var se=document.getElementById('dashTodaySched');
  var ms=document.getElementById('dashMiniStat'); if(ms) ms.textContent='오늘 일정 '+ts.length+'건';
  if(se){ if(!ts.length){se.innerHTML='<div class="dash-empty">오늘 등록된 일정이 없습니다</div>';}
  else{ se.innerHTML=ts.slice(0,5).map(function(s){
    var c=childDB.find(function(c){return c.id===s.childId;}); var cn=c?c.name:'?';
    var done=sessionDB.some(function(ss){return ss.childId===s.childId&&ss.date===s.date;});
    return '<div class="dash-sched-item'+(done?' done':'')+'"><span class="dash-sched-time">'+(s.startTime||'--:--')+'</span><span class="dash-sched-name">'+escHtml(cn)+'</span><span class="dash-badge '+(done?'done':'todo')+'">'+(done?'완료':'예정')+'</span></div>';
  }).join('')+(ts.length>5?'<div class="dash-more">+'+(ts.length-5)+'개 더</div>':'');}}
  // 아동 현황
  var st={'등록':0,'대기':0,'종결':0};
  childDB.forEach(function(c){if(st[c.status]!==undefined)st[c.status]++;});
  var stEl=document.getElementById('dashChildStat');
  if(stEl) stEl.innerHTML='<div class="dash-stat-row">'
    +'<div class="dash-stat-item"><div class="dash-stat-num mint">'+st['등록']+'</div><div class="dash-stat-lbl">등록</div></div>'
    +'<div class="dash-stat-item"><div class="dash-stat-num amber">'+st['대기']+'</div><div class="dash-stat-lbl">대기</div></div>'
    +'<div class="dash-stat-item"><div class="dash-stat-num gray">'+(st['종결']||0)+'</div><div class="dash-stat-lbl">종결</div></div>'
    +'<div class="dash-stat-item"><div class="dash-stat-num navy">'+childDB.length+'</div><div class="dash-stat-lbl">전체</div></div></div>';
  // 미작성 세션
  var uw=typeof getUnwrittenSessions==='function'?getUnwrittenSessions():[];
  if(currentUser&&currentUser.role!=='admin') uw=uw.filter(function(u){return u.teacher===currentUser.name;});
  var uwEl=document.getElementById('dashUnwritten');
  if(uwEl){ if(!uw.length){uwEl.innerHTML='<div class="dash-empty">✅ 미작성 세션 없음</div>';}
  else{ uwEl.innerHTML='<div class="dash-unwr-count">'+uw.length+'개 미작성</div>'
    +uw.slice(0,4).map(function(u){return '<div class="dash-unwr-item"><span>'+u.date+'</span><span>'+escHtml(u.childName)+'</span></div>';}).join('')
    +(uw.length>4?'<div class="dash-more">+'+(uw.length-4)+'개 더</div>':'');}}
  // 공지
  var nc=document.getElementById('dashNotices');
  if(nc){ if(!_bannerNotices||!_bannerNotices.length){nc.innerHTML='<div class="dash-empty">등록된 공지가 없습니다</div>';}
  else{ nc.innerHTML=_bannerNotices.slice(0,3).map(function(n){
    var ic=n.notice_type==='imp'?'🔴':n.notice_type==='pin'?'📌':'📢';
    return '<div class="dash-notice-item"><span style="font-size:13px;flex-shrink:0;">'+ic+'</span><span class="dash-notice-title">'+escHtml(n.title)+'</span></div>';
  }).join('');}}
}
var ALL_PANELS_NEW = ['panelHome','panel0','panel1','panel2','panel3','panel4','panel5','panel6','panel7','panel8',
                      'panelNotice','panelReport','panelPortfolio','panelService','panelUserSettings','panelBoard'];
var TAB_PANEL_MAP  = ['panel2','panel0','panelReport','panelPortfolio','panelService','panel8','panelUserSettings','panelBoard'];

// ─── 사이드바 active 동기화 ───
function syncSidebarActive(idx) {
  var ids = ['sbHome','sbTab0','sbTab1','sbTab2','sbTab3','sbTab4','sbTab5','sbTab6','sbTab7'];
  ids.forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.remove('active'); });
  if (idx === -1) { var h=document.getElementById('sbHome'); if(h) h.classList.add('active'); }
  else { var t=document.getElementById('sbTab'+idx); if(t) t.classList.add('active'); }
}
// ─── 사이드바 토글 (상태 localStorage 저장) ───
function toggleSidebar() {
  var sb = document.getElementById('appSidebar');
  if (!sb) return;
  sb.classList.toggle('collapsed');
  try { localStorage.setItem('madi_sidebar_collapsed', sb.classList.contains('collapsed') ? '1' : '0'); } catch(e) {}
}
// 페이지 로드 시 사이드바 상태 복원
function restoreSidebarState() {
  try {
    var saved = localStorage.getItem('madi_sidebar_collapsed');
    if (saved === '1') {
      var sb = document.getElementById('appSidebar');
      if (sb) sb.classList.add('collapsed');
    }
  } catch(e) {}
}
// ─── Breadcrumb 업데이트 ───
var _bcMap = { '-1':'', '0':'캘린더', '1':'아동 관리', '2':'보고서', '3':'포트폴리오', '4':'서비스 관리', '5':'관리자 설정', '6':'설정', '7':'게시판' };
function updateBreadcrumb(idx) {
  var sep = document.getElementById('bcSep');
  var cur = document.getElementById('bcCurrent');
  if (!sep || !cur) return;
  var label = _bcMap[String(idx)] || '';
  if (!label) { sep.style.display='none'; cur.textContent=''; }
  else { sep.style.display=''; cur.textContent=label; }
}
// 사이드바 관리자 메뉴 표시 (권한에 따라)
function updateSidebarAdminVisibility() {
  var isAdmin  = currentUser && (currentUser.role==='admin'||currentUser.role==='superadmin');
  var isSuper  = currentUser && currentUser.role==='superadmin';
  var s4=document.getElementById('sbTab4'); if(s4) s4.style.display=isAdmin?'':'none';
  var s5=document.getElementById('sbTab5'); if(s5) s5.style.display=isSuper?'':'none';
  var sd=document.getElementById('sbDividerAdmin'); if(sd) sd.style.display=isAdmin?'':'none';
}

function switchTab(idx) {
  // 뒤로가기 연동 — history에 현재 탭 저장
  try { history.pushState({ tab: idx }, '', window.location.pathname + window.location.search); } catch(e) {}
  // 아동 탭이 아닌 곳으로 이동 시 일괄 처리 모드 자동 종료
  if (typeof _bulkMode !== 'undefined' && _bulkMode && idx !== 1) {
    _bulkMode = false; _bulkSelected = {};
    var _bb = document.getElementById('bulkActionBar'); if (_bb) _bb.style.display = 'none';
    var _bt = document.getElementById('bulkToggleBtn'); if (_bt) _bt.classList.remove('active');
    document.body.classList.remove('bulk-mode');
  }
  // 모든 패널 숨기기
  ALL_PANELS_NEW.forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.classList.remove('active');
  });
  // 모든 서브패널 숨기기
  ['panel1','panel3','panel4','panel5','panel6','panel7'].forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.classList.remove('sub-active');
  });
  // 탭 버튼 초기화 (홈 버튼 포함)
  for (var i = 0; i < 7; i++) {
    var b = document.getElementById('tabBtn' + i);
    if (b) b.classList.remove('active');
  }
  var hb = document.getElementById('tabBtnHome');
  if (hb) hb.classList.remove('active');
  // 대상 패널 표시
  var targetId = TAB_PANEL_MAP[idx];
  if (!targetId) return;
  var tp = document.getElementById(targetId);
  if (tp) {
    // 로딩 스피너 표시
    tp.classList.add('active');
    if (!tp.dataset.loaded) {
      var _spinEl = document.createElement('div');
      _spinEl.className = 'loading'; _spinEl.id = 'tabSpinner_' + targetId;
      _spinEl.innerHTML = '<div class="spinner"></div><p>불러오는 중...</p>';
      _spinEl.style.position = 'absolute'; _spinEl.style.top = '80px';
      _spinEl.style.left = '50%'; _spinEl.style.transform = 'translateX(-50%)';
      _spinEl.style.zIndex = '10'; _spinEl.style.pointerEvents = 'none';
      tp.style.position = 'relative';
      tp.appendChild(_spinEl);
      setTimeout(function() { var s = document.getElementById('tabSpinner_' + targetId); if (s) s.remove(); }, 400);
    }
  }
  var tb = document.getElementById('tabBtn' + idx);
  if (tb) tb.classList.add('active');
  syncSidebarActive(idx);
  updateBreadcrumb(idx);

  // 배너: 캘린더 탭에서만 표시
  var banner = document.getElementById('noticeBanner');
  if (banner && !_bannerClosed) {
    if (idx === 0 && _bannerNotices.length > 0) {
      banner.style.display = 'block';
      _renderBannerSlide();
      if (_bannerTimer) clearInterval(_bannerTimer);
      if (_bannerNotices.length > 1) {
        _bannerTimer = setInterval(function() {
          _bannerIdx = (_bannerIdx + 1) % _bannerNotices.length;
          _renderBannerSlide();
        }, 5000);
      }
    } else {
      banner.style.display = 'none';
      if (_bannerTimer) { clearInterval(_bannerTimer); _bannerTimer = null; }
    }
  }

  // 탭별 후처리
  if (idx === 0) {
    // 캘린더관리
    populateChildSelects();
    renderSchedView();
    checkUpcomingSessionBriefing();
  }
  if (idx === 1) {
    // 아동관리 (기본탭)
    populateChildSelects();
  }
  if (idx === 2) {
    // 보고서
    populateChildSelects();
    switchReportTab(currentReportTab || 'session');
  }
  if (idx === 3) {
    // 포트폴리오
    populateChildSelects();
    switchPortfolioTab(currentPortfolioTab || 'trend');
  }
  if (idx === 4) {
    var f4 = document.getElementById('adminServiceFrame');
    if (f4 && !f4.src.includes('admin.html')) f4.src = 'admin.html?tab=service&embedded=1';
  }
  if (idx === 5) {
    var f5 = document.getElementById('adminSettingsFrame');
    if (f5 && !f5.src.includes('admin.html')) f5.src = 'admin.html?tab=settings&embedded=1';
  }
  if (idx === 6) { initUserSettings(); }
  if (idx === 7) { if (typeof initBoard === 'function') initBoard(); }
}

// ─── 보고서 서브탭 ───
var currentReportTab = 'session';
function switchReportTab(sub) {
  currentReportTab = sub;
  ['panel1','panel3','panel5','panel4','panel6','panel7','panelSI'].forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.classList.remove('sub-active');
  });
  ['rtBtn_session','rtBtn_assess','rtBtn_report','rtBtn_si'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  var target = null, btnId = null;
  if (sub === 'session') {
    target = 'panel1'; btnId = 'rtBtn_session';
    populateChildSelects(); renderSessionList(); renderUnwrittenAlert();
  } else if (sub === 'assess') {
    target = 'panel3'; btnId = 'rtBtn_assess';
    populateChildSelects(); renderAssessmentList(); renderAssessFields();
  } else if (sub === 'report') {
    target = 'panel5'; btnId = 'rtBtn_report';
    populateChildSelects();
  } else if (sub === 'si') {
    target = 'panelSI'; btnId = 'rtBtn_si';
    if (typeof renderSIReport === 'function') renderSIReport();
  }
  if (target) { var p = document.getElementById(target); if (p) p.classList.add('sub-active'); }
  if (btnId)  { var b = document.getElementById(btnId);  if (b) b.classList.add('active'); }
}

// ─── 포트폴리오 서브탭 ───
var currentPortfolioTab = 'trend';
function switchPortfolioTab(sub) {
  currentPortfolioTab = sub;
  ['panel4','panel6','panel7','panel1','panel3','panel5'].forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.classList.remove('sub-active');
  });
  ['ptBtn_trend','ptBtn_portfolio','ptBtn_ai'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  var target = null, btnId = null;
  if (sub === 'trend') {
    target = 'panel4'; btnId = 'ptBtn_trend';
    populateChildSelects(); renderChart();
  } else if (sub === 'portfolio') {
    target = 'panel6'; btnId = 'ptBtn_portfolio';
    populateChildSelects();
  } else if (sub === 'ai') {
    target = 'panel7'; btnId = 'ptBtn_ai';
    populateChildSelects(); renderEffectStats();
  }
  if (target) { var p = document.getElementById(target); if (p) p.classList.add('sub-active'); }
  if (btnId)  { var b = document.getElementById(btnId);  if (b) b.classList.add('active'); }
}

// ─── 공지 배너 ───
var _bannerNotices = [];
var _bannerIdx = 0;
var _bannerTimer = null;
var _bannerClosed = false;

function startNoticeBanner(notices) {
  _bannerNotices = (notices || []).filter(function(n){ return n.title; });
  if (_bannerTimer) { clearInterval(_bannerTimer); _bannerTimer = null; }
  if (!_bannerNotices.length) {
    var banner = document.getElementById('noticeBanner');
    if (banner) banner.style.display = 'none';
    return;
  }
  var banner = document.getElementById('noticeBanner');
  if (!banner || _bannerClosed) return;

  // 배너는 탭 패널 바깥(탭바 아래)에 위치해 어느 탭에서든 표시 가능
  // 홈 탭이나 캘린더 탭 active일 때만 표시
  var panelHome = document.getElementById('panelHome');
  var calBtn    = document.getElementById('tabBtn0');
  var homeActive = panelHome && panelHome.classList.contains('active');
  var calActive  = calBtn && calBtn.classList.contains('active');

  if (homeActive || calActive) {
    banner.style.display = 'block';
    _bannerIdx = 0;
    _renderBannerSlide();
    if (_bannerNotices.length > 1) {
      _bannerTimer = setInterval(function() {
        _bannerIdx = (_bannerIdx + 1) % _bannerNotices.length;
        _renderBannerSlide();
      }, 5000);
    }
  } else {
    banner.style.display = 'none';
  }
}

function _renderBannerSlide() {
  var textEl = document.getElementById('noticeBannerText');
  var dotsEl = document.getElementById('noticeBannerDots');
  if (!textEl || !_bannerNotices.length) return;

  // 페이드 아웃 → 텍스트 교체 → 페이드 인
  textEl.classList.add('fade');
  setTimeout(function() {
    var n = _bannerNotices[_bannerIdx];
    var badge = n.notice_type === 'imp' ? '[긴급] ' : (n.notice_type === 'pin' ? '[중요] ' : '');
    textEl.textContent = badge + n.title;
    textEl.classList.remove('fade');
  }, 400);

  // 점 인디케이터
  if (dotsEl) {
    dotsEl.innerHTML = _bannerNotices.map(function(_, i) {
      return '<div class="notice-banner-dot' + (i === _bannerIdx ? ' active' : '') + '"></div>';
    }).join('');
  }
}

function closeNoticeBanner() {
  _bannerClosed = true;
  if (_bannerTimer) { clearInterval(_bannerTimer); _bannerTimer = null; }
  var banner = document.getElementById('noticeBanner');
  if (banner) banner.style.display = 'none';
}

// ─── 공지사항 ───
var noticeDB = [];
function loadNotices() {
  var listEl = document.getElementById('noticeList');
  if (!currentUser) {
    if (listEl) listEl.innerHTML = '<div class="empty"><p>로그인 후 확인하세요.</p></div>';
    return;
  }
  if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:13px;">불러오는 중...</div>';
  var centerId = encodeURIComponent(currentUser.center_id || '');
  return supaFetch('madi_notices?center_id=eq.' + centerId + '&order=pinned.desc,created_at.desc&limit=50', 'GET')
    .then(function(data) {
      noticeDB = Array.isArray(data) ? data : [];
      if (listEl) renderNoticeList();
      startNoticeBanner(noticeDB);
    })
    .catch(function(e) {
      if (listEl) listEl.innerHTML = '<div class="empty"><p>공지 테이블이 아직 없거나 오류가 발생했습니다.<br><small>' + escHtml(e.message||'') + '</small></p></div>';
    });
}
function renderNoticeList() {
  var listEl = document.getElementById('noticeList');
  if (!listEl) return;
  if (!noticeDB.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">📢</div><p>등록된 공지가 없습니다.</p></div>';
    return;
  }
  var html = noticeDB.map(function(n) {
    var typeClass = n.notice_type === 'imp' ? 'important' : (n.notice_type === 'pin' ? 'pinned' : '');
    var badgeClass = n.notice_type === 'imp' ? 'imp' : (n.notice_type === 'pin' ? 'pin' : 'info');
    var badgeText  = n.notice_type === 'imp' ? '🚨 긴급' : (n.notice_type === 'pin' ? '📍 중요' : '📌 일반');
    var dateStr = n.created_at ? n.created_at.slice(0,10) : '';
    // 권한: admin 또는 superadmin 모두 삭제 가능
    var canDelete = getRoleFlags().isAdminOrSuper;
    var delBtn = canDelete
      ? '<button data-nid="' + n.id + '" onclick="deleteNotice(this.dataset.nid)" style="font-size:11px;color:var(--red);background:none;border:none;cursor:pointer;padding:2px 6px;">삭제</button>'
      : '';
    // ★ escHtml 처리: 사용자가 입력한 문자열에 특수문자가 있어도 HTML/JS 깨지지 않도록
    var safeTitle  = escHtml(n.title  || '');
    var safeContent = escHtml(n.content || '');
    var safeAuthor = escHtml(n.author_name || '');
    return '<div class="notice-card ' + typeClass + '">'
      + '<span class="notice-badge ' + badgeClass + '">' + badgeText + '</span>'
      + (delBtn ? '<span style="float:right;">' + delBtn + '</span>' : '')
      + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">' + safeTitle + '</div>'
      + '<div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap;">' + safeContent + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:8px;">' + dateStr + (n.author_name ? ' · ' + safeAuthor : '') + '</div>'
      + '</div>';
  }).join('');
  listEl.innerHTML = html;
}
function saveNotice() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) return;
  var title   = (document.getElementById('noticeTitle')   || {value:''}).value.trim();
  var content = (document.getElementById('noticeContent') || {value:''}).value.trim();
  var ntype   = (document.getElementById('noticeType')    || {value:'info'}).value;
  if (!title || !content) { showToast('⚠️ 제목과 내용을 모두 입력해 주세요'); return; }
  return supaFetch('madi_notices', 'POST', [{
    center_id: currentUser.center_id,
    notice_type: ntype,
    pinned: ntype !== 'info',
    title: title,
    content: content,
    author_id: currentUser.id,
    author_name: currentUser.name
  }]).then(function(saved) {
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    showToast('✅ 공지가 등록됐습니다');
    loadNotices();
    fanoutNoticeNotifications(saved, title, ntype);
  }).catch(function(e) {
    showToast('❌ 저장 실패: ' + (e.message||''));
  });
}

// 공지 등록 시 학부모 전체에게 알림 row 자동 생성 (Phase 1A)
function fanoutNoticeNotifications(savedNotice, title, ntype) {
  return supaFetch(
    'madi_users?center_id=eq.' + encodeURIComponent(currentUser.center_id||'')
      + '&role=eq.parent&select=id',
    'GET'
  ).then(function(parents) {
    if (!Array.isArray(parents) || parents.length === 0) return;
    var noticeId = Array.isArray(savedNotice) && savedNotice[0] ? savedNotice[0].id : null;
    var icon = ntype === 'imp' ? '🚨' : (ntype === 'pin' ? '📍' : '📌');
    var rows = parents.map(function(p){
      return {
        user_id: p.id,
        center_id: currentUser.center_id,
        type: 'notice',
        title: icon + ' 새 공지: ' + title.slice(0, 40),
        body: null,
        link: noticeId ? ('notice/' + noticeId) : null
      };
    });
    return supaFetch('madi_notifications', 'POST', rows);
  }).catch(function(e) {
    if (window.console && console.warn) console.warn('[fanout fail]', e.message||e);
  });
}

// 세션 저장 시 해당 아동의 학부모에게 알림 row 자동 생성 (Phase 1A - session 통합)
function fanoutSessionNotification(session) {
  if (!session || !session.childId) return;
  var cid = (currentUser && currentUser.center_id)
            || (typeof getCenterId === 'function' ? getCenterId() : '');
  if (!cid) return;

  return supaFetch(
    'madi_parent_children?child_id=eq.' + encodeURIComponent(session.childId)
      + '&center_id=eq.' + encodeURIComponent(cid)
      + '&select=parent_user_id',
    'GET'
  ).then(function(parents) {
    if (!Array.isArray(parents) || parents.length === 0) return;
    var goals = Array.isArray(session.goals) ? session.goals : [];
    var scores = goals.map(function(g){ return typeof g.score === 'number' ? g.score : null; })
                      .filter(function(s){ return s !== null; });
    var avg = scores.length > 0
              ? Math.round(scores.reduce(function(a,b){ return a+b; }, 0) / scores.length)
              : null;
    var bodyParts = [];
    if (goals.length > 0) bodyParts.push('목표 ' + goals.length + '개');
    if (avg !== null)     bodyParts.push('평균 ' + avg + '%');
    var bodyText = bodyParts.length > 0 ? bodyParts.join(' · ') : null;
    var rows = parents.map(function(p){
      return {
        user_id: p.parent_user_id,
        center_id: cid,
        type: 'session',
        title: '🎯 새 세션 기록 도착',
        body: bodyText,
        link: session.id ? ('session/' + session.id) : null
      };
    });
    return supaFetch('madi_notifications', 'POST', rows);
  }).catch(function(e) {
    if (window.console && console.warn) console.warn('[fanoutSession fail]', e.message||e);
  });
}

function deleteNotice(id) {
  showConfirm('이 공지를 삭제할까요?', function() {
    supaFetch('madi_notices?id=eq.' + encodeURIComponent(id), 'DELETE')
      .then(function() {
        showToast('🗑️ 공지가 삭제됐습니다');
        loadNotices();
      }).catch(function(e) {
        showToast('❌ 삭제 실패: ' + (e.message||''));
      });
  });
}

// ─── 서비스관리 ───
// ════════════════════════════════════════
// 사용자 설정 탭 기능
// ════════════════════════════════════════
var _wakeLock = null;
var _pwaInstallPrompt = null;

// 설정 탭 진입 초기화
function initUserSettings() {
  updateSettingsUI();
}

// 설정 UI 전체 동기화
function updateSettingsUI() {
  // 다크모드 토글
  var dm = document.getElementById('settingDarkMode');
  if (dm) {
    var isDark = document.body.classList.contains('dark-mode');
    dm.className = 'toggle-pill' + (isDark ? ' on' : '');
    dm.textContent = isDark ? '켜짐' : '꺼짐';
  }
  // 글자 크기 세그먼트
  var size = localStorage.getItem('madi_font_size') || 'medium';
  ['small','medium','large'].forEach(function(s) {
    var btn = document.getElementById('fs_' + s);
    if (btn) btn.className = 'seg-btn' + (size === s ? ' active' : '');
  });
  // Wake Lock 토글
  var wl = document.getElementById('settingWakeLock');
  if (wl) {
    var wlOn = _wakeLock !== null;
    wl.className = 'toggle-pill' + (wlOn ? ' on' : '');
    wl.textContent = wlOn ? '켜짐' : '꺼짐';
  }
  // Wake Lock 미지원 기기 행 숨김
  var wlRow = document.getElementById('wakeLockRow');
  if (wlRow) wlRow.style.display = ('wakeLock' in navigator) ? '' : 'none';
  // 진동 토글
  var ht = document.getElementById('settingHaptic');
  if (ht) {
    var hapticOn = localStorage.getItem('madi_haptic') !== '0';
    ht.className = 'toggle-pill' + (hapticOn ? ' on' : '');
    ht.textContent = hapticOn ? '켜짐' : '꺼짐';
  }
  // 진동 미지원 기기 행 숨김
  var htRow = document.getElementById('hapticRow');
  if (htRow) htRow.style.display = ('vibrate' in navigator) ? '' : 'none';
  // 시작 탭
  var st = document.getElementById('startTabSelect');
  if (st) st.value = localStorage.getItem('madi_start_tab') || '0';
}

// ── 글자 크기 ──
function setFontSize(size) {
  localStorage.setItem('madi_font_size', size);
  document.body.classList.remove('font-small','font-large');
  if (size === 'small') document.body.classList.add('font-small');
  if (size === 'large') document.body.classList.add('font-large');
  updateSettingsUI();
  var labels = { small:'작게', medium:'기본', large:'크게' };
  showToast('🔤 글자 크기: ' + (labels[size] || '기본'));
}

// ── 화면 항상 켜짐 ──
function toggleWakeLock() {
  if (!('wakeLock' in navigator)) {
    showToast('❌ 이 기기에서는 지원되지 않아요');
    return;
  }
  if (_wakeLock) {
    _wakeLock.release().catch(function(e){if(window.console&&console.warn)console.warn('[silent madi-03]',e&&e.message);});
    _wakeLock = null;
    showToast('💡 화면 자동 꺼짐 복원됐어요');
    updateSettingsUI();
  } else {
    navigator.wakeLock.request('screen').then(function(lock) {
      _wakeLock = lock;
      lock.addEventListener('release', function() { _wakeLock = null; updateSettingsUI(); });
      showToast('💡 화면이 꺼지지 않아요');
      updateSettingsUI();
    }).catch(function(e) {
      showToast('❌ 설정 실패: ' + (e.message || '오류'));
    });
  }
}

// ── 진동 피드백 ──
function toggleHaptic() {
  var current = localStorage.getItem('madi_haptic') !== '0';
  var next = !current;
  localStorage.setItem('madi_haptic', next ? '1' : '0');
  if (next && navigator.vibrate) navigator.vibrate([20, 40, 20]);
  showToast(next ? '📳 진동 피드백 켜짐' : '📳 진동 피드백 꺼짐');
  updateSettingsUI();
}

// ── 시작 탭 ──
function setStartTab(val) {
  localStorage.setItem('madi_start_tab', val);
  var names = ['캘린더','아동 관리','보고서','성장기록'];
  showToast('🏁 시작 탭: ' + (names[parseInt(val,10)] || '캘린더'));
}

// ── PWA 홈 화면 추가 ──
function showPWAInstall() {
  if (_pwaInstallPrompt) {
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(function(r) {
      if (r.outcome === 'accepted') { showToast('✅ 앱 설치됐어요!'); _pwaInstallPrompt = null; }
    });
    return;
  }
  var modal = document.getElementById('pwaGuideModal');
  if (modal) modal.style.display = 'flex';
}
function closePWAGuide() {
  var modal = document.getElementById('pwaGuideModal');
  if (modal) modal.style.display = 'none';
}

// ── 비밀번호 변경 ──
function changeMyPassword() {
  var oldPw  = (document.getElementById('oldPassword')  || {}).value || '';
  var newPw  = (document.getElementById('newPassword')  || {}).value || '';
  var newPw2 = (document.getElementById('newPassword2') || {}).value || '';
  var result = document.getElementById('pwChangeResult');
  function setResult(html) { if (result) result.innerHTML = html; }

  if (!oldPw || !newPw || !newPw2) { setResult('<span style="color:var(--red);">❌ 모든 항목을 입력해주세요.</span>'); return; }
  if (newPw !== newPw2)            { setResult('<span style="color:var(--red);">❌ 새 비밀번호가 일치하지 않아요.</span>'); return; }
  var pwErr = validatePasswordStrength(newPw);
  if (pwErr)                       { setResult('<span style="color:var(--red);">❌ ' + escHtml(pwErr) + '</span>'); return; }

  setResult('<span style="color:var(--text2);">변경 중...</span>');

  hashPassword(oldPw)
    .then(function(oldHash) {
      return supaFetch('madi_users?id=eq.' + encodeURIComponent(currentUser.id) + '&password=eq.' + encodeURIComponent(oldHash) + '&select=id', 'GET');
    })
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('현재 비밀번호가 올바르지 않아요.');
      return hashPassword(newPw);
    })
    .then(function(newHash) {
      return supaFetch('madi_users?id=eq.' + encodeURIComponent(currentUser.id), 'PATCH', { password: newHash });
    })
    .then(function() {
      setResult('<span style="color:var(--green);">✅ 비밀번호가 변경됐어요!</span>');
      document.getElementById('oldPassword').value  = '';
      document.getElementById('newPassword').value  = '';
      document.getElementById('newPassword2').value = '';
    })
    .catch(function(err) {
      setResult('<span style="color:var(--red);">❌ ' + escHtml(err.message || '변경 실패') + '</span>');
    });
}

// ═══════════════════════════════════════════════════════════════════════
// 페르소나별 대시보드 렌더러 (Teacher ⑥ / Admin ⑧)
// - 미리보기: design-previews/06-teacher-home.html, 08-admin-home.html
// - 진입: renderDashboard() → role 분기
// - 학부모는 별도 진입(parentPanelHome / loadParentHome) 사용
// ═══════════════════════════════════════════════════════════════════════

// 공통 유틸 — 이름 첫 글자 + 결정론적 아바타 색상 클래스
function _dpInitial(name) {
  var s = (name || '?').trim();
  return s ? s.charAt(0) : '?';
}
function _dpAvatarClass(seed) {
  var s = String(seed || '');
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return 'dp-av-' + ((Math.abs(h) % 6) + 1);
}
function _dpMonday(d) {
  var x = new Date(d);
  var day = x.getDay(); // 0=일
  var diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}
function _dpSunday(d) {
  var m = _dpMonday(d);
  m.setDate(m.getDate() + 6);
  return m;
}
function _dpFmtMD(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
function _dpAge(birthYmd) {
  if (!birthYmd) return null;
  var b = new Date(birthYmd);
  if (isNaN(b.getTime())) return null;
  var now = nowKST();
  var a = now.getFullYear() - b.getFullYear();
  var m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}
function _dpGreetingFor(name, role) {
  var h = nowKST().getHours();
  var em = h < 12 ? '☕' : h < 18 ? '☀️' : '🌙';
  var head = h < 12 ? '좋은 아침이에요' : h < 18 ? '즐거운 오후 되세요' : '오늘 하루도 수고하셨어요';
  var roleLabel = role === 'superadmin' ? '👑' : role === 'admin' ? '🎯' : '👩‍⚕️';
  return head + ', ' + escHtml(name || '') + '님 ' + roleLabel + ' ' + em;
}
function _dpTodayBanner() {
  var t = nowKST();
  var wd = ['일','월','화','수','목','금','토'];
  return t.getFullYear() + '년 ' + (t.getMonth()+1) + '월 ' + t.getDate() + '일 ' + wd[t.getDay()] + '요일';
}

// 데이터 갱신 시각 표시 — _dataLoadedAt 기반
function _dpFreshnessLabel() {
  var ts = window._dataLoadedAt;
  if (!ts) return '';
  var d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5)   return '데이터 갱신: 방금 전';
  if (d < 60)  return '데이터 갱신: ' + d + '초 전';
  if (d < 3600) return '데이터 갱신: ' + Math.floor(d/60) + '분 전';
  return '데이터 갱신: ' + Math.floor(d/3600) + '시간 전';
}

// ────────────────────────────────────────────────────────────────
// Teacher 홈 (⑥)
// ────────────────────────────────────────────────────────────────
function renderDashboardTeacher() {
  var root = document.getElementById('dashTeacher');
  if (!root) return;
  // 안전 가드 — 전역 DB 미초기화 / 빈 배열 케이스 모두 안전
  var _children = (typeof childDB !== 'undefined' && Array.isArray(childDB)) ? childDB : [];
  var _sessions = (typeof sessionDB !== 'undefined' && Array.isArray(sessionDB)) ? sessionDB : [];
  var _schedules = (typeof scheduleDB !== 'undefined' && Array.isArray(scheduleDB)) ? scheduleDB : [];
  var _assessments = (typeof assessmentDB !== 'undefined' && Array.isArray(assessmentDB)) ? assessmentDB : [];
  var myName = (currentUser && currentUser.name) || '';
  var todayStr = ymd(nowKST());
  var today = nowKST(); today.setHours(0,0,0,0);
  var mon = _dpMonday(today), sun = _dpSunday(today);
  var monStr = ymd(mon), sunStr = ymd(sun);

  // 데이터 계산
  var mySched = _schedules.filter(function(s){ return s.teacher === myName; });
  var mySession = _sessions.filter(function(s){ return s.teacher === myName; });
  var todaySched = mySched.filter(function(s){ return s.date === todayStr; })
    .sort(function(a,b){ return (a.startTime||'') < (b.startTime||'') ? -1 : 1; });

  // 내 담당 아동 (등록 상태 + 내가 일정/세션 기록한 적 있는 아동)
  var myChildIds = {};
  mySched.forEach(function(s){ if (s.childId) myChildIds[s.childId] = true; });
  mySession.forEach(function(s){ if (s.childId) myChildIds[s.childId] = true; });
  var myChildren = _children.filter(function(c){ return myChildIds[c.id] && c.status !== '종결'; });

  // 이번 주 작성률 — 미래 일정은 분모에서 제외 (작성 의무 도래 전)
  var weekSched = mySched.filter(function(s){ return s.date >= monStr && s.date <= sunStr; });
  var weekSchedDue = weekSched.filter(function(s){ return s.date <= todayStr; }); // 오늘까지 도래한 일정
  var weekSchedFuture = weekSched.length - weekSchedDue.length;
  var weekDone = weekSchedDue.filter(function(s){
    return _sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
  }).length;
  var weekPending = weekSchedDue.length - weekDone;
  var weekRatePct = weekSchedDue.length > 0 ? Math.round(weekDone / weekSchedDue.length * 100) : null;

  // 미작성 세션 (내 것만)
  var unwrittenAll = (typeof getUnwrittenSessions === 'function') ? getUnwrittenSessions() : [];
  var unwritten = (Array.isArray(unwrittenAll) ? unwrittenAll : []).filter(function(u){ return u.teacher === myName; });

  // 최근 만난 순 4명 (오늘 일정 우선, 그다음 최근 세션 날짜)
  var lastMet = {};
  mySession.forEach(function(s){
    if (!s.childId) return;
    if (!lastMet[s.childId] || lastMet[s.childId] < s.date) lastMet[s.childId] = s.date;
  });
  mySched.forEach(function(s){
    if (!s.childId || s.date > todayStr) return;
    if (!lastMet[s.childId] || lastMet[s.childId] < s.date) lastMet[s.childId] = s.date;
  });
  var recentChildren = myChildren.slice().sort(function(a,b){
    return (lastMet[b.id] || '') < (lastMet[a.id] || '') ? -1 : 1;
  }).slice(0,4);

  // 이번 주 활동 요약
  var thisWeekSessions = mySession.filter(function(s){ return s.date >= monStr && s.date <= sunStr; });
  var thisWeekEvals = _assessments.filter(function(a){ return a.teacher === myName && a.date >= monStr && a.date <= sunStr; });

  // ── HTML ──
  var titleText = _dpGreetingFor(myName, 'teacher');
  var nearest = todaySched.length ? todaySched.find(function(s){ return !_sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; }); }) || todaySched[0] : null;
  var nearestChild = nearest ? _children.find(function(c){ return c.id === nearest.childId; }) : null;
  var subText = todaySched.length === 0
    ? '오늘 예정된 세션은 없어요. 다음 주 일정을 미리 확인해 보세요.'
    : '오늘 <b>' + todaySched.length + '건</b>의 세션이 예정되어 있어요.'
      + (nearest ? ' 가장 가까운 일정은 <b>' + escHtml((nearest.startTime||'').slice(0,5)) + ' ' + escHtml(nearestChild ? nearestChild.name : '?') + '</b>예요.' : '');

  var freshness = _dpFreshnessLabel();
  var html = ''
    + '<div class="dp-head">'
    +   '<div class="dp-greeting">' + escHtml(_dpTodayBanner()) + (freshness ? ' · <span style="color:#94a3b8;">' + escHtml(freshness) + '</span>' : '') + '</div>'
    +   '<h1 class="dp-title">' + titleText + '</h1>'
    +   '<p class="dp-sub">' + subText + '</p>'
    + '</div>';

  // 시급 배너 (미작성 있을 때만)
  if (unwritten.length > 0) {
    var sample = unwritten.slice(0,3).map(function(u){ return u.date.slice(5).replace('-','/') + ' (' + escHtml(u.childName) + ')'; }).join(', ');
    html += ''
      + '<div class="dp-urgent">'
      +   '<div class="dp-urgent-ic">⚠️</div>'
      +   '<div class="dp-urgent-info">'
      +     '<div class="dp-urgent-title">미작성 세션 ' + unwritten.length + '건이 있어요</div>'
      +     '<div class="dp-urgent-text">' + sample + (unwritten.length > 3 ? ' 외 ' + (unwritten.length - 3) + '건' : '') + ' 세션 기록이 작성 대기 중입니다.</div>'
      +   '</div>'
      +   '<button class="dp-urgent-action" onclick="switchTab(2)">→ 지금 작성</button>'
      + '</div>';
  }

  // KPI 4개
  var todayTimesShort = todaySched.slice(0,3).map(function(s){ return (s.startTime||'').slice(0,5); }).filter(Boolean).join(' · ');
  html += ''
    + '<div class="dp-kpi-grid">'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-blue">👶</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">내 담당 아동</div>'
    +     '<div class="dp-kpi-num">' + myChildren.length + '<em> 명</em></div>'
    +     '<div class="dp-kpi-delta flat">전체 ' + _children.length + '명 중</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-green">📅</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">오늘 세션</div>'
    +     '<div class="dp-kpi-num">' + todaySched.length + '<em> 건</em></div>'
    +     '<div class="dp-kpi-delta flat">' + (todayTimesShort || '없음') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-purple">📝</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">이번 주 작성</div>'
    +     '<div class="dp-kpi-num">' + weekDone + '<em> / ' + weekSchedDue.length + (weekRatePct != null ? ' · ' + weekRatePct + '%' : '') + '</em></div>'
    +     '<div class="dp-kpi-delta ' + (weekPending ? 'warn' : 'flat') + '">' + (weekPending ? weekPending + '건 미작성' : (weekSchedDue.length ? '모두 작성 완료' : '도래한 일정 없음')) + (weekSchedFuture ? ' · 남은 일정 ' + weekSchedFuture + '건' : '') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-rose">💬</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">답변 대기 메시지</div>'
    +     '<div class="dp-kpi-num" id="dpTeacherMsgKpi">-<em> 건</em></div>'
    +     '<div class="dp-kpi-delta flat" id="dpTeacherMsgKpiSub">불러오는 중...</div>'
    +   '</div></div>'
    + '</div>';

  // 2열: 오늘 타임라인 + 받은 메시지
  var wd = ['일','월','화','수','목','금','토'];
  var weekNum = Math.ceil(((today - new Date(today.getFullYear(), 0, 1)) / 86400000 + new Date(today.getFullYear(),0,1).getDay() + 1) / 7);
  var doneCnt = todaySched.filter(function(s){ return _sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; }); }).length;

  html += '<div class="dp-grid-2">';

  // 오늘 일정 패널
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📅 오늘의 일정</div>'
    +       '<div class="dp-panel-sub">' + (todaySched.length ? todaySched.length + '개 세션' : '오늘 일정 없음') + '</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(0)">주간 보기 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-day-sum">'
    +       '<div class="dp-day-num">' + today.getDate() + '</div>'
    +       '<div class="dp-day-text"><b>' + wd[today.getDay()] + '요일</b>' + today.getFullYear() + '년 ' + (today.getMonth()+1) + '월 · ' + weekNum + '주차</div>'
    +       '<div class="dp-day-right">예정 <b>' + todaySched.length + '</b> · 완료 <b>' + doneCnt + '</b></div>'
    +     '</div>';

  if (todaySched.length === 0) {
    html += '<div class="dp-empty">오늘 예정된 세션이 없습니다</div>';
  } else {
    html += todaySched.slice(0, 6).map(function(s){
      var c = _children.find(function(cc){ return cc.id === s.childId; });
      var nm = c ? c.name : '?';
      var done = _sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
      var st = (s.startTime || '').slice(0,5);
      var et = (s.endTime || '').slice(0,5);
      var age = c ? _dpAge(c.birth) : null;
      var meta = (c ? (c.type || '') : '') + (age ? (c && c.type ? ' · ' : '') + age + '세' : '');
      var tag = done ? '<span class="dp-tl-tag done">완료</span>' : '<span class="dp-tl-tag upcoming">예정</span>';
      var cls = done ? 'done' : 'upcoming';
      return ''
        + '<div class="dp-tl-row ' + cls + '" onclick="switchTab(2)">'
        +   '<div class="dp-tl-time">' + escHtml(st || '--:--') + (et ? '<em>~ ' + escHtml(et) + '</em>' : '') + '</div>'
        +   '<div class="dp-tl-dot"></div>'
        +   '<div class="dp-tl-card">'
        +     '<div class="dp-tl-av ' + _dpAvatarClass(nm) + '">' + escHtml(_dpInitial(nm)) + '</div>'
        +     '<div class="dp-tl-info">'
        +       '<div class="dp-tl-name">' + escHtml(nm) + '</div>'
        +       '<div class="dp-tl-meta">' + escHtml(meta || '세션') + '</div>'
        +     '</div>'
        +     tag
        +   '</div>'
        + '</div>';
    }).join('');
    if (todaySched.length > 6) html += '<div class="dp-empty" style="padding:8px;">+ ' + (todaySched.length - 6) + '개 더</div>';
  }
  html += '</div></div>';

  // 답변 대기 메시지 (async — placeholder 후 채움)
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">💬 답변 대기 메시지</div>'
    +       '<div class="dp-panel-sub">받은 메시지 · 미응답</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(7)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body" id="dpTeacherMsgs">'
    +     '<div class="dp-empty">불러오는 중...</div>'
    +   '</div>'
    + '</div>';
  html += '</div>'; // grid-2 end

  // 내 담당 아동 (가로 카드 4개)
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">👥 내 담당 아동</div>'
    +       '<div class="dp-panel-sub">최근 만난 순 · 총 ' + myChildren.length + '명</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(1)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">';
  if (recentChildren.length === 0) {
    html += '<div class="dp-empty">담당 중인 아동이 없습니다.<br>일정·세션 기록을 시작하면 여기에 표시됩니다.</div>';
  } else {
    html += '<div class="dp-children">' + recentChildren.map(function(c){
      var age = _dpAge(c.birth);
      var nm = c.name || '?';
      var last = lastMet[c.id];
      var lastText = last
        ? (last === todayStr ? '<b>오늘</b> 만남' : '<b>' + last.slice(5).replace('-','/') + '</b> 마지막 만남')
        : '<b>일정 미등록</b>';
      var meta = [c.type, age ? age + '세' : ''].filter(Boolean).join(' · ');
      return ''
        + '<div class="dp-child" onclick="openChildDetail(' + c.id + ')">'
        +   '<div class="dp-child-head">'
        +     '<div class="dp-child-av ' + _dpAvatarClass(nm) + '">' + escHtml(_dpInitial(nm)) + '</div>'
        +     '<div style="flex:1;min-width:0;">'
        +       '<div class="dp-child-name">' + escHtml(nm) + '</div>'
        +       '<div class="dp-child-meta">' + escHtml(meta || c.status || '등록') + '</div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="dp-child-last">' + lastText + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }
  html += '</div></div>';

  // 하단 2열: 이번 주 활동 + 빠른 액션
  html += '<div class="dp-grid-2-eq">';

  // 이번 주 활동
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📊 내 이번 주 활동</div>'
    +       '<div class="dp-panel-sub">' + _dpFmtMD(mon) + ' ~ ' + _dpFmtMD(sun) + '</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-week">'
    +       '<div class="dp-week-item"><div class="dp-week-num">' + thisWeekSessions.length + '</div><div class="dp-week-label">완료 세션</div></div>'
    +       '<div class="dp-week-item"><div class="dp-week-num">' + thisWeekEvals.length + '</div><div class="dp-week-label">평가 완료</div></div>'
    +       '<div class="dp-week-item"><div class="dp-week-num">' + weekSched.length + '</div><div class="dp-week-label">주간 일정</div></div>'
    +       '<div class="dp-week-item"><div class="dp-week-num ' + (weekPending ? '' : '') + '">' + weekPending + '</div><div class="dp-week-label">미작성</div></div>'
    +     '</div>'
    +     (weekSchedFuture ? '<div style="margin-top:10px;font-size:11px;color:#94a3b8;text-align:center;">남은 일정 ' + weekSchedFuture + '건은 아직 작성 의무 도래 전이에요</div>' : '')
    +   '</div>'
    + '</div>';

  // 빠른 액션
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">⚡ 빠른 액션</div>'
    +       '<div class="dp-panel-sub">자주 쓰는 작업</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:none;cursor:pointer;" onclick="switchTab(2)">'
    +       '<div class="dp-tl-av dp-av-2">📝</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">세션 기록 작성</div><div class="dp-tl-meta">' + (unwritten.length ? unwritten.length + '건 미작성 — 우선 처리' : '오늘 일정에서 시작') + '</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(0)">'
    +       '<div class="dp-tl-av dp-av-1">📅</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">캘린더 관리</div><div class="dp-tl-meta">주간 일정·새 일정 추가</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(7)">'
    +       '<div class="dp-tl-av dp-av-3">💬</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">게시판·메시지</div><div class="dp-tl-meta">학부모 · 동료 라운지</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  html += '</div>'; // grid-2-eq end

  root.innerHTML = html;

  // ── 비동기: 라운지 답변 대기 메시지 ──
  _dpLoadTeacherMessages();
}

// 라운지 1:1 메시지(private_admin) 중 본인이 보낸 게 아닌 것 = 받은 메시지
function _dpLoadTeacherMessages() {
  var msgEl = document.getElementById('dpTeacherMsgs');
  var kpiEl = document.getElementById('dpTeacherMsgKpi');
  var kpiSub = document.getElementById('dpTeacherMsgKpiSub');
  if (!msgEl) return;
  if (!currentUser || !currentUser.id) {
    msgEl.innerHTML = '<div class="dp-empty">로그인 정보 확인 필요</div>';
    return;
  }
  supaFetch('madi_lounge_posts?visibility=eq.private_admin&order=created_at.desc&limit=20', 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows)) rows = [];
      var received = rows.filter(function(p){
        if (!p) return false;
        // 본인이 작성한 글 제외
        if (p.author_id && String(p.author_id) === String(currentUser.id)) return false;
        if (!p.author_id && p.author_name && p.author_name === currentUser.name) return false;
        return true;
      });
      // KPI 갱신
      if (kpiEl) kpiEl.innerHTML = received.length + '<em> 건</em>';
      if (kpiSub) {
        if (received.length === 0) { kpiSub.textContent = '받은 메시지 없음'; kpiSub.className = 'dp-kpi-delta flat'; }
        else {
          // 가장 오래된 일 차이
          var oldest = received[received.length - 1];
          var dStr = oldest && oldest.created_at ? oldest.created_at.slice(0,10) : '';
          var d = dStr ? Math.floor((nowKST() - new Date(dStr)) / 86400000) : 0;
          kpiSub.textContent = '가장 오래된 ' + d + '일 전';
          kpiSub.className = 'dp-kpi-delta warn';
        }
      }
      if (received.length === 0) {
        msgEl.innerHTML = '<div class="dp-empty">받은 메시지가 없습니다</div>';
        return;
      }
      msgEl.innerHTML = received.slice(0,4).map(function(p){
        var from = p.author_name || '익명';
        var when = p.created_at ? p.created_at.slice(0,10) : '';
        var preview = (p.content || p.title || '').toString().slice(0,80);
        var days = when ? Math.floor((nowKST() - new Date(when)) / 86400000) : 0;
        var timeText = days === 0 ? '오늘' : days + '일 전';
        return ''
          + '<div class="dp-msg-row" onclick="switchTab(7)">'
          +   '<div class="dp-msg-av ' + _dpAvatarClass(from) + '">' + escHtml(_dpInitial(from)) + '</div>'
          +   '<div class="dp-msg-info">'
          +     '<div class="dp-msg-top">'
          +       '<div class="dp-msg-from">' + escHtml(from) + '</div>'
          +       '<div class="dp-msg-unread"></div>'
          +       '<div class="dp-msg-time">' + timeText + '</div>'
          +     '</div>'
          +     '<div class="dp-msg-preview">' + escHtml(preview) + '</div>'
          +   '</div>'
          + '</div>';
      }).join('');
    })
    .catch(function() {
      if (kpiEl) kpiEl.innerHTML = '-<em> 건</em>';
      if (kpiSub) { kpiSub.textContent = '불러오기 실패'; kpiSub.className = 'dp-kpi-delta flat'; }
      msgEl.innerHTML = '<div class="dp-empty">메시지를 불러오지 못했습니다</div>';
    });
}

// ────────────────────────────────────────────────────────────────
// Admin / Super 홈 (⑧)
// ────────────────────────────────────────────────────────────────

// 바우처 단가 추정표 (Option ⓒ — 실제 정산 테이블 미구현 상태 추정값)
var _DP_VOUCHER_PRICE = {
  '발달재활바우처':          33000,
  '우리아이심리지원서비스바우처': 40000,
  '꿈E든카드바우처':         30000,
  '나래사랑카드바우처':       35000,
  '일반':                  40000,
  '':                      40000
};
function _dpEstSessionPrice(child) {
  if (!child) return _DP_VOUCHER_PRICE['일반'];
  var v = child.voucherType || '일반';
  return _DP_VOUCHER_PRICE[v] != null ? _DP_VOUCHER_PRICE[v] : _DP_VOUCHER_PRICE['일반'];
}
function _dpFmtWon(n) {
  if (!isFinite(n)) return '0';
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}

// 매출 추정 산식 펼침/접기 토글
function _dpToggleRevBreakdown() {
  var el = document.getElementById('dpRevBreakdown');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function renderDashboardAdmin() {
  var root = document.getElementById('dashAdmin');
  if (!root) return;
  // 안전 가드 — 전역 DB 미초기화 / 빈 배열 케이스 모두 안전
  var _children = (typeof childDB !== 'undefined' && Array.isArray(childDB)) ? childDB : [];
  var _sessions = (typeof sessionDB !== 'undefined' && Array.isArray(sessionDB)) ? sessionDB : [];
  var _schedules = (typeof scheduleDB !== 'undefined' && Array.isArray(scheduleDB)) ? scheduleDB : [];
  var myName = (currentUser && currentUser.name) || '';
  var role = (currentUser && currentUser.role) || 'admin';
  var todayDate = nowKST(); todayDate.setHours(0,0,0,0);
  var todayStr = ymd(todayDate);
  var mon = _dpMonday(todayDate), sun = _dpSunday(todayDate);
  var monStr = ymd(mon), sunStr = ymd(sun);
  // 이번 달
  var monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  var monthEnd   = new Date(todayDate.getFullYear(), todayDate.getMonth()+1, 0);
  var monthStartStr = ymd(monthStart), monthEndStr = ymd(monthEnd);
  // 지난 달
  var lastMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth()-1, 1);
  var lastMonthEnd   = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
  var lastMonthStartStr = ymd(lastMonthStart), lastMonthEndStr = ymd(lastMonthEnd);

  // ── 데이터 계산 ──
  var thisMonthSessions = _sessions.filter(function(s){ return s.date >= monthStartStr && s.date <= monthEndStr; });
  var lastMonthSessions = _sessions.filter(function(s){ return s.date >= lastMonthStartStr && s.date <= lastMonthEndStr; });
  var thisMonthSched = _schedules.filter(function(s){ return s.date >= monthStartStr && s.date <= monthEndStr; });
  // 진도율 분모: 오늘까지 도래한 일정만 (미래 일정은 아직 진행 의무 도래 전)
  var thisMonthSchedDue = thisMonthSched.filter(function(s){ return s.date <= todayStr; });

  // 매출 추정 = sum(완료 세션 × 바우처 단가)
  var revenue = 0;
  thisMonthSessions.forEach(function(s){
    var c = _children.find(function(cc){ return cc.id === s.childId; });
    revenue += _dpEstSessionPrice(c);
  });
  var lastRevenue = 0;
  lastMonthSessions.forEach(function(s){
    var c = _children.find(function(cc){ return cc.id === s.childId; });
    lastRevenue += _dpEstSessionPrice(c);
  });
  var revenueDelta = revenue - lastRevenue;
  var revenueDeltaPct = lastRevenue > 0 ? Math.round(revenueDelta / lastRevenue * 100) : 0;

  // 정산 대기 = 이번 달 일정 중 세션 매칭 안된 것 (미완료 추정)
  var pendingSched = thisMonthSched.filter(function(s){
    if (s.date > todayStr) return false; // 미래는 정상
    return !_sessions.some(function(ss){ return ss.childId === s.childId && ss.date === s.date; });
  });
  var pendingAmount = 0;
  pendingSched.forEach(function(s){
    var c = _children.find(function(cc){ return cc.id === s.childId; });
    pendingAmount += _dpEstSessionPrice(c);
  });

  // KPI
  var kRegistered = _children.filter(function(c){ return c.status === '등록'; }).length;
  var kWaiting    = _children.filter(function(c){ return c.status === '대기'; }).length;
  var kClosedThisMonth = _children.filter(function(c){
    if (c.status !== '종결') return false;
    var d = c.updatedAt || c.closedAt || c.endDate || '';
    return d && d.slice(0,7) === monthStartStr.slice(0,7);
  }).length;
  var kTotal = _children.length;

  // 이번 주 변동
  var weekChildren = _children.filter(function(c){
    var d = c.updatedAt || c.createdAt || c.regDate || '';
    return d && d.slice(0,10) >= monStr && d.slice(0,10) <= sunStr;
  });
  var newThisWeek    = weekChildren.filter(function(c){ return c.status === '등록'; }).length;
  var closedThisWeek = weekChildren.filter(function(c){ return c.status === '종결'; }).length;
  var waitThisWeek   = weekChildren.filter(function(c){ return c.status === '대기'; }).length;

  // 선생님 활동 — 일단 sessionDB / scheduleDB 의 teacher 이름들로 집계 (사용자 테이블 조회 없이 즉시)
  var teacherStats = {};
  _schedules.forEach(function(s){
    if (!s.teacher) return;
    if (!teacherStats[s.teacher]) teacherStats[s.teacher] = { children:{}, weekSched:0, weekSession:0, unwritten:0 };
    teacherStats[s.teacher].children[s.childId] = true;
    if (s.date >= monStr && s.date <= sunStr) teacherStats[s.teacher].weekSched++;
  });
  _sessions.forEach(function(s){
    if (!s.teacher) return;
    if (!teacherStats[s.teacher]) teacherStats[s.teacher] = { children:{}, weekSched:0, weekSession:0, unwritten:0 };
    teacherStats[s.teacher].children[s.childId] = true;
    if (s.date >= monStr && s.date <= sunStr) teacherStats[s.teacher].weekSession++;
  });
  (typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : []).forEach(function(u){
    if (!u.teacher) return;
    if (!teacherStats[u.teacher]) teacherStats[u.teacher] = { children:{}, weekSched:0, weekSession:0, unwritten:0 };
    teacherStats[u.teacher].unwritten++;
  });
  var teacherList = Object.keys(teacherStats).map(function(name){
    var s = teacherStats[name];
    return { name:name, count: Object.keys(s.children).length, weekSched:s.weekSched, weekSession:s.weekSession, unwritten:s.unwritten };
  }).sort(function(a,b){ return b.count - a.count; });

  // 일별 카운트 (이번 달 추이 — 계획 vs 실제)
  var daysInMonth = monthEnd.getDate();
  var planByDay = [], realByDay = [];
  for (var _i = 0; _i <= daysInMonth; _i++) { planByDay.push(0); realByDay.push(0); }
  thisMonthSched.forEach(function(s){ var d = parseInt(s.date.slice(8,10), 10); if (d >= 1 && d <= daysInMonth) planByDay[d]++; });
  thisMonthSessions.forEach(function(s){ var d = parseInt(s.date.slice(8,10), 10); if (d >= 1 && d <= daysInMonth) realByDay[d]++; });

  // ── HTML ──
  var titleText = _dpGreetingFor(myName, role);
  var deltaTxt = lastRevenue > 0
    ? '전월 대비 ' + (revenueDeltaPct >= 0 ? '+' : '') + revenueDeltaPct + '% (' + (revenueDelta >= 0 ? '+' : '') + _dpFmtWon(revenueDelta) + ')'
    : '전월 데이터 없음';
  var subText = '이번 달 세션 <b>' + thisMonthSessions.length + '건</b> 완료 · 정산 대기 <b>' + pendingSched.length + '건</b>' + (pendingSched.length > 0 ? ' (' + _dpFmtWon(pendingAmount) + ' 추정)' : '');

  var freshness = _dpFreshnessLabel();
  var html = ''
    + '<div class="dp-head">'
    +   '<div class="dp-greeting">' + escHtml(_dpTodayBanner())
    +     (role === 'superadmin' ? ' · <span style="color:#d97706;font-weight:700;">전체 센터 집계</span>' : '')
    +     (freshness ? ' · <span style="color:#94a3b8;">' + escHtml(freshness) + '</span>' : '')
    +   '</div>'
    +   '<h1 class="dp-title">' + titleText + '</h1>'
    +   '<p class="dp-sub">' + subText + '</p>'
    + '</div>';

  // 이번 달 바우처별 세션 카운트 (단가 노출용)
  var voucherBreakdown = {};
  thisMonthSessions.forEach(function(s){
    var c = _children.find(function(cc){ return cc.id === s.childId; });
    var v = c && c.voucherType ? c.voucherType : '일반';
    if (!voucherBreakdown[v]) voucherBreakdown[v] = { count: 0, price: _DP_VOUCHER_PRICE[v] || _DP_VOUCHER_PRICE['일반'] };
    voucherBreakdown[v].count++;
  });
  var voucherRows = Object.keys(voucherBreakdown).map(function(v){
    var b = voucherBreakdown[v];
    return { type: v, count: b.count, price: b.price, total: b.count * b.price };
  }).sort(function(a,b){ return b.total - a.total; });

  // 매출 히어로 (추정값 라벨 명시)
  html += ''
    + '<div class="dp-rev">'
    +   '<div class="dp-rev-main">'
    +     '<div class="dp-rev-label">💰 이번 달 매출 (추정' + (role === 'superadmin' ? ' · 전체' : '') + ')</div>'
    +     '<div class="dp-rev-num">' + _dpFmtWon(revenue) + '</div>'
    +     '<div class="dp-rev-meta">' + escHtml(deltaTxt) + '</div>'
    +     '<button class="dp-rev-tag" onclick="_dpToggleRevBreakdown()" style="cursor:pointer;border:1px solid rgba(252,211,77,0.3);font-family:inherit;" title="바우처별 단가·세션 수 보기">📌 바우처 단가 × 완료 세션 추정값 · 자세히 ▾</button>'
    +   '</div>'
    +   '<div class="dp-rev-sub">'
    +     '<div class="dp-rev-sub-label">⏳ 정산 대기</div>'
    +     '<div class="dp-rev-sub-num">' + _dpFmtWon(pendingAmount) + '</div>'
    +     '<div class="dp-rev-sub-meta"><b>' + pendingSched.length + '건</b> · 이번 달 미작성 세션</div>'
    +   '</div>'
    +   '<div class="dp-rev-sub">'
    +     '<div class="dp-rev-sub-label">📊 이번 달 세션</div>'
    +     '<div class="dp-rev-sub-num">' + thisMonthSessions.length + ' <em>건</em></div>'
    +     '<div class="dp-rev-sub-meta">월 계획 <b>' + thisMonthSched.length + '건</b> · 진도율 <b>' + (thisMonthSchedDue.length ? Math.round(thisMonthSessions.length / thisMonthSchedDue.length * 100) : 0) + '%</b> (도래 ' + thisMonthSchedDue.length + '건 기준)</div>'
    +   '</div>'
    + '</div>';

  // 단가표 (기본 숨김 — 토글로 펼침)
  html += ''
    + '<div id="dpRevBreakdown" class="dp-rev-breakdown" style="display:none;margin-bottom:18px;background:white;border:1px solid #e7ecf2;border-radius:12px;overflow:hidden;">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">💵 이번 달 매출 추정 산식</div>'
    +       '<div class="dp-panel-sub">바우처별 세션 수 × 정부 단가 추정</div></div>'
    +     '<button class="dp-panel-link" onclick="_dpToggleRevBreakdown()">접기 ▴</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">';
  if (voucherRows.length === 0) {
    html += '<div class="dp-empty">이번 달 완료 세션이 없습니다</div>';
  } else {
    html += ''
      + '<div class="dp-trow head" style="grid-template-columns:1fr 80px 100px 120px;">'
      +   '<div>바우처 종류</div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-label">세션</div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-label">단가</div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-label">소계</div></div>'
      + '</div>';
    voucherRows.forEach(function(r){
      html += ''
        + '<div class="dp-trow" style="grid-template-columns:1fr 80px 100px 120px;">'
        +   '<div class="dp-tname">' + escHtml(r.type) + '</div>'
        +   '<div class="dp-tstat"><div class="dp-tstat-num">' + r.count + '</div><div class="dp-tstat-label">건</div></div>'
        +   '<div class="dp-tstat"><div class="dp-tstat-num">' + _dpFmtWon(r.price) + '</div><div class="dp-tstat-label">/ 회</div></div>'
        +   '<div class="dp-tstat"><div class="dp-tstat-num">' + _dpFmtWon(r.total) + '</div><div class="dp-tstat-label"></div></div>'
        + '</div>';
    });
    html += ''
      + '<div class="dp-trow" style="grid-template-columns:1fr 80px 100px 120px;border-top:2px solid #e7ecf2;font-weight:800;">'
      +   '<div class="dp-tname">합계</div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num">' + thisMonthSessions.length + '</div><div class="dp-tstat-label">건</div></div>'
      +   '<div class="dp-tstat"></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num" style="color:#0f3b66;">' + _dpFmtWon(revenue) + '</div><div class="dp-tstat-label"></div></div>'
      + '</div>'
      + '<div style="margin-top:12px;padding:10px 12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:11.5px;color:#92400e;line-height:1.55;">'
      +   '⚠️ 단가는 정부 고시 기준 추정값입니다. 실제 정산 금액과 다를 수 있어요. '
      +   '<code style="background:white;padding:1px 5px;border-radius:4px;font-size:11px;">madi-03.js</code> 의 <code style="background:white;padding:1px 5px;border-radius:4px;font-size:11px;">_DP_VOUCHER_PRICE</code> 에서 단가표 수정 가능.'
      + '</div>';
  }
  html += '</div></div>';

  // KPI
  html += ''
    + '<div class="dp-kpi-grid">'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-green">👶</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">활동 중인 아동</div>'
    +     '<div class="dp-kpi-num">' + kRegistered + '</div>'
    +     '<div class="dp-kpi-delta ' + (newThisWeek ? '' : 'flat') + '">' + (newThisWeek ? '↑ +' + newThisWeek + ' 이번 주' : '변동 없음') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-amber">⏳</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">대기 / 초기 면담</div>'
    +     '<div class="dp-kpi-num">' + kWaiting + '</div>'
    +     '<div class="dp-kpi-delta ' + (waitThisWeek ? 'warn' : 'flat') + '">' + (waitThisWeek ? '+' + waitThisWeek + ' 이번 주 신규' : '변동 없음') + '</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-blue">✓</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">이번 달 종결</div>'
    +     '<div class="dp-kpi-num">' + kClosedThisMonth + '</div>'
    +     '<div class="dp-kpi-delta flat">2026년 ' + (todayDate.getMonth()+1) + '월</div>'
    +   '</div></div>'
    +   '<div class="dp-kpi"><div class="dp-kpi-ic dp-kic-purple">🌳</div><div class="dp-kpi-info">'
    +     '<div class="dp-kpi-label">전체 누적</div>'
    +     '<div class="dp-kpi-num">' + kTotal + '</div>'
    +     '<div class="dp-kpi-delta flat">아동 등록 합계</div>'
    +   '</div></div>'
    + '</div>';

  // 2열: 선생님 활동 + 변동 아동
  html += '<div class="dp-grid-2">';

  // 선생님 활동표 — placeholder, 이후 _dpLoadAdminTeacherTable() 가 madi_users 조회 후 갱신
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">👥 선생님별 활동 현황</div>'
    +       '<div class="dp-panel-sub" id="dpAdminTeacherSub">이번 주 (' + _dpFmtMD(mon) + ' ~ ' + _dpFmtMD(sun) + ') · 불러오는 중</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(5)">관리 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body" id="dpAdminTeacherTable">'
    +     _dpRenderTeacherRows(teacherList, /*placeholder=*/true)
    +   '</div>'
    + '</div>';

  // 변동 아동
  var sortedChanges = _children.filter(function(c){
    var d = c.updatedAt || c.createdAt || c.regDate || '';
    return d && d.slice(0,10) >= monStr && d.slice(0,10) <= sunStr;
  }).sort(function(a,b){
    var da = (a.updatedAt || a.createdAt || a.regDate || '').slice(0,10);
    var db = (b.updatedAt || b.createdAt || b.regDate || '').slice(0,10);
    return da < db ? 1 : -1;
  });

  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">🔄 이번 주 아동 변동</div>'
    +       '<div class="dp-panel-sub">신규·종결·대기 전환</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(1)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-change-sum">'
    +       '<div class="dp-change-cell"><div class="dp-change-num up">+' + newThisWeek + '</div><div class="dp-change-label">신규 등록</div></div>'
    +       '<div class="dp-change-cell"><div class="dp-change-num done">' + closedThisWeek + '</div><div class="dp-change-label">종결</div></div>'
    +       '<div class="dp-change-cell"><div class="dp-change-num flat">+' + waitThisWeek + '</div><div class="dp-change-label">대기 추가</div></div>'
    +     '</div>';

  if (sortedChanges.length === 0) {
    html += '<div class="dp-empty">이번 주 변동된 아동이 없습니다</div>';
  } else {
    sortedChanges.slice(0, 5).forEach(function(c){
      var age = _dpAge(c.birth);
      var nm = c.name || '?';
      var tagClass = c.status === '종결' ? 'done' : c.status === '대기' ? 'wait' : 'new';
      var tagLabel = c.status === '종결' ? '종결' : c.status === '대기' ? '대기' : '신규';
      var detail = (c.type || '미지정') + (age ? ' · ' + age + '세' : '');
      html += ''
        + '<div class="dp-change-row" onclick="openChildDetail(' + c.id + ')" style="cursor:pointer;">'
        +   '<div class="dp-tav ' + _dpAvatarClass(nm) + '">' + escHtml(_dpInitial(nm)) + '</div>'
        +   '<div class="dp-change-content">'
        +     '<div class="dp-change-title">' + escHtml(nm) + (age ? ' (' + age + '세)' : '') + '</div>'
        +     '<div class="dp-change-detail">' + escHtml(detail) + '</div>'
        +   '</div>'
        +   '<div class="dp-change-tag ' + tagClass + '">' + tagLabel + '</div>'
        + '</div>';
    });
  }
  html += '</div></div>';
  html += '</div>'; // grid-2 end

  // 추이 그래프 (계획 vs 실제 · SVG)
  var maxY = 1;
  for (var i = 1; i <= daysInMonth; i++) {
    if (planByDay[i] > maxY) maxY = planByDay[i];
    if (realByDay[i] > maxY) maxY = realByDay[i];
  }
  var chartW = 700, chartH = 180;
  function _pt(i, v) {
    var x = ((i - 1) / Math.max(daysInMonth - 1, 1)) * chartW;
    var y = chartH - (v / maxY) * chartH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }
  var planPts = [], realPts = [], realArea = ['0,' + chartH];
  for (var d = 1; d <= daysInMonth; d++) {
    planPts.push(_pt(d, planByDay[d]));
    realPts.push(_pt(d, realByDay[d]));
    realArea.push(_pt(d, realByDay[d]));
  }
  realArea.push(chartW + ',' + chartH);
  var progressPct = thisMonthSchedDue.length ? Math.round(thisMonthSessions.length / thisMonthSchedDue.length * 100) : 0;

  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📊 이번 달 세션 추이</div>'
    +       '<div class="dp-panel-sub">' + (monthStart.getMonth()+1) + '월 일별 세션 (계획 vs 실제)</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-chart">'
    +       '<div class="dp-chart-grid"><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div><div class="dp-chart-grid-line"></div></div>'
    +       '<svg class="dp-chart-svg" viewBox="0 0 ' + chartW + ' ' + chartH + '" preserveAspectRatio="none">'
    +         '<defs><linearGradient id="dpGradActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f3b66" stop-opacity="0.2"/><stop offset="100%" stop-color="#0f3b66" stop-opacity="0"/></linearGradient></defs>'
    +         '<polyline points="' + planPts.join(' ') + '" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>'
    +         '<polygon points="' + realArea.join(' ') + '" fill="url(#dpGradActual)"/>'
    +         '<polyline points="' + realPts.join(' ') + '" fill="none" stroke="#0f3b66" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    +       '</svg>'
    +     '</div>'
    +     '<div class="dp-chart-x">'
    +       '<span>1일</span><span>' + Math.round(daysInMonth/4) + '일</span><span>' + Math.round(daysInMonth/2) + '일</span><span>' + Math.round(daysInMonth*3/4) + '일</span><span>' + daysInMonth + '일</span>'
    +     '</div>'
    +     '<div class="dp-chart-legend">'
    +       '<div class="dp-chart-leg"><div class="dp-chart-leg-dot" style="background:#0f3b66;"></div>실제 (누적 ' + thisMonthSessions.length + '회)</div>'
    +       '<div class="dp-chart-leg"><div class="dp-chart-leg-dot" style="background:#94a3b8;"></div>계획 (목표 ' + thisMonthSched.length + '회)</div>'
    +       '<div class="dp-chart-leg ok">진도율 ' + progressPct + '%</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  // 상단 html 먼저 root 에 set, 이후 하단 패널을 append
  root.innerHTML = html;

  // ── 하단 2열: 운영 알림 + 빠른 액션 ──
  // 알림 목록 자동 구성: 정산 대기 + 미작성 (전체 합산) + 최근 공지 1건
  var alerts = [];
  if (pendingSched.length > 0) {
    alerts.push({
      ic: '⚠️', cls: 'warn',
      title: '정산 대기 ' + pendingSched.length + '건 (' + _dpFmtWon(pendingAmount) + ')',
      text: '이번 달 미작성 세션이 있어요. 가장 오래된 건부터 처리하면 정산을 마무리할 수 있어요.',
      time: '이번 달 누적'
    });
  }
  var totalUnwritten = (typeof getUnwrittenSessions === 'function' ? getUnwrittenSessions() : []);
  if (totalUnwritten.length > 0) {
    // 선생님별 카운트 집계
    var byTeacher = {};
    totalUnwritten.forEach(function(u){ byTeacher[u.teacher || '미배정'] = (byTeacher[u.teacher || '미배정'] || 0) + 1; });
    var byTeacherText = Object.keys(byTeacher).slice(0,3).map(function(t){ return escHtml(t) + ' ' + byTeacher[t] + '건'; }).join(' / ');
    alerts.push({
      ic: '💬', cls: 'info',
      title: '미작성 세션 ' + totalUnwritten.length + '건 (전체 선생님)',
      text: byTeacherText + (Object.keys(byTeacher).length > 3 ? ' 외' : '') + '. 선생님께 리마인드 전송 가능합니다.',
      time: '최근 7일 기준'
    });
  }
  if (_bannerNotices && _bannerNotices.length > 0) {
    var topNotice = _bannerNotices[0];
    alerts.push({
      ic: topNotice.notice_type === 'imp' ? '🔴' : '📢', cls: 'ok',
      title: topNotice.title || '공지',
      text: (topNotice.content || '').toString().slice(0, 80) + ((topNotice.content || '').length > 80 ? '...' : ''),
      time: topNotice.created_at ? topNotice.created_at.slice(0,10) : ''
    });
  }

  html = '<div class="dp-grid-2-eq">';

  // 운영 알림
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">📢 운영 알림</div>'
    +       '<div class="dp-panel-sub">' + (alerts.length ? '조치가 필요한 항목 ' + alerts.length + '건' : '모두 정상') + '</div></div>'
    +     '<button class="dp-panel-link" onclick="switchTab(1)">전체 →</button>'
    +   '</div>'
    +   '<div class="dp-panel-body">';
  if (alerts.length === 0) {
    html += '<div class="dp-empty">📭 처리할 알림이 없어요. 모든 항목이 정상이에요.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:8px;">' + alerts.slice(0,4).map(function(a){
      return ''
        + '<div class="dp-alert-big dp-alert-' + a.cls + '">'
        +   '<div class="dp-alert-ic">' + a.ic + '</div>'
        +   '<div class="dp-alert-body">'
        +     '<div class="dp-alert-title">' + escHtml(a.title) + '</div>'
        +     '<div class="dp-alert-text">' + a.text + '</div>'
        +     (a.time ? '<div class="dp-alert-time">' + escHtml(a.time) + '</div>' : '')
        +   '</div>'
        + '</div>';
    }).join('') + '</div>';
  }
  html += '</div></div>';

  // 빠른 액션
  html += ''
    + '<div class="dp-panel">'
    +   '<div class="dp-panel-head">'
    +     '<div><div class="dp-panel-title">⚡ 빠른 액션</div>'
    +       '<div class="dp-panel-sub">자주 쓰는 운영 작업</div></div>'
    +   '</div>'
    +   '<div class="dp-panel-body">'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:none;cursor:pointer;" onclick="switchTab(2)">'
    +       '<div class="dp-tl-av dp-av-2" style="background:#fef3c7;color:#a16207;">💰</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">정산 대기 ' + (pendingSched.length ? pendingSched.length + '건 처리' : '확인') + '</div><div class="dp-tl-meta">' + (pendingSched.length ? _dpFmtWon(pendingAmount) + ' — 우선 처리 권장' : '대기 건 없음') + '</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(7)">'
    +       '<div class="dp-tl-av dp-av-6" style="background:#dbeafe;color:#1e40af;">💬</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">선생님 라운지·메시지</div><div class="dp-tl-meta">미작성 리마인드 / 공지 전송</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(5)">'
    +       '<div class="dp-tl-av dp-av-1" style="background:#dcfce7;color:#15803d;">➕</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">선생님 관리</div><div class="dp-tl-meta">초대 코드 발급·권한 설정</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +     '<div class="dp-tl-row" style="grid-template-columns:auto 1fr auto;padding:11px 0;border-top:1px solid #f1f5f9;cursor:pointer;" onclick="switchTab(3)">'
    +       '<div class="dp-tl-av dp-av-3" style="background:#ede9fe;color:#6d28d9;">📤</div>'
    +       '<div class="dp-tl-info"><div class="dp-tl-name">월간 리포트·포트폴리오</div><div class="dp-tl-meta">' + (todayDate.getMonth()+1) + '월 성과 출력</div></div>'
    +       '<div style="color:#cbd5e1;">→</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  html += '</div>'; // grid-2-eq end

  // 안전하게 append (innerHTML += 보다 빠르고 안정적)
  root.insertAdjacentHTML('beforeend', html);

  // 비동기: madi_users 에서 선생님 전체 가져와 활동 0건 선생님도 포함
  _dpLoadAdminTeacherTable(teacherStats, monStr, sunStr);
}

// 선생님 활동표 행 렌더 (헬퍼)
// rows: [{name, count, weekSched, weekSession, unwritten, inactive}, ...]
function _dpRenderTeacherRows(rows, placeholder) {
  if (!rows || rows.length === 0) {
    if (placeholder) return '<div class="dp-empty">불러오는 중...</div>';
    return '<div class="dp-empty">등록된 선생님이 없습니다</div>';
  }
  var head = ''
    + '<div class="dp-trow head">'
    +   '<div></div><div>선생님</div>'
    +   '<div class="dp-tstat"><div class="dp-tstat-label">담당</div></div>'
    +   '<div class="dp-tstat"><div class="dp-tstat-label">세션/주</div></div>'
    +   '<div class="dp-tstat"><div class="dp-tstat-label">미작성</div></div>'
    + '</div>';
  var body = rows.slice(0, 10).map(function(t){
    var meta = t.inactive ? '활동 없음' : '활동 중';
    var nameStyle = t.inactive ? 'color:#94a3b8;' : '';
    return ''
      + '<div class="dp-trow">'
      +   '<div class="dp-tav ' + _dpAvatarClass(t.name) + '" style="' + (t.inactive ? 'opacity:0.55;' : '') + '">' + escHtml(_dpInitial(t.name)) + '</div>'
      +   '<div class="dp-tinfo"><div class="dp-tname" style="' + nameStyle + '">' + escHtml(t.name) + '</div><div class="dp-tmeta">' + meta + '</div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num">' + (t.count || 0) + '</div><div class="dp-tstat-label">명</div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num">' + (t.weekSession || 0) + '<small style="color:#94a3b8;font-weight:600;">/' + (t.weekSched || 0) + '</small></div><div class="dp-tstat-label"></div></div>'
      +   '<div class="dp-tstat"><div class="dp-tstat-num ' + (t.unwritten ? 'warn' : '') + '">' + (t.unwritten || 0) + '</div><div class="dp-tstat-label">건</div></div>'
      + '</div>';
  }).join('');
  return head + body;
}

// madi_users 조회 후 활동 통계와 머지 (이름 매칭)
function _dpLoadAdminTeacherTable(teacherStats, monStr, sunStr) {
  var tableEl = document.getElementById('dpAdminTeacherTable');
  var subEl = document.getElementById('dpAdminTeacherSub');
  if (!tableEl) return;
  // 슈퍼관리자는 전 센터, admin 은 본인 센터
  var role = (currentUser && currentUser.role) || '';
  var query = 'madi_users?role=eq.teacher&select=id,name,username&order=name.asc';
  if (role === 'admin' && currentUser.center_id) {
    query += '&center_id=eq.' + encodeURIComponent(currentUser.center_id);
  }
  // role=superadmin 은 필터 없이 전체 가져옴

  supaFetch(query, 'GET')
    .then(function(rows) {
      if (!Array.isArray(rows)) rows = [];
      // 머지: madi_users 의 모든 선생님 + 활동 통계
      var merged = rows.map(function(u){
        var name = u.name || u.username || '?';
        var s = teacherStats[name];
        if (s) {
          return {
            name: name,
            count: Object.keys(s.children).length,
            weekSched: s.weekSched,
            weekSession: s.weekSession,
            unwritten: s.unwritten,
            inactive: false
          };
        }
        return { name: name, count: 0, weekSched: 0, weekSession: 0, unwritten: 0, inactive: true };
      });
      // madi_users 에 없는 활동 이름 (외부 자료 import 등) — orphan 으로 같이 표시
      var knownNames = {};
      rows.forEach(function(u){ knownNames[u.name || u.username || ''] = true; });
      Object.keys(teacherStats).forEach(function(name){
        if (!knownNames[name]) {
          var s = teacherStats[name];
          merged.push({
            name: name,
            count: Object.keys(s.children).length,
            weekSched: s.weekSched,
            weekSession: s.weekSession,
            unwritten: s.unwritten,
            inactive: false
          });
        }
      });
      // 정렬: 활동 있는 순 → 담당 아동 수 내림차순
      merged.sort(function(a, b){
        if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
        return b.count - a.count;
      });
      tableEl.innerHTML = _dpRenderTeacherRows(merged);
      if (subEl) {
        var active = merged.filter(function(t){ return !t.inactive; }).length;
        subEl.textContent = '이번 주 · 선생님 ' + merged.length + '명 (활동 ' + active + '명)';
      }
    })
    .catch(function(e) {
      // 실패 시 기존 통계 기반 fallback
      if (window.console && console.warn) console.warn('[silent dpAdmin teachers]', e && e.message);
      var fallback = Object.keys(teacherStats).map(function(name){
        var s = teacherStats[name];
        return {
          name: name, count: Object.keys(s.children).length,
          weekSched: s.weekSched, weekSession: s.weekSession, unwritten: s.unwritten,
          inactive: false
        };
      }).sort(function(a,b){ return b.count - a.count; });
      tableEl.innerHTML = _dpRenderTeacherRows(fallback);
      if (subEl) subEl.textContent = '이번 주 · 선생님 ' + fallback.length + '명 (활동 데이터 기반)';
    });
}
