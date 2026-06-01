// ─────── 감각통합(감통) 평가 보고서 ───────

// 검사 선택 목록 (한글명 추가)
var SI_TESTS = [
  { key: 'DDST',  label: '덴버 발달 선별검사 (DDST)' },
  { key: 'K-DST', label: '한국 영유아 발달선별검사 (K-DST)' },
  { key: 'SP2',   label: '감각프로파일2 (SP2)' },
  { key: 'SSP2',  label: '단축 감각프로파일2 (SSP2)' },
  { key: 'SIPT',  label: '감각통합 및 실행기능 검사 (SIPT)' },
  { key: 'SPM',   label: '감각처리 척도 (SPM)' },
  { key: 'BOT2',  label: '브루인크스-오세레츠키 운동능력검사 2판 (BOT-2)' },
  { key: 'VMI',   label: '비어리-부크테니카 시각-운동 통합검사 (VMI)' },
  { key: 'COPM',  label: '캐나다 작업수행 측정 (COPM)' },
  { key: 'OTHER', label: '기타' }
];

// DDST 발달 영역 (덴버 발달 선별검사)
var DDST_DOMAINS = [
  { key: 'personal',  label: '개인-사회성 발달' },
  { key: 'finemotor', label: '미세운동-적응 발달' },
  { key: 'language',  label: '언어 발달' },
  { key: 'gross',     label: '대근육 운동 발달' }
];

// K-DST 발달 영역 (한국 영유아 발달선별검사)
var KDST_DOMAINS = [
  { key: 'gross',     label: '대근육 운동' },
  { key: 'fine',      label: '소근육 운동' },
  { key: 'cognition', label: '인지' },
  { key: 'language',  label: '언어' },
  { key: 'social',    label: '사회성' },
  { key: 'selfcare',  label: '자조' }
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

// SP2 해석 레벨 (5단계)
var SP2_LEVELS = ['또래보다 매우 적음', '또래보다 적음', '또래와 유사', '또래보다 많음', '또래보다 매우 많음'];

function renderSIReport() {
  var el = document.getElementById('siReportPanel');
  if (!el) return;
  if (!childDB || !childDB.length) return;

  // 검사 체크박스 HTML
  var testsHtml = SI_TESTS.map(function(t) {
    return '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:4px 0;">'
      + '<input type="checkbox" class="si-test-chk" value="' + t.key + '" style="width:15px;height:15px;accent-color:var(--teal,#0ea5a0);"> '
      + t.label + '</label>';
  }).join('');

  // DDST 영역별 결과 입력
  function makeDevRows(domains, prefix) {
    // K-DST는 한국 영유아 발달선별검사 공식 판정 기준 3단계 사용
    var isKdst = (prefix === 'kdst');
    var levelOpts = isKdst
      ? '<option>또래수준</option><option>추적검사요망</option><option>심화평가권고</option>'
      : '<option>정상 발달</option><option>의심스러운 발달</option><option>비정상 발달</option>';
    return domains.map(function(d) {
      // K-DST는 select에 좌측 border 색상 + 우측 점 인디케이터 (위험도 시각화)
      var selectId = 'si_' + prefix + '_' + d.key + '_level';
      var dotId    = 'si_' + prefix + '_' + d.key + '_dot';
      var levelCell;
      if (isKdst) {
        levelCell = '<td style="padding:4px 8px;">'
          + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<select class="form-input kdst-level-select" id="' + selectId + '" '
          +   'onchange="updateKdstLevelColor(this)" '
          +   'style="font-size:12px;padding:6px 8px;border-left:4px solid #cbd5e1;flex:1;">'
          + '<option value="">발달 수준 선택</option>'
          + levelOpts
          + '</select>'
          + '<span id="' + dotId + '" class="kdst-level-dot" '
          +   'style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#cbd5e1;flex-shrink:0;" '
          +   'title="발달 수준 위험도"></span>'
          + '</div></td>';
      } else {
        levelCell = '<td style="padding:4px 8px;">'
          + '<select class="form-input" id="' + selectId + '" style="font-size:12px;padding:6px 8px;">'
          + '<option value="">발달 수준 선택</option>'
          + levelOpts
          + '</select></td>';
      }
      return '<tr>'
        + '<td style="padding:8px;font-size:13px;font-weight:600;">' + d.label + '</td>'
        + '<td style="padding:4px 8px;"><input class="form-input" id="si_' + prefix + '_' + d.key + '_result" placeholder="예: 주의2개/지연3개" style="font-size:12px;padding:6px 8px;"></td>'
        + levelCell
        + '<td style="padding:4px 8px;"><input class="form-input" id="si_' + prefix + '_' + d.key + '_note" placeholder="특이 수행 항목" style="font-size:12px;padding:6px 8px;"></td>'
        + '</tr>';
    }).join('');
  }
  var ddstRows = makeDevRows(DDST_DOMAINS, 'ddst');
  var kdstRows = makeDevRows(KDST_DOMAINS, 'kdst');

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

  // eslint-disable-next-line no-unsanitized/property
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
    + '<input type="date" class="form-input" id="siDate" value="' + new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'-').replace(/\./g,'') + '">'
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
    + testsHtml + '</div>'
    // 수기 입력 영역 (✏️ 직접 입력)
    + '<div style="margin-top:8px;padding:10px;background:#fef9c3;border:1px dashed #ca8a04;border-radius:8px;">'
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'
    + '<span style="font-size:13px;font-weight:600;color:#854d0e;white-space:nowrap;">✏️ 직접 입력</span>'
    + '<input type="text" id="siCustomTestInput" class="form-input" placeholder="검사명을 직접 입력하세요 (예: WPPSI-IV)" style="flex:1;min-width:160px;font-size:13px;padding:6px 8px;" onkeydown="if(event.key===&quot;Enter&quot;){event.preventDefault();addCustomSITest();}">'
    + '<button type="button" class="btn btn-sm" onclick="addCustomSITest()" style="background:#ca8a04;color:#fff;font-size:13px;padding:6px 12px;white-space:nowrap;">＋ 추가</button>'
    + '</div>'
    + '<div id="siCustomTestList" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>'
    + '</div>'
    + '</div>'

    // 5. 검사 결과 — DDST
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">IV-A. 덴버 발달 선별검사 (DDST) 결과</label>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:var(--mint2,#f0fdfa);">'
    + '<th style="padding:8px;text-align:left;white-space:nowrap;">영역</th>'
    + '<th style="padding:8px;text-align:left;">결과 (주의/지연 개수)</th>'
    + '<th style="padding:8px;text-align:left;">발달 수준</th>'
    + '<th style="padding:8px;text-align:left;">특이 수행 항목</th>'
    + '</tr></thead><tbody>' + ddstRows + '</tbody></table></div></div>'

    // 5b. 검사 결과 — K-DST
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">IV-B. 한국 영유아 발달선별검사 (K-DST) 결과</label>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:#ede9fe;">'
    + '<th style="padding:8px;text-align:left;white-space:nowrap;color:#5b21b6;">영역</th>'
    + '<th style="padding:8px;text-align:left;color:#5b21b6;">결과 (주의/지연 개수)</th>'
    + '<th style="padding:8px;text-align:left;color:#5b21b6;">발달 수준</th>'
    + '<th style="padding:8px;text-align:left;color:#5b21b6;">특이 수행 항목</th>'
    + '</tr></thead><tbody>' + kdstRows + '</tbody></table></div></div>'

    // 5c. 검사 결과 — SP2 영역별
    + '<div class="form-group" style="margin-bottom:12px;">'
    + '<label class="form-label">IV-C. 감각프로파일2 (SP2) — 영역별 결과</label>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:var(--mint2,#f0fdfa);">'
    + '<th style="padding:8px;text-align:left;white-space:nowrap;">영역</th>'
    + '<th style="padding:8px;text-align:left;">해석</th>'
    + '<th style="padding:8px;text-align:left;">특이 사항</th>'
    + '</tr></thead><tbody>' + sp2Rows + '</tbody></table></div></div>'

    // 5d. SP2 감각 패턴
    + '<div class="form-group" style="margin-bottom:14px;">'
    + '<label class="form-label">IV-D. 감각프로파일2 (SP2) — 감각 처리 패턴</label>'
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
      // eslint-disable-next-line no-unsanitized/property
      wrap.innerHTML = '<select class="form-input" id="siChild" onchange="onSIChildChange()"><option value="">아동 선택...</option>'
        + (Array.isArray(childDB) ? childDB : []).map(function(c){ return '<option value="' + escHtml(String(c.id)) + '">' + escHtml(c.name) + ' (' + escHtml(c.birth||'') + ' / ' + escHtml(c.age||'') + ')</option>'; }).join('')
        + '</select>';
      if (typeof makeSearchable === 'function') makeSearchable('siChild');
    }
  }
}

function onSIChildChange() {}

function collectSIData() {
  if (!childDB) return null;
  var childId = String((document.getElementById('siChild') && document.getElementById('siChild').value) || '');
  var child   = childId ? childDB.find(function(c){ return c.id === childId; }) : null;

  // 선택된 검사 수집
  var tests = [];
  document.querySelectorAll('.si-test-chk:checked').forEach(function(el) {
    var t = SI_TESTS.find(function(x){ return x.key === el.value; });
    if (t) tests.push(t.label);
  });
  // 사용자 정의 검사 (✏️ 직접 입력으로 추가된 항목)
  document.querySelectorAll('#siCustomTestList .si-custom-test').forEach(function(el) {
    var name = el.dataset.name || '';
    if (name) tests.push(name);
  });

  // DDST 영역별 결과
  var ddstResults = DDST_DOMAINS.map(function(d) {
    return {
      domain: d.label,
      result: (document.getElementById('si_ddst_' + d.key + '_result') || {}).value || '',
      level:  (document.getElementById('si_ddst_' + d.key + '_level') || {}).value || '',
      note:   (document.getElementById('si_ddst_' + d.key + '_note')   || {}).value || ''
    };
  }).filter(function(r){ return r.result || r.level || r.note; });

  // K-DST 영역별 결과
  var kdstResults = KDST_DOMAINS.map(function(d) {
    return {
      domain: d.label,
      result: (document.getElementById('si_kdst_' + d.key + '_result') || {}).value || '',
      level:  (document.getElementById('si_kdst_' + d.key + '_level') || {}).value || '',
      note:   (document.getElementById('si_kdst_' + d.key + '_note')   || {}).value || ''
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
    ddst:      ddstResults,
    kdst:      kdstResults,
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
  if (!d) { showToast('⚠️ 아동 정보를 찾을 수 없습니다'); return; }
  if (!d.child)     { showToast('아동을 선택해주세요.'); return; }
  if (!d.bg)        { showToast('배경 정보를 입력해주세요.'); return; }
  if (!d.attitude)  { showToast('검사 태도를 입력해주세요.'); return; }
  if (d.tests.length === 0) { showToast('실시한 검사를 1개 이상 선택해주세요.'); return; }

  var MAX_FIELD = 1000;
  if ((d.bg||'').length > MAX_FIELD || (d.attitude||'').length > MAX_FIELD || (d.extra||'').length > MAX_FIELD) {
    showToast('⚠️ 각 입력 항목은 1000자 이내로 작성해 주세요.');
    return;
  }

  var btn    = document.getElementById('siReportBtn');
  var result = document.getElementById('siReportResult');
  if (!btn || !result) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ AI 보고서 작성 중...';
  result.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);">AI가 보고서를 작성하고 있습니다...</div>';

  var NL = '\n';
  function fmtDevRow(r) {
    return '· ' + r.domain + ': ' + (r.result||'-') + ' / ' + (r.level||'-') + (r.note ? ' / 특이항목: ' + r.note : '');
  }
  var ddstText  = d.ddst && d.ddst.length > 0  ? d.ddst.map(fmtDevRow).join(NL)  : '입력 없음';
  var kdstText  = d.kdst && d.kdst.length > 0  ? d.kdst.map(fmtDevRow).join(NL)  : '입력 없음';

  var _sp2Arr = Array.isArray(d.sp2) ? d.sp2 : [];
  var sp2Text = _sp2Arr.length > 0
    ? _sp2Arr.map(function(r){
        return '· [' + r.section + '] ' + r.domain + ': ' + (r.level||'-') + (r.note ? ' (' + r.note + ')' : '');
      }).join(NL)
    : '입력 없음';

  var patternText = d.sp2Patterns && d.sp2Patterns.length > 0
    ? d.sp2Patterns.map(function(r){
        return '· ' + r.label + ': ' + (r.level||'-') + (r.note ? ' — ' + r.note : '');
      }).join(NL)
    : '입력 없음';

  var _clinicalGuide = (typeof SLP_PROMPT_CLINICAL_GUIDE !== 'undefined') ? SLP_PROMPT_CLINICAL_GUIDE : '';
  var _styleGuide = (typeof getReportStyleGuide === 'function') ? getReportStyleGuide('si') : '';
  var SYSTEM = '당신은 한국 임상 현장의 감각통합 분야 전문 작업치료사입니다. 평가 결과를 바탕으로 전문적이고 임상적으로 타당한 보고서 종합 소견과 치료 권고사항을 작성합니다. 한국어로 작성하며, 아동의 강점과 어려움을 균형 있게 기술합니다.\n\n'
    + _clinicalGuide
    + (_styleGuide ? '\n\n' + _styleGuide : '');

  var USER = '[아동 정보]' + NL
    + '이름: ' + d.child.name + ' / 성별: ' + (d.child.gender||'-') + ' / 생년월일: ' + (d.child.birth||'-') + ' / 생활연령: ' + (d.child.age||'-') + NL
    + '평가일: ' + d.date + ' / 정보제공자: ' + d.informant + NL + NL
    + '[I. 배경 정보]' + NL + d.bg + NL + NL
    + '[II. 검사 태도]' + NL + d.attitude + NL + NL
    + '[III. 실시한 검사]' + NL + (Array.isArray(d.tests) ? d.tests : []).map(function(t){ return '· ' + t; }).join(NL) + NL + NL
    + '[IV-A. DDST 발달 검사 결과]' + NL + ddstText + NL + NL
    + '[IV-B. K-DST 발달 검사 결과]' + NL + kdstText + NL + NL
    + '[IV-C. SP2 감각 처리 영역별 결과]' + NL + sp2Text + NL + NL
    + '[IV-D. SP2 감각 처리 패턴]' + NL + patternText
    + (d.extra ? NL + NL + '[추가 의견]' + NL + d.extra : '') + NL + NL
    + '위 정보를 바탕으로 다음 두 섹션을 전문적으로 작성해주세요:' + NL
    + 'V. 종합 소견: 주요 발달 특성, 감각 처리 패턴, 기능적 영향을 3~5문단으로 서술' + NL
    + 'VI. 치료 권고사항: 감각통합치료 목표, 접근법, 가정 연계 지도 등을 구체적으로 서술';

  var aiModel = (typeof getAIModel === 'function') ? getAIModel() : 'claude-3-5-sonnet-20241022';
  callClaude(SYSTEM, USER, 2000, aiModel)
    .then(function(raw) {
      // 임상 보고서 — 비표준 용어만 통일
      if (typeof sanitizeSLPOutput === 'function') raw = sanitizeSLPOutput(raw, 'clinical');
      var text = raw.trim();
      /* eslint-disable-next-line no-unsanitized/property */
      result.innerHTML = '<div style="border:1.5px solid var(--mint,#0ea5a0);border-radius:12px;padding:16px;margin-top:4px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
        + '<span style="font-weight:700;font-size:14px;color:var(--mint,#0ea5a0);">🤖 AI 생성 보고서</span>'
        + '<button onclick="copySIReport()" class="btn-ghost" style="font-size:11px;padding:5px 12px;">📋 복사</button>'
        + '</div>'
        + '<div id="siReportText" style="white-space:pre-wrap;font-size:13px;line-height:1.8;color:var(--text);">' + escHtml(text) + '</div>'
        + '</div>';
      showToast('✅ 감통 보고서 생성 완료!');
      btn.dataset.busy = ''; btn.disabled = false;
      btn.textContent = '🤖 AI 감통 보고서 생성 (종합 소견 + 권고사항)';
    })
    .catch(function(e) {
      /* eslint-disable-next-line no-unsanitized/property */
      result.innerHTML = '<div style="color:#ef4444;padding:12px;border:1px solid #fca5a5;border-radius:10px;">'
        + '<div style="font-weight:700;margin-bottom:8px;">❌ 보고서 생성 실패</div>'
        + '<div style="font-size:12px;margin-bottom:10px;">' + escHtml(e.message||'알 수 없는 오류') + '</div>'
        + '<button onclick="generateSIReport()" class="btn" style="font-size:12px;padding:6px 14px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-weight:700;">🔄 다시 시도</button>'
        + '</div>';
      btn.dataset.busy = ''; btn.disabled = false;
      btn.textContent = '🤖 AI 감통 보고서 생성 (종합 소견 + 권고사항)';
    });
}

function copySIReport() {
  var el = document.getElementById('siReportText');
  if (!el) return;
  var text = el.textContent || el.innerText;
  if (!navigator.clipboard) {
    showToast('⚠️ 이 브라우저는 클립보드 복사를 지원하지 않습니다.');
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    showToast('📋 클립보드에 복사됐습니다!');
  }).catch(function() {
    showToast('⚠️ 복사에 실패했습니다.');
  });
}

// ─────── 감통보고서 — 사용자 정의 검사명 입력 ───────
// 추가/삭제 시 화면만 갱신하고 collectSIData() 수집 시 일괄 추출
function addCustomSITest() {
  var input = document.getElementById('siCustomTestInput');
  var list  = document.getElementById('siCustomTestList');
  if (!input || !list) return;
  var name = (input.value || '').trim();
  if (!name) { showToast('검사명을 입력해주세요.'); return; }
  if (name.length > 80) { showToast('검사명이 너무 깁니다(최대 80자).'); return; }

  // 중복 체크 (사용자 입력 + 기존 SI_TESTS 라벨 모두)
  var existsCustom = Array.prototype.some.call(
    list.querySelectorAll('.si-custom-test'),
    function(el){ return el.dataset.name === name; }
  );
  var existsBuiltin = (typeof SI_TESTS !== 'undefined') && SI_TESTS.some(function(t){ return t.label === name; });
  if (existsCustom || existsBuiltin) { showToast('이미 추가된 검사입니다.'); return; }

  // 안전한 DOM 생성 (innerHTML 인젝션 방지)
  var chip = document.createElement('span');
  chip.className = 'si-custom-test';
  chip.dataset.name = name;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid #ca8a04;color:#854d0e;border-radius:999px;padding:4px 4px 4px 10px;font-size:12px;font-weight:600;';
  var label = document.createElement('span');
  label.textContent = name;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '×';
  btn.title = '삭제';
  btn.style.cssText = 'border:none;background:#fef3c7;color:#854d0e;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;font-weight:700;';
  btn.onclick = function(){ removeCustomSITest(chip); };
  chip.appendChild(label);
  chip.appendChild(btn);
  list.appendChild(chip);

  input.value = '';
  input.focus();
}

function removeCustomSITest(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ─────── K-DST 발달수준 색상 시각화 ───────
// 또래수준(녹색) / 추적검사요망(주황) / 심화평가권고(빨강) — 위험도 한눈에 파악
function updateKdstLevelColor(selectEl) {
  if (!selectEl) return;
  var val = selectEl.value || '';
  // 색상 매핑 (좌측 border + 우측 점)
  var colorMap = {
    '또래수준':     '#16a34a', // 녹색 — 정상
    '추적검사요망': '#ca8a04', // 주황 — 주의·관찰 필요
    '심화평가권고': '#dc2626'  // 빨강 — 즉시 평가 필요
  };
  var color = colorMap[val] || '#cbd5e1'; // 미선택 시 회색
  selectEl.style.borderLeft = '4px solid ' + color;
  // 같은 행의 점 인디케이터 찾기 (id 규칙: ..._level → ..._dot)
  var dotId = (selectEl.id || '').replace(/_level$/, '_dot');
  var dot = document.getElementById(dotId);
  if (dot) dot.style.background = color;
}
