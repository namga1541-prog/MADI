# Edge Function 환경변수 설정 가이드

내부자 위협 모델링 후속 (2026-05-24) — Anthropic API 키를 madi_settings DB row 에서
Supabase Edge Function Secrets 로 이전하는 절차.

## 🎯 왜 옮기는가?

| 항목 | 이전 (madi_settings) | 이후 (Edge Function Secrets) |
|------|--------------------|------------------------------|
| admin 권한자 키 조회 | ✅ 가능 (RLS 허용) | ❌ 불가 (서버 env var) |
| 키 노출 경로 | UI + DevTools 직접 SELECT | Supabase Dashboard 접근자만 |
| 센터별 다른 키 | 가능 (현 미사용) | 단일 키 (전 센터 통합) |
| 백업·복구 | DB 백업에 포함 | Supabase 콘솔 별도 보관 |

## 📋 절차 (총 약 15분)

### 1. Anthropic Console — 키 확인 또는 신규 발급

- https://console.anthropic.com/settings/keys
- 기존에 사용 중인 키 그대로 쓸 수 있음 (`sk-ant-api03-...`)
- 신규 발급 시 이름: `MADI Production Unified Key` 정도로 명명 권장

### 2. Supabase Dashboard — Secrets 등록

```
1. https://supabase.com/dashboard/project/ujxdhafzjyrglaclarwe
2. 좌측 사이드바: Edge Functions
3. 우측 상단: Secrets (또는 ⋮ 메뉴 → Manage Secrets)
4. "+ Add new secret" 클릭
5. NAME: ANTHROPIC_API_KEY
   VALUE: sk-ant-api03-... (위에서 확인한 키 전체)
6. Save
```

> 🔒 한번 저장되면 Dashboard 에서도 다시 볼 수 없습니다(write-only). 다른 곳에 백업 권장.

### 3. Edge Function 재배포

새 환경변수가 함수에 인식되도록 재배포 필요:

```bash
supabase functions deploy ai-proxy --project-ref ujxdhafzjyrglaclarwe --no-verify-jwt
supabase functions deploy api      --project-ref ujxdhafzjyrglaclarwe --no-verify-jwt
```

### 4. 검증

#### 4-1. 환경변수 인식 확인 (로컬 curl)
```bash
# 정상 로그인 후 받은 토큰으로 ai-proxy 직접 호출
curl -X POST https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1/ai-proxy \
  -H "Content-Type: application/json" \
  -H "Cookie: madi_token=<JWT>" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":50,"messages":[{"role":"user","content":"테스트"}]}'

# 기대: 200 OK + Anthropic 응답
# 실패 (402): 환경변수 미인식 → Dashboard 에서 ANTHROPIC_API_KEY 다시 확인
```

#### 4-2. madi_settings 조회 안 되는지 (정상)
배포 후 ai-proxy 내부 로그를 보면 `Deno.env.get('ANTHROPIC_API_KEY')` 가 우선이라
`madi_settings` 쿼리 자체가 발생하지 않아야 함.

```sql
-- audit log 에서 ai-proxy 가 madi_settings 를 안 건드리는지 확인
SELECT count(*)
FROM madi_audit_log
WHERE table_name = 'madi_settings'
  AND action = 'SELECT'
  AND occurred_at > now() - interval '1 hour';
-- 0 또는 admin UI 진입 시만 (ai-proxy 호출 횟수만큼 늘어나면 안 됨)
```

#### 4-3. UI 동작 확인
- 빠른 기록 모드에서 "✨ AI 정리" 버튼 → 정상 응답
- 보고서 생성 → 정상 응답
- AI 챗 → 정상 응답

### 5. (선택) madi_settings 의 옛 키 폐기

환경변수가 안정적으로 동작하는지 1주일간 모니터링 후, 옛 키를 무효화:

```sql
-- madi_settings 의 api_key row 는 남겨두되 값만 비움
-- (혹시 env var 가 일시적으로 사라져도 명확히 에러 메시지가 뜨도록)
UPDATE madi_settings SET value = '' WHERE key = 'api_key';

-- 또는 완전 삭제 (env var 만 신뢰)
-- DELETE FROM madi_settings WHERE key = 'api_key';
```

Anthropic Console 에서도 옛 키 폐기:
```
1. https://console.anthropic.com/settings/keys
2. 기존 키 → Revoke (이미 등록된 새 키와 다른 키였다면)
```

## 🚨 롤백 절차

새 환경변수가 문제 일으키면:

1. Supabase Dashboard → Edge Functions → Secrets → `ANTHROPIC_API_KEY` 삭제
2. `ai-proxy/index.ts` 의 폴백 로직이 자동으로 `madi_settings.api_key` 사용
3. madi_settings 에 키가 있는지 확인:
   ```sql
   SELECT value FROM madi_settings WHERE key = 'api_key';
   ```

> 코드 자체는 점진 이전(env 우선 + DB fallback) 구조라 별도 코드 롤백 불필요.

## 🔍 운영 모니터링

### 키 사용량 추적
- Anthropic Console: https://console.anthropic.com/usage
- 일일/주간 토큰 사용량 + 비용 자동 그래프
- 임계치 알림 설정 (예: $50/일 초과 시 이메일)

### 이상 패턴 탐지 — Supabase에서 실행
```sql
-- 최근 1시간 ai-proxy 호출 폭주 사용자 식별
SELECT actor_id, actor_role, count(*)
FROM madi_audit_log
WHERE occurred_at > now() - interval '1 hour'
  AND table_name = 'ai_proxy_call'  -- (별도 로깅 도입 시)
GROUP BY actor_id, actor_role
HAVING count(*) > 100
ORDER BY count(*) DESC;
```

(현재 ai-proxy 자체 호출은 audit log 에 안 남음 — 필요 시 [SEC2-4] 별도 작업)

## 📌 한 줄 요약

> Dashboard 에서 시크릿 한 줄 추가하고 `supabase functions deploy ai-proxy` 한 번.
> 총 15분. 사용자 체감 변화 없음. 보안 1단 상승.
