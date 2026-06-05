// notify-tomorrow — 내일 치료 예약 Web Push 발송 (10분마다 cron 실행)
// Cron: */10 * * * *  (Supabase Dashboard > Edge Functions > Schedule)
import webpush from "npm:web-push@3.6.7";

const SUPA_URL   = Deno.env.get('SUPABASE_URL');
const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUB  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUB  = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:namga1541@gmail.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// ── KST 헬퍼 ─────────────────────────────────────────────────────────
// KST '오늘'(자정 기준) 날짜를 먼저 구한 뒤 일(day) 단위로 offset 을 더한다.
// 단순히 now+9h 에 offsetDays*24h 를 더하면 KST 자정~09시 구간에서
// (UTC 기준 전날) 날짜가 하루 틀어지는 문제가 있어 날짜 문자열을 파싱해 계산한다.
function kstDate(offsetDays = 0): string {
  const kstTodayStr = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if (offsetDays === 0) return kstTodayStr;
  const [y, m, d] = kstTodayStr.split('-').map(Number);
  // UTC 자정 기준으로 날짜만 다루므로 시간대 영향 없이 offsetDays 가산
  const dt = new Date(Date.UTC(y, m - 1, d) + offsetDays * 24 * 3600_000);
  return dt.toISOString().slice(0, 10);
}
function kstHHMM(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16);
}

// ── Supabase REST 헬퍼 ────────────────────────────────────────────────
async function sq<T>(url: string, key: string, path: string): Promise<T[]> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`DB 쿼리 실패: ${res.status}`);
  let data: unknown;
  try { data = await res.json() } catch { data = [] }
  return data as T[];
}
async function sp(url: string, key: string, table: string, filter: string, data: Record<string, unknown>) {
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) console.error(`sp ${table}:`, await res.text());
}

// cron 전용 함수 — 브라우저에서 호출되지 않으므로 CORS preflight 불필요. ACAO 와일드카드 제거(M-21).
const CORS_HEADERS = { 'Content-Type': 'application/json' };

// ── 메인 ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // ── 무인증 cron 보호 ──────────────────────────────────────────────
  // CRON_SECRET 이 설정돼 있으면 x-cron-secret 헤더 일치 요구 (외부 대량 푸시 차단).
  // 미설정 시 하위호환을 위해 통과시키되 경고 로깅 — 운영에서는 반드시 설정 권장.
  if (!CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET 환경변수가 설정되지 않았습니다' }),
      { status: 503, headers: CORS_HEADERS }
    )
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ ok: false, reason: '인증 실패 (x-cron-secret 불일치)' }), { status: 401, headers: CORS_HEADERS });
  }

  if (!SUPA_URL || !SUPA_KEY) {
    console.error('Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ ok: false, reason: '서버 설정 오류 (env 미설정)' }), { status: 500, headers: CORS_HEADERS });
  }
  const _url = SUPA_URL as string;
  const _key = SUPA_KEY as string;

  const VAPID_BAD = !VAPID_PUB || !VAPID_PRIV
    || VAPID_PUB === 'REPLACE_ME' || VAPID_PRIV === 'REPLACE_ME'
    || VAPID_PUB.length < 43 || VAPID_PRIV.length < 43;
  if (VAPID_BAD) {
    return new Response(JSON.stringify({ ok: false, reason: 'VAPID 키 미설정 또는 placeholder' }), { status: 200, headers: CORS_HEADERS });
  }

  try {
    webpush.setVapidDetails(VAPID_SUB, VAPID_PUB, VAPID_PRIV);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, reason: 'VAPID 초기화 오류: ' + msg }), { status: 200, headers: CORS_HEADERS });
  }

  const nowHHMM     = kstHHMM();
  const todayKST    = kstDate(0);
  const tomorrowKST = kstDate(1);
  const [curH, curM] = nowHHMM.split(':').map(Number);
  const winStart    = curH * 60 + curM;
  const winEnd      = winStart + 9; // 10분 윈도우

  // ① 발송 대상 센터 (enabled=true, 오늘 미발송, push_time 이 현재 10분 윈도우 내)
  interface PushCfg {
    center_id: string; push_time: string;
    message_title: string; message_body: string;
    last_sent_date: string | null;
  }
  const allCfg = await sq<PushCfg>(_url, _key,
    'madi_push_settings?enabled=eq.true&select=center_id,push_time,message_title,message_body,last_sent_date'
  );
  const targets = allCfg.filter(s => {
    if (s.last_sent_date === todayKST) return false;
    const [h, m] = s.push_time.split(':').map(Number);
    const t = h * 60 + m;
    return t >= winStart && t <= winEnd;
  });

  if (!targets.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, checked: allCfg.length }), { status: 200, headers: CORS_HEADERS });
  }

  let totalSent = 0;

  for (const cfg of targets) {
    try {
      const enc = (s: string) => encodeURIComponent(s);

      // ② 내일 스케줄 (data->>'date' = tomorrow)
      interface Sched { id: number; child_id: number; data: Record<string, string> }
      const scheds = await sq<Sched>(_url, _key,
        `madi_schedules?center_id=eq.${enc(cfg.center_id)}&data->>date=eq.${tomorrowKST}&select=id,child_id,data`
      );
      if (!scheds.length) {
        // 실제 발송 시도가 없었으므로 last_sent_date 갱신하지 않음.
        // push_time 윈도우(약 10분)가 이미 지나면 다음 cron 에서 재선택되지 않아 무한 재시도 없음.
        console.warn(`[push] center ${cfg.center_id}: 내일(${tomorrowKST}) 스케줄 없음 — 미발송, last_sent_date 미갱신`);
        continue;
      }

      const childIds = [...new Set(scheds.map(s => s.child_id))];

      // ③ 학부모-자녀 연결
      // center_id 필터로 타 센터 학부모-자녀 연결 침범 방지 (IDOR 차단)
      interface Link { parent_user_id: string; child_id: string }
      const links = await sq<Link>(_url, _key,
        `madi_parent_children?child_id=in.(${childIds.map(c => enc(String(c))).join(',')})&center_id=eq.${enc(cfg.center_id)}&select=parent_user_id,child_id`
      );
      if (!links.length) {
        console.warn(`[push] center ${cfg.center_id}: 학부모-자녀 연결 없음 — 미발송, last_sent_date 미갱신`);
        continue;
      }

      // ④ 아동 이름
      interface Child { id: number; data: { name?: string } }
      const children = await sq<Child>(_url, _key, `madi_children?id=in.(${childIds.map(c => enc(String(c))).join(',')})&select=id,data`);
      const nameMap: Record<number, string> = {};
      children.forEach(c => { nameMap[c.id] = c.data?.name ?? ''; });

      // ⑤ Push 구독 조회
      interface PushSub { user_id: string; endpoint: string; p256dh: string; auth: string }
      const parentIds = [...new Set(links.map(l => l.parent_user_id))];
      const subs = await sq<PushSub>(_url, _key,
        `madi_push_subscriptions?user_id=in.(${parentIds.map(encodeURIComponent).join(',')})&select=user_id,endpoint,p256dh,auth`
      );
      if (!subs.length) {
        console.warn(`[push] center ${cfg.center_id}: 푸시 구독 없음 — 미발송, last_sent_date 미갱신`);
        continue;
      }

      // ⑥ 학부모별 1회 발송 (다자녀면 첫 번째 자녀 기준)
      //    발송 성공/실패 카운트를 추적해 모든 발송이 fatal 실패면 last_sent_date 갱신 보류 → 다음 cron 에서 재시도
      const sentParents = new Set<string>();
      let centerSent = 0;
      let centerFatalFail = 0; // 410/404 외의 진짜 실패 (네트워크 오류 등)
      for (const link of links) {
        if (sentParents.has(link.parent_user_id)) continue;
        // madi_schedules.child_id=bigint, madi_parent_children.child_id=text
        const sched = scheds.find(s => String(s.child_id) === link.child_id);
        if (!sched) continue;

        const childName = nameMap[Number(link.child_id)] || '아동';
        const startTime = sched.data?.startTime ?? '';
        const title = cfg.message_title;
        const body  = cfg.message_body
          .replace(/{아동이름}/g, childName)
          .replace(/{시간}/g, startTime);
        const payload = JSON.stringify({
          title, body,
          url: 'https://namga1541-prog.github.io/MADI/',
        });

        const parentSubs = subs.filter(s => s.user_id === link.parent_user_id);
        for (const sub of parentSubs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            totalSent++;
            centerSent++;
          } catch (e: unknown) {
            const status = (e as { statusCode?: number }).statusCode;
            const msg    = e instanceof Error ? e.message : String(e);
            if (status === 410 || status === 404) {
              // 만료된 구독 삭제 — 정상 정리 흐름이라 실패로 카운트하지 않음
              try {
                await fetch(`${_url}/rest/v1/madi_push_subscriptions?endpoint=eq.${enc(sub.endpoint)}`, {
                  method: 'DELETE',
                  headers: { apikey: _key, Authorization: `Bearer ${_key}` },
                });
              } catch(_) {}
            } else {
              // 네트워크 / 인증 / 기타 — 진짜 실패. 추적 후 임계치 초과 시 재시도용으로 last_sent_date 미갱신.
              centerFatalFail++;
              console.error(`[push] sendNotification fail status=${status} endpoint=${sub.endpoint.slice(0, 80)}... msg=${msg}`);
            }
          }
        }
        sentParents.add(link.parent_user_id);
      }

      // ⑦ 발송 완료 기록
      //    - 한 명이라도 성공했으면 오늘 분 완료로 마킹 (중복 발송 방지)
      //    - 모두 fatal 실패면 미마킹 → 다음 10분 cron 에서 재시도
      if (centerSent > 0 || centerFatalFail === 0) {
        await sp(_url, _key, 'madi_push_settings', `center_id=eq.${enc(cfg.center_id)}`, { last_sent_date: todayKST });
      } else {
        console.warn(`[push] center ${cfg.center_id}: 전송 ${centerSent}/${centerFatalFail} — last_sent_date 미갱신 (다음 cron 재시도)`);
      }
    } catch (e) {
      console.error(`[push] center ${cfg.center_id}:`, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
    status: 200,
    headers: CORS_HEADERS,
  });
});
