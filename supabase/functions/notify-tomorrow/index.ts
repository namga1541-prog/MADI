// notify-tomorrow — 내일 치료 예약 Web Push 발송 (10분마다 cron 실행)
// Cron: */10 * * * *  (Supabase Dashboard > Edge Functions > Schedule)
import webpush from "npm:web-push@3.6.7";

const SUPA_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUB  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUB  = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:namga1541@gmail.com';

// ── KST 헬퍼 ─────────────────────────────────────────────────────────
function kstDate(offsetDays = 0): string {
  return new Date(Date.now() + (9 + offsetDays * 24) * 3600_000)
    .toISOString().slice(0, 10);
}
function kstHHMM(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16);
}

// ── Supabase REST 헬퍼 ────────────────────────────────────────────────
async function sq<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`sq ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T[]>;
}
async function sp(table: string, filter: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) console.error(`sp ${table}:`, await res.text());
}

// ── 메인 ─────────────────────────────────────────────────────────────
Deno.serve(async () => {
  const VAPID_BAD = !VAPID_PUB || !VAPID_PRIV
    || VAPID_PUB === 'REPLACE_ME' || VAPID_PRIV === 'REPLACE_ME'
    || VAPID_PUB.length < 43 || VAPID_PRIV.length < 43;
  if (VAPID_BAD) {
    return new Response(JSON.stringify({ ok: false, reason: 'VAPID 키 미설정 또는 placeholder' }), { status: 200 });
  }

  try {
    webpush.setVapidDetails(VAPID_SUB, VAPID_PUB, VAPID_PRIV);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, reason: 'VAPID 초기화 오류: ' + msg }), { status: 200 });
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
  const allCfg = await sq<PushCfg>(
    'madi_push_settings?enabled=eq.true&select=center_id,push_time,message_title,message_body,last_sent_date'
  );
  const targets = allCfg.filter(s => {
    if (s.last_sent_date === todayKST) return false;
    const [h, m] = s.push_time.split(':').map(Number);
    const t = h * 60 + m;
    return t >= winStart && t <= winEnd;
  });

  if (!targets.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, checked: allCfg.length }), { status: 200 });
  }

  let totalSent = 0;

  for (const cfg of targets) {
    try {
      const enc = (s: string) => encodeURIComponent(s);

      // ② 내일 스케줄 (data->>'date' = tomorrow)
      interface Sched { id: number; child_id: number; data: Record<string, string> }
      const scheds = await sq<Sched>(
        `madi_schedules?center_id=eq.${enc(cfg.center_id)}&data->>date=eq.${tomorrowKST}&select=id,child_id,data`
      );
      if (!scheds.length) {
        await sp('madi_push_settings', `center_id=eq.${enc(cfg.center_id)}`, { last_sent_date: todayKST });
        continue;
      }

      const childIds = [...new Set(scheds.map(s => s.child_id))];

      // ③ 학부모-자녀 연결
      interface Link { parent_user_id: string; child_id: string }
      const links = await sq<Link>(
        `madi_parent_children?child_id=in.(${childIds.join(',')})&select=parent_user_id,child_id`
      );
      if (!links.length) {
        await sp('madi_push_settings', `center_id=eq.${enc(cfg.center_id)}`, { last_sent_date: todayKST });
        continue;
      }

      // ④ 아동 이름
      interface Child { id: number; data: { name?: string } }
      const children = await sq<Child>(`madi_children?id=in.(${childIds.join(',')})&select=id,data`);
      const nameMap: Record<number, string> = {};
      children.forEach(c => { nameMap[c.id] = c.data?.name ?? ''; });

      // ⑤ Push 구독 조회
      interface PushSub { user_id: string; endpoint: string; p256dh: string; auth: string }
      const parentIds = [...new Set(links.map(l => l.parent_user_id))];
      const subs = await sq<PushSub>(
        `madi_push_subscriptions?user_id=in.(${parentIds.map(encodeURIComponent).join(',')})&select=user_id,endpoint,p256dh,auth`
      );
      if (!subs.length) {
        await sp('madi_push_settings', `center_id=eq.${enc(cfg.center_id)}`, { last_sent_date: todayKST });
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
              await fetch(`${SUPA_URL}/rest/v1/madi_push_subscriptions?endpoint=eq.${enc(sub.endpoint)}`, {
                method: 'DELETE',
                headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
              });
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
        await sp('madi_push_settings', `center_id=eq.${enc(cfg.center_id)}`, { last_sent_date: todayKST });
      } else {
        console.warn(`[push] center ${cfg.center_id}: 전송 ${centerSent}/${centerFatalFail} — last_sent_date 미갱신 (다음 cron 재시도)`);
      }
    } catch (e) {
      console.error(`[push] center ${cfg.center_id}:`, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
