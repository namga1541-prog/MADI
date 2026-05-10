// ══════════════════════════════════════
// madi-16.js — 학부모 푸시 알림 구독 모듈 (2026-05-10)
// 역할: 학부모 로그인 시 알림 권한 요청 + 구독 정보 DB 저장
// 의존: madi-01.js (currentUser, supaFetch), madi-15.js (getMyChildInfo, _parentChildId)
// ══════════════════════════════════════

// ─────── VAPID 공개 키 (배포 전 대장님이 직접 입력) ───────
// ⚠️ Public Key만 여기에 — Private Key는 절대 넣지 마세요 (Edge Function Secrets에 입력)
var VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';

// ─────── base64url → Uint8Array 변환 ───────
function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─────── PWA 설치 여부 확인 ───────
function isPWAInstalled() {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
  } catch (e) {}
  return false;
}

// ─────── PWA 설치가 반드시 필요한 환경인지 확인 ───────
// iOS: 설치 필수 (미설치 시 PushManager 없음)
// PC·Android: 설치 없이 브라우저에서 바로 푸시 가능
function needsPWAInstall() {
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isIOS) return false;
  return !isPWAInstalled();
}

// ─────── 환경 지원 여부 (가장 먼저 체크) ───────
function isPushSupported() {
  return ('serviceWorker' in navigator) &&
         ('PushManager' in window) &&
         ('Notification' in window);
}

// ─────── 학부모 홈 알림 카드 UI 갱신 ───────
function updatePushButtonUI() {
  var card = document.getElementById('parentPushCard');
  var btn  = document.getElementById('parentPushBtn');
  var msg  = document.getElementById('parentPushMsg');
  if (!card || !btn) return;

  // 학부모가 아니면 카드 자체 숨김
  if (!currentUser || currentUser.role !== 'parent') {
    card.style.display = 'none';
    return;
  }

  // 푸시 미지원 브라우저 (구형)
  if (!isPushSupported()) {
    card.style.display = 'none';
    return;
  }

  // PWA 미설치 (iOS만 — PC·Android는 브라우저에서 바로 가능)
  if (needsPWAInstall()) {
    card.style.display = 'block';
    btn.textContent = '📱 홈 화면 추가 방법 보기';
    btn.disabled = false;
    btn.onclick = showPWAInstallGuide;
    if (msg) msg.textContent = '알림을 받으려면 먼저 마디를 홈 화면에 추가해주세요';
    return;
  }

  // 권한 거부됨 (다시 못 물어봄)
  if (Notification.permission === 'denied') {
    card.style.display = 'block';
    btn.textContent = '⚠️ 휴대폰 설정에서 허용';
    btn.disabled = false;
    btn.onclick = showPermissionGuide;
    if (msg) msg.textContent = '알림이 차단되어 있어요';
    return;
  }

  // 권한 허용됨 — 구독 상태에 따라 분기
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(function(reg) {
      return reg.pushManager.getSubscription();
    }).then(function(sub) {
      if (sub) {
        // 이미 정상 구독 중 — 카드 숨김
        card.style.display = 'none';
      } else {
        // 권한은 있는데 구독은 끊김 — 다시 구독
        card.style.display = 'block';
        btn.textContent = '🔔 알림 다시 받기';
        btn.disabled = false;
        btn.onclick = subscribeAndSave;
        if (msg) msg.textContent = '알림 구독이 끊겼어요. 다시 활성화해주세요';
      }
    }).catch(function() {
      card.style.display = 'none';
    });
    return;
  }

  // default 상태 — 권한 요청 가능
  card.style.display = 'block';
  btn.textContent = '🔔 알림 받기';
  btn.disabled = false;
  btn.onclick = subscribeAndSave;
  if (msg) msg.textContent = '치료 전날 저녁 8시에 알림을 보내드려요';
}

// ─────── 구독 진행 + DB 저장 ───────
function subscribeAndSave() {
  if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
    alert('⚠️ 관리자 설정 미완료\n\nVAPID 공개 키가 입력되지 않았습니다.\n관리자에게 문의해주세요.');
    return;
  }

  var btn = document.getElementById('parentPushBtn');
  if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }

  navigator.serviceWorker.ready.then(function(reg) {
    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }).then(function(sub) {
    var json = sub.toJSON ? sub.toJSON() : sub;
    var keys = json.keys || {};
    if (!json.endpoint || !keys.p256dh || !keys.auth) {
      throw new Error('구독 정보 누락');
    }

    var row = {
      user_id:    String(currentUser.id),
      child_id:   window._parentChildId || null,
      endpoint:   json.endpoint,
      p256dh:     keys.p256dh,
      auth:       keys.auth,
      device:     (navigator.userAgent || '').slice(0, 80),
      updated_at: new Date().toISOString()
    };

    return supaFetch('madi_push_subscriptions?on_conflict=endpoint', 'POST', [row]);
  }).then(function() {
    if (btn) btn.disabled = false;
    alert('🎉 알림 받기가 활성화되었습니다.\n치료 전날 저녁 8시에 안내가 전송됩니다.');
    updatePushButtonUI();
  }).catch(function(err) {
    if (btn) btn.disabled = false;
    console.error('[madi-16] 구독 실패:', err);
    var emsg = err && err.message ? err.message : String(err);
    alert('알림 설정에 실패했습니다.\n\n원인: ' + emsg + '\n\n잠시 후 다시 시도해주세요.');
    updatePushButtonUI();
  });
}

// ─────── PWA 설치 안내 ───────
function showPWAInstallGuide() {
  var ua = navigator.userAgent || '';
  var msg = '알림을 받으려면 마디를 홈 화면에 추가해주세요.' + '\n\n';

  if (/iPhone|iPad|iPod/.test(ua)) {
    msg += '【iPhone / iPad】' + '\n'
        +  '1. 사파리 하단의 공유 버튼 (네모+화살표) 탭' + '\n'
        +  '2. "홈 화면에 추가" 선택' + '\n'
        +  '3. 추가된 마디 아이콘으로 다시 실행' + '\n\n'
        +  '※ Safari 외 브라우저(크롬/네이버 등)에서는 알림이 동작하지 않습니다';
  } else if (/Android/.test(ua)) {
    msg += '【안드로이드】' + '\n'
        +  '1. 크롬 브라우저 우측 상단 점 3개 메뉴' + '\n'
        +  '2. "홈 화면에 추가" 또는 "앱 설치" 선택' + '\n'
        +  '3. 추가된 마디 아이콘으로 다시 실행';
  } else {
    msg += '브라우저 메뉴에서 "홈 화면에 추가" 또는 "앱 설치"를 선택해주세요.';
  }
  alert(msg);
}

// ─────── 권한 거부 시 안내 ───────
function showPermissionGuide() {
  var ua = navigator.userAgent || '';
  var msg = '알림이 차단되어 있어요. 휴대폰 설정에서 허용해주세요.' + '\n\n';

  if (/iPhone|iPad|iPod/.test(ua)) {
    msg += '【iPhone / iPad】' + '\n'
        +  '설정 > 알림 > 마디(아이마디) > 알림 허용 켜기';
  } else if (/Android/.test(ua)) {
    msg += '【안드로이드】' + '\n'
        +  '설정 > 앱 > 마디 > 알림 > 켜기';
  } else {
    msg += '브라우저 주소창 자물쇠 아이콘 > 알림 > 허용';
  }
  alert(msg);
}

// ─────── 진입점 (madi-01.js 로그인 콜백에서 호출) ───────
function setupParentPushSubscription() {
  if (!currentUser || currentUser.role !== 'parent') return;
  if (!isPushSupported()) return;

  // 학부모 아동 ID 로드 후 UI 갱신 (madi-15.js의 헬퍼 사용)
  if (typeof getMyChildInfo === 'function') {
    getMyChildInfo(function() {
      updatePushButtonUI();
    });
  } else {
    updatePushButtonUI();
  }
}
