function loadCenterApiKey(showFeedback) {
  // Supabase에서 센터 공용 API 키 로드
  return supaFetch('madi_settings?key=eq.api_key&select=value', 'GET')
    .then(function(rows) {
      if (!rows || rows.length === 0 || !rows[0].value) {
        // Supabase에 키 없으면 로컬 키 사용 (기존 호환)
        var local = localStorage.getItem('cn3_apikey');
        if (local) {
          document.getElementById('apiKey').value = local;
          showMaskedApiKey();
        }
        if (showFeedback) showToast('ℹ️ Supabase에 저장된 키 없음 — 로컬 키 사용 중');
        return;
      }
      var key = rows[0].value;
      document.getElementById('apiKey').value = key;
      localStorage.setItem('cn3_apikey', key);
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
      // 로컬 키 폴백
      var local = localStorage.getItem('cn3_apikey');
      if (local) {
        document.getElementById('apiKey').value = local;
        showMaskedApiKey();
      }
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
      // 현재 세션에도 즉시 적용
      document.getElementById('apiKey').value = key;
      localStorage.setItem('cn3_apikey', key);
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
  var dateStr = exp.toISOString().slice(0,10);
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
    }).catch(function(){});
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
  var daysSel = document.getElementById('inviteExpiryDays');
  var days = daysSel ? parseInt(daysSel.value, 10) : 30;
  if (isNaN(days)) days = 30;
  var expiryLabel = days === 0 ? '무기한' : days + '일 유효';
  if (!confirm('초대 코드를 재발급할까요? (' + expiryLabel + ')\n기존 코드는 사용 불가가 됩니다.')) return;
  var cid = getCenterId();
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
}

function addStaffAccount() {
  var name     = (document.getElementById('fixedStaffName') || {}).value.trim();
  var username = (document.getElementById('newStaffUsername') || {}).value.trim();
  var pw       = (document.getElementById('fixedStaffPw') || {}).value.trim();
  var role     = (document.getElementById('fixedStaffRole') || {}).value;
  var resultEl = document.getElementById('staffAddResult');
  if (!name || !username || !pw) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red);">❌ 이름·아이디·비밀번호를 모두 입력해주세요.</span>';
    return;
  }
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--text2);">추가 중...</span>';

  hashPassword(pw).then(function(hashed) {
    return supaFetch('madi_users', 'POST', [{
      id: Date.now() + Math.floor(Math.random() * 1000),
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
          + (!isSelf ? '<button class="btn-del" onclick="removeStaffAccount(' + u.id + ',\'' + escHtml(u.name) + '\')" style="font-size:11px;padding:5px 10px;">삭제</button>' : '<span style="font-size:11px;color:var(--text2);">나</span>')
          + '</div>';
      }).join('');
    }).catch(function(err) {
      el.innerHTML = '<div style="font-size:12px;color:var(--red);text-align:center;padding:10px;">로드 실패: ' + escHtml(err.message || '') + '</div>';
    });
}

function removeStaffAccount(id, name) {
  if (!confirm(name + ' 선생님 계정을 삭제할까요?')) return;
  supaFetch('madi_users?id=eq.' + id, 'DELETE')
    .then(function() {
      showToast('🗑️ ' + name + ' 계정 삭제됨');
      loadStaffMgmtList();
    }).catch(function(err) {
      showToast('❌ 삭제 실패: ' + escHtml(err.message || '오류'));
    });
}

// ── 관리자 페이지 이동 (TASK-008: admin.html 분리) ──
function goToAdmin(tab) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('⚠️ 관리자만 접근할 수 있어요');
    return;
  }
  // iframe 방식: 페이지 이동 없이 사이드바 유지
  if (tab === 'service') {
    switchTab(4);
  } else {
    switchTab(5);
  }
}

function applyRoleUI() {
  var isAdminOrSuper = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  var isSuperAdmin   = currentUser && currentUser.role === 'superadmin';
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

function getApiKeyOrAlert() {
  var k = document.getElementById('apiKey').value.trim();
  if (!k) { showToast('API 키를 먼저 입력해주세요.'); return null; }
  return k;
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
  var ban=document.getElementById('noticeBanner'); if(ban) ban.style.display='none';
  syncSidebarActive(-1);
  updateBreadcrumb(-1);
  renderDashboard();
}
function renderDashboard() {
  var hp=document.getElementById('panelHome');
  if(!hp||!hp.classList.contains('active')) return;
  var today=new Date(); var todayStr=today.toISOString().slice(0,10);
  var wd=['일','월','화','수','목','금','토']; var h=today.getHours();
  var gr=h<12?'오늘도 좋은 하루 시작해요':h<18?'즐거운 오후 되세요':'오늘 하루도 수고하셨어요';
  var em=h<12?'🌅':h<18?'☀️':'🌙';
  var nm=(currentUser&&currentUser.name)||'';
  var wel=document.getElementById('dashWelcome'); var dt=document.getElementById('dashDate');
  if(wel) wel.textContent=gr+', '+nm+' 선생님! '+em;
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
  var isAdmin = currentUser && (currentUser.role==='admin'||currentUser.role==='superadmin');
  var s4=document.getElementById('sbTab4'); if(s4) s4.style.display=isAdmin?'':'none';
  var s5=document.getElementById('sbTab5'); if(s5) s5.style.display=isAdmin?'':'none';
  var sd=document.getElementById('sbDividerAdmin'); if(sd) sd.style.display=isAdmin?'':'none';
}

function switchTab(idx) {
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
  if (tp) tp.classList.add('active');
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
  if (!_bannerNotices.length) return;

  // 캘린더 탭이 현재 active일 때만 표시
  var isCalendar = document.getElementById('tabBtn0') &&
                   document.getElementById('tabBtn0').classList.contains('active');
  var banner = document.getElementById('noticeBanner');
  if (!banner || _bannerClosed) return;

  if (isCalendar) {
    banner.style.display = 'block';
    _bannerIdx = 0;
    _renderBannerSlide();
    if (_bannerNotices.length > 1) {
      _bannerTimer = setInterval(function() {
        _bannerIdx = (_bannerIdx + 1) % _bannerNotices.length;
        _renderBannerSlide();
      }, 5000);
    }
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
async function loadNotices() {
  var listEl = document.getElementById('noticeList');
  if (!listEl) return;
  if (!currentUser) { listEl.innerHTML = '<div class="empty"><p>로그인 후 확인하세요.</p></div>'; return; }
  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:13px;">불러오는 중...</div>';
  try {
    var centerId = encodeURIComponent(currentUser.center_id || '');
    var data = await supaFetch(
      'madi_notices?center_id=eq.' + centerId + '&order=pinned.desc,created_at.desc&limit=50',
      'GET'
    );
    noticeDB = Array.isArray(data) ? data : [];
    renderNoticeList();
    startNoticeBanner(noticeDB); // 배너 업데이트
  } catch(e) {
    listEl.innerHTML = '<div class="empty"><p>공지 테이블이 아직 없거나 오류가 발생했습니다.<br><small>' + (e.message||'') + '</small></p></div>';
  }
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
    var delBtn = (currentUser && currentUser.role === 'admin')
      ? '<button data-nid="' + n.id + '" onclick="deleteNotice(this.dataset.nid)" style="font-size:11px;color:var(--red);background:none;border:none;cursor:pointer;padding:2px 6px;">삭제</button>'
      : '';
    return '<div class="notice-card ' + typeClass + '">'
      + '<span class="notice-badge ' + badgeClass + '">' + badgeText + '</span>'
      + (delBtn ? '<span style="float:right;">' + delBtn + '</span>' : '')
      + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">' + (n.title||'') + '</div>'
      + '<div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap;">' + (n.content||'') + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:8px;">' + dateStr + (n.author_name ? ' · ' + n.author_name : '') + '</div>'
      + '</div>';
  }).join('');
  listEl.innerHTML = html;
}
async function saveNotice() {
  if (!currentUser || currentUser.role !== 'admin') return;
  var title   = (document.getElementById('noticeTitle')   || {value:''}).value.trim();
  var content = (document.getElementById('noticeContent') || {value:''}).value.trim();
  var ntype   = (document.getElementById('noticeType')    || {value:'info'}).value;
  if (!title || !content) { showToast('⚠️ 제목과 내용을 모두 입력해 주세요'); return; }
  try {
    await supaFetch('madi_notices', 'POST', [{
      center_id: currentUser.center_id,
      notice_type: ntype,
      pinned: ntype !== 'info',
      title: title,
      content: content,
      author_name: currentUser.name
    }]);
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    showToast('✅ 공지가 등록됐습니다');
    loadNotices();
  } catch(e) {
    showToast('❌ 저장 실패: ' + (e.message||''));
  }
}
async function deleteNotice(id) {
  if (!confirm('이 공지를 삭제할까요?')) return;
  try {
    await supaFetch('madi_notices?id=eq.' + encodeURIComponent(id), 'DELETE');
    showToast('🗑️ 공지가 삭제됐습니다');
    loadNotices();
  } catch(e) {
    showToast('❌ 삭제 실패: ' + (e.message||''));
  }
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
    _wakeLock.release().catch(function(){});
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
  if (newPw.length < 4)            { setResult('<span style="color:var(--red);">❌ 비밀번호는 4자 이상이어야 해요.</span>'); return; }

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
