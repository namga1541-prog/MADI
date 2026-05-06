function generateReport() {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var childId = parseInt(document.getElementById('reportChild').value);
  var period = document.getElementById('reportPeriod').value;
  if (!childId) { showToast('아동을 선택해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;
  var sessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  var target = period === 'all' ? sessions : sessions.slice(-parseInt(period));
  if (target.length === 0) { showToast('세션 기록이 없습니다.'); return; }

  var btn = document.getElementById('reportBtn');
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';

  var resultEl = document.getElementById('reportResult');
  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>부모 보고서를 생성 중입니다...</p></div>';

  var summary = target.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + (g.score !== null ? ' ' + g.score + '%' : ''); }).join(', ');
    return s.date + ': [' + g + '] ' + (s.memo || '');
  }).join('\n');

  var SYSTEM = '당신은 언어치료 전문가입니다. 부모님께 보낼 보고서를 두 형식으로 작성하세요. 순수 JSON만:'
    + ' {"kakao":"카카오톡 메시지 (이모지, 친근한 존댓말, 200자 내외)","report":"전문 보고서 (치료 경과, 목표 달성, 가정 지도, 존댓말, 400자 내외)"}';
  var USER = '아동: ' + child.name + ' (' + child.age + ', ' + child.type + ')\n목표: ' + (child.goals.join(', ') || '없음') + '\n\n세션:\n' + summary;

  callClaude(apiKey, SYSTEM, USER, 1500, getAIModel())
    .then(function(raw) {
      var p = parseJSON(raw);
      renderReport(p, child.name);
    })
    .catch(function(err) {
      resultEl.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(err.message || '오류') + '</p></div>';
    })
    .finally(function() {
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '🤖 AI 보고서 생성';
    });
}

function renderReport(p, name) {
  var k = p.kakao || '', r = p.report || '';
  var html = '<div class="card">'
    + '<div class="card-title"><div class="card-title-left">💛 카카오톡 메시지</div></div>'
    + '<div class="kakao-box" id="kakaoText">' + escHtml(k) + '</div>'
    + '<button class="copy-btn" onclick="copyKakao()">📋 카카오톡 메시지 복사</button>'
    + '</div>'
    + '<div class="card">'
    + '<div class="card-title"><div class="card-title-left">📄 전문 보고서</div></div>'
    + '<div class="report-box" id="reportText">' + escHtml(r) + '</div>'
    + '<button class="pdf-btn" onclick="downloadPDF(\'' + escHtml(name) + '\',\'reportText\',\'언어치료 경과 보고서\')">⬇️ PDF 다운로드</button>'
    + '</div>';
  document.getElementById('reportResult').innerHTML = html;
}

function copyKakao() {
  var el = document.getElementById('kakaoText');
  if (!el) return;
  var text = el.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('📋 복사됨!'); });
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
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<style>body{font-family:"Noto Sans KR",sans-serif;padding:40px;color:#1e293b;line-height:1.8;}'
    + 'h2{color:#0f2942;margin-bottom:8px;}p{white-space:pre-wrap;font-size:14px;}'
    + '.footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;}'
    + '</style></head><body>'
    + '<h2>' + title + '</h2>'
    + '<p style="font-size:12px;color:#64748b;margin-bottom:24px;">대상 아동: ' + name + ' &nbsp;|&nbsp; 작성일: ' + today + '</p>'
    + '<p>' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>'
    + '<div class="footer">마디(Madi) AI 보조 작성 보고서</div>'
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
        html += '<h2 style="font-size:15px;font-weight:700;color:#0f2942;margin:20px 0 8px;border-bottom:2px solid #0ea5a0;padding-bottom:5px;">' + inlineBold(trimmed) + '</h2>';
      } else if (/^\d+\./.test(trimmed) && trimmed.length < 60) {
        html += '<p style="font-weight:700;font-size:14px;margin:12px 0 4px;color:#1e293b;">' + inlineBold(trimmed) + '</p>';
      } else if (/^[가-힣]\./.test(trimmed)) {
        html += '<p style="font-weight:700;font-size:13px;margin:8px 0 4px;color:#0ea5a0;">' + inlineBold(trimmed) + '</p>';
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

  var win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + 'body{font-family:"Noto Sans KR",sans-serif;padding:40px 50px;color:#1e293b;line-height:1.8;max-width:800px;margin:0 auto;}'
    + '.rpt-header{text-align:center;margin-bottom:28px;padding-bottom:14px;border-bottom:3px double #0f2942;}'
    + '.rpt-title{font-size:22px;font-weight:700;color:#0f2942;margin-bottom:10px;letter-spacing:2px;}'
    + '.rpt-meta{display:flex;justify-content:space-between;font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:8px;}'
    + 'h2{font-size:15px;font-weight:700;color:#0f2942;margin:20px 0 8px;border-bottom:2px solid #0ea5a0;padding-bottom:4px;}'
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
    + '<div class="rpt-footer">마디(Madi) AI 보조 작성 &nbsp;|&nbsp; 출력일: ' + today + '</div>'
    + '</body></html>');
  win.document.close();
  setTimeout(function() { win.print(); }, 800);
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
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var childId = parseInt(document.getElementById('iepChild').value);
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
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 장단기계획(IEP) 생성 중...';
  document.getElementById('iepResult').innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px;">🤖 AI가 3개월 치료 계획을 작성 중입니다...</div>';

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
  var SYSTEM = '당신은 언어치료 IEP(개별화 교육 계획) 전문가입니다. 제공된 아동 정보를 바탕으로 근거 기반의 3개월 치료 계획 초안을 작성하세요.'
    + NL + '【언어 규칙】이 문서는 부모(주 양육자)가 읽는 자료입니다. 쉬운 일상 언어로 작성하세요.'
    + NL + '금지: "통합적 발달을 모색","정체를 타개","도모하다","증진" 등 어려운 한자어 전문용어.'
    + NL + '권장: "말이 늘고 있어요","문장으로 말하기 시작했어요","~을 연습할 거예요" 등 친근한 표현.'
    + NL + '반드시 순수 JSON만 출력하세요. 다른 텍스트나 마크다운 코드블록 금지.'
    + NL + '{"longTermGoals":["장기목표1","장기목표2"],"shortTermGoals":{"1개월":["단기목표A","단기목표B"],"2개월":["단기목표C"],"3개월":["단기목표D"]},"activities":["권장활동1","권장활동2","권장활동3"],"notes":"치료사 참고 메모"}';

  var USER = '아동: ' + child.name + ' (' + child.age + ', 진단: ' + child.type + ')'
    + NL + '치료 목표: ' + ((child.goals || []).join(', ') || '미설정')
    + (child.memo ? NL + '특이사항: ' + child.memo : '')
    + (assessLog ? NL + NL + '[검사 결과]' + NL + assessLog : '')
    + (sessionLog ? NL + NL + '[최근 세션 ' + sessions.length + '회]' + NL + sessionLog : '');

  callClaude(apiKey, SYSTEM, USER, 2000, getAIModel())
    .then(function(raw) {
      var p = parseJSON(raw);
      if (!p || !p.longTermGoals) throw new Error('IEP 파싱 실패');
      renderIEP(p, child.name);
    })
    .catch(function(err) {
      document.getElementById('iepResult').innerHTML = '<div style="padding:12px;color:var(--red);font-size:13px;">❌ ' + escHtml(err.message) + '</div>';
    })
    .finally(function() {
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '📋 장단기계획(IEP) 초안 생성 (AI)';
    });
}

function renderIEP(p, childName) {
  var today = new Date().toLocaleDateString('ko-KR');

  function monthBlock(month, goals) {
    if (!goals || goals.length === 0) return '';
    return '<div style="margin-bottom:8px;">'
      + '<div style="font-size:12px;font-weight:700;color:var(--purple);margin-bottom:4px;">' + escHtml(month) + '</div>'
      + goals.map(function(g) {
          return '<div style="font-size:13px;padding:5px 10px;background:#f8fafc;border-radius:7px;margin-bottom:3px;border-left:3px solid var(--purple);">• ' + escHtml(g) + '</div>';
        }).join('')
      + '</div>';
  }

  var html = '<div style="background:white;border-radius:12px;padding:16px;box-shadow:var(--shadow);border-top:4px solid var(--purple);">'

    // 헤더
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div style="font-size:15px;font-weight:700;color:var(--purple);">📋 장단기계획(IEP) 3개월 치료 계획</div>'
    + '<div style="font-size:11px;color:var(--text2);">' + escHtml(childName) + ' · ' + today + '</div>'
    + '</div>'

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
    + monthBlock('1개월차', (p.shortTermGoals || {})['1개월'])
    + monthBlock('2개월차', (p.shortTermGoals || {})['2개월'])
    + monthBlock('3개월차', (p.shortTermGoals || {})['3개월'])
    + '</div>'

    // 권장 활동
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🎮 권장 치료 활동</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
    + (p.activities || []).map(function(a) {
        return '<span style="font-size:12px;padding:4px 10px;background:var(--mint2);color:var(--mint);border-radius:20px;font-weight:600;">' + escHtml(a) + '</span>';
      }).join('')
    + '</div></div>'

    // 치료사 메모
    + (p.notes ? '<div style="background:#fffbeb;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.7;">'
        + '📝 <strong>치료사 참고:</strong> ' + escHtml(p.notes) + '</div>' : '')

    // 버튼
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-purple" style="flex:1;" onclick="downloadIEPPDF(\'' + escHtml(childName) + '\')">🖨️ PDF 출력</button>'
    + '<button class="btn-ghost" style="flex:0.5;" onclick="document.getElementById(\'iepResult\').innerHTML=\'\'">닫기</button>'
    + '</div>'
    + '</div>';

  document.getElementById('iepResult').innerHTML = html;
  window._iepData = p;
  window._iepChildName = childName;

  // 장단기계획(IEP) 자동 저장
  var childId = parseInt(document.getElementById('iepChild').value) || 0;
  var todayStr = new Date().toISOString().slice(0, 10);
  var record = {
    id: Date.now() + Math.floor(Math.random() * 1000),
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
      + '<button class="btn-del" onclick="deleteIEPRecord(' + r.id + ')">삭제</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px;padding:7px 4px;" onclick="loadIEPRecord(' + r.id + ')">📂 불러오기</button>'
      + '<button class="btn-ghost" style="flex:0.5;font-size:12px;padding:7px 4px;" onclick="downloadIEPPDFById(' + r.id + ')">🖨️ PDF</button>'
      + '</div>'
      + '</div>';
  }).join('');

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
  function monthBlock(month, goals) {
    if (!goals || goals.length === 0) return '';
    return '<div style="margin-bottom:8px;">'
      + '<div style="font-size:12px;font-weight:700;color:var(--purple);margin-bottom:4px;">' + escHtml(month) + '</div>'
      + goals.map(function(g) {
          return '<div style="font-size:13px;padding:5px 10px;background:#f8fafc;border-radius:7px;margin-bottom:3px;border-left:3px solid var(--purple);">• ' + escHtml(g) + '</div>';
        }).join('')
      + '</div>';
  }
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
    + monthBlock('1개월차', (p.shortTermGoals || {})['1개월'])
    + monthBlock('2개월차', (p.shortTermGoals || {})['2개월'])
    + monthBlock('3개월차', (p.shortTermGoals || {})['3개월'])
    + '</div>'
    + '<div style="margin-bottom:14px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--border);">🎮 권장 치료 활동</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
    + (p.activities || []).map(function(a) {
        return '<span style="font-size:12px;padding:4px 10px;background:var(--mint2);color:var(--mint);border-radius:20px;font-weight:600;">' + escHtml(a) + '</span>';
      }).join('')
    + '</div></div>'
    + (p.notes ? '<div style="background:#fffbeb;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.7;">📝 <strong>치료사 참고:</strong> ' + escHtml(p.notes) + '</div>' : '')
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button class="btn btn-purple" style="flex:1;" onclick="downloadIEPPDF(\'' + escHtml(childName) + '\')">🖨️ PDF 출력</button>'
    + '<button class="btn-ghost" style="flex:0.5;" onclick="document.getElementById(\'iepResult\').innerHTML=\'\'">닫기</button>'
    + '</div></div>';
  document.getElementById('iepResult').innerHTML = html;
}

function downloadIEPPDFById(id) {
  var r = iepDB.find(function(x){ return x.id === id; });
  if (!r) return;
  window._iepData = r.data;
  downloadIEPPDF(r.childName);
}

function deleteIEPRecord(id) {
  if (!confirm('이 장단기계획(IEP) 기록을 삭제할까요?')) return;
  var r = iepDB.find(function(x){ return x.id === id; });
  var childId = r ? r.childId : 0;
  iepDB = iepDB.filter(function(x){ return x.id !== id; });
  saveIEP();
  supaFetch('madi_iep_history?id=eq.' + id, 'DELETE').catch(function(){});
  renderIEPHistory(childId);
  showToast('🗑️ 장단기계획(IEP) 기록 삭제됨');
}

function downloadIEPPDF(childName) {
  var p = window._iepData;
  if (!p) { showToast('장단기계획(IEP) 데이터가 없습니다. 다시 생성해주세요.'); return; }
  var today = new Date().toLocaleDateString('ko-KR');

  function monthSection(month, goals) {
    if (!goals || goals.length === 0) return '';
    return '<p style="font-weight:700;color:#7c3aed;margin:10px 0 4px;">' + month + '차</p>'
      + goals.map(function(g) { return '<p style="margin:2px 0;padding-left:12px;">• ' + escHtml(g) + '</p>'; }).join('');
  }

  var win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + 'body{font-family:"Noto Sans KR",sans-serif;padding:40px 50px;color:#1e293b;line-height:1.8;max-width:800px;margin:0 auto;}'
    + '.iep-title{text-align:center;font-size:20px;font-weight:700;color:#0f2942;margin-bottom:4px;}'
    + '.iep-sub{text-align:center;font-size:12px;color:#64748b;margin-bottom:20px;border-bottom:2px solid #8b5cf6;padding-bottom:12px;}'
    + 'h3{font-size:14px;font-weight:700;color:#0f2942;margin:18px 0 6px;border-bottom:1.5px solid #0ea5a0;padding-bottom:4px;}'
    + 'p{margin:3px 0;font-size:13px;line-height:1.8;}'
    + '.chip{display:inline-block;background:#e0f7f6;color:#0ea5a0;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;margin:3px 2px;}'
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
    + (p.notes ? '<div class="note">📝 <strong>치료사 참고:</strong> ' + escHtml(p.notes) + '</div>' : '')
    + '<p style="margin-top:32px;text-align:right;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">마디(Madi) AI 보조 작성 | 출력일: ' + today + '</p>'
    + '</body></html>');
  win.document.close();
  setTimeout(function() { win.print(); }, 600);
  showToast('📄 장단기계획(IEP) PDF 출력 창 열림');
}

// ─────── W5: 활동 자료 카탈로그 ───────
// ─────── W8: 정체 감지 설정 ───────
function saveStagnationSettings() {
  var countSel = document.getElementById('stagCountSel');
  var scoreSel = document.getElementById('stagScoreSel');
  if (!countSel || !scoreSel) return;
  var count = countSel.value;
  var score = scoreSel.value;
  localStorage.setItem('madi_stag_count', count);
  localStorage.setItem('madi_stag_score', score);
  var desc = document.getElementById('stagSettingDesc');
  if (desc) desc.textContent = '현재: ' + count + '회 연속 ' + score + '% 미만이면 정체로 감지합니다.';
  showToast('✅ 설정 저장됨');
}

function loadStagnationSettings() {
  var count = localStorage.getItem('madi_stag_count') || '3';
  var score = localStorage.getItem('madi_stag_score') || '40';
  var countSel = document.getElementById('stagCountSel');
  var scoreSel = document.getElementById('stagScoreSel');
  if (countSel) countSel.value = count;
  if (scoreSel) scoreSel.value = score;
  var desc = document.getElementById('stagSettingDesc');
  if (desc) desc.textContent = '현재: ' + count + '회 연속 ' + score + '% 미만이면 정체로 감지합니다.';
}

// ─────── W8: 효과 통계 대시보드 ───────
function renderEffectStats() {
  var el = document.getElementById('effectStatsBody');
  if (!el) return;

  if (sessionDB.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;font-size:13px;color:var(--text2);">세션 데이터가 없습니다.</div>';
    return;
  }

  var today = new Date();
  var thisMonth = today.toISOString().slice(0, 7);
  var lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);

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
      .sort(function(a,b){ return a.date.localeCompare(b.date); });
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
    + statCard(thisMonthSessions + '회', '이번 달', '지난달 ' + lastMonthSessions + '회', lastMonthSessions > 0 && thisMonthSessions >= lastMonthSessions ? 'var(--green)' : 'var(--amber)')
    + statCard(avgScore !== null ? avgScore + '%' : '—', '평균 달성도', '전체 세션 기준', avgScore >= 70 ? 'var(--green)' : avgScore >= 40 ? 'var(--amber)' : 'var(--red)')
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

  el.innerHTML = html;
}

// ─────── W5+W8: 활동 자료 카탈로그 (검색/필터 추가) ───────