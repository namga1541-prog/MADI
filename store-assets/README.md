# 스토어 출시 에셋 패키지

Google Play / App Store 동시 출시를 위한 에셋·문서 모음입니다.

## 📁 구성
| 파일 | 용도 |
|------|------|
| [01-ASSET_CHECKLIST.md](./01-ASSET_CHECKLIST.md) | 필요한 이미지·동영상 사양 체크리스트 |
| [02-STORE_LISTING_KO.md](./02-STORE_LISTING_KO.md) | 한국어 스토어 본문 (앱 이름·짧은 설명·전체 설명·What's New) |
| [03-STORE_LISTING_EN.md](./03-STORE_LISTING_EN.md) | 영문 스토어 본문 (글로벌 출시 시) |
| [04-ASO_KEYWORDS.md](./04-ASO_KEYWORDS.md) | 검색 키워드·카테고리·콘텐츠 등급·데이터 안전 양식 |
| [05-DEVELOPER_INFO.md](./05-DEVELOPER_INFO.md) | 개발자/배포자 정보 양식 (계정 등록 시) |
| [06-SUBMISSION_RUNBOOK.md](./06-SUBMISSION_RUNBOOK.md) | 실제 제출 절차 (PWABuilder / Bubblewrap / Capacitor) |

## 🎯 출시 경로 요약

### 옵션 A — PWA 그대로 (가장 빠름)
- **Android**: [PWABuilder](https://www.pwabuilder.com/) 에 `https://namga1541-prog.github.io/MADI/` 입력 → AAB 다운로드 → Play Console 업로드
- **iOS**: 동일하게 PWABuilder → iOS 패키지 (실제로는 Capacitor 래핑된 형태) → Xcode 빌드 → App Store Connect

### 옵션 B — Capacitor 직접 래핑 (네이티브 기능 필요시)
- macOS + Xcode + Android Studio 필요
- 푸시 알림·딥링크 등 네이티브 SDK 직접 연동 가능

> 현재 PWA 가 이미 사용 가능하므로 **옵션 A 권장**. 추후 푸시·생체 인증 등이 필요하면 Capacitor 로 전환.

## 📌 출시 전 마지막 확인사항
- [ ] `manifest.json` Lighthouse "Installable" 통과
- [ ] HTTPS 운영 (GitHub Pages 자동 적용 ✓)
- [ ] 개인정보처리방침 URL 공개 (`/MADI/privacy.html`)
- [ ] 1024×1024 앱 아이콘 (`/icon-1024.png` 생성됨 ✓)
- [ ] 스크린샷 5장 이상 (모바일 / 태블릿)
- [ ] 개발자 계정 등록 완료 (Google: $25 일회, Apple: $99/년)
