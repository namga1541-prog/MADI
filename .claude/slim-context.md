──────── MADI 공통 컨텍스트 ────────
프로젝트: 언어치료 센터 관리 웹앱 / GitHub Pages 정적 배포
경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)

[필독 — 먼저 읽기]
- ARCHITECTURE.md : 불변 사실(ID 문자열·toKST·저장흐름·서버보안·전역변수). 보고 전 "흔한 오탐 주의" 대조.
- FUNCTIONS.md    : 이름→파일:라인 인덱스. 통독 금지 — 줄번호 찾아 ±20줄만 Read.

[코딩 규칙]
- var / function / .then() 스타일 유지 — let/const/화살표함수/class 미사용
- template literal(백틱) 사용 가능
- console.log 운영 코드 추가 금지
- escHtml() 없이 innerHTML에 사용자 데이터 삽입 금지

[DB 접근]
- 반드시 supaFetch() 경유 (직접 fetch + anon key 금지)
- 패턴: supaFetch('table?col=eq.val', 'GET').then(function(rows){...}).catch(function(e){ showToast('⚠️ '+e.message); })

[DB 스키마]
- 정본: **SCHEMA.md** 참조 (컬럼 표를 여기 복붙하지 말 것 — 사본 드리프트 방지).
- 핵심만: 임상 데이터(children/sessions/schedules/assessments/iep)는 {id, center_id, data JSONB} 제네릭 구조.
  madi_settings 는 전역(center_id 없음). madi_users 에 status 컬럼 없음(400 유발).

[UI 패턴]
- 성공: showToast('✅ 저장됨')   오류: showToast('⚠️ 메시지')
- 역할 분기: if(currentUser.role==='superadmin'){} else if(currentUser.role==='admin'){} else {} // teacher

[커밋 규칙]
- 파일마다 Read → Edit 순서 (Read 없이 Edit 금지)
- 작업 완료 후 반드시: git add -A && git commit && git push origin main
────────────────────────────────────
