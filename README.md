# MoheReact

> Mohe 장소 추천 서비스 프론트엔드 (React 모바일 웹앱)

## 기술 스택

- **Frontend**: React 19.1.0, Vite 7.0.4
- **Routing**: React Router DOM 7.7.1 (AnimatedRoutes)
- **Animations**: Framer Motion 12.23.12 + React Transition Group
- **Styling**: CSS Modules
- **State**: React Context (UserPreferencesContext)
- **Mobile**: Capacitor 7.4.4 (iOS/Android 네이티브)

## 시작하기

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # ESLint 실행
```

## 웹 페이지 URL (라우트)

### 인증 & 회원가입

| Path | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | AuthPage | 랜딩 페이지 |
| `/login` | LoginPage | 로그인 |
| `/forgot-password` | ForgotPasswordPage | 비밀번호 찾기 |
| `/signup` | EmailSignupPage | 이메일 회원가입 |
| `/verify-email` | EmailVerificationPage | 이메일 인증 (OTP) |
| `/nickname-setup` | NicknameSetupPage | 닉네임 설정 |
| `/terms` | TermsAgreementPage | 약관 동의 |
| `/password-setup` | PasswordSetupPage | 비밀번호 설정 |
| `/oauth/:provider/callback` | OAuthCallbackPage | 소셜 로그인 콜백 |

### 온보딩 (선호도 설정)

| Path | 컴포넌트 | 설명 |
|------|---------|------|
| `/age-range` | AgeRangeSelectionPage | 나이대 선택 |
| `/mbti-selection` | MBTISelectionPage | MBTI 성격 평가 |
| `/space-preference` | SpacePreferenceSelectionPage | 공간 유형 선호 |
| `/transportation-selection` | TransportationSelectionPage | 교통수단 선택 |

### 메인 앱

| Path | 컴포넌트 | 설명 |
|------|---------|------|
| `/hello` | HelloPage | 환영 페이지 |
| `/home` | HomePage | 홈 (추천 피드) |
| `/profile-settings` | ProfileSettingsPage | 프로필 설정 |
| `/profile-edit` | ProfileEditPage | 프로필 수정 |
| `/mbti-edit` | MBTIEditPage | MBTI 수정 |
| `/bookmarks` | BookmarksPage | 북마크 목록 |
| `/my-places` | MyPlacesPage | 내 등록 장소 |
| `/recent-view` | RecentViewPage | 최근 본 장소 |

### 장소 탐색

| Path | 컴포넌트 | 설명 |
|------|---------|------|
| `/places` | PlacesListPage | 장소 목록 |
| `/search-results` | SearchResultsPage | 검색 결과 |
| `/place/:id` | PlaceDetailPage | 장소 상세 |
| `/place/:id/menu` | MenuListPage | 메뉴 목록 |
| `/place/:id/review/write` | WriteReviewPage | 리뷰 작성 |

### 테스트

| Path | 컴포넌트 | 설명 |
|------|---------|------|
| `/image-test` | ImageTestPage | 이미지 처리 테스트 |
| `/location-test` | LocationTestPage | 위치 서비스 테스트 |

## 핵심 기능

### 위치 기반 서비스
- **Capacitor Geolocation**: 네이티브 GPS 좌표 획득
- **역지오코딩**: Vworld API를 통한 좌표→주소 변환 (`useReverseGeocoding` 훅)
- **사용자 위치 등록**: 접속 시 40km 반경 크롤링 우선순위 자동 등록

### 애니메이션 시스템
- 라우트 계층 기반 방향성 슬라이드 전환 (forward/backward)
- 스크롤 위치 보존
- 스와이프 뒤로가기 제스처 (모바일)

### 사용자 흐름
```
랜딩 → 로그인/가입 → 이메일 인증 → 선호도 설정
  → 홈 (추천) → 장소 목록 → 장소 상세 → 프로필
```

## Docker / Caddy

프로덕션 환경에서 Caddy 리버스 프록시 뒤에서 동작합니다:

```
https://mohe.app/*           → mohe-react-app:80 (기본)
https://mohe.app/api/*       → spring:8080
https://mohe.app/admin/*     → mohe-admin-app:80
https://mohe.app/image/*     → moheimageprocessor-app-1:5200
```

## 작성자

**Andrew Lim (임석현)** - sjsh1623@gmail.com
