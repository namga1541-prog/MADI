function renderActivityCatalog() {
  var el = document.getElementById('activityCatalogList');
  if (!el) return;

  var keyword = ((document.getElementById('actSearchInput') || {}).value || '').trim().toLowerCase();
  var diagFilter = ((document.getElementById('actDiagFilter') || {}).value || '');

  var filtered = activityDB.filter(function(a) {
    var matchDiag = !diagFilter || a.diagnosis === diagFilter || a.diagnosis === '전체';
    var matchKw = !keyword
      || (a.name && a.name.toLowerCase().includes(keyword))
      || (a.tags && a.tags.toLowerCase().includes(keyword))
      || (a.tools && a.tools.toLowerCase().includes(keyword));
    return matchDiag && matchKw;
  });

  if (activityDB.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">아직 등록된 활동 자료가 없습니다.</div>';
    return;
  }
  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px;">검색 결과가 없습니다.</div>';
    return;
  }

  var html = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px;">' + filtered.length + '개 자료</div>';
  filtered.forEach(function(a) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc;border-radius:9px;margin-bottom:7px;gap:8px;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--text);">' + escHtml(a.name) + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;">'
      + (a.diagnosis ? '<span style="font-size:11px;padding:2px 7px;background:var(--mint2);color:var(--mint);border-radius:10px;font-weight:600;">' + escHtml(a.diagnosis) + '</span>' : '')
      + (a.duration ? '<span style="font-size:11px;padding:2px 7px;background:#f0f9ff;color:#0369a1;border-radius:10px;">⏱️' + a.duration + '분</span>' : '')
      + (a.tags ? a.tags.split(',').map(function(t){ return '<span style="font-size:11px;padding:2px 7px;background:#f1f5f9;color:#64748b;border-radius:10px;">#' + escHtml(t.trim()) + '</span>'; }).join('') : '')
      + '</div>'
      + (a.tools ? '<div style="font-size:11px;color:var(--text2);margin-top:3px;">🛠️ ' + escHtml(a.tools) + '</div>' : '')
      + '</div>'
      + '<button class="btn-del" onclick="deleteActivity(' + a.id + ')">삭제</button>'
      + '</div>';
  });
  el.innerHTML = html;
}

function openActivityModal() {
  var overlay = document.createElement('div');
  overlay.className = 'sched-modal-overlay';
  overlay.id = 'activityModal';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = '<div class="sched-modal">'
    + '<div class="sched-modal-title">🎮 활동 자료 등록</div>'
    + '<div class="form-group"><label class="form-label">자료명 *</label>'
    + '<input class="form-input" id="actName" placeholder="예: 그림 카드 어휘 확장 게임"></div>'
    + '<div class="form-group"><label class="form-label">대상 진단</label>'
    + '<select class="form-input" id="actDiagnosis">'
    + '<option value="전체">전체</option>'
    + ['언어발달장애','조음음운장애','유창성장애','자폐스펙트럼','지적장애','청각장애','기타'].map(function(t){
        return '<option value="'+t+'">'+t+'</option>';
      }).join('')
    + '</select></div>'
    + '<div class="form-row">'
    + '<div style="flex:1;"><label class="form-label">소요 시간(분)</label>'
    + '<input class="form-input" type="number" id="actDuration" placeholder="예: 10" min="1" max="60"></div>'
    + '<div style="flex:1.5;"><label class="form-label">사용 도구</label>'
    + '<input class="form-input" id="actTools" placeholder="예: 그림카드, 화이트보드"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">태그 (쉼표 구분)</label>'
    + '<input class="form-input" id="actTags" placeholder="예: 어휘, 구문, 초급"></div>'
    + '<div style="display:flex;gap:8px;margin-top:4px;">'
    + '<button class="btn btn-primary" style="flex:1;" onclick="saveActivity()">💾 등록</button>'
    + '<button class="btn-ghost" style="flex:0.4;" onclick="document.getElementById(\'activityModal\').remove()">취소</button>'
    + '</div></div>';

  document.body.appendChild(overlay);
}

function saveActivity() {
  var name = (document.getElementById('actName') || {}).value.trim();
  if (!name) { showToast('자료명을 입력해주세요.'); return; }
  var act = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: name,
    diagnosis: (document.getElementById('actDiagnosis') || {}).value || '전체',
    duration: parseInt((document.getElementById('actDuration') || {}).value) || null,
    tools: (document.getElementById('actTools') || {}).value.trim() || null,
    tags: (document.getElementById('actTags') || {}).value.trim() || null
  };
  activityDB.push(act);
  saveActivities();
  renderActivityCatalog();
  var modal = document.getElementById('activityModal');
  if (modal) modal.remove();
  showToast('✅ 활동 자료 등록 완료!');
}

function deleteActivity(id) {
  if (!confirm('이 활동 자료를 삭제할까요?')) return;
  activityDB = activityDB.filter(function(a) { return a.id !== id; });
  saveActivities();
  renderActivityCatalog();
  showToast('🗑️ 삭제됨');
}

// ─────── W6: 회기 후 자동 브리핑 모달 ───────
function showPostSessionBriefing(sessionId) {
  var session = sessionDB.find(function(s) { return s.id === sessionId; });
  if (!session) return;
  var child = childDB.find(function(c) { return c.id === session.childId; });
  if (!child) return;

  // 다음 예약 일정 찾기
  var today = new Date().toISOString().slice(0, 10);
  var nextSched = scheduleDB
    .filter(function(s) { return s.childId === child.id && s.date > today; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); })[0];

  // 부모 리포트 미작성 여부 (최근 4회 세션 중)
  var childSessions = sessionDB.filter(function(s) { return s.childId === child.id; });
  var unwrittenCount = childSessions.filter(function(s) { return !s.reportWritten; }).length;

  // 최근 달성도 요약
  var lastGoals = (session.goals || []).filter(function(g) { return g.score !== null; });
  var avgScore = lastGoals.length > 0
    ? Math.round(lastGoals.reduce(function(acc, g) { return acc + g.score; }, 0) / lastGoals.length)
    : null;

  // 기존 모달 제거
  var old = document.getElementById('postSessionModal');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'postSessionModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,41,66,0.55);z-index:3000;display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fadeIn 0.2s;';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  // 액션 카드 3개 구성
  var actions = [];

  // 카드 1: 부모 리포트
  var reportUrgency = unwrittenCount >= 4 ? '🔴' : unwrittenCount >= 2 ? '🟡' : '🟢';
  actions.push({
    icon: '📨',
    urgency: reportUrgency,
    title: '부모 리포트 작성',
    desc: unwrittenCount > 0 ? '미작성 세션 ' + unwrittenCount + '건' : '최신 상태 유지 중',
    btnText: '리포트 탭으로',
    onclick: 'closePostBriefing();switchTab(2);switchReportTab("report");'
  });

  // 카드 2: 다음 세션 일정
  actions.push({
    icon: '📅',
    urgency: nextSched ? '🟢' : '🟡',
    title: '다음 세션 일정',
    desc: nextSched ? nextSched.date + ' ' + (nextSched.startTime || '') : '예약 없음 — 일정 추가 필요',
    btnText: nextSched ? '스케줄 확인' : '일정 추가',
    onclick: 'closePostBriefing();switchTab(0);'
  });

  // 카드 3: 추이 차트
  actions.push({
    icon: '📊',
    urgency: avgScore !== null ? (avgScore >= 70 ? '🟢' : avgScore >= 40 ? '🟡' : '🔴') : '⚪',
    title: '발달 추이 확인',
    desc: avgScore !== null ? '오늘 평균 달성도 ' + avgScore + '%' : '달성도 미입력',
    btnText: '추이 차트 보기',
    onclick: 'closePostBriefing();switchTab(3);switchPortfolioTab("trend");'
  });

  var cardsHtml = actions.map(function(a) {
    return '<div style="flex:1;min-width:140px;background:#f8fafc;border-radius:12px;padding:12px;border:1px solid var(--border);">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'
      + '<span style="font-size:18px;">' + a.icon + '</span>'
      + '<span style="font-size:10px;">' + a.urgency + '</span>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:3px;">' + a.title + '</div>'
      + '<div style="font-size:11px;color:var(--text2);line-height:1.4;margin-bottom:8px;">' + escHtml(a.desc) + '</div>'
      + '<button class="btn-ghost" style="width:100%;font-size:11px;padding:6px 4px;" onclick="' + a.onclick + '">' + a.btnText + '</button>'
      + '</div>';
  }).join('');

  overlay.innerHTML = '<div style="width:100%;max-width:520px;background:white;border-radius:20px 20px 0 0;padding:20px 16px 28px;box-shadow:0 -4px 24px rgba(0,0,0,0.12);">'
    + '<div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:0 auto 16px;"></div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
    + '<div>'
    + '<div style="font-size:15px;font-weight:700;color:var(--navy);">✅ 세션 저장 완료</div>'
    + '<div style="font-size:12px;color:var(--text2);margin-top:2px;">' + escHtml(child.name) + ' · ' + session.date + '</div>'
    + '</div>'
    + '<button onclick="closePostBriefing()" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px;">✕</button>'
    + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;">📋 다음 액션</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + cardsHtml + '</div>'
    + '</div>';

  document.body.appendChild(overlay);

  // 5초 후 자동 닫기
  setTimeout(function() {
    var m = document.getElementById('postSessionModal');
    if (m) m.style.opacity = '0';
    setTimeout(function() {
      var m2 = document.getElementById('postSessionModal');
      if (m2) m2.remove();
    }, 300);
  }, 8000);
}

function closePostBriefing() {
  var m = document.getElementById('postSessionModal');
  if (m) m.remove();
}

// ─────── W7: 자동 배경 정체 체크 (규칙 기반, API 호출 없음) ───────
function checkAutoStagnation(childId) {
  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;

  // 설정값 읽기 (기본: 3회 연속, 40% 미만)
  var stagCount = parseInt(localStorage.getItem('madi_stag_count') || '3');
  var stagScore = parseInt(localStorage.getItem('madi_stag_score') || '40');

  var sessions = sessionDB
    .filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return b.date.localeCompare(a.date); })
    .slice(0, stagCount + 2); // 여유분 포함

  if (sessions.length < stagCount) return;

  // 목표별 최근 점수 수집
  var goalScores = {};
  sessions.forEach(function(s) {
    (s.goals || []).forEach(function(g) {
      if (!g.name || g.score === null || g.score === undefined) return;
      if (!goalScores[g.name]) goalScores[g.name] = [];
      goalScores[g.name].push(g.score);
    });
  });

  // N회 연속 X% 미만인 목표 탐색
  var stagnatedGoals = [];
  Object.keys(goalScores).forEach(function(name) {
    var scores = goalScores[name];
    if (scores.length < stagCount) return;
    var lastN = scores.slice(0, stagCount);
    if (lastN.every(function(s) { return s < stagScore; })) {
      stagnatedGoals.push({ name: name, avg: Math.round(lastN.reduce(function(a,b){return a+b;},0)/stagCount) });
    }
  });

  if (stagnatedGoals.length === 0) return;

  // 이미 같은 알림을 표시했으면 스킵 (세션당 1회)
  var alertKey = 'stag_' + childId + '_' + new Date().toISOString().slice(0,10);
  if (sessionStorage.getItem(alertKey)) return;
  sessionStorage.setItem(alertKey, '1');

  showStagnationAlert(child.name, stagnatedGoals, childId);
}

function showStagnationAlert(childName, stagnatedGoals, childId) {
  // 기존 알림 제거
  var old = document.getElementById('stagAlertCard');
  if (old) old.remove();

  var goalText = stagnatedGoals.map(function(g) {
    return escHtml(g.name) + ' (평균 ' + g.avg + '%)';
  }).join(', ');

  var card = document.createElement('div');
  card.id = 'stagAlertCard';
  card.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);width:calc(100% - 28px);max-width:500px;z-index:2600;animation:slideDown 0.3s;';
  card.innerHTML = '<div style="background:white;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.15);border-top:4px solid #f59e0b;padding:14px 16px;">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">'
    + '<div style="flex:1;">'
    + '<div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:4px;">⚠️ 정체 자동 감지 — ' + escHtml(childName) + '</div>'
    + '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:10px;">'
    + goalText + ' 3회 연속 정체 중입니다.'
    + '</div>'
    + '<div style="display:flex;gap:6px;">'
    + '<button class="btn-ghost" style="flex:1;font-size:12px;padding:7px 4px;color:#b45309;border-color:#fed7aa;" '
    + 'onclick="document.getElementById(\'stagAlertCard\').remove();switchTab(3);switchPortfolioTab(\'trend\');setTimeout(function(){var el=document.getElementById(\'chartChild\');if(el){el.value=' + childId + ';renderChart();}},200);">'
    + '📊 추이 차트 보기</button>'
    + '<button class="btn-ghost" style="flex:1;font-size:12px;padding:7px 4px;color:#8b5cf6;border-color:#ddd6fe;" '
    + 'onclick="document.getElementById(\'stagAlertCard\').remove();switchTab(3);switchPortfolioTab(\'trend\');setTimeout(function(){var el=document.getElementById(\'chartChild\');if(el){el.value=' + childId + ';renderChart();detectStagnation();}},200);">'
    + '🔍 정체 분석 실행</button>'
    + '</div>'
    + '</div>'
    + '<button onclick="document.getElementById(\'stagAlertCard\').remove()" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;padding:2px;flex-shrink:0;">✕</button>'
    + '</div></div>';

  document.body.appendChild(card);

  // 15초 후 자동 제거
  setTimeout(function() {
    var c = document.getElementById('stagAlertCard');
    if (c) c.remove();
  }, 15000);
}

// ─────── W6: 회기 전 브리핑 카드 ───────
var _preBriefingShownKey = '';
function checkUpcomingSessionBriefing() {
  var now = new Date();
  var today = now.toISOString().slice(0, 10);
  var nowMin = now.getHours() * 60 + now.getMinutes();

  // 오늘 일정 중 5~30분 이내 시작하는 세션 탐색
  var upcoming = scheduleDB.filter(function(s) {
    if (s.date !== today || !s.startTime) return false;
    var parts = s.startTime.split(':');
    if (parts.length < 2) return false;
    var schedMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    var diff = schedMin - nowMin;
    return diff >= 0 && diff <= 30;
  });

  if (upcoming.length === 0) return;

  // 이미 표시한 세션은 건너뜀 (새로고침 내 중복 방지)
  var shownKey = upcoming.map(function(s){ return s.id; }).join(',');
  if (_preBriefingShownKey === shownKey) return;
  _preBriefingShownKey = shownKey;

  // 첫 번째 세션만 브리핑
  var sched = upcoming[0];
  var child = childDB.find(function(c) { return c.id === sched.childId; });
  if (!child) return;

  // 최근 세션 메모 (최근 1회)
  var recentSessions = sessionDB
    .filter(function(s) { return s.childId === child.id; })
    .sort(function(a, b) { return b.date.localeCompare(a.date); });
  var lastSession = recentSessions[0];

  // 부모 알림 여부 (미작성 리포트)
  var unwritten = recentSessions.filter(function(s){ return !s.reportWritten; }).length;

  var parts = sched.startTime.split(':');
  var schedMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  var diff = schedMin - (now.getHours() * 60 + now.getMinutes());

  // 기존 회기 전 카드 제거
  var old = document.getElementById('preSessionBriefingCard');
  if (old) old.remove();

  var card = document.createElement('div');
  card.id = 'preSessionBriefingCard';
  card.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);width:calc(100% - 28px);max-width:500px;z-index:2500;animation:slideDown 0.3s;';

  var lastGoalHtml = '';
  if (lastSession && lastSession.goals && lastSession.goals.length > 0) {
    var validGoals = lastSession.goals.filter(function(g){ return g.name && g.score !== null; });
    if (validGoals.length > 0) {
      lastGoalHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">'
        + validGoals.slice(0, 3).map(function(g) {
            var c = g.score >= 70 ? '#10b981' : g.score >= 40 ? '#f59e0b' : '#ef4444';
            return '<span style="font-size:11px;padding:2px 8px;background:#f8fafc;border-radius:10px;border-left:3px solid '+c+';">'
              + escHtml(g.name) + ' <b>' + g.score + '%</b></span>';
          }).join('')
        + '</div>';
    }
  }

  card.innerHTML = '<div style="background:white;border-radius:14px;box-shadow:0 4px 20px rgba(15,41,66,0.18);border-top:4px solid var(--mint);padding:14px 16px;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
    + '<div style="display:flex;align-items:center;gap:8px;">'
    + '<div style="width:36px;height:36px;border-radius:50%;background:var(--mint2);display:flex;align-items:center;justify-content:center;font-size:18px;">🔔</div>'
    + '<div>'
    + '<div style="font-size:13px;font-weight:700;color:var(--navy);">' + diff + '분 후 세션 시작</div>'
    + '<div style="font-size:12px;color:var(--mint);font-weight:600;">' + escHtml(child.name) + ' · ' + sched.startTime + (sched.teacher ? ' · ' + sched.teacher : '') + '</div>'
    + '</div></div>'
    + '<button onclick="document.getElementById(\'preSessionBriefingCard\').remove()" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;padding:4px;">✕</button>'
    + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;">'
    + '<div style="flex:1;min-width:140px;padding:8px;background:#f0fdf4;border-radius:9px;">'
    + '<div style="font-weight:700;color:var(--green);margin-bottom:3px;">📈 지난 세션 진전</div>'
    + (lastSession
        ? '<div style="color:var(--text2);">' + escHtml(lastSession.date) + '</div>' + lastGoalHtml
        : '<div style="color:var(--text2);">기록 없음</div>')
    + '</div>'
    + '<div style="flex:1;min-width:140px;padding:8px;background:#fefce8;border-radius:9px;">'
    + '<div style="font-weight:700;color:#ca8a04;margin-bottom:3px;">📝 지난 메모</div>'
    + '<div style="color:var(--text2);line-height:1.5;font-size:11px;">'
    + (lastSession && lastSession.memo ? escHtml(lastSession.memo.slice(0, 60)) + (lastSession.memo.length > 60 ? '...' : '') : '메모 없음')
    + '</div></div>'
    + '</div>'
    + (unwritten > 0
        ? '<div style="margin-top:8px;padding:7px 10px;background:#fef2f2;border-radius:8px;font-size:11px;color:#dc2626;">⚠️ 부모 리포트 미작성 ' + unwritten + '건</div>'
        : '')
    + '</div>';

  document.body.appendChild(card);

  // 10분 후 자동 제거
  setTimeout(function() {
    var c = document.getElementById('preSessionBriefingCard');
    if (c) c.remove();
  }, 10 * 60 * 1000);
}

// ─────── Word(.doc) 다운로드 → 한글에서 열어 HWP 저장 ───────
function downloadWordDoc(name) {
  var el = document.getElementById('assessReportText');
  if (!el) { showToast('먼저 보고서를 생성해주세요.'); return; }
  var content    = el.textContent || el.innerText || '';
  var today      = new Date().toLocaleDateString('ko-KR');

  var wordHtml = '<!DOCTYPE html>\n'
    + '<html xmlns:o="urn:schemas-microsoft-com:office:office"\n'
    + '      xmlns:w="urn:schemas-microsoft-com:office:word"\n'
    + '      xmlns="http://www.w3.org/TR/REC-html40">\n'
    + '<head><meta charset="UTF-8">\n'
    + '<style>\n'
    + '@page { size:A4; margin:2.54cm; }\n'
    + 'body { font-family:"나눔고딕","맑은 고딕","Malgun Gothic",sans-serif; font-size:10pt; line-height:1.8; color:#1e293b; }\n'
    + 'h1 { font-size:16pt; font-weight:bold; text-align:center; color:#0f2942; margin:0 0 6pt; }\n'
    + 'h2 { font-size:12pt; font-weight:bold; color:#0f2942; margin:14pt 0 4pt; border-bottom:1.5pt solid #0ea5a0; padding-bottom:3pt; }\n'
    + 'p { margin:2pt 0; font-size:10pt; line-height:1.8; }\n'
    + 'table { width:100%; border-collapse:collapse; margin:8pt 0; font-size:10pt; }\n'
    + 'th { background-color:#e0f7f6; font-weight:bold; text-align:center; border:0.75pt solid #94a3b8; padding:5pt 8pt; }\n'
    + 'td { border:0.75pt solid #cbd5e1; padding:5pt 8pt; }\n'
    + '</style></head><body>\n'
    + '<div style="text-align:center;margin-bottom:16pt;border-bottom:2pt double #0f2942;padding-bottom:8pt;">\n'
    + (institution ? '<p style="font-size:10pt;color:#64748b;margin-bottom:4pt;">' + escHtml(institution) + '</p>\n' : '')
    + '<h1>말 &middot; 언어 평가보고서</h1>\n'
    + '<table style="border:none;margin:6pt 0 0;font-size:10pt;"><tr>\n'
    + '<td style="border:none;padding:2pt 8pt;">이름: <b>' + escHtml(name) + '</b></td>\n'
    + '<td style="border:none;padding:2pt 8pt;">평가일: <b>' + escHtml(assessDate) + '</b></td>\n'
    + (evaluator ? '<td style="border:none;padding:2pt 8pt;">평가자: <b>' + escHtml(evaluator) + '</b></td>\n' : '')
    + '</tr></table>\n</div>\n'
    + bodyHtml
    + '\n<p style="margin-top:24pt;text-align:right;font-size:9pt;color:#94a3b8;border-top:0.75pt solid #e2e8f0;padding-top:6pt;">'
    + '마디(Madi) AI 보조 작성 | 출력일: ' + today + '</p>\n'
    + '</body></html>';

  var blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = '평가보고서_' + name + '_' + assessDate.replace(/-/g, '') + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  showToast('📝 Word 파일 저장 완료! 한글(HWP)에서 열면 편집·저장 가능합니다.');
}

// ─────── 기능 5: 월간 포트폴리오 ───────
function generatePortfolio() {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var childId = parseInt(document.getElementById('portfolioChild').value);
  var month = document.getElementById('portfolioMonth').value;
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!month) { showToast('대상 월을 선택해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;

  var sessions = sessionDB.filter(function(s) {
    return s.childId === childId && s.date.slice(0, 7) === month;
  }).sort(function(a, b) { return a.date < b.date ? -1 : 1; });

  if (sessions.length === 0) { showToast('해당 월에 기록된 세션이 없습니다.'); return; }

  var btn = document.getElementById('portfolioBtn');
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 포트폴리오 생성 중...';

  var resultEl = document.getElementById('portfolioResult');
  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div>'
    + '<p>한 달간의 모든 세션을 AI가 분석하여<br>포트폴리오를 생성 중입니다 (20-30초)</p></div>';

  // 통계 계산
  var goalProgress = {};
  sessions.forEach(function(s) {
    (s.goals || []).forEach(function(g) {
      if (!g.name || g.score === null || g.score === undefined) return;
      if (!goalProgress[g.name]) goalProgress[g.name] = [];
      goalProgress[g.name].push({ date: s.date, score: parseFloat(g.score) });
    });
  });

  var sessionLog = sessions.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + ':' + (g.score !== null ? g.score + '%' : 'N/A'); }).join(', ');
    return s.date + ' | ' + g + ' | ' + (s.memo || '');
  }).join('\n');

  var SYSTEM = '당신은 한국의 베테랑 언어재활사로서 월간 치료 포트폴리오를 작성하는 전문가입니다. '
    + '한 달간의 모든 세션 데이터를 종합 분석하여 부모가 읽기 쉬운 포트폴리오를 작성하세요. '
    + '부모 면담, 분기 보고, 바우처 평가서로 활용 가능한 수준이어야 합니다. '
    + '【언어 규칙】부모(주 양육자)가 직접 읽는 자료입니다. '
    + '금지: "통합적 발달을 모색","정체를 타개","도모하다","강화하겠습니다" 등 어려운 한자어 절대 금지. '
    + '권장: "이번 달 아이가 ~을 해냈어요","~하는 모습이 부쩍 늘었어요","집에서 이렇게 도와주시면 더 빨리 늘어요" 등. '
    + '반드시 순수 JSON만 응답: '
    + '{"overview":"이번 달 종합 평가 (3-4문장, 핵심 메시지)",'
    + '"keyAchievements":["주요 성취 3-5개"],'
    + '"goalAnalysis":[{"goal":"목표명","trend":"향상/유지/저하","analysis":"이 목표에 대한 상세 분석 2-3문장"}],'
    + '"sessionHighlights":["인상적인 세션 순간 2-3개"],'
    + '"parentMessage":"부모님께 전하고 싶은 따뜻한 메시지 2-3문장",'
    + '"nextMonthPlan":"다음 달 치료 방향 제안 3-4문장",'
    + '"professionalNote":"치료사 본인을 위한 전문 메모 (다음 달 슈퍼비전·임상 노트용)"}';

  var USER = '아동: ' + child.name + ' (' + child.age + ', ' + child.type + ')\n'
    + '치료 목표: ' + (child.goals.join(', ') || '없음') + '\n'
    + '대상 월: ' + month + '\n'
    + '세션 수: ' + sessions.length + '회\n\n'
    + '세션 상세 기록:\n' + sessionLog;

  callClaude(apiKey, SYSTEM, USER, 3000, getAIModel())
    .then(function(raw) {
      var p = parseJSON(raw);
      renderPortfolio(p, child, month, sessions, goalProgress);
    })
    .catch(function(err) {
      resultEl.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:16px;border-left:5px solid #ef4444;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(err.message || '오류') + '</p></div>';
    })
    .finally(function() {
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '📁 포트폴리오 생성';
    });
}

function renderPortfolio(p, child, month, sessions, goalProgress) {
  // 통계 박스
  var statsHtml = '<div class="portfolio-section">'
    + '<div class="portfolio-section-title">📊 ' + month + ' 월간 통계</div>'
    + '<div class="portfolio-stat"><span class="portfolio-stat-label">아동</span><span class="portfolio-stat-value">' + escHtml(child.name) + ' (' + escHtml(child.age) + ')</span></div>'
    + '<div class="portfolio-stat"><span class="portfolio-stat-label">장애 유형</span><span class="portfolio-stat-value">' + escHtml(child.type) + '</span></div>'
    + '<div class="portfolio-stat"><span class="portfolio-stat-label">총 세션 수</span><span class="portfolio-stat-value">' + sessions.length + '회</span></div>';
  for (var gn in goalProgress) {
    var pts = goalProgress[gn];
    if (!pts || pts.length === 0) continue;
    var first = pts[0].score, last = pts[pts.length - 1].score;
    var diff = last - first;
    var arrow = diff > 0 ? '<span style="color:var(--green)">▲ +' + diff.toFixed(0) + '%</span>'
      : diff < 0 ? '<span style="color:var(--red)">▼ ' + diff.toFixed(0) + '%</span>'
      : '<span style="color:var(--text2)">─</span>';
    statsHtml += '<div class="portfolio-stat"><span class="portfolio-stat-label">' + escHtml(gn) + '</span><span class="portfolio-stat-value">' + first + '% → ' + last + '% ' + arrow + '</span></div>';
  }
  statsHtml += '</div>';

  // AI 분석 섹션들
  var html = statsHtml;

  if (p.overview) {
    html += '<div class="portfolio-section"><div class="portfolio-section-title">📝 종합 평가</div>'
      + '<div style="font-size:13px;line-height:1.8;">' + escHtml(p.overview) + '</div></div>';
  }

  if (p.keyAchievements && p.keyAchievements.length > 0) {
    html += '<div class="portfolio-section"><div class="portfolio-section-title">🌟 주요 성취</div><ul style="padding-left:20px;font-size:13px;line-height:1.8;">';
    p.keyAchievements.forEach(function(a) { html += '<li>' + escHtml(a) + '</li>'; });
    html += '</ul></div>';
  }

  if (p.goalAnalysis && p.goalAnalysis.length > 0) {
    html += '<div class="portfolio-section"><div class="portfolio-section-title">🎯 목표별 상세 분석</div>';
    p.goalAnalysis.forEach(function(g) {
      var ti = g.trend === '향상' ? '📈' : g.trend === '저하' ? '📉' : '➡️';
      var tc = g.trend === '향상' ? 'var(--green)' : g.trend === '저하' ? 'var(--red)' : 'var(--text2)';
      html += '<div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:8px;">'
        + '<div style="font-weight:700;font-size:13px;">' + ti + ' ' + escHtml(g.goal)
        + ' <span style="color:' + tc + ';font-weight:600;font-size:11px;margin-left:6px;">' + escHtml(g.trend) + '</span></div>'
        + '<div style="font-size:12px;line-height:1.7;color:var(--text);margin-top:5px;">' + escHtml(g.analysis) + '</div></div>';
    });
    html += '</div>';
  }

  if (p.sessionHighlights && p.sessionHighlights.length > 0) {
    html += '<div class="portfolio-section"><div class="portfolio-section-title">✨ 인상적인 순간</div><ul style="padding-left:20px;font-size:13px;line-height:1.8;">';
    p.sessionHighlights.forEach(function(h) { html += '<li>' + escHtml(h) + '</li>'; });
    html += '</ul></div>';
  }

  if (p.parentMessage) {
    html += '<div class="portfolio-section" style="background:linear-gradient(135deg,#fef3c7,#fde68a);">'
      + '<div class="portfolio-section-title" style="color:#b45309;border-bottom-color:#fcd34d;">💛 부모님께 전하는 메시지</div>'
      + '<div style="font-size:13px;line-height:1.8;">' + escHtml(p.parentMessage) + '</div></div>';
  }

  if (p.nextMonthPlan) {
    html += '<div class="portfolio-section"><div class="portfolio-section-title">🗓️ 다음 달 치료 방향</div>'
      + '<div style="font-size:13px;line-height:1.8;">' + escHtml(p.nextMonthPlan) + '</div></div>';
  }

  if (p.professionalNote) {
    html += '<div class="portfolio-section" style="background:#1e293b;color:white;">'
      + '<div class="portfolio-section-title" style="color:#5eead4;border-bottom-color:#0ea5a0;">🔬 치료사 전문 메모</div>'
      + '<div style="font-size:13px;line-height:1.8;color:#cbd5e1;">' + escHtml(p.professionalNote) + '</div></div>';
  }

  // PDF 다운로드용 숨김 텍스트
  var fullText = '';
  if (p.overview) fullText += '【종합 평가】\n' + p.overview + '\n\n';
  if (p.keyAchievements) fullText += '【주요 성취】\n' + p.keyAchievements.map(function(a) { return '• ' + a; }).join('\n') + '\n\n';
  if (p.goalAnalysis) fullText += '【목표별 분석】\n' + p.goalAnalysis.map(function(g) { return '• ' + g.goal + ' (' + g.trend + ')\n  ' + g.analysis; }).join('\n\n') + '\n\n';
  if (p.sessionHighlights) fullText += '【인상적인 순간】\n' + p.sessionHighlights.map(function(h) { return '• ' + h; }).join('\n') + '\n\n';
  if (p.parentMessage) fullText += '【부모님께】\n' + p.parentMessage + '\n\n';
  if (p.nextMonthPlan) fullText += '【다음 달 계획】\n' + p.nextMonthPlan + '\n\n';
  if (p.professionalNote) fullText += '【전문 메모】\n' + p.professionalNote;

  html += '<div style="display:none;" id="portfolioFullText">' + escHtml(fullText) + '</div>';
  html += '<button class="pdf-btn" onclick="downloadPDF(\'' + escHtml(child.name) + '_' + month + '\',\'portfolioFullText\',\'' + escHtml(child.name) + ' 월간 포트폴리오 (' + month + ')\')">⬇️ 포트폴리오 PDF 다운로드</button>';

  document.getElementById('portfolioResult').innerHTML = html;
}

// ─────── 기능 6: 자연어 검색 ───────
function naturalSearch() {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var query = document.getElementById('searchQuery').value.trim();
  if (!query) { showToast('질문을 입력해주세요.'); return; }
  if (sessionDB.length === 0) { showToast('세션 기록이 없습니다.'); return; }

  var btn = document.getElementById('searchBtn');
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 검색 중...';

  var resultEl = document.getElementById('searchResult');
  resultEl.innerHTML = '<div class="ai-response-box"><div class="ai-response-label">⏳ AI가 데이터를 분석 중...</div></div>';

  var allData = childDB.map(function(c) {
    var ss = sessionDB.filter(function(s) { return s.childId === c.id; })
      .sort(function(a, b) { return a.date < b.date ? -1 : 1; });
    var ssText = ss.map(function(s) {
      var g = (s.goals || []).map(function(g) { return g.name + ':' + (g.score !== null ? g.score + '%' : 'N/A'); }).join(', ');
      return s.date + ' [' + g + '] ' + (s.memo || '');
    }).join('\n');
    return '◆ ' + c.name + ' (' + c.age + ', ' + c.type + ')\n' + ssText;
  }).join('\n\n');

  var SYSTEM = '당신은 언어치료 데이터 분석 어시스턴트입니다. 치료사가 자연어로 묻는 질문에 정확한 데이터 기반 답변을 제공하세요. '
    + '날짜, 수치 등 구체적인 정보를 포함하세요. 200자 내외의 친근한 한국어로 답변하세요. JSON 없이 일반 텍스트로 답변.';
  var USER = '치료 데이터:\n' + allData + '\n\n질문: ' + query;

  callClaude(apiKey, SYSTEM, USER, 800, getAIModel())
    .then(function(raw) {
      resultEl.innerHTML = '<div class="ai-response-box">'
        + '<div class="ai-response-label">🤖 AI 답변</div>'
        + '<div class="ai-response-text">' + escHtml(raw) + '</div></div>';
    })
    .catch(function(err) {
      resultEl.innerHTML = '<div class="ai-response-box"><div class="ai-response-label">⚠️ ' + escHtml(err.message || '오류') + '</div></div>';
    })
    .finally(function() {
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '🔍 AI에게 물어보기';
    });
}

// ─────── 기능 7: 부모 FAQ 답변 ───────
function generateFAQ() {
  var apiKey = getApiKeyOrAlert();
  if (!apiKey) return;
  var childId = parseInt(document.getElementById('faqChild').value);
  var question = document.getElementById('faqQuestion').value.trim();
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  if (!question) { showToast('부모 질문을 입력해주세요.'); return; }

  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;
  var sessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; }).slice(-8);

  var btn = document.getElementById('faqBtn');
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';

  var resultEl = document.getElementById('faqResult');
  resultEl.innerHTML = '<div class="ai-response-box"><div class="ai-response-label">⏳ 답변 예시 작성 중...</div></div>';

  var summary = sessions.map(function(s) {
    var g = (s.goals || []).map(function(g) { return g.name + ':' + (g.score !== null ? g.score + '%' : 'N/A'); }).join(', ');
    return s.date + ' [' + g + '] ' + (s.memo || '');
  }).join('\n');

  var SYSTEM = '당신은 한국의 베테랑 언어재활사입니다. 부모가 묻는 까다로운 질문에 대해, '
    + '치료사가 그대로 사용하거나 참고할 수 있는 따뜻하고 전문적인 답변 예시를 작성하세요. '
    + '실제 치료 데이터를 근거로 활용하세요. 존댓말, 부모 마음을 헤아리는 톤. 300자 내외. JSON 없이 일반 텍스트.';
  var USER = '아동: ' + child.name + ' (' + child.age + ', ' + child.type + ')\n'
    + '최근 세션:\n' + (summary || '없음') + '\n\n부모 질문: "' + question + '"';

  callClaude(apiKey, SYSTEM, USER, 1000, getAIModel())
    .then(function(raw) {
      resultEl.innerHTML = '<div class="ai-response-box">'
        + '<div class="ai-response-label">💬 AI 답변 예시 (참고용, 그대로 또는 수정 후 사용)</div>'
        + '<div class="ai-response-text">' + escHtml(raw) + '</div>'
        + '<button class="btn-ghost" style="margin-top:10px;width:100%;" onclick="copyFAQText(this)">📋 답변 복사</button>'
        + '</div>';
    })
    .catch(function(err) {
      resultEl.innerHTML = '<div class="ai-response-box"><div class="ai-response-label">⚠️ ' + escHtml(err.message || '오류') + '</div></div>';
    })
    .finally(function() {
      btn.dataset.busy = '';
      btn.disabled = false;
      btn.textContent = '💬 답변 예시 생성';
    });
}

function copyFAQText(btn) {
  var box = btn.parentElement.querySelector('.ai-response-text');
  if (!box) return;
  var text = box.textContent;
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

// ─────── 유틸 ───────