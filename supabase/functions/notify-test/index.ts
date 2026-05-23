/**
 * /notify-test — 관리자 전용 즉시 푸시 알림 테스트 발송
 *
 * 보안:
 * - 자체 JWT 인증 필수 (httpOnly 쿠키 또는 Authorization: Bearer)
 * - role === 'admin' || 'superadmin' 만 허용 — teacher/parent 차단
 * - 호출자의 center_id 에 속한 학부모 구독에만 발송 (다른 센터 침범 방지)
 *
 * 요청: POST (body 없음 또는 { title?, body? } 로 메시지 오버라이드)
 * 응답: { ok, sent, parents, subs, reason? }
 */
import webpush from "npm:web-push@3.6.7";

// ── CORS ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://namga1541-prog.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null',
]);

function makeCORS(origin: string | null): Record<string, string> {
  const o = origin ?? 'null';
  const acao = ALLOWED_ORIGINS.has(o) ? o : 'https://namga1541-prog.github.io';
  return {
    'Access-Control-Allow-Origin':      acao,
    'Access-Control-Allow-Headers':     'authorization, content-type',
    'Access-Control-Allow-Methods':     'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

function getCookieToken(req: Request): string {
  const cookie = req.headers.get('cookie') || '';
  const match  = cookie.match(/(?:^|;\s*)madi_session=([^;]+)/);
  return match ? match[1] : '';
}

// ── JWT 검증 (ai-proxy 패턴 재사용) ─────────────────────────────────────
async function verifyJwt(token: string, secret: string) {
  const [header, body, sig] = token.split('.');
  if (!header || !body || !sig) throw new Error('JWT 형식 오류');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const b64 = sig.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const sigBytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) sigBytes[i] = raw.charCodeAt(i);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${body}`));
  if (!valid) throw new Error('JWT 서명 불일치');
  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT 만료');
  return payload;
}

// ── 메인 핸들러 ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const JWT_SECRET = Deno.env.get('MADI_JWT_SECRET');
  const SUPA_URL   = Deno.env.get('SUPABASE_URL');
  const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const VAPID_PUB  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const VAPID_SUB  = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:namga1541@gmail.com';

  if (!JWT_SECRET || !SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  if (!VAPID_PUB || !VAPID_PRIV) {
    return new Response(JSON.stringify({ error: 'VAPID 키 미설정' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // 인증
  const auth        = req.headers.get('Authorization') || '';
  const bearerToken = auth.replace('Bearer ', '').trim();
  const token       = getCookieToken(req) || bearerToken;
  let user: Record<string, unknown>;
  try { user = await verifyJwt(token, JWT_SECRET); } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // 권한 검증: admin 또는 superadmin 만
  const role = String(user.role || '');
  if (role !== 'admin' && role !== 'superadmin') {
    return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const centerId = String(user.center_id || '');
  if (!centerId) {
    return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // 메시지 오버라이드 (선택)
  let title = '🧪 MADI 테스트 알림';
  let body  = '푸시 알림이 정상적으로 도착했습니다.';
  try {
    const reqBody = await req.json();
    if (typeof reqBody?.title === 'string' && reqBody.title.trim()) title = reqBody.title.trim().slice(0, 100);
    if (typeof reqBody?.body  === 'string' && reqBody.body.trim())  body  = reqBody.body.trim().slice(0, 300);
  } catch { /* body 없으면 기본값 사용 */ }

  // 센터별 학부모 ID 조회 (madi_users where role='parent' and center_id matches)
  const parentRes = await fetch(
    `${SUPA_URL}/rest/v1/madi_users?role=eq.parent&center_id=eq.${encodeURIComponent(centerId)}&select=id`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  if (!parentRes.ok) {
    return new Response(JSON.stringify({ ok: false, reason: '학부모 조회 실패' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const parents = await parentRes.json() as Array<{ id: string }>;
  if (!parents.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, parents: 0, subs: 0, reason: '이 센터에 학부모 계정이 없음' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const parentIds = parents.map(p => p.id);
  const idsParam  = parentIds.map(encodeURIComponent).join(',');

  // 구독 조회
  const subsRes = await fetch(
    `${SUPA_URL}/rest/v1/madi_push_subscriptions?user_id=in.(${idsParam})&select=user_id,endpoint,p256dh,auth`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  if (!subsRes.ok) {
    return new Response(JSON.stringify({ ok: false, reason: '구독 조회 실패' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const subs = await subsRes.json() as Array<{ user_id: string; endpoint: string; p256dh: string; auth: string }>;
  if (!subs.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, parents: parents.length, subs: 0, reason: '구독한 학부모가 없음. 학부모가 알림 토글을 켜야 합니다.' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // VAPID 설정
  try { webpush.setVapidDetails(VAPID_SUB, VAPID_PUB, VAPID_PRIV); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, reason: 'VAPID 초기화 오류: ' + msg }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // 발송
  const payload = JSON.stringify({ title, body, url: 'https://namga1541-prog.github.io/MADI/' });
  let sent = 0;
  let expired = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        // 만료된 구독 정리
        await fetch(
          `${SUPA_URL}/rest/v1/madi_push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
          { method: 'DELETE', headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
        );
        expired++;
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, parents: parents.length, subs: subs.length, expired }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
