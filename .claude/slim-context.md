──────── MADI 공통 컨텍스트 ────────
프로젝트: 언어치료 센터 관리 웹앱 / GitHub Pages 정적 배포
경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)

[코딩 규칙]
- var / function / .then() 스타일 유지 — let/const/화살표함수/class 미사용
- template literal(백틱) 사용 가능
- console.log 운영 코드 추가 금지
- escHtml() 없이 innerHTML에 사용자 데이터 삽입 금지

[DB 접근]
- 반드시 supaFetch() 경유 (직접 fetch + anon key 금지)
- 패턴: supaFetch('table?col=eq.val', 'GET').then(function(rows){...}).catch(function(e){ showToast('⚠️ '+e.message); })

[DB 스키마 핵심 — 존재하지 않는 컬럼 select 시 PostgREST 400 반환]
- madi_users       : id, username, name, password, role, center_id, color, permissions,
                     status, prog_types(JSONB), totp_secret, totp_enabled, locked_until
- madi_centers     : id  (center_id로 사용)
- madi_settings    : key, value  ⚠️ center_id 컬럼 없음 — 전역 테이블
- madi_portfolios  : id, child_id, center_id, parent_visible, month, content, data, created_at
- madi_notifications: id, user_id, center_id, type, title, body, link, read_at, created_at
- madi_audit_log   : id, actor_id, actor_name, action, table_name, record_id, child_id, changed_cols, occurred_at
- madi_push_settings: center_id, enabled, push_time, message_title, message_body, last_sent_date
- madi_rate_limits : key(PK), count, window_start, hour_count, hour_start, updated_at

[UI 패턴]
- 성공: showToast('✅ 저장됨')   오류: showToast('⚠️ 메시지')
- 역할 분기: if(currentUser.role==='superadmin'){} else if(currentUser.role==='admin'){} else {} // teacher

[커밋 규칙]
- 파일마다 Read → Edit 순서 (Read 없이 Edit 금지)
- 작업 완료 후 반드시: git add -A && git commit && git push origin main
────────────────────────────────────
