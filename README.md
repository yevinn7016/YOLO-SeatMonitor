# YOLO SeatMonitor Frontend

도서관 좌석 상태를 실시간으로 확인하고, 관리자가 카메라 화면에서 좌석별 ROI(관심 영역)를 설정·테스트하는 React 프론트엔드입니다.

## 주요 기능

### 사용자 화면 (`/seats`)

- 좌석별 이용 상태(사용 가능, 사용 중, 자리 비움, 노쇼) 확인
- 테이블 단위 좌석 배치 표시
- SSE를 통한 좌석 상태 실시간 반영
- 백엔드 헬스체크 및 연결 상태 표시

### 관리자 화면 (`/admin`)

관리자 로그인(기본 비밀번호: `0000`, `sessionStorage` 기반) 후 접근합니다.

- **좌석 영역 설정** (`/admin/layout`)
  - 카메라 프레임 실시간 확인 및 캡처
  - React Konva 기반 좌석 ROI 다각형 편집
  - AI(Gemini) 좌석 후보 자동 생성
  - 좌석 배치 저장
- **카메라 · 시연 영상** (`/admin/camera-demo`)
  - 실시간 카메라 + 좌석 상태 오버레이
  - 업로드 영상 기반 데모 재생 및 좌석 판정 테스트
  - 노쇼 기준 시간(초) 조회·변경
  - 개별·전체 자리 비움 타이머 초기화

## 기술 스택

- React 19, TypeScript, Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- TanStack Query (서버 상태), React Router (라우팅)
- React Konva (ROI 편집기)
- Vitest + Testing Library (단위·컴포넌트 테스트)
- Playwright (E2E 테스트)

## 시작하기

### 요구 사항

- Node.js 22 이상
- pnpm 10 이상
- 백엔드 API 서버 (기본 `http://localhost:8000`)

### 설치 및 실행

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

## 환경변수

`.env.local`에서 백엔드 주소를 설정합니다. 템플릿은 `.env.example`을 참고하세요.

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `VITE_API_BASE_URL` | 권장 | `http://localhost:8000/api` | REST API 베이스 URL |
| `VITE_WS_URL` | 선택 | (없음) | WebSocket URL 예비 설정. 현재 앱은 SSE(`/seats/stream`)를 사용합니다. |

```env
VITE_API_BASE_URL=http://localhost:8000/api
# VITE_WS_URL=ws://localhost:8000/ws/seats
```

## 명령어

```text
pnpm dev          개발 서버 실행
pnpm build        타입 검사 후 프로덕션 빌드
pnpm preview      빌드 결과 미리보기
pnpm lint         ESLint 검사
pnpm typecheck    TypeScript 타입 검사
pnpm test         Vitest 단위·컴포넌트 테스트
pnpm test:watch   Vitest 감시 모드
pnpm test:e2e     Playwright 브라우저 테스트
```

Playwright를 처음 실행할 때는 Chromium 설치가 필요합니다.

```powershell
pnpm exec playwright install chromium
```

## 프로젝트 구조

```text
.
├── e2e/                        # Playwright E2E 테스트
├── src/
│   ├── app.tsx                 # 라우팅 정의
│   ├── main.tsx                # 앱 진입점
│   ├── assets/                 # 정적 이미지
│   ├── components/
│   │   ├── camera-demo/        # 실시간 카메라 패널
│   │   ├── layout/             # 관리자 레이아웃
│   │   ├── ui/                 # 공통 UI (Button 등)
│   │   ├── camera-frame-view.tsx
│   │   └── seat-roi-editor.tsx # Konva ROI 편집기
│   ├── hooks/
│   │   ├── use-seat-api.ts     # TanStack Query 훅
│   │   ├── use-seat-events.ts  # SSE 실시간 좌석 이벤트
│   │   └── use-camera-frame.ts # 카메라 프레임 폴링
│   ├── lib/                    # API 클라이언트, 유틸, 매퍼
│   ├── pages/                  # 화면별 페이지 컴포넌트
│   ├── services/               # REST API 호출 모듈
│   ├── types/                  # TypeScript 타입 정의
│   └── test/                   # Vitest 설정
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### 라우팅

| 경로 | 화면 | 설명 |
|------|------|------|
| `/` | 역할 선택 | 사용자 / 관리자 진입점 |
| `/seats` | 좌석 현황 | 일반 사용자용 실시간 현황 |
| `/admin/login` | 관리자 로그인 | 비밀번호 인증 |
| `/admin/layout` | 좌석 영역 설정 | ROI 편집 및 저장 |
| `/admin/camera-demo` | 카메라 · 시연 영상 | 실시간/데모 테스트 |

## 백엔드 연동

프론트엔드는 `VITE_API_BASE_URL` 기준으로 REST API와 SSE를 사용합니다. 백엔드가 실행 중이어야 대부분의 화면이 정상 동작합니다.

### REST API (`src/services/seat-api.ts`, `demo-api.ts`)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `GET` | `/health` | 서버·카메라·ROI 상태 확인 |
| `GET` | `/layout` | 저장된 좌석 배치 조회 |
| `PUT` | `/layout` | 좌석 배치 저장 |
| `POST` | `/layout/suggestions` | AI 좌석 ROI 후보 생성 (이미지 업로드) |
| `GET` | `/seats` | 전체 좌석 상태 조회 |
| `POST` | `/seats/{seat_id}/reset` | 개별 타이머 초기화 |
| `POST` | `/seats/reset` | 전체 타이머 초기화 |
| `GET` | `/settings` | 노쇼 기준 시간 조회 |
| `PUT` | `/settings` | 노쇼 기준 시간 저장 |
| `GET` | `/camera/frame.jpg` | 카메라 프레임 이미지 |
| `POST` | `/demo/enter` | 데모 모드 진입 |
| `POST` | `/demo/video` | 시연 영상 업로드 |
| `GET` | `/demo/layout` | 데모용 좌석 배치 조회 |
| `PUT` | `/demo/layout` | 데모용 좌석 배치 저장 |
| `POST` | `/demo/start` | 데모 재생 시작 |
| `GET` | `/demo/status` | 데모 재생 상태 |
| `POST` | `/demo/stop` | 데모 재생 중지 |
| `POST` | `/demo/exit` | 데모 모드 종료 |
| `GET` | `/demo/preview.jpg` | 데모 프리뷰 프레임 |
| `GET` | `/demo/stream` | 데모 스트림 |

### 실시간 이벤트 (SSE)

- **엔드포인트:** `GET /seats/stream`
- **구현:** `src/hooks/use-seat-events.ts`
- 서버에서 좌석 상태 배열(`SeatState[]`)을 push하면 TanStack Query 캐시를 갱신합니다.

## 테스트

- **단위 테스트:** `src/**/*.test.{ts,tsx}` (Vitest + jsdom)
- **E2E 테스트:** `e2e/` (Playwright, 개발 서버 자동 기동)
