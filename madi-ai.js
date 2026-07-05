// 외부 AI 처리 고지(PIPA MED) — AI 생성 결과 패널에 1회 표시. 정적 문구라 escHtml 불필요.
var AI_PROCESSING_NOTICE = '<div style="font-size:11px;color:var(--text2,#888);line-height:1.5;margin:8px 0;">'
  + 'ℹ️ 이 기능은 개인정보를 가명화하여 외부 AI(미국 Anthropic)로 전송해 처리합니다. '
  + '자세한 내용은 개인정보처리방침을 참고하세요.</div>';

function generateReport() {
  if (!currentUser || currentUser.role === 'parent') { showToast('⚠️ 권한이 없습니다.'); return; }
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String(document.getElementById('reportChild').value || '');
  var period = document.getElementById('reportPeriod').value;
  if (!childId) { showToast('아동을 선택해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;
  var sessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  var periodNum = parseInt(period);
  var target = period === 'all' ? sessions : sessions.slice(-(isNaN(periodNum) || periodNum < 1 ? 10 : periodNum));
  if (target.length === 0) { showToast('세션 기록이 없습니다.'); return; }

  var btn = document.getElementById('reportBtn');
  var resultEl = document.getElementById('reportResult');
  if (!btn || !resultEl) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';
  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>부모 보고서를 생성 중입니다...</p></div>';

  var summary = target.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + (g.score !== null ? ' ' + g.score + '%' : ''); }).join(', ');
    return s.date + ': [' + g + '] ' + (s.memo || '');
  }).join('\n');

  var _parentGuide = (typeof SLP_PROMPT_PARENT_GUIDE !== 'undefined') ? SLP_PROMPT_PARENT_GUIDE : '';
  var SYSTEM = '당신은 한국 언어치료 임상 현장의 베테랑 언어재활사입니다. 부모님께 보낼 보고서를 두 형식으로 작성하세요. 순수 JSON만:'
    + ' {"kakao":"카카오톡 메시지 (이모지, 친근한 존댓말, 200자 내외)","report":"전문 보고서 (치료 경과, 목표 달성, 가정 지도, 존댓말, 400자 내외)"}\n\n'
    + _parentGuide + AI_NAME_RULE;
  // 개인정보 최소화(M2): 실명을 AI(미국 Anthropic)로 전송하지 않고 가명 ○○ 로 보낸 뒤, 응답에서 클라이언트가 실명 복원.
  var USER = '아동: ○○ (' + child.age + ', ' + child.type + ')\n목표: ' + ((child.goals || []).join(', ') || '없음') + '\n\n세션:\n' + summary;

  // ES5 호환: .finally() 미지원 환경(구버전 iOS Safari) 대응 — then/catch 양쪽에서 버튼 리셋
  function resetBtn() {
    btn.dataset.busy = '';
    btn.disabled = false;
    btn.textContent = 'AI 보고서 생성';
  }
  callClaude(SYSTEM, USER, 1500, getAIModel())
    .then(function(raw) {
      var p = parseJSON(raw);
      // 학부모용 — 한자어·비표준 용어 자동 치환
      if (typeof sanitizeSLPOutput === 'function') {
        if (p.kakao)  p.kakao  = sanitizeSLPOutput(p.kakao,  'parent');
        if (p.report) p.report = sanitizeSLPOutput(p.report, 'parent');
      }
      // 가명(○○) → 실명 복원 (실명은 전송하지 않고 클라이언트에서만 치환)
      p.kakao  = restoreName(p.kakao, child.name);
      p.report = restoreName(p.report, child.name);
      renderReport(p, child.name);
      resetBtn();
    })
    .catch(function(err) {
      if (window.console && console.warn) console.warn('[AI 보고서]', err && err.message);
      resultEl.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(_userErrMsg(err, 'AI 보고서 생성')) + '</p></div>';
      resetBtn();
    });
}

function renderReport(p, name) {
  var k = p.kakao || '', r = p.report || '';
  var html = AI_PROCESSING_NOTICE
    + '<div class="card">'
    + '<div class="card-title"><div class="card-title-left">💛 카카오톡 메시지</div></div>'
    + '<div class="kakao-box" id="kakaoText">' + escHtml(k) + '</div>'
    + '<button class="copy-btn" onclick="copyKakao()">📋 카카오톡 메시지 복사</button>'
    + '</div>'
    + '<div class="card">'
    + '<div class="card-title"><div class="card-title-left">📄 전문 보고서</div></div>'
    + '<div class="report-box" id="reportText">' + escHtml(r) + '</div>'
    + '<button class="pdf-btn" onclick="downloadPDF(\'' + jsArg(name) + '\',\'reportText\',\'언어치료 경과 보고서\')">⬇️ PDF 다운로드</button>'
    + '</div>';
  // eslint-disable-next-line no-unsanitized/property
  document.getElementById('reportResult').innerHTML = html;
}

function copyKakao() {
  var el = document.getElementById('kakaoText');
  if (!el) return;
  var text = el.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('📋 복사됨!'); }).catch(function() { showToast('⚠️ 클립보드 복사 실패. 직접 선택 후 복사해주세요'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('📋 복사됨!');
  }
}

function downloadPDF(name, sourceId, title) {
  var el = document.getElementById(sourceId);
  if (!el) return;
  var content = el.textContent || el.innerText || '';
  var today = new Date().toLocaleDateString('ko-KR');
  var win = window.open('', '_blank');
  if (!win) { showToast('⚠️ 팝업이 차단됐습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  // eslint-disable-next-line no-unsanitized/method
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<style>body{font-family:"Pretendard",sans-serif;padding:40px;color:#1e293b;line-height:1.8;}'
    + 'h2{color:#0f2942;margin-bottom:8px;}p{white-space:pre-wrap;font-size:14px;}'
    + '.footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;}'
    + '</style></head><body>'
    + '<h2>' + escHtml(title || '') + '</h2>'
    + '<p style="font-size:12px;color:#64748b;margin-bottom:24px;">대상 아동: ' + escHtml(name || '') + ' &nbsp;|&nbsp; 작성일: ' + today + '</p>'
    + '<p>' + escHtml(content) + '</p>'
    + '<div class="footer">마디아이(MadiAI) AI 보조 작성 보고서</div>'
    + '</body></html>');
  win.document.close();
  setTimeout(function() { win.print(); }, 500);
  showToast('📄 PDF 인쇄 창 열림');
}

// ─────── 마크다운 → HTML 변환 (보고서 표 렌더링용) ───────
function markdownToHtml(text) {
  var lines = text.split('\n');
  var html = '';
  var inTable = false;
  var tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    html += '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:13px;">';
    tableRows.forEach(function(row, ri) {
      html += '<tr>';
      row.forEach(function(cell) {
        var tag = ri === 0 ? 'th' : 'td';
        var style = 'border:1px solid #cbd5e1;padding:7px 10px;';
        if (ri === 0) style += 'background:#f0fdf4;font-weight:700;color:#0f2942;text-align:center;';
        html += '<' + tag + ' style="' + style + '">' + escHtml(cell.trim()) + '</' + tag + '>';
      });
      html += '</tr>';
    });
    html += '</table>';
    inTable = false;
    tableRows = [];
  }

  lines.forEach(function(line) {
    var trimmed = line.trim();
    // ** 볼드 인라인 변환 (PDF/Word 출력용)
    function inlineBold(str) {
      return escHtml(str).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
    }
    if (trimmed.startsWith('|')) {
      if (!inTable) inTable = true;
      if (/^\|[-:\s|]+\|$/.test(trimmed)) return; // 구분선 행 건너뜀
      var cells = trimmed.split('|').filter(function(_, i, a) { return i > 0 && i < a.length - 1; });
      tableRows.push(cells);
    } else {
      if (inTable) flushTable();
      if (trimmed === '') {
        html += '<div style="height:6px;"></div>';
      } else if (/^(I|II|III|IV|V|VI|VII)\./.test(trimmed)) {
        html += '<h2 style="font-size:15px;font-weight:700;color:#0f2942;margin:20px 0 8px;border-bottom:2px solid #0E6B5C;padding-bottom:5px;">' + inlineBold(trimmed) + '</h2>';
      } else if (/^\d+\./.test(trimmed) && trimmed.length < 60) {
        html += '<p style="font-weight:700;font-size:14px;margin:12px 0 4px;color:#1e293b;">' + inlineBold(trimmed) + '</p>';
      } else if (/^[가-힣]\./.test(trimmed)) {
        html += '<p style="font-weight:700;font-size:13px;margin:8px 0 4px;color:#0E6B5C;">' + inlineBold(trimmed) + '</p>';
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        html += '<p style="margin:3px 0;padding-left:14px;font-size:13px;line-height:1.8;">• ' + inlineBold(trimmed.slice(2)) + '</p>';
      } else {
        html += '<p style="margin:3px 0;font-size:13px;line-height:1.8;">' + inlineBold(line) + '</p>';
      }
    }
  });
  if (inTable) flushTable();
  return html;
}

// ─────── 전문 평가 보고서 PDF 출력 ───────
function downloadAssessPDF(name) {
  var el = document.getElementById('assessReportText');
  if (!el) return;
  var content  = el.textContent || el.innerText || '';
  var today    = new Date().toLocaleDateString('ko-KR');
  var assessDate   = (document.getElementById('assessDate')         || {}).value || today;
  var institution  = ((document.getElementById('reportInstitution') || {}).value || '').trim();
  var evaluator    = ((document.getElementById('reportEvaluator')   || {}).value || '').trim();

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + 'body{font-family:"Pretendard",sans-serif;padding:40px 50px;color:#1e293b;line-height:1.8;max-width:800px;margin:0 auto;}'
    + '.rpt-header{text-align:center;margin-bottom:28px;padding-bottom:14px;border-bottom:3px double #0f2942;}'
    + '.rpt-title{font-size:22px;font-weight:700;color:#0f2942;margin-bottom:10px;letter-spacing:2px;}'
    + '.rpt-meta{display:flex;justify-content:space-between;font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:8px;}'
    + 'h2{font-size:15px;font-weight:700;color:#0f2942;margin:20px 0 8px;border-bottom:2px solid #0E6B5C;padding-bottom:4px;}'
    + 'table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px;}'
    + 'th{background:#f0fdf4;font-weight:700;color:#0f2942;border:1px solid #cbd5e1;padding:7px 10px;text-align:center;}'
    + 'td{border:1px solid #e2e8f0;padding:7px 10px;}'
    + 'p{margin:3px 0;font-size:13px;line-height:1.8;}'
    + '.rpt-footer{margin-top:36px;text-align:right;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;}'
    + '@media print{body{padding:20px 30px;} .rpt-footer{position:fixed;bottom:16px;right:30px;}}'
    + '</style></head><body>'
    + '<div class="rpt-header">'
    + (institution ? '<div style="font-size:13px;color:#64748b;margin-bottom:5px;">' + escHtml(institution) + '</div>' : '')
    + '<div class="rpt-title">말 · 언어 평가보고서</div>'
    + '<div class="rpt-meta">'
    + '<span>이름: <strong>' + escHtml(name) + '</strong></span>'
    + '<span>평가일: <strong>' + escHtml(assessDate) + '</strong></span>'
    + (evaluator ? '<span>평가자: <strong>' + escHtml(evaluator) + '</strong></span>' : '<span>작성일: <strong>' + today + '</strong></span>')
    + '</div></div>'
    + markdownToHtml(content)
    + '<div class="rpt-footer">마디아이(MadiAI) AI 보조 작성 &nbsp;|&nbsp; 출력일: ' + today + '</div>'
    + '</body></html>';
  var blob = new Blob([html], { type: 'text/html' });
  var blobUrl = URL.createObjectURL(blob);
  var win = window.open(blobUrl, '_blank');
  if (!win) { URL.revokeObjectURL(blobUrl); showToast('⚠️ 팝업이 차단됐습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  win.onload = function() { win.print(); };
  setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
  showToast('📄 전문 보고서 PDF 출력 창 열림');
}

// ─────── 보고서 인라인 편집 토글 ───────
function toggleReportEdit() {
  var el  = document.getElementById('assessReportText');
  var btn = document.getElementById('editToggleBtn');
  if (!el || !btn) return;
  var editing = el.contentEditable === 'true';
  el.contentEditable = editing ? 'false' : 'true';
  btn.textContent    = editing ? '✏️ 내용 편집' : '✅ 편집 완료';
  el.style.border    = editing ? '' : '2px solid var(--mint)';
  el.style.background = editing ? '' : '#f0fdf4';
  if (!editing) {
    el.focus();
    showToast('✏️ 편집 모드 — 보고서 내용을 직접 수정하세요');
  } else {
    showToast('✅ 편집 완료 — PDF·HWP 저장에 반영됩니다');
  }
}

// ─────── 장단기계획(IEP) 자동 생성 ───────
function generateIEP() {
  if (!currentUser || currentUser.role === 'parent') { showToast('⚠️ 권한이 없습니다.'); return; }
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String(document.getElementById('iepChild').value || '');
  if (!childId) { showToast('아동을 선택해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;

  // 최근 6회 세션 수집
  var sessions = sessionDB
    .filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; })
    .slice(-6);

  // 해당 아동 검사 결과 수집
  var assessments = assessmentDB.filter(function(a) { return a.childId === childId; });

  if (sessions.length === 0 && assessments.length === 0) {
    showToast('⚠️ 세션 또는 검사 결과가 최소 1개 이상 필요합니다.');
    return;
  }

  var btn = document.getElementById('iepBtn');
  var iepResultEl = document.getElementById('iepResult');
  if (!btn || !iepResultEl) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 장단기계획(IEP) 생성 중...';
  iepResultEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px;">🤖 AI가 3개월 치료 계획을 작성 중입니다...</div>';

  // 목표별 달성률 추이 계산
  var goalTrend = {};
  sessions.forEach(function(s) {
    (s.goals || []).forEach(function(g) {
      if (!g.name || g.score === null || g.score === undefined) return;
      if (!goalTrend[g.name]) goalTrend[g.name] = [];
      goalTrend[g.name].push({ date: s.date, score: parseFloat(g.score) });
    });
  });
  var trendLog = Object.keys(goalTrend).map(function(name) {
    var scores = goalTrend[name];
    var avg = Math.round(scores.reduce(function(a,b){ return a+b.score; },0)/scores.length);
    var last = scores[scores.length-1].score;
    var first = scores[0].score;
    var trend = last > first ? '↑향상' : last < first ? '↓하락' : '→유지';
    var stagnant = scores.length >= 3 && scores.slice(-3).every(function(s){ return Math.abs(s.score-scores[scores.length-1].score)<=5; });
    return name + ': 평균' + avg + '% ' + trend + (stagnant ? ' [3회 이상 정체]' : '');
  }).join('\n');

  var sessionLog = sessions.map(function(s) {
    var g = (s.goals || []).map(function(g) {
      return g.name + (g.score !== null ? ':' + g.score + '%' : '');
    }).join(', ');
    return s.date + ' [' + g + ']' + (s.memo ? ' 메모:' + s.memo : '');
  }).join('\n');

  var assessLog = assessments.map(function(a) {
    var scoreStr = '';
    if (a.scores && typeof a.scores === 'object') {
      scoreStr = Object.keys(a.scores).map(function(k) { return k + ':' + a.scores[k]; }).join(', ');
    }
    return a.testName + ' (' + a.date + ')' + (scoreStr ? ' [' + scoreStr + ']' : '');
  }).join('\n');

  var NL = String.fromCharCode(10);
  var SYSTEM = '당신은 10년 이상 경력의 1급 언어재활사입니다. 제공된 아동 데이터를 근거로 3개월 IEP 초안을 작성하세요.'
    + NL + '【핵심 원칙】'
    + NL + '1. 정체 목표([3회 이상 정체] 표시)는 반드시 단기목표 재설정 또는 접근법 변경을 제안하세요.'
    + NL + '2. 달성률 80% 이상 목표는 다음 단계로 도약하는 목표를 제시하세요.'
    + NL + '3. 부모 협력 방법은 5분 내 실행 가능한 일상 활동으로 구체적으로 작성하세요.'
    + NL + '【언어 규칙】이 문서는 부모(주 양육자)가 읽습니다. 쉬운 일상 언어만 사용하세요.'
    + NL + '금지: "통합적 발달을 모색","정체를 타개","도모하다","증진","도출" 등 어려운 한자어.'
    + NL + '권장: "말이 늘고 있어요","문장으로 말하기 시작했어요","~을 함께 해보세요" 등 친근한 표현.'
    + AI_NAME_RULE
    + NL + '반드시 순수 JSON만 출력. 마크다운 코드블록 금지.'
    + NL + '{"priorityGoals":["가장 집중해야 할 목표 1-2개"],"longTermGoals":["3개월 후 기대 모습 2-3개"],"shortTermGoals":{"1개월":["구체적 단기목표"],"2개월":["구체적 단기목표"],"3개월":["구체적 단기목표"]},"parentCooperation":[{"activity":"부모와 함께할 활동명","how":"구체적 방법 2문장","frequency":"주 몇 회"}],"activities":["치료실 권장활동"],"therapistNote":"치료사 전용 임상 메모 — 접근법 변경 제안 포함"}';

  // 개인정보 최소화(M2): 실명 대신 가명 ○○ 전송 → 응답에서 클라이언트 복원
  var USER = '아동: ○○ (' + child.age + ', 진단: ' + child.type + ')'
    + NL + '치료 목표: ' + ((child.goals || []).join(', ') || '미설정')
    + (child.memo ? NL + '특이사항: ' + child.memo : '')
    + (assessLog ? NL + NL + '[검사 결과]' + NL + assessLog : '')
    + (trendLog ? NL + NL + '[목표별 달성률 추이]' + NL + trendLog : '')
    + (sessionLog ? NL + NL + '[최근 세션 ' + sessions.length + '회 상세]' + NL + sessionLog : '');

  // ES5 호환: .finally() 미지원 환경 대응
  function resetIEPBtn() {
    btn.dataset.busy = '';
    btn.disabled = false;
    btn.textContent = '📋 장단기계획(IEP) 초안 생성 (AI)';
  }
  callClaude(SYSTEM, USER, 2500, getAIModel())
    .then(function(raw) {
      // IEP 는 부모도 보는 문서 — 학부모 어휘 정책 적용
      if (typeof sanitizeSLPOutput === 'function') raw = sanitizeSLPOutput(raw, 'parent');
      // 가명(○○) → 실명 복원 (실명 미전송·클라이언트 치환, restoreName 이 특수문자 안전처리).
      raw = restoreName(raw, child.name);
      var p = parseJSON(raw);
      if (!p || !p.longTermGoals) throw new Error('IEP 파싱 실패');
      // 구조 보정 — AI가 일부 필드 누락 시 renderIEP crash 방지
      if (!Array.isArray(p.priorityGoals))     p.priorityGoals     = [];
      if (!Array.isArray(p.longTermGoals))     p.longTermGoals     = [];
      if (!p.shortTermGoals || typeof p.shortTermGoals !== 'object') {
        p.shortTermGoals = { '1개월': [], '2개월': [], '3개월': [] };
      } else {
        ['1개월', '2개월', '3개월'].forEach(function(m) {
          if (!Array.isArray(p.shortTermGoals[m])) p.shortTermGoals[m] = [];
        });
      }
      if (!Array.isArray(p.parentCooperation)) p.parentCooperation = [];
      if (!Array.isArray(p.activities))        p.activities        = [];
      if (typeof p.therapistNote !== 'string') p.therapistNote     = p.notes || '';
      renderIEP(p, child.name);
      resetIEPBtn();
    })
    .catch(function(err) {
      if (window.console && console.warn) console.warn('[IEP 생성]', err && err.message);
      document.getElementById('iepResult').innerHTML = '<div style="padding:12px;color:var(--red);font-size:13px;">❌ ' + escHtml(_userErrMsg(err, 'IEP 생성')) + '</div>';
      resetIEPBtn();
    });
}

// ── 오늘의 치료활동 추천 (AI) ───────────────────────────────────────────
// 아동의 '현재 목표'(child.goals + 최근 세션 목표명)를 자동 수집해, 오늘 세션에서 바로
// 쓸 놀이 기반 활동 3가지를 준비물·단계까지 제안. 선생님 입력은 아동 선택 한 번뿐.
// ★ PII 보호: 이름·메모를 외부 LLM 에 보내지 않는다(연령·진단·목표명·수치만 전송) → 마스킹 불필요.
function _childCurrentGoals(childId) {
  childId = String(childId || '');
  var names = {};
  var child = childDB.find(function(c) { return c.id === childId; });
  if (child && Array.isArray(child.goals)) child.goals.forEach(function(g) { if (g) names[String(g)] = true; });
  sessionDB
    .filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? 1 : -1; })
    .slice(0, 6)
    .forEach(function(s) { (s.goals || []).forEach(function(g) { if (g && g.name) names[String(g.name)] = true; }); });
  return Object.keys(names);
}

function renderActGoals(childId) {
  var el = document.getElementById('actGoals');
  if (!el) return;
  childId = String(childId || '');
  if (!childId) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var goals = _childCurrentGoals(childId);
  el.style.display = 'block';
  if (!goals.length) {
    el.innerHTML = '🎯 등록된 목표가 없어 연령·유형 기준으로 추천합니다.';
    return;
  }
  // 동적값(목표명)은 escHtml 처리, 나머지는 정적 리터럴 — map 체인이라 린터가 추적 못해 disable
  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = '🎯 자동으로 불러온 목표: ' + goals.map(function(g) {
    return '<span style="display:inline-block;background:#E1F5EE;color:#0F6E56;font-size:11px;padding:2px 8px;border-radius:10px;margin:2px 3px 0 0;">' + escHtml(g) + '</span>';
  }).join('');
}

function generateActivities() {
  if (!currentUser || currentUser.role === 'parent') { showToast('⚠️ 권한이 없습니다.'); return; }
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String((document.getElementById('actChild') || {}).value || '');
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;

  var goals = _childCurrentGoals(childId);
  var dur = String((document.getElementById('actDur') || {}).value || '40');

  // 목표별 최신 달성률(수치만 — PII 아님)로 난이도 보정 힌트 제공
  var scoreMap = {};
  sessionDB
    .filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; })
    .forEach(function(s) { (s.goals || []).forEach(function(g) {
      if (g && g.name && g.score !== null && g.score !== undefined) scoreMap[g.name] = g.score;
    }); });
  var goalLine = goals.length
    ? goals.map(function(g) { return g + (scoreMap[g] !== undefined ? ' (최근 ' + scoreMap[g] + '%)' : ''); }).join(', ')
    : '미설정';

  var btn = document.getElementById('actBtn');
  var resEl = document.getElementById('actResult');
  if (!btn || !resEl) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1'; btn.disabled = true;
  btn.textContent = '⏳ 활동 구성 중...';
  resEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px;">🤖 ' + escHtml(child.name) + ' 목표에 맞는 오늘의 활동을 짜는 중...</div>';

  var NL = String.fromCharCode(10);
  var SYSTEM = '당신은 10년 이상 경력의 1급 언어재활사입니다. 제시된 아동의 치료 목표에 맞춰 오늘 ' + dur + '분 세션에서 바로 실행할 놀이 기반 치료활동 3가지를 제안하세요.'
    + NL + '【원칙】'
    + NL + '1. 각 활동은 제시된 목표 중 하나를 직접 겨냥할 것(달성률이 낮은 목표를 우선).'
    + NL + '2. 준비물은 일반 치료실에서 흔히 구할 수 있는 것으로, 필요 없으면 "준비물 없음".'
    + NL + '3. 진행 단계는 선생님이 바로 따라할 수 있게 2~3단계로 간결하게.'
    + NL + '4. 아동이 즐거워할 놀이 형태로, 연령에 맞게 구성.'
    + NL + '【언어 규칙】치료사(선생님)가 읽습니다. 군더더기 없이 실무적으로 작성하세요.'
    + AI_NAME_RULE
    + NL + '반드시 순수 JSON 객체만 출력. 마크다운 코드블록 금지.'
    + NL + '{"activities":[{"title":"활동명","targetSkill":"겨냥 목표(짧게)","materials":"준비물","minutes":숫자,"steps":["단계1","단계2"]}]}';

  var USER = '아동 정보 — 연령: ' + child.age + ', 진단: ' + child.type
    + NL + '세션 시간: ' + dur + '분'
    + NL + '현재 치료 목표: ' + goalLine;

  function resetBtn() {
    btn.dataset.busy = ''; btn.disabled = false;
    btn.textContent = '오늘의 활동 추천받기 (AI)';
  }
  callClaude(SYSTEM, USER, 1800, MODEL_HAIKU)
    .then(function(raw) {
      if (typeof sanitizeSLPOutput === 'function') raw = sanitizeSLPOutput(raw, 'therapist');
      var list = parseJSON(raw);
      if (!Array.isArray(list)) list = (list && Array.isArray(list.activities)) ? list.activities : [];
      if (!list.length) throw new Error('활동 추천 파싱 실패');
      renderActivities(list, child.name);
      resetBtn();
    })
    .catch(function(err) {
      if (window.console && console.warn) console.warn('[활동 추천]', err && err.message);
      resEl.innerHTML = '<div style="padding:12px;color:var(--red);font-size:13px;">❌ ' + escHtml(_userErrMsg(err, '활동 추천')) + '</div>';
      resetBtn();
    });
}

function renderActivities(list, childName) {
  var resEl = document.getElementById('actResult');
  if (!resEl) return;
  var cards = list.slice(0, 5).map(function(a) {
    var title = escHtml(String(a.title || '활동'));
    var skill = escHtml(String(a.targetSkill || ''));
    var mat = escHtml(String(a.materials || '준비물 없음'));
    var mins = (a.minutes != null && !isNaN(a.minutes)) ? (parseInt(a.minutes, 10) + '분') : '';
    var steps = Array.isArray(a.steps) ? a.steps : [];
    var stepHtml = steps.map(function(s, i) {
      return '<div style="display:flex;gap:8px;margin-top:6px;"><span style="flex-shrink:0;width:18px;height:18px;border-radius:50%;background:#E1F5EE;color:#0F6E56;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span><span style="font-size:13px;color:var(--text2);line-height:1.5;">' + escHtml(String(s)) + '</span></div>';
    }).join('');
    return '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'
      + '<div style="font-size:15px;font-weight:700;color:var(--text);">' + title + '</div>'
      + (mins ? '<span style="font-size:12px;color:var(--text2);white-space:nowrap;">⏱ ' + mins + '</span>' : '')
      + '</div>'
      + (skill ? '<div style="margin-top:7px;"><span style="background:#EEEDFE;color:#3C3489;font-size:11px;padding:3px 9px;border-radius:20px;">목표 · ' + skill + '</span></div>' : '')
      + '<div style="margin-top:10px;font-size:12px;color:var(--text2);">🧰 준비물: ' + mat + '</div>'
      + '<div style="margin-top:8px;">' + stepHtml + '</div>'
      + '</div>';
  }).join('');
  // cards 의 모든 동적값(title/skill/mat/steps/childName)은 위에서 escHtml 처리됨, AI_PROCESSING_NOTICE 는 신뢰 상수
  // eslint-disable-next-line no-unsanitized/property
  resEl.innerHTML = '<div style="background:white;border-radius:12px;padding:16px;box-shadow:var(--shadow);border-top:4px solid var(--mint);">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
    + '<div style="font-size:15px;font-weight:700;color:var(--mint);">✨ 오늘의 추천 활동</div>'
    + '<div style="font-size:11px;color:var(--text2);">' + escHtml(String(childName || '')) + '</div>'
    + '</div>'
    + AI_PROCESSING_NOTICE
    + cards
    + '<button class="btn-ghost" style="width:100%;margin-top:4px;" onclick="document.getElementById(\'actResult\').innerHTML=\'\'">닫기</button>'
    + '</div>';
}

// ── 월간 성장 리포트 (AI) ───────────────────────────────────────────────
// 한 달치 세션을 자동 집계 — KPI·목표별 달성률 변화는 클라이언트가 정확히 계산하고,
// AI 는 서술(총평·하이라이트·가정활동·다음달 포커스·카카오 문구)만 작성. 선생님은 검토·발송만.
function _monthsWithSessions(childId) {
  childId = String(childId || '');
  var set = {};
  sessionDB.filter(function(s) { return s.childId === childId; }).forEach(function(s) {
    if (s.date && s.date.length >= 7) set[s.date.slice(0, 7)] = true;
  });
  return Object.keys(set).sort().reverse();
}

function fillMrMonths(childId) {
  var sel = document.getElementById('mrMonth');
  if (!sel) return;
  childId = String(childId || '');
  var months = childId ? _monthsWithSessions(childId) : [];
  sel.innerHTML = '';
  if (!months.length) {
    var o0 = document.createElement('option');
    o0.value = ''; o0.textContent = childId ? '세션 기록 없음' : '아동을 먼저 선택하세요';
    sel.appendChild(o0);
    return;
  }
  months.forEach(function(m) {
    var p = m.split('-');
    var o = document.createElement('option');
    o.value = m; o.textContent = p[0] + '년 ' + parseInt(p[1], 10) + '월';
    sel.appendChild(o);
  });
}

function generateMonthlyReport() {
  if (!currentUser || currentUser.role === 'parent') { showToast('⚠️ 권한이 없습니다.'); return; }
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String((document.getElementById('mrChild') || {}).value || '');
  var month = String((document.getElementById('mrMonth') || {}).value || '');
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!month) { showToast('대상 월을 선택해주세요.'); return; }
  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;

  var all = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  var monthS = all.filter(function(s) { return s.date && s.date.slice(0, 7) === month; });
  if (!monthS.length) { showToast('해당 월 세션 기록이 없습니다.'); return; }

  // 이전 달 키 계산 (전월 대비 delta 용) — Date/toISOString 미사용(KST 드리프트 회피), 순수 산술
  var ym = month.split('-');
  var curM = parseInt(ym[1], 10), prevY = parseInt(ym[0], 10), pM = curM - 1; // curM·pM: 1~12
  if (pM < 1) { pM = 12; prevY -= 1; }
  var prevKey = prevY + '-' + String(pM).padStart(2, '0');
  var prevS = all.filter(function(s) { return s.date && s.date.slice(0, 7) === prevKey; });

  // 목표별 첫/끝 점수 (from 은 전월 마지막 점수 우선, 없으면 이번 달 첫 점수)
  var goalFirst = {}, goalLast = {}, prevLast = {};
  monthS.forEach(function(s) { (s.goals || []).forEach(function(g) {
    if (g && g.name && g.score !== null && g.score !== undefined) {
      if (goalFirst[g.name] === undefined) goalFirst[g.name] = parseFloat(g.score);
      goalLast[g.name] = parseFloat(g.score);
    }
  }); });
  prevS.forEach(function(s) { (s.goals || []).forEach(function(g) {
    if (g && g.name && g.score !== null && g.score !== undefined) prevLast[g.name] = parseFloat(g.score);
  }); });
  var goals = Object.keys(goalLast).map(function(n) {
    var from = (prevLast[n] !== undefined) ? prevLast[n] : goalFirst[n];
    return { name: n, from: Math.round(from), to: Math.round(goalLast[n]) };
  });
  function avgOf(arr) {
    var v = [];
    arr.forEach(function(s) { (s.goals || []).forEach(function(g) {
      if (g && g.score !== null && g.score !== undefined) v.push(parseFloat(g.score));
    }); });
    return v.length ? Math.round(v.reduce(function(a, b) { return a + b; }, 0) / v.length) : 0;
  }
  var avgNow = avgOf(monthS), avgPrev = avgOf(prevS);
  var kpi = { sessions: monthS.length, avg: avgNow, delta: (avgPrev ? avgNow - avgPrev : 0),
              improved: goals.filter(function(g) { return g.to > g.from; }).length };

  var btn = document.getElementById('mrBtn'), resEl = document.getElementById('mrResult');
  if (!btn || !resEl) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '⏳ 집계·작성 중...';
  resEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px;">🤖 ' + escHtml(child.name) + ' ' + escHtml(month) + ' 리포트를 작성 중...</div>';

  var NL = String.fromCharCode(10);
  var goalLine = goals.map(function(g) { return g.name + ' ' + g.from + '→' + g.to + '%'; }).join(', ') || '기록된 점수 없음';
  var memoLine = monthS.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + (g.score !== null && g.score !== undefined ? g.score + '%' : ''); }).join(', ');
    return s.date + ': [' + g + ']' + (s.memo ? ' ' + s.memo : '');
  }).join(NL);
  var _parentGuide = (typeof SLP_PROMPT_PARENT_GUIDE !== 'undefined') ? SLP_PROMPT_PARENT_GUIDE : '';
  var SYSTEM = '당신은 한국 언어치료 현장의 베테랑 언어재활사입니다. 한 달간의 치료 데이터를 근거로 학부모용 월간 리포트의 서술 부분만 작성하세요. 수치(세션 수·달성률·목표 변화)는 이미 계산되어 있으니 문장만 작성합니다. 순수 JSON만:'
    + NL + '{"summary":"이번 달 한 줄 총평(따뜻한 존댓말)","highlights":["구체적 성취 2-3개"],"homeActivities":["5분 내 실천 가능한 가정활동 2개"],"nextFocus":"다음 달 집중 방향 1문장","kakao":"카카오톡 발송용 친근한 메시지, 이모지 포함, 180자 내외"}'
    + NL + '【언어 규칙】부모(주 양육자)가 읽습니다. 쉬운 일상 언어만 사용하고 어려운 한자어("증진","도모","정체 타개" 등)는 금지.'
    + NL + _parentGuide + AI_NAME_RULE;
  // 개인정보 최소화(M2): 실명 대신 가명 ○○ 전송 → 응답에서 클라이언트 복원
  var USER = '아동: ○○ (' + child.age + ', ' + child.type + ')'
    + NL + '대상 월: ' + month
    + NL + '세션 ' + kpi.sessions + '회, 평균 달성률 ' + kpi.avg + '%' + (kpi.delta ? ' (전월대비 ' + (kpi.delta > 0 ? '+' : '') + kpi.delta + ')' : '')
    + NL + '목표별 변화: ' + goalLine
    + NL + NL + '[세션 메모]' + NL + memoLine;

  function resetBtn() { btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '📈 월간 리포트 생성 (AI)'; }
  callClaude(SYSTEM, USER, 1600, MODEL_HAIKU)
    .then(function(raw) {
      var p = parseJSON(raw) || {};
      function fix(v) {
        if (typeof v !== 'string') return v;
        if (typeof sanitizeSLPOutput === 'function') v = sanitizeSLPOutput(v, 'parent');
        return restoreName(v, child.name);
      }
      p.summary = fix(p.summary || '');
      p.nextFocus = fix(p.nextFocus || '');
      p.kakao = fix(p.kakao || '');
      p.highlights = (Array.isArray(p.highlights) ? p.highlights : []).map(fix);
      p.homeActivities = (Array.isArray(p.homeActivities) ? p.homeActivities : []).map(fix);
      renderMonthlyReport(p, child.name, kpi, goals, month);
      resetBtn();
    })
    .catch(function(err) {
      if (window.console && console.warn) console.warn('[월간 리포트]', err && err.message);
      resEl.innerHTML = '<div style="padding:12px;color:var(--red);font-size:13px;">❌ ' + escHtml(_userErrMsg(err, '월간 리포트 생성')) + '</div>';
      resetBtn();
    });
}

function renderMonthlyReport(p, childName, kpi, goals, month) {
  var resEl = document.getElementById('mrResult');
  if (!resEl) return;
  var ym = month.split('-');
  var monthLabel = ym[0] + '년 ' + parseInt(ym[1], 10) + '월';
  function kpiCard(label, val, sub) {
    return '<div style="background:#f8fafc;border-radius:10px;padding:10px 12px;flex:1;min-width:80px;"><div style="font-size:11px;color:var(--text2);margin-bottom:3px;">' + label + '</div><div style="font-size:20px;font-weight:700;color:var(--text);">' + val + (sub ? '<span style="font-size:11px;color:#0F6E56;font-weight:400;"> ' + sub + '</span>' : '') + '</div></div>';
  }
  function barRow(g) {
    var to = Math.max(0, Math.min(100, g.to)), from = Math.max(0, Math.min(100, g.from)), d = to - from;
    return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="color:var(--text);">' + escHtml(g.name) + '</span><span style="color:var(--text);">' + to + '% ' + (d ? '<span style="font-size:10px;color:' + (d > 0 ? '#0F6E56' : '#dc2626') + ';">(' + (d > 0 ? '+' : '') + d + ')</span>' : '') + '</span></div><div style="position:relative;height:7px;background:#eef2f7;border-radius:20px;overflow:hidden;"><div style="position:absolute;left:0;top:0;bottom:0;width:' + from + '%;background:#CECBF6;"></div><div style="position:absolute;left:0;top:0;bottom:0;width:' + to + '%;background:var(--mint);border-radius:20px;"></div></div></div>';
  }
  function liRows(arr, icon) {
    return (arr || []).map(function(t) {
      return '<div style="display:flex;gap:7px;margin-top:6px;"><span style="flex-shrink:0;">' + icon + '</span><span style="font-size:13px;color:var(--text2);line-height:1.5;">' + escHtml(String(t)) + '</span></div>';
    }).join('');
  }
  var html = '<div style="background:white;border-radius:12px;padding:16px;box-shadow:var(--shadow);border-top:4px solid var(--mint);">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="font-size:15px;font-weight:700;color:var(--mint);">📈 ' + monthLabel + ' 성장 리포트</div><div style="font-size:11px;color:var(--text2);">' + escHtml(String(childName || '')) + '</div></div>'
    + AI_PROCESSING_NOTICE
    + (p.summary ? '<div style="font-size:13px;color:var(--text);line-height:1.6;background:#f0fdfa;border-radius:8px;padding:10px 12px;margin-bottom:12px;">' + escHtml(p.summary) + '</div>' : '')
    + '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">' + kpiCard('세션', kpi.sessions + '회') + kpiCard('평균 달성률', kpi.avg + '%', (kpi.delta ? ((kpi.delta > 0 ? '+' : '') + kpi.delta) : '')) + kpiCard('향상 목표', kpi.improved + '개') + '</div>'
    + (goals.length ? '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;">목표별 변화</div>' + goals.map(barRow).join('') : '')
    + (p.highlights && p.highlights.length ? '<div style="font-size:13px;font-weight:700;color:var(--text);margin:14px 0 2px;">이달의 하이라이트</div>' + liRows(p.highlights, '✨') : '')
    + (p.homeActivities && p.homeActivities.length ? '<div style="font-size:13px;font-weight:700;color:var(--text);margin:14px 0 2px;">가정에서 해보세요</div>' + liRows(p.homeActivities, '🏠') : '')
    + (p.nextFocus ? '<div style="margin-top:14px;background:#f8fafc;border-radius:8px;padding:10px 12px;"><div style="font-size:11px;color:var(--text2);margin-bottom:3px;">다음 달 포커스</div><div style="font-size:13px;color:var(--text);line-height:1.5;">' + escHtml(p.nextFocus) + '</div></div>' : '')
    + (p.kakao ? '<div style="margin-top:14px;"><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;">💛 카카오톡 발송 문구</div><div class="kakao-box" id="mrKakaoText">' + escHtml(p.kakao) + '</div><button class="copy-btn" onclick="copyMrKakao()">📋 복사</button></div>' : '')
    + '<button class="btn-ghost" style="width:100%;margin-top:10px;" onclick="document.getElementById(\'mrResult\').innerHTML=\'\'">닫기</button>'
    + '</div>';
  // 모든 동적값(목표명·AI 서술)은 escHtml 처리, KPI 는 클라 계산 숫자 — map 체인이라 린터 추적 불가로 disable
  // eslint-disable-next-line no-unsanitized/property
  resEl.innerHTML = html;
}

function copyMrKakao() {
  var el = document.getElementById('mrKakaoText');
  if (!el) return;
  var text = el.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('📋 복사됨!'); }).catch(function() { showToast('⚠️ 클립보드 복사 실패. 직접 선택 후 복사해주세요'); });
  } else {
    showToast('⚠️ 이 브라우저는 자동 복사를 지원하지 않습니다');
  }
}

function _monthBlock(month, goals) {
  if (!goals || goals.length === 0) return '';
  return '<div style="margin-bottom:8px;">'
    + '<div style="font-size:12px;font-weight:700;color:var(--purple);margin-bottom:4px;">' + escHtml(month) + '</div>'
    + goals.map(function(g) {
        return '<div style="font-size:13px;padding:5px 10px;background:#f8fafc;border-radius:7px;margin-bottom:3px;border-left:3px solid var(--purple);">• ' + escHtml(g) + '</div>';
      }).join('')
    + '</div>';
}

function renderIEP(p, childName) {
  var today = new Date().toLocaleDateString('ko-KR');

  var html = '<div style="background:white;border-radius:12px;padding:16px;box-shadow:var(--shadow);border-top:4px solid var(--purple);">'

    // 헤더
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div style="font-size:15px;font-weight:700;color:var(--purple);">📋 장단기계획(IEP) 3개월 치료 계획</div>'
    + '<div style="font-size:11px;color:var(--text2);">' + escHtml(childName) + ' · ' + today + '</div>'
    + '</div>'
    + AI_PROCESSING_NOTICE

    // 우선순위 목표 (신규)
    + (p.priorityGoals && p.priorityGoals.length ? '<div style="background:#fef3c7;border-radius:10px;padding:10px 14px;margin-bottom:14px;border-left:4px solid #f59e0b;">'
        + '<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;">⭐ 이번 달 최우선 집중 목표</div>'
        + (p.priorityGoals || []).map(function(g) {
            return '<div style="font-size:13px;color:#78350f;padding:3px 0;">• ' + escHtml(g) + '</div>';
          }).join('')
        + '</div>' : '')

    // 장기 목표
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🎯 장기 목표 (3개월)</div>'
    + (p.longTermGoals || []).map(function(g, i) {
        return '<div style="font-size:13px;padding:7px 11px;background:#f5f3ff;border-radius:8px;margin-bottom:5px;font-weight:600;color:#6d28d9;">'
          + (i + 1) + '. ' + escHtml(g) + '</div>';
      }).join('')
    + '</div>'

    // 단기 목표 (월별)
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">📅 단기 목표 (월별)</div>'
    + _monthBlock('1개월차', (p.shortTermGoals || {})['1개월'])
    + _monthBlock('2개월차', (p.shortTermGoals || {})['2개월'])
    + _monthBlock('3개월차', (p.shortTermGoals || {})['3개월'])
    + '</div>'

    // 부모 협력 (신규)
    + (p.parentCooperation && p.parentCooperation.length ? '<div style="margin-bottom:14px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🏠 부모 협력 활동</div>'
        + (p.parentCooperation || []).map(function(c) {
            return '<div style="background:#f0fdf4;border-radius:8px;padding:10px 12px;margin-bottom:6px;border-left:3px solid #10b981;">'
              + '<div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:4px;">🌿 ' + escHtml(c.activity) + (c.frequency ? ' <span style="font-size:11px;font-weight:400;color:#6b7280;">(' + escHtml(c.frequency) + ')</span>' : '') + '</div>'
              + '<div style="font-size:12px;color:#374151;line-height:1.6;">' + escHtml(c.how) + '</div>'
              + '</div>';
          }).join('')
        + '</div>' : '')

    // 권장 활동
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🎮 권장 치료 활동</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
    + (p.activities || []).map(function(a) {
        return '<span style="font-size:12px;padding:4px 10px;background:var(--mint2);color:var(--mint);border-radius:20px;font-weight:600;">' + escHtml(a) + '</span>';
      }).join('')
    + '</div></div>'

    // 치료사 전용 메모 (신규: therapistNote 우선, 없으면 notes)
    + ((p.therapistNote || p.notes) ? '<div style="background:#fffbeb;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.7;">'
        + '📝 <strong>치료사 참고:</strong> ' + escHtml(p.therapistNote || p.notes) + '</div>' : '')

    // 버튼
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-purple" style="flex:1;" onclick="downloadIEPPDF(\'' + jsArg(childName) + '\')">🖨️ PDF 출력</button>'
    + '<button class="btn-ghost" style="flex:0.5;" onclick="document.getElementById(\'iepResult\').innerHTML=\'\'">닫기</button>'
    + '</div>'
    + '</div>';

  // 경쟁 조건 방지: childId 별 독립 저장 (연속 생성 시 PDF 오출력 방지)
  if (!window._iepDataMap) window._iepDataMap = {};
  var _iepCId = String((document.getElementById('iepChild') || {}).value);
  window._iepDataMap[_iepCId] = p;
  var _iepResEl = document.getElementById('iepResult');
  if (!_iepResEl) return;
  _iepResEl.dataset.iepChildId = _iepCId;
  // eslint-disable-next-line no-unsanitized/property
  _iepResEl.innerHTML = html;
  window._iepData = p;            // 하위 호환 유지
  window._iepChildName = childName;

  // 장단기계획(IEP) 자동 저장
  var _iepChildEl = document.getElementById('iepChild');
  if (!_iepChildEl) return;
  var childId = String(_iepChildEl.value || '');
  var todayStr = getTodayKST();
  var record = {
    id: generateClientId(),
    childId: childId,
    childName: childName,
    date: todayStr,
    data: p
  };
  iepDB.push(record);
  // 같은 아동의 오래된 장단기계획(IEP)는 최대 10개까지만 유지
  var childIeps = iepDB.filter(function(r){ return r.childId === childId; });
  if (childIeps.length > 10) {
    var toRemove = childIeps.slice(0, childIeps.length - 10).map(function(r){ return r.id; });
    iepDB = iepDB.filter(function(r){ return toRemove.indexOf(r.id) === -1; });
  }
  saveIEP();
  renderIEPHistory(childId);
  showToast('💾 장단기계획(IEP) 저장됨 (히스토리 누적)');
}

function renderIEPHistory(childId) {
  var el = document.getElementById('iepHistory');
  if (!el) return;
  var records = iepDB.filter(function(r){ return r.childId === childId; })
    .slice().reverse(); // 최신순

  if (records.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px;">저장된 장단기계획(IEP)이 없습니다.</div>';
    return;
  }

  var html = records.map(function(r) {
    var goals = (r.data.longTermGoals || []).slice(0, 1).join('');
    return '<div style="padding:10px 12px;background:#f8fafc;border-radius:9px;margin-bottom:6px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:12px;font-weight:700;color:var(--navy);">' + escHtml(r.date) + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
      + (goals ? escHtml(goals) : '—') + '</div>'
      + '</div>'
      + '<button class="btn-del" onclick="deleteIEPRecord(\'' + jsArg(String(r.id || '')) + '\')">삭제</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px;padding:7px 4px;" onclick="loadIEPRecord(\'' + jsArg(String(r.id || '')) + '\')">📂 불러오기</button>'
      + '<button class="btn-ghost" style="flex:0.5;font-size:12px;padding:7px 4px;" onclick="downloadIEPPDFById(\'' + jsArg(String(r.id || '')) + '\')">🖨️ PDF</button>'
      + '</div>'
      + '</div>';
  }).join('');

  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

function loadIEPRecord(id) {
  var r = iepDB.find(function(x){ return x.id === id; });
  if (!r) return;
  window._iepData = r.data;
  window._iepChildName = r.childName;
  // 불러오기 시 renderIEP를 재호출하되 저장은 하지 않음 (별도 플래그)
  renderIEPView(r.data, r.childName);
  showToast('📋 장단기계획(IEP) 불러옴 (' + r.date + ')');
}

function renderIEPView(p, childName) {
  // renderIEP와 동일한 UI지만 저장 없이 표시만
  var today = new Date().toLocaleDateString('ko-KR');
  var html = '<div style="background:white;border-radius:12px;padding:16px;box-shadow:var(--shadow);border-top:4px solid var(--purple);">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div style="font-size:15px;font-weight:700;color:var(--purple);">📋 IEP 3개월 치료 계획 <span style="font-size:11px;color:var(--text2);font-weight:400;">(불러온 기록)</span></div>'
    + '<div style="font-size:11px;color:var(--text2);">' + escHtml(childName) + ' · ' + today + '</div>'
    + '</div>'
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🎯 장기 목표 (3개월)</div>'
    + (p.longTermGoals || []).map(function(g, i) {
        return '<div style="font-size:13px;padding:7px 11px;background:#f5f3ff;border-radius:8px;margin-bottom:5px;font-weight:600;color:#6d28d9;">'
          + (i+1) + '. ' + escHtml(g) + '</div>';
      }).join('')
    + '</div>'
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">📅 단기 목표 (월별)</div>'
    + _monthBlock('1개월차', (p.shortTermGoals || {})['1개월'])
    + _monthBlock('2개월차', (p.shortTermGoals || {})['2개월'])
    + _monthBlock('3개월차', (p.shortTermGoals || {})['3개월'])
    + '</div>'
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🎮 권장 치료 활동</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
    + (p.activities || []).map(function(a) {
        return '<span style="font-size:12px;padding:4px 10px;background:var(--mint2);color:var(--mint);border-radius:20px;font-weight:600;">' + escHtml(a) + '</span>';
      }).join('')
    + '</div></div>'
    + ((p.therapistNote || p.notes) ? '<div style="background:#fffbeb;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.7;">📝 <strong>치료사 참고:</strong> ' + escHtml(p.therapistNote || p.notes) + '</div>' : '')
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-purple" style="flex:1;" onclick="downloadIEPPDF(\'' + jsArg(childName) + '\')">🖨️ PDF 출력</button>'
    + '<button class="btn-ghost" style="flex:0.5;" onclick="document.getElementById(\'iepResult\').innerHTML=\'\'">닫기</button>'
    + '</div></div>';
  var iepViewEl = document.getElementById('iepResult');
  if (!iepViewEl) return;
  // eslint-disable-next-line no-unsanitized/property
  iepViewEl.innerHTML = html;
  // 히스토리 뷰는 _iepDataMap 키가 없어, 직전 신규생성의 stale dataset.iepChildId 로 타 아동
  //   IEP 가 교차 출력되던 버그를 막는다 → 키를 비워 downloadIEPPDF 가 불러온 window._iepData 사용.
  iepViewEl.dataset.iepChildId = '';
}

function downloadIEPPDFById(id) {
  var r = iepDB.find(function(x){ return x.id === id; });
  if (!r) return;
  window._iepData = r.data;
  // 히스토리 출력 — stale dataset.iepChildId 로 인한 타 아동 교차 출력 방지(불러온 _iepData 사용).
  var _re = document.getElementById('iepResult');
  if (_re) _re.dataset.iepChildId = '';
  downloadIEPPDF(r.childName);
}

function deleteIEPRecord(id) {
  showConfirm('이 장단기계획(IEP) 기록을 삭제할까요?', function() {
    var r = iepDB.find(function(x){ return x.id === id; });
    var childId = r ? r.childId : '';
    // 서버 DELETE 를 게이트로 — 성공 시에만 메모리 제거·렌더·토스트(낙관적 처리 시 실패하면
    //   서버 행이 남아 다음 loadDBFromSupabase 때 삭제 기록이 되살아나는 '유령 부활' 방지).
    //   자매 경로 deleteAssessment 와 동일한 표준 패턴.
    supaFetch('madi_iep_history?id=eq.' + encodeURIComponent(id) + '&center_id=eq.' + encodeURIComponent(currentUser.center_id), 'DELETE')
      .then(function() {
        iepDB = iepDB.filter(function(x){ return x.id !== id; });
        renderIEPHistory(childId);
        showToast('🗑️ 장단기계획(IEP) 기록 삭제됨', {
          undo: function() {
            if (!r) return;
            // 복원은 saveIEP 와 동일한 제네릭 래핑({id,center_id,data})으로 — 평탄 필드를 그대로
            //   POST 하면 madi_iep_history 에 없는 컬럼이라 400(42703)으로 복원이 항상 실패하던 버그 수정.
            supaFetch('madi_iep_history', 'POST', [{ id: r.id, center_id: currentUser.center_id, data: r }])
              .then(function() {
                // 메모리 동기화: 삭제로 빠졌던 r 을 다시 넣고 렌더(기존 loadIEP 는 존재하지 않는 함수라 동기화 누락 버그).
                if (!iepDB.some(function(x){ return x.id === r.id; })) iepDB.push(r);
                renderIEPHistory(childId);
                showToast('↩️ 복원됨');
              })
              .catch(function() { showToast('❌ 복원 실패 — 다시 시도해주세요'); });
          }
        });
      })
      .catch(function(e) {
        if(window.console&&console.warn)console.warn('[madi-08 deleteIEP]',e&&e.message);
        showToast('❌ 장단기계획 삭제 실패 — 다시 시도해주세요');
      });
  });
}

function downloadIEPPDF(childName) {
  // childId 기반 keyed 조회 (연속 생성 시 PDF 오출력 방지)
  var resultEl = document.getElementById('iepResult');
  var cid = resultEl ? (resultEl.dataset.iepChildId || '') : '';
  var p = (cid && window._iepDataMap && window._iepDataMap[cid]) ? window._iepDataMap[cid] : window._iepData;
  if (!p) { showToast('장단기계획(IEP) 데이터가 없습니다. 다시 생성해주세요.'); return; }
  var today = new Date().toLocaleDateString('ko-KR');

  function monthSection(month, goals) {
    if (!goals || goals.length === 0) return '';
    return '<p style="font-weight:700;color:#7c3aed;margin:10px 0 4px;">' + escHtml(month || '') + '차</p>'
      + goals.map(function(g) { return '<p style="margin:2px 0;padding-left:12px;">• ' + escHtml(g) + '</p>'; }).join('');
  }

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + 'body{font-family:"Pretendard",sans-serif;padding:40px 50px;color:#1e293b;line-height:1.8;max-width:800px;margin:0 auto;}'
    + '.iep-title{text-align:center;font-size:20px;font-weight:700;color:#0f2942;margin-bottom:4px;}'
    + '.iep-sub{text-align:center;font-size:12px;color:#64748b;margin-bottom:20px;border-bottom:2px solid #8b5cf6;padding-bottom:12px;}'
    + 'h3{font-size:14px;font-weight:700;color:#0f2942;margin:18px 0 6px;border-bottom:1.5px solid #0E6B5C;padding-bottom:4px;}'
    + 'p{margin:3px 0;font-size:13px;line-height:1.8;}'
    + '.chip{display:inline-block;background:#EAF3F1;color:#0E6B5C;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;margin:3px 2px;}'
    + '.long-goal{background:#f5f3ff;border-radius:8px;padding:8px 12px;margin-bottom:6px;font-weight:600;color:#6d28d9;}'
    + '.note{background:#fffbeb;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-top:16px;}'
    + '@media print{body{padding:20px 30px;}}'
    + '</style></head><body>'
    + '<div class="iep-title">장단기계획(IEP)</div>'
    + '<div class="iep-sub">대상: <strong>' + escHtml(childName) + '</strong> &nbsp;|&nbsp; 계획 기간: 3개월 &nbsp;|&nbsp; 작성일: ' + today + '</div>'
    + '<h3>🎯 장기 목표</h3>'
    + (p.longTermGoals || []).map(function(g, i) { return '<div class="long-goal">' + (i+1) + '. ' + escHtml(g) + '</div>'; }).join('')
    + '<h3>📅 단기 목표</h3>'
    + monthSection('1개월', (p.shortTermGoals || {})['1개월'])
    + monthSection('2개월', (p.shortTermGoals || {})['2개월'])
    + monthSection('3개월', (p.shortTermGoals || {})['3개월'])
    + '<h3>🎮 권장 치료 활동</h3>'
    + '<div>' + (p.activities || []).map(function(a) { return '<span class="chip">' + escHtml(a) + '</span>'; }).join('') + '</div>'
    + ((p.therapistNote || p.notes) ? '<div class="note">📝 <strong>치료사 참고:</strong> ' + escHtml(p.therapistNote || p.notes) + '</div>' : '')
    + '<p style="margin-top:32px;text-align:right;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">마디아이(MadiAI) AI 보조 작성 | 출력일: ' + today + '</p>'
    + '</body></html>';
  var blob = new Blob([html], { type: 'text/html' });
  var blobUrl = URL.createObjectURL(blob);
  var win = window.open(blobUrl, '_blank');
  if (!win) { URL.revokeObjectURL(blobUrl); showToast('⚠️ 팝업이 차단됐습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  win.onload = function() { win.print(); };
  setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
  showToast('📄 장단기계획(IEP) PDF 출력 창 열림');
}

// ─────── W5: 활동 자료 카탈로그 ───────
// ─────── W8: 효과 통계 대시보드 ───────
function renderEffectStats() {
  var el = document.getElementById('effectStatsBody');
  if (!el) return;

  if (sessionDB.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;font-size:13px;color:var(--text2);">세션 데이터가 없습니다.</div>';
    return;
  }

  var today = nowKST();
  var thisMonth = ymd(today).slice(0, 7);
  var lastMonth = ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);

  // 기본 통계
  var totalSessions = sessionDB.length;
  var thisMonthSessions = sessionDB.filter(function(s){ return s.date.slice(0,7) === thisMonth; }).length;
  var lastMonthSessions = sessionDB.filter(function(s){ return s.date.slice(0,7) === lastMonth; }).length;

  // 전체 평균 달성도
  var allScores = [];
  sessionDB.forEach(function(s){
    (s.goals||[]).forEach(function(g){ if(g.score !== null && g.score !== undefined) allScores.push(g.score); });
  });
  var avgScore = allScores.length > 0 ? Math.round(allScores.reduce(function(a,b){return a+b;},0)/allScores.length) : null;

  // 아동별 최근 진전 TOP3
  var childProgress = [];
  childDB.forEach(function(c) {
    var ss = sessionDB.filter(function(s){ return s.childId === c.id; })
      .sort(function(a,b){ return safeCmp(a.date, b.date); });
    if (ss.length < 2) return;
    var first2 = ss.slice(0, 2), last2 = ss.slice(-2);
    function avgGoalScore(sessions) {
      var scores = [];
      sessions.forEach(function(s){ (s.goals||[]).forEach(function(g){ if(g.score!==null && g.score!==undefined) scores.push(g.score); }); });
      return scores.length ? scores.reduce(function(a,b){return a+b;},0)/scores.length : null;
    }
    var early = avgGoalScore(first2), late = avgGoalScore(last2);
    if (early !== null && late !== null) childProgress.push({ name: c.name, diff: Math.round(late - early), late: Math.round(late) });
  });
  childProgress.sort(function(a,b){ return b.diff - a.diff; });
  var top3 = childProgress.slice(0, 3);
  var bottom3 = childProgress.filter(function(x){ return x.diff < 0; }).slice(-3).reverse();

  // 치료사별 세션 수
  var teacherStats = {};
  scheduleDB.forEach(function(s){
    if (!s.teacher) return;
    teacherStats[s.teacher] = (teacherStats[s.teacher]||0) + 1;
  });

  // HTML 조합
  var statCard = function(val, label, sub, color) {
    return '<div style="flex:1;min-width:80px;background:#f8fafc;border-radius:10px;padding:12px;text-align:center;">'
      + '<div style="font-size:22px;font-weight:900;color:' + color + ';">' + val + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--navy);margin-top:2px;">' + label + '</div>'
      + (sub ? '<div style="font-size:10px;color:var(--text2);margin-top:1px;">' + sub + '</div>' : '')
      + '</div>';
  };

  var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">'
    + statCard(totalSessions + '회', '누적 세션', null, 'var(--mint)')
    + statCard(thisMonthSessions + '회', '이번 달', '지난달 ' + lastMonthSessions + '회', thisMonthSessions > 0 && thisMonthSessions >= lastMonthSessions ? 'var(--green)' : 'var(--amber)')
    + statCard(avgScore != null ? avgScore + '%' : '—', '평균 달성도', '전체 세션 기준', avgScore == null ? 'var(--text2)' : avgScore >= 70 ? 'var(--green)' : avgScore >= 40 ? 'var(--amber)' : 'var(--red)')
    + statCard(childDB.filter(function(c){ return (c.status||'등록')==='등록'; }).length + '명', '등록 아동', null, 'var(--purple)')
    + '</div>';

  if (top3.length > 0) {
    html += '<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:6px;">🏆 가장 많이 진전된 아동</div>';
    top3.forEach(function(c, i) {
      var bar = Math.min(100, Math.max(0, c.late));
      var col = c.diff >= 0 ? 'var(--green)' : 'var(--red)';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
        + '<div style="font-size:12px;font-weight:700;width:20px;color:var(--text2);">' + (i+1) + '</div>'
        + '<div style="font-size:13px;font-weight:700;min-width:60px;">' + escHtml(c.name) + '</div>'
        + '<div style="flex:1;height:8px;background:#e2e8f0;border-radius:6px;overflow:hidden;">'
        + '<div style="width:' + bar + '%;height:100%;background:' + col + ';border-radius:6px;"></div></div>'
        + '<div style="font-size:12px;font-weight:700;color:' + col + ';min-width:44px;text-align:right;">'
        + (c.diff >= 0 ? '+' : '') + c.diff + '%</div>'
        + '</div>';
    });
  }

  if (bottom3.length > 0) {
    html += '<div style="font-size:12px;font-weight:700;color:var(--amber);margin:10px 0 6px;">⚠️ 진전 부진 아동</div>';
    bottom3.forEach(function(c) {
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#fffbeb;border-radius:8px;margin-bottom:4px;">'
        + '<span style="font-size:12px;font-weight:700;">' + escHtml(c.name) + '</span>'
        + '<span style="font-size:12px;color:var(--red);font-weight:700;">' + c.diff + '% 감소</span>'
        + '</div>';
    });
  }

  if (Object.keys(teacherStats).length > 0) {
    html += '<div style="font-size:12px;font-weight:700;color:var(--navy);margin:10px 0 6px;">👥 치료사별 일정 수</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    Object.keys(teacherStats).forEach(function(name) {
      html += '<div style="font-size:12px;padding:4px 10px;background:var(--mint2);color:var(--mint);border-radius:20px;font-weight:600;">'
        + escHtml(name) + ' · ' + teacherStats[name] + '건</div>';
    });
    html += '</div>';
  }

  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

// ─────── W5+W8: 활동 자료 카탈로그 (검색/필터 추가) ───────