# 코드 위치 인덱스 (자동 생성 — 직접 수정 금지)

`tools/gen-functions.js` 가 pre-commit 훅에서 생성. 탐색 비용(시간·토큰) 절감용.
Claude 는 여기서 줄번호를 찾아 **해당 줄 ±15줄만 Read** 한다 (전체 통독 금지).

## 전역 변수 (166)

- `var toastTimer = null, toastForceTimer = null, toastLocked = false;` — madi-app.js:310
- `var CHILD_PAGE_SIZE = 50, _childCurrentPage = 1, _optionsCacheKey = null, _optionsCacheHtm` — madi-app.js:312
- `var _clockTimer = null, _clockVcBound = false;` — madi-app.js:367
- `var PRES_NORMS = {` — madi-assessment.js:62
- `var REVT_EQ_R = {` — madi-assessment.js:109
- `var REVT_EQ_E = {` — madi-assessment.js:127
- `var REVT_PCT_TABLE = {` — madi-assessment.js:143
- `var SELSI_EQ_R = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16` — madi-assessment.js:217
- `var SELSI_EQ_E = [1,2,2,3,3,4,4,5,5,6,7,7,8,8,9,9,10,10,11,11,12,12,13,14,14,15,15,16,16,1` — madi-assessment.js:218
- `var SELSI_PCT_TABLE = {` — madi-assessment.js:221
- `var UTAP_NORMS = {` — madi-assessment.js:258
- `var SYNCOMP_NORMS = {` — madi-assessment.js:279
- `var LANGSOLVE_NORMS = {` — madi-assessment.js:290
- `var _assessInterpPlain = '';` — madi-assessment.js:528
- `var ASSESS_SCHEMA = {` — madi-assessment.js:631
- `var _inviteCheckTimer = null;` — madi-auth.js:25
- `var _loungePostImages = []; // 글 작성 폼 첨부 File 객체 배열 (최대 3장)` — madi-board-notice.js:2
- `var _loungeCommentImages = {}; // { postId: File } 댓글 첨부 1장` — madi-board-notice.js:3
- `var MAX_IMG_BYTES = 5 * 1024 * 1024; // 5MB` — madi-board-notice.js:115
- `var ALLOWED_IMAGE_MIMES = ['image/jpeg','image/png','image/gif','image/webp'];` — madi-board-notice.js:117
- `var currentBoardTab = 'global';` — madi-board-notice.js:201
- `var _boardLoadGen = 0;` — madi-board-notice.js:203
- `var globalNoticesDB = [];` — madi-board-notice.js:206
- `var centerNoticesDB = [];` — madi-board-notice.js:207
- `var loungePostsDB = [];` — madi-board-notice.js:208
- `var loungeCommentsCache = {}; // { post_id: [comments...] } 펼친 글의 댓글만` — madi-board-notice.js:209
- `var loungeExpandedPosts = {}; // { post_id: true } 댓글 영역 펼친 글` — madi-board-notice.js:210
- `var centersByIdCache = null; // null=미로드, {}=로드됨 (슈퍼어드민이 센터 이름 표시용)` — madi-board-notice.js:211
- `var _libraryFiles = []; // 자료 첨부 File 객체 배열 (최대 5개)` — madi-board.js:493
- `var libraryPostsDB = []; // 자료실 데이터 캐시 (editLibraryPost에서 참조)` — madi-board.js:494
- `var LIBRARY_CATEGORIES = ['조음·음운', '언어발달', '유창성', '인지·학습', '부모교육', '평가도구', '기타'];` — madi-board.js:496
- `var NOTICE_TYPE_OPTS = [` — madi-board.js:831
- `var chatHistory = [];` — madi-chat.js:7
- `var chatOpen = false;` — madi-chat.js:8
- `var chatWaiting = false;` — madi-chat.js:9
- `var CHAT_HISTORY_MAX = 100;` — madi-chat.js:138
- `var CHAT_MACROS = {` — madi-chat.js:358
- `var chatRecognition = null;` — madi-chat.js:473
- `var isChatRecording = false;` — madi-chat.js:474
- `var inputMode = 0;` — madi-child-detail.js:1
- `var recognition = null, isRecording = false;` — madi-child-detail.js:11
- `var goalRows = [];` — madi-child-detail.js:61
- `var phonemeData = {}; // { 'ㅅ': {initial:70, medial:40, final:30}, ... }` — madi-child-detail.js:100
- `var COMMON_PHONEMES = ['ㅅ','ㄹ','ㄷ','ㄴ','ㅈ','ㅊ','ㅆ','ㅉ','ㅎ','ㄱ','ㅋ','ㅌ','ㅍ','ㅂ'];` — madi-child-detail.js:102
- `var _addChildLock = false;` — madi-child-detail.js:307
- `var _searchDebounced = debounce(function() { renderChildGrid(); }, 250);` — madi-child-detail.js:723
- `var _childStatusFilter = '등록';` — madi-child-detail.js:729
- `var _bulkMode = false;` — madi-child-detail.js:732
- `var _bulkSelected = {}; // { childId: true }` — madi-child-detail.js:733
- `var _currentVisibleIds = []; // renderChildGrid에서 채워짐` — madi-child-detail.js:734
- `var _VOUCHER_BADGE_MAP = {` — madi-children.js:69
- `var _staffTrendChart = null;` — madi-children.js:580
- `var MODEL_HAIKU = 'claude-haiku-4-5-20251001';` — madi-core.js:2
- `var MODEL_SONNET = 'claude-sonnet-4-6';` — madi-core.js:3
- `var ROLES = {` — madi-core.js:7
- `var DEFAULT_PERMS = { viewOtherChildren:true, deleteSession:true, useAI:true };` — madi-core.js:46
- `var DISORDER_EMOJI = { '언어발달장애':'🗣️','조음음운장애':'👄','유창성장애':'💬','자폐스펙트럼':'🌈','지적장애':'🧩'` — madi-core.js:101
- `var CHILD_COLORS = ['#0ea5a0','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981'];` — madi-core.js:102
- `var TEACHER_COLORS = ['#0ea5a0','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316` — madi-core.js:103
- `var _teacherColorMap = {};` — madi-core.js:104
- `var SUPA_URL = 'https://ujxdhafzjyrglaclarwe.supabase.co';` — madi-core.js:111
- `var CENTER_SESSION_INTERVAL = 40;` — madi-core.js:112
- `var EDGE_URL = 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1';` — madi-core.js:119
- `var _madiToken = null;` — madi-core.js:120
- `var _supaCache = {};` — madi-core.js:187
- `var SUPA_CACHE_TTL = 5 * 60 * 1000;` — madi-core.js:188
- `var _offlineQueue = [];` — madi-core.js:212
- `var _offlineQueueBusy = false;` — madi-core.js:213
- `var currentUser = null;` — madi-core.js:293
- `var _errReportCount = 0;` — madi-core.js:347
- `var _ERR_REPORT_MAX = 5; // 세션당 최대 5건 — DB 폭주 방지` — madi-core.js:348
- `var _DP_VOUCHER_PRICE = {` — madi-dashboard.js:458
- `var _bcEscHandler = null;` — madi-growth.js:1
- `var VOUCHER_KINDS = ['발달재활바우처','우리아이심리지원서비스바우처','꿈E든카드바우처','나래사랑카드바우처'];` — madi-growth.js:401
- `var _showDischargedInSession = false;` — madi-growth.js:679
- `var _madiApiKey = '';` — madi-home.js:2
- `var ALL_PANELS_NEW = ['panelHome','panel0','panel1','panel2','panel3','panel4','panel5','p` — madi-home.js:433
- `var TAB_PANEL_MAP = ['panel2','panel0','panelReport','panelPortfolio','panelService','pane` — madi-home.js:435
- `var _bcMap = { '-1':'', '0':'캘린더', '1':'아동 관리', '2':'보고서', '3':'포트폴리오', '4':'서비스 관리', '5':` — madi-home.js:462
- `var currentReportTab = 'session';` — madi-home.js:601
- `var currentPortfolioTab = 'trend';` — madi-home.js:631
- `var _bannerNotices = [];` — madi-home.js:658
- `var _bannerIdx = 0;` — madi-home.js:659
- `var _bannerTimer = null;` — madi-home.js:660
- `var _bannerClosed = false;` — madi-home.js:661
- `var noticeDB = [];` — madi-home.js:728
- `var _wakeLock = null;` — madi-home.js:893
- `var _pwaInstallPrompt = null;` — madi-home.js:894
- `var _sessionSaveBusy = false; // 더블탭 중복 저장 방지` — madi-iep.js:9
- `var sessionListExpanded = false;` — madi-iep.js:244
- `var _dcmCallback = null;` — madi-iep.js:386
- `var _dcmEscHandler = null;` — madi-iep.js:387
- `var devChartObj = null;` — madi-iep.js:483
- `var phonemeChartObj = null;` — madi-iep.js:599
- `var _phonemePos = 'all'; // 'all' | 'initial' | 'medial' | 'final'` — madi-iep.js:600
- `var _selectedPhonemes = null; // null = 전체` — madi-iep.js:601
- `var _parentCurrentTab = 'home';` — madi-parent-home.js:5
- `var MADI_VAPID_PUBLIC_KEY = 'BNH0y5wZW_nzhS5IG_6pMYAKmeDYoPWIkc9msFfNXyAsSxAeCzYjtEpW4NDdk` — madi-parent-home.js:7
- `var _parentSignupMatchedChildren = []; // lookup 결과 캐시` — madi-parent-pages.js:301
- `var _obsCategories = {` — madi-parent-pages.js:633
- `var _preBriefingShownKey = '';` — madi-parent.js:206
- `var _quickRec = null; // SpeechRecognition 인스턴스` — madi-quick.js:7
- `var _quickRecActive = false; // 받아쓰기 진행 중 여부` — madi-quick.js:8
- `var _quickCurrentSchedId = null; // 현재 폼이 열린 스케줄 id` — madi-quick.js:9
- `var _quickPhotoDataUrl = ''; // 사진 dataURL (선택 시)` — madi-quick.js:10
- `var _quickNextGoals = []; // 다음 목표 체크박스 상태 [{name, checked}]` — madi-quick.js:11
- `var _quickOriginalSummary = ''; // 폼 열릴 때 요약 초기값 (미저장 감지용)` — madi-quick.js:12
- `var _QUICK_PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'i` — madi-quick.js:18
- `var _QUICK_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2MB (base64 인코딩 시 ~2.7MB → jsonb 부담 완화)` — madi-quick.js:19
- `var _QUICK_SUMMARY_MAX_LEN = 1500; // 한 줄 요약 최대 길이` — madi-quick.js:20
- `var _QUICK_AI_INPUT_MAX_LEN = 8000; // AI 정리 입력 최대 길이 (서버 413 방지)` — madi-quick.js:21
- `var _QUICK_GOAL_MAX_LEN = 100; // 다음 목표 1건 최대 길이` — madi-quick.js:22
- `var _QUICK_GOAL_MAX_COUNT = 20; // 다음 목표 최대 개수` — madi-quick.js:23
- `var _QUICK_DRAFT_KEY_PREFIX = 'madi_quick_draft_'; // sessionStorage 임시저장 키 prefix` — madi-quick.js:24
- `var _QUICK_DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // 임시저장 유효 시간: 6시간` — madi-quick.js:25
- `var _quickSaveDraftDeb = (typeof debounce === 'function') ? debounce(_quickSaveDraft, 600)` — madi-quick.js:67
- `var _quickBackfillBusy = false;` — madi-quick.js:680
- `var SI_TESTS = [` — madi-report.js:4
- `var DDST_DOMAINS = [` — madi-report.js:18
- `var KDST_DOMAINS = [` — madi-report.js:26
- `var SP2_DOMAINS = [` — madi-report.js:36
- `var SP2_PATTERNS = [` — madi-report.js:53
- `var SP2_LEVELS = ['또래보다 매우 적음', '또래보다 적음', '또래와 유사', '또래보다 많음', '또래보다 매우 많음'];` — madi-report.js:62
- `var _schedModalRelease = null;` — madi-schedule.js:2
- `var schedView = 'month';` — madi-schedule.js:133
- `var schedCurrentDate = new Date();` — madi-schedule.js:134
- `var _schedTeacherFilter = '전체';` — madi-schedule.js:165
- `var _weekViewMode = 'therapist';` — madi-schedule.js:166
- `var _weekDupOnly = false;` — madi-schedule.js:167
- `var _lastTeacherBarKey = '';` — madi-schedule.js:168
- `var _teacherList = [];` — madi-schedule.js:205
- `var _schedModalDate = null;` — madi-schedule.js:570
- `var ERROR_LOG_MAX = 100;` — madi-session.js:63
- `var apiUsage = { calls: 0, inputTokens: 0, outputTokens: 0, byModel: {} };` — madi-session.js:64
- `var BACKUP_DB_NAME = 'madi_backup_db';` — madi-session.js:292
- `var BACKUP_STORE = 'daily_backups';` — madi-session.js:293
- `var BACKUP_KEEP = 7; // 7일치 보관` — madi-session.js:294
- `var _permUserId = null;` — madi-system.js:2
- `var _permData = {};` — madi-system.js:3
- `var PERM_LIST = [` — madi-system.js:5
- `var _pollTimer = null;` — madi-system.js:218
- `var _pollInterval = 30000; // 30초마다 갱신 (기존 10초 → 3배 감소, Supabase API 호출 절감)` — madi-system.js:219
- `var _myChangeTs = 0;` — madi-system.js:220
- `var _lastActivityTs = Date.now(); // 사용자 마지막 활동 시각 (유휴 시 폴링 스킵)` — madi-system.js:221
- `var _IDLE_THRESHOLD = 5 * 60 * 1000; // 5분 비활성 시 폴링 중단` — madi-system.js:222
- `var GITHUB_OWNER = 'namga1541-prog';` — madi-system.js:322
- `var GITHUB_REPO = 'MADI';` — madi-system.js:323
- `var GITHUB_FILE = 'index.html';` — madi-system.js:324
- `var GITHUB_SW = 'sw.js';` — madi-system.js:325
- `var _swNow = new Date();` — madi-system.js:330
- `var SW_BUILD = 'madi-v5-' + _swNow.toISOString().slice(0,10).replace(/-/g,'')` — madi-system.js:331
- `var SW_LINES = [` — madi-system.js:334
- `var SW_CODE = SW_LINES.join(String.fromCharCode(10));` — madi-system.js:436
- `var _pwaPrompt = null;` — madi-system.js:1176
- `var SLP_VOCAB_BLOCKED_PARENT = {` — madi-vocab.js:17
- `var SLP_VOCAB_BLOCKED_ALL = {` — madi-vocab.js:71
- `var SLP_VOCAB_ENCOURAGED = {` — madi-vocab.js:96
- `var SLP_PHONO_PATTERNS = {` — madi-vocab.js:128
- `var SLP_PHONO_DEV_AGE = {` — madi-vocab.js:216
- `var SLP_PHONO_PATTERN_DEV_AGE = {` — madi-vocab.js:229
- `var SLP_CLINICAL_TERMS = {` — madi-vocab.js:247
- `var SLP_PROMPT_PARENT_GUIDE = ''` — madi-vocab.js:319
- `var SLP_PROMPT_CLINICAL_GUIDE = ''` — madi-vocab.js:329
- `var SLP_PROMPT_PHONO_GUIDE = ''` — madi-vocab.js:350
- `var SLP_REPORT_SAMPLE_LANG = ''` — madi-vocab.js:422
- `var SLP_REPORT_SAMPLE_SI = ''` — madi-vocab.js:549

## madi-ai.js (25함수)
- `generateReport` — madi-ai.js:1
- `resetBtn` — madi-ai.js:37
- `renderReport` — madi-ai.js:59
- `copyKakao` — madi-ai.js:75
- `downloadPDF` — madi-ai.js:90
  ▸ _마크다운 → HTML 변환 (보고서 표 렌더링용)_ — L113
- `markdownToHtml` — madi-ai.js:114
- `flushTable` — madi-ai.js:120
- `inlineBold` — madi-ai.js:141
  ▸ _전문 평가 보고서 PDF 출력_ — L170
- `downloadAssessPDF` — madi-ai.js:171
  ▸ _보고서 인라인 편집 토글_ — L214
- `toggleReportEdit` — madi-ai.js:215
  ▸ _장단기계획(IEP) 자동 생성_ — L232
- `generateIEP` — madi-ai.js:233
- `resetIEPBtn` — madi-ai.js:319
- `renderIEP` — madi-ai.js:352
- `monthBlock` — madi-ai.js:355
- `renderIEPHistory` — madi-ai.js:465
- `loadIEPRecord` — madi-ai.js:498
- `renderIEPView` — madi-ai.js:508
- `monthBlock` — madi-ai.js:511
- `downloadIEPPDFById` — madi-ai.js:556
- `deleteIEPRecord` — madi-ai.js:563
- `downloadIEPPDF` — madi-ai.js:588
- `monthSection` — madi-ai.js:596
  ▸ _W5: 활동 자료 카탈로그_ — L636
  ▸ _W8: 효과 통계 대시보드_ — L637
- `renderEffectStats` — madi-ai.js:638
- `avgGoalScore` — madi-ai.js:670
- `statCard` — madi-ai.js:690
  ▸ _W5+W8: 활동 자료 카탈로그 (검색/필터 추가)_ — L745

## madi-app.js (50함수)
  ▸ _Supabase DB 로드 / 저장_ — L11
- `_isoDaysAgo` — madi-app.js:14
- `loadDBFromSupabase` — madi-app.js:20
- `safeMap` — madi-app.js:38
- `_loadOlderHistory` — madi-app.js:59
- `safeMap` — madi-app.js:67
- `saveChildren` — madi-app.js:83
- `getSaveErrMsg` — madi-app.js:92
- `_userErrMsg` — madi-app.js:101
- `saveSessions` — madi-app.js:111
- `saveSchedule` — madi-app.js:119
- `saveAssess` — madi-app.js:126
- `loadDB` — madi-app.js:140
  ▸ _아동 연령 실시간 갱신_ — L145
- `refreshChildAges` — madi-app.js:149
- `saveIEP` — madi-app.js:158
- `loadIEPFromSupa` — madi-app.js:168
- `saveActivities` — madi-app.js:176
- `loadActivitiesFromSupa` — madi-app.js:181
  ▸ _커스텀 confirm 모달 (브라우저 confirm 대체)_ — L187
- `attachModalA11y` — madi-app.js:195
- `focusables` — madi-app.js:198
- `onKey` — madi-app.js:204
- `showInputPrompt` — madi-app.js:231
- `close` — madi-app.js:263
- `doCancel` — madi-app.js:267
- `doOk` — madi-app.js:268
- `showConfirm` — madi-app.js:285
- `close` — madi-app.js:301
- `doCancel` — madi-app.js:302
- `debounce` — madi-app.js:311
- `showToast` — madi-app.js:314
- `vibrate` — madi-app.js:341
- `toggleDarkMode` — madi-app.js:342
- `loadDarkMode` — madi-app.js:348
- `updateHeaderClock` — madi-app.js:352
- `startHeaderClock` — madi-app.js:368
- `fetchWithRetry` — madi-app.js:379
- `doFetch` — madi-app.js:383
- `setupNetworkMonitor` — madi-app.js:396
- `showOfflineBanner` — madi-app.js:397
- `hideOfflineBanner` — madi-app.js:403
- `applyParentUI` — madi-app.js:409
- `_initParentSidebar` — madi-app.js:434
- `resetParentUI` — madi-app.js:474
- `loadParentDashboard` — madi-app.js:497
- `toggleMoreMenu` — madi-app.js:504
- `closeMoreMenu` — madi-app.js:505
- `getRoleFlags` — madi-app.js:512
- `validatePasswordStrength` — madi-app.js:518
- `generateClientId` — madi-app.js:526
- `applyUserUI` — madi-app.js:536
- `updateKbOffset` — madi-app.js:567

## madi-assessment.js (27함수)
- `calcLivingAge` — madi-assessment.js:3
  ▸ _아동 + 검사일 → 생활연령 표시_ — L21
- `onAssessChildChange` — madi-assessment.js:22
  ▸ _원점수 → 등가연령·백분위 AI 자동 계산_ — L57
  ▸ _PRES 백분위 규준_ — L60
- `getPRESAgeGroup` — madi-assessment.js:75
- `lookupPRES` — madi-assessment.js:89
  ▸ _REVT 등가연령 규준 (표-28 수용어휘)_ — L107
- `getREVTAgeKey` — madi-assessment.js:170
- `interpolatePct` — madi-assessment.js:198
  ▸ _SELSI 등가연령 규준 (표-34, 35)_ — L215
- `getSELSIAgeKey` — madi-assessment.js:238
  ▸ _U-TAP 자음정확도 규준 (부록2, 강정태1998)_ — L256
- `judgeUTAP` — madi-assessment.js:266
  ▸ _언어문제해결력검사 백분위 (연령별)_ — L288
- `lookupSynComp` — madi-assessment.js:301
  ▸ _생활연령 파싱 (age 문자열 → 개월수)_ — L314
- `parseAgeToMonths` — madi-assessment.js:317
  ▸ _통합 자동 계산 함수_ — L328
- `autoCalcAssessScores` — madi-assessment.js:329
- `setField` — madi-assessment.js:352
  ▸ _PRES_ — L358
  ▸ _SELSI_ — L372
  ▸ _REVT_ — L402
  ▸ _구문의미이해력검사_ — L426
  ▸ _U-TAP 자음정확도 판정_ — L435
  ▸ _언어문제해결력검사 (PFA 탭에 일시 대응)_ — L450
- `_resetAutoCalcBtn` — madi-assessment.js:483
  ▸ _중증도 자동 판정_ — L527
- `getSeverityLabel` — madi-assessment.js:530
- `renderSeveritySummary` — madi-assessment.js:539
- `copyAssessInterp` — madi-assessment.js:606
  ▸ _저장 + 바로 보고서 생성_ — L619
- `addAndReport` — madi-assessment.js:620
- `renderAssessFields` — madi-assessment.js:702
- `getAssessFieldValues` — madi-assessment.js:738
- `addAssessment` — madi-assessment.js:750
  ▸ _검사명 변경 시: 이전 입력 자동저장 → 필드 다시 그리기_ — L793
- `onAssessTypeChange` — madi-assessment.js:794
- `formatAssessScores` — madi-assessment.js:799
- `renderAssessmentList` — madi-assessment.js:812
- `deleteAssessment` — madi-assessment.js:833
- `generateAssessReport` — madi-assessment.js:863
  ▸ _자동저장: 현재 입력된 검사 결과가 있으면 먼저 저장_ — L871
  ▸ _배경정보 4개 필드 통합 (각 라벨과 함께 정리)_ — L915
  ▸ _부모 교육 자료_ — L1034
- `generateParentEdu` — madi-assessment.js:1035
- `printParentEdu` — madi-assessment.js:1083
  ▸ _데이터 이전_ — L1110

## madi-auth.js (22함수)
- `showLanding` — madi-auth.js:13
- `hideLanding` — madi-auth.js:14
- `backToLanding` — madi-auth.js:15
- `showLoginScreen` — madi-auth.js:16
- `hideLoginScreen` — madi-auth.js:17
- `loadUserList` — madi-auth.js:18
- `onInviteCodeInput` — madi-auth.js:26
- `showSignupScreen` — madi-auth.js:46
- `backToLoginFromSignup` — madi-auth.js:53
- `doSignup` — madi-auth.js:55
- `doLogin` — madi-auth.js:137
  ▸ _SEC6: 2FA 필요 시 6자리 입력 모달 표시_ — L151
- `_promptTotpCode` — madi-auth.js:196
- `getMadiLogoSVG` — madi-auth.js:218
  ▸ _Web Vitals 계측 (2026-05-21 최적화 효과 검증용)_ — L226
- `_initWebVitals` — madi-auth.js:231
- `showLogoutMenu` — madi-auth.js:304
- `doLogout` — madi-auth.js:329
- `showLoginUpdatePopup` — madi-auth.js:384
- `_renderLoginUpdatePopup` — madi-auth.js:402
- `_dismiss` — madi-auth.js:434
- `_onKey` — madi-auth.js:444
- `showChangePasswordModal` — madi-auth.js:456
- `submitChangePassword` — madi-auth.js:488

## madi-board-notice.js (25함수)
  ▸ _게시판 이미지 업로드 유틸_ — L1
- `uploadBoardImage` — madi-board-notice.js:7
- `isSafeUrl` — madi-board-notice.js:40
- `renderImageThumbs` — madi-board-notice.js:47
  ▸ _board-images 서명 URL 통합_ — L62
- `_boardImgPath` — madi-board-notice.js:65
- `signBoardImages` — madi-board-notice.js:83
- `_noopMap` — madi-board-notice.js:84
- `onLoungeImagesChange` — madi-board-notice.js:119
- `removeLoungeImage` — madi-board-notice.js:157
- `onCommentImageChange` — madi-board-notice.js:176
- `initBoard` — madi-board-notice.js:214
- `switchBoardTab` — madi-board-notice.js:219
- `renderGlobalNotices` — madi-board-notice.js:247
- `loadGlobalNotices` — madi-board-notice.js:255
- `renderGlobalNoticeUI` — madi-board-notice.js:276
  ▸ _슈퍼어드민 전용 작성 폼_ — L282
  ▸ _공지 목록_ — L302
- `renderGlobalNoticeCard` — madi-board-notice.js:314
- `saveGlobalNotice` — madi-board-notice.js:368
- `togglePopupNotice` — madi-board-notice.js:413
- `deleteGlobalNotice` — madi-board-notice.js:440
- `renderCenterNotices` — madi-board-notice.js:457
- `loadCentersByIdCache` — madi-board-notice.js:472
- `loadCenterNotices` — madi-board-notice.js:482
- `renderCenterNoticeUI` — madi-board-notice.js:517
  ▸ _admin/superadmin 작성 폼_ — L525
  ▸ _공지 목록_ — L547
- `renderCenterNoticeCard` — madi-board-notice.js:561
- `saveCenterNotice` — madi-board-notice.js:605
- `deleteCenterNotice` — madi-board-notice.js:640

## madi-board.js (32함수)
- `renderLounge` — madi-board.js:15
  ▸ _라운지 글 — 권한 기반 필터링_ — L19
- `filterLoungePosts` — madi-board.js:21
- `visibilityMeta` — madi-board.js:47
- `_signLoungePostImages` — madi-board.js:54
- `loadLoungePosts` — madi-board.js:73
- `renderLoungeUI` — madi-board.js:111
  ▸ _작성 폼_ — L119
  ▸ _글 목록_ — L156
- `renderInquiryCard` — madi-board.js:182
- `saveLoungePost` — madi-board.js:250
- `deleteLoungePost` — madi-board.js:310
  ▸ _라운지 댓글 (6단계)_ — L330
- `toggleComments` — madi-board.js:331
- `loadComments` — madi-board.js:347
- `renderComments` — madi-board.js:374
- `saveComment` — madi-board.js:429
- `deleteComment` — madi-board.js:469
- `renderLibrary` — madi-board.js:498
- `_signLibraryImages` — madi-board.js:529
- `_renderLibraryUI` — madi-board.js:554
- `setLibCat` — madi-board.js:639
- `onLibFilesChange` — madi-board.js:644
- `saveLibraryPost` — madi-board.js:665
- `deleteLibraryPost` — madi-board.js:706
- `_isMyPost` — madi-board.js:723
- `openPostEditModal` — madi-board.js:738
- `_close` — madi-board.js:794
- `_onKey` — madi-board.js:798
  ▸ _마디 공지 수정_ — L837
- `editGlobalNotice` — madi-board.js:838
  ▸ _센터 공지 수정_ — L863
- `editCenterNotice` — madi-board.js:864
  ▸ _고객센터(라운지) 수정 — visibility 는 변경 안 함_ — L889
- `editLoungePost` — madi-board.js:890
  ▸ _자료실 수정 — note (카테고리) 도 함께 수정_ — L912
- `editLibraryPost` — madi-board.js:913
- `openVocabFeedback` — madi-board.js:948
- `closeVocabFeedbackModal` — madi-board.js:970
- `submitVocabFeedback` — madi-board.js:975

## madi-chat.js (35함수)
  ▸ _플로팅 AI 비서_ — L6
- `toggleChat` — madi-chat.js:11
  ▸ _마로 버튼 위치 이동_ — L39
- `initFloatBtnDrag` — madi-chat.js:43
  ▸ _좌/우 위치 적용 + 저장_ — L56
- `applySide` — madi-chat.js:57
  ▸ _롱프레스 감지 (꾹 누르면 반대편 모서리로 이동)_ — L79
- `_flip` — madi-chat.js:83
- `_press` — madi-chat.js:96
- `_cancelIfMoved` — madi-chat.js:97
- `_release` — madi-chat.js:100
- `getChatGreeting` — madi-chat.js:126
- `trimChatHistory` — madi-chat.js:140
- `addAiMsg` — madi-chat.js:146
- `addUserMsg` — madi-chat.js:153
- `renderChatMessages` — madi-chat.js:159
- `showTypingIndicator` — madi-chat.js:184
- `hideTypingIndicator` — madi-chat.js:195
- `onChatKeydown` — madi-chat.js:200
- `autoResizeChat` — madi-chat.js:204
- `sendQuick` — madi-chat.js:209
  ▸ _AI 비서 행동 명령 (W2)_ — L216
- `parseAction` — madi-chat.js:217
- `executeAction` — madi-chat.js:231
- `actAddSchedule` — madi-chat.js:248
- `actOpenSessionForChild` — madi-chat.js:311
- `actOpenParentReport` — madi-chat.js:327
- `actSwitchTab` — madi-chat.js:341
- `actShowUnwritten` — madi-chat.js:347
  ▸ _매크로 시스템 (W3)_ — L357
- `macroHelp` — madi-chat.js:366
- `macroTodayBrief` — madi-chat.js:377
- `macroUnwritten` — madi-chat.js:402
- `macroWeeklyStatus` — madi-chat.js:412
- `macroTopProgress` — madi-chat.js:431
- `avg` — madi-chat.js:440
- `tryMacro` — madi-chat.js:462
  ▸ _채팅 음성 입력 (W3)_ — L472
- `toggleChatVoiceInput` — madi-chat.js:476
- `resetChatMicBtn` — madi-chat.js:519
- `sendChat` — madi-chat.js:529
- `buildChatContext` — madi-chat.js:646

## madi-child-detail.js (35함수)
- `setInputMode` — madi-child-detail.js:2
  ▸ _음성 입력_ — L10
- `toggleVoiceInput` — madi-child-detail.js:12
  ▸ _목표 입력 행_ — L60
- `loadGoalRows` — madi-child-detail.js:62
- `updateCloneBtnState` — madi-child-detail.js:74
- `getLastSessionForChild` — madi-child-detail.js:87
  ▸ _음소 오류 매트릭스_ — L99
- `initPhonemeChips` — madi-child-detail.js:104
- `togglePhonemeMatrix` — madi-child-detail.js:114
- `addPhonemeRow` — madi-child-detail.js:129
- `makePhonemeCell` — madi-child-detail.js:165
- `getPhonemeClass` — madi-child-detail.js:173
- `onPhonemeInput` — madi-child-detail.js:182
- `removePhonemeRow` — madi-child-detail.js:192
- `updatePhonemeCount` — madi-child-detail.js:201
- `getPhonemeSnapshot` — madi-child-detail.js:216
- `resetPhonemeMatrix` — madi-child-detail.js:232
- `cloneLastSession` — madi-child-detail.js:249
- `renderGoalRows` — madi-child-detail.js:284
- `addGoalRow` — madi-child-detail.js:299
- `removeGoalRow` — madi-child-detail.js:300
  ▸ _아동 등록_ — L306
- `getTreatDuration` — madi-child-detail.js:310
- `getClosedDuration` — madi-child-detail.js:324
- `getVoucherUsed` — madi-child-detail.js:339
- `deleteChild` — madi-child-detail.js:349
- `closeChild` — madi-child-detail.js:400
- `reopenChild` — madi-child-detail.js:416
- `renderChildGrid` — madi-child-detail.js:431
- `getPageNumbers` — madi-child-detail.js:701
- `goToChildPage` — madi-child-detail.js:717
- `onChildSearchInput` — madi-child-detail.js:724
  ▸ _아동 일괄 처리 모드_ — L731
- `toggleBulkMode` — madi-child-detail.js:736
- `bulkToggleSelect` — madi-child-detail.js:751
- `bulkSelectAllVisible` — madi-child-detail.js:766
- `updateBulkCountLabel` — madi-child-detail.js:783
- `bulkChangeStatus` — madi-child-detail.js:789
- `applyBulkStatus` — madi-child-detail.js:806
  ▸ _일괄 종결일 입력 모달_ — L832

## madi-children.js (14함수)
- `renderServiceStats` — madi-children.js:1
- `_populateSvcFilters` — madi-children.js:37
- `_voucherBadge` — madi-children.js:75
- `_svcStatusInfo` — madi-children.js:83
- `_schedStatus` — madi-children.js:94
- `changeSchedStatus` — madi-children.js:100
- `renderMonthlyService` — madi-children.js:112
- `renderDailyService` — madi-children.js:241
  ▸ _정산 요약_ — L362
- `renderSettlement` — madi-children.js:363
- `exportSettlementExcel` — madi-children.js:492
  ▸ _선생님별 통계_ — L579
- `initSvcStaffMonth` — madi-children.js:582
- `renderStaffStats` — madi-children.js:597
- `showStaffTrendFromCard` — madi-children.js:708
- `showStaffTrend` — madi-children.js:713
  ▸ _입력 모드_ — L796

## madi-core.js (43함수)
  ▸ _상수_ — L1
- `isAdminRole` — madi-core.js:14
- `isStaffRole` — madi-core.js:15
- `escHtml` — madi-core.js:27
- `toKST` — madi-core.js:38
- `nowKST` — madi-core.js:39
- `ymd` — madi-core.js:40
- `getTodayKST` — madi-core.js:41
- `getMonthKST` — madi-core.js:42
- `fmtDateKR` — madi-core.js:44
- `canDo` — madi-core.js:47
- `isMyChild` — madi-core.js:58
- `applyPermissions` — madi-core.js:66
- `getAIModel` — madi-core.js:76
- `saveAIModelChoice` — madi-core.js:80
- `updateAIModelUI` — madi-core.js:87
- `getTeacherColor` — madi-core.js:105
- `loadCenterSessionInterval` — madi-core.js:113
- `getToken` — madi-core.js:126
- `setToken` — madi-core.js:127
- `clearToken` — madi-core.js:128
- `safeSetItem` — madi-core.js:133
- `_purgeLegacyCnCache` — madi-core.js:142
  ▸ _방어 유틸 함수 (Direction A — 반복 크래시 패턴 원천 차단)_ — L151
- `safeGetItem` — madi-core.js:153
- `safeGetSessionItem` — madi-core.js:158
- `safeSetSessionItem` — madi-core.js:163
- `safeJsonParse` — madi-core.js:168
- `safeCmp` — madi-core.js:176
  ▸ _─_ — L182
  ▸ _supaFetch GET 캐시 (2026-05-21 최적화)_ — L184
- `_supaCacheClone` — madi-core.js:189
- `_supaCacheGet` — madi-core.js:193
- `_supaCacheSet` — madi-core.js:199
- `supaCacheInvalidate` — madi-core.js:202
- `supaCacheClearAll` — madi-core.js:209
  ▸ _오프라인 쓰기 큐_ — L211
- `_oqSave` — madi-core.js:217
- `_oqEnqueue` — madi-core.js:218
- `_oqFlush` — madi-core.js:223
  ▸ _─_ — L235
- `supaFetch` — madi-core.js:246
- `hashPassword` — madi-core.js:294
- `getCenterId` — madi-core.js:299
- `_loadScriptOnce` — madi-core.js:303
- `ensureXLSX` — madi-core.js:320
- `ensureChart` — madi-core.js:330
- `centerFilter` — madi-core.js:338
  ▸ _글로벌 에러 모니터링_ — L344
- `_reportClientError` — madi-core.js:350
  ▸ _MADI 네임스페이스 (점진적 캡슐화용)_ — L404

## madi-dashboard.js (24함수)
- `_dpInitial` — madi-dashboard.js:13
- `_dpAvatarClass` — madi-dashboard.js:17
- `_dpMonday` — madi-dashboard.js:23
- `_dpSunday` — madi-dashboard.js:31
- `_dpFmtMD` — madi-dashboard.js:36
- `_dpAge` — madi-dashboard.js:37
- `_dpGreetingFor` — madi-dashboard.js:47
- `_dpTodayBanner` — madi-dashboard.js:54
- `_dpFreshnessLabel` — madi-dashboard.js:61
- `_startDpFreshnessTimer` — madi-dashboard.js:73
- `_stopDpFreshnessTimer` — madi-dashboard.js:84
  ▸ _─_ — L100
  ▸ _─_ — L102
- `renderDashboardTeacher` — madi-dashboard.js:103
- `_isMine` — madi-dashboard.js:114
  ▸ _HTML_ — L173
  ▸ _비동기: 라운지 답변 대기 메시지_ — L379
- `_dpLoadTeacherMessages` — madi-dashboard.js:384
  ▸ _─_ — L453
  ▸ _─_ — L455
- `_dpEstSessionPrice` — madi-dashboard.js:466
- `_dpFmtWon` — madi-dashboard.js:471
- `_dpToggleRevBreakdown` — madi-dashboard.js:477
- `renderDashboardAdmin` — madi-dashboard.js:488
  ▸ _데이터 계산_ — L506
- `_tsKey` — madi-dashboard.js:553
- `_tsBucket` — madi-dashboard.js:554
  ▸ _HTML_ — L589
- `_pt` — madi-dashboard.js:703
  ▸ _하단 2열: 운영 알림 + 빠른 액션_ — L773
- `_dpRenderTeacherRows` — madi-dashboard.js:882
- `_dpLoadAdminTeacherTable` — madi-dashboard.js:911
- `_dpRenderTeacherTable` — madi-dashboard.js:955

## madi-growth.js (28함수)
- `openBulkClosedDateModal` — madi-growth.js:2
- `_bcEscHandler` — madi-growth.js:39
- `toggleBcdReasonEtc` — madi-growth.js:43
- `closeBulkClosedDateModal` — madi-growth.js:51
- `confirmBulkClosedDate` — madi-growth.js:57
- `setChildStatus` — madi-growth.js:89
- `openChildRegModal` — madi-growth.js:99
- `m_updateAge` — madi-growth.js:144
- `addChildFromModal` — madi-growth.js:155
- `toggleChildCard` — madi-growth.js:185
- `openChildDetail` — madi-growth.js:191
- `schedRow` — madi-growth.js:206
- `goToSession` — madi-growth.js:256
  ▸ _아동 편집 모달_ — L283
- `openEditModal` — madi-growth.js:284
- `setEditPayType` — madi-growth.js:403
- `selectEditVoucherKind` — madi-growth.js:428
- `calcEditCopay` — madi-growth.js:441
- `updateEditAge` — madi-growth.js:472
- `saveEditModal` — madi-growth.js:490
- `closeEditModal` — madi-growth.js:551
  ▸ _검색 셀렉트 공통_ — L555
- `updateSSDrop` — madi-growth.js:556
- `makeSearchable` — madi-growth.js:583
  ▸ _세션탭 종결 아동 포함 토글_ — L678
- `toggleDischargedInSession` — madi-growth.js:681
- `populateChildSelects` — madi-growth.js:693
  ▸ _발화 샘플 분석 (MLU · TTR)_ — L795
- `toggleSpeechPanel` — madi-growth.js:796
- `analyzeSpeechSample` — madi-growth.js:808
- `runSpeechAnalysis` — madi-growth.js:829
- `appendSpeechResultToMemo` — madi-growth.js:859

## madi-home.js (45함수)
- `loadCenterApiKey` — madi-home.js:4
- `saveCenterApiKey` — madi-home.js:41
- `toggleCenterKeyVisibility` — madi-home.js:72
  ▸ _센터 관리_ — L85
- `formatInviteExpiry` — madi-home.js:87
- `loadCenterInfo` — madi-home.js:100
- `copyInviteCode` — madi-home.js:123
- `regenInviteCode` — madi-home.js:133
- `addStaffAccount` — madi-home.js:171
- `loadStaffMgmtList` — madi-home.js:212
- `removeStaffAccountFromBtn` — madi-home.js:239
- `removeStaffAccount` — madi-home.js:244
  ▸ _관리자 페이지 이동 (TASK-008: admin.html 분리)_ — L256
- `goToAdmin` — madi-home.js:257
- `applyRoleUI` — madi-home.js:265
- `resetMaroPos` — madi-home.js:282
- `getApiKeyOrAlert` — madi-home.js:296
  ▸ _탭 전환_ — L300
  ▸ _새 탭 구조 (7개)_ — L301
  ▸ _홈 대시보드_ — L304
- `showDashboard` — madi-home.js:305
  ▸ _대시보드 라우터_ — L328
- `renderDashboard` — madi-home.js:331
  ▸ _레거시 (이전 단일 디자인) — fallback 보존_ — L363
- `renderDashboardLegacy` — madi-home.js:364
  ▸ _사이드바 active 동기화_ — L437
- `syncSidebarActive` — madi-home.js:438
  ▸ _사이드바 토글 (상태 localStorage 저장)_ — L444
- `toggleSidebar` — madi-home.js:445
- `restoreSidebarState` — madi-home.js:452
  ▸ _Breadcrumb 업데이트_ — L461
- `updateBreadcrumb` — madi-home.js:463
- `updateSidebarAdminVisibility` — madi-home.js:472
- `switchTab` — madi-home.js:483
  ▸ _보고서 서브탭_ — L600
- `switchReportTab` — madi-home.js:602
  ▸ _포트폴리오 서브탭_ — L630
- `switchPortfolioTab` — madi-home.js:632
  ▸ _공지 배너_ — L657
- `startNoticeBanner` — madi-home.js:663
- `_renderBannerSlide` — madi-home.js:696
- `closeNoticeBanner` — madi-home.js:720
  ▸ _공지사항_ — L727
- `loadNotices` — madi-home.js:729
- `renderNoticeList` — madi-home.js:747
- `saveNotice` — madi-home.js:779
- `fanoutNoticeNotifications` — madi-home.js:807
- `fanoutSessionNotification` — madi-home.js:833
- `deleteNotice` — madi-home.js:872
  ▸ _서비스관리_ — L889
- `initUserSettings` — madi-home.js:897
- `updateSettingsUI` — madi-home.js:902
  ▸ _글자 크기_ — L941
- `setFontSize` — madi-home.js:942
  ▸ _화면 항상 켜짐_ — L952
- `toggleWakeLock` — madi-home.js:953
  ▸ _진동 피드백_ — L975
- `toggleHaptic` — madi-home.js:976
  ▸ _시작 탭_ — L985
- `setStartTab` — madi-home.js:986
  ▸ _PWA 홈 화면 추가_ — L992
- `showPWAInstall` — madi-home.js:993
- `closePWAGuide` — madi-home.js:1004
  ▸ _비밀번호 변경_ — L1009
- `changeMyPassword` — madi-home.js:1010
- `setResult` — madi-home.js:1016
  ▸ _─_ — L1045
  ▸ _─_ — L1049

## madi-icons.js (6함수)
- `mdIcon` — madi-icons.js:60
- `_mountIcons` — madi-icons.js:75
- `_autoMount` — madi-icons.js:90
  ▸ _빈 상태 일러스트 (D5)_ — L97
- `mdIllust` — madi-icons.js:146
- `mdEmptyState` — madi-icons.js:149
  ▸ _스켈레톤 (D6)_ — L163
- `mdSkeletonList` — madi-icons.js:165

## madi-iep.js (23함수)
  ▸ _본인 세션 판별 (teacher_id 우선, 레거시는 이름 폴백)_ — L1
- `_isMySession` — madi-iep.js:2
  ▸ _세션 저장_ — L8
- `saveSession` — madi-iep.js:10
- `saveSessionAI` — madi-iep.js:63
- `_resetAISaveBtn` — madi-iep.js:112
  ▸ _기능 2: 가정 활동 추천 AI_ — L150
- `suggestHomeActivities` — madi-iep.js:151
  ▸ _세션 목록_ — L242
- `toggleSessionListExpand` — madi-iep.js:245
- `renderSessionList` — madi-iep.js:250
- `editSessionDate` — madi-iep.js:355
  ▸ _삭제 확인 모달_ — L385
- `showDeleteConfirm` — madi-iep.js:388
- `_dcmEscHandler` — madi-iep.js:411
- `checkDcmInput` — madi-iep.js:415
- `closeDcmModal` — madi-iep.js:426
- `executeDcm` — madi-iep.js:432
- `deleteSession` — madi-iep.js:437
  ▸ _차트_ — L482
- `renderChart` — madi-iep.js:484
  ▸ _기능 3: 발달 정체 자동 감지 + W7 액션 제안_ — L598
- `renderPhonemeChart` — madi-iep.js:603
- `renderPhonemeMatrixTable` — madi-iep.js:727
- `togglePhonemeFilter` — madi-iep.js:762
- `setPhonemePos` — madi-iep.js:775
- `detectStagnation` — madi-iep.js:781
- `_resetStagnBtn` — madi-iep.js:815
- `renderStagnationResult` — madi-iep.js:831
- `stagnationActionMeta` — madi-iep.js:887
  ▸ _기능 4: 부모 보고서_ — L898

## madi-parent-home.js (23함수)
  ▸ _탭 전환_ — L9
- `switchParentTab` — madi-parent-home.js:10
  ▸ _내 아동 정보 가져오기 (공통)_ — L30
- `getMyChildInfo` — madi-parent-home.js:33
- `_emit` — madi-parent-home.js:36
- `setActiveParentChild` — madi-parent-home.js:96
- `renderParentChildSwitcher` — madi-parent-home.js:125
  ▸ _홈 (페르소나 ⑦)_ — L154
- `loadParentHome` — madi-parent-home.js:156
- `_renderParentHero` — madi-parent-home.js:233
- `_renderParentHeroStats` — madi-parent-home.js:275
- `_renderParentRecentPortfolios` — madi-parent-home.js:289
- `_renderParentNextSchedule` — madi-parent-home.js:349
- `_renderParentWeekSessions` — madi-parent-home.js:374
- `fmt` — madi-parent-home.js:390
- `_loadParentTeacherMessages` — madi-parent-home.js:421
- `_loadParentAssessments` — madi-parent-home.js:430
- `_renderParentChartByScore` — madi-parent-home.js:471
- `_renderParentChart` — madi-parent-home.js:565
- `_renderParentVoucher` — madi-parent-home.js:639
- `_renderParentVoucherUpcoming` — madi-parent-home.js:646
- `_redrawParentVoucherPanel` — madi-parent-home.js:651
- `_renderParentHomeActivities` — madi-parent-home.js:732
- `_toggleParentActivity` — madi-parent-home.js:771
- `_calcAge` — madi-parent-home.js:783
- `_showParentOnboarding` — madi-parent-home.js:795

## madi-parent-pages.js (26함수)
  ▸ _일정 탭_ — L12
- `loadParentSched` — madi-parent-pages.js:13
  ▸ _리포트 탭_ — L57
  ▸ _학부모 포트폴리오 탭_ — L58
- `loadParentPortfolio` — madi-parent-pages.js:62
- `loadParentReport` — madi-parent-pages.js:115
- `_renderParentPortfolioCard` — madi-parent-pages.js:118
  ▸ _공지 탭_ — L158
- `loadParentNotice` — madi-parent-pages.js:159
- `loadParentNotifications` — madi-parent-pages.js:191
- `renderParentNotifList` — madi-parent-pages.js:205
- `openParentNotif` — madi-parent-pages.js:250
- `markAllNotifRead` — madi-parent-pages.js:268
- `formatTimeAgo` — madi-parent-pages.js:279
  ▸ _화면 전환: 학부모 가입 화면 표시_ — L303
- `showParentSignupScreen` — madi-parent-pages.js:304
  ▸ _학부모 가입 → 로그인 화면 복귀_ — L317
- `backToLoginFromParentSignup` — madi-parent-pages.js:318
  ▸ _입력 시 자동 하이픈 (010-1234-5678)_ — L326
- `formatParentPhone` — madi-parent-pages.js:327
  ▸ _단계 2 → 단계 1로 되돌리기_ — L340
- `resetParentSignup` — madi-parent-pages.js:341
  ▸ _액션 1: 핸드폰 번호로 아동 조회_ — L359
- `parentLookup` — madi-parent-pages.js:360
  ▸ _액션 2: 학부모 가입 처리_ — L423
- `parentSignup` — madi-parent-pages.js:424
- `_b64UrlToUint8` — madi-parent-pages.js:499
- `loadParentPushToggle` — madi-parent-pages.js:508
- `onPushToggleTap` — madi-parent-pages.js:541
- `_subscribePush` — madi-parent-pages.js:551
- `_unsubscribePush` — madi-parent-pages.js:612
  ▸ _관찰기록 홈 패널 렌더링 (홈 탭 하단에 삽입)_ — L639
- `loadParentObservations` — madi-parent-pages.js:640
- `_renderParentObsForm` — madi-parent-pages.js:652
- `submitParentObservation` — madi-parent-pages.js:676
- `_loadParentObsList` — madi-parent-pages.js:720
- `_renderParentObsCard` — madi-parent-pages.js:749

## madi-parent.js (19함수)
  ▸ _W6: 회기 후 자동 브리핑 모달_ — L2
- `showPostSessionBriefing` — madi-parent.js:3
- `closePostBriefing` — madi-parent.js:107
  ▸ _W7: 자동 배경 정체 체크 (규칙 기반, API 호출 없음)_ — L112
- `checkAutoStagnation` — madi-parent.js:113
- `showStagnationAlert` — madi-parent.js:164
  ▸ _W6: 회기 전 브리핑 카드_ — L205
- `checkUpcomingSessionBriefing` — madi-parent.js:207
  ▸ _Word(.doc) 다운로드 → 한글에서 열어 HWP 저장_ — L307
- `downloadWordDoc` — madi-parent.js:308
  ▸ _기능 5: 월간 포트폴리오_ — L360
- `generatePortfolio` — madi-parent.js:361
- `_resetPortfolioBtn` — madi-parent.js:429
  ▸ _포트폴리오 DB 저장 (UPSERT)_ — L459
- `_savePortfolioToDB` — madi-parent.js:461
  ▸ _포트폴리오 가시성 토글 (선생님 OPEN/CLOSE)_ — L508
- `togglePortfolioVisibility` — madi-parent.js:509
  ▸ _포트폴리오 히스토리 로드·렌더_ — L537
- `renderPortfolioHistory` — madi-parent.js:538
  ▸ _포트폴리오 삭제_ — L586
- `deletePortfolio` — madi-parent.js:587
  ▸ _아동 선택 변경 시 히스토리 자동 로드_ — L601
- `onPortfolioChildChange` — madi-parent.js:602
- `renderPortfolio` — madi-parent.js:608
  ▸ _기능 6: 자연어 검색_ — L714
- `naturalSearch` — madi-parent.js:715
- `_resetAskBtn` — madi-parent.js:749
  ▸ _기능 7: 부모 FAQ 답변_ — L767
- `generateFAQ` — madi-parent.js:768
- `_resetFAQBtn` — madi-parent.js:808
- `copyFAQText` — madi-parent.js:830
  ▸ _유틸_ — L845

## madi-quick.js (33함수)
  ▸ _─_ — L4
  ▸ _─_ — L6
  ▸ _─_ — L14
  ▸ _─_ — L16
  ▸ _─_ — L27
  ▸ _─_ — L29
- `_quickDraftKey` — madi-quick.js:30
- `_quickSaveDraft` — madi-quick.js:32
- `_quickLoadDraft` — madi-quick.js:49
- `_quickClearDraft` — madi-quick.js:62
- `_quickAttachDraftListeners` — madi-quick.js:69
  ▸ _─_ — L78
  ▸ _─_ — L80
- `openQuickPanel` — madi-quick.js:81
- `_showQuickCardList` — madi-quick.js:113
  ▸ _─_ — L121
  ▸ _─_ — L123
- `_quickGetMySchedules` — madi-quick.js:124
- `_quickFindSession` — madi-quick.js:139
- `_quickFindChild` — madi-quick.js:152
  ▸ _─_ — L158
  ▸ _─_ — L160
- `renderQuickCards` — madi-quick.js:161
- `_quickRenderCards` — madi-quick.js:197
- `_quickTimeAgo` — madi-quick.js:229
  ▸ _─_ — L237
  ▸ _─_ — L239
- `openQuickForm` — madi-quick.js:240
- `_quickRenderForm` — madi-quick.js:270
- `_quickPrefillGoals` — madi-quick.js:316
- `_quickFormHtml` — madi-quick.js:347
- `_quickPhotoHtml` — madi-quick.js:413
- `_quickRenderNextGoals` — madi-quick.js:438
- `_quickToggleGoal` — madi-quick.js:457
- `_quickRemoveGoal` — madi-quick.js:462
- `quickAddGoal` — madi-quick.js:467
  ▸ _─_ — L484
  ▸ _─_ — L486
- `quickPickPhoto` — madi-quick.js:487
- `quickRemovePhoto` — madi-quick.js:520
  ▸ _─_ — L529
  ▸ _─_ — L531
- `quickToggleDictation` — madi-quick.js:532
- `_startQuickDictation` — madi-quick.js:557
- `_quickStopDictation` — madi-quick.js:611
  ▸ _─_ — L626
  ▸ _─_ — L628
- `quickAiClean` — madi-quick.js:629
  ▸ _─_ — L675
  ▸ _─_ — L679
- `_quickBackfillOnePhoto` — madi-quick.js:681
  ▸ _─_ — L706
  ▸ _─_ — L709
- `_quickNormalizeStorageUrl` — madi-quick.js:712
- `_quickUploadPhoto` — madi-quick.js:724
  ▸ _─_ — L750
  ▸ _─_ — L752
- `quickSave` — madi-quick.js:753
- `closeQuickForm` — madi-quick.js:858

## madi-report.js (10함수)
  ▸ _감각통합(감통) 평가 보고서_ — L1
- `renderSIReport` — madi-report.js:64
- `makeDevRows` — madi-report.js:77
- `onSIChildChange` — madi-report.js:273
- `collectSIData` — madi-report.js:275
- `generateSIReport` — madi-report.js:346
- `fmtDevRow` — madi-report.js:374
- `copySIReport` — madi-report.js:444
  ▸ _감통보고서 — 사용자 정의 검사명 입력_ — L459
- `addCustomSITest` — madi-report.js:461
- `removeCustomSITest` — madi-report.js:498
  ▸ _K-DST 발달수준 색상 시각화_ — L502
- `updateKdstLevelColor` — madi-report.js:504

## madi-schedule.js (43함수)
  ▸ _생년월일 숫자 입력 처리_ — L4
- `formatBirthInput` — madi-schedule.js:5
- `parseBirth` — madi-schedule.js:9
- `calcAgeFromBirth` — madi-schedule.js:18
  ▸ _미작성 세션 알림_ — L33
- `getUnwrittenSessions` — madi-schedule.js:34
- `renderUnwrittenAlert` — madi-schedule.js:53
- `toggleUwBody` — madi-schedule.js:96
- `toggleUwTeacher` — madi-schedule.js:104
- `quickFillSession` — madi-schedule.js:113
  ▸ _스케줄_ — L132
- `setSchedView` — madi-schedule.js:136
- `moveSchedPeriod` — madi-schedule.js:154
- `renderTeacherFilter` — madi-schedule.js:170
- `setTeacherFilter` — madi-schedule.js:194
- `switchToDay` — madi-schedule.js:200
- `buildTeacherOptions` — madi-schedule.js:207
- `loadTeacherList` — madi-schedule.js:216
- `renderSchedView` — madi-schedule.js:225
- `renderMonthGrid` — madi-schedule.js:231
- `toLocal` — madi-schedule.js:240
- `toggleWeekViewMode` — madi-schedule.js:291
- `renderWeekGrid` — madi-schedule.js:296
  ▸ _일일 뷰_ — L388
- `renderDayGrid` — madi-schedule.js:389
  ▸ _모바일: 치료사별 카드 리스트_ — L417
  ▸ _PC: 기존 테이블_ — L454
- `renderSessionListForPeriod` — madi-schedule.js:530
- `openSchedModalForChild` — madi-schedule.js:573
- `openSchedModal` — madi-schedule.js:589
- `autoCalcEndTime` — madi-schedule.js:635
- `toggleRepeatOpt` — madi-schedule.js:649
- `toggleDayChip` — madi-schedule.js:670
- `closeSchedModal` — madi-schedule.js:671
- `saveSchedFromModal` — madi-schedule.js:676
- `openEditSchedModal` — madi-schedule.js:741
- `goToSessionFromSched` — madi-schedule.js:780
- `renderWeekGridByChild` — madi-schedule.js:801
- `confirmSchedDelete` — madi-schedule.js:861
- `execSchedDeleteChoice` — madi-schedule.js:894
- `execSchedDelete` — madi-schedule.js:903
- `saveEditSched` — madi-schedule.js:947
  ▸ _일정 내보내기_ — L973
- `openScheduleExportModal` — madi-schedule.js:974
- `fmt` — madi-schedule.js:983
- `closeScheduleExportModal` — madi-schedule.js:1006
- `_getExportRows` — madi-schedule.js:1011
- `exportSchedule` — madi-schedule.js:1041
- `_printSchedule` — madi-schedule.js:1073
- `_exportScheduleRtf` — madi-schedule.js:1108
  ▸ _표준화 검사_ — L1128

## madi-session.js (37함수)
  ▸ _보안: API 키 마스킹 / 토글_ — L1
- `maskApiKey` — madi-session.js:2
- `showMaskedApiKey` — madi-session.js:7
- `editApiKey` — madi-session.js:20
- `onApiKeyFocus` — madi-session.js:32
- `onApiKeyBlur` — madi-session.js:33
- `toggleApiKeyVisibility` — madi-session.js:41
- `maskPII` — madi-session.js:55
  ▸ _운영 모니터링: 에러 로깅 + 토큰 사용량_ — L62
- `loadApiUsage` — madi-session.js:66
- `saveApiUsage` — madi-session.js:73
- `recordApiUsage` — madi-session.js:77
- `estimateCost` — madi-session.js:88
- `resetApiUsage` — madi-session.js:104
- `_sanitizeForErrorLog` — madi-session.js:114
- `pushErrorLog` — madi-session.js:125
- `getErrorLog` — madi-session.js:157
- `clearErrorLog` — madi-session.js:161
- `renderDebugInfo` — madi-session.js:170
- `statCard` — madi-session.js:179
- `copyErrorLog` — madi-session.js:230
- `setupGlobalErrorHandler` — madi-session.js:257
  ▸ _데이터 안전망: IndexedDB 자동 백업_ — L291
- `openBackupDB` — madi-session.js:296
- `putBackup` — madi-session.js:310
- `listBackups` — madi-session.js:322
- `getBackup` — madi-session.js:339
- `deleteBackup` — madi-session.js:350
- `quickHash` — madi-session.js:362
- `buildBackupSnapshot` — madi-session.js:371
- `autoBackup` — madi-session.js:396
- `pruneOldBackups` — madi-session.js:415
- `maybeAutoBackup` — madi-session.js:423
  ▸ _백업 복원_ — L432
- `restoreFromBackup` — madi-session.js:433
- `_execRestoreFromBackup` — madi-session.js:441
- `applyBackup` — madi-session.js:452
- `renderBackupList` — madi-session.js:484
- `deleteBackupConfirm` — madi-session.js:521
- `callClaude` — madi-session.js:532
- `parseJSON` — madi-session.js:566
  ▸ _센터 API 키 관리 (선택지 2)_ — L625

## madi-system.js (39함수)
  ▸ _권한 설정 모달_ — L1
- `openPermModal` — madi-system.js:12
- `updatePermToggle` — madi-system.js:67
- `savePermissions` — madi-system.js:77
  ▸ _선생님 계정 관리 (관리자 전용)_ — L115
- `renderStaffCard` — madi-system.js:116
- `saveNewStaff` — madi-system.js:160
- `deleteStaff` — madi-system.js:189
  ▸ _폴링 방식 동기화 (보안 강화 — Realtime 대체)_ — L217
- `initRealtime` — madi-system.js:232
- `markMyChange` — madi-system.js:246
- `stopRealtime` — madi-system.js:248
  ▸ _마디 폴더 핸들 관리 (IndexedDB)_ — L271
- `_openMadiDB` — madi-system.js:272
- `_saveFolderHandle` — madi-system.js:280
- `_loadFolderHandle` — madi-system.js:291
- `getMadiFolderHandle` — madi-system.js:302
  ▸ _GitHub 자동 배포_ — L321
  ▸ _GitHub 배포 — Edge Function 프록시 방식_ — L438
- `_cleanupLegacyGithubToken` — madi-system.js:443
- `deployFileViaProxy` — madi-system.js:452
  ▸ _배포 대상 파일 자동 스캔_ — L476
- `scanMadiFiles` — madi-system.js:479
- `next` — madi-system.js:483
  ▸ _파일 내용 → Git blob SHA-1 계산_ — L506
- `gitBlobSha` — madi-system.js:509
- `pollGithubPagesBuild` — madi-system.js:524
- `poll` — madi-system.js:528
- `deployToGitHub` — madi-system.js:563
- `processImportFile` — madi-system.js:742
- `_processImportFileInner` — madi-system.js:759
- `normalizeDisorderType` — madi-system.js:799
- `parseRowsToChildren` — madi-system.js:811
- `findCol` — madi-system.js:815
- `analyzeImportData` — madi-system.js:880
- `renderImportPreview` — madi-system.js:924
- `confirmImport` — madi-system.js:981
- `_batchPost` — madi-system.js:1065
- `cancelImport` — madi-system.js:1085
  ▸ _초기화_ — L1093
- `init` — madi-system.js:1094
  ▸ _PWA 지원_ — L1175
- `initPWA` — madi-system.js:1178
  ▸ _SW 업데이트 시 자동 새로고침 (설치형 PWA 포함)_ — L1184
- `_swApplyUpdate` — madi-system.js:1193
- `_onVis` — madi-system.js:1206
- `_pwaShouldShowBanner` — madi-system.js:1264
- `showPWABanner` — madi-system.js:1275
- `hidePWABanner` — madi-system.js:1306
- `triggerPWAInstall` — madi-system.js:1320
  ▸ _뒤로가기 버튼 탭 연동_ — L1334
  ▸ _─_ — L1343
  ▸ _─_ — L1345
  ▸ _모듈 초기화_ — L1347

## madi-vocab.js (4함수)
  ▸ _한자어 → 일상어 (학부모 대상 문서에서만 적용)_ — L16
  ▸ _비표준 → 표준 임상 용어 (모든 문서에서 적용)_ — L69
  ▸ _권장 표현 (상황별 예시)_ — L95
  ▸ _자음 변동_ — L129
  ▸ _음절 구조 변동_ — L176
  ▸ _동화_ — L198
- `sanitizeSLPOutput` — madi-vocab.js:369
- `boundedReplace` — madi-vocab.js:379
- `getClinicalGuideForDiagnosis` — madi-vocab.js:409
- `getReportStyleGuide` — madi-vocab.js:663

## admin.html (114함수)
- `toKST` — admin.html:826
- `nowKST` — admin.html:827
- `ymd` — admin.html:828
- `getTodayKST` — admin.html:829
- `getMonthKST` — admin.html:830
- `getToken` — admin.html:899
- `getCenterId` — admin.html:900
- `centerFilter` — admin.html:901
- `fetchWithRetry` — admin.html:907
- `doFetch` — admin.html:914
- `supaFetch` — admin.html:931
- `escHtml` — admin.html:950
- `showConfirm` — admin.html:960
- `close` — admin.html:974
- `_onKey` — admin.html:975
- `hashPassword` — admin.html:985
- `maskApiKey` — admin.html:993
- `validatePasswordStrength` — admin.html:998
- `showToast` — admin.html:1004
- `showSvcSubTab` — admin.html:1021
- `showAdminTab` — admin.html:1033
- `loadPushSettings` — admin.html:1069
- `savePushSettings` — admin.html:1087
- `sendPushTest` — admin.html:1122
- `sendInAppNotifTest` — admin.html:1168
- `goBack` — admin.html:1210
- `goToAppTab` — admin.html:1215
- `saveAIModelChoice` — admin.html:1221
- `updateAIModelUI` — admin.html:1228
- `loadAdminData` — admin.html:1250
- `safeMap` — admin.html:1256
- `saveSchedulePatch` — admin.html:1277
- `_voucherBadge` — admin.html:1293
- `_svcStatusInfo` — admin.html:1300
- `_schedStatus` — admin.html:1310
- `changeSchedStatus` — admin.html:1315
- `renderServiceStats` — admin.html:1323
- `_populateSvcFilters` — admin.html:1346
- `setSvcMode` — admin.html:1368
- `populateIntSvcFilters` — admin.html:1388
- `renderIntegratedSvc` — admin.html:1418
- `statCard` — admin.html:1486
- `renderMonthlyService` — admin.html:1530
- `renderDailyService` — admin.html:1604
- `renderSettlement` — admin.html:1656
- `exportSettlementExcel` — admin.html:1713
- `initSvcStaffMonth` — admin.html:1745
- `renderStaffStats` — admin.html:1758
- `showStaffTrend` — admin.html:1822
- `loadPrograms` — admin.html:1875
- `renderProgramList` — admin.html:1887
- `loadTeacherList` — admin.html:1914
- `loadTeacherPrograms` — admin.html:1927
- `renderProgCheckList` — admin.html:1938
- `onProgCheck` — admin.html:1954
- `bulkAssign` — admin.html:1963
- `saveTeacherPrograms` — admin.html:1975
  ▸ _공지사항_ — L1992
- `renderNoticeList` — admin.html:2007
- `deleteNotice` — admin.html:2039
  ▸ _센터 관리_ — L2047
- `formatInviteExpiry` — admin.html:2048
  ▸ _선생님 계정 관리_ — L2059
- `loadStaffMgmtList` — admin.html:2060
- `showStaffTrendFromCard` — admin.html:2084
- `removeStaffAccountFromBtn` — admin.html:2085
- `resetStaffPasswordFromBtn` — admin.html:2086
- `removeStaffAccount` — admin.html:2088
- `resetStaffPassword` — admin.html:2096
  ▸ _2FA (TOTP) 관리 (SEC6, 2026-05-24)_ — L2126
- `totpApi` — admin.html:2127
- `totpRefreshStatus` — admin.html:2136
- `totpStartSetup` — admin.html:2157
- `totpConfirmEnroll` — admin.html:2172
- `totpStartDisable` — admin.html:2189
  ▸ _API 키 관리_ — L2216
- `loadCenterApiKey` — admin.html:2217
- `saveCenterApiKey` — admin.html:2232
- `toggleCenterKeyVisibility` — admin.html:2247
  ▸ _센터 초대 코드 관리_ — L2255
- `loadCenterInfo` — admin.html:2256
- `copyInviteCode` — admin.html:2281
- `regenInviteCode` — admin.html:2296
  ▸ _직원 추가_ — L2328
- `addStaffAccount` — admin.html:2329
  ▸ _다크모드_ — L2374
- `toggleDarkMode` — admin.html:2375
- `resetMaroPosition` — admin.html:2383
- `toggleTeacherRow` — admin.html:2452
- `getTeacherColor` — admin.html:2456
- `renderOpsDashboard` — admin.html:2462
- `set` — admin.html:2469
- `renderTeacherChildMap` — admin.html:2511
- `loadPermUserList` — admin.html:2562
- `loadUserPerms` — admin.html:2578
- `renderPermList` — admin.html:2587
- `saveUserPerms` — admin.html:2602
  ▸ _학부모_ — L2611
- `populateParentChildSelect` — admin.html:2613
- `filterParentChildList` — admin.html:2624
- `showParentChildDrop` — admin.html:2645
- `selectParentChild` — admin.html:2650
- `createParentAccount` — admin.html:2659
- `copyParentNewInfo` — admin.html:2713
- `loadParentList` — admin.html:2733
- `deleteParentAccount` — admin.html:2761
  ▸ _오류 모니터링_ — L2778
- `loadErrorLogs` — admin.html:2779
- `clearOldErrorLogs` — admin.html:2834
- `generateLicenseKey` — admin.html:2850
- `refreshLicenseKey` — admin.html:2860
- `calcExpiresAt` — admin.html:2865
- `copyLicenseKey` — admin.html:2875
- `issueLicense` — admin.html:2884
- `loadLicenseList` — admin.html:2925
- `loadMyLicense` — admin.html:2980
- `activateLicense` — admin.html:3039
- `loadVocabFeedback` — admin.html:3067
- `deleteVocabFeedback` — admin.html:3122
- `loadClientErrors` — admin.html:3136
- `checkRlsStatus` — admin.html:3187
- `dismissRlsBanner` — admin.html:3198
- `deleteClientError` — admin.html:3205
- `_v` — admin.html:3227
