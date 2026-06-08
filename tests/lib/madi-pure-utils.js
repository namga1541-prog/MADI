// ─────────────────────────────────────────────────────────────────
// tests/lib/madi-pure-utils.js
// madi-01.js 의 순수 유틸 함수를 Node.js / 브라우저 양쪽에서 사용할 수 있도록
// UMD 래퍼로 내보낸다.
//
// 주의: 이 파일의 함수 구현은 madi-01.js 에서 직접 복사한 것이다.
//       madi-01.js 를 수정할 경우 이 파일도 함께 갱신해야 한다.
// ─────────────────────────────────────────────────────────────────

(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    var utils = factory();
    Object.keys(utils).forEach(function(k) { root[k] = utils[k]; });
  }
})(typeof window !== 'undefined' ? window : global, function() {

  // ── escHtml (madi-01.js 실제 구현 복사) ──────────────────────────
  // ' 까지 escape — inline onclick='...' 안에 사용자 문자열이 들어가도 안전.
  // null/undefined 는 빈 문자열로 처리.
  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // ── KST 날짜 유틸 (madi-01.js 실제 구현 복사) ─────────────────────
  // 실행 환경 타임존과 무관하게 KST(UTC+9) 기준으로 동작한다.
  function toKST(d) {
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
  }

  function nowKST() {
    return toKST(new Date());
  }

  // Date 객체 → 'YYYY-MM-DD' 문자열
  function ymd(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getTodayKST() {
    return ymd(nowKST());
  }

  function getMonthKST() {
    return getTodayKST().slice(0, 7);
  }

  // 'YYYY-MM-DD' → 'YYYY년 M월 D일' (한국 표기)
  function fmtDateKR(s) {
    if (!s) return '';
    var p = s.split('-');
    if (!p || p.length < 3) return s;
    return p[0] + '년 ' + parseInt(p[1]) + '월 ' + parseInt(p[2]) + '일';
  }

  // ── restoreName (madi-core.js 실제 구현 복사) ────────────────────
  // AI 가명(○○) → 실명 복원. 실명에 따옴표/역슬래시 있으면 원문 유지(JSON 안전).
  // madi-core.js 수정 시 함께 갱신.
  function restoreName(text, realName) {
    if (!realName || text == null) return text;
    if (String(realName).indexOf('"') !== -1 || String(realName).indexOf('\\') !== -1) return text;
    return String(text).split('○○').join(realName);
  }

  // ── escJs / jsArg (madi-core.js 실제 구현 복사) ──────────────────
  // 인라인 핸들러 JS 인자용. madi-core.js 수정 시 함께 갱신.
  function escJs(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g,  "\\'")
      .replace(/"/g,  '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }
  function jsArg(str) { return escHtml(escJs(str)); }

  // ── formatAge (madi-01.js 에 없는 함수 — 이 파일에서 정의) ──────────
  // 개월 수(정수)를 'N세 M개월' 형식의 한국어 문자열로 변환한다.
  // 예: formatAge(26) → '2세 2개월'
  function formatAge(months) {
    if (months === null || months === undefined || isNaN(months)) return '';
    var m = parseInt(months, 10);
    if (m < 0) return '';
    var years = Math.floor(m / 12);
    var rem   = m % 12;
    if (years === 0) return rem + '개월';
    if (rem   === 0) return years + '세';
    return years + '세 ' + rem + '개월';
  }

  // ── interpolatePct (madi-assessment.js:203 실제 구현 복사) ─────────
  // 점수 → 백분위 보간. 규준표(table)를 인자로 받으므로 모듈 의존 없음.
  //   숫자(>=0)=추정 백분위, -1=최저행 '미만'(strictly <), null=산출불가.
  //   동점 run(같은 점수 행 2개+) → 백분위 중앙값. 상한 초과 → 최고 백분위.
  // madi-assessment.js 수정 시 함께 갱신.
  function interpolatePct(table, rawScore, colIdx) {
    if (rawScore < table[0][colIdx]) return -1;
    var run = [];
    for (var k = 0; k < table.length; k++) {
      if (table[k][colIdx] === rawScore) run.push(table[k][0]);
    }
    if (run.length >= 2) {
      run.sort(function(a, b) { return a - b; });
      var mid = Math.floor(run.length / 2);
      return (run.length % 2 === 1)
        ? run[mid]
        : Math.round((run[mid - 1] + run[mid]) / 2);
    }
    for (var i = 0; i < table.length - 1; i++) {
      var lo = table[i], hi = table[i+1];
      var loScore = lo[colIdx], hiScore = hi[colIdx];
      if (rawScore >= loScore && rawScore <= hiScore) {
        if (hiScore === loScore) return lo[0];
        var ratio = (rawScore - loScore) / (hiScore - loScore);
        return Math.round(lo[0] + ratio * (hi[0] - lo[0]));
      }
    }
    if (rawScore >= table[table.length-1][colIdx]) return table[table.length-1][0];
    return null;
  }

  // ── parseBirth (madi-schedule.js:9 실제 구현 복사) ────────────────
  // '20260230'(2월30일)·'20261301'(13월) 등 롤오버 → null. 정상 8자리 → Date.
  // madi-schedule.js 수정 시 함께 갱신.
  function parseBirth(val) {
    if (!val) return null;
    var s = val.replace(/-/g, '');
    if (s.length !== 8) return null;
    var y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
    var dt = new Date(y + '-' + m + '-' + d + 'T00:00:00');
    if (isNaN(dt.getTime())) return null;
    if (dt.getMonth() + 1 !== Number(m) || dt.getDate() !== Number(d)) return null;
    return dt;
  }

  // ── calcAgeFromBirth (madi-schedule.js:21 실제 구현 복사) ─────────
  // 생일 안 지났으면 월수 차감, 미래 생일 → ''(빈). new Date() 외 의존 없음.
  // madi-schedule.js 수정 시 함께 갱신.
  function calcAgeFromBirth(birthStr) {
    var birth = parseBirth(birthStr);
    if (!birth) return '';
    var today = new Date();
    if (birth > today) return '';
    var years  = today.getFullYear() - birth.getFullYear();
    var months = today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    if (years < 0) return '';
    return months === 0 ? years + '세' : years + '세 ' + months + '개월';
  }

  // ── weekDoneCount (madi-dashboard.js:143 매칭 알고리즘 추출) ──────
  // 세션 1건이 일정 1건만 소비하도록 매칭 — 같은 날 동일아동 2회 일정이
  //   세션 1건으로 둘 다 작성됨 처리되어 작성률이 과대평가되던 문제 방지.
  // 원본은 _doneConsumed 클로저 + _sessions 전역에 의존하므로,
  //   순수 로직(스케줄·세션 배열 → done 카운트)만 동형으로 추출.
  // madi-dashboard.js 매칭 규칙 변경 시 함께 갱신.
  function weekDoneCount(scheds, sessions) {
    var consumed = {};
    var done = 0;
    scheds.forEach(function(s) {
      for (var di = 0; di < sessions.length; di++) {
        var ss = sessions[di];
        if (consumed[di]) continue;
        if (ss.childId === s.childId && ss.date === s.date) { consumed[di] = true; done++; return; }
      }
    });
    return done;
  }

  return {
    escHtml:     escHtml,
    ymd:         ymd,
    toKST:       toKST,
    nowKST:      nowKST,
    getTodayKST: getTodayKST,
    getMonthKST: getMonthKST,
    fmtDateKR:   fmtDateKR,
    formatAge:   formatAge,
    restoreName: restoreName,
    escJs:       escJs,
    jsArg:       jsArg,
    interpolatePct:   interpolatePct,
    parseBirth:       parseBirth,
    calcAgeFromBirth: calcAgeFromBirth,
    weekDoneCount:    weekDoneCount
  };
});
