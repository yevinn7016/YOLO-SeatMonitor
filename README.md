# YOLO SeatMonitor Frontend

도서관 좌석 상태를 실시간으로 확인하고, 카메라 화면에서 좌석별 ROI(관심 영역)를 설정하는 관리자용 React 프론트엔드입니다.

## 주요 기능

- 좌석별 이용 상태(이용 가능, 이용 중, 자리 비움, 노쇼) 확인
- SSE를 통한 좌석 상태 실시간 반영
- 자리 비움 타이머 개별·전체 초기화
- 노쇼 판정 시간 조회 및 변경
- 카메라 프레임 캡처 및 좌석 ROI 다각형 편집
- 좌석 배치 저장 및 대시보드 표시

## 기술 스택

- React 19, TypeScript, Vite
- Tailwind CSS
- TanStack Query, Zustand
- React Router
- React Konva
- Vitest, Testing Library, Playwright

## 시작하기

Node.js 22 이상과 pnpm 10 이상을 권장합니다.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

## 환경변수

`.env.local`에서 백엔드 REST API 주소를 설정합니다.

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

WebSocket 기능을 사용할 경우 다음 주소도 설정할 수 있습니다.

```env
VITE_WS_URL=ws://localhost:8000/ws
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

