// ─────── 세션 저장 ───────
function saveSession(aiNote) {
  var childId = parseInt(document.getElementById('sessionChild').value);
  var date = document.getElementById('sessionDate').value;
  var memo = document.getElementById('sessionMemo').value.trim();
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!date) { showToast('날짜를 선택해주세요.'); return; }

  var goals = goalRows.filter(function(r) { return r.name; }).map(function(r) {
    return { name: r.name, score: r.score !== '' ? parseFloat(r.score) : null };
  });

  var sessionId = Date.now() + Math.floor(Math.random() * 1000);
  sessionDB.push({ id: sessionId, childId: childId, date: date, goals: goals, memo: memo, aiNote: aiNote || '', phonemes: getPhonemeSnapshot() });
  saveSessions();
  renderSessionList();
  renderChildGrid();
  document.getElementById('sessionMemo').value = '';
  goalRows.forEach(function(r) { r.score = ''; });
  renderGoalRows();
  resetPhonemeMatrix();
  updateCloneBtnState(childId);
  showToast('✅ 세션 저장 완료!');
  vibrate(40);  // UX: 햅틱 피드백
  setTimeout(function() { suggestHomeActivities(sessionId); }, 300);
  setTimeout(function() { showPostSessionBriefing(sessionId); }, 800);
  setTimeout(function() { checkAutoStagnation(childId); }, 1200);
}

function saveSessionAI() {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var childId = parseInt(document.getElementById('sessionChild').value);
  var date = document.getElementById('sessionDate').value;
  var aiText = document.getElementById('aiInput').value.trim();
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!date) { showToast('날짜를 선택해주세요.'); return; }
  if (!aiText) { showToast('세션 내용을 입력해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  var btn = document.getElementById('aiSaveBtn');
  btn.disabled = true;
  btn.textContent = '⏳ AI 정리 중...';

  var SYSTEM = '당신은 언어치료 전문가 보조 AI입니다. 치료사의 자유로운 메모를 분석해 JSON으로 정리하세요. 순수 JSON만:'
    + ' {"goals":[{"name":"항목명","score":0-100숫자}],"memo":"세션 핵심 2-3문장","aiNote":"치료사용 전문 메모"}';
  var USER = '아동: ' + child.name + ' (' + child.age + ', ' + child.type + ')\n목표: ' + (child.goals.join(', ') || '없음') + '\n\n치료사 입력:\n' + aiText;

  callClaude(apiKey, SYSTEM, USER, 1200, MODEL_HAIKU)
    .then(function(raw) {
      var p = parseJSON(raw);
      var sessionId = Date.now() + Math.floor(Math.random() * 1000);
      sessionDB.push({
        id: sessionId, childId: childId, date: date,
        goals: p.goals || [], memo: p.memo || aiText, aiNote: p.aiNote || '',
        phonemes: getPhonemeSnapshot()
      });
      saveSessions();
      renderSessionList();
      renderChildGrid();
      document.getElementById('aiInput').value = '';
      showToast('🤖 AI 정리 저장 완료!');
      vibrate(40);  // UX: 햅틱 피드백
      resetPhonemeMatrix();
      setTimeout(function() { suggestHomeActivities(sessionId); }, 300);
      setTimeout(function() { showPostSessionBriefing(sessionId); }, 800);
      setTimeout(function() { checkAutoStagnation(childId); }, 1200);
    })
    .catch(function(err) { showToast('❌ ' + err.message); })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = '🤖 AI 정리 후 저장';
    });
}

// ─────── 기능 2: 가정 활동 추천 AI ───────
function suggestHomeActivities(sessionId) {
  var apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return;
  var session = sessionDB.find(function(s) { return s.id === sessionId; });
  if (!session) return;
  var child = childDB.find(function(c) { return c.id === session.childId; });
  if (!child) return;

  var resultEl = document.getElementById('lastSessionRec');
  resultEl.innerHTML = '<div class="ai-response-box">'
    + '<div class="ai-response-label">⏳ AI가 가정 활동을 추천 중...</div>'
    + '</div>';

  var goalsText = (session.goals || []).map(function(g) { return g.name + (g.score !== null ? ' ' + g.score + '%' : ''); }).join(', ');

  // 카탈로그 컨텍스트 구성
  var catalogCtx = '';
  if (activityDB.length > 0) {
    var matched = activityDB.filter(function(a) {
      var diagOk = !a.diagnosis || a.diagnosis === '전체' || a.diagnosis === child.type;
      return diagOk;
    }).slice(0, 15);
    if (matched.length > 0) {
      catalogCtx = '\n\n[등록된 활동 자료 카탈로그 (참고용)]\n'
        + matched.map(function(a) {
            return '- ' + a.name + (a.diagnosis ? ' [' + a.diagnosis + ']' : '')
              + (a.duration ? ' ' + a.duration + '분' : '')
              + (a.tags ? ' #' + a.tags.replace(/,/g,' #') : '');
          }).join('\n')
        + '\n위 카탈로그에 있는 활동을 우선 추천하되, 없으면 일반적인 활동을 추천하세요.';
    }
  }

  var NL = String.fromCharCode(10);
  var SYSTEM = '당신은 언어치료 전문가입니다. 오늘 세션 내용을 바탕으로 부모가 집에서 아이와 할 수 있는 '
    + '구체적인 활동 3가지를 추천하세요. 각 활동은 5-10분 내 실행 가능하고 일상에서 쉽게 접목할 수 있어야 합니다. '
    + '순수 JSON만: {"activities":[{"title":"활동명","steps":"진행 방법 2-3문장","tip":"부모 팁"}]}';
  var USER = '아동: ' + child.name + ' (' + child.age + ', ' + child.type + ')' + NL
    + '오늘 세션 목표 달성: ' + goalsText + NL
    + '메모: ' + session.memo
    + catalogCtx;

  callClaude(apiKey, SYSTEM, USER, 1000, MODEL_HAIKU)
    .then(function(raw) {
      var p = parseJSON(raw);
      var html = '<div class="ai-response-box">'
        + '<div class="ai-response-label">🏠 오늘 세션 기반 가정 활동 추천</div>';
      (p.activities || []).forEach(function(a, i) {
        html += '<div style="margin-top:10px;padding:10px;background:white;border-radius:8px;">'
          + '<div style="font-weight:700;font-size:13px;color:var(--purple);margin-bottom:4px;">'
          + (i + 1) + '. ' + escHtml(a.title) + '</div>'
          + '<div style="font-size:12px;line-height:1.6;color:var(--text);">' + escHtml(a.steps) + '</div>'
          + (a.tip ? '<div style="font-size:11px;line-height:1.5;color:var(--text2);margin-top:4px;font-style:italic;">💡 ' + escHtml(a.tip) + '</div>' : '')
          + '</div>';
      });
      html += '</div>';
      resultEl.innerHTML = html;
    })
    .catch(function(err) {
      resultEl.innerHTML = '<div class="ai-response-box"><div class="ai-response-label">⚠️ 추천 생성 실패: ' + escHtml(err.message || '오류') + '</div></div>';
    });
}

// ─────── 세션 목록 ───────
function renderSessionList() {
  var c = document.getElementById('sessionList');
  var recent = sessionDB.slice().reverse().slice(0, 20);
  if (recent.length === 0) {
    c.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>아직 기록된 세션이 없습니다.</p></div>';
    return;
  }
  var html = '';
  recent.forEach(function(s) {
    var ch = childDB.find(function(c) { return c.id === s.childId; });
    var cName = ch ? ch.name : '알수없음';
    var cColor = ch ? ch.color : '#64748b';

    // 목표 달성도
    var goalHtml = '';
    if (s.goals && s.goals.length > 0) {
      var validGoals = s.goals.filter(function(g){ return g.name; });
      if (validGoals.length > 0) {
        goalHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">';
        validGoals.forEach(function(g) {
          var sc = (g.score !== null && g.score !== undefined && g.score !== '') ? g.score : null;
          var bg = sc === null ? '#f1f5f9' : (sc >= 70 ? '#dcfce7' : sc >= 40 ? '#fef9c3' : '#fee2e2');
          var tc = sc === null ? '#64748b' : (sc >= 70 ? '#16a34a' : sc >= 40 ? '#ca8a04' : '#dc2626');
          goalHtml += '<span style="background:' + bg + ';color:' + tc + ';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">'
            + escHtml(g.name) + (sc !== null ? ' <b>' + sc + '%</b>' : '')
            + '</span>';
        });
        goalHtml += '</div>';
      }
    }

    html += '<div style="background:white;border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border-left:4px solid ' + cColor + ';">'
      // 헤더: 아동명 + 날짜 + 버튼
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
      + '<span style="font-size:15px;font-weight:700;color:' + cColor + ';">' + escHtml(cName) + '</span>'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<span style="font-size:12px;color:#64748b;">📅 ' + s.date + '</span>'
      + '<button class="btn-ghost" style="padding:7px 10px;font-size:11px;" onclick="editSessionDate(' + s.id + ')">✏️</button>'
      + (canDo('deleteSession') ? '<button class="btn-del" style="padding:7px 12px;font-size:11px;" onclick="deleteSession(' + s.id + ')">삭제</button>' : '')
      + '</div></div>'
      // 목표 달성도
      + goalHtml
      // 음소 데이터 뱃지
      + (s.phonemes && Object.keys(s.phonemes).length > 0
          ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">'
            + Object.keys(s.phonemes).map(function(p) {
                var d = s.phonemes[p];
                var parts = [];
                if (d.initial !== null && d.initial !== undefined) parts.push('초:' + d.initial + '%');
                if (d.medial  !== null && d.medial  !== undefined) parts.push('중:' + d.medial  + '%');
                if (d.final   !== null && d.final   !== undefined) parts.push('말:' + d.final   + '%');
                var avg = parts.length > 0
                  ? Math.round([d.initial, d.medial, d.final].filter(function(v){ return v !== null && v !== undefined; }).reduce(function(a,b){ return a+b; }, 0) / parts.length)
                  : null;
                var col = avg === null ? '#94a3b8' : avg >= 70 ? '#15803d' : avg >= 40 ? '#b45309' : '#dc2626';
                var bg  = avg === null ? '#f1f5f9' : avg >= 70 ? '#f0fdf4' : avg >= 40 ? '#fffbeb' : '#fef2f2';
                return '<span style="font-size:11px;padding:3px 8px;background:' + bg + ';color:' + col + ';border-radius:12px;font-weight:700;">'
                  + '🎯 ' + escHtml(p) + ' ' + parts.join(' / ') + '</span>';
              }).join('')
            + '</div>'
          : '')
      // 메모
      + (s.memo ? '<div style="font-size:13px;color:#334155;margin-top:8px;line-height:1.6;padding:8px 10px;background:#f8fafc;border-radius:8px;">' + escHtml(s.memo) + '</div>' : '')
      // AI 노트
      + (s.aiNote ? '<div style="font-size:12px;color:#7c3aed;margin-top:8px;padding:8px 10px;background:#f5f3ff;border-radius:8px;line-height:1.6;">🤖 ' + escHtml(s.aiNote) + '</div>' : '')
      + '</div>';
  });
  c.innerHTML = html;
}

function editSessionDate(id) {
  var s = sessionDB.find(function(x){ return x.id === id; });
  if (!s) return;
  var newDate = prompt('날짜를 입력하세요 (예: 2026-04-29)', s.date);
  if (!newDate || !newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    if (newDate !== null) showToast('❌ 날짜 형식을 확인해주세요 (예: 2026-04-29)');
    return;
  }
  s.date = newDate;
  saveSessions();
  renderSessionList();
  showToast('✅ 날짜 수정 완료!');
}

// ─────── 삭제 확인 모달 ───────
var _dcmCallback = null;
function showDeleteConfirm(title, subtitle, keyword, onConfirm) {
  _dcmCallback = onConfirm;
  document.getElementById('dcmTitle').textContent = title;
  document.getElementById('dcmSubtitle').textContent = subtitle;
  document.getElementById('dcmKeyword').textContent = keyword;
  document.getElementById('dcmInput').value = '';
  var btn = document.getElementById('dcmConfirmBtn');
  btn.disabled = true;
  btn.style.opacity = '0.4';
  var modal = document.getElementById('deleteConfirmModal');
  modal.style.display = 'flex';
  setTimeout(function(){ document.getElementById('dcmInput').focus(); }, 200);
}
function checkDcmInput() {
  var val = document.getElementById('dcmInput').value;
  var kw  = document.getElementById('dcmKeyword').textContent;
  var btn = document.getElementById('dcmConfirmBtn');
  var match = (val === kw);
  btn.disabled = !match;
  btn.style.opacity = match ? '1' : '0.4';
}
function closeDcmModal() {
  document.getElementById('deleteConfirmModal').style.display = 'none';
  _dcmCallback = null;
}
function executeDcm() {
  if (_dcmCallback) _dcmCallback();
  closeDcmModal();
}

function deleteSession(id) {
  if (!canDo('deleteSession')) {
    showToast('⚠️ 세션 삭제 권한이 없습니다');
    return;
  }
  var backup = sessionDB.find(function(s) { return s.id === id; });
  if (!backup) return;
  showDeleteConfirm(
    '세션 기록을 삭제하시겠습니까?',
    '삭제된 세션은 복구할 수 없습니다.\n' + (backup.date || '') + ' 세션 기록이 삭제됩니다.',
    '세션삭제확인',
    function() {
      supaFetch('madi_sessions?id=eq.' + id, 'DELETE');
      sessionDB = sessionDB.filter(function(s) { return s.id !== id; });
      saveSessions();
      renderSessionList();
      renderChildGrid();
      showToast('🗑️ 세션 삭제됨', {
        undo: function() {
          sessionDB.push(backup);
          saveSessions();
          var row = Object.assign({}, backup);
          supaFetch('madi_sessions', 'POST', [row]).catch(function(){});
          renderSessionList();
          renderChildGrid();
          showToast('↩️ 세션 복원됨');
        }
      });
    }
  );
}

// ─────── 차트 ───────
var devChartObj = null;
function renderChart() {
  var childId = parseInt(document.getElementById('chartChild').value);
  if (!childId) return;
  var child = childDB.find(function(c) { return c.id === childId; });
  var allSessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });

  // 다운샘플링: 50회 초과 시 평균치로 압축 (성능 + 가독성 향상)
  var sessions = allSessions;
  var isDownsampled = false;
  if (allSessions.length > 50) {
    isDownsampled = true;
    var bucketSize = Math.ceil(allSessions.length / 50);
    sessions = [];
    for (var bi = 0; bi < allSessions.length; bi += bucketSize) {
      var bucket = allSessions.slice(bi, bi + bucketSize);
      // 버킷 안에서 마지막 세션 기준으로 통합 (날짜는 마지막)
      var merged = { date: bucket[bucket.length - 1].date, goals: [] };
      // 목표별로 평균
      var goalSum = {};
      bucket.forEach(function(s) {
        (s.goals || []).forEach(function(g) {
          if (!g.name || g.score === null || g.score === undefined) return;
          if (!goalSum[g.name]) goalSum[g.name] = { sum: 0, count: 0 };
          goalSum[g.name].sum += parseFloat(g.score);
          goalSum[g.name].count++;
        });
      });
      Object.keys(goalSum).forEach(function(name) {
        merged.goals.push({ name: name, score: Math.round(goalSum[name].sum / goalSum[name].count) });
      });
      sessions.push(merged);
    }
  }

  document.getElementById('chartTitle').textContent = (child ? child.name : '') + ' 발달 추이'
    + (isDownsampled ? ' (' + allSessions.length + '회 → ' + sessions.length + '구간 평균)' : '');

  var goalMap = {};
  sessions.forEach(function(s) {
    (s.goals || []).forEach(function(g) {
      if (!g.name || g.score === null || g.score === undefined) return;
      if (!goalMap[g.name]) goalMap[g.name] = [];
      goalMap[g.name].push({ date: s.date, score: parseFloat(g.score) });
    });
  });

  var labels = sessions.map(function(s) { return s.date.slice(5); });
  var palette = ['#0ea5a0', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
  var datasets = [], gi = 0;
  for (var name in goalMap) {
    var sm = {};
    goalMap[name].forEach(function(p) { sm[p.date] = p.score; });
    datasets.push({
      label: name,
      data: sessions.map(function(s) { return sm[s.date] !== undefined ? sm[s.date] : null; }),
      borderColor: palette[gi % palette.length],
      backgroundColor: palette[gi % palette.length] + '20',
      tension: 0.35, fill: false, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2.5, spanGaps: true
    });
    gi++;
  }

  if (devChartObj) { devChartObj.destroy(); devChartObj = null; }
  var wrap = document.getElementById('chartCard').querySelector('.chart-wrap');
  if (datasets.length === 0 || labels.length < 2) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>세션 데이터가 2회 이상 있어야 차트가 표시됩니다.</p></div>';
  } else {
    wrap.innerHTML = '<canvas id="devChart"></canvas>';
    devChartObj = new Chart(document.getElementById('devChart').getContext('2d'), {
      type: 'line', data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12 } } },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: function(v) { return v + '%'; }, font: { size: 11 } }, grid: { color: '#f1f5f9' } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  }

  var bars = '';
  for (var n in goalMap) {
    var pts = goalMap[n];
    var last = pts[pts.length - 1].score;
    var color = last >= 70 ? '#10b981' : last >= 40 ? '#f59e0b' : '#ef4444';
    bars += '<div class="score-row"><div class="score-label">' + escHtml(n) + '</div>'
      + '<div class="score-bar"><div class="score-fill" style="width:' + last + '%;background:' + color + '"></div></div>'
      + '<div class="score-val" style="color:' + color + '">' + last + '%</div></div>';
  }
  document.getElementById('scoreBars').innerHTML = bars || '<div class="empty"><p>달성도 데이터가 없습니다.</p></div>';

  // 음소 추이 차트 연동
  _selectedPhonemes = null; // 아동 바뀌면 선택 초기화
  renderPhonemeChart(childId);
}

// ─────── 기능 3: 발달 정체 자동 감지 + W7 액션 제안 ───────
var phonemeChartObj = null;
var _phonemePos = 'all'; // 'all' | 'initial' | 'medial' | 'final'
var _selectedPhonemes = null; // null = 전체

function renderPhonemeChart(childId) {
  var card = document.getElementById('phonemeChartCard');
  if (!card) return;

  // 해당 아동 세션 중 음소 데이터 있는 것만
  var sessions = sessionDB
    .filter(function(s) { return s.childId === childId && s.phonemes && Object.keys(s.phonemes).length > 0; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); });

  if (sessions.length === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  // 전체 등장 음소 목록 (최신 세션 기준 정렬)
  var allPhonemes = [];
  sessions.forEach(function(s) {
    Object.keys(s.phonemes).forEach(function(p) {
      if (allPhonemes.indexOf(p) === -1) allPhonemes.push(p);
    });
  });
  if (_selectedPhonemes === null) _selectedPhonemes = allPhonemes.slice();

  // 필터 칩 렌더링
  var filterEl = document.getElementById('phonemeChartFilter');
  if (filterEl) {
    filterEl.innerHTML = allPhonemes.map(function(p) {
      var active = _selectedPhonemes.indexOf(p) > -1;
      return '<span onclick="togglePhonemeFilter(\'' + p + '\')" '
        + 'style="font-size:12px;padding:4px 10px;border-radius:20px;cursor:pointer;font-weight:700;'
        + 'background:' + (active ? '#db2777' : '#f1f5f9') + ';'
        + 'color:' + (active ? 'white' : '#94a3b8') + ';'
        + 'border:1.5px solid ' + (active ? '#db2777' : '#e2e8f0') + ';">' + p + '</span>';
    }).join('');
  }

  // 위치 버튼 상태
  ['All','Init','Med','Fin'].forEach(function(k) {
    var el = document.getElementById('pos' + k);
    if (!el) return;
    var isActive = (k === 'All' && _phonemePos === 'all')
      || (k === 'Init' && _phonemePos === 'initial')
      || (k === 'Med'  && _phonemePos === 'medial')
      || (k === 'Fin'  && _phonemePos === 'final');
    el.style.background = isActive ? '#db2777' : '';
    el.style.color      = isActive ? 'white' : '';
    el.style.borderColor = isActive ? '#db2777' : '';
  });

  // 데이터셋 구성
  var labels = sessions.map(function(s) { return s.date.slice(5); });
  var palette = ['#db2777','#0ea5a0','#8b5cf6','#f59e0b','#3b82f6','#10b981','#ef4444'];
  var posKeys = _phonemePos === 'all'
    ? ['initial','medial','final']
    : [_phonemePos];
  var posLabels = { initial:'어두', medial:'어중', final:'어말' };
  var datasets = [];
  var ci = 0;

  _selectedPhonemes.forEach(function(p) {
    posKeys.forEach(function(pos) {
      var data = sessions.map(function(s) {
        var d = s.phonemes[p];
        if (!d) return null;
        var v = d[pos];
        return (v !== null && v !== undefined && v !== '') ? v : null;
      });
      if (data.every(function(v){ return v === null; })) return;
      var col = palette[ci % palette.length];
      var label = posKeys.length > 1 ? p + ' ' + posLabels[pos] : p;
      datasets.push({
        label: label,
        data: data,
        borderColor: col,
        backgroundColor: col + '22',
        tension: 0.35, fill: false, pointRadius: 5,
        pointHoverRadius: 8, borderWidth: 2.5, spanGaps: true,
        borderDash: pos === 'medial' ? [4,3] : pos === 'final' ? [1,2] : []
      });
      ci++;
    });
  });

  // 차트 그리기
  if (phonemeChartObj) { phonemeChartObj.destroy(); phonemeChartObj = null; }
  var wrap = document.getElementById('phonemeChart');
  if (!wrap) return;

  if (datasets.length === 0) {
    wrap.parentNode.innerHTML = '<div class="empty" style="padding:16px;text-align:center;font-size:13px;color:var(--text2);">선택한 음소의 데이터가 없습니다.</div><canvas id="phonemeChart"></canvas>';
    return;
  }

  phonemeChartObj = new Chart(wrap, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11, family: 'Noto Sans KR' }, boxWidth: 14 } },
        tooltip: { callbacks: {
          label: function(ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y + '%' : '—'); }
        }}
      },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: function(v){ return v + '%'; }, font: { size: 11 } },
             grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { ticks: { font: { size: 11 } } }
      }
    }
  });

  // 최신 매트릭스 테이블 (가장 최근 세션 기준)
  renderPhonemeMatrixTable(sessions[sessions.length - 1], allPhonemes);
}

function renderPhonemeMatrixTable(session, allPhonemes) {
  var el = document.getElementById('phonemeMatrixTable');
  if (!el || !session.phonemes) return;

  var posLabels = ['어두','어중','어말'];
  var posKeys   = ['initial','medial','final'];

  var html = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px;">최근 세션(' + session.date + ') 음소 현황</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<tr style="border-bottom:2px solid var(--border);">'
    + '<th style="padding:6px 8px;text-align:left;color:var(--text2);font-weight:700;width:52px;">음소</th>'
    + posLabels.map(function(l){ return '<th style="padding:6px;text-align:center;color:var(--text2);font-weight:700;">' + l + '</th>'; }).join('')
    + '</tr>';

  allPhonemes.forEach(function(p) {
    var d = session.phonemes[p] || {};
    html += '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 8px;font-size:15px;font-weight:700;color:#db2777;">' + escHtml(p) + '</td>'
      + posKeys.map(function(pos) {
          var v = d[pos];
          var hasVal = v !== null && v !== undefined && v !== '';
          var n = hasVal ? parseInt(v) : null;
          var bg  = !hasVal ? '' : n >= 70 ? '#f0fdf4' : n >= 40 ? '#fffbeb' : '#fef2f2';
          var col = !hasVal ? 'var(--text2)' : n >= 70 ? '#15803d' : n >= 40 ? '#b45309' : '#dc2626';
          return '<td style="padding:7px 4px;text-align:center;background:' + bg + ';font-weight:700;color:' + col + ';">'
            + (hasVal ? n + '%' : '—') + '</td>';
        }).join('')
      + '</tr>';
  });

  html += '</table>';
  el.innerHTML = html;
}

function togglePhonemeFilter(phoneme) {
  if (!_selectedPhonemes) return;
  var idx = _selectedPhonemes.indexOf(phoneme);
  if (idx > -1) {
    if (_selectedPhonemes.length === 1) return; // 최소 1개
    _selectedPhonemes.splice(idx, 1);
  } else {
    _selectedPhonemes.push(phoneme);
  }
  var childId = parseInt(document.getElementById('chartChild').value);
  if (childId) renderPhonemeChart(childId);
}

function setPhonemePos(pos) {
  _phonemePos = pos;
  var childId = parseInt(document.getElementById('chartChild').value);
  if (childId) renderPhonemeChart(childId);
}

function detectStagnation() {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var childId = parseInt(document.getElementById('chartChild').value);
  if (!childId) { showToast('아동을 선택해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  var sessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; });

  if (sessions.length < 3) { showToast('최소 3회 세션이 필요합니다.'); return; }

  var resultEl = document.getElementById('stagnationResult');
  resultEl.innerHTML = '<div class="stagnation-card"><div class="stagnation-title">⏳ AI 분석 중...</div></div>';

  var sessionLog = sessions.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + ':' + (g.score !== null ? g.score : 'N/A'); }).join(', ');
    return s.date + ' [' + g + ']';
  }).join('\n');

  var NL = String.fromCharCode(10);
  var SYSTEM = '당신은 언어치료 데이터 분석 전문가입니다. 아동의 세션별 목표 달성도 추이를 분석해 정체된 목표를 찾아내고, '
    + '치료 전략 변경이 필요한지 판단하세요. 순수 JSON만 출력하세요:' + NL
    + '{"summary":"전반적 진행 상황 1-2문장","urgency":"low|medium|high",'
    + '"stagnations":[{"goal":"목표명","reason":"정체 판단 이유","suggestion":"새 접근법"}],'
    + '"strengths":["잘되고 있는 점들"],'
    + '"actions":[{"type":"iep|report|activity|schedule","label":"액션 제목(10자 이내)","detail":"치료사에게 구체적 지시 1문장"}]}' + NL
    + 'actions는 정체가 있을 때만 최대 3개, 없으면 빈 배열. urgency는 정체 심각도에 따라 설정.';
  var USER = '아동: ' + child.name + ' (' + child.age + ', ' + child.type + ')\n\n세션별 달성도:\n' + sessionLog;

  callClaude(apiKey, SYSTEM, USER, 1800, getAIModel())
    .then(function(raw) {
      var p = parseJSON(raw);
      renderStagnationResult(p, child.name, childId);
    })
    .catch(function(err) {
      resultEl.innerHTML = '<div class="stagnation-card"><div class="stagnation-text">⚠️ ' + escHtml(err.message || '오류') + '</div></div>';
    });
}

function renderStagnationResult(p, childName, childId) {
  var urgencyColor = p.urgency === 'high' ? '#dc2626' : p.urgency === 'medium' ? '#f59e0b' : '#10b981';
  var urgencyLabel = p.urgency === 'high' ? '🔴 즉시 전략 변경 필요' : p.urgency === 'medium' ? '🟡 주의 관찰 필요' : '🟢 양호';

  var html = '<div class="stagnation-card">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
    + '<div class="stagnation-title" style="margin-bottom:0;">📊 AI 정체 분석 결과</div>'
    + '<span style="font-size:11px;font-weight:700;color:' + urgencyColor + ';">' + urgencyLabel + '</span>'
    + '</div>'
    + '<div class="stagnation-text">' + escHtml(p.summary || '') + '</div>';

  if (p.stagnations && p.stagnations.length > 0) {
    html += '<div style="margin-top:10px;font-size:12px;font-weight:700;color:#dc2626;">⚠️ 정체 감지된 목표</div>';
    p.stagnations.forEach(function(s) {
      html += '<div style="margin-top:8px;padding:10px;background:white;border-radius:8px;">'
        + '<div style="font-weight:700;font-size:13px;">' + escHtml(s.goal) + '</div>'
        + '<div style="font-size:12px;color:var(--text2);margin-top:3px;">📍 ' + escHtml(s.reason) + '</div>'
        + '<div style="font-size:12px;color:var(--mint);margin-top:5px;font-weight:600;">💡 ' + escHtml(s.suggestion) + '</div>'
        + '</div>';
    });
  } else {
    html += '<div style="margin-top:10px;padding:10px;background:white;border-radius:8px;font-size:12px;color:var(--green);font-weight:600;">✅ 모든 목표가 정체 없이 진행 중입니다.</div>';
  }

  if (p.strengths && p.strengths.length > 0) {
    html += '<div style="margin-top:10px;font-size:12px;font-weight:700;color:var(--green);">✨ 강점</div>'
      + '<ul style="margin-top:4px;padding-left:18px;font-size:12px;line-height:1.7;">';
    p.strengths.forEach(function(s) { html += '<li>' + escHtml(s) + '</li>'; });
    html += '</ul>';
  }

  // W7 — 액션 카드
  if (p.actions && p.actions.length > 0) {
    html += '<div style="margin-top:14px;padding-top:12px;border-top:1.5px solid #fed7aa;">'
      + '<div style="font-size:12px;font-weight:700;color:#b45309;margin-bottom:10px;">⚡ 지금 할 수 있는 액션</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    p.actions.forEach(function(a) {
      var meta = stagnationActionMeta(a.type, childId);
      html += '<div style="flex:1;min-width:140px;background:white;border-radius:10px;padding:11px 12px;border:1.5px solid ' + meta.color + '20;">'
        + '<div style="font-size:16px;margin-bottom:4px;">' + meta.icon + '</div>'
        + '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:3px;">' + escHtml(a.label) + '</div>'
        + '<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:8px;">' + escHtml(a.detail) + '</div>'
        + '<button class="btn-ghost" style="width:100%;font-size:11px;padding:6px 4px;color:' + meta.color + ';border-color:' + meta.color + '40;" onclick="' + meta.onclick + '">' + meta.btnLabel + '</button>'
        + '</div>';
    });
    html += '</div></div>';
  }

  html += '</div>';
  document.getElementById('stagnationResult').innerHTML = html;
}

function stagnationActionMeta(type, childId) {
  var map = {
    iep:      { icon: '📋', color: '#8b5cf6', btnLabel: 'IEP 생성하기', onclick: 'switchTab(2);setTimeout(function(){switchReportTab("report");var el=document.getElementById("iepChild");if(el){el.value=' + childId + ';renderIEPHistory(' + childId + ');}},300);' },
    report:   { icon: '📨', color: '#0ea5a0', btnLabel: '리포트 작성', onclick: 'switchTab(2);setTimeout(function(){switchReportTab("report");var el=document.getElementById("reportChild");if(el)el.value=' + childId + ';},300);' },
    activity: { icon: '🎮', color: '#10b981', btnLabel: '활동 카탈로그', onclick: 'switchTab(3);setTimeout(function(){switchPortfolioTab("ai");},200);' },
    schedule: { icon: '📅', color: '#f59e0b', btnLabel: '일정 확인', onclick: 'switchTab(0);' }
  };
  return map[type] || map['activity'];
}

// ─────── 기능 4: 부모 보고서 ───────