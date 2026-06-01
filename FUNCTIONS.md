# 코드 위치 인덱스 (자동 생성 — 직접 수정 금지)

`tools/gen-functions.js` 가 pre-commit 훅에서 생성. 탐색 비용(시간·토큰) 절감용.
Claude 는 여기서 줄번호를 찾아 **해당 줄 ±15줄만 Read** 한다 (전체 통독 금지).

## 전역 변수 (167)

- `var childDB = [], sessionDB = [], scheduleDB = [], assessmentDB = [], activityDB = [], iep` — madi-01-app.js:134
- `var toastTimer = null, toastForceTimer = null, toastLocked = false;` — madi-01-app.js:305
- `var CHILD_PAGE_SIZE = 50, _childCurrentPage = 1, _optionsCacheKey = null, _optionsCacheHtm` — madi-01-app.js:307
- `var _clockTimer = null, _clockVcBound = false;` — madi-01-app.js:362
- `var _inviteCheckTimer = null;` — madi-01-auth.js:25
- `var MODEL_HAIKU = 'claude-haiku-4-5-20251001';` — madi-01.js:2
- `var MODEL_SONNET = 'claude-sonnet-4-6';` — madi-01.js:3
- `var ROLES = {` — madi-01.js:7
- `var DEFAULT_PERMS = { viewOtherChildren:true, deleteSession:true, useAI:true };` — madi-01.js:41
- `var DISORDER_EMOJI = { '언어발달장애':'🗣️','조음음운장애':'👄','유창성장애':'💬','자폐스펙트럼':'🌈','지적장애':'🧩'` — madi-01.js:91
- `var CHILD_COLORS = ['#0ea5a0','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981'];` — madi-01.js:92
- `var TEACHER_COLORS = ['#0ea5a0','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316` — madi-01.js:93
- `var _teacherColorMap = {};` — madi-01.js:94
- `var SUPA_URL = 'https://ujxdhafzjyrglaclarwe.supabase.co';` — madi-01.js:101
- `var CENTER_SESSION_INTERVAL = 40;` — madi-01.js:102
- `var EDGE_URL = 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1';` — madi-01.js:109
- `var _madiToken = null;` — madi-01.js:110
- `var _supaCache = {};` — madi-01.js:177
- `var SUPA_CACHE_TTL = 5 * 60 * 1000;` — madi-01.js:178
- `var _offlineQueue = [];` — madi-01.js:202
- `var _offlineQueueBusy = false;` — madi-01.js:203
- `var currentUser = null;` — madi-01.js:274
- `var _errReportCount = 0;` — madi-01.js:328
- `var _ERR_REPORT_MAX = 5; // 세션당 최대 5건 — DB 폭주 방지` — madi-01.js:329
- `var ERROR_LOG_MAX = 100;` — madi-02.js:63
- `var apiUsage = { calls: 0, inputTokens: 0, outputTokens: 0, byModel: {} };` — madi-02.js:64
- `var BACKUP_DB_NAME = 'madi_backup_db';` — madi-02.js:292
- `var BACKUP_STORE = 'daily_backups';` — madi-02.js:293
- `var BACKUP_KEEP = 7; // 7일치 보관` — madi-02.js:294
- `var _DP_VOUCHER_PRICE = {` — madi-03-dashboard.js:458
- `var _madiApiKey = '';` — madi-03.js:2
- `var ALL_PANELS_NEW = ['panelHome','panel0','panel1','panel2','panel3','panel4','panel5','p` — madi-03.js:433
- `var TAB_PANEL_MAP = ['panel2','panel0','panelReport','panelPortfolio','panelService','pane` — madi-03.js:435
- `var _bcMap = { '-1':'', '0':'캘린더', '1':'아동 관리', '2':'보고서', '3':'포트폴리오', '4':'서비스 관리', '5':` — madi-03.js:462
- `var currentReportTab = 'session';` — madi-03.js:601
- `var currentPortfolioTab = 'trend';` — madi-03.js:631
- `var _bannerNotices = [];` — madi-03.js:658
- `var _bannerIdx = 0;` — madi-03.js:659
- `var _bannerTimer = null;` — madi-03.js:660
- `var _bannerClosed = false;` — madi-03.js:661
- `var noticeDB = [];` — madi-03.js:728
- `var _wakeLock = null;` — madi-03.js:893
- `var _pwaInstallPrompt = null;` — madi-03.js:894
- `var _VOUCHER_BADGE_MAP = {` — madi-04.js:69
- `var _staffTrendChart = null;` — madi-04.js:580
- `var inputMode = 0;` — madi-05.js:1
- `var recognition = null, isRecording = false;` — madi-05.js:11
- `var goalRows = [];` — madi-05.js:61
- `var phonemeData = {}; // { 'ㅅ': {initial:70, medial:40, final:30}, ... }` — madi-05.js:100
- `var COMMON_PHONEMES = ['ㅅ','ㄹ','ㄷ','ㄴ','ㅈ','ㅊ','ㅆ','ㅉ','ㅎ','ㄱ','ㅋ','ㅌ','ㅍ','ㅂ'];` — madi-05.js:102
- `var _addChildLock = false;` — madi-05.js:307
- `var _searchDebounced = debounce(function() { renderChildGrid(); }, 250);` — madi-05.js:723
- `var _childStatusFilter = '등록';` — madi-05.js:729
- `var _bulkMode = false;` — madi-05.js:732
- `var _bulkSelected = {}; // { childId: true }` — madi-05.js:733
- `var _currentVisibleIds = []; // renderChildGrid에서 채워짐` — madi-05.js:734
- `var _bcEscHandler = null;` — madi-06.js:1
- `var VOUCHER_KINDS = ['발달재활바우처','우리아이심리지원서비스바우처','꿈E든카드바우처','나래사랑카드바우처'];` — madi-06.js:401
- `var _showDischargedInSession = false;` — madi-06.js:679
- `var _sessionSaveBusy = false; // 더블탭 중복 저장 방지` — madi-07.js:9
- `var sessionListExpanded = false;` — madi-07.js:244
- `var _dcmCallback = null;` — madi-07.js:386
- `var _dcmEscHandler = null;` — madi-07.js:387
- `var devChartObj = null;` — madi-07.js:483
- `var phonemeChartObj = null;` — madi-07.js:599
- `var _phonemePos = 'all'; // 'all' | 'initial' | 'medial' | 'final'` — madi-07.js:600
- `var _selectedPhonemes = null; // null = 전체` — madi-07.js:601
- `var _preBriefingShownKey = '';` — madi-09.js:206
- `var _schedModalRelease = null;` — madi-10.js:2
- `var schedView = 'month';` — madi-10.js:133
- `var schedCurrentDate = new Date();` — madi-10.js:134
- `var _schedTeacherFilter = '전체';` — madi-10.js:165
- `var _weekViewMode = 'therapist';` — madi-10.js:166
- `var _weekDupOnly = false;` — madi-10.js:167
- `var _lastTeacherBarKey = '';` — madi-10.js:168
- `var _teacherList = [];` — madi-10.js:205
- `var _schedModalDate = null;` — madi-10.js:570
- `var PRES_NORMS = {` — madi-11.js:62
- `var REVT_EQ_R = {` — madi-11.js:109
- `var REVT_EQ_E = {` — madi-11.js:127
- `var REVT_PCT_TABLE = {` — madi-11.js:143
- `var SELSI_EQ_R = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16` — madi-11.js:217
- `var SELSI_EQ_E = [1,2,2,3,3,4,4,5,5,6,7,7,8,8,9,9,10,10,11,11,12,12,13,14,14,15,15,16,16,1` — madi-11.js:218
- `var SELSI_PCT_TABLE = {` — madi-11.js:221
- `var UTAP_NORMS = {` — madi-11.js:258
- `var SYNCOMP_NORMS = {` — madi-11.js:279
- `var LANGSOLVE_NORMS = {` — madi-11.js:290
- `var _assessInterpPlain = '';` — madi-11.js:528
- `var ASSESS_SCHEMA = {` — madi-11.js:631
- `var chatHistory = [];` — madi-12-chat.js:7
- `var chatOpen = false;` — madi-12-chat.js:8
- `var chatWaiting = false;` — madi-12-chat.js:9
- `var CHAT_HISTORY_MAX = 100;` — madi-12-chat.js:138
- `var CHAT_MACROS = {` — madi-12-chat.js:358
- `var chatRecognition = null;` — madi-12-chat.js:473
- `var isChatRecording = false;` — madi-12-chat.js:474
- `var _permUserId = null;` — madi-12.js:2
- `var _permData = {};` — madi-12.js:3
- `var PERM_LIST = [` — madi-12.js:5
- `var _pollTimer = null;` — madi-12.js:218
- `var _pollInterval = 30000; // 30초마다 갱신 (기존 10초 → 3배 감소, Supabase API 호출 절감)` — madi-12.js:219
- `var _myChangeTs = 0;` — madi-12.js:220
- `var _lastActivityTs = Date.now(); // 사용자 마지막 활동 시각 (유휴 시 폴링 스킵)` — madi-12.js:221
- `var _IDLE_THRESHOLD = 5 * 60 * 1000; // 5분 비활성 시 폴링 중단` — madi-12.js:222
- `var GITHUB_OWNER = 'namga1541-prog';` — madi-12.js:322
- `var GITHUB_REPO = 'MADI';` — madi-12.js:323
- `var GITHUB_FILE = 'index.html';` — madi-12.js:324
- `var GITHUB_SW = 'sw.js';` — madi-12.js:325
- `var _swNow = new Date();` — madi-12.js:330
- `var SW_BUILD = 'madi-v5-' + _swNow.toISOString().slice(0,10).replace(/-/g,'')` — madi-12.js:331
- `var SW_LINES = [` — madi-12.js:334
- `var SW_CODE = SW_LINES.join(String.fromCharCode(10));` — madi-12.js:436
- `var _pwaPrompt = null;` — madi-12.js:1176
- `var SI_TESTS = [` — madi-13.js:4
- `var DDST_DOMAINS = [` — madi-13.js:18
- `var KDST_DOMAINS = [` — madi-13.js:26
- `var SP2_DOMAINS = [` — madi-13.js:36
- `var SP2_PATTERNS = [` — madi-13.js:53
- `var SP2_LEVELS = ['또래보다 매우 적음', '또래보다 적음', '또래와 유사', '또래보다 많음', '또래보다 매우 많음'];` — madi-13.js:62
- `var _libraryFiles = []; // 자료 첨부 File 객체 배열 (최대 5개)` — madi-14-board.js:493
- `var libraryPostsDB = []; // 자료실 데이터 캐시 (editLibraryPost에서 참조)` — madi-14-board.js:494
- `var LIBRARY_CATEGORIES = ['조음·음운', '언어발달', '유창성', '인지·학습', '부모교육', '평가도구', '기타'];` — madi-14-board.js:496
- `var NOTICE_TYPE_OPTS = [` — madi-14-board.js:831
- `var _loungePostImages = []; // 글 작성 폼 첨부 File 객체 배열 (최대 3장)` — madi-14.js:2
- `var _loungeCommentImages = {}; // { postId: File } 댓글 첨부 1장` — madi-14.js:3
- `var MAX_IMG_BYTES = 5 * 1024 * 1024; // 5MB` — madi-14.js:115
- `var ALLOWED_IMAGE_MIMES = ['image/jpeg','image/png','image/gif','image/webp'];` — madi-14.js:117
- `var currentBoardTab = 'global';` — madi-14.js:201
- `var _boardLoadGen = 0;` — madi-14.js:203
- `var globalNoticesDB = [];` — madi-14.js:206
- `var centerNoticesDB = [];` — madi-14.js:207
- `var loungePostsDB = [];` — madi-14.js:208
- `var loungeCommentsCache = {}; // { post_id: [comments...] } 펼친 글의 댓글만` — madi-14.js:209
- `var loungeExpandedPosts = {}; // { post_id: true } 댓글 영역 펼친 글` — madi-14.js:210
- `var centersByIdCache = null; // null=미로드, {}=로드됨 (슈퍼어드민이 센터 이름 표시용)` — madi-14.js:211
- `var _parentSignupMatchedChildren = []; // lookup 결과 캐시` — madi-15-pages.js:301
- `var _obsCategories = {` — madi-15-pages.js:633
- `var _parentCurrentTab = 'home';` — madi-15.js:5
- `var MADI_VAPID_PUBLIC_KEY = 'BNH0y5wZW_nzhS5IG_6pMYAKmeDYoPWIkc9msFfNXyAsSxAeCzYjtEpW4NDdk` — madi-15.js:7
- `var _quickRec = null; // SpeechRecognition 인스턴스` — madi-16.js:7
- `var _quickRecActive = false; // 받아쓰기 진행 중 여부` — madi-16.js:8
- `var _quickCurrentSchedId = null; // 현재 폼이 열린 스케줄 id` — madi-16.js:9
- `var _quickPhotoDataUrl = ''; // 사진 dataURL (선택 시)` — madi-16.js:10
- `var _quickNextGoals = []; // 다음 목표 체크박스 상태 [{name, checked}]` — madi-16.js:11
- `var _quickOriginalSummary = ''; // 폼 열릴 때 요약 초기값 (미저장 감지용)` — madi-16.js:12
- `var _QUICK_PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'i` — madi-16.js:18
- `var _QUICK_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2MB (base64 인코딩 시 ~2.7MB → jsonb 부담 완화)` — madi-16.js:19
- `var _QUICK_SUMMARY_MAX_LEN = 1500; // 한 줄 요약 최대 길이` — madi-16.js:20
- `var _QUICK_AI_INPUT_MAX_LEN = 8000; // AI 정리 입력 최대 길이 (서버 413 방지)` — madi-16.js:21
- `var _QUICK_GOAL_MAX_LEN = 100; // 다음 목표 1건 최대 길이` — madi-16.js:22
- `var _QUICK_GOAL_MAX_COUNT = 20; // 다음 목표 최대 개수` — madi-16.js:23
- `var _QUICK_DRAFT_KEY_PREFIX = 'madi_quick_draft_'; // sessionStorage 임시저장 키 prefix` — madi-16.js:24
- `var _QUICK_DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // 임시저장 유효 시간: 6시간` — madi-16.js:25
- `var _quickSaveDraftDeb = (typeof debounce === 'function') ? debounce(_quickSaveDraft, 600)` — madi-16.js:67
- `var _quickBackfillBusy = false;` — madi-16.js:680
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

## madi-01-app.js (50함수)
  ▸ _Supabase DB 로드 / 저장_ — L11
- `_isoDaysAgo` — madi-01-app.js:14
- `loadDBFromSupabase` — madi-01-app.js:20
- `safeMap` — madi-01-app.js:38
- `_loadOlderHistory` — madi-01-app.js:59
- `safeMap` — madi-01-app.js:67
- `saveChildren` — madi-01-app.js:83
- `getSaveErrMsg` — madi-01-app.js:92
- `_userErrMsg` — madi-01-app.js:101
- `saveSessions` — madi-01-app.js:111
- `saveSchedule` — madi-01-app.js:119
- `saveAssess` — madi-01-app.js:126
- `loadDB` — madi-01-app.js:135
  ▸ _아동 연령 실시간 갱신_ — L140
- `refreshChildAges` — madi-01-app.js:144
- `saveIEP` — madi-01-app.js:153
- `loadIEPFromSupa` — madi-01-app.js:163
- `saveActivities` — madi-01-app.js:171
- `loadActivitiesFromSupa` — madi-01-app.js:176
  ▸ _커스텀 confirm 모달 (브라우저 confirm 대체)_ — L182
- `attachModalA11y` — madi-01-app.js:190
- `focusables` — madi-01-app.js:193
- `onKey` — madi-01-app.js:199
- `showInputPrompt` — madi-01-app.js:226
- `close` — madi-01-app.js:258
- `doCancel` — madi-01-app.js:262
- `doOk` — madi-01-app.js:263
- `showConfirm` — madi-01-app.js:280
- `close` — madi-01-app.js:296
- `doCancel` — madi-01-app.js:297
- `debounce` — madi-01-app.js:306
- `showToast` — madi-01-app.js:309
- `vibrate` — madi-01-app.js:336
- `toggleDarkMode` — madi-01-app.js:337
- `loadDarkMode` — madi-01-app.js:343
- `updateHeaderClock` — madi-01-app.js:347
- `startHeaderClock` — madi-01-app.js:363
- `fetchWithRetry` — madi-01-app.js:374
- `doFetch` — madi-01-app.js:378
- `setupNetworkMonitor` — madi-01-app.js:391
- `showOfflineBanner` — madi-01-app.js:392
- `hideOfflineBanner` — madi-01-app.js:398
- `applyParentUI` — madi-01-app.js:404
- `_initParentSidebar` — madi-01-app.js:429
- `resetParentUI` — madi-01-app.js:469
- `loadParentDashboard` — madi-01-app.js:492
- `toggleMoreMenu` — madi-01-app.js:499
- `closeMoreMenu` — madi-01-app.js:500
- `getRoleFlags` — madi-01-app.js:507
- `validatePasswordStrength` — madi-01-app.js:513
- `generateClientId` — madi-01-app.js:521
- `applyUserUI` — madi-01-app.js:531
- `updateKbOffset` — madi-01-app.js:562

## madi-01-auth.js (22함수)
- `showLanding` — madi-01-auth.js:13
- `hideLanding` — madi-01-auth.js:14
- `backToLanding` — madi-01-auth.js:15
- `showLoginScreen` — madi-01-auth.js:16
- `hideLoginScreen` — madi-01-auth.js:17
- `loadUserList` — madi-01-auth.js:18
- `onInviteCodeInput` — madi-01-auth.js:26
- `showSignupScreen` — madi-01-auth.js:46
- `backToLoginFromSignup` — madi-01-auth.js:53
- `doSignup` — madi-01-auth.js:55
- `doLogin` — madi-01-auth.js:137
  ▸ _SEC6: 2FA 필요 시 6자리 입력 모달 표시_ — L151
- `_promptTotpCode` — madi-01-auth.js:196
- `getMadiLogoSVG` — madi-01-auth.js:218
  ▸ _Web Vitals 계측 (2026-05-21 최적화 효과 검증용)_ — L226
- `_initWebVitals` — madi-01-auth.js:231
- `showLogoutMenu` — madi-01-auth.js:304
- `doLogout` — madi-01-auth.js:329
- `showLoginUpdatePopup` — madi-01-auth.js:384
- `_renderLoginUpdatePopup` — madi-01-auth.js:402
- `_dismiss` — madi-01-auth.js:434
- `_onKey` — madi-01-auth.js:444
- `showChangePasswordModal` — madi-01-auth.js:456
- `submitChangePassword` — madi-01-auth.js:488

## madi-01.js (43함수)
  ▸ _상수_ — L1
- `isAdminRole` — madi-01.js:14
- `isStaffRole` — madi-01.js:15
- `escHtml` — madi-01.js:22
- `toKST` — madi-01.js:33
- `nowKST` — madi-01.js:34
- `ymd` — madi-01.js:35
- `getTodayKST` — madi-01.js:36
- `getMonthKST` — madi-01.js:37
- `fmtDateKR` — madi-01.js:39
- `canDo` — madi-01.js:42
- `isMyChild` — madi-01.js:48
- `applyPermissions` — madi-01.js:56
- `getAIModel` — madi-01.js:66
- `saveAIModelChoice` — madi-01.js:70
- `updateAIModelUI` — madi-01.js:77
- `getTeacherColor` — madi-01.js:95
- `loadCenterSessionInterval` — madi-01.js:103
- `getToken` — madi-01.js:116
- `setToken` — madi-01.js:117
- `clearToken` — madi-01.js:118
- `safeSetItem` — madi-01.js:123
- `_purgeLegacyCnCache` — madi-01.js:132
  ▸ _방어 유틸 함수 (Direction A — 반복 크래시 패턴 원천 차단)_ — L141
- `safeGetItem` — madi-01.js:143
- `safeGetSessionItem` — madi-01.js:148
- `safeSetSessionItem` — madi-01.js:153
- `safeJsonParse` — madi-01.js:158
- `safeCmp` — madi-01.js:166
  ▸ _─_ — L172
  ▸ _supaFetch GET 캐시 (2026-05-21 최적화)_ — L174
- `_supaCacheClone` — madi-01.js:179
- `_supaCacheGet` — madi-01.js:183
- `_supaCacheSet` — madi-01.js:189
- `supaCacheInvalidate` — madi-01.js:192
- `supaCacheClearAll` — madi-01.js:199
  ▸ _오프라인 쓰기 큐_ — L201
- `_oqSave` — madi-01.js:207
- `_oqEnqueue` — madi-01.js:208
- `_oqFlush` — madi-01.js:213
  ▸ _─_ — L225
- `supaFetch` — madi-01.js:227
- `hashPassword` — madi-01.js:275
- `getCenterId` — madi-01.js:280
- `_loadScriptOnce` — madi-01.js:284
- `ensureXLSX` — madi-01.js:301
- `ensureChart` — madi-01.js:311
- `centerFilter` — madi-01.js:319
  ▸ _글로벌 에러 모니터링_ — L325
- `_reportClientError` — madi-01.js:331
  ▸ _MADI 네임스페이스 (점진적 캡슐화용)_ — L385

## madi-02.js (37함수)
  ▸ _보안: API 키 마스킹 / 토글_ — L1
- `maskApiKey` — madi-02.js:2
- `showMaskedApiKey` — madi-02.js:7
- `editApiKey` — madi-02.js:20
- `onApiKeyFocus` — madi-02.js:32
- `onApiKeyBlur` — madi-02.js:33
- `toggleApiKeyVisibility` — madi-02.js:41
- `maskPII` — madi-02.js:55
  ▸ _운영 모니터링: 에러 로깅 + 토큰 사용량_ — L62
- `loadApiUsage` — madi-02.js:66
- `saveApiUsage` — madi-02.js:73
- `recordApiUsage` — madi-02.js:77
- `estimateCost` — madi-02.js:88
- `resetApiUsage` — madi-02.js:104
- `_sanitizeForErrorLog` — madi-02.js:114
- `pushErrorLog` — madi-02.js:125
- `getErrorLog` — madi-02.js:157
- `clearErrorLog` — madi-02.js:161
- `renderDebugInfo` — madi-02.js:170
- `statCard` — madi-02.js:179
- `copyErrorLog` — madi-02.js:230
- `setupGlobalErrorHandler` — madi-02.js:257
  ▸ _데이터 안전망: IndexedDB 자동 백업_ — L291
- `openBackupDB` — madi-02.js:296
- `putBackup` — madi-02.js:310
- `listBackups` — madi-02.js:322
- `getBackup` — madi-02.js:339
- `deleteBackup` — madi-02.js:350
- `quickHash` — madi-02.js:362
- `buildBackupSnapshot` — madi-02.js:371
- `autoBackup` — madi-02.js:396
- `pruneOldBackups` — madi-02.js:415
- `maybeAutoBackup` — madi-02.js:423
  ▸ _백업 복원_ — L432
- `restoreFromBackup` — madi-02.js:433
- `_execRestoreFromBackup` — madi-02.js:441
- `applyBackup` — madi-02.js:452
- `renderBackupList` — madi-02.js:484
- `deleteBackupConfirm` — madi-02.js:521
- `callClaude` — madi-02.js:532
- `parseJSON` — madi-02.js:566
  ▸ _센터 API 키 관리 (선택지 2)_ — L625

## madi-03-dashboard.js (24함수)
  ▸ _대시보드 렌더링 (madi-03.js 에서 분리, 2026-05-23)_ — L1
- `_dpInitial` — madi-03-dashboard.js:13
- `_dpAvatarClass` — madi-03-dashboard.js:17
- `_dpMonday` — madi-03-dashboard.js:23
- `_dpSunday` — madi-03-dashboard.js:31
- `_dpFmtMD` — madi-03-dashboard.js:36
- `_dpAge` — madi-03-dashboard.js:37
- `_dpGreetingFor` — madi-03-dashboard.js:47
- `_dpTodayBanner` — madi-03-dashboard.js:54
- `_dpFreshnessLabel` — madi-03-dashboard.js:61
- `_startDpFreshnessTimer` — madi-03-dashboard.js:73
- `_stopDpFreshnessTimer` — madi-03-dashboard.js:84
  ▸ _─_ — L100
  ▸ _─_ — L102
- `renderDashboardTeacher` — madi-03-dashboard.js:103
- `_isMine` — madi-03-dashboard.js:114
  ▸ _HTML_ — L173
  ▸ _비동기: 라운지 답변 대기 메시지_ — L379
- `_dpLoadTeacherMessages` — madi-03-dashboard.js:384
  ▸ _─_ — L453
  ▸ _─_ — L455
- `_dpEstSessionPrice` — madi-03-dashboard.js:466
- `_dpFmtWon` — madi-03-dashboard.js:471
- `_dpToggleRevBreakdown` — madi-03-dashboard.js:477
- `renderDashboardAdmin` — madi-03-dashboard.js:488
  ▸ _데이터 계산_ — L506
- `_tsKey` — madi-03-dashboard.js:553
- `_tsBucket` — madi-03-dashboard.js:554
  ▸ _HTML_ — L589
- `_pt` — madi-03-dashboard.js:703
  ▸ _하단 2열: 운영 알림 + 빠른 액션_ — L773
- `_dpRenderTeacherRows` — madi-03-dashboard.js:882
- `_dpLoadAdminTeacherTable` — madi-03-dashboard.js:911
- `_dpRenderTeacherTable` — madi-03-dashboard.js:955

## madi-03.js (45함수)
- `loadCenterApiKey` — madi-03.js:4
- `saveCenterApiKey` — madi-03.js:41
- `toggleCenterKeyVisibility` — madi-03.js:72
  ▸ _센터 관리_ — L85
- `formatInviteExpiry` — madi-03.js:87
- `loadCenterInfo` — madi-03.js:100
- `copyInviteCode` — madi-03.js:123
- `regenInviteCode` — madi-03.js:133
- `addStaffAccount` — madi-03.js:171
- `loadStaffMgmtList` — madi-03.js:212
- `removeStaffAccountFromBtn` — madi-03.js:239
- `removeStaffAccount` — madi-03.js:244
  ▸ _관리자 페이지 이동 (TASK-008: admin.html 분리)_ — L256
- `goToAdmin` — madi-03.js:257
- `applyRoleUI` — madi-03.js:265
- `resetMaroPos` — madi-03.js:282
- `getApiKeyOrAlert` — madi-03.js:296
  ▸ _탭 전환_ — L300
  ▸ _새 탭 구조 (7개)_ — L301
  ▸ _홈 대시보드_ — L304
- `showDashboard` — madi-03.js:305
  ▸ _대시보드 라우터_ — L328
- `renderDashboard` — madi-03.js:331
  ▸ _레거시 (이전 단일 디자인) — fallback 보존_ — L363
- `renderDashboardLegacy` — madi-03.js:364
  ▸ _사이드바 active 동기화_ — L437
- `syncSidebarActive` — madi-03.js:438
  ▸ _사이드바 토글 (상태 localStorage 저장)_ — L444
- `toggleSidebar` — madi-03.js:445
- `restoreSidebarState` — madi-03.js:452
  ▸ _Breadcrumb 업데이트_ — L461
- `updateBreadcrumb` — madi-03.js:463
- `updateSidebarAdminVisibility` — madi-03.js:472
- `switchTab` — madi-03.js:483
  ▸ _보고서 서브탭_ — L600
- `switchReportTab` — madi-03.js:602
  ▸ _포트폴리오 서브탭_ — L630
- `switchPortfolioTab` — madi-03.js:632
  ▸ _공지 배너_ — L657
- `startNoticeBanner` — madi-03.js:663
- `_renderBannerSlide` — madi-03.js:696
- `closeNoticeBanner` — madi-03.js:720
  ▸ _공지사항_ — L727
- `loadNotices` — madi-03.js:729
- `renderNoticeList` — madi-03.js:747
- `saveNotice` — madi-03.js:779
- `fanoutNoticeNotifications` — madi-03.js:807
- `fanoutSessionNotification` — madi-03.js:833
- `deleteNotice` — madi-03.js:872
  ▸ _서비스관리_ — L889
- `initUserSettings` — madi-03.js:897
- `updateSettingsUI` — madi-03.js:902
  ▸ _글자 크기_ — L941
- `setFontSize` — madi-03.js:942
  ▸ _화면 항상 켜짐_ — L952
- `toggleWakeLock` — madi-03.js:953
  ▸ _진동 피드백_ — L975
- `toggleHaptic` — madi-03.js:976
  ▸ _시작 탭_ — L985
- `setStartTab` — madi-03.js:986
  ▸ _PWA 홈 화면 추가_ — L992
- `showPWAInstall` — madi-03.js:993
- `closePWAGuide` — madi-03.js:1004
  ▸ _비밀번호 변경_ — L1009
- `changeMyPassword` — madi-03.js:1010
- `setResult` — madi-03.js:1016
  ▸ _─_ — L1045
  ▸ _─_ — L1049

## madi-04.js (14함수)
- `renderServiceStats` — madi-04.js:1
- `_populateSvcFilters` — madi-04.js:37
- `_voucherBadge` — madi-04.js:75
- `_svcStatusInfo` — madi-04.js:83
- `_schedStatus` — madi-04.js:94
- `changeSchedStatus` — madi-04.js:100
- `renderMonthlyService` — madi-04.js:112
- `renderDailyService` — madi-04.js:241
  ▸ _정산 요약_ — L362
- `renderSettlement` — madi-04.js:363
- `exportSettlementExcel` — madi-04.js:492
  ▸ _선생님별 통계_ — L579
- `initSvcStaffMonth` — madi-04.js:582
- `renderStaffStats` — madi-04.js:597
- `showStaffTrendFromCard` — madi-04.js:708
- `showStaffTrend` — madi-04.js:713
  ▸ _입력 모드_ — L796

## madi-05.js (35함수)
- `setInputMode` — madi-05.js:2
  ▸ _음성 입력_ — L10
- `toggleVoiceInput` — madi-05.js:12
  ▸ _목표 입력 행_ — L60
- `loadGoalRows` — madi-05.js:62
- `updateCloneBtnState` — madi-05.js:74
- `getLastSessionForChild` — madi-05.js:87
  ▸ _음소 오류 매트릭스_ — L99
- `initPhonemeChips` — madi-05.js:104
- `togglePhonemeMatrix` — madi-05.js:114
- `addPhonemeRow` — madi-05.js:129
- `makePhonemeCell` — madi-05.js:165
- `getPhonemeClass` — madi-05.js:173
- `onPhonemeInput` — madi-05.js:182
- `removePhonemeRow` — madi-05.js:192
- `updatePhonemeCount` — madi-05.js:201
- `getPhonemeSnapshot` — madi-05.js:216
- `resetPhonemeMatrix` — madi-05.js:232
- `cloneLastSession` — madi-05.js:249
- `renderGoalRows` — madi-05.js:284
- `addGoalRow` — madi-05.js:299
- `removeGoalRow` — madi-05.js:300
  ▸ _아동 등록_ — L306
- `getTreatDuration` — madi-05.js:310
- `getClosedDuration` — madi-05.js:324
- `getVoucherUsed` — madi-05.js:339
- `deleteChild` — madi-05.js:349
- `closeChild` — madi-05.js:400
- `reopenChild` — madi-05.js:416
- `renderChildGrid` — madi-05.js:431
- `getPageNumbers` — madi-05.js:701
- `goToChildPage` — madi-05.js:717
- `onChildSearchInput` — madi-05.js:724
  ▸ _아동 일괄 처리 모드_ — L731
- `toggleBulkMode` — madi-05.js:736
- `bulkToggleSelect` — madi-05.js:751
- `bulkSelectAllVisible` — madi-05.js:766
- `updateBulkCountLabel` — madi-05.js:783
- `bulkChangeStatus` — madi-05.js:789
- `applyBulkStatus` — madi-05.js:806
  ▸ _일괄 종결일 입력 모달_ — L832

## madi-06.js (28함수)
- `openBulkClosedDateModal` — madi-06.js:2
- `_bcEscHandler` — madi-06.js:39
- `toggleBcdReasonEtc` — madi-06.js:43
- `closeBulkClosedDateModal` — madi-06.js:51
- `confirmBulkClosedDate` — madi-06.js:57
- `setChildStatus` — madi-06.js:89
- `openChildRegModal` — madi-06.js:99
- `m_updateAge` — madi-06.js:144
- `addChildFromModal` — madi-06.js:155
- `toggleChildCard` — madi-06.js:185
- `openChildDetail` — madi-06.js:191
- `schedRow` — madi-06.js:206
- `goToSession` — madi-06.js:256
  ▸ _아동 편집 모달_ — L283
- `openEditModal` — madi-06.js:284
- `setEditPayType` — madi-06.js:403
- `selectEditVoucherKind` — madi-06.js:428
- `calcEditCopay` — madi-06.js:441
- `updateEditAge` — madi-06.js:472
- `saveEditModal` — madi-06.js:490
- `closeEditModal` — madi-06.js:551
  ▸ _검색 셀렉트 공통_ — L555
- `updateSSDrop` — madi-06.js:556
- `makeSearchable` — madi-06.js:583
  ▸ _세션탭 종결 아동 포함 토글_ — L678
- `toggleDischargedInSession` — madi-06.js:681
- `populateChildSelects` — madi-06.js:693
  ▸ _발화 샘플 분석 (MLU · TTR)_ — L795
- `toggleSpeechPanel` — madi-06.js:796
- `analyzeSpeechSample` — madi-06.js:808
- `runSpeechAnalysis` — madi-06.js:829
- `appendSpeechResultToMemo` — madi-06.js:859

## madi-07.js (23함수)
  ▸ _본인 세션 판별 (teacher_id 우선, 레거시는 이름 폴백)_ — L1
- `_isMySession` — madi-07.js:2
  ▸ _세션 저장_ — L8
- `saveSession` — madi-07.js:10
- `saveSessionAI` — madi-07.js:63
- `_resetAISaveBtn` — madi-07.js:112
  ▸ _기능 2: 가정 활동 추천 AI_ — L150
- `suggestHomeActivities` — madi-07.js:151
  ▸ _세션 목록_ — L242
- `toggleSessionListExpand` — madi-07.js:245
- `renderSessionList` — madi-07.js:250
- `editSessionDate` — madi-07.js:355
  ▸ _삭제 확인 모달_ — L385
- `showDeleteConfirm` — madi-07.js:388
- `_dcmEscHandler` — madi-07.js:411
- `checkDcmInput` — madi-07.js:415
- `closeDcmModal` — madi-07.js:426
- `executeDcm` — madi-07.js:432
- `deleteSession` — madi-07.js:437
  ▸ _차트_ — L482
- `renderChart` — madi-07.js:484
  ▸ _기능 3: 발달 정체 자동 감지 + W7 액션 제안_ — L598
- `renderPhonemeChart` — madi-07.js:603
- `renderPhonemeMatrixTable` — madi-07.js:727
- `togglePhonemeFilter` — madi-07.js:762
- `setPhonemePos` — madi-07.js:775
- `detectStagnation` — madi-07.js:781
- `_resetStagnBtn` — madi-07.js:815
- `renderStagnationResult` — madi-07.js:831
- `stagnationActionMeta` — madi-07.js:887
  ▸ _기능 4: 부모 보고서_ — L898

## madi-08.js (25함수)
- `generateReport` — madi-08.js:1
- `resetBtn` — madi-08.js:37
- `renderReport` — madi-08.js:59
- `copyKakao` — madi-08.js:75
- `downloadPDF` — madi-08.js:90
  ▸ _마크다운 → HTML 변환 (보고서 표 렌더링용)_ — L113
- `markdownToHtml` — madi-08.js:114
- `flushTable` — madi-08.js:120
- `inlineBold` — madi-08.js:141
  ▸ _전문 평가 보고서 PDF 출력_ — L170
- `downloadAssessPDF` — madi-08.js:171
  ▸ _보고서 인라인 편집 토글_ — L214
- `toggleReportEdit` — madi-08.js:215
  ▸ _장단기계획(IEP) 자동 생성_ — L232
- `generateIEP` — madi-08.js:233
- `resetIEPBtn` — madi-08.js:319
- `renderIEP` — madi-08.js:352
- `monthBlock` — madi-08.js:355
- `renderIEPHistory` — madi-08.js:465
- `loadIEPRecord` — madi-08.js:498
- `renderIEPView` — madi-08.js:508
- `monthBlock` — madi-08.js:511
- `downloadIEPPDFById` — madi-08.js:556
- `deleteIEPRecord` — madi-08.js:563
- `downloadIEPPDF` — madi-08.js:588
- `monthSection` — madi-08.js:596
  ▸ _W5: 활동 자료 카탈로그_ — L636
  ▸ _W8: 효과 통계 대시보드_ — L637
- `renderEffectStats` — madi-08.js:638
- `avgGoalScore` — madi-08.js:670
- `statCard` — madi-08.js:690
  ▸ _W5+W8: 활동 자료 카탈로그 (검색/필터 추가)_ — L745

## madi-09.js (19함수)
  ▸ _W6: 회기 후 자동 브리핑 모달_ — L2
- `showPostSessionBriefing` — madi-09.js:3
- `closePostBriefing` — madi-09.js:107
  ▸ _W7: 자동 배경 정체 체크 (규칙 기반, API 호출 없음)_ — L112
- `checkAutoStagnation` — madi-09.js:113
- `showStagnationAlert` — madi-09.js:164
  ▸ _W6: 회기 전 브리핑 카드_ — L205
- `checkUpcomingSessionBriefing` — madi-09.js:207
  ▸ _Word(.doc) 다운로드 → 한글에서 열어 HWP 저장_ — L307
- `downloadWordDoc` — madi-09.js:308
  ▸ _기능 5: 월간 포트폴리오_ — L360
- `generatePortfolio` — madi-09.js:361
- `_resetPortfolioBtn` — madi-09.js:429
  ▸ _포트폴리오 DB 저장 (UPSERT)_ — L459
- `_savePortfolioToDB` — madi-09.js:461
  ▸ _포트폴리오 가시성 토글 (선생님 OPEN/CLOSE)_ — L508
- `togglePortfolioVisibility` — madi-09.js:509
  ▸ _포트폴리오 히스토리 로드·렌더_ — L537
- `renderPortfolioHistory` — madi-09.js:538
  ▸ _포트폴리오 삭제_ — L586
- `deletePortfolio` — madi-09.js:587
  ▸ _아동 선택 변경 시 히스토리 자동 로드_ — L601
- `onPortfolioChildChange` — madi-09.js:602
- `renderPortfolio` — madi-09.js:608
  ▸ _기능 6: 자연어 검색_ — L714
- `naturalSearch` — madi-09.js:715
- `_resetAskBtn` — madi-09.js:749
  ▸ _기능 7: 부모 FAQ 답변_ — L767
- `generateFAQ` — madi-09.js:768
- `_resetFAQBtn` — madi-09.js:808
- `copyFAQText` — madi-09.js:830
  ▸ _유틸_ — L845

## madi-10.js (43함수)
  ▸ _생년월일 숫자 입력 처리_ — L4
- `formatBirthInput` — madi-10.js:5
- `parseBirth` — madi-10.js:9
- `calcAgeFromBirth` — madi-10.js:18
  ▸ _미작성 세션 알림_ — L33
- `getUnwrittenSessions` — madi-10.js:34
- `renderUnwrittenAlert` — madi-10.js:53
- `toggleUwBody` — madi-10.js:96
- `toggleUwTeacher` — madi-10.js:104
- `quickFillSession` — madi-10.js:113
  ▸ _스케줄_ — L132
- `setSchedView` — madi-10.js:136
- `moveSchedPeriod` — madi-10.js:154
- `renderTeacherFilter` — madi-10.js:170
- `setTeacherFilter` — madi-10.js:194
- `switchToDay` — madi-10.js:200
- `buildTeacherOptions` — madi-10.js:207
- `loadTeacherList` — madi-10.js:216
- `renderSchedView` — madi-10.js:225
- `renderMonthGrid` — madi-10.js:231
- `toLocal` — madi-10.js:240
- `toggleWeekViewMode` — madi-10.js:291
- `renderWeekGrid` — madi-10.js:296
  ▸ _일일 뷰_ — L388
- `renderDayGrid` — madi-10.js:389
  ▸ _모바일: 치료사별 카드 리스트_ — L417
  ▸ _PC: 기존 테이블_ — L454
- `renderSessionListForPeriod` — madi-10.js:530
- `openSchedModalForChild` — madi-10.js:573
- `openSchedModal` — madi-10.js:589
- `autoCalcEndTime` — madi-10.js:635
- `toggleRepeatOpt` — madi-10.js:649
- `toggleDayChip` — madi-10.js:670
- `closeSchedModal` — madi-10.js:671
- `saveSchedFromModal` — madi-10.js:676
- `openEditSchedModal` — madi-10.js:741
- `goToSessionFromSched` — madi-10.js:780
- `renderWeekGridByChild` — madi-10.js:801
- `confirmSchedDelete` — madi-10.js:861
- `execSchedDeleteChoice` — madi-10.js:894
- `execSchedDelete` — madi-10.js:903
- `saveEditSched` — madi-10.js:947
  ▸ _일정 내보내기_ — L973
- `openScheduleExportModal` — madi-10.js:974
- `fmt` — madi-10.js:983
- `closeScheduleExportModal` — madi-10.js:1006
- `_getExportRows` — madi-10.js:1011
- `exportSchedule` — madi-10.js:1041
- `_printSchedule` — madi-10.js:1073
- `_exportScheduleRtf` — madi-10.js:1108
  ▸ _표준화 검사_ — L1128

## madi-11.js (27함수)
- `calcLivingAge` — madi-11.js:3
  ▸ _아동 + 검사일 → 생활연령 표시_ — L21
- `onAssessChildChange` — madi-11.js:22
  ▸ _원점수 → 등가연령·백분위 AI 자동 계산_ — L57
  ▸ _PRES 백분위 규준_ — L60
- `getPRESAgeGroup` — madi-11.js:75
- `lookupPRES` — madi-11.js:89
  ▸ _REVT 등가연령 규준 (표-28 수용어휘)_ — L107
- `getREVTAgeKey` — madi-11.js:170
- `interpolatePct` — madi-11.js:198
  ▸ _SELSI 등가연령 규준 (표-34, 35)_ — L215
- `getSELSIAgeKey` — madi-11.js:238
  ▸ _U-TAP 자음정확도 규준 (부록2, 강정태1998)_ — L256
- `judgeUTAP` — madi-11.js:266
  ▸ _언어문제해결력검사 백분위 (연령별)_ — L288
- `lookupSynComp` — madi-11.js:301
  ▸ _생활연령 파싱 (age 문자열 → 개월수)_ — L314
- `parseAgeToMonths` — madi-11.js:317
  ▸ _통합 자동 계산 함수_ — L328
- `autoCalcAssessScores` — madi-11.js:329
- `setField` — madi-11.js:352
  ▸ _PRES_ — L358
  ▸ _SELSI_ — L372
  ▸ _REVT_ — L402
  ▸ _구문의미이해력검사_ — L426
  ▸ _U-TAP 자음정확도 판정_ — L435
  ▸ _언어문제해결력검사 (PFA 탭에 일시 대응)_ — L450
- `_resetAutoCalcBtn` — madi-11.js:483
  ▸ _중증도 자동 판정_ — L527
- `getSeverityLabel` — madi-11.js:530
- `renderSeveritySummary` — madi-11.js:539
- `copyAssessInterp` — madi-11.js:606
  ▸ _저장 + 바로 보고서 생성_ — L619
- `addAndReport` — madi-11.js:620
- `renderAssessFields` — madi-11.js:702
- `getAssessFieldValues` — madi-11.js:738
- `addAssessment` — madi-11.js:750
  ▸ _검사명 변경 시: 이전 입력 자동저장 → 필드 다시 그리기_ — L793
- `onAssessTypeChange` — madi-11.js:794
- `formatAssessScores` — madi-11.js:799
- `renderAssessmentList` — madi-11.js:812
- `deleteAssessment` — madi-11.js:833
- `generateAssessReport` — madi-11.js:863
  ▸ _자동저장: 현재 입력된 검사 결과가 있으면 먼저 저장_ — L871
  ▸ _배경정보 4개 필드 통합 (각 라벨과 함께 정리)_ — L915
  ▸ _부모 교육 자료_ — L1034
- `generateParentEdu` — madi-11.js:1035
- `printParentEdu` — madi-11.js:1083
  ▸ _데이터 이전_ — L1110

## madi-12-chat.js (35함수)
  ▸ _플로팅 AI 비서 (madi-12.js 에서 분리, 2026-05-23)_ — L1
  ▸ _플로팅 AI 비서_ — L6
- `toggleChat` — madi-12-chat.js:11
  ▸ _마로 버튼 위치 이동_ — L39
- `initFloatBtnDrag` — madi-12-chat.js:43
  ▸ _좌/우 위치 적용 + 저장_ — L56
- `applySide` — madi-12-chat.js:57
  ▸ _롱프레스 감지 (꾹 누르면 반대편 모서리로 이동)_ — L79
- `_flip` — madi-12-chat.js:83
- `_press` — madi-12-chat.js:96
- `_cancelIfMoved` — madi-12-chat.js:97
- `_release` — madi-12-chat.js:100
- `getChatGreeting` — madi-12-chat.js:126
- `trimChatHistory` — madi-12-chat.js:140
- `addAiMsg` — madi-12-chat.js:146
- `addUserMsg` — madi-12-chat.js:153
- `renderChatMessages` — madi-12-chat.js:159
- `showTypingIndicator` — madi-12-chat.js:184
- `hideTypingIndicator` — madi-12-chat.js:195
- `onChatKeydown` — madi-12-chat.js:200
- `autoResizeChat` — madi-12-chat.js:204
- `sendQuick` — madi-12-chat.js:209
  ▸ _AI 비서 행동 명령 (W2)_ — L216
- `parseAction` — madi-12-chat.js:217
- `executeAction` — madi-12-chat.js:231
- `actAddSchedule` — madi-12-chat.js:248
- `actOpenSessionForChild` — madi-12-chat.js:311
- `actOpenParentReport` — madi-12-chat.js:327
- `actSwitchTab` — madi-12-chat.js:341
- `actShowUnwritten` — madi-12-chat.js:347
  ▸ _매크로 시스템 (W3)_ — L357
- `macroHelp` — madi-12-chat.js:366
- `macroTodayBrief` — madi-12-chat.js:377
- `macroUnwritten` — madi-12-chat.js:402
- `macroWeeklyStatus` — madi-12-chat.js:412
- `macroTopProgress` — madi-12-chat.js:431
- `avg` — madi-12-chat.js:440
- `tryMacro` — madi-12-chat.js:462
  ▸ _채팅 음성 입력 (W3)_ — L472
- `toggleChatVoiceInput` — madi-12-chat.js:476
- `resetChatMicBtn` — madi-12-chat.js:519
- `sendChat` — madi-12-chat.js:529
- `buildChatContext` — madi-12-chat.js:646

## madi-12.js (39함수)
  ▸ _권한 설정 모달_ — L1
- `openPermModal` — madi-12.js:12
- `updatePermToggle` — madi-12.js:67
- `savePermissions` — madi-12.js:77
  ▸ _선생님 계정 관리 (관리자 전용)_ — L115
- `renderStaffCard` — madi-12.js:116
- `saveNewStaff` — madi-12.js:160
- `deleteStaff` — madi-12.js:189
  ▸ _폴링 방식 동기화 (보안 강화 — Realtime 대체)_ — L217
- `initRealtime` — madi-12.js:232
- `markMyChange` — madi-12.js:246
- `stopRealtime` — madi-12.js:248
  ▸ _마디 폴더 핸들 관리 (IndexedDB)_ — L271
- `_openMadiDB` — madi-12.js:272
- `_saveFolderHandle` — madi-12.js:280
- `_loadFolderHandle` — madi-12.js:291
- `getMadiFolderHandle` — madi-12.js:302
  ▸ _GitHub 자동 배포_ — L321
  ▸ _GitHub 배포 — Edge Function 프록시 방식_ — L438
- `_cleanupLegacyGithubToken` — madi-12.js:443
- `deployFileViaProxy` — madi-12.js:452
  ▸ _배포 대상 파일 자동 스캔_ — L476
- `scanMadiFiles` — madi-12.js:479
- `next` — madi-12.js:483
  ▸ _파일 내용 → Git blob SHA-1 계산_ — L506
- `gitBlobSha` — madi-12.js:509
- `pollGithubPagesBuild` — madi-12.js:524
- `poll` — madi-12.js:528
- `deployToGitHub` — madi-12.js:563
- `processImportFile` — madi-12.js:742
- `_processImportFileInner` — madi-12.js:759
- `normalizeDisorderType` — madi-12.js:799
- `parseRowsToChildren` — madi-12.js:811
- `findCol` — madi-12.js:815
- `analyzeImportData` — madi-12.js:880
- `renderImportPreview` — madi-12.js:924
- `confirmImport` — madi-12.js:981
- `_batchPost` — madi-12.js:1065
- `cancelImport` — madi-12.js:1085
  ▸ _초기화_ — L1093
- `init` — madi-12.js:1094
  ▸ _PWA 지원_ — L1175
- `initPWA` — madi-12.js:1178
  ▸ _SW 업데이트 시 자동 새로고침 (설치형 PWA 포함)_ — L1184
- `_swApplyUpdate` — madi-12.js:1193
- `_onVis` — madi-12.js:1206
- `_pwaShouldShowBanner` — madi-12.js:1264
- `showPWABanner` — madi-12.js:1275
- `hidePWABanner` — madi-12.js:1306
- `triggerPWAInstall` — madi-12.js:1320
  ▸ _뒤로가기 버튼 탭 연동_ — L1334
  ▸ _─_ — L1343
  ▸ _─_ — L1345
  ▸ _모듈 초기화_ — L1347

## madi-13.js (10함수)
  ▸ _감각통합(감통) 평가 보고서_ — L1
- `renderSIReport` — madi-13.js:64
- `makeDevRows` — madi-13.js:77
- `onSIChildChange` — madi-13.js:273
- `collectSIData` — madi-13.js:275
- `generateSIReport` — madi-13.js:346
- `fmtDevRow` — madi-13.js:374
- `copySIReport` — madi-13.js:444
  ▸ _감통보고서 — 사용자 정의 검사명 입력_ — L459
- `addCustomSITest` — madi-13.js:461
- `removeCustomSITest` — madi-13.js:498
  ▸ _K-DST 발달수준 색상 시각화_ — L502
- `updateKdstLevelColor` — madi-13.js:504

## madi-14-board.js (32함수)
- `renderLounge` — madi-14-board.js:15
  ▸ _라운지 글 — 권한 기반 필터링_ — L19
- `filterLoungePosts` — madi-14-board.js:21
- `visibilityMeta` — madi-14-board.js:47
- `_signLoungePostImages` — madi-14-board.js:54
- `loadLoungePosts` — madi-14-board.js:73
- `renderLoungeUI` — madi-14-board.js:111
  ▸ _작성 폼_ — L119
  ▸ _글 목록_ — L156
- `renderInquiryCard` — madi-14-board.js:182
- `saveLoungePost` — madi-14-board.js:250
- `deleteLoungePost` — madi-14-board.js:310
  ▸ _라운지 댓글 (6단계)_ — L330
- `toggleComments` — madi-14-board.js:331
- `loadComments` — madi-14-board.js:347
- `renderComments` — madi-14-board.js:374
- `saveComment` — madi-14-board.js:429
- `deleteComment` — madi-14-board.js:469
- `renderLibrary` — madi-14-board.js:498
- `_signLibraryImages` — madi-14-board.js:529
- `_renderLibraryUI` — madi-14-board.js:554
- `setLibCat` — madi-14-board.js:639
- `onLibFilesChange` — madi-14-board.js:644
- `saveLibraryPost` — madi-14-board.js:665
- `deleteLibraryPost` — madi-14-board.js:706
- `_isMyPost` — madi-14-board.js:723
- `openPostEditModal` — madi-14-board.js:738
- `_close` — madi-14-board.js:794
- `_onKey` — madi-14-board.js:798
  ▸ _마디 공지 수정_ — L837
- `editGlobalNotice` — madi-14-board.js:838
  ▸ _센터 공지 수정_ — L863
- `editCenterNotice` — madi-14-board.js:864
  ▸ _고객센터(라운지) 수정 — visibility 는 변경 안 함_ — L889
- `editLoungePost` — madi-14-board.js:890
  ▸ _자료실 수정 — note (카테고리) 도 함께 수정_ — L912
- `editLibraryPost` — madi-14-board.js:913
- `openVocabFeedback` — madi-14-board.js:948
- `closeVocabFeedbackModal` — madi-14-board.js:970
- `submitVocabFeedback` — madi-14-board.js:975

## madi-14.js (25함수)
  ▸ _게시판 이미지 업로드 유틸_ — L1
- `uploadBoardImage` — madi-14.js:7
- `isSafeUrl` — madi-14.js:40
- `renderImageThumbs` — madi-14.js:47
  ▸ _board-images 서명 URL 통합_ — L62
- `_boardImgPath` — madi-14.js:65
- `signBoardImages` — madi-14.js:83
- `_noopMap` — madi-14.js:84
- `onLoungeImagesChange` — madi-14.js:119
- `removeLoungeImage` — madi-14.js:157
- `onCommentImageChange` — madi-14.js:176
- `initBoard` — madi-14.js:214
- `switchBoardTab` — madi-14.js:219
- `renderGlobalNotices` — madi-14.js:247
- `loadGlobalNotices` — madi-14.js:255
- `renderGlobalNoticeUI` — madi-14.js:276
  ▸ _슈퍼어드민 전용 작성 폼_ — L282
  ▸ _공지 목록_ — L302
- `renderGlobalNoticeCard` — madi-14.js:314
- `saveGlobalNotice` — madi-14.js:368
- `togglePopupNotice` — madi-14.js:413
- `deleteGlobalNotice` — madi-14.js:440
- `renderCenterNotices` — madi-14.js:457
- `loadCentersByIdCache` — madi-14.js:472
- `loadCenterNotices` — madi-14.js:482
- `renderCenterNoticeUI` — madi-14.js:517
  ▸ _admin/superadmin 작성 폼_ — L525
  ▸ _공지 목록_ — L547
- `renderCenterNoticeCard` — madi-14.js:561
- `saveCenterNotice` — madi-14.js:605
- `deleteCenterNotice` — madi-14.js:640

## madi-15-pages.js (26함수)
  ▸ _일정 탭_ — L12
- `loadParentSched` — madi-15-pages.js:13
  ▸ _리포트 탭_ — L57
  ▸ _학부모 포트폴리오 탭_ — L58
- `loadParentPortfolio` — madi-15-pages.js:62
- `loadParentReport` — madi-15-pages.js:115
- `_renderParentPortfolioCard` — madi-15-pages.js:118
  ▸ _공지 탭_ — L158
- `loadParentNotice` — madi-15-pages.js:159
- `loadParentNotifications` — madi-15-pages.js:191
- `renderParentNotifList` — madi-15-pages.js:205
- `openParentNotif` — madi-15-pages.js:250
- `markAllNotifRead` — madi-15-pages.js:268
- `formatTimeAgo` — madi-15-pages.js:279
  ▸ _화면 전환: 학부모 가입 화면 표시_ — L303
- `showParentSignupScreen` — madi-15-pages.js:304
  ▸ _학부모 가입 → 로그인 화면 복귀_ — L317
- `backToLoginFromParentSignup` — madi-15-pages.js:318
  ▸ _입력 시 자동 하이픈 (010-1234-5678)_ — L326
- `formatParentPhone` — madi-15-pages.js:327
  ▸ _단계 2 → 단계 1로 되돌리기_ — L340
- `resetParentSignup` — madi-15-pages.js:341
  ▸ _액션 1: 핸드폰 번호로 아동 조회_ — L359
- `parentLookup` — madi-15-pages.js:360
  ▸ _액션 2: 학부모 가입 처리_ — L423
- `parentSignup` — madi-15-pages.js:424
- `_b64UrlToUint8` — madi-15-pages.js:499
- `loadParentPushToggle` — madi-15-pages.js:508
- `onPushToggleTap` — madi-15-pages.js:541
- `_subscribePush` — madi-15-pages.js:551
- `_unsubscribePush` — madi-15-pages.js:612
  ▸ _관찰기록 홈 패널 렌더링 (홈 탭 하단에 삽입)_ — L639
- `loadParentObservations` — madi-15-pages.js:640
- `_renderParentObsForm` — madi-15-pages.js:652
- `submitParentObservation` — madi-15-pages.js:676
- `_loadParentObsList` — madi-15-pages.js:720
- `_renderParentObsCard` — madi-15-pages.js:749

## madi-15.js (23함수)
  ▸ _탭 전환_ — L9
- `switchParentTab` — madi-15.js:10
  ▸ _내 아동 정보 가져오기 (공통)_ — L30
- `getMyChildInfo` — madi-15.js:33
- `_emit` — madi-15.js:36
- `setActiveParentChild` — madi-15.js:96
- `renderParentChildSwitcher` — madi-15.js:125
  ▸ _홈 (페르소나 ⑦)_ — L154
- `loadParentHome` — madi-15.js:156
- `_renderParentHero` — madi-15.js:233
- `_renderParentHeroStats` — madi-15.js:275
- `_renderParentRecentPortfolios` — madi-15.js:289
- `_renderParentNextSchedule` — madi-15.js:349
- `_renderParentWeekSessions` — madi-15.js:374
- `fmt` — madi-15.js:390
- `_loadParentTeacherMessages` — madi-15.js:421
- `_loadParentAssessments` — madi-15.js:430
- `_renderParentChartByScore` — madi-15.js:471
- `_renderParentChart` — madi-15.js:565
- `_renderParentVoucher` — madi-15.js:639
- `_renderParentVoucherUpcoming` — madi-15.js:646
- `_redrawParentVoucherPanel` — madi-15.js:651
- `_renderParentHomeActivities` — madi-15.js:732
- `_toggleParentActivity` — madi-15.js:771
- `_calcAge` — madi-15.js:783
- `_showParentOnboarding` — madi-15.js:795

## madi-16.js (33함수)
  ▸ _─_ — L4
  ▸ _─_ — L6
  ▸ _─_ — L14
  ▸ _─_ — L16
  ▸ _─_ — L27
  ▸ _─_ — L29
- `_quickDraftKey` — madi-16.js:30
- `_quickSaveDraft` — madi-16.js:32
- `_quickLoadDraft` — madi-16.js:49
- `_quickClearDraft` — madi-16.js:62
- `_quickAttachDraftListeners` — madi-16.js:69
  ▸ _─_ — L78
  ▸ _─_ — L80
- `openQuickPanel` — madi-16.js:81
- `_showQuickCardList` — madi-16.js:113
  ▸ _─_ — L121
  ▸ _─_ — L123
- `_quickGetMySchedules` — madi-16.js:124
- `_quickFindSession` — madi-16.js:139
- `_quickFindChild` — madi-16.js:152
  ▸ _─_ — L158
  ▸ _─_ — L160
- `renderQuickCards` — madi-16.js:161
- `_quickRenderCards` — madi-16.js:197
- `_quickTimeAgo` — madi-16.js:229
  ▸ _─_ — L237
  ▸ _─_ — L239
- `openQuickForm` — madi-16.js:240
- `_quickRenderForm` — madi-16.js:270
- `_quickPrefillGoals` — madi-16.js:316
- `_quickFormHtml` — madi-16.js:347
- `_quickPhotoHtml` — madi-16.js:413
- `_quickRenderNextGoals` — madi-16.js:438
- `_quickToggleGoal` — madi-16.js:457
- `_quickRemoveGoal` — madi-16.js:462
- `quickAddGoal` — madi-16.js:467
  ▸ _─_ — L484
  ▸ _─_ — L486
- `quickPickPhoto` — madi-16.js:487
- `quickRemovePhoto` — madi-16.js:520
  ▸ _─_ — L529
  ▸ _─_ — L531
- `quickToggleDictation` — madi-16.js:532
- `_startQuickDictation` — madi-16.js:557
- `_quickStopDictation` — madi-16.js:611
  ▸ _─_ — L626
  ▸ _─_ — L628
- `quickAiClean` — madi-16.js:629
  ▸ _─_ — L675
  ▸ _─_ — L679
- `_quickBackfillOnePhoto` — madi-16.js:681
  ▸ _─_ — L706
  ▸ _─_ — L709
- `_quickNormalizeStorageUrl` — madi-16.js:712
- `_quickUploadPhoto` — madi-16.js:724
  ▸ _─_ — L750
  ▸ _─_ — L752
- `quickSave` — madi-16.js:753
- `closeQuickForm` — madi-16.js:858

## madi-icons.js (6함수)
- `mdIcon` — madi-icons.js:60
- `_mountIcons` — madi-icons.js:75
- `_autoMount` — madi-icons.js:90
  ▸ _빈 상태 일러스트 (D5)_ — L97
- `mdIllust` — madi-icons.js:146
- `mdEmptyState` — madi-icons.js:149
  ▸ _스켈레톤 (D6)_ — L163
- `mdSkeletonList` — madi-icons.js:165

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
