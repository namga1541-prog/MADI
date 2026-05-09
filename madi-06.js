function openBulkClosedDateModal(ids) {
  var today = new Date().toISOString().slice(0,10);
  var modal = document.getElementById('bulkClosedDateModal');
  if (!modal) return;

  // 아동 수
  document.getElementById('bcdCount').textContent = ids.length;

  // 이름 미리보기 생성
  var preview = document.getElementById('bcdNamePreview');
  if (preview) {
    var names = ids.map(function(id) {
      var c = childDB.find(function(c){ return c.id === id; });
      return c ? escHtml(c.name) : '?';
    });
    var MAX_SHOW = 5;
    var shown = names.slice(0, MAX_SHOW).join(', ');
    var extra = names.length > MAX_SHOW ? ' 외 ' + (names.length - MAX_SHOW) + '명' : '';
    preview.innerHTML = '👶 ' + shown + (extra ? '<strong>' + extra + '</strong>' : '');
  }

  // 날짜 초기화
  document.getElementById('bcdDateInput').value = today;

  // 종결 사유 초기화
  var sel = document.getElementById('bcdReasonSelect');
  if (sel) sel.selectedIndex = 0;
  var etc = document.getElementById('bcdReasonEtc');
  if (etc) { etc.value = ''; etc.style.display = 'none'; }

  modal.dataset.ids = JSON.stringify(ids);
  modal.style.display = 'flex';
}

function toggleBcdReasonEtc() {
  var sel = document.getElementById('bcdReasonSelect');
  var etc = document.getElementById('bcdReasonEtc');
  if (!sel || !etc) return;
  etc.style.display = sel.value === '기타' ? 'block' : 'none';
  if (sel.value === '기타') setTimeout(function(){ etc.focus(); }, 100);
}

function closeBulkClosedDateModal() {
  var modal = document.getElementById('bulkClosedDateModal');
  if (modal) { modal.style.display = 'none'; modal.dataset.ids = ''; }
}

function confirmBulkClosedDate() {
  var modal = document.getElementById('bulkClosedDateModal');
  if (!modal) return;
  var ids = [];
  try { ids = JSON.parse(modal.dataset.ids || '[]'); } catch(e) {}
  if (!ids.length) { closeBulkClosedDateModal(); return; }

  var date = (document.getElementById('bcdDateInput') || {}).value || '';
  if (!date) { showToast('⚠️ 종결일을 선택해주세요'); return; }

  // 종결 사유 조합
  var sel = document.getElementById('bcdReasonSelect');
  var etc = document.getElementById('bcdReasonEtc');
  var reason = sel ? sel.value : '';
  if (reason === '기타') {
    var etcVal = etc ? etc.value.trim() : '';
    reason = etcVal || '기타';
  }

  // 최종 확인창
  var names = ids.map(function(id) {
    var c = childDB.find(function(c){ return c.id === id; });
    return c ? c.name : '?';
  });
  var preview = names.slice(0, 3).join(', ') + (names.length > 3 ? ' 외 ' + (names.length - 3) + '명' : '');
  if (!confirm(ids.length + '명을 종결 처리합니다.\n\n' + preview + '\n\n종결일: ' + date + '\n사유: ' + reason + '\n\n되돌릴 수 없습니다. 계속하시겠습니까?')) return;

  closeBulkClosedDateModal();
  applyBulkStatus(ids, '종결', date, reason);
}

function setChildStatus(status, btn) {
  _childStatusFilter = status;
  document.querySelectorAll('.child-status-tab').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  // 상태 탭 변경 시 선택 초기화 (혼동 방지)
  _bulkSelected = {};
  updateBulkCountLabel();
  renderChildGrid();
}

function openChildRegModal() {
  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.id = 'childRegModal';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  overlay.innerHTML = '<div class="sched-modal" style="max-height:90vh;overflow-y:auto;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<div class="sched-modal-title" style="margin-bottom:0;">➕ 이용자 등록</div>'
    + '<button onclick="this.closest(\'.sched-modal-overlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button>'
    + '</div>'

    + '<div class="form-group"><label class="form-label">이름</label>'
    + '<input class="form-input" type="text" id="m_childName" placeholder="아동 이름"></div>'

    + '<div class="form-group"><label class="form-label">생년월일</label>'
    + '<div style="display:flex;gap:8px;align-items:center;">'
    + '<input class="form-input" type="text" id="m_childBirth" placeholder="예: 20200429" maxlength="8" inputmode="numeric" pattern="[0-9]*" oninput="formatBirthInput(this);m_updateAge()" onchange="m_updateAge()" style="flex:1;">'
    + '<div id="m_ageDisplay" style="padding:10px 12px;background:#f0fdf4;border-radius:10px;font-size:13px;font-weight:700;color:var(--mint);border:1.5px solid var(--mint);white-space:nowrap;min-width:90px;text-align:center;">생활연령</div>'
    + '</div></div>'

    + '<div class="form-group"><label class="form-label">장애 유형</label>'
    + '<select class="form-input" id="m_childType">'
    + ['언어발달장애','조음음운장애','유창성장애','자폐스펙트럼','지적장애','청각장애','기타'].map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('')
    + '</select></div>'

    + '<div class="form-group"><label class="form-label">연락처</label>'
    + '<input class="form-input" type="tel" id="m_childPhone" placeholder="예: 010-1234-5678"></div>'

    + '<div class="form-group"><label class="form-label">상태</label>'
    + '<select class="form-input" id="m_childStatus">'
    + '<option value="등록">✅ 등록</option><option value="대기">⏳ 대기</option><option value="종결">🔒 종결</option>'
    + '</select></div>'

    + '<div class="form-group"><label class="form-label">메모</label>'
    + '<textarea class="form-input" id="m_childMemo" placeholder="특이사항, 가정환경 등" style="min-height:60px;"></textarea></div>'

    + '<button class="btn btn-primary" style="margin-top:4px;" onclick="addChildFromModal()">✅ 등록 완료</button>'
    + '</div>';

  document.body.appendChild(overlay);
  setTimeout(function(){ document.getElementById('m_childName').focus(); }, 200);
}

function m_updateAge() {
  var raw = (document.getElementById('m_childBirth')||{}).value || '';
  raw = raw.replace(/[^0-9]/g,'').slice(0,8);
  var birth = raw.length===8 ? raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8) : '';
  var el = document.getElementById('m_ageDisplay');
  if (!el) return;
  var age = calcAgeFromBirth(birth);
  el.textContent = age || '생활연령';
  el.style.color = age ? 'var(--mint)' : '#94a3b8';
}

function addChildFromModal() {
  var name   = (document.getElementById('m_childName')||{}).value.trim();
  var raw    = ((document.getElementById('m_childBirth')||{}).value||'').replace(/[^0-9]/g,'');
  var birth  = raw.length===8 ? raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8) : '';
  var age    = calcAgeFromBirth(birth) || birth;
  var type   = (document.getElementById('m_childType')||{}).value || '기타';
  var phone  = (document.getElementById('m_childPhone')||{}).value.trim();
  var status = (document.getElementById('m_childStatus')||{}).value || '등록';
  var memo   = (document.getElementById('m_childMemo')||{}).value.trim();

  if (!name)  { showToast('이름을 입력해주세요.'); return; }
  if (!birth) { showToast('생년월일을 입력해주세요.'); return; }

  if (_addChildLock) return;
  _addChildLock = true;
  setTimeout(function(){ _addChildLock = false; }, 1500);

  childDB.push({ id:Date.now() + Math.floor(Math.random() * 1000), name:name, birth:birth, age:age, type:type,
    phone:phone, goals:[], memo:memo, status:status, startDate:'', voucherLimit:0,
    color:CHILD_COLORS[childDB.length % CHILD_COLORS.length] });
  saveChildren();
  renderChildGrid();
  populateChildSelects();
  var modal = document.getElementById('childRegModal');
  if (modal) modal.remove();
  showToast('✅ ' + name + ' 등록 완료!');
}

function toggleChildCard(id) {
  var card = document.getElementById('cc_' + id);
  if (!card) return;
  card.classList.toggle('open');
}

function openChildDetail(id) {
  var child = childDB.find(function(c) { return c.id === id; });
  if (!child) return;
  var today = new Date().toISOString().slice(0, 10);
  var ss = sessionDB.filter(function(s) { return s.childId === id; })
    .sort(function(a,b){ return a.date<b.date?1:-1; });
  var allScheds = scheduleDB.filter(function(s) { return s.childId === id; })
    .sort(function(a,b){ return a.date<b.date?1:-1; });
  var upcoming = allScheds.filter(function(s){ return s.date >= today; }).reverse().slice(0,10);
  var past     = allScheds.filter(function(s){ return s.date < today; }).slice(0,10);

  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  // 스케줄 행 렌더
  function schedRow(s) {
    var tColor = getTeacherColor(s.teacher);
    var hasNote = sessionDB.some(function(n){ return n.childId===id && n.date===s.date; });
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f1f5f9;">'
      + '<span style="font-size:12px;min-width:80px;color:#64748b;">' + escHtml(s.date) + '</span>'
      + (s.startTime ? '<span style="font-size:12px;color:#475569;min-width:56px;">' + s.startTime.slice(0,5) + (s.endTime?'~'+s.endTime.slice(0,5):'') + '</span>' : '')
      + (s.teacher ? '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:'+tColor+'22;color:'+tColor+';font-weight:700;">' + escHtml(s.teacher) + '</span>' : '')
      + '<span style="font-size:11px;margin-left:auto;">' + (hasNote ? '📝 기록됨' : '<span style="color:#f59e0b;">⏳ 미기록</span>') + '</span>'
      + '</div>';
  }

  overlay.innerHTML = '<div class="sched-modal" style="max-width:500px;max-height:90vh;overflow-y:auto;">'
    // 헤더
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div><div style="font-size:18px;font-weight:700;">' + escHtml(child.name) + '</div>'
    + '<div style="font-size:13px;color:var(--text2);">' + escHtml(child.age) + ' · ' + escHtml(child.type) + '</div></div>'
    + '<button onclick="this.closest(\'.sched-modal-overlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button></div>'

    // 기본 정보
    + '<div style="background:#f8fafc;border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;line-height:2;">'
    + (child.birth ? '🎂 <b>생년월일</b> ' + child.birth + '<br>' : '')
    + (child.phone ? '📞 <b>연락처</b> ' + escHtml(child.phone) + '<br>' : '')
    + (child.memo  ? '📋 <b>메모</b> ' + escHtml(child.memo) + '<br>' : '')
    + '📊 <b>세션</b> 총 ' + ss.length + '회'
    + '</div>'

    // 예정 스케줄
    + '<div style="font-size:13px;font-weight:700;color:var(--mint);margin-bottom:6px;">📅 예정 스케줄</div>'
    + (upcoming.length ? upcoming.map(schedRow).join('') : '<div style="color:#94a3b8;font-size:12px;padding:8px 0;">예정 스케줄 없음</div>')

    // 최근 세션 기록
    + '<div style="font-size:13px;font-weight:700;color:#0f2942;margin:14px 0 6px;">📝 최근 세션 기록</div>'
    + (ss.length ? ss.slice(0,5).map(function(s){
        return '<div style="padding:7px 0;border-bottom:1px solid #f1f5f9;">'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:3px;">'
          + '<span>' + escHtml(s.date) + '</span></div>'
          + '<div style="font-size:12px;color:#1e293b;white-space:pre-wrap;">' + escHtml((s.note||s.memo||'').slice(0,80)) + (((s.note||s.memo||'').length>80)?'…':'') + '</div>'
          + '</div>';
      }).join('') : '<div style="color:#94a3b8;font-size:12px;padding:8px 0;">세션 기록 없음</div>')

    // 버튼
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-primary" style="flex:1;" onclick="this.closest(\'.sched-modal-overlay\').remove();goToSession(' + id + ')">📝 세션 기록</button>'
    + '<button class="btn-ghost" style="flex:1;" onclick="this.closest(\'.sched-modal-overlay\').remove();openEditModal(' + id + ')">✏️ 편집</button>'
    + '</div></div>';

  document.body.appendChild(overlay);
}

function goToSession(id) {
  // sessionChild 값을 탭 전환 전에 먼저 설정 (renderSessionList 필터 적용을 위해)
  var sel = document.getElementById('sessionChild');
  if (sel) {
    sel.value = id;
    if (sel._ssInp) {
      var ch0 = childDB.find(function(c){ return c.id === id; });
      sel._ssInp.value = ch0 ? ch0.name + ' (' + (ch0.birth||'') + ' / ' + (ch0.age||'') + ')' : '';
    }
  }
  switchTab(2);
  setTimeout(function() {
    var sel2 = document.getElementById('sessionChild');
    if (sel2) {
      sel2.value = id;
      if (sel2._ssInp) {
        var ch = childDB.find(function(c){ return c.id === id; });
        sel2._ssInp.value = ch ? ch.name + ' (' + (ch.birth||'') + ' / ' + (ch.age||'') + ')' : '';
      }
      loadGoalRows(id);
    }
    // 아동 선택 후 세션 목록 + 미작성 알림 재렌더링
    if (typeof renderSessionList === 'function') renderSessionList();
    if (typeof renderUnwrittenAlert === 'function') renderUnwrittenAlert();
  }, 100);
}

// ─────── 아동 편집 모달 ───────
function openEditModal(id) {
  var child = childDB.find(function(c) { return c.id === id; });
  if (!child) return;

  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.id = 'editModal';
  overlay.onclick = function(e) { if (e.target === overlay) closeEditModal(); };

  overlay.innerHTML = '<div class="sched-modal" style="max-height:88vh;overflow-y:auto;">'
    + '<div class="sched-modal-title">✏️ 아동 정보 편집</div>'

    + '<div class="form-group"><label class="form-label">이름</label>'
    + '<input class="form-input" type="text" id="editName" value="' + escHtml(child.name) + '"></div>'

    + '<div class="form-group"><label class="form-label">생년월일</label>'
    + '<div style="display:flex;gap:8px;align-items:center;">'
    + '<input class="form-input" type="text" id="editBirth" value="' + escHtml((child.birth||'').replace(/-/g,'')) + '" placeholder="예: 20200429" maxlength="8" inputmode="numeric" pattern="[0-9]*" oninput="formatBirthInput(this);updateEditAge()" style="flex:1;">'
    + '<div id="editAgeDisplay" style="padding:10px 12px;background:#f0fdf4;border-radius:10px;font-size:13px;font-weight:700;color:var(--mint);border:1.5px solid var(--mint);white-space:nowrap;min-width:90px;text-align:center;">'
    + escHtml(child.age || '생활연령') + '</div>'
    + '</div></div>'

    + '<div class="form-group"><label class="form-label">장애 유형</label>'
    + '<select class="form-input" id="editType">'
    + ['언어발달장애','조음음운장애','유창성장애','자폐스펙트럼','지적장애','청각장애','기타'].map(function(t) {
        return '<option value="' + t + '"' + (child.type === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('')
    + '</select></div>'

    + '<div class="form-group"><label class="form-label">연락처</label>'
    + '<input class="form-input" type="tel" id="editPhone" value="' + escHtml(child.phone || '') + '" placeholder="010-0000-0000"></div>'

    + '<div class="form-group"><label class="form-label">상태</label>'
    + '<select class="form-input" id="editStatus" onchange="var w=document.getElementById(\'editClosedAtWrap\');if(w)w.style.display=this.value===\'종결\'?\'\':\'none\';">'
    + ['등록','대기','종결'].map(function(s){ return '<option value="'+s+'"'+(( child.status||'등록')===s?' selected':'')+'>'+s+'</option>'; }).join('')
    + '</select></div>'

    + '<div class="form-group"><label class="form-label">치료 목표 <span style="color:#94a3b8;font-weight:400;">(쉼표로 구분)</span></label>'
    + '<input class="form-input" type="text" id="editGoals" value="' + escHtml((child.goals || []).join(', ')) + '" placeholder="예: ㅅ발음, 두 단어 조합"></div>'

    + '<div class="form-row">'
    + '<div style="flex:1;"><label class="form-label">치료 시작일</label>'
    + '<input class="form-input" type="date" id="editStartDate" value="' + escHtml(child.startDate || '') + '"></div>'
    + '<div style="flex:1;"><label class="form-label">바우처 월 한도 (회)</label>'
    + '<input class="form-input" type="number" id="editVoucherLimit" value="' + (child.voucherLimit || 0) + '" min="0" max="99" placeholder="예: 16"></div>'
    + '</div>'

    + '<div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid var(--border);">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;">💰 서비스 요금 정보</div>'

    + '<div class="form-group" style="margin-bottom:8px;"><label class="form-label" style="font-size:11px;">1회 서비스 금액 (원)</label>'
    + '<input class="form-input" type="number" id="editFeePerSession" value="' + (child.feePerSession || 0) + '" min="0" step="1000" placeholder="예: 80000" inputmode="numeric" oninput="calcEditCopay()"></div>'

    + '<div class="form-group" style="margin-bottom:8px;"><label class="form-label" style="font-size:11px;">결제 유형</label>'
    + '<div style="display:flex;gap:8px;">'
    + '<button type="button" id="payTypeNormal" onclick="setEditPayType(\'일반\')" class="btn-ghost" style="flex:1;font-size:13px;padding:8px;">💳 일반</button>'
    + '<button type="button" id="payTypeVoucher" onclick="setEditPayType(\'바우처\')" class="btn-ghost" style="flex:1;font-size:13px;padding:8px;">🎟 바우처</button>'
    + '</div></div>'

    + '<input type="hidden" id="editVoucherType" value="' + escHtml(child.voucherType || '일반') + '">'

    + '<div class="voucher-accordion" id="editVoucherAccordion">'
    + '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">바우처 종류를 선택하세요</div>'
    + [
        { key:'발달재활바우처',      label:'발달재활 바우처' },
        { key:'우리아이심리지원서비스바우처', label:'우리아이 심리지원서비스' },
        { key:'꿈E든카드바우처',     label:'꿈E든카드' },
        { key:'나래사랑카드바우처',   label:'나래사랑카드' }
      ].map(function(v){
        var sel = (child.voucherType === v.key);
        return '<button type="button" id="vBtn_' + v.key + '" onclick="selectEditVoucherKind(\'' + v.key + '\')" class="voucher-type-btn' + (sel?'':' inactive') + '">'
          + '<span>' + v.label + '</span>'
          + '<span style="font-size:16px;">' + (sel?'✅':'○') + '</span>'
          + '</button>';
      }).join('')
    + '<div class="form-group" style="margin-top:4px;"><label class="form-label" style="font-size:11px;">월 바우처 지원금액 (원)</label>'
    + '<input class="form-input" type="number" id="editVoucherMonthlyAmt" value="' + (child.voucherMonthlyAmt || 0) + '" min="0" step="1000" inputmode="numeric" oninput="calcEditCopay()" placeholder="예: 220000"></div>'
    + '<div id="editCopayResult" class="voucher-calc-result" style="display:none;"></div>'
    + '</div>'

    + '<div class="form-group" style="margin-top:8px;"><label class="form-label" style="font-size:11px;">본인부담금 (원) <span style="color:var(--text2);font-weight:400;">— 바우처 선택 시 자동계산</span></label>'
    + '<input class="form-input" type="number" id="editCopay" value="' + (child.copay || 0) + '" min="0" step="1000" inputmode="numeric"></div>'

    + '</div>'
    + '<div id="editClosedAtWrap" style="' + ((child.status||'등록') === '종결' ? '' : 'display:none;') + '">'
    + '<div class="form-group"><label class="form-label">🔒 종결일</label>'
    + '<input class="form-input" type="date" id="editClosedAt" value="' + escHtml(child.closedAt || '') + '"></div>'
    + '<div class="form-group"><label class="form-label">💬 종결 사유</label>'
    + '<select class="form-input" id="editClosedReason" style="font-size:16px;">'
    + ['치료 완료','자발적 종결','이사','기관 이전','경제적 사유','기타'].map(function(r){
        return '<option value="' + r + '"' + ((child.closedReason||'치료 완료')===r?' selected':'') + '>' + r + '</option>';
      }).join('')
    + '</select></div>'
    + '</div>'

    + '<div class="form-group"><label class="form-label">메모</label>'
    + '<textarea class="form-input" id="editMemo" style="min-height:70px;">' + escHtml(child.memo || '') + '</textarea></div>'

    + '<div style="display:flex;gap:8px;margin-top:4px;">'
    + '<button class="btn btn-primary" style="flex:1;" onclick="saveEditModal(' + id + ')">💾 저장</button>'
    + '<button class="btn-ghost" style="flex:0.4;" onclick="closeEditModal()">취소</button>'
    + '</div></div>';

  document.body.appendChild(overlay);

  // 생활연령 즉시 표시
  setTimeout(function() {
    updateEditAge();
    // 바우처 UI 초기화
    var vtype = child.voucherType || '일반';
    var isVoucher = (vtype !== '일반');
    setEditPayType(isVoucher ? '바우처' : '일반');
    if (isVoucher) selectEditVoucherKind(vtype);
  }, 50);
}

var VOUCHER_KINDS = ['발달재활바우처','우리아이심리지원서비스바우처','꿈E든카드바우처','나래사랑카드바우처'];

function setEditPayType(type) {
  var hiddenEl = document.getElementById('editVoucherType');
  var accordion = document.getElementById('editVoucherAccordion');
  var btnNormal  = document.getElementById('payTypeNormal');
  var btnVoucher = document.getElementById('payTypeVoucher');
  if (!hiddenEl || !accordion) return;

  var isVoucher = (type !== '일반');
  // 바우처 선택 시 현재 hidden에 저장된 바우처 종류 유지, 일반이면 '일반'으로 초기화
  if (!isVoucher) hiddenEl.value = '일반';
  accordion.classList[isVoucher ? 'add' : 'remove']('open');

  if (btnNormal)  { btnNormal.style.background  = isVoucher ? '' : 'var(--mint)';  btnNormal.style.color  = isVoucher ? '' : '#fff'; btnNormal.style.borderColor  = isVoucher ? '' : 'var(--mint)'; }
  if (btnVoucher) { btnVoucher.style.background = isVoucher ? 'var(--mint)' : ''; btnVoucher.style.color = isVoucher ? '#fff' : ''; btnVoucher.style.borderColor = isVoucher ? 'var(--mint)' : ''; }

  if (!isVoucher) {
    var copayEl = document.getElementById('editCopay');
    if (copayEl) copayEl.value = 0;
    var resultEl = document.getElementById('editCopayResult');
    if (resultEl) resultEl.style.display = 'none';
  } else {
    calcEditCopay();
  }
}

function selectEditVoucherKind(key) {
  var hiddenEl = document.getElementById('editVoucherType');
  if (hiddenEl) hiddenEl.value = key;
  VOUCHER_KINDS.forEach(function(k) {
    var btn = document.getElementById('vBtn_' + k);
    if (!btn) return;
    var sel = (k === key);
    btn.className = 'voucher-type-btn' + (sel ? '' : ' inactive');
    btn.querySelector('span:last-child').textContent = sel ? '✅' : '○';
  });
  calcEditCopay();
}

function calcEditCopay() {
  var feeEl   = document.getElementById('editFeePerSession');
  var amtEl   = document.getElementById('editVoucherMonthlyAmt');
  var limitEl = document.getElementById('editVoucherLimit');
  var copayEl = document.getElementById('editCopay');
  var resultEl= document.getElementById('editCopayResult');
  var typeEl  = document.getElementById('editVoucherType');
  if (!feeEl || !copayEl) return;

  var fee   = parseInt(feeEl.value) || 0;
  var vtype = typeEl ? typeEl.value : '일반';
  if (vtype === '일반' || !amtEl) { if (resultEl) resultEl.style.display = 'none'; return; }

  var monthlyAmt = parseInt(amtEl.value) || 0;
  var limit      = parseInt(limitEl ? limitEl.value : 0) || 1;
  var perSession = Math.round(monthlyAmt / limit);  // 회당 바우처 지원금
  var myCopay    = Math.max(0, fee - perSession);   // 본인부담금

  copayEl.value = myCopay;

  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = '1회 ' + fee.toLocaleString() + '원'
      + ' − 바우처 ' + perSession.toLocaleString() + '원'
      + ' = <b>본인부담 ' + myCopay.toLocaleString() + '원</b>'
      + '<div style="font-size:11px;font-weight:400;color:var(--text2);margin-top:2px;">'
      + '월지원 ' + monthlyAmt.toLocaleString() + '원 ÷ ' + limit + '회 = 회당 ' + perSession.toLocaleString() + '원</div>';
  }
}

function updateEditAge() {
  var birth = document.getElementById('editBirth');
  var display = document.getElementById('editAgeDisplay');
  if (!birth || !display) return;
  var age = calcAgeFromBirth(birth.value);
  if (age) {
    display.textContent = age;
    display.style.color = 'var(--mint)';
    display.style.background = '#f0fdf4';
    display.style.borderColor = 'var(--mint)';
  } else {
    display.textContent = '생활연령';
    display.style.color = '#94a3b8';
    display.style.background = '#f8fafc';
    display.style.borderColor = 'var(--border)';
  }
}

function saveEditModal(id) {
  var idx = childDB.findIndex(function(c) { return c.id === id; });
  if (idx < 0) return;

  var name  = document.getElementById('editName').value.trim();
  var birthRaw = document.getElementById('editBirth').value.replace(/[^0-9]/g,'');
  var birth = birthRaw.length===8 ? birthRaw.slice(0,4)+'-'+birthRaw.slice(4,6)+'-'+birthRaw.slice(6,8) : document.getElementById('editBirth').value;
  var age   = calcAgeFromBirth(birth) || childDB[idx].age;
  var type  = document.getElementById('editType').value;
  var phone = document.getElementById('editPhone').value.trim();
  var status = (document.getElementById('editStatus') || {}).value || '등록';
  var goals = document.getElementById('editGoals').value.split(',').map(function(g) { return g.trim(); }).filter(Boolean);
  var startDate    = document.getElementById('editStartDate').value;
  var closedAt     = (document.getElementById('editClosedAt') || {}).value || '';
  var closedReason = (document.getElementById('editClosedReason') || {}).value || '';
  var voucherLimit      = parseInt(document.getElementById('editVoucherLimit').value) || 0;
  var voucherType       = (document.getElementById('editVoucherType') || {}).value || '일반';
  var feePerSession     = parseInt(document.getElementById('editFeePerSession').value) || 0;
  var voucherMonthlyAmt = parseInt((document.getElementById('editVoucherMonthlyAmt')||{value:'0'}).value) || 0;
  var copay             = parseInt(document.getElementById('editCopay').value) || 0;
  var memo  = document.getElementById('editMemo').value.trim();

  if (!name) { showToast('이름을 입력해주세요.'); return; }

  var updatedChild = Object.assign({}, childDB[idx], {
    name: name, birth: birth, age: age, type: type,
    phone: phone, goals: goals, startDate: startDate,
    voucherLimit: voucherLimit, voucherType: voucherType,
    feePerSession: feePerSession, voucherMonthlyAmt: voucherMonthlyAmt, copay: copay,
    memo: memo, status: status
  });
  if (status === '종결' && closedAt) {
    updatedChild.closedAt = closedAt;
    updatedChild.closedReason = closedReason;
  } else if (status !== '종결') {
    delete updatedChild.closedAt;
    delete updatedChild.closedReason;
  }
  childDB[idx] = updatedChild;

  saveChildren();
  renderChildGrid();
  populateChildSelects();
  closeEditModal();
  showToast('✅ ' + name + ' 정보가 수정되었습니다!');
}

function closeEditModal() {
  var m = document.getElementById('editModal');
  if (m) m.remove();
}
// ─────── 검색 셀렉트 공통 ───────
function updateSSDrop(sel) {
  var inp  = sel._ssInp;
  var drop = sel._ssDrop;
  if (!inp || !drop) return;
  var q    = inp.value.trim().toLowerCase();
  var html = '';
  var opts = Array.prototype.slice.call(sel.options);
  opts.forEach(function(opt) {
    if (!opt.value) return;
    var label = opt.textContent.trim();
    if (!q || label.toLowerCase().indexOf(q) > -1) {
      html += '<div class="ss-item" data-val="' + escHtml(opt.value) + '" data-label="' + escHtml(label) + '">' + escHtml(label) + '</div>';
    }
  });
  drop.innerHTML = html || '<div class="ss-empty">검색 결과 없음</div>';
  drop.querySelectorAll('.ss-item').forEach(function(item) {
    item.addEventListener('mousedown', function(e) {
      e.preventDefault();
      sel.value = item.dataset.val;
      inp.value = item.dataset.label;
      drop.style.display = 'none';
      sel.dispatchEvent(new Event('change'));
    });
  });
}

function makeSearchable(id) {
  var sel = document.getElementById(id);
  if (!sel) return;

  // select가 현재 ss-wrap 안에 있는지 확인
  var inWrap = sel.parentNode && sel.parentNode.classList && sel.parentNode.classList.contains('ss-wrap');

  // 정상 상태: JS 참조가 있고 실제 DOM의 wrap과 일치 → 내용만 갱신
  if (sel._ssWrap && sel._ssWrap.isConnected && inWrap && sel.parentNode === sel._ssWrap) {
    updateSSDrop(sel);
    var cur = sel.options[sel.selectedIndex];
    if (cur && cur.value && sel._ssInp) sel._ssInp.value = cur.textContent.trim();
    else if (sel._ssInp) { sel._ssInp.value = ''; }
    if (id === 'sessionChild' && sel._ssInp) sel._ssInp.placeholder = '아동 검색...';
    return;
  }

  // JS 참조 정리
  if (sel._ssWrap) {
    if (sel._ssWrap.isConnected && sel._ssWrap.parentNode) {
      sel._ssWrap.parentNode.removeChild(sel._ssWrap);
    }
    sel._ssWrap = null; sel._ssInp = null;
    sel._ssDrop = null; sel._ssArrow = null;
  }

  // select를 모든 ss-wrap 계층 밖으로 꺼내기 (중첩된 경우 반복 처리)
  while (sel.parentNode && sel.parentNode.classList && sel.parentNode.classList.contains('ss-wrap')) {
    var oldWrap = sel.parentNode;
    oldWrap.parentNode.insertBefore(sel, oldWrap);
    oldWrap.parentNode.removeChild(oldWrap);
  }

  // 형제로 남아있는 고아 ss-wrap도 제거
  if (sel.parentNode) {
    var orphans = sel.parentNode.querySelectorAll('.ss-wrap');
    Array.prototype.forEach.call(orphans, function(ow) {
      ow.parentNode && ow.parentNode.removeChild(ow);
    });
  }

  if (!sel._ssWrap) {
    var wrap = document.createElement('div');
    wrap.className = 'ss-wrap';
    wrap.style.cssText = 'position:relative;display:block;';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.style.display = 'none';

    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-input ss-input';
    inp.placeholder = '이름 검색...';
    inp.setAttribute('autocomplete', 'off');
    inp.style.cssText = 'width:100%;box-sizing:border-box;padding-right:36px;';
    wrap.insertBefore(inp, sel);

    // ▼ 드롭다운 토글 버튼
    var arrowBtn = document.createElement('button');
    arrowBtn.type = 'button';
    arrowBtn.textContent = '▼';
    arrowBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;padding:4px;touch-action:manipulation;';
    arrowBtn.addEventListener('mousedown', function(e){
      e.preventDefault();
      if (drop.style.display === 'none' || !drop.style.display) {
        inp.value = '';
        drop.style.display = 'block';
        updateSSDrop(sel);
        inp.focus();
      } else {
        drop.style.display = 'none';
      }
    });
    wrap.appendChild(arrowBtn);

    var drop = document.createElement('div');
    drop.className = 'ss-drop';
    wrap.appendChild(drop);

    sel._ssWrap  = wrap;
    sel._ssInp   = inp;
    sel._ssDrop  = drop;
    sel._ssArrow = arrowBtn;

    inp.addEventListener('input',  function() { drop.style.display='block'; updateSSDrop(sel); });
    inp.addEventListener('focus',  function() { drop.style.display='block'; updateSSDrop(sel); });
    inp.addEventListener('blur',   function() { setTimeout(function(){ drop.style.display='none'; }, 220); });
  }
  updateSSDrop(sel);
  var cur = sel.options[sel.selectedIndex];
  if (cur && cur.value && sel._ssInp) sel._ssInp.value = cur.textContent.trim();
  else if (sel._ssInp) { sel._ssInp.value = ''; }
  if (id === 'sessionChild' && sel._ssInp) sel._ssInp.placeholder = '아동 검색...';
}

// ─────── 세션탭 종결 아동 포함 토글 ───────
var _showDischargedInSession = false;

function toggleDischargedInSession() {
  _showDischargedInSession = !_showDischargedInSession;
  var btn = document.getElementById('sessionDischargedToggle');
  if (btn) {
    btn.textContent = _showDischargedInSession ? '🔒 종결 아동 숨기기' : '🔒 종결 아동 포함';
    btn.style.background = _showDischargedInSession ? '#fef2f2' : '';
    btn.style.color      = _showDischargedInSession ? '#dc2626' : '';
    btn.style.borderColor= _showDischargedInSession ? '#dc2626' : '';
  }
  populateChildSelects();
}

function populateChildSelects() {
  // 캐시 키: 아동 수 + 마지막 아동 id + 마지막 이름 (변경 감지)
  var lastChild = childDB.length > 0 ? childDB[childDB.length - 1] : null;
  var cacheKey = childDB.length + ':' + (lastChild ? (lastChild.id + ':' + lastChild.name) : 'empty');

  // 가나다 정렬 + 옵션 HTML — 캐시 활용
  if (cacheKey !== _optionsCacheKey) {
    var sorted = childDB.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    _optionsCacheHtml = sorted.map(function(c) {
      var label = escHtml(c.name) + ' (' + escHtml(c.birth||'') + ' / ' + escHtml(c.age) + ')';
      return '<option value="' + c.id + '">' + label + '</option>';
    }).join('');
    _optionsCacheKey = cacheKey;
  }

  ['sessionChild','chartChild','reportChild','portfolioChild','faqChild',
   'assessChild','eduChild','iepChild','scheduleChildSel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var cur = el.value;
    var needsEmpty = ['sessionChild','chartChild',
                      'reportChild','portfolioChild','faqChild','eduChild','iepChild'];
    // sessionChild는 종결 아동 자동 제외 — 토글 ON 시 포함 (🔒 종결 아동 포함 버튼)
    var optsHtml;
    if (id === 'sessionChild') {
      var activeChildren = childDB
        .filter(function(c){ return _showDischargedInSession ? true : c.status !== '종결'; })
        .sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
      optsHtml = activeChildren.map(function(c) {
        var isDischarged = (c.status === '종결');
        var label = (isDischarged ? '[종결] ' : '') + escHtml(c.name) + ' (' + escHtml(c.birth||'') + ' / ' + escHtml(c.age) + ')';
        return '<option value="' + c.id + '"' + (isDischarged ? ' style="color:#94a3b8;"' : '') + '>' + label + '</option>';
      }).join('');
    } else {
      optsHtml = _optionsCacheHtml;
    }
    el.innerHTML = childDB.length === 0
      ? '<option value="">아동을 먼저 등록해주세요</option>'
      : (needsEmpty.indexOf(id) > -1 ? '<option value="">아동 검색...</option>' : '')
        + optsHtml;
    // 이전 선택값 복원
    if (cur) el.value = cur;
  });
  var sc = document.getElementById('sessionChild');
  if (sc) {
    sc.onchange = function() {
      var id = parseInt(this.value);
      if (id) loadGoalRows(id);
    };
    if (sc.value) loadGoalRows(parseInt(sc.value));
    // 종결 아동 포함 토글 버튼 삽입 (중복 방지)
    if (!document.getElementById('sessionDischargedToggle')) {
      var toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id   = 'sessionDischargedToggle';
      toggleBtn.textContent = '🔒 종결 아동 포함';
      toggleBtn.onclick = toggleDischargedInSession;
      toggleBtn.style.cssText = 'margin-top:6px;font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;touch-action:manipulation;';
      var scParent = sc._ssWrap ? sc._ssWrap.parentNode : sc.parentNode;
      if (scParent) scParent.appendChild(toggleBtn);
    } else {
      // 상태 동기화
      var existBtn = document.getElementById('sessionDischargedToggle');
      existBtn.textContent  = _showDischargedInSession ? '🔒 종결 아동 숨기기' : '🔒 종결 아동 포함';
      existBtn.style.background  = _showDischargedInSession ? '#fef2f2' : '#fff';
      existBtn.style.color       = _showDischargedInSession ? '#dc2626' : '#64748b';
      existBtn.style.borderColor = _showDischargedInSession ? '#dc2626' : '#cbd5e1';
    }
  }
  // assessType 변경 시 직접입력 토글
  var at = document.getElementById('assessType');
  if (at && !at._bound) {
    at._bound = true;
    at.addEventListener('change', function() {
      document.getElementById('assessCustomNameWrap').style.display = this.value === '직접입력' ? 'block' : 'none';
    });
  }
  // iepChild 변경 시 히스토리 갱신
  var ic = document.getElementById('iepChild');
  if (ic && !ic._iepBound) {
    ic._iepBound = true;
    ic.addEventListener('change', function() {
      var id = parseInt(this.value) || 0;
      renderIEPHistory(id);
    });
  }
  // 검색 셀렉트 적용
  ['sessionChild','chartChild','reportChild','portfolioChild','faqChild',
   'assessChild','eduChild','iepChild'].forEach(function(id) {
    makeSearchable(id);
  });
  // assessChild는 별도 wrap에 이동
  var acWrap = document.getElementById('assessChildWrap');
  var acSel  = document.getElementById('assessChild');
  if (acWrap && acSel && acSel._ssWrap && acSel._ssWrap.parentNode !== acWrap) {
    acWrap.appendChild(acSel._ssWrap);
  }
}
