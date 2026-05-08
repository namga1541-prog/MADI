// ─────── 감각통합(감통) 평가 보고서 ───────

// 검사 선택 목록 (한글명 추가)
var SI_TESTS = [
  { key: 'DDST',  label: '덴버 발달 선별검사 (DDST)' },
  { key: 'K-DST', label: '한국형 영유아 발달 선별검사 (K-DST)' },
  { key: 'SP2',   label: '감각프로파일2 (SP2)' },
  { key: 'SSP2',  label: '단축 감각프로파일2 (SSP2)' },
  { key: 'SIPT',  label: '감각통합 및 실행기능 검사 (SIPT)' },
  { key: 'SPM',   label: '감각처리 척도 (SPM)' },
  { key: 'BOT2',  label: '브루인크스-오세레츠키 운동능력검사 2판 (BOT-2)' },
  { key: 'VMI',   label: '비어리-부크테니카 시각-운동 통합검사 (VMI)' },
  { key: 'COPM',  label: '캐나다 작업수행 측정 (COPM)' },
  { key: 'OTHER', label: '기타' }
];

// DDST / K-DST 발달 영역
var SI_DOMAINS = [
  { key: 'personal',  label: '개인-사회성 발달' },
  { key: 'language',  label: '언어 발달' },
  { key: 'gross',     label: '대근육 운동 발달' },
  { key: 'fine',      label: '소근육 운동 발달' }
];

// SP2 감각 섹션 (6개) + 행동 섹션 (5개)
var SP2_DOMAINS = [
  // 감각 섹션
  { key: 'auditory',    label: '청각 처리',        section: '감각 섹션' },
  { key: 'visual',      label: '시각 처리',         section: '감각 섹션' },
  { key: 'vestibular',  label: '전정 처리',         section: '감각 섹션' },
  { key: 'touch',       label: '촉각 처리',         section: '감각 섹션' },
  { key: 'multisensory',label: '다감각 처리',       section: '감각 섹션' },
  { key: 'oral',        label: '구강 감각 처리',    section: '감각 섹션' },
  // 행동 섹션
  { key: 'posture',     label: '자세 및 움직임 처리',              section: '행동 섹션' },
  { key: 'activity',    label: '활동 수준에 영향을 미치는 움직임 조절', section: '행동 섹션' },
  { key: 'emotional',   label: '정서 반응에 영향을 미치는 감각 조절', section: '행동 섹션' },
  { key: 'social',      label: '정서·사회적 반응',                  section: '행동 섹션' },
  { key: 'behavior',    label: '감각처리 행동 결과',                section: '행동 섹션' }
];

// SP2 감각 패턴 (5가지)
var SP2_PATTERNS = [
  { key: 'seeking',      label: '추구 / 추구자 (Seeking/Seeker)',      desc: '감각 자극을 적극적으로 찾고 추구함' },
  { key: 'avoiding',     label: '회피 / 회피자 (Avoiding/Avoider)',     desc: '감각 자극을 적극적으로 회피함' },
  { key: 'sensitivity',  label: '민감 / 감지자 (Sensitivity/Sensor)',   desc: '감각 자극에 민감하게 반응함' },
  { key: 'registration', label: '등록 / 방관자 (Registration/Bystander)', desc: '감각 자극을 잘 인식하지 못함' },
  { key: 'typical',      label: '일반 처리 (Typical Sensory Processing)', desc: '모든 패턴이 일반 범주 내에 속함' }
];

// SP2 해석 레벨
var SP2_LEVELS = ['일반적인 범주 내', '차이를 보임', '유의한 차이를 보임'];

function renderSIReport() {
  var el = document.getElementById('siReportPanel');
  if (!el) return;

  var childId = parseInt(document.getElementById('siChild') && document.getElementById('siChild').value) || 0;
  var child   = childId ? childDB.find(function(c){ return c.id === childId; }) : null;

  // 검사 체크박스 HTML
  var testsHtml = SI_TESTS.map(function(t) {
    return '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:4px 0;">'
      + '<input type="checkbox" class="si-test-chk" value="' + t.key + '" style="width:15px;height:15px;accent-color:var(--teal,#0ea5a0);"> '
      + t.label + '</label>';
  }).join('');

  // DDST/K-DST 영역별 결과 입력
  var domainRows = SI_DOMAINS.map(function(d) {
    return '<tr>'
      + '<td style="padding:8px;font-size:13px;font-weight:600;">' + d.label + '</td>'
      + '<td style="padding:4px 8px;"><input class="form-input" id="si_' + d.key + '_result" placeholder="예: 주의2개/지연3개" style="font-size:12px;padding:6px 8px;"></td>'
      + '<td style="padding:4px 8px;">'
      + '<select class="form-input" id="si_' + d.key + '_level" style="font-size:12px;padding:6px 8px;">'
      + '<option value="">발달 수준 선택</option>'
      + '<option>정상 발달</option><option>의심스러운 발달</option><option>비정상 발달</option>'
      + '</select></td>'
      + '<td style="padding:4px 8px;"><input class="form-input" id="si_' + d.key + '_note" placeholder="특이 수행 항목" style="font-size:12px;padding:6px 8px;"></td>'
      + '</tr>';
  }).join('');

  // SP2 감각 처리 영역별 결과 입력 (섹션 구분)
  var sp2Rows = '';
  var lastSection = '';
  SP2_DOMAINS.forEach(function(d, i) {
    if (d.section !== lastSection) {
      lastSection = d.section;
      sp2Rows += '<tr><td colspan="3" style="padding:6px 10px;background:#e0f2fe;font-size:11px;font-weight:700;color:#0369a1;">'
        + (d.section === '감각 섹션' ? '📡 감각 처리 섹션 (Sensory Processing Sections)' : '🧠 행동 섹션 (Behavioral Sections)')
        + '</td></tr>';
    }
    sp2Rows += '<tr>'
      + '<td style="padding:8px;font-size:13px;font-weight:600;">' + d.label + '</td>'
      + '<td style="padding:4px 8px;">'
      + '<select class="form-input" id="si_sp2_' + i + '_level" style="font-size:12px;padding:6px 8px;">'
      + '<option value="">해석 선택</option>'
      + SP2_LEVELS.map(function(l){ return '<option>' + l + '</option>'; }).join('')
      + '</select></td>'
      + '<td style="padding:4px 8px;"><input class="form-input" id="si_sp2_' + i + '_note" placeholder="특이 사항" style="font-size:12px;padding:6px 8px;"></td>'
      + '</tr>';
  });

  // SP2 감각 패턴 (4가지)
  var patternRows = SP2_PATTERNS.map(function(p) {
    return '<tr>'
      + '<td style="padding:8px;font-size:13px;font-weight:600;">' + p.label + '<br>'
      + '<span style="font-size:10px;color:var(--text2);font-weight:400;">' + p.desc + '</span></td>'
      + '<td style="padding:4px 8px;">'
      + '<select class="form-input" id="si_pat_' + p.key + '_level" style="font-size:12px;padding:6px 8px;">'
      + '<option value="">수준 선택</option>'
      + SP2_LEVELS.map(function(l){ return '<option>' + l + '</option>'; }).join('')
      + '</select></td>'
      + '<td style="padding:4px 8px;"><input class="form-input" id="si_pat_' + p.key + '_note" placeholder="행동 특성" style="font-size:12px;padding:6px 8px;"></td>'
      + '</tr>';
  }).join('');

  el.innerHTML = '<div class="card" style="margin-bottom:12px;">'
    + '<div class="card-title"><div class="card-title-left">🧠 감각통합 평가 보고서 작성</div>'
    + '<span style="font-size:11px;color:var(--text2);">AI 보고서 자동 생성</span></div>'

    // 1. 기본 정보
    + '<div style="background:var(--bg2,#f8fafc);border-radius:10px;padding:14px;margin-bottom:14px;">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;">📋 기본 정보</div>'
    + '<div class="form-row" style="gap:10px;">'
    + '<div class="form-group" style="flex:1;">'
    + '<label class="form-label">아동 선택</label>'
    + '<div id="siChildWrap" style="flex:1;"></div></div>'
    + '<div class="form-group" style="flex:0 0 130px;">'
    + '<label class="form-label">평가일</label>'
    + '<input type="date" class="form-input" id="siDate" value="' + new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'-').replace('.','') + '">'
    + '</div>'
    + '<div class="form-group" style="flex:0 0 120px;">'
    + '<label class="form-label">정보제공자</label>'
    + '<input type="text" class="form-input" id="siInformant" placeholder="예: 아동의 모" value="아동의 모">'
    + '</div></div></div>'

    // 2. 배경 정보
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">I. 배경 정보</label>'
    + '<textarea class="form-input" id="siBg" rows="4" placeholder="아동의 발달력, 주호소, 내원 사유 등을 입력하세요." style="resize:vertical;"></textarea>'
    + '</div>'

    // 3. 검사 태도
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">II. 검사 태도</label>'
    + '<textarea class="form-input" id="siAttitude" rows="4" placeholder="평가 시 아동의 행동, 협조도, 특이 관찰 사항 등을 입력하세요." style="resize:vertical;"></textarea>'
    + '</div>'

    // 4. 실시한 검사
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">III. 실시한 검사</label>'
    + '<div style="display:flex;flex-wrap:wrap;gap:4px 16px;padding:10px;background:var(--bg2,#f8fafc);border-radius:8px;">'
    + testsHtml + '</div></div>'

    // 5. 검사 결과 — DDST/K-DST
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">IV-A. 발달 검사 결과 (DDST / K-DST)</label>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:var(--mint2,#f0fdfa);">'
    + '<th style="padding:8px;text-align:left;white-space:nowrap;">영역</th>'
    + '<th style="padding:8px;text-align:left;">결과 (주의/지연 개수)</th>'
    + '<th style="padding:8px;text-align:left;">발달 수준</th>'
    + '<th style="padding:8px;text-align:left;">특이 수행 항목</th>'
    + '</tr></thead><tbody>' + domainRows + '</tbody></table></div></div>'

    // 5b. 검사 결과 — SP2 영역별
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">IV-B. 감각프로파일2 (SP2) — 영역별 결과</label>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:var(--mint2,#f0fdfa);">'
    + '<th style="padding:8px;text-align:left;white-space:nowrap;">영역</th>'
    + '<th style="padding:8px;text-align:left;">해석</th>'
    + '<th style="padding:8px;text-align:left;">특이 사항</th>'
    + '</tr></thead><tbody>' + sp2Rows + '</tbody></table></div></div>'

    // 5c. SP2 감각 패턴 (4사분면)
    + '<div class="form-group" style="margin-bottom:14px;">'
    + '<label class="form-label">IV-C. 감각프로파일2 (SP2) — 감각 처리 패턴</label>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:#fef3c7;">'
    + '<th style="padding:8px;text-align:left;white-space:nowrap;color:#92400e;">감각 패턴</th>'
    + '<th style="padding:8px;text-align:left;color:#92400e;">수준</th>'
    + '<th style="padding:8px;text-align:left;color:#92400e;">행동 특성</th>'
    + '</tr></thead><tbody>' + patternRows + '</tbody></table></div></div>'

    // 6. 추가 의견
    + '<div class="form-group" style="margin-bottom:16px;">'
    + '<label class="form-label">추가 의견 (선택)</label>'
    + '<textarea class="form-input" id="siExtra" rows="2" placeholder="치료사가 직접 추가할 내용 (선택 사항)" style="resize:vertical;"></textarea>'
    + '</div>'

    // 7. AI 생성 버튼
    + '<button id="siReportBtn" class="btn btn-primary" onclick="generateSIReport()" '
    + 'style="width:100%;background:var(--teal,#0ea5a0);border-color:var(--teal,#0ea5a0);">'
    + '🤖 AI 감통 보고서 생성 (종합 소견 + 권고사항)</button>'

    // 8. 결과 출력
    + '<div id="siReportResult" style="margin-top:14px;"></div>'
    + '</div>';

  // 아동 선택 드롭다운 렌더링
  if (typeof populateChildSelects === 'function') {
    var wrap = document.getElementById('siChildWrap');
    if (wrap) {
      wrap.innerHTML = '<select class="form-input" id="siChild" onchange="onSIChildChange()"><option value="">아동 선택...</option>'
        + childDB.map(function(c){ return '<option value="' + c.id + '">' + escHtml(c.name) + ' (' + escHtml(c.birth||'') + ' / ' + escHtml(c.age||'') + ')</option>'; }).join('')
        + '</select>';
      if (typeof makeSearchable === 'function') makeSearchable('siChild');
    }
  }
}

function onSIChildChange() {}

function collectSIData() {
  var childId = parseInt(document.getElementById('siChild') && document.getElementById('siChild').value) || 0;
  var child   = childId ? childDB.find(function(c){ return c.id === childId; }) : null;

  // 선택된 검사 수집
  var tests = [];
  document.querySelectorAll('.si-test-chk:checked').forEach(function(el) {
    var t = SI_TESTS.find(function(x){ return x.key === el.value; });
    if (t) tests.push(t.label);
  });

  // DDST/K-DST 영역별 결과
  var domainResults = SI_DOMAINS.map(function(d) {
    return {
      domain: d.label,
      result: (document.getElementById('si_' + d.key + '_result') || {}).value || '',
      level:  (document.getElementById('si_' + d.key + '_level') || {}).value || '',
      note:   (document.getElementById('si_' + d.key + '_note') || {}).value || ''
    };
  }).filter(function(r){ return r.result || r.level || r.note; });

  // SP2 영역별 결과
  var sp2Results = SP2_DOMAINS.map(function(d, i) {
    return {
      section: d.section,
      domain: d.label,
      level:  (document.getElementById('si_sp2_' + i + '_level') || {}).value || '',
      note:   (document.getElementById('si_sp2_' + i + '_note') || {}).value || ''
    };
  }).filter(function(r){ return r.level || r.note; });

  // SP2 감각 패턴
  var sp2Patterns = SP2_PATTERNS.map(function(p) {
    return {
      label: p.label,
      level: (document.getElementById('si_pat_' + p.key + '_level') || {}).value || '',
      note:  (document.getElementById('si_pat_' + p.key + '_note') || {}).value || ''
    };
  }).filter(function(r){ return r.level || r.note; });

  return {
    child:     child,
    date:      (document.getElementById('siDate') || {}).value || '',
    informant: (document.getElementById('siInformant') || {}).value || '',
    bg:        (document.getElementById('siBg') || {}).value || '',
    attitude:  (document.getElementById('siAttitude') || {}).value || '',
    tests:     tests,
    domains:   domainResults,
    sp2:       sp2Results,
    sp2Patterns: sp2Patterns,
    extra:     (document.getElementById('siExtra') || {}).value || ''
  };
}

function generateSIReport() {
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;

  var d = collectSIData();
  if (!d.child)     { showToast('아동을 선택해주세요.'); return; }
  if (!d.bg)        { showToast('배경 정보를 입력해주세요.'); return; }
  if (!d.attitude)  { showToast('검사 태도를 입력해주세요.'); return; }
  if (d.tests.length === 0) { showToast('실시한 검사를 1개 이상 선택해주세요.'); return; }

  var btn    = document.getElementById('siReportBtn');
  var result = document.getElementById('siReportResult');
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ AI 보고서 작성 중...';
  result.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);">AI가 보고서를 작성하고 있습니다...</div>';

  var NL = '\n';
  var domainText = d.domains.length > 0
    ? d.domains.map(function(r){
        return '· ' + r.domain + ': ' + (r.result||'-') + ' / ' + (r.level||'-') + (r.note ? ' / 특이항목: ' + r.note : '');
      }).join(NL)
    : '입력 없음';

  var sp2Text = d.sp2.length > 0
    ? d.sp2.map(function(r){
        return '· [' + r.section + '] ' + r.domain + ': ' + (r.level||'-') + (r.note ? ' (' + r.note + ')' : '');
      }).join(NL)
    : '입력 없음';

  var patternText = d.sp2Patterns && d.sp2Patterns.length > 0
    ? d.sp2Patterns.map(function(r){
        return '· ' + r.label + ': ' + (r.level||'-') + (r.note ? ' — ' + r.note : '');
      }).join(NL)
    : '입력 없음';

  var SYSTEM = '당신은 감각통합 분야 전문 작업치료사입니다. 평가 결과를 바탕으로 전문적이고 임상적으로 타당한 보고서 종합 소견과 치료 권고사항을 작성합니다. 한국어로 작성하며, 아동의 강점과 어려움을 균형 있게 기술합니다.';

  var USER = '[아동 정보]' + NL
    + '이름: ' + d.child.name + ' / 성별: ' + (d.child.gender||'-') + ' / 생년월일: ' + (d.child.birth||'-') + ' / 생활연령: ' + (d.child.age||'-') + NL
    + '평가일: ' + d.date + ' / 정보제공자: ' + d.informant + NL + NL
    + '[I. 배경 정보]' + NL + d.bg + NL + NL
    + '[II. 검사 태도]' + NL + d.attitude + NL + NL
    + '[III. 실시한 검사]' + NL + d.tests.map(function(t){ return '· ' + t; }).join(NL) + NL + NL
    + '[IV-A. 발달 검사 결과 (DDST/K-DST)]' + NL + domainText + NL + NL
    + '[IV-B. SP2 감각 처리 영역별 결과]' + NL + sp2Text + NL + NL
    + '[IV-C. SP2 감각 처리 패턴]' + NL + patternText
    + (d.extra ? NL + NL + '[추가 의견]' + NL + d.extra : '') + NL + NL
    + '위 정보를 바탕으로 다음 두 섹션을 전문적으로 작성해주세요:' + NL
    + 'V. 종합 소견: 주요 발달 특성, 감각 처리 패턴, 기능적 영향을 3~5문단으로 서술' + NL
    + 'VI. 치료 권고사항: 감각통합치료 목표, 접근법, 가정 연계 지도 등을 구체적으로 서술';

  callClaude(apiKey, SYSTEM, USER, 2000, getAIModel())
    .then(function(raw) {
      var text = raw.trim();
      result.innerHTML = '<div style="border:1.5px solid var(--mint,#0ea5a0);border-radius:12px;padding:16px;margin-top:4px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
        + '<span style="font-weight:700;font-size:14px;color:var(--mint,#0ea5a0);">🤖 AI 생성 보고서</span>'
        + '<button onclick="copySIReport()" class="btn-ghost" style="font-size:11px;padding:5px 12px;">📋 복사</button>'
        + '</div>'
        + '<div id="siReportText" style="white-space:pre-wrap;font-size:13px;line-height:1.8;color:var(--text);">' + escHtml(text) + '</div>'
        + '</div>';
      showToast('✅ 감통 보고서 생성 완료!');
    })
    .catch(function(e) {
      result.innerHTML = '<div style="color:#ef4444;padding:10px;">❌ 오류: ' + escHtml(e.message||'알 수 없는 오류') + '</div>';
    })
    .finally(function() {
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '🤖 AI 감통 보고서 생성 (종합 소견 + 권고사항)';
    });
}

function copySIReport() {
  var el = document.getElementById('siReportText');
  if (!el) return;
  var text = el.textContent || el.innerText;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function(){ showToast('📋 클립보드에 복사됐습니다!'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('📋 클립보드에 복사됐습니다!');
  }
}
