# 백엔드 실행 방법

처음 저장소를 받은 뒤, 프로젝트 최상위 폴더에서 아래 순서대로 실행합니다.

## 1. 가상환경 만들기

```powershell
py -3.12 -m venv .venv
```

## 2. 필요한 패키지 설치하기

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 3. 백엔드 서버 실행하기

AI ROI 자동 설정을 사용하려면 `.env.example`을 `.env`로 복사한 뒤
Google AI Studio에서 발급받은 API 키를 입력합니다.

```dotenv
GEMINI_API_KEY=발급받은_API_키
GEMINI_ROI_MODEL=gemini-3.7-flash
```

`.env`는 Git에 포함되지 않습니다. API 키 없이도 서버와 기존 수동 ROI
기능은 실행되지만 AI 후보 생성 API는 사용할 수 없습니다.

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload
```

## 4. API 문서 확인하기

서버를 실행한 뒤 브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8000/docs
```

## 5. AI ROI 후보 생성

`POST /api/layout/suggestions`에 ROI 편집 화면에서 사용하는 캡처 이미지를
`multipart/form-data`의 `image` 필드로 전송합니다. 응답의 `layout`은 기존
ROI 편집기에 바로 전달할 수 있는 구조입니다.

이 API는 후보만 반환하고 `data/layout.json`을 수정하지 않습니다. 사용자가
후보를 확인한 후 기존 `PUT /api/layout`을 호출해야 실제로 저장됩니다.
같은 API를 다시 호출하면 새로운 후보가 생성되므로 재시도 버튼도 별도의
백엔드 상태 관리 없이 구현할 수 있습니다.

## 6. 시연 영상 분석

시연 페이지에서는 카메라 대신 업로드 영상을 원래 FPS로 재생하면서 같은
프레임을 실제 YOLO 모델로 분석합니다. 영상용 ROI는 카메라용 ROI와 별도로
`data/demo_layout.json`에 저장됩니다.

프론트 연결 순서는 다음과 같습니다.

```text
POST /api/demo/enter
POST /api/demo/video
GET  /api/demo/preview.jpg
PUT  /api/demo/layout
GET  /api/seats/stream
GET  /api/demo/stream
POST /api/demo/start
```

`/api/demo/stream`은 MJPEG 영상이며, 좌석 상태는 기존 SSE인
`/api/seats/stream`으로 전달됩니다. 시연 페이지를 나갈 때
`POST /api/demo/exit`을 호출하면 임시 영상을 지우고 카메라 분석을 다시
시작합니다.
