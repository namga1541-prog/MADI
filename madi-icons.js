// madi-icons.js — 경량 SVG 아이콘 sprite (Lucide 기반)
// 디자인 진단 D1 후속 (2026-05-24)
//
// 사용:
//   <span data-icon="home"></span>      ← HTML 어디서나
//   mdIcon('home', 20)                 ← JS 에서 문자열로
//
// 의료 SaaS 신뢰도 ↑ — 이모지(🏠 📅 👤) 대비 OS 무관 일관성·다크모드 호환.
// 모든 path 는 Lucide(MIT) 또는 자체 디자인 — currentColor 상속, stroke 1.6~2.

(function(global) {
  // 24x24 viewBox, stroke 기반 (currentColor 상속)
  var ICONS = {
    home:       '<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z"/>',
    calendar:   '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
    user:       '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    users:      '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3 3-5 7-5s7 2 7 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 6 1.5 6 4"/>',
    chart:      '<path d="M3 3v18h18"/><path d="M7 15l4-4 4 3 5-6"/>',
    'more-h':   '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    'more-v':   '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    folder:     '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    clipboard:  '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell:       '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    edit:       '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    check:      '<polyline points="20 6 9 17 4 12"/>',
    x:          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'alert-tri':'<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>',
    lock:       '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'lock-open':'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    key:        '<circle cx="8" cy="15" r="4"/><line x1="10.85" y1="12.15" x2="21" y2="2"/><line x1="18" y1="5" x2="21" y2="8"/><line x1="15" y1="8" x2="17.5" y2="10.5"/>',
    shield:     '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'shield-check':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    mic:        '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/>',
    sparkles:   '<path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><path d="M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" stroke-width="1.5"/>',
    save:       '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    trash:      '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    search:     '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    info:       '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/>',
    'check-circle':'<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>',
    refresh:    '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10"/>',
    camera:     '<path d="M3 7h4l2-3h6l2 3h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    'image':    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    message:    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    mail:       '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
    moon:       '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun:        '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
    menu:       '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    'chevron-down':'<polyline points="6 9 12 15 18 9"/>',
    'chevron-up':'<polyline points="18 15 12 9 6 15"/>',
    'chevron-right':'<polyline points="9 18 15 12 9 6"/>',
    'chevron-left':'<polyline points="15 18 9 12 15 6"/>',
    star:       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21 12 17.77 5.82 21 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    zap:        '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    target:     '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    book:       '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    eye:        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    wrench:     '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    sliders:    '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><circle cx="12" cy="4" r="1.6"/><circle cx="10" cy="12" r="1.6"/><circle cx="14" cy="20" r="1.6"/>'
  };

  function mdIcon(name, size, opts) {
    opts = opts || {};
    var body = ICONS[name];
    if (!body) return '';
    var sz = size || 20;
    var sw = opts.stroke || 1.8;
    var cls = opts.className ? ' class="' + String(opts.className).replace(/"/g, '') + '"' : '';
    var style = opts.style ? ' style="' + String(opts.style).replace(/"/g, '') + '"' : '';
    return '<svg' + cls + style + ' width="' + sz + '" height="' + sz + '"'
      + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw
      + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + body + '</svg>';
  }

  // 자동 마운트: <span data-icon="home"></span> 같은 요소를 SVG 로 치환
  function _mountIcons(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.iconMounted === '1') continue;
      var name = el.getAttribute('data-icon');
      var size = parseInt(el.getAttribute('data-icon-size') || '20', 10);
      var stroke = parseFloat(el.getAttribute('data-icon-stroke') || '1.8');
      // eslint-disable-next-line no-unsanitized/property
      el.innerHTML = mdIcon(name, size, { stroke: stroke });
      el.dataset.iconMounted = '1';
    }
  }

  function _autoMount() { _mountIcons(document); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoMount);
  } else {
    setTimeout(_autoMount, 0);
  }

  // ─── 빈 상태 일러스트 (D5) ─────────────────────────────────────
  // 부드럽고 차분한 라인 일러스트. 의료 SaaS 톤에 맞춤.
  var ILLUSTS = {
    // 텅 빈 폴더 — 아동/세션/포트폴리오 없음
    'no-data':
      '<svg viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<rect x="30" y="40" width="140" height="100" rx="10" opacity="0.4"/>'
      + '<path d="M30 60h140" opacity="0.3"/>'
      + '<circle cx="100" cy="100" r="20" opacity="0.6"/>'
      + '<path d="M91 100l6 6 12-12" opacity="0.6"/>'
      + '<path d="M55 30l8 10M145 30l-8 10" opacity="0.4"/>'
      + '</svg>',
    // 비어있는 캘린더 — 일정 없음
    'no-schedule':
      '<svg viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<rect x="30" y="35" width="140" height="110" rx="10" opacity="0.5"/>'
      + '<line x1="30" y1="60" x2="170" y2="60"/>'
      + '<line x1="60" y1="30" x2="60" y2="45"/>'
      + '<line x1="100" y1="30" x2="100" y2="45"/>'
      + '<line x1="140" y1="30" x2="140" y2="45"/>'
      + '<circle cx="100" cy="100" r="22" opacity="0.4"/>'
      + '<path d="M100 90v12l8 4" opacity="0.6"/>'
      + '</svg>',
    // 알림 종 — 새 알림 없음
    'no-notice':
      '<svg viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M70 65a30 30 0 0 1 60 0c0 35 15 45 15 45H55s15-10 15-45z" opacity="0.5"/>'
      + '<path d="M90 120a10 10 0 0 0 20 0" opacity="0.7"/>'
      + '<circle cx="100" cy="50" r="4" opacity="0.4"/>'
      + '<path d="M60 40l-10-5M140 40l10-5" opacity="0.3"/>'
      + '</svg>',
    // 검색 결과 없음
    'no-search':
      '<svg viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<circle cx="85" cy="75" r="38" opacity="0.5"/>'
      + '<line x1="113" y1="103" x2="145" y2="135"/>'
      + '<line x1="75" y1="65" x2="95" y2="85" opacity="0.6"/>'
      + '<line x1="95" y1="65" x2="75" y2="85" opacity="0.6"/>'
      + '</svg>',
    // 네트워크 끊김
    'no-network':
      '<svg viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M60 100a40 40 0 0 1 80 0" opacity="0.4"/>'
      + '<path d="M75 110a25 25 0 0 1 50 0" opacity="0.5"/>'
      + '<circle cx="100" cy="120" r="5" opacity="0.7"/>'
      + '<line x1="40" y1="40" x2="160" y2="140" opacity="0.8" stroke-width="2.5"/>'
      + '</svg>'
  };

  function mdIllust(name) { return ILLUSTS[name] || ILLUSTS['no-data']; }

  // 빈 상태 HTML 한 줄 빌더 — 어디서나 호출 가능
  function mdEmptyState(opts) {
    opts = opts || {};
    var illust = mdIllust(opts.illust || 'no-data');
    var title  = String(opts.title || '아직 데이터가 없어요').replace(/</g, '&lt;');
    var desc   = String(opts.desc  || '').replace(/</g, '&lt;');
    var cta    = opts.cta ? '<button class="btn btn-primary es-cta" onclick="' + opts.onCta + '">' + String(opts.cta).replace(/</g, '&lt;') + '</button>' : '';
    return '<div class="empty-state">'
      + '<div class="es-illust">' + illust + '</div>'
      + '<div class="es-title">' + title + '</div>'
      + (desc ? '<div class="es-desc">' + desc + '</div>' : '')
      + cta
      + '</div>';
  }

  // ─── 스켈레톤 (D6) ─────────────────────────────────────────────
  // 카드 목록 1줄짜리 스켈레톤 N개 렌더
  function mdSkeletonList(count) {
    count = count || 3;
    var out = '';
    for (var i = 0; i < count; i++) {
      out += '<div class="skeleton-card">'
        +     '<div class="skeleton avatar"></div>'
        +     '<div class="skeleton-text-group">'
        +       '<div class="skeleton line mid"></div>'
        +       '<div class="skeleton line sm short"></div>'
        +     '</div>'
        +   '</div>';
    }
    return out;
  }

  // 외부 노출
  global.mdIcon = mdIcon;
  global.mdMountIcons = _mountIcons;
  global.mdIllust = mdIllust;
  global.mdEmptyState = mdEmptyState;
  global.mdSkeletonList = mdSkeletonList;
})(typeof window !== 'undefined' ? window : this);
