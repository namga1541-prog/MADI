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

  return {
    escHtml:     escHtml,
    ymd:         ymd,
    toKST:       toKST,
    nowKST:      nowKST,
    getTodayKST: getTodayKST,
    getMonthKST: getMonthKST,
    fmtDateKR:   fmtDateKR,
    formatAge:   formatAge
  };
});
