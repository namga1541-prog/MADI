# 출시 절차 런북

PWA 를 양 스토어에 실제로 올리는 단계별 가이드.

## 🤖 Google Play (TWA / Bubblewrap)

### 옵션 1 — PWABuilder (가장 쉬움, 권장)

```
1. https://www.pwabuilder.com/ 접속
2. URL 입력: https://namga1541-prog.github.io/MADI/
3. "Start" 클릭 → manifest / SW / 보안 점수 확인
4. 좌측 "Package For Stores" 클릭
5. "Android" 패키지 선택
   - Package ID: kr.madi.app (또는 com.madi.app)
   - App version: 1
   - App version name: 1.0.0
   - Signing key:
     ✓ "Generate new signing key" 선택 (처음)
     ✓ 다운로드된 .keystore 파일은 분실 시 영원히 업데이트 불가 — 안전 보관 필수
6. "Generate" → .zip 다운로드
7. 압축 해제 → app-release-signed.aab 파일이 핵심
8. Play Console > 내부 테스트 > 새 버전 만들기 > AAB 업로드
```

### 옵션 2 — Bubblewrap CLI (커스터마이징 필요 시)

```bash
# JDK 17 + Android SDK 필요
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://namga1541-prog.github.io/MADI/manifest.json
# 질문에 답변 (Package ID, signing key 등)
bubblewrap build
# → app-release-signed.aab 생성
```

### Digital Asset Links (필수)
TWA 는 웹사이트와 앱의 소유자가 같음을 증명해야 URL 바가 사라집니다.

```
1. PWABuilder/Bubblewrap 생성 시 출력된 assetlinks.json 파일 받기
2. GitHub repo 의 .well-known/assetlinks.json 으로 커밋
   경로: https://namga1541-prog.github.io/.well-known/assetlinks.json
3. 검증: https://developers.google.com/digital-asset-links/tools/generator
```

> ⚠️ GitHub Pages 는 .well-known 경로를 기본 서비스함. 별도 설정 불필요.
> 단 사용자 페이지(`namga1541-prog.github.io`)는 root 에 .well-known 가 있어야 함.
> 프로젝트 페이지(`/MADI/`) 에서는 `https://namga1541-prog.github.io/.well-known/assetlinks.json` 가 인식되지 않을 수 있음 → **커스텀 도메인 검토 필요**

### Play Console 제출 체크리스트
- [ ] 스토어 등록정보: 02-STORE_LISTING_KO.md 내용 복붙
- [ ] 그래픽 에셋: 1024×500 피처, 512 아이콘, 스크린샷 ≥3장
- [ ] 콘텐츠 등급: 04-ASO_KEYWORDS.md 설문 응답
- [ ] 대상 사용자층: 만 13세 이상 (만 14세 미만 동의 절차 있음)
- [ ] 데이터 안전: 04-ASO_KEYWORDS.md 표 그대로 입력
- [ ] 정부 앱 여부: 아니오
- [ ] 광고 포함 여부: 아니오
- [ ] 앱 액세스: 모든 기능 무료 (테스트 계정 불필요 명시)
- [ ] 14일 테스트 통과 (신규 개인 계정만)

---

## 🍎 App Store (Capacitor)

PWABuilder 는 iOS 도 지원하지만 결국 Xcode 가 필요합니다.

### 사전 준비
- macOS (가상머신·임대 Mac 가능 — MacInCloud 등)
- Xcode 15+ 설치
- Apple Developer 계정 활성
- Bundle ID 등록: developer.apple.com → Certificates, Identifiers & Profiles

### 옵션 1 — PWABuilder (Capacitor 자동 생성)

```
1. PWABuilder 에서 "iOS" 패키지 선택
2. 다운로드된 .zip 해제 → Xcode 프로젝트 폴더
3. Xcode 로 .xcworkspace 열기
4. Signing & Capabilities > Team 선택
5. Bundle ID = kr.madi.app 확인
6. App Icon Set 에 1024×1024 추가 (icon-1024.png)
7. Product > Archive → Distribute App → App Store Connect 업로드
```

### 옵션 2 — Capacitor 직접 설정

```bash
# Node 18+ 필요
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "마디" "kr.madi.app" --web-dir=. --skip-prompts

# capacitor.config.json 편집:
# {
#   "server": {
#     "url": "https://namga1541-prog.github.io/MADI/",
#     "cleartext": false
#   }
# }

npx cap add ios
npx cap sync ios
npx cap open ios
# → Xcode 가 열림, 위와 동일하게 Archive 진행
```

### App Store Connect 제출 체크리스트
- [ ] 앱 정보:
  - Primary Language: Korean
  - Category: Medical (또는 Business) / Education
  - Content Rights: 본인 소유 ✅
- [ ] 가격 및 사용 가능 여부: 무료 / 모든 국가 (또는 한국만)
- [ ] 앱 개인정보 보호 (App Privacy): 04-ASO_KEYWORDS.md 표
- [ ] 미리보기 및 스크린샷: iPhone 6.9" + 6.5" 각 1장 이상
- [ ] 프로모션 텍스트: 02-STORE_LISTING_KO.md "프로모션 텍스트"
- [ ] 설명: 02-STORE_LISTING_KO.md "전체 설명"
- [ ] 키워드: 04-ASO_KEYWORDS.md "App Store 키워드 필드"
- [ ] 지원 URL / 마케팅 URL: 05-DEVELOPER_INFO.md 참조
- [ ] 심사 정보:
  - 데모 계정 1개 (test_review_account / 비밀번호)
  - 메모: "한국어 SLP 전용 앱. 만 14세 미만 데이터는 모두 보호자 동의 기반."
- [ ] 버전 정보: 1.0
- [ ] 빌드: Xcode 에서 업로드된 빌드 선택

---

## 🔄 출시 후 운영

### 빌드 버전 관리
- `version`: 사용자 표시용 (1.0.0, 1.0.1)
- `versionCode` / `build number`: 정수 증가 (1, 2, 3...) — 같은 번호 재업로드 불가

### 핫픽스 vs 풀 업데이트
- PWA 본체 변경 → GitHub Pages 푸시로 즉시 반영 (앱 재제출 불필요)
- 단, manifest.json / 권한 / Bundle ID 변경 시는 새 빌드 필요
- SW 캐시 버전(`madi-v?`)은 pre-commit 훅이 자동 갱신 ✓

### 사용자 피드백 모니터링
- Play Console: 리뷰 + 1점 알림 자동 이메일 설정
- App Store Connect: TestFlight 피드백 + 리뷰
- 자체: madi_audit_log 테이블 / Anthropic API 에러 율

### 향후 마일스톤 후보
- 인앱결제 (구독제 도입 시) → Google Play Billing + StoreKit 2
- 푸시 알림 강화 → 현재 Web Push 사용 중, FCM 직접 통합으로 안정성 ↑
- 위젯 (iOS / Android) → Capacitor Widget 플러그인
- Apple Watch / Wear OS 컴패니언 (먼 미래)
