function renderServiceStats() {
  var children = typeof childDB !== 'undefined' ? childDB : [];
  var sessions  = typeof sessionDB !== 'undefined' ? sessionDB : [];
  var schedules = typeof scheduleDB !== 'undefined' ? scheduleDB : [];

  var activeChildren = children.filter(function(c){ return c.status === '등록'; });
  var now = new Date();
  var ym  = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  var monthSessions = sessions.filter(function(s){ return (s.date||'').startsWith(ym); });

  // 소속 선생님 수: scheduleDB + sessionDB에서 유니크 teacher 이름
  var teacherSet = {};
  sessions.forEach(function(s){ if(s.teacher) teacherSet[s.teacher]=true; });
  schedules.forEach(function(s){ if(s.teacher) teacherSet[s.teacher]=true; });
  var staffCount = Object.keys(teacherSet).length;

  var activeRate = children.length ? Math.round(activeChildren.length / children.length * 100) : 0;

  var el;
  el = document.getElementById('svcStatChildren');  if(el) el.textContent = activeChildren.length;
  el = document.getElementById('svcStatSessions');  if(el) el.textContent = monthSessions.length;
  el = document.getElementById('svcStatStaff');     if(el) el.textContent = staffCount || '-';
  el = document.getElementById('svcStatActiveRate');if(el) el.textContent = activeRate + '%';

  // 날짜 기본값
  var svcMonthEl = document.getElementById('svcMonth');
  if (svcMonthEl && !svcMonthEl.value) svcMonthEl.value = ym;
  var svcDateEl = document.getElementById('svcDate');
  if (svcDateEl && !svcDateEl.value) {
    svcDateEl.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  }

  // 필터 셀렉트 옵션 채우기 — 이미 계산한 teacherSet 을 넘겨 중복 풀스캔 제거(M-11)
  _populateSvcFilters(teacherSet);
}

function _populateSvcFilters(teacherSet) {
  var children  = typeof childDB    !== 'undefined' ? childDB    : [];
  var sessions  = typeof sessionDB  !== 'undefined' ? sessionDB  : [];
  var schedules = typeof scheduleDB !== 'undefined' ? scheduleDB : [];

  // 이용자 목록
  var childOpts = '<option value="">이용자 전체</option>'
    + children.filter(function(c){ return c.status === '등록'; })
      .sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); })
      .map(function(c){ return '<option value="' + c.id + '">' + escHtml(c.name) + '</option>'; }).join('');

  // 선생님 목록 — 호출부가 teacherSet 을 넘기면 재계산 생략(중복 풀스캔 방지)
  var tSet = teacherSet;
  if (!tSet) {
    tSet = {};
    sessions.forEach(function(s){ if(s.teacher) tSet[s.teacher]=true; });
    schedules.forEach(function(s){ if(s.teacher) tSet[s.teacher]=true; });
  }
  var teacherOpts = '<option value="">선생님 전체</option>'
    + Object.keys(tSet).sort().map(function(t){ return '<option value="' + t.replace(/"/g,'&quot;') + '">' + escHtml(t) + '</option>'; }).join('');

  ['mSvcChild','dSvcChild'].forEach(function(id){
    var el = document.getElementById(id);
    // eslint-disable-next-line no-unsanitized/property
    if(el){ var v = el.value; el.innerHTML = childOpts; el.value = v; }
  });
  ['mSvcTeacher','dSvcTeacher'].forEach(function(id){
    var el = document.getElementById(id);
    // eslint-disable-next-line no-unsanitized/property
    if(el){ var v = el.value; el.innerHTML = teacherOpts; el.value = v; }
  });
}

// 스케줄 상태 레이블/클래스 헬퍼
// 바우처 종류별 뱃지 헬퍼
var _VOUCHER_BADGE_MAP = {
  '발달재활바우처':          { label: '발달재활',   bg: '#d1fae5', color: '#065f46' },
  '우리아이심리지원서비스바우처': { label: '우리아이심리', bg: '#dbeafe', color: '#1e40af' },
  '꿈E든카드바우처':         { label: '꿈E든',     bg: '#fef3c7', color: '#92400e' },
  '나래사랑카드바우처':       { label: '나래사랑',   bg: '#ede9fe', color: '#5b21b6' }
};
function _voucherBadge(vtype, size) {
  var info = _VOUCHER_BADGE_MAP[vtype];
  if (!info) return '';
  var fs = size === 'lg' ? '11px' : '10px';
  var pad = size === 'lg' ? '2px 7px' : '1px 5px';
  return '<span style="font-size:' + fs + ';background:' + info.bg + ';color:' + info.color + ';padding:' + pad + ';border-radius:6px;margin-left:4px;font-weight:700;">' + info.label + '</span>';
}

function _svcStatusInfo(status) {
  var map = {
    done:      { label: '완료',       cls: 'done' },
    pending:   { label: '예정',       cls: 'pending' },
    cancelled: { label: '취소',       cls: 'cancelled' },
    makeup:    { label: '취소(보강)', cls: 'makeup' },
    carried:   { label: '취소(이월)',  cls: 'carried' }
  };
  return map[status] || { label: '예정', cls: 'pending' };
}

function _schedStatus(sc, daySessions) {
  if (sc.status && sc.status !== 'pending') return sc.status;
  var done = daySessions.find(function(ss){ return String(ss.childId)===String(sc.childId); });
  return done ? 'done' : 'pending';
}

function changeSchedStatus(schedId, newStatus) {
  if (!isStaffRole(currentUser && currentUser.role)) {
    showToast('⚠️ 권한이 없습니다');
    return;
  }
  var sc = scheduleDB.find(function(s){ return String(s.id) === String(schedId); });
  if (!sc) return;
  sc.status = newStatus;
  saveOneSchedule(sc);  // 단건 upsert (H2)
  showToast('상태가 변경됐습니다.');
}

// 월별 정산/서비스 공통 전처리 — renderMonthlyService/renderSettlement/exportSettlementExcel 가
//   동일하게 쓰던 monthScheds·monthSess·룩업맵 3종을 1회 구성(M-9, 중복 제거). 집계는 각 함수가 자체 수행.
function _buildMonthlyAggregates(ym) {
  var sessions  = typeof sessionDB  !== 'undefined' ? sessionDB  : [];
  var schedules = typeof scheduleDB !== 'undefined' ? scheduleDB : [];
  var children  = typeof childDB    !== 'undefined' ? childDB    : [];
  var monthScheds = schedules.filter(function(sc){ return (sc.date||'').startsWith(ym); });
  var monthSess   = sessions.filter(function(s){ return (s.date||'').startsWith(ym); });
  var sessByDate = {};
  monthSess.forEach(function(s){ var d = s.date || ''; if (!sessByDate[d]) sessByDate[d] = []; sessByDate[d].push(s); });
  var schedKeySet = {};
  monthScheds.forEach(function(sc){ schedKeySet[String(sc.childId) + '_' + sc.date] = true; });
  var childById = {};
  children.forEach(function(c){ childById[String(c.id)] = c; });
  return { monthScheds:monthScheds, monthSess:monthSess, sessByDate:sessByDate, schedKeySet:schedKeySet, childById:childById };
}

function renderMonthlyService() {
  var listEl   = document.getElementById('monthlyServiceList');
  var summaryEl= document.getElementById('monthlySvcSummary');
  if (!listEl) return;

  var ym = (document.getElementById('svcMonth') || {}).value || '';
  if (!ym) { listEl.innerHTML = '<div class="empty"><p>월을 선택해 주세요.</p></div>'; return; }

  var filterChild   = (document.getElementById('mSvcChild')   || {}).value || '';
  var filterTeacher = (document.getElementById('mSvcTeacher') || {}).value || '';
  var filterStatus  = (document.getElementById('mSvcStatus')  || {}).value || '';

  // 공통 전처리 (M-9) — monthScheds·monthSess·룩업맵 3종
  var _agg = _buildMonthlyAggregates(ym);
  var monthScheds = _agg.monthScheds, monthSess = _agg.monthSess;
  var mseSessByDate = _agg.sessByDate, mseSchedKeySet = _agg.schedKeySet, mseChildById = _agg.childById;

  // 이용자별 집계 (스케줄 + 세션 통합)
  var childMap = {};
  monthScheds.forEach(function(sc){
    var cid = String(sc.childId);
    if (!childMap[cid]) childMap[cid] = { total:0, done:0, cancelled:0, makeup:0, carried:0, teachers:{} };
    var status = _schedStatus(sc, mseSessByDate[sc.date] || []);
    childMap[cid].total++;
    if (status==='done')      childMap[cid].done++;
    else if (status==='cancelled') childMap[cid].cancelled++;
    else if (status==='makeup')    childMap[cid].makeup++;
    else if (status==='carried')   childMap[cid].carried++;
    if (sc.teacher) childMap[cid].teachers[sc.teacher] = true;
  });
  // sessionDB에 있지만 scheduleDB에 없는 세션도 포함
  monthSess.forEach(function(s){
    var cid = String(s.childId);
    var hasSched = mseSchedKeySet[cid + '_' + s.date];
    if (!hasSched) {
      if (!childMap[cid]) childMap[cid] = { total:0, done:0, cancelled:0, makeup:0, carried:0, teachers:{} };
      childMap[cid].total++;
      childMap[cid].done++;
      if (s.teacher) childMap[cid].teachers[s.teacher] = true;
    }
  });

  var rows = Object.keys(childMap).map(function(cid){
    var child    = mseChildById[cid];
    var name     = child ? child.name : ('아동#'+cid);
    var teachers = Object.keys(childMap[cid].teachers).join(', ') || '-';
    return { cid:cid, name:name, teachers:teachers, data:childMap[cid],
      childObj: child };
  });

  // 필터 적용
  if (filterChild)   rows = rows.filter(function(r){ return r.cid === filterChild; });
  if (filterTeacher) rows = rows.filter(function(r){ return r.data.teachers[filterTeacher]; });
  if (filterStatus) {
    rows = rows.filter(function(r){
      if (filterStatus==='done')      return r.data.done > 0;
      if (filterStatus==='cancelled') return r.data.cancelled > 0;
      if (filterStatus==='makeup')    return r.data.makeup > 0;
      if (filterStatus==='carried')   return r.data.carried > 0;
      if (filterStatus==='pending')   return (r.data.total - r.data.done - r.data.cancelled - r.data.makeup - r.data.carried) > 0;
      return true;
    });
  }

  if (!rows.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><p>해당하는 기록이 없습니다.</p></div>';
    if (summaryEl) summaryEl.textContent = '';
    return;
  }

  rows.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });

  var totalDone = rows.reduce(function(s,r){ return s+r.data.done; }, 0);
  var totalAll  = rows.reduce(function(s,r){ return s+r.data.total; }, 0);
  var totalFeeSum = rows.reduce(function(s,r){
    var fee = r.childObj ? (r.childObj.feePerSession || 0) : 0;
    return s + fee * r.data.done;
  }, 0);
  // eslint-disable-next-line no-unsanitized/property
  if (summaryEl) summaryEl.innerHTML = '총 <b>' + totalAll + '회기</b> / 완료 <b>' + totalDone + '회</b> / ' + rows.length + '명'
    + (totalFeeSum ? ' &nbsp;·&nbsp; 완료금액 합계 <b style="color:var(--mint);">' + totalFeeSum.toLocaleString() + '원</b>' : '');

  var html = rows.map(function(r){
    var d = r.data;
    var pending = d.total - d.done - d.cancelled - d.makeup - d.carried;
    var fee = r.childObj ? (r.childObj.feePerSession || 0) : 0;
    var totalFee = fee * d.done;
    var feeStr = fee ? (fee.toLocaleString() + '원/회') : '';
    var totalFeeStr = totalFee ? ' · 완료금액 <b>' + totalFee.toLocaleString() + '원</b>' : '';
    var vType = r.childObj ? (r.childObj.voucherType || '') : '';
    var vBadge = _voucherBadge(vType);
    return '<div class="svc-row">'
      + '<div class="svc-row-name">' + escHtml(r.name) + vBadge
      + '<div class="svc-row-sub">' + escHtml(r.teachers) + (feeStr ? ' · ' + feeStr : '') + '</div></div>'
      + '<div class="svc-row-cnt" style="text-align:left;flex:2;">'
      + '<span style="color:var(--mint);">완료 ' + d.done + '</span>'
      + (pending>0 ? ' &nbsp;<span style="color:var(--amber);">예정 ' + pending + '</span>' : '')
      + (d.cancelled>0 ? ' &nbsp;<span style="color:var(--red);">취소 ' + d.cancelled + '</span>' : '')
      + (d.makeup>0 ? ' &nbsp;<span style="color:var(--purple);">보강 ' + d.makeup + '</span>' : '')
      + (d.carried>0 ? ' &nbsp;<span style="color:var(--text2);">이월 ' + d.carried + '</span>' : '')
      + (totalFeeStr ? '<div style="font-size:11px;color:var(--text2);margin-top:2px;">' + totalFeeStr + '</div>' : '')
      + '</div>'
      + '<div style="font-size:13px;font-weight:900;color:var(--mint);flex:0.4;text-align:right;">총 ' + d.total + '회</div>'
      + '</div>';
  }).join('');

  // eslint-disable-next-line no-unsanitized/property
  listEl.innerHTML = html;
}

function renderDailyService() {
  var listEl   = document.getElementById('dailyServiceList');
  var summaryEl= document.getElementById('dailySvcSummary');
  if (!listEl) return;

  var dt = (document.getElementById('svcDate') || {}).value || '';
  if (!dt) { listEl.innerHTML = '<div class="empty"><p>날짜를 선택해 주세요.</p></div>'; return; }

  var sessions  = typeof sessionDB  !== 'undefined' ? sessionDB  : [];
  var children  = typeof childDB    !== 'undefined' ? childDB    : [];
  var schedules = typeof scheduleDB !== 'undefined' ? scheduleDB : [];

  var filterChild   = (document.getElementById('dSvcChild')   || {}).value || '';
  var filterTeacher = (document.getElementById('dSvcTeacher') || {}).value || '';
  var filterStatus  = (document.getElementById('dSvcStatus')  || {}).value || '';

  var daySessions  = sessions.filter(function(s){ return (s.date||'') === dt; });
  var daySchedules = schedules.filter(function(s){ return (s.date||'') === dt; });

  // 스케줄 없이 세션만 있는 경우도 포함
  var rows = [];
  daySchedules.forEach(function(sc){
    rows.push({ type:'sched', sc:sc, status: _schedStatus(sc, daySessions) });
  });
  daySessions.forEach(function(s){
    var hasSched = daySchedules.find(function(sc){ return String(sc.childId)===String(s.childId); });
    if (!hasSched) rows.push({ type:'sess', s:s, status:'done' });
  });

  // 필터
  if (filterChild) rows = rows.filter(function(r){
    var cid = r.type==='sched' ? String(r.sc.childId) : String(r.s.childId);
    return cid === filterChild;
  });
  if (filterTeacher) rows = rows.filter(function(r){
    var t = r.type==='sched' ? (r.sc.teacher||'') : (r.s.teacher||'');
    return t === filterTeacher;
  });
  if (filterStatus) rows = rows.filter(function(r){ return r.status === filterStatus; });

  // 시간순 정렬
  rows.sort(function(a,b){
    var ta = a.type==='sched' ? (a.sc.startTime||'') : '';
    var tb = b.type==='sched' ? (b.sc.startTime||'') : '';
    return ta.localeCompare(tb);
  });

  if (!rows.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">📆</div><p>' + escHtml(dt) + ' 기록이 없습니다.</p></div>';
    if (summaryEl) summaryEl.textContent = '';
    return;
  }

  var totalRows = rows.length;
  var doneCount = rows.filter(function(r){ return r.status==='done'; }).length;
  var cancelCount = rows.filter(function(r){ return r.status==='cancelled'||r.status==='makeup'||r.status==='carried'; }).length;
  // eslint-disable-next-line no-unsanitized/property
  if (summaryEl) summaryEl.innerHTML = '총 <b>' + totalRows + '회기</b> — 완료 <b>' + doneCount + '</b> / 취소 <b>' + cancelCount + '</b> / 예정 <b>' + (totalRows-doneCount-cancelCount) + '</b>';

  var statusOptions = [
    { v:'pending',   l:'예정' },
    { v:'done',      l:'완료' },
    { v:'cancelled', l:'취소' },
    { v:'makeup',    l:'취소(보강)' },
    { v:'carried',   l:'취소(이월)' }
  ];

  // 룩업맵 1회 구축 — 행마다 children.find / daySessions.find 전체 스캔 제거
  var svcChildById = {};
  children.forEach(function(c){ svcChildById[String(c.id)] = c; });
  var svcSessChildSet = {};
  daySessions.forEach(function(ss){ svcSessChildSet[String(ss.childId)] = true; });

  var html = rows.map(function(r){
    var childId  = r.type==='sched' ? r.sc.childId : r.s.childId;
    var teacher  = r.type==='sched' ? (r.sc.teacher||'미지정') : (r.s.teacher||'미지정');
    var timeStr  = r.type==='sched' ? (escHtml(r.sc.startTime||'')+(r.sc.endTime?' ~ '+escHtml(r.sc.endTime):'')) : '';
    var schedId  = r.type==='sched' ? r.sc.id : '';
    var child    = svcChildById[String(childId)];
    var name     = child ? child.name : ('아동#'+childId);
    var fee      = child ? (child.feePerSession || 0) : 0;
    var feeStr   = (fee && r.status==='done') ? fee.toLocaleString()+'원' : '';
    var vType    = child ? (child.voucherType||'') : '';
    var vBadge   = _voucherBadge(vType, 'lg');
    var si       = _svcStatusInfo(r.status);

    var statusSel = '';
    if (schedId) {
      var opts = statusOptions.map(function(o){
        return '<option value="' + o.v + '"' + (r.status===o.v?' selected':'') + '>' + o.l + '</option>';
      }).join('');
      statusSel = '<select class="svc-status-sel ' + si.cls + '" data-schedid="' + schedId + '" onchange="changeSchedStatus(this.dataset.schedid,this.value);this.className=\'svc-status-sel \'+this.value;">'
        + opts + '</select>';
    } else {
      statusSel = '<span class="svc-status-sel done" style="pointer-events:none;">완료</span>';
    }

    // 세션 기록 버튼 (완료 상태일 때)
    var sessBtn = '';
    if (r.status === 'done') {
      var hasSess = svcSessChildSet[String(childId)];
      var _cid = String(childId);
      sessBtn = hasSess
        ? '<button onclick="switchTab(2);setTimeout(function(){switchReportTab(\'session\');var el=document.getElementById(\'sessionChild\');if(el){el.value=\''+_cid+'\';if(typeof loadGoalRows===\'function\')loadGoalRows(\''+_cid+'\');}},200);" style="font-size:11px;padding:4px 8px;background:var(--mint2);color:var(--mint);border:none;border-radius:6px;cursor:pointer;">기록보기</button>'
        : '<button onclick="switchTab(2);setTimeout(function(){switchReportTab(\'session\');var el=document.getElementById(\'sessionChild\');if(el){el.value=\''+_cid+'\';if(typeof loadGoalRows===\'function\')loadGoalRows(\''+_cid+'\');}},200);" style="font-size:11px;padding:4px 8px;background:var(--amber);color:#fff;border:none;border-radius:6px;cursor:pointer;">기록등록</button>';
    }

    return '<div class="svc-row">'
      + '<div class="svc-row-name">' + escHtml(name) + vBadge
      + '<div class="svc-row-sub">' + escHtml(teacher) + (timeStr ? ' · ' + timeStr : '') + (feeStr ? ' · <b>'+feeStr+'</b>' : '') + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + statusSel
      + sessBtn
      + '</div>'
      + '</div>';
  }).join('');

  // eslint-disable-next-line no-unsanitized/property
  listEl.innerHTML = html;
}

// ─────── 정산 요약 ───────
function renderSettlement() {
  var listEl   = document.getElementById('settlList');
  var summaryEl= document.getElementById('settlSummary');
  if (!listEl) return;

  var ym = (document.getElementById('settlMonth') || {}).value || '';
  if (!ym) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><p>월을 선택해 주세요.</p></div>';
    return;
  }

  // 공통 전처리 (M-9) — monthScheds·monthSess·룩업맵 3종
  var _agg = _buildMonthlyAggregates(ym);
  var monthScheds = _agg.monthScheds, monthSess = _agg.monthSess;
  var stlSessByDate = _agg.sessByDate, stlSchedKeySet = _agg.schedKeySet, stlChildById = _agg.childById;

  // 선생님별 집계
  var teacherMap = {};
  monthScheds.forEach(function(sc){
    var t = sc.teacher || '미지정';
    if (!teacherMap[t]) teacherMap[t] = { done:0, pending:0, cancelled:0, makeup:0, carried:0, rows:[] };
    var status = _schedStatus(sc, stlSessByDate[sc.date] || []);
    var child = stlChildById[String(sc.childId)];
    var fee   = child ? (child.feePerSession||0) : 0;
    var vtype = child ? (child.voucherType||'일반') : '일반';
    teacherMap[t][status] = (teacherMap[t][status]||0) + 1;
    teacherMap[t].rows.push({ child:child, date:sc.date, startTime:sc.startTime||'', status:status, fee:fee, vtype:vtype });
  });
  // 스케줄 없이 세션만 있는 경우
  monthSess.forEach(function(s){
    var hasSched = stlSchedKeySet[String(s.childId) + '_' + s.date];
    if (!hasSched) {
      var t = s.teacher || '미지정';
      if (!teacherMap[t]) teacherMap[t] = { done:0, pending:0, cancelled:0, makeup:0, carried:0, rows:[] };
      var child = stlChildById[String(s.childId)];
      var fee   = child ? (child.feePerSession||0) : 0;
      var vtype = child ? (child.voucherType||'일반') : '일반';
      teacherMap[t].done++;
      teacherMap[t].rows.push({ child:child, date:s.date, startTime:'', status:'done', fee:fee, vtype:vtype });
    }
  });

  var teachers = Object.keys(teacherMap).sort();
  if (!teachers.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><p>' + escHtml(ym) + ' 정산 데이터가 없습니다.</p></div>';
    if (summaryEl) summaryEl.textContent = '';
    return;
  }

  // 전체 합계
  var grandTotal = 0, grandDone = 0;
  teachers.forEach(function(t){
    var d = teacherMap[t];
    grandDone += d.done;
    grandTotal += d.rows.filter(function(r){ return r.status==='done'; }).reduce(function(s,r){ return s+r.fee; },0);
  });
  // eslint-disable-next-line no-unsanitized/property
  if (summaryEl) summaryEl.innerHTML = '완료 총 <b>' + grandDone + '회</b> &nbsp;·&nbsp; 합계금액 <b style="color:var(--mint);">' + grandTotal.toLocaleString() + '원</b>';

  var html = teachers.map(function(t){
    var d = teacherMap[t];
    var doneRows = d.rows.filter(function(r){ return r.status==='done'; });
    var totalFee = doneRows.reduce(function(s,r){ return s+r.fee; }, 0);
    var pending  = (d.pending||0);
    var cancelled= (d.cancelled||0)+(d.makeup||0)+(d.carried||0);

    // 이용자 목록 (완료된 것만, 이름+횟수)
    var childCount = {};
    doneRows.forEach(function(r){
      var n = r.child ? r.child.name : '미지정';
      childCount[n] = (childCount[n]||0)+1;
    });
    var childSummary = Object.keys(childCount).map(function(n){ return n+'('+childCount[n]+'회)'; }).join(', ');

    // 바우처 종류별 집계
    var vtypeCount = {};
    doneRows.forEach(function(r){
      var vt = r.vtype || '일반';
      if (!vtypeCount[vt]) vtypeCount[vt] = { count:0, fee:0 };
      vtypeCount[vt].count++;
      vtypeCount[vt].fee += r.fee;
    });
    var vtypeBadges = Object.keys(vtypeCount).map(function(vt){
      var info = _VOUCHER_BADGE_MAP[vt];
      var bg    = info ? info.bg    : '#f1f5f9';
      var color = info ? info.color : 'var(--text2)';
      var lbl   = info ? info.label : '일반';
      return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;background:' + bg + ';color:' + color + ';padding:2px 8px;border-radius:8px;font-weight:700;">'
        + lbl + ' <b>' + vtypeCount[vt].count + '회</b>'
        + (vtypeCount[vt].fee ? ' · ' + vtypeCount[vt].fee.toLocaleString() + '원' : '')
        + '</span>';
    }).join(' ');

    return '<div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid var(--border);">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">'
      + '<div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--text);">' + escHtml(t) + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">' + escHtml(childSummary||'세션 없음') + '</div>'
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:18px;font-weight:900;color:var(--mint);">' + totalFee.toLocaleString() + '원</div>'
      + '<div style="font-size:11px;color:var(--text2);">완료 ' + d.done + '회' + (pending?'/예정 '+pending+'회':'') + (cancelled?'/취소 '+cancelled+'회':'') + '</div>'
      + '</div></div>'
      + (vtypeBadges ? '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + vtypeBadges + '</div>' : '')
      + '</div>';
  }).join('');

  // eslint-disable-next-line no-unsanitized/property
  listEl.innerHTML = html;
}

function exportSettlementExcel() {
  var ym = (document.getElementById('settlMonth') || {}).value || '';
  if (!ym) { showToast('⚠️ 월을 먼저 선택해 주세요'); return; }

  // 공통 전처리 (M-9) — monthScheds·monthSess·룩업맵 3종
  var _agg = _buildMonthlyAggregates(ym);
  var monthScheds = _agg.monthScheds, monthSess = _agg.monthSess;
  var xlsSessByDate = _agg.sessByDate, xlsSchedKeySet = _agg.schedKeySet, xlsChildById = _agg.childById;

  // 전체 행 생성
  var excelRows = [];
  monthScheds.forEach(function(sc){
    var status = _schedStatus(sc, xlsSessByDate[sc.date] || []);
    var child = xlsChildById[String(sc.childId)];
    var si = _svcStatusInfo(status);
    excelRows.push({
      '날짜': sc.date,
      '시간': sc.startTime || '',
      '이용자': child ? child.name : ('아동#'+sc.childId),
      '선생님': sc.teacher || '미지정',
      '바우처구분': child ? (child.voucherType||'일반') : '일반',
      '상태': si.label,
      '1회금액(원)': child ? (child.feePerSession||0) : 0,
      '완료금액(원)': status==='done' ? (child ? (child.feePerSession||0) : 0) : 0,
      '할인(원)': child ? (child.discount||0) : 0,
      '본인부담금(원)': child ? (child.copay||0) : 0
    });
  });
  // 스케줄 없는 세션
  monthSess.forEach(function(s){
    var hasSched = xlsSchedKeySet[String(s.childId) + '_' + s.date];
    if (!hasSched) {
      var child = xlsChildById[String(s.childId)];
      excelRows.push({
        '날짜': s.date,
        '시간': '',
        '이용자': child ? child.name : ('아동#'+s.childId),
        '선생님': s.teacher || '미지정',
        '바우처구분': child ? (child.voucherType||'일반') : '일반',
        '상태': '완료',
        '1회금액(원)': child ? (child.feePerSession||0) : 0,
        '완료금액(원)': child ? (child.feePerSession||0) : 0,
        '할인(원)': child ? (child.discount||0) : 0,
        '본인부담금(원)': child ? (child.copay||0) : 0
      });
    }
  });

  excelRows.sort(function(a,b){ return a['날짜'].localeCompare(b['날짜']) || a['시간'].localeCompare(b['시간']); });

  if (!excelRows.length) { showToast('⚠️ 내보낼 데이터가 없습니다'); return; }

  showToast('📥 엑셀 모듈 준비 중...');
  ensureXLSX().then(function() {
    try {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.json_to_sheet(excelRows);
      ws['!cols'] = [
        {wch:12},{wch:8},{wch:10},{wch:12},{wch:10},{wch:10},{wch:14},{wch:14},{wch:10},{wch:12}
      ];
      XLSX.utils.book_append_sheet(wb, ws, ym + ' 정산');
      XLSX.writeFile(wb, '마디_정산_' + ym + '.xlsx');
      showToast('✅ 엑셀 파일이 다운로드됐습니다!');
    } catch(e) {
      showToast('❌ 엑셀 파일 생성에 실패했습니다. 잠시 후 다시 시도해주세요');
    }
  }).catch(function(e) { showToast('⚠️ ' + _userErrMsg(e, '정산 데이터 로드')); });
}

// ─────── 선생님별 통계 ───────
var _staffTrendChart = null;

function initSvcStaffMonth() {
  var sel = document.getElementById('svcStaffMonth');
  if (!sel) return;
  var now = new Date();
  var options = '';
  for (var i = 0; i < 6; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var label = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월';
    options += '<option value="' + ym + '"' + (i === 0 ? ' selected' : '') + '>' + label + '</option>';
  }
  // eslint-disable-next-line no-unsanitized/property
  sel.innerHTML = options;
}

function renderStaffStats() {
  var listEl = document.getElementById('staffStatsList');
  if (!listEl) return;
  var sessions  = typeof sessionDB  !== 'undefined' ? sessionDB  : [];
  var schedules = typeof scheduleDB !== 'undefined' ? scheduleDB : [];

  var sel = document.getElementById('svcStaffMonth');
  var ym  = sel ? sel.value : '';
  if (!ym) {
    var now = new Date();
    ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  var monthSessions  = sessions.filter(function(s)  { return (s.date||'').startsWith(ym); });
  var monthSchedules = schedules.filter(function(s) { return (s.date||'').startsWith(ym); });

  // 해당 월 선생님 목록 수집 — 선택 월의 세션/스케줄에서만(전체 DB 수집 시 무활동 월에도 0% 카드가 떠 혼란)
  var teacherSet = {};
  monthSessions.forEach(function(s)  { if (s.teacher) teacherSet[s.teacher] = true; });
  monthSchedules.forEach(function(s) { if (s.teacher) teacherSet[s.teacher] = true; });
  var teachers = Object.keys(teacherSet).sort();

  if (!teachers.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">👩‍🏫</div><p>이 달에 기록된 선생님 데이터가 없습니다.</p></div>';
    return;
  }

  // 아바타 색상 팔레트 (이름 해시 기반 안정적 분배)
  var avatarPalette = [
    { bg: '#dbeafe', fg: '#1e40af' }, // blue
    { bg: '#fef3c7', fg: '#92400e' }, // amber
    { bg: '#fce7f3', fg: '#9f1239' }, // pink
    { bg: '#dcfce7', fg: '#166534' }, // green
    { bg: '#ede9fe', fg: '#5b21b6' }, // violet
    { bg: '#ffe4e6', fg: '#9f1239' }  // rose
  ];

  var rows = teachers.map(function(teacher) {
    // 이번 달 세션 수
    var mySessions  = monthSessions.filter(function(s)  { return s.teacher === teacher; });
    // 이번 달 예정 스케줄 수
    var mySchedules = monthSchedules.filter(function(s) { return s.teacher === teacher; });
    // 담당 이용자 수 (이번 달 세션에서 유니크 childId)
    var childIds = {};
    mySessions.forEach(function(s) { if (s.childId) childIds[s.childId] = true; });
    var childCount = Object.keys(childIds).length;

    // 완료율 — 데이터 없으면 회색 '—' 표시
    var totalSched = mySchedules.length;
    var completedCount = mySessions.length;
    var hasData = totalSched > 0 || completedCount > 0;
    var rate = totalSched > 0 ? Math.round(completedCount / totalSched * 100) : (completedCount > 0 ? 100 : 0);
    var rateLabel, rateColor, rateBg;
    if (!hasData) {
      rateLabel = '—'; rateColor = '#9ca3af'; rateBg = '#f3f4f6';
    } else if (rate >= 80) {
      rateLabel = rate + '%'; rateColor = '#059669'; rateBg = '#ecfdf5';
    } else if (rate >= 50) {
      rateLabel = rate + '%'; rateColor = '#d97706'; rateBg = '#fffbeb';
    } else {
      rateLabel = rate + '%'; rateColor = '#dc2626'; rateBg = '#fef2f2';
    }

    // 아바타 (이름 첫 글자 + 색상)
    var hash = 0;
    for (var i = 0; i < teacher.length; i++) hash = (hash * 31 + teacher.charCodeAt(i)) | 0;
    var pal = avatarPalette[Math.abs(hash) % avatarPalette.length];
    var initial = teacher.charAt(0);

    return '<div data-teacher="' + escHtml(teacher) + '" onclick="showStaffTrendFromCard(this)" '
      + 'onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.08)\';" '
      + 'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';" '
      + 'style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--card);border-radius:12px;margin-bottom:8px;cursor:pointer;border:1.5px solid var(--border);transition:all 0.15s ease;">'
      // 아바타
      + '<div style="flex:0 0 40px;width:40px;height:40px;border-radius:50%;background:' + pal.bg + ';color:' + pal.fg + ';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;">' + escHtml(initial) + '</div>'
      // 이름 + 담당 인원
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:15px;font-weight:800;color:var(--text);">' + escHtml(teacher) + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">👤 담당 이용자 ' + childCount + '명</div>'
      + '</div>'
      // 통계 그룹 (각각 배경색 카드)
      + '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">'
      + '<div style="min-width:54px;padding:6px 8px;background:#f0fdfa;border-radius:8px;text-align:center;">'
      + '<div style="font-size:15px;font-weight:900;color:#0d9488;line-height:1;">' + completedCount + '</div>'
      + '<div style="font-size:9px;color:#0d9488;margin-top:2px;">세션</div>'
      + '</div>'
      + '<div style="min-width:54px;padding:6px 8px;background:' + rateBg + ';border-radius:8px;text-align:center;">'
      + '<div style="font-size:15px;font-weight:900;color:' + rateColor + ';line-height:1;">' + rateLabel + '</div>'
      + '<div style="font-size:9px;color:' + rateColor + ';margin-top:2px;">완료율</div>'
      + '</div>'
      // 화살표 원형 버튼
      + '<div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;margin-left:4px;">'
      + '<span style="font-size:10px;color:#6b7280;">▶</span>'
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  // 안내 배지 (회색 본문 → 파란 배지로 강화)
  var hint = '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;margin-bottom:10px;">'
    + '<span style="font-size:11px;color:#1e40af;font-weight:600;">💡 카드를 눌러 월별 추이 확인</span>'
    + '</div>';

  // eslint-disable-next-line no-unsanitized/property
  listEl.innerHTML = hint + rows;

  // 차트 초기화
  var wrap = document.getElementById('staffChartWrap');
  if (wrap) wrap.style.display = 'none';
}

function showStaffTrendFromCard(el) {
  // C5 원칙: onclick 인라인 사용자 데이터 → data 속성 + 헬퍼로 분리
  showStaffTrend(el.dataset.teacher);
}

function showStaffTrend(teacher) {
  var wrap  = document.getElementById('staffChartWrap');
  var title = document.getElementById('staffChartTitle');
  if (!wrap || !title) return;

  var sessions = typeof sessionDB !== 'undefined' ? sessionDB : [];
  var now = new Date();

  // 이 선생님 세션을 1회만 순회해 'YYYY-MM'→건수 집계 (기존 6회 × O(N) 필터 → O(N))
  var byYm = {};
  for (var si = 0; si < sessions.length; si++) {
    var s = sessions[si];
    if (s.teacher !== teacher) continue;
    var key = (s.date || '').slice(0, 7);
    if (key) byYm[key] = (byYm[key] || 0) + 1;
  }
  // 최근 6개월 레이블 + 데이터
  var labels = [], data = [];
  for (var i = 5; i >= 0; i--) {
    var d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    labels.push((d.getMonth() + 1) + '월');
    data.push(byYm[ym] || 0);
  }

  title.textContent = teacher + ' 선생님 · 최근 6개월 세션 추이';
  wrap.style.display = 'block';

  // 모든 데이터가 0이면 차트 대신 empty state 표시
  var allZero = data.every(function(v) { return v === 0; });
  var ctx = document.getElementById('staffTrendChart');
  if (allZero) {
    // 기존 차트 인스턴스 정리
    if (_staffTrendChart) { _staffTrendChart.destroy(); _staffTrendChart = null; }
    // canvas 숨기고 empty state 카드 표시
    if (ctx) ctx.style.display = 'none';
    var emptyId = 'staffTrendEmpty';
    var empty   = document.getElementById(emptyId);
    if (!empty) {
      empty = document.createElement('div');
      empty.id = emptyId;
      empty.style.cssText = 'padding:28px 16px;border:1.5px dashed var(--border);border-radius:12px;background:var(--bg);text-align:center;';
      empty.innerHTML = '<div style="font-size:28px;margin-bottom:8px;">📊</div>'
        + '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">아직 세션 기록이 없어요</div>'
        + '<div style="font-size:11px;color:var(--text2);">세션을 등록하면 6개월 추이가 표시됩니다</div>';
      if (ctx && ctx.parentNode) {
        ctx.parentNode.appendChild(empty);
      } else if (wrap) {
        wrap.appendChild(empty);
      }
    }
    empty.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // 데이터 있을 때: empty state 숨기고 canvas 다시 표시
  var existingEmpty = document.getElementById('staffTrendEmpty');
  if (existingEmpty) existingEmpty.style.display = 'none';
  if (ctx) ctx.style.display = '';

  if (!ctx) return;

  if (_staffTrendChart) { _staffTrendChart.destroy(); _staffTrendChart = null; }
  ensureChart().then(function() {
    _staffTrendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '세션 수',
          data: data,
          backgroundColor: 'rgba(14,165,160,0.25)',
          borderColor: '#0ea5a0',
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }).catch(function(e) {
    if (typeof showError === 'function') showError(e, '차트 로드');
  });
}

// ─────── 입력 모드 ───────