# TWA 도메인 전략 — assetlinks.json 호스팅 문제

## 🚨 문제

Android **TWA**(Trusted Web Activity)는 Chrome 주소창을 숨기기 위해 다음 URL이 반드시 **200 OK**로 응답해야 합니다.

```
https://<your-root-domain>/.well-known/assetlinks.json
```

**현재 배포**: `https://namga1541-prog.github.io/MADI/`

GitHub Pages는 두 종류가 있습니다.

| 종류 | URL 구조 | `.well-known` 호스팅 |
|------|---------|---------------------|
| **사용자 페이지** | `namga1541-prog.github.io/` | ✅ 가능 (루트 직접 소유) |
| **프로젝트 페이지** | `namga1541-prog.github.io/MADI/` | ❌ 불가 (루트는 별도 사용자 페이지 영역) |

현재는 **프로젝트 페이지** 방식이라 그대로는 TWA를 못 만듭니다.

## ✅ 해결 방법 3가지

### 방법 1 — 커스텀 도메인 (가장 깔끔, 권장)

```
1. 도메인 구입 (예: madi.kr, aimadi.app — 가비아·Cloudflare·Namecheap 약 1.5만원/년)
2. GitHub Pages 설정에서 Custom Domain 등록 → 자동 HTTPS
3. .well-known/assetlinks.json 이 https://madi.kr/.well-known/assetlinks.json 로 자동 노출
4. manifest.json 의 "id" 도 "https://madi.kr/" 로 갱신
```

**장점**: 깔끔한 URL, ASO에도 유리, 추후 이메일·서버 확장 용이
**단점**: 도메인 비용 + 1회 DNS 설정

### 방법 2 — 사용자 페이지로 이전

```
1. namga1541-prog/namga1541-prog.github.io 라는 새 리포지토리 생성
2. 현재 MADI 코드를 그쪽으로 이전 (또는 단순 redirect 페이지 + .well-known/ 만 두기)
3. 배포 URL: https://namga1541-prog.github.io/
```

**장점**: 무료, 추가 도메인 불필요
**단점**: URL이 길고 깃허브 의존, 동일 사용자 페이지를 다른 용도로 못 씀

### 방법 3 — 별도 PaaS 배포 (Vercel·Netlify·Cloudflare Pages)

```
1. Cloudflare Pages 같은 무료 호스팅에 코드 미러
2. *.pages.dev 또는 워크용 도메인에 .well-known 배치
3. 단점: 두 곳 동기화 부담
```

## 🎯 결정 가이드

| 상황 | 권장 |
|------|------|
| 비용 신경 안 쓰고 출시 진지 | **방법 1** (커스텀 도메인) |
| 도메인 비용 부담 + 이전 작업 가능 | 방법 2 |
| 이미 다른 인프라 운영 중 | 방법 3 |

## 📝 도메인 정한 후 해야 할 것

`assetlinks.json` 본문 갱신:
1. PWABuilder/Bubblewrap 빌드 시 출력되는 **SHA-256 fingerprint** 복사
2. `package_name` 을 Play Console 등록 패키지명과 일치 (예: `kr.madi.app`)
3. `.well-known/assetlinks.json` 의 `sha256_cert_fingerprints` 배열 갱신
4. **검증**:
   ```
   https://developers.google.com/digital-asset-links/tools/generator
   ```
   에 도메인 입력 → 녹색 체크 확인

`manifest.json` 의 `id` 도 새 도메인 절대 URL로 갱신:
```json
"id": "https://madi.kr/"
```

## 🍎 iOS는?

iOS App Store는 assetlinks.json이 필요 없습니다 — 대신 `apple-app-site-association` 파일이 비슷한 역할을 하지만 Universal Links 용으로, 일반 PWA 출시에는 불필요합니다. iOS 는 도메인 변경 없이 PWABuilder/Capacitor 로 그대로 패키징 가능합니다.
