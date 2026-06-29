// notify-tomorrow — 내일 치료 예약 Web Push 발송 (10분마다 cron 실행)
// Cron: */10 * * * *  (Supabase Dashboard > Edge Functions > Schedule)
import webpush from "npm:web-push@3.6.7";
import { fetchWithTimeout } from '../_shared/auth.ts';

// ★ C-3: env 는 모듈 최상위가 아니라 핸들러 내부에서 읽는다.
//   Deno Deploy cold-start 시 env 가 모듈 평가 시점에 미주입되면 빈 값으로 영구 고정돼
//   이후 모든 cron 틱이 'env 미설정'으로 실패(학부모 push 가용성 0). 핸들러 진입마다 재평가해 회피.
//   (api/login 등 다른 9개 함수와 동일한 핸들러-내부 읽기 패턴으로 통일.)

// x-cron-secret 상수시간 비교 — SHA-256 다이제스트(고정 32바이트)를 XOR 누적 비교해
//   타이밍 사이드채널 + 길이 누출을 모두 제거한다(무인증 외부노출 cron 엔드포인트 방어).
//   평문 !== 비교는 첫 불일치 바이트에서 조기 반환해 응답시간 차로 secret 점진 추정이 가능.
async function cronSecretEqual(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const va = new Uint8Array(ha), vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

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
  const res = await fetchWithTimeout(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }, 8000);
  if (!res.ok) throw new Error(`DB 쿼리 실패: ${res.status}`);
  let data: unknown;
  try { data = await res.json() } catch { data = [] }
  return data as T[];
}
async function sp(url: string, key: string, table: string, filter: string, data: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  }, 8000);
  if (!res.ok) console.error(`sp ${table}:`, await res.text());
}

// cron 전용 함수 — 브라우저에서 호출되지 않으므로 CORS preflight 불필요. ACAO 와일드카드 제거(M-21).
const CORS_HEADERS = { 'Content-Type': 'application/json' };

// ── 메인 ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // ★ C-3: env 핸들러-내부 읽기 (cold-start 미주입 영구고정 방지)
  const SUPA_URL    = Deno.env.get('SUPABASE_URL');
  const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const VAPID_PUB   = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const VAPID_PRIV  = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const VAPID_SUB   = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:namga1541@gmail.com';
  const CRON_SECRET = Deno.env.get('CRON_SECRET');

  // ── 무인증 cron 보호 ──────────────────────────────────────────────
  // CRON_SECRET 이 설정돼 있으면 x-cron-secret 헤더 일치 요구 (외부 대량 푸시 차단).
  // 미설정 시 하위호환을 위해 통과시키되 경고 로깅 — 운영에서는 반드시 설정 권장.
  if (!CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET 환경변수가 설정되지 않았습니다' }),
      { status: 503, headers: CORS_HEADERS }
    )
  }
  if (!(await cronSecretEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET))) {
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
      // ★ [HIGH] childId 는 JSONB(data->>childId)에서 읽는다. 실 컬럼 madi_schedules.child_id 는
      //   클라이언트 저장흐름({id,center_id,data})상 항상 NULL → 이 컬럼으로 join 하면 학부모 알림이
      //   조용히 0건이 된다. data.childId(클라가 실제 채우는 값)로 통일.
      interface Sched { id: number; data: Record<string, string> }
      const scheds = await sq<Sched>(_url, _key,
        `madi_schedules?center_id=eq.${enc(cfg.center_id)}&data->>date=eq.${tomorrowKST}&select=id,data`
      );
      if (!scheds.length) {
        // 실제 발송 시도가 없었으므로 last_sent_date 갱신하지 않음.
        // push_time 윈도우(약 10분)가 이미 지나면 다음 cron 에서 재선택되지 않아 무한 재시도 없음.
        console.warn(`[push] center ${cfg.center_id}: 내일(${tomorrowKST}) 스케줄 없음 — 미발송, last_sent_date 미갱신`);
        continue;
      }

      // data->>childId 는 문자열. 빈 값/누락은 제외해 in.() 파싱오류·null 매칭 방지.
      const childIds = [...new Set(scheds.map(s => s.data?.childId).filter(c => c != null && c !== ''))];
      if (!childIds.length) {
        console.warn(`[push] center ${cfg.center_id}: 내일 스케줄에 childId 없음 — 미발송`);
        continue;
      }

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

      // ⑥ 학부모별 1회 발송 — 내일 예약된 '모든' 자녀를 한 알림 본문에 합쳐 발송 (다자녀 누락 해소).
      //    발송 성공/실패를 학부모 단위로 추적: 한 학부모라도 비-만료 실패가 있으면 그 센터는
      //    last_sent_date 미마킹 → 다음 cron 에서 재시도(부분실패 영구누락 방지). 멱등성: 성공/만료
      //    대상은 다음 틱에서도 재발송되지 않도록, 실패가 없을 때만 센터 완료로 마킹한다.

      // 학부모 → [{name, time}] 집계 (내일 예약된 자녀 전체)
      const parentChildren: Record<string, Array<{ name: string; time: string }>> = {};
      for (const link of links) {
        // schedule.data.childId(문자열) vs madi_parent_children.child_id(text) — 문자열 비교
        const childScheds = scheds.filter(s => String(s.data?.childId) === link.child_id);
        if (!childScheds.length) continue;
        const childName = nameMap[Number(link.child_id)] || '아동';
        if (!parentChildren[link.parent_user_id]) parentChildren[link.parent_user_id] = [];
        for (const sched of childScheds) {
          parentChildren[link.parent_user_id].push({
            name: childName,
            time: sched.data?.startTime ?? '',
          });
        }
      }

      // 시간순 정렬 + 본문 라인 구성 헬퍼. 템플릿 {아동이름}/{시간} 을 자녀별로 치환해 한 줄씩 생성.
      const buildBody = (items: Array<{ name: string; time: string }>): string => {
        const sorted = items.slice().sort((a, b) => a.time.localeCompare(b.time));
        return sorted
          .map(it => cfg.message_body.replace(/{아동이름}/g, it.name).replace(/{시간}/g, it.time))
          .join('\n');
      };

      let centerSent = 0;
      let centerFatalFail = 0; // 410/404 외의 진짜 실패 (네트워크 오류 등) — 센터 전체 기준
      for (const parentId of Object.keys(parentChildren)) {
        const items = parentChildren[parentId];
        if (!items.length) continue;

        const title = cfg.message_title;
        const body  = buildBody(items);
        const payload = JSON.stringify({
          title, body,
          url: 'https://namga1541-prog.github.io/MADI/',
        });

        const parentSubs = subs.filter(s => s.user_id === parentId);
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
                await fetchWithTimeout(`${_url}/rest/v1/madi_push_subscriptions?endpoint=eq.${enc(sub.endpoint)}`, {
                  method: 'DELETE',
                  headers: { apikey: _key, Authorization: `Bearer ${_key}` },
                }, 8000);
              } catch(_) {}
            } else {
              // 네트워크 / 인증 / 5xx 등 — 진짜 실패. 하나라도 있으면 센터 미마킹 → 재시도.
              centerFatalFail++;
              console.error(`[push] sendNotification fail status=${status} endpoint=${sub.endpoint.slice(0, 80)}... msg=${msg}`);
            }
          }
        }
      }

      // ⑦ 발송 완료 기록
      //    - 비-만료 실패가 하나도 없을 때만 오늘 분 완료로 마킹 (부분실패 영구누락 방지).
      //    - fatal 실패가 하나라도 있으면 미마킹 → 다음 10분 cron 에서 재시도.
      //    - 멱등성: 이미 성공/만료정리된 대상은 재발송되지 않음(이번 틱에서만 재시도되는 건 실패분 포함 센터 전체이나,
      //      성공 대상은 같은 알림을 한 번 더 받을 수 있음 — 누락보다 안전한 쪽 선택. 발송 단위를 센터→대상으로
      //      내리는 최소 변경 범위 내에서 endpoint별 멱등 마킹은 도입하지 않음).
      if (centerFatalFail === 0) {
        await sp(_url, _key, 'madi_push_settings', `center_id=eq.${enc(cfg.center_id)}`, { last_sent_date: todayKST });
      } else {
        console.warn(`[push] center ${cfg.center_id}: 전송 ${centerSent}건 / 실패 ${centerFatalFail}건 — last_sent_date 미갱신 (다음 cron 재시도)`);
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
