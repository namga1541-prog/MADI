// ═══════════════════════════════════════════════════════════
// MADI 게시판 시스템 — 2단계: 골격 + 탭 전환
// ═══════════════════════════════════════════════════════════
// 다음 단계 예정:
//   3단계: 마디 공지사항 (작성/목록/삭제)
//   4단계: 센터 공지사항 통합
//   5단계: 라운지 글 (1:1 + 센터)
//   6단계: 라운지 댓글 + 이미지 업로드
// ═══════════════════════════════════════════════════════════

// 현재 활성 서브탭 (global / center / lounge)
var currentBoardTab = 'global';

// 게시판 진입 시 호출 (switchTab(7)에서 자동)
function initBoard() {
  // 첫 진입은 마디 공지사항 탭으로
  switchBoardTab(currentBoardTab || 'global');
}

// 서브탭 전환
function switchBoardTab(name) {
  if (!name) return;
  currentBoardTab = name;

  // 모든 서브탭 버튼 비활성화
  ['global', 'center', 'lounge'].forEach(function(n) {
    var btn = document.getElementById('bdBtn_' + n);
    if (btn) btn.classList.remove('active');
    var pnl = document.getElementById('bdPanel_' + n);
    if (pnl) pnl.style.display = 'none';
  });

  // 선택된 서브탭 활성화
  var activeBtn = document.getElementById('bdBtn_' + name);
  if (activeBtn) activeBtn.classList.add('active');
  var activePnl = document.getElementById('bdPanel_' + name);
  if (activePnl) activePnl.style.display = 'block';

  // 서브탭별 렌더 함수 호출 (3단계 이후 실제 데이터 로드)
  if      (name === 'global') renderGlobalNotices();
  else if (name === 'center') renderCenterNotices();
  else if (name === 'lounge') renderLounge();
}

// ─────── 마디 공지사항 (3단계에서 구현) ───────
function renderGlobalNotices() {
  // 골격: 빈 화면 유지 (HTML에 이미 "준비 중" 메시지 있음)
}

// ─────── 센터 공지사항 (4단계에서 구현) ───────
function renderCenterNotices() {
  // 골격: 빈 화면 유지
}

// ─────── 라운지 (5~6단계에서 구현) ───────
function renderLounge() {
  // 골격: 빈 화면 유지
}
